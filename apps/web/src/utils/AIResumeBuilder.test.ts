import { beforeEach, describe, expect, it, vi } from "vitest";
import type { z } from "zod";

vi.mock("ai", () => ({
  generateText: vi.fn(),
  Output: { object: vi.fn((options: object) => ({ type: "object", ...options })) },
}));
vi.mock("./aiModel", async (importOriginal) => ({
  ...(await importOriginal<typeof import("./aiModel")>()),
  getModel: vi.fn((key: unknown, choice: unknown, tier: unknown) => ({ key, choice, tier })),
}));

import { generateText } from "ai";
import type { UserData } from "../types/input";
import type { AIKey } from "./aiModel";
import { generateResumeSection, type SectionType } from "./AIResumeBuilder";

const generate = vi.mocked(generateText);

const userData: UserData = {
  currentRole: "Developer",
  yearsOfExperience: "3",
  requireRemote: true,
  rawWorkHistory: [{ companyName: "Acme", projectName: "One", tasks: ["Built X"] }],
  hardSkills: ["React"],
};

const RESPONSES: Record<SectionType, object> = {
  summary: { summary: "A summary" },
  experience: { bulletPoints: ["Did a thing"] },
  skills: { technicalSkills: ["React"] },
};

const GEMINI: AIKey = { provider: "gemini", key: "gemini-key" };

const lastRequest = () =>
  generate.mock.calls.at(-1)![0] as unknown as {
    model: { choice: string; tier: string };
    output: { schema: z.ZodType };
    temperature?: number;
    prompt: string;
  };

describe("generateResumeSection", () => {
  beforeEach(() => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    generate.mockReset();
  });

  it.each(Object.keys(RESPONSES) as SectionType[])("returns the %s section", async (section) => {
    generate.mockResolvedValue({ output: RESPONSES[section] } as never);
    await expect(generateResumeSection(GEMINI, "auto", section, "JD", userData)).resolves.toEqual(
      RESPONSES[section],
    );
  });

  it.each([
    ["summary", "creative", 0.7],
    ["experience", "fast", 0.3],
    ["skills", "fast", 0.1],
  ] as const)("uses the %s tier and temperature on auto", async (section, tier, temperature) => {
    generate.mockResolvedValue({ output: RESPONSES[section] } as never);
    await generateResumeSection(GEMINI, "auto", section, "JD", userData);
    expect(lastRequest()).toMatchObject({ model: { choice: "auto", tier }, temperature });
  });

  it.each(Object.keys(RESPONSES) as SectionType[])(
    "validates the %s response with a schema that requires its field",
    async (section) => {
      generate.mockResolvedValue({ output: RESPONSES[section] } as never);
      await generateResumeSection(GEMINI, "auto", section, "JD", userData);
      const { schema } = lastRequest().output;
      expect(schema.safeParse(RESPONSES[section]).success).toBe(true);
      expect(schema.safeParse({}).success).toBe(false);
    },
  );

  it("passes a chosen model through", async () => {
    generate.mockResolvedValue({ output: RESPONSES.summary } as never);
    await generateResumeSection(GEMINI, "gemini-2.5-flash", "summary", "JD", userData);
    expect(lastRequest().model).toMatchObject({ choice: "gemini-2.5-flash" });
  });

  it("leaves temperature out for OpenAI", async () => {
    generate.mockResolvedValue({ output: RESPONSES.summary } as never);
    await generateResumeSection({ provider: "openai", key: "k" }, "auto", "summary", "JD", userData);
    expect(lastRequest().temperature).toBeUndefined();
  });

  it("puts the job description and candidate data inside their tags", async () => {
    generate.mockResolvedValue({ output: RESPONSES.summary } as never);
    await generateResumeSection(GEMINI, "auto", "summary", "Remote React job", userData);
    const { prompt } = lastRequest();
    expect(prompt).toMatch(/<JOB_DESCRIPTION>\s*Remote React job\s*<\/JOB_DESCRIPTION>/);
    const data = prompt.match(/<USER_DATA>([\s\S]*)<\/USER_DATA>/)?.[1];
    expect(JSON.parse(data ?? "")).toEqual(userData);
  });

  it("tailors the remote instruction to the candidate", async () => {
    generate.mockResolvedValue({ output: RESPONSES.skills } as never);
    await generateResumeSection(GEMINI, "auto", "skills", "JD", userData);
    expect(lastRequest().prompt).toMatch(/work asynchronously/);

    await generateResumeSection(GEMINI, "auto", "skills", "JD", { ...userData, requireRemote: false });
    expect(lastRequest().prompt).toMatch(/Focus on collaboration/);
  });

  it("rethrows API and validation errors", async () => {
    generate.mockRejectedValue(new Error("No object generated"));
    await expect(generateResumeSection(GEMINI, "auto", "skills", "JD", userData)).rejects.toThrow(
      "No object generated",
    );
  });
});
