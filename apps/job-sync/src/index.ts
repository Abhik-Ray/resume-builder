import type { Database } from "@resume-builder/shared";
import { createClient } from "@supabase/supabase-js";
import { judgeJobPosting } from "@resume-builder/ai/judge";
import { judgeOwnerMatches, ownerJudgingFromEnv } from "./autoJudge";
import { runSync } from "./pipeline";
import { boardSources, configuredSources } from "./sources";
import { supabaseStore } from "./store";

// The daily job sync, run by .github/workflows/job-sync.yml. Never log keys or request URLs.

const required = (name: string) => {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is not set`);
  return value;
};

const main = async () => {
  const supabase = createClient<Database>(required("SUPABASE_URL"), required("SUPABASE_SERVICE_ROLE_KEY"), {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const sources = configuredSources();

  const store = supabaseStore(supabase);
  const log = {
    info: (message: string) => console.log(message),
    warn: (message: string) => console.warn(`::warning::${message}`),
  };
  // Watched company boards need no key, so the run goes ahead with them alone
  if (sources.length === 0) log.warn("No job-search source is configured (ADZUNA_*, JOOBLE_API_KEY or RAPIDAPI_KEY)");
  const ownerJudging = ownerJudgingFromEnv(process.env);
  const result = await runSync(store, sources, log, { boardSources: boardSources() });
  console.log(
    `Done: ${result.jobsSeen} jobs seen, ${result.jobsNew} new, ${result.matchesNew} new matches, ${result.jobsClosed} closed, ${result.errors.length} errors`,
  );
  if (ownerJudging) {
    // Optional and never fatal: matches stay unjudged for the browser when it fails
    try {
      const { judged, failed } = await judgeOwnerMatches(store, ownerJudging, judgeJobPosting, log);
      console.log(`Owner auto-judging: ${judged} judged, ${failed} failed`);
    } catch (error) {
      log.warn(`Owner auto-judging failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
  if (result.allSourcesFailed) {
    console.error("::error::Every source failed; see sync_runs.errors");
    process.exitCode = 1;
  }
};

main().catch((error: unknown) => {
  console.error(`::error::${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
});
