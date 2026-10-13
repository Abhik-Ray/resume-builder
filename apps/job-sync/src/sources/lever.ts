import { z } from "zod";
import type { BoardSource, Fetch, NormalizedJob } from "../types";
import { fetchJson, plainText, REMOTE_PATTERN } from "./http";

const responseSchema = z.array(
  z.object({
    id: z.string(),
    text: z.string(),
    hostedUrl: z.string(),
    createdAt: z.number().nullish(),
    descriptionPlain: z.string().nullish(),
    workplaceType: z.string().nullish(),
    categories: z
      .object({ location: z.string().nullish(), allLocations: z.array(z.string()).nullish() })
      .nullish(),
  }),
);

// Lever's public postings API: no key, every published posting for the company
export const leverSource = (fetchFn: Fetch = fetch): BoardSource => ({
  name: "lever",
  async listJobs(board: string): Promise<NormalizedJob[]> {
    const data = await fetchJson(
      fetchFn,
      "Lever",
      `https://api.lever.co/v0/postings/${encodeURIComponent(board)}?mode=json`,
      responseSchema,
    );
    return data.map((job) => {
      const location =
        job.categories?.allLocations?.join(" / ") || job.categories?.location?.trim() || null;
      return {
        source: "lever",
        externalId: `${board}:${job.id}`,
        // Lever doesn't name the company; the watch list does (see pipeline)
        company: board,
        title: job.text,
        location,
        remote: job.workplaceType === "remote" || REMOTE_PATTERN.test(`${job.text} ${location ?? ""}`),
        url: job.hostedUrl,
        description: plainText(job.descriptionPlain),
        postedAt: job.createdAt ? new Date(job.createdAt).toISOString() : null,
      };
    });
  },
});
