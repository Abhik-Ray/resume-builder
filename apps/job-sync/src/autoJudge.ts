import type { AIKey } from "@resume-builder/ai/model";
import { PROVIDER_IDS, type ProviderId } from "@resume-builder/ai/providers";
import type { JudgeResponseType } from "@resume-builder/ai/judge";
import { jobPostingText, type JobPreferences, type JobRow } from "@resume-builder/shared";
import type { Logger } from "./pipeline";

// Optional, off by default: the owner's own AI key (an Actions secret) pre-judges the owner's
// new matches. Everyone else's matches are judged in their browser with their own key.
export interface OwnerJudging {
  userId: string;
  key: AIKey;
  // Matches judged per run, to cap what it costs
  limit: number;
}

export const ownerJudgingFromEnv = (env: NodeJS.ProcessEnv): OwnerJudging | null => {
  const { OWNER_USER_ID, OWNER_AI_PROVIDER, OWNER_AI_API_KEY, OWNER_JUDGE_LIMIT } = env;
  if (!OWNER_USER_ID || !OWNER_AI_PROVIDER || !OWNER_AI_API_KEY) return null;
  if (!PROVIDER_IDS.includes(OWNER_AI_PROVIDER as ProviderId)) {
    throw new Error(`OWNER_AI_PROVIDER must be one of ${PROVIDER_IDS.join(", ")}`);
  }
  const limit = Number(OWNER_JUDGE_LIMIT ?? 20);
  return {
    userId: OWNER_USER_ID,
    key: { provider: OWNER_AI_PROVIDER as ProviderId, key: OWNER_AI_API_KEY },
    limit: Number.isInteger(limit) && limit > 0 ? limit : 20,
  };
};

export type UnjudgedMatch = Pick<JobRow, "title" | "company" | "location" | "description"> & { jobId: string };

export interface JudgeStore {
  loadPreferences(userId: string): Promise<JobPreferences | null>;
  // New matches without a verdict, newest first
  loadUnjudgedMatches(userId: string, limit: number): Promise<UnjudgedMatch[]>;
  saveVerdict(userId: string, jobId: string, verdict: JudgeResponseType): Promise<void>;
}

export type Judge = (
  key: AIKey,
  model: "auto",
  jobDescription: string,
  preferences: JobPreferences,
) => Promise<JudgeResponseType>;

// One at a time; a failure is logged and the rest continue. Never fails the sync.
export const judgeOwnerMatches = async (
  store: JudgeStore,
  { userId, key, limit }: OwnerJudging,
  judge: Judge,
  log: Logger,
): Promise<{ judged: number; failed: number }> => {
  const preferences = await store.loadPreferences(userId);
  if (!preferences) {
    log.warn("Owner auto-judging skipped: the owner has no saved job preferences");
    return { judged: 0, failed: 0 };
  }
  const matches = await store.loadUnjudgedMatches(userId, limit);
  let judged = 0;
  let failed = 0;
  for (const match of matches) {
    try {
      const verdict = await judge(key, "auto", jobPostingText(match), preferences);
      await store.saveVerdict(userId, match.jobId, verdict);
      judged += 1;
    } catch (error) {
      failed += 1;
      // The message only: SDK errors can carry the whole request
      log.warn(`Auto-judging ${match.title} failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
  return { judged, failed };
};
