import { z } from "zod";
import type { Database } from "./database";

type Tables = Database["public"]["Tables"];
export type JobRow = Tables["jobs"]["Row"];
export type JobMatchRow = Tables["job_matches"]["Row"];
export type SearchProfileRow = Tables["search_profiles"]["Row"];
export type SyncRunRow = Tables["sync_runs"]["Row"];
export type MatchState = Database["public"]["Enums"]["match_state"];

export const MATCH_STATES = ["new", "saved", "dismissed", "applied"] as const satisfies readonly MatchState[];

export const MATCH_STATE_LABELS: Record<MatchState, string> = {
  new: "New",
  saved: "Saved",
  dismissed: "Dismissed",
  applied: "Applied",
};

// Score a job gets per keyword found in its title, or else in its description
export const TITLE_KEYWORD_SCORE = 3;
export const DESCRIPTION_KEYWORD_SCORE = 1;
export const DEFAULT_MIN_SCORE = 3;

const keyword = z.string().trim().min(1, "Keyword is required").max(60, "At most 60 characters");

const keywordList = (min: number) =>
  z
    .array(keyword)
    .min(min, `Add at least ${min} keyword`)
    .max(10, "At most 10 keywords")
    .superRefine((items, ctx) => {
      const seen = new Set<string>();
      items.forEach((item, index) => {
        const normalized = item.trim().toLowerCase();
        if (seen.has(normalized)) ctx.addIssue({ code: "custom", message: "Duplicate entry", path: [index] });
        seen.add(normalized);
      });
    });

// The saved-search form (Settings → Job searches)
export const searchProfileSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(80, "At most 80 characters"),
  keywords: keywordList(1),
  excludeKeywords: keywordList(0),
  // Empty means the home city
  locationOverride: z.string().trim().max(100, "At most 100 characters"),
  remoteOnly: z.boolean(),
  // Registered with valueAsNumber, so an empty input arrives as NaN
  minScore: z
    .number("Enter a number")
    .int("Use a whole number")
    .min(1, "At least 1")
    .max(100, "At most 100"),
  active: z.boolean(),
});

export type SearchProfileFormValues = z.input<typeof searchProfileSchema>;
export type SearchProfileInput = z.output<typeof searchProfileSchema>;

export const toSearchProfileFormValues = (row?: SearchProfileRow): SearchProfileFormValues => ({
  name: row?.name ?? "",
  keywords: row?.keywords ?? [""],
  excludeKeywords: row?.exclude_keywords ?? [],
  locationOverride: row?.location_override ?? "",
  remoteOnly: row?.remote_only ?? false,
  minScore: row?.min_score ?? DEFAULT_MIN_SCORE,
  active: row?.active ?? true,
});

export const toSearchProfileColumns = (input: SearchProfileInput) => ({
  name: input.name,
  keywords: input.keywords,
  exclude_keywords: input.excludeKeywords,
  location_override: input.locationOverride || null,
  remote_only: input.remoteOnly,
  min_score: input.minScore,
  active: input.active,
});
