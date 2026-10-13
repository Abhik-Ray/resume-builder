import { z } from "zod";
import type { Fetch, JobSource, NormalizedJob, SearchQuery } from "../types";
import { fetchJson, plainText, REMOTE_PATTERN } from "./http";

const responseSchema = z.object({
  jobs: z.array(
    z.object({
      id: z.union([z.string(), z.number()]).transform(String),
      title: z.string(),
      location: z.string().nullish(),
      snippet: z.string().nullish(),
      link: z.string(),
      company: z.string().nullish(),
      type: z.string().nullish(),
      updated: z.string().nullish(),
    }),
  ),
});

// Jooble searches by free-text location; the country narrows it
const COUNTRY_NAMES: Record<string, string> = { IN: "India", GB: "United Kingdom", US: "United States" };

export const joobleSource = (apiKey: string, fetchFn: Fetch = fetch): JobSource => ({
  name: "jooble",
  async searchJobs(query: SearchQuery): Promise<NormalizedJob[]> {
    const countryName = COUNTRY_NAMES[query.country] ?? query.country;
    const location = query.remote
      ? countryName
      : [query.city, query.region, countryName].filter(Boolean).join(", ");
    // Jooble's API takes the key in the path
    const data = await fetchJson(fetchFn, "Jooble", `https://jooble.org/api/${encodeURIComponent(apiKey)}`, responseSchema, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        keywords: query.remote ? `${query.keywords.join(" ")} remote` : query.keywords.join(" "),
        location,
        radius: query.remote ? undefined : String(query.radiusKm),
        page: "1",
        ResultOnPage: "50",
      }),
    });
    return data.jobs.map((job) => {
      const description = plainText(job.snippet);
      return {
        source: "jooble",
        externalId: job.id,
        company: job.company?.trim() || "Unknown company",
        title: plainText(job.title) ?? job.title,
        location: job.location?.trim() || null,
        remote: query.remote || REMOTE_PATTERN.test(`${job.title} ${job.type ?? ""} ${description ?? ""}`),
        url: job.link,
        description,
        postedAt: job.updated ?? null,
      };
    });
  },
});
