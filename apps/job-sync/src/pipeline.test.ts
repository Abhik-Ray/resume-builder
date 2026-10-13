import { describe, expect, it, vi } from "vitest";
import { jobKey, runSync, type MatchInsert, type RunSummary, type SyncStore } from "./pipeline";
import type { JobSource, NormalizedJob, SearchQuery, UserSearch } from "./types";

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
const memoryStore = (searches: UserSearch[]) => {
  const jobs = new Map<string, { id: string }>();
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
        if (isNew) jobs.set(key, { id: `job-${jobs.size + 1}` });
        result.set(key, { id: jobs.get(key)!.id, isNew });
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
  };
  return { store, jobs, matches, runs };
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
    expect(db.runs).toEqual([{ jobsSeen: 2, jobsNew: 2, matchesNew: 1, errors: [] }]);
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
    const result = await runSync(memoryStore(searches).store, [adzuna], log, 2);
    expect(adzuna.searchJobs).toHaveBeenCalledTimes(2);
    expect(result.errors[0].message).toBe("1 queries skipped: over the cap of 2 per run");
    expect(result.allSourcesFailed).toBe(false);
  });
});
