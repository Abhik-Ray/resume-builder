import { z } from "zod";
import type { Fetch, JobSource, NormalizedJob, SearchQuery } from "../types";
import { SourceError } from "../types";
import { fetchJson, plainText, REMOTE_PATTERN } from "./http";

// Countries Adzuna serves (https://developer.adzuna.com/docs/search)
export const ADZUNA_COUNTRIES = new Set([
  "at", "au", "be", "br", "ca", "ch", "de", "es", "fr", "gb", "in", "it", "mx", "nl", "nz", "pl", "sg", "us", "za",
]);

const responseSchema = z.object({
  results: z.array(
    z.object({
      id: z.union([z.string(), z.number()]).transform(String),
      title: z.string(),
      description: z.string().nullish(),
      redirect_url: z.string(),
      created: z.string().nullish(),
      company: z.object({ display_name: z.string().nullish() }).nullish(),
      location: z.object({ display_name: z.string().nullish() }).nullish(),
    }),
  ),
});

export const adzunaSource = (appId: string, appKey: string, fetchFn: Fetch = fetch): JobSource => ({
  name: "adzuna",
  async searchJobs(query: SearchQuery): Promise<NormalizedJob[]> {
    const country = query.country.toLowerCase();
    if (!ADZUNA_COUNTRIES.has(country)) throw new SourceError(`Adzuna doesn't cover ${query.country}`);
    // Adzuna only takes its credentials as query parameters
    const params = new URLSearchParams({
      app_id: appId,
      app_key: appKey,
      results_per_page: "50",
      // Any keyword; the matcher scores and filters
      what_or: query.keywords.join(" "),
      max_days_old: "3",
      sort_by: "date",
    });
    if (query.remote) {
      params.set("what_and", "remote");
    } else if (query.city) {
      params.set("where", query.city);
      params.set("distance", String(query.radiusKm));
    }
    const data = await fetchJson(
      fetchFn,
      "Adzuna",
      `https://api.adzuna.com/v1/api/jobs/${country}/search/1?${params}`,
      responseSchema,
    );
    return data.results.map((job) => {
      const description = plainText(job.description);
      return {
        source: "adzuna",
        externalId: job.id,
        company: job.company?.display_name?.trim() || "Unknown company",
        title: plainText(job.title) ?? job.title,
        location: job.location?.display_name ?? null,
        remote: query.remote || REMOTE_PATTERN.test(`${job.title} ${description ?? ""}`),
        url: job.redirect_url,
        description,
        postedAt: job.created ?? null,
      };
    });
  },
});
