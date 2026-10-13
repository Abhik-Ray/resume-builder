import { DESCRIPTION_KEYWORD_SCORE, TITLE_KEYWORD_SCORE } from "@resume-builder/shared";
import type { NormalizedJob, UserSearch } from "./types";

const escape = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

// Whole-word, case-insensitive ("java" doesn't match "javascript")
const contains = (text: string, keyword: string) =>
  new RegExp(`(^|[^\\p{L}\\p{N}])${escape(keyword)}($|[^\\p{L}\\p{N}])`, "iu").test(text);

// Deterministic score: title keywords count most, then the description. Any exclude keyword
// or a broken remote rule drops the job (null). Distance is left to each API's radius filter.
export const scoreJob = (job: NormalizedJob, search: UserSearch): number | null => {
  const title = job.title;
  const description = job.description ?? "";
  const keywords = search.keywords.map((k) => k.trim()).filter(Boolean);
  if (search.excludeKeywords.some((k) => k.trim() && (contains(title, k.trim()) || contains(description, k.trim())))) {
    return null;
  }
  if (search.remoteOnly && !job.remote) return null;
  let score = 0;
  for (const keyword of keywords) {
    if (contains(title, keyword)) score += TITLE_KEYWORD_SCORE;
    else if (contains(description, keyword)) score += DESCRIPTION_KEYWORD_SCORE;
  }
  return score;
};

export const matchesSearch = (job: NormalizedJob, search: UserSearch) => {
  const score = scoreJob(job, search);
  return score !== null && score >= search.minScore ? score : null;
};

// The same posting can come from several sources or queries; keep the first
export const dedupeJobs = (jobs: NormalizedJob[]): NormalizedJob[] => {
  const seenIds = new Set<string>();
  const seenFingerprints = new Set<string>();
  const kept: NormalizedJob[] = [];
  for (const job of jobs) {
    const id = `${job.source}:${job.externalId}`;
    const fingerprint = [job.company, job.title, job.location ?? ""]
      .map((part) => part.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, " ").trim())
      .join("|");
    if (seenIds.has(id) || seenFingerprints.has(fingerprint)) continue;
    seenIds.add(id);
    seenFingerprints.add(fingerprint);
    kept.push(job);
  }
  return kept;
};
