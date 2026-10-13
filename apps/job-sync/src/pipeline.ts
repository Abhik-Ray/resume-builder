import { dedupeJobs, matchesSearch } from "./match";
import { planQueries } from "./query";
import type { JobSource, NormalizedJob, SourceName, UserSearch } from "./types";

export interface SyncError {
  source: SourceName | "sync";
  query: string;
  message: string;
}

export interface MatchInsert {
  userId: string;
  jobId: string;
  searchProfileId: string;
  keywordScore: number;
}

export interface RunSummary {
  jobsSeen: number;
  jobsNew: number;
  matchesNew: number;
  errors: SyncError[];
}

// Everything the pipeline needs from the database; store.ts is the Supabase version
export interface SyncStore {
  startRun(): Promise<number>;
  finishRun(id: number, summary: RunSummary): Promise<void>;
  loadSearches(): Promise<UserSearch[]>;
  // Upserts by (source, external_id); returns the id of each job and whether it is new
  saveJobs(jobs: NormalizedJob[]): Promise<Map<string, { id: string; isNew: boolean }>>;
  // Inserts matches that don't exist yet; returns how many were new
  saveMatches(matches: MatchInsert[]): Promise<number>;
}

export interface Logger {
  info(message: string): void;
  warn(message: string): void;
}

export const jobKey = (job: Pick<NormalizedJob, "source" | "externalId">) => `${job.source}:${job.externalId}`;

const describeQuery = (q: { keywords: string[]; city: string | null; country: string; remote: boolean }) =>
  `${q.keywords.join(" ")} · ${q.remote ? "remote" : `${q.city}, ${q.country}`}`;

const errorMessage = (error: unknown) => (error instanceof Error ? error.message : String(error));

export interface SyncResult extends RunSummary {
  // True when every source failed every query (the workflow then fails)
  allSourcesFailed: boolean;
}

// One run: plan shared queries, ask each source in turn, store jobs, match them per user.
// A failing source is recorded in sync_runs.errors and the rest continue.
export const runSync = async (
  store: SyncStore,
  sources: JobSource[],
  log: Logger,
  maxQueriesPerSource = 50,
): Promise<SyncResult> => {
  const runId = await store.startRun();
  const errors: SyncError[] = [];
  let jobsSeen = 0;
  let jobsNew = 0;
  let matchesNew = 0;
  const workingSources = new Set<SourceName>();
  let crashed = false;
  const seen = new Set<string>();

  try {
    const searches = await store.loadSearches();
    const queries = planQueries(searches);
    log.info(`${searches.length} active searches → ${queries.length} unique queries, ${sources.length} sources`);

    // Capped per run, to stay well inside each free quota
    if (queries.length > maxQueriesPerSource) {
      errors.push({
        source: "sync",
        query: "",
        message: `${queries.length - maxQueriesPerSource} queries skipped: over the cap of ${maxQueriesPerSource} per run`,
      });
    }

    for (const planned of queries.slice(0, maxQueriesPerSource)) {
      const found: NormalizedJob[] = [];
      // One source at a time, one request each
      for (const source of sources) {
        try {
          const jobs = await source.searchJobs(planned.query);
          workingSources.add(source.name);
          found.push(...jobs);
        } catch (error) {
          const message = errorMessage(error);
          errors.push({ source: source.name, query: describeQuery(planned.query), message });
          log.warn(`${source.name}: ${message}`);
        }
      }

      const jobs = dedupeJobs(found);
      if (jobs.length === 0) continue;
      const saved = await store.saveJobs(jobs);
      // Count each posting once per run, though several queries can find it
      for (const [key, { isNew }] of saved) {
        if (seen.has(key)) continue;
        seen.add(key);
        jobsSeen += 1;
        if (isNew) jobsNew += 1;
      }

      const matches: MatchInsert[] = [];
      for (const search of planned.searches) {
        for (const job of jobs) {
          const score = matchesSearch(job, search);
          const stored = saved.get(jobKey(job));
          if (score === null || !stored) continue;
          matches.push({ userId: search.userId, jobId: stored.id, searchProfileId: search.searchProfileId, keywordScore: score });
        }
      }
      matchesNew += await store.saveMatches(matches);
    }
  } catch (error) {
    // The database or something outside a source failed: record it and fail the workflow
    crashed = true;
    errors.push({ source: "sync", query: "", message: errorMessage(error) });
    log.warn(`sync: ${errorMessage(error)}`);
  }

  const summary = { jobsSeen, jobsNew, matchesNew, errors };
  await store.finishRun(runId, summary);
  const triedSources = errors.some((e) => e.source !== "sync") || workingSources.size > 0;
  return {
    ...summary,
    allSourcesFailed: crashed || (triedSources && workingSources.size === 0),
  };
};
