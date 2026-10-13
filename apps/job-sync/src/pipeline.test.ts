import { describe, expect, it, vi } from "vitest";
import { jobKey, runSync, type MatchInsert, type RunSummary, type SyncStore } from "./pipeline";
import type { BoardSource, JobSource, NormalizedJob, SearchQuery, UserSearch, WatchedBoard } from "./types";

const job = (id: string, title = "React Developer"): NormalizedJob => ({
  source: "adzuna",
  externalId: id,
  company: `Company ${id}`,
  title,
  location: "Bengaluru",
  remote: false,
  url: `https://example.com/${id}`,
  description: "TypeScript",
  postedAt: null,
});

const search = (patch: Partial<UserSearch> = {}): UserSearch => ({
  userId: "u1",
  searchProfileId: "s1",
  keywords: ["react"],
  excludeKeywords: [],
  minScore: 3,
  remoteOnly: false,
  includeRemote: false,
  country: "IN",
  city: "Bengaluru",
  region: null,
  radiusKm: 50,
  ...patch,
});

// In-memory database with the same idempotency rules as the real one
const memoryStore = (searches: UserSearch[], boards: WatchedBoard[] = []) => {
  const jobs = new Map<string, { id: string; source: string; lastSeen: Date; closedAt: Date | null; description: string | null }>();
  let clock = new Date("2026-10-13T00:30:00Z");
  const matches = new Map<string, MatchInsert>();
  const runs: RunSummary[] = [];
  const store: SyncStore = {
    startRun: async () => runs.length,
    finishRun: async (_id, summary) => void runs.push(summary),
    loadSearches: async () => searches,
    saveJobs: async (list) => {
      const result = new Map<string, { id: string; isNew: boolean }>();
      for (const j of list) {
        const key = jobKey(j);
        const isNew = !jobs.has(key);
        const id = jobs.get(key)?.id ?? `job-${jobs.size + 1}`;
        jobs.set(key, { id, source: j.source, lastSeen: clock, closedAt: null, description: j.description });
        result.set(key, { id, isNew });
      }
      return result;
    },
    saveMatches: async (list) => {
      let inserted = 0;
      for (const m of list) {
        const key = `${m.userId}:${m.jobId}`;
        if (!matches.has(key)) {
          matches.set(key, m);
          inserted += 1;
        }
      }
      return inserted;
    },
    loadWatchedBoards: async () => boards,
    closeStaleJobs: async (sources, seenBefore) => {
      let closed = 0;
      for (const j of jobs.values()) {
        if (!j.closedAt && sources.includes(j.source as never) && j.lastSeen < seenBefore) {
          j.closedAt = clock;
          closed += 1;
        }
      }
      return closed;
    },
    pruneClosedJobs: async (closedBefore) => {
      for (const j of jobs.values()) if (j.closedAt && j.closedAt < closedBefore) j.description = null;
    },
  };
  const setClock = (date: Date) => {
    clock = date;
  };
  return { store, jobs, matches, runs, setClock };
};

const source = (name: JobSource["name"], results: (q: SearchQuery) => NormalizedJob[] | Error): JobSource => ({
  name,
  searchJobs: vi.fn(async (q: SearchQuery) => {
    const r = results(q);
    if (r instanceof Error) throw r;
    return r;
  }),
});

const log = { info: vi.fn(), warn: vi.fn() };

describe("runSync", () => {
  it("stores jobs, matches them per user and records the run", async () => {
    const db = memoryStore([search(), search({ userId: "u2", searchProfileId: "s2", minScore: 4 })]);
    const result = await runSync(db.store, [source("adzuna", () => [job("1"), job("2", "Chef")])], log);

    expect(result).toMatchObject({ jobsSeen: 2, jobsNew: 2, matchesNew: 1, allSourcesFailed: false });
    expect([...db.matches.values()]).toEqual([
      { userId: "u1", jobId: "job-1", searchProfileId: "s1", keywordScore: 3 },
    ]);
    expect(db.runs).toEqual([{ jobsSeen: 2, jobsNew: 2, matchesNew: 1, jobsClosed: 0, errors: [] }]);
  });

  it("sends a shared query once for every user who needs it", async () => {
    const adzuna = source("adzuna", () => [job("1")]);
    const db = memoryStore([search(), search({ userId: "u2", searchProfileId: "s2" })]);
    const result = await runSync(db.store, [adzuna], log);
    expect(adzuna.searchJobs).toHaveBeenCalledTimes(1);
    expect(result.matchesNew).toBe(2);
  });

  it("is idempotent: a re-run creates no duplicates", async () => {
    const db = memoryStore([search()]);
    const sources = [source("adzuna", () => [job("1")])];
    await runSync(db.store, sources, log);
    const second = await runSync(db.store, sources, log);
    expect(second).toMatchObject({ jobsNew: 0, matchesNew: 0 });
    expect(db.matches.size).toBe(1);
  });

  it("keeps going when one source fails, and records the error", async () => {
    const db = memoryStore([search()]);
    const result = await runSync(
      db.store,
      [source("adzuna", () => new Error("Adzuna returned HTTP 500")), source("jooble", () => [job("1")])],
      log,
    );
    expect(result.matchesNew).toBe(1);
    expect(result.allSourcesFailed).toBe(false);
    expect(result.errors).toEqual([
      { source: "adzuna", query: "react · Bengaluru, IN", message: "Adzuna returned HTTP 500" },
    ]);
  });

  it("reports when every source fails", async () => {
    const db = memoryStore([search()]);
    const result = await runSync(db.store, [source("adzuna", () => new Error("down"))], log);
    expect(result.allSourcesFailed).toBe(true);
    expect(db.runs[0].errors).toHaveLength(1);
  });

  it("is a quiet success with no searches", async () => {
    const db = memoryStore([]);
    const result = await runSync(db.store, [source("adzuna", () => [job("1")])], log);
    expect(result).toMatchObject({ jobsSeen: 0, allSourcesFailed: false, errors: [] });
  });

  it("records database failures and fails the run", async () => {
    const db = memoryStore([search()]);
    db.store.saveJobs = async () => {
      throw new Error("connection lost");
    };
    const result = await runSync(db.store, [source("adzuna", () => [job("1")])], log);
    expect(result.allSourcesFailed).toBe(true);
    expect(db.runs[0].errors).toEqual([{ source: "sync", query: "", message: "connection lost" }]);
  });

  it("counts a posting once though several queries find it", async () => {
    const db = memoryStore([search({ includeRemote: true })]);
    const result = await runSync(db.store, [source("adzuna", () => [job("1")])], log);
    expect(result).toMatchObject({ jobsSeen: 1, jobsNew: 1, matchesNew: 1 });
  });

  it("caps the number of queries per run", async () => {
    const adzuna = source("adzuna", () => []);
    const searches = ["a", "b", "c"].map((k, i) => search({ keywords: [k], searchProfileId: `s${i}` }));
    const result = await runSync(memoryStore(searches).store, [adzuna], log, { maxQueriesPerSource: 2 });
    expect(adzuna.searchJobs).toHaveBeenCalledTimes(2);
    expect(result.errors[0].message).toBe("1 queries skipped: over the cap of 2 per run");
    expect(result.allSourcesFailed).toBe(false);
  });

  describe("watched company boards", () => {
    const boardJob = (id: string, patch: Partial<NormalizedJob> = {}): NormalizedJob => ({
      ...job(id),
      source: "lever",
      externalId: `globex:${id}`,
      company: "globex",
      ...patch,
    });
    const lever = (jobs: NormalizedJob[] | Error): BoardSource => ({
      name: "lever",
      listJobs: vi.fn(async () => {
        if (jobs instanceof Error) throw jobs;
        return jobs;
      }),
    });
    const board: WatchedBoard = { provider: "lever", board: "globex", name: "Globex", userIds: ["u1"] };

    it("matches board postings against the watchers' searches near home", async () => {
      const db = memoryStore([search(), search({ userId: "u2", searchProfileId: "s2" })], [board]);
      const source = lever([
        boardJob("1"),
        boardJob("2", { location: "Berlin" }),
        boardJob("3", { location: null, remote: true }),
      ]);
      const result = await runSync(db.store, [], log, { boardSources: [source] });
      expect(source.listJobs).toHaveBeenCalledWith("globex");
      // u2 doesn't watch the board; Berlin is too far; remote isn't wanted by this search
      expect([...db.matches.values()].map((m) => [m.userId, m.jobId])).toEqual([["u1", "job-1"]]);
      expect(result).toMatchObject({ jobsSeen: 3, matchesNew: 1, allSourcesFailed: false });
    });

    it("names Lever postings after the watch list entry", async () => {
      const db = memoryStore([search()], [board]);
      const saveJobs = vi.spyOn(db.store, "saveJobs");
      await runSync(db.store, [], log, { boardSources: [lever([boardJob("1")])] });
      expect(saveJobs.mock.calls[0][0][0].company).toBe("Globex");
    });

    it("records a failing board and carries on", async () => {
      const db = memoryStore([search()], [board]);
      const result = await runSync(db.store, [source("adzuna", () => [job("1")])], log, {
        boardSources: [lever(new Error("Lever returned HTTP 404"))],
      });
      expect(result.errors).toEqual([{ source: "lever", query: "lever/globex", message: "Lever returned HTTP 404" }]);
      expect(result.allSourcesFailed).toBe(false);
    });
  });

  describe("closed jobs", () => {
    it("closes postings no working source has listed for 30 days, and prunes old ones", async () => {
      const db = memoryStore([search()]);
      const adzuna = source("adzuna", () => [job("1")]);
      db.setClock(new Date("2026-08-01T00:00:00Z"));
      await runSync(db.store, [adzuna], log, { now: new Date("2026-08-01T00:00:00Z") });

      // Six weeks later the posting no longer comes back
      vi.mocked(adzuna.searchJobs).mockResolvedValue([job("2")]);
      db.setClock(new Date("2026-09-12T00:00:00Z"));
      const result = await runSync(db.store, [adzuna], log, { now: new Date("2026-09-12T00:00:00Z") });
      expect(result.jobsClosed).toBe(1);
      expect(db.jobs.get("adzuna:1")?.closedAt).toEqual(new Date("2026-09-12T00:00:00Z"));
      expect(db.jobs.get("adzuna:1")?.description).toBe("TypeScript");

      // Ninety days after closing, the description goes
      db.setClock(new Date("2026-12-20T00:00:00Z"));
      await runSync(db.store, [adzuna], log, { now: new Date("2026-12-20T00:00:00Z") });
      expect(db.jobs.get("adzuna:1")?.description).toBeNull();
    });

    it("closes nothing when no source answered", async () => {
      const db = memoryStore([search()]);
      const closeStaleJobs = vi.spyOn(db.store, "closeStaleJobs");
      await runSync(db.store, [source("adzuna", () => new Error("down"))], log);
      expect(closeStaleJobs).not.toHaveBeenCalled();
    });

    it("only lets the sources that answered close their own postings", async () => {
      const db = memoryStore([search()]);
      const closeStaleJobs = vi.spyOn(db.store, "closeStaleJobs");
      await runSync(
        db.store,
        [source("adzuna", () => new Error("down")), source("jooble", () => [])],
        log,
      );
      expect(closeStaleJobs.mock.calls[0][0]).toEqual(["jooble"]);
    });
  });
});
