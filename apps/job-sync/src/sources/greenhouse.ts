import { z } from "zod";
import type { BoardSource, Fetch, NormalizedJob } from "../types";
import { fetchJson, plainText, REMOTE_PATTERN } from "./http";

const responseSchema = z.object({
  jobs: z.array(
    z.object({
      id: z.union([z.string(), z.number()]).transform(String),
      title: z.string(),
      absolute_url: z.string(),
      updated_at: z.string().nullish(),
      first_published: z.string().nullish(),
      company_name: z.string().nullish(),
      location: z.object({ name: z.string().nullish() }).nullish(),
      content: z.string().nullish(),
    }),
  ),
});

// Greenhouse's public Job Board API: no key, every open posting on the board
export const greenhouseSource = (fetchFn: Fetch = fetch): BoardSource => ({
  name: "greenhouse",
  async listJobs(board: string): Promise<NormalizedJob[]> {
    const data = await fetchJson(
      fetchFn,
      "Greenhouse",
      `https://boards-api.greenhouse.io/v1/boards/${encodeURIComponent(board)}/jobs?content=true`,
      responseSchema,
    );
    return data.jobs.map((job) => {
      const location = job.location?.name?.trim() || null;
      return {
        source: "greenhouse",
        externalId: `${board}:${job.id}`,
        company: job.company_name?.trim() || board,
        title: job.title,
        location,
        remote: REMOTE_PATTERN.test(`${job.title} ${location ?? ""}`),
        url: job.absolute_url,
        description: plainText(job.content),
        postedAt: job.first_published ?? job.updated_at ?? null,
      };
    });
  },
});
