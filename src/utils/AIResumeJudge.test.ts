import type { GoogleGenAI } from "@google/genai";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { judgeJobPosting, type JobPreferences, type JudgeResponseType } from "./AIResumeJudge";
import { MODELS } from "./models";

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

const clientReturning = (text: string | undefined) => {
  const generateContent = vi.fn().mockResolvedValue({ text });
  return { client: { models: { generateContent } } as unknown as GoogleGenAI, generateContent };
};

describe("judgeJobPosting", () => {
  beforeEach(() => {
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  it("returns the parsed judgement", async () => {
    const { client } = clientReturning(JSON.stringify(judgement));
    await expect(judgeJobPosting(client, "JD", preferences)).resolves.toEqual(judgement);
  });

  it("asks the fast model for structured JSON with every field required", async () => {
    const { client, generateContent } = clientReturning(JSON.stringify(judgement));
    await judgeJobPosting(client, "JD", preferences);

    const request = generateContent.mock.calls[0][0];
    expect(request.model).toBe(MODELS.fast);
    expect(request.config.responseMimeType).toBe("application/json");
    expect(request.config.responseSchema.required).toEqual(
      expect.arrayContaining(Object.keys(judgement)),
    );
  });

  it("puts the job description and preferences inside their tags", async () => {
    const { client, generateContent } = clientReturning(JSON.stringify(judgement));
    await judgeJobPosting(client, "Senior React role, fully remote", preferences);

    const prompt: string = generateContent.mock.calls[0][0].contents;
    expect(prompt).toMatch(
      /<JOB_DESCRIPTION>\s*Senior React role, fully remote\s*<\/JOB_DESCRIPTION>/,
    );
    const prefs = prompt.match(/<PREFERENCES>([\s\S]*)<\/PREFERENCES>/)?.[1];
    expect(JSON.parse(prefs ?? "")).toEqual(preferences);
  });

  it("throws on an empty model response", async () => {
    const { client } = clientReturning(undefined);
    await expect(judgeJobPosting(client, "JD", preferences)).rejects.toThrow(/empty response/);
  });

  it("rethrows API errors", async () => {
    const client = {
      models: { generateContent: vi.fn().mockRejectedValue(new Error("quota")) },
    } as unknown as GoogleGenAI;
    await expect(judgeJobPosting(client, "JD", preferences)).rejects.toThrow("quota");
  });
});
