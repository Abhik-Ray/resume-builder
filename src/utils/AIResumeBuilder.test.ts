import type { GoogleGenAI } from "@google/genai";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { UserData } from "../types/input";
import { generateResumeSection, type SectionType } from "./AIResumeBuilder";
import { MODELS } from "./models";

const userData: UserData = {
  currentRole: "Developer",
  yearsOfExperience: "3",
  requireRemote: true,
  rawWorkHistory: [{ companyName: "Acme", projectName: "One", tasks: ["Built X"] }],
  hardSkills: ["React"],
};

const clientReturning = (response: unknown) => {
  const generateContent = vi.fn().mockResolvedValue(response);
  return { client: { models: { generateContent } } as unknown as GoogleGenAI, generateContent };
};

const RESPONSES: Record<SectionType, object> = {
  summary: { summary: "A summary" },
  experience: { bulletPoints: ["Did a thing"] },
  skills: { technicalSkills: ["React"] },
};

describe("generateResumeSection", () => {
  beforeEach(() => {
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  it.each(Object.keys(RESPONSES) as SectionType[])("returns the parsed %s section", async (section) => {
    const { client } = clientReturning({ text: JSON.stringify(RESPONSES[section]) });
    await expect(generateResumeSection(client, section, "JD", userData)).resolves.toEqual(
      RESPONSES[section],
    );
  });

  it.each([
    ["summary", MODELS.creative],
    ["experience", MODELS.fast],
    ["skills", MODELS.fast],
  ] as const)("uses the right model for %s", async (section, model) => {
    const { client, generateContent } = clientReturning({ text: JSON.stringify(RESPONSES[section]) });
    await generateResumeSection(client, section, "JD", userData);
    const request = generateContent.mock.calls[0][0];
    expect(request.model).toBe(model);
    expect(request.config.responseMimeType).toBe("application/json");
    expect(request.config.responseSchema.required).toEqual(Object.keys(RESPONSES[section]));
  });

  it("puts the job description and candidate data inside their tags", async () => {
    const { client, generateContent } = clientReturning({ text: JSON.stringify(RESPONSES.summary) });
    await generateResumeSection(client, "summary", "Remote React job", userData);
    const prompt: string = generateContent.mock.calls[0][0].contents;
    expect(prompt).toMatch(/<JOB_DESCRIPTION>\s*Remote React job\s*<\/JOB_DESCRIPTION>/);
    const data = prompt.match(/<USER_DATA>([\s\S]*)<\/USER_DATA>/)?.[1];
    expect(JSON.parse(data ?? "")).toEqual(userData);
  });

  it("tailors the remote instruction to the candidate", async () => {
    const remote = clientReturning({ text: JSON.stringify(RESPONSES.skills) });
    await generateResumeSection(remote.client, "skills", "JD", userData);
    expect(remote.generateContent.mock.calls[0][0].contents).toMatch(/work asynchronously/);

    const onsite = clientReturning({ text: JSON.stringify(RESPONSES.skills) });
    await generateResumeSection(onsite.client, "skills", "JD", { ...userData, requireRemote: false });
    expect(onsite.generateContent.mock.calls[0][0].contents).toMatch(/Focus on collaboration/);
  });

  it("throws on an empty response", async () => {
    const { client } = clientReturning({ text: "" });
    await expect(generateResumeSection(client, "summary", "JD", userData)).rejects.toThrow(
      /empty summary response/,
    );
  });

  it("throws when the required field is missing", async () => {
    const { client } = clientReturning({ text: JSON.stringify({ other: 1 }) });
    await expect(generateResumeSection(client, "experience", "JD", userData)).rejects.toThrow(
      /missing required data/,
    );
  });

  it("throws on malformed JSON", async () => {
    const { client } = clientReturning({ text: "not json" });
    await expect(generateResumeSection(client, "skills", "JD", userData)).rejects.toThrow(SyntaxError);
  });
});
