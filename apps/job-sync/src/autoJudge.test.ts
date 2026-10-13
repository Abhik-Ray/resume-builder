import type { JudgeResponseType } from "@resume-builder/ai/judge";
import type { JobPreferences } from "@resume-builder/shared";
import { describe, expect, it, vi } from "vitest";
import { judgeOwnerMatches, ownerJudgingFromEnv, type JudgeStore, type UnjudgedMatch } from "./autoJudge";

const preferences: JobPreferences = {
  desiredRoles: ["Frontend Engineer"],
  preferredWorkModel: "Remote",
  coreTechStack: ["React"],
  dealBreakers: [],
  careerGoals: "Lead a team",
};

const verdict: JudgeResponseType = {
  overallMatchScore: 80,
  matchAnalysis: "Good fit.",
  pros: [],
  cons: [],
  isRemote: "Hybrid",
  redFlags: [],
  verdict: "Apply Immediately",
};

const match = (jobId: string): UnjudgedMatch => ({
  jobId,
  title: `Role ${jobId}`,
  company: "Acme",
  location: "Pune",
  description: "React",
});

const store = (patch: Partial<JudgeStore> = {}): JudgeStore => ({
  loadPreferences: vi.fn(async () => preferences),
  loadUnjudgedMatches: vi.fn(async () => [match("j1"), match("j2")]),
  saveVerdict: vi.fn(async () => {}),
  ...patch,
});

const log = { info: vi.fn(), warn: vi.fn() };
const owner = { userId: "owner", key: { provider: "anthropic" as const, key: "sk-ant-test" }, limit: 5 };

describe("ownerJudgingFromEnv", () => {
  it("is off without all three settings", () => {
    expect(ownerJudgingFromEnv({})).toBeNull();
    expect(ownerJudgingFromEnv({ OWNER_USER_ID: "u", OWNER_AI_PROVIDER: "gemini" })).toBeNull();
  });

  it("reads the owner, key and limit", () => {
    expect(
      ownerJudgingFromEnv({ OWNER_USER_ID: "u", OWNER_AI_PROVIDER: "gemini", OWNER_AI_API_KEY: "k", OWNER_JUDGE_LIMIT: "7" }),
    ).toEqual({ userId: "u", key: { provider: "gemini", key: "k" }, limit: 7 });
    expect(ownerJudgingFromEnv({ OWNER_USER_ID: "u", OWNER_AI_PROVIDER: "openai", OWNER_AI_API_KEY: "k" })?.limit).toBe(20);
  });

  it("rejects an unknown provider", () => {
    expect(() =>
      ownerJudgingFromEnv({ OWNER_USER_ID: "u", OWNER_AI_PROVIDER: "mistral", OWNER_AI_API_KEY: "k" }),
    ).toThrow("OWNER_AI_PROVIDER must be one of gemini, openai, anthropic");
  });
});

describe("judgeOwnerMatches", () => {
  it("judges the owner's unjudged matches with their preferences and saves each verdict", async () => {
    const db = store();
    const judge = vi.fn(async () => verdict);
    expect(await judgeOwnerMatches(db, owner, judge, log)).toEqual({ judged: 2, failed: 0 });
    expect(db.loadUnjudgedMatches).toHaveBeenCalledWith("owner", 5);
    expect(judge).toHaveBeenCalledWith(owner.key, "auto", "Role j1 at Acme\nPune\n\nReact", preferences);
    expect(db.saveVerdict).toHaveBeenCalledWith("owner", "j2", verdict);
  });

  it("keeps going when one judgement fails", async () => {
    const db = store();
    const judge = vi.fn().mockRejectedValueOnce(new Error("rate limited")).mockResolvedValueOnce(verdict);
    expect(await judgeOwnerMatches(db, owner, judge, log)).toEqual({ judged: 1, failed: 1 });
    expect(log.warn).toHaveBeenCalledWith("Auto-judging Role j1 failed: rate limited");
  });

  it("skips without saved preferences", async () => {
    const judge = vi.fn();
    const result = await judgeOwnerMatches(store({ loadPreferences: async () => null }), owner, judge, log);
    expect(result).toEqual({ judged: 0, failed: 0 });
    expect(judge).not.toHaveBeenCalled();
  });
});
