import type { Database } from "@resume-builder/shared";
import type { SupabaseClient } from "@supabase/supabase-js";
import { jobKey, type MatchInsert, type RunSummary, type SyncStore } from "./pipeline";
import type { NormalizedJob, UserSearch } from "./types";

type Client = SupabaseClient<Database>;

// Supabase limits rows per request; stay well under it
const BATCH = 200;

const chunks = <T>(items: T[]) =>
  Array.from({ length: Math.ceil(items.length / BATCH) }, (_, i) => items.slice(i * BATCH, (i + 1) * BATCH));

// The service-role client bypasses RLS: the job sync is the only writer of jobs and matches
export const supabaseStore = (supabase: Client): SyncStore => {
  // The run's start on the database clock: jobs first seen after it are new
  let runStartedAt = Number.NEGATIVE_INFINITY;
  return {
  async startRun() {
    const { data, error } = await supabase.from("sync_runs").insert({}).select("id, started_at").single();
    if (error) throw error;
    runStartedAt = Date.parse(data.started_at);
    return data.id;
  },

  async finishRun(id: number, summary: RunSummary) {
    const { error } = await supabase
      .from("sync_runs")
      .update({
        finished_at: new Date().toISOString(),
        jobs_seen: summary.jobsSeen,
        jobs_new: summary.jobsNew,
        matches_new: summary.matchesNew,
        errors: summary.errors as unknown as Database["public"]["Tables"]["sync_runs"]["Row"]["errors"],
      })
      .eq("id", id);
    if (error) throw error;
  },

  async loadSearches(): Promise<UserSearch[]> {
    const [searches, profiles] = await Promise.all([
      supabase.from("search_profiles").select("*").eq("active", true),
      supabase.from("profiles").select("user_id, home_city, home_region, home_country, search_radius_km, include_remote"),
    ]);
    if (searches.error) throw searches.error;
    if (profiles.error) throw profiles.error;
    const byUser = new Map(profiles.data.map((p) => [p.user_id, p]));
    return searches.data.flatMap((search): UserSearch[] => {
      const profile = byUser.get(search.user_id);
      // A search needs the home country, and a city unless it's remote-only
      const city = search.location_override?.trim() || profile?.home_city?.trim();
      if (!profile?.home_country || (!city && !search.remote_only)) return [];
      return [
        {
          userId: search.user_id,
          searchProfileId: search.id,
          keywords: search.keywords,
          excludeKeywords: search.exclude_keywords,
          minScore: search.min_score,
          remoteOnly: search.remote_only,
          includeRemote: profile.include_remote,
          country: profile.home_country,
          city: city ?? "",
          // The home region only applies to the home city
          region: search.location_override?.trim() ? null : profile.home_region,
          radiusKm: profile.search_radius_km,
        },
      ];
    });
  },

  async saveJobs(jobs: NormalizedJob[]) {
    const saved = new Map<string, { id: string; isNew: boolean }>();
    for (const batch of chunks(jobs)) {
      const now = new Date().toISOString();
      // first_seen_at is left out so the column default only applies to new rows
      const { data, error } = await supabase
        .from("jobs")
        .upsert(
          batch.map((job) => ({
            source: job.source,
            external_id: job.externalId,
            company: job.company,
            title: job.title,
            location: job.location,
            remote: job.remote,
            url: job.url,
            description: job.description,
            posted_at: job.postedAt,
            last_seen_at: now,
          })),
          { onConflict: "source,external_id" },
        )
        .select("id, source, external_id, first_seen_at");
      if (error) throw error;
      for (const row of data) {
        saved.set(jobKey({ source: row.source as NormalizedJob["source"], externalId: row.external_id }), {
          id: row.id,
          isNew: Date.parse(row.first_seen_at) >= runStartedAt,
        });
      }
    }
    return saved;
  },

  async saveMatches(matches: MatchInsert[]) {
    const unique = [...new Map(matches.map((m) => [`${m.userId}:${m.jobId}`, m])).values()];
    let inserted = 0;
    for (const batch of chunks(unique)) {
      // ignoreDuplicates: an existing match (and its verdict and state) is left alone
      const { data, error } = await supabase
        .from("job_matches")
        .upsert(
          batch.map((m) => ({
            user_id: m.userId,
            job_id: m.jobId,
            search_profile_id: m.searchProfileId,
            keyword_score: m.keywordScore,
          })),
          { onConflict: "user_id,job_id", ignoreDuplicates: true },
        )
        .select("job_id");
      if (error) throw error;
      inserted += data.length;
    }
    return inserted;
  },
  };
};
