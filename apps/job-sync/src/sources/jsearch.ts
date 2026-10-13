import { z } from "zod";
import type { Fetch, JobSource, NormalizedJob, SearchQuery } from "../types";
import { fetchJson, plainText } from "./http";

const HOST = "jsearch.p.rapidapi.com";

const responseSchema = z.object({
  data: z.array(
    z.object({
      job_id: z.string(),
      job_title: z.string(),
      employer_name: z.string().nullish(),
      job_apply_link: z.string(),
      job_description: z.string().nullish(),
      job_is_remote: z.boolean().nullish(),
      job_posted_at_datetime_utc: z.string().nullish(),
      job_city: z.string().nullish(),
      job_state: z.string().nullish(),
      job_country: z.string().nullish(),
    }),
  ),
});

// JSearch aggregates Google for Jobs; the location goes into the free-text query
export const jsearchSource = (apiKey: string, fetchFn: Fetch = fetch): JobSource => ({
  name: "jsearch",
  async searchJobs(query: SearchQuery): Promise<NormalizedJob[]> {
    const params = new URLSearchParams({
      query: query.remote
        ? `${query.keywords.join(" ")} remote`
        : `${query.keywords.join(" ")} in ${[query.city, query.region].filter(Boolean).join(", ")}`,
      page: "1",
      num_pages: "1",
      country: query.country.toLowerCase(),
      date_posted: "3days",
    });
    if (query.remote) params.set("remote_jobs_only", "true");
    else params.set("radius", String(query.radiusKm));
    const data = await fetchJson(fetchFn, "JSearch", `https://${HOST}/search?${params}`, responseSchema, {
      headers: { "X-RapidAPI-Key": apiKey, "X-RapidAPI-Host": HOST },
    });
    return data.data.map((job) => ({
      source: "jsearch",
      externalId: job.job_id,
      company: job.employer_name?.trim() || "Unknown company",
      title: job.job_title,
      location: [job.job_city, job.job_state, job.job_country].filter(Boolean).join(", ") || null,
      remote: query.remote || !!job.job_is_remote,
      url: job.job_apply_link,
      description: plainText(job.job_description),
      postedAt: job.job_posted_at_datetime_utc ?? null,
    }));
  },
});
