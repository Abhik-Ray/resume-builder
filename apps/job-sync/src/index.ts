import type { Database } from "@resume-builder/shared";
import { createClient } from "@supabase/supabase-js";
import { runSync } from "./pipeline";
import { configuredSources } from "./sources";
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
  if (sources.length === 0) throw new Error("No job source is configured (ADZUNA_*, JOOBLE_API_KEY or RAPIDAPI_KEY)");

  const result = await runSync(supabaseStore(supabase), sources, {
    info: (message) => console.log(message),
    warn: (message) => console.warn(`::warning::${message}`),
  });
  console.log(
    `Done: ${result.jobsSeen} jobs seen, ${result.jobsNew} new, ${result.matchesNew} new matches, ${result.errors.length} errors`,
  );
  if (result.allSourcesFailed) {
    console.error("::error::Every source failed; see sync_runs.errors");
    process.exitCode = 1;
  }
};

main().catch((error: unknown) => {
  console.error(`::error::${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
});
