import type { JobSource } from "../types";
import { adzunaSource } from "./adzuna";
import { joobleSource } from "./jooble";
import { jsearchSource } from "./jsearch";

// Sources whose credentials are configured, in priority order
export const configuredSources = (env: NodeJS.ProcessEnv = process.env): JobSource[] => {
  const sources: JobSource[] = [];
  if (env.ADZUNA_APP_ID && env.ADZUNA_APP_KEY) sources.push(adzunaSource(env.ADZUNA_APP_ID, env.ADZUNA_APP_KEY));
  if (env.JOOBLE_API_KEY) sources.push(joobleSource(env.JOOBLE_API_KEY));
  if (env.RAPIDAPI_KEY) sources.push(jsearchSource(env.RAPIDAPI_KEY));
  return sources;
};
