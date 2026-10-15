import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("ai", () => ({
  generateText: vi.fn(),
  Output: { object: vi.fn((options: object) => ({ type: "object", ...options })) },
}));
vi.mock("./aiModel", async (importOriginal) => ({
  ...(await importOriginal<typeof import("./aiModel")>()),
  getModel: vi.fn((key: unknown, choice: unknown, tier: unknown) => ({ key, choice, tier })),
}));

import { generateText } from "ai";
import {
  judgeJobPosting,
  JudgeResponseSchema,
  type JobPreferences,
  type JudgeResponseType,
} from "./AIResumeJudge";
import type { AIKey } from "./aiModel";

const generate = vi.mocked(generateText);

const preferences: JobPreferences = {
  desiredRoles: ["Frontend Developer"],
  preferredWorkModel: "Remote",
  coreTechStack: ["React"],
  dealBreakers: ["On-site only"],
  careerGoals: "Grow",
};

const judgement: JudgeResponseType = {
  overallMatchScore: 82,
  matchAnalysis: "Good fit",
  pros: ["React"],
  cons: [],
  isRemote: "Hybrid",
  redFlags: [],
  verdict: "Apply Immediately",
};

const GEMINI: AIKey = { provider: "gemini", key: "gemini-key" };

const lastRequest = () => generate.mock.calls.at(-1)![0] as unknown as Record<string, unknown>;

describe("judgeJobPosting", () => {
  beforeEach(() => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    generate.mockReset().mockResolvedValue({ output: judgement } as never);
  });

  it("returns the structured judgement", async () => {
    await expect(judgeJobPosting(GEMINI, "auto", "JD", preferences)).resolves.toEqual(judgement);
  });

  it("uses the fast tier, the judgement schema and a low temperature", async () => {
    await judgeJobPosting(GEMINI, "auto", "JD", preferences);
    expect(lastRequest()).toMatchObject({
      model: { key: GEMINI, choice: "auto", tier: "fast" },
      output: { type: "object", schema: JudgeResponseSchema },
      temperature: 0.2,
    });
  });

  it("passes a chosen model through", async () => {
    await judgeJobPosting(GEMINI, "gemini-2.5-pro", "JD", preferences);
    expect(lastRequest().model).toMatchObject({ choice: "gemini-2.5-pro" });
  });

  it("leaves temperature out for OpenAI", async () => {
    await judgeJobPosting({ provider: "openai", key: "k" }, "auto", "JD", preferences);
    expect(lastRequest().temperature).toBeUndefined();
  });

  it("puts the job description and preferences inside their tags", async () => {
    await judgeJobPosting(GEMINI, "auto", "Senior React role, fully remote", preferences);
    const prompt = lastRequest().prompt as string;
    expect(prompt).toMatch(
      /<JOB_DESCRIPTION>\s*Senior React role, fully remote\s*<\/JOB_DESCRIPTION>/,
    );
    const prefs = prompt.match(/<PREFERENCES>([\s\S]*)<\/PREFERENCES>/)?.[1];
    expect(JSON.parse(prefs ?? "")).toEqual(preferences);
  });

  it("rethrows API and validation errors", async () => {
    generate.mockRejectedValue(new Error("quota"));
    await expect(judgeJobPosting(GEMINI, "auto", "JD", preferences)).rejects.toThrow("quota");
  });
});

describe("JudgeResponseSchema", () => {
  it("accepts a full judgement", () => {
    expect(JudgeResponseSchema.safeParse(judgement).success).toBe(true);
  });

  it("requires every field", () => {
    const partial: Partial<JudgeResponseType> = { ...judgement };
    delete partial.verdict;
    expect(JudgeResponseSchema.safeParse(partial).success).toBe(false);
  });

  it("only allows the listed remote levels", () => {
    expect(JudgeResponseSchema.safeParse({ ...judgement, isRemote: "Mars" }).success).toBe(false);
  });
});
