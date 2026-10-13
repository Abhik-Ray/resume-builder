import { generateText, Output } from "ai";
import { z } from "zod";
import { getModel, temperatureFor, type AIKey } from "./aiModel";
import type { ModelChoice } from "./models";
import type { JobPreferences } from "@resume-builder/shared";

// 1. The User Preferences Input Type lives in the shared package
export type { JobPreferences };

const REMOTE_LEVELS = [
  "On Site",
  "Hybrid",
  "Possible Remote",
  "Fully Remote with possibility to work from India",
  "Fully Remote very likely to work from India",
] as const;

// 2. Define the strict schema for the output. Every field is required.
// No min/max on the score: not every provider accepts those constraints.
export const JudgeResponseSchema = z.object({
  overallMatchScore: z
    .number()
    .int()
    .describe("A score from 1 to 100 representing how well the job matches the user's preferences."),
  matchAnalysis: z
    .string()
    .describe("A brief, 2-3 sentence summary explaining the score and overall fit."),
  pros: z
    .array(z.string())
    .describe("Positive aspects of the job that directly align with the user's preferences."),
  cons: z
    .array(z.string())
    .describe(
      "Aspects of the job that misalign with the user's preferences or represent missing data.",
    ),
  isRemote: z
    .enum(REMOTE_LEVELS)
    .describe("How likely the job is to be remote, picked from the allowed values."),
  redFlags: z
    .array(z.string())
    .describe(
      "Any toxic traits, vague responsibilities, impossible requirements, or deal-breakers found.",
    ),
  verdict: z
    .string()
    .describe(
      "A final 2-3 word recommendation (e.g., 'Apply Immediately', 'Proceed with Caution', 'Hard Pass').",
    ),
});

export type JudgeResponseType = z.infer<typeof JudgeResponseSchema>;

// 3. The Main Evaluation Function
export const judgeJobPosting = async (
  aiKey: AIKey,
  model: ModelChoice,
  jobDescription: string,
  preferences: JobPreferences,
): Promise<JudgeResponseType> => {
  // Auto uses the fast model: cost-effective and excellent at structured data extraction/analysis.
  const temperature = 0.2; // Low temperature for objective, analytical reasoning

  const prompt = `
    ### ROLE
    You are an expert Career Strategist and Technical Recruiter. Your job is to objectively evaluate a job description against a candidate's specific career preferences and boundaries.
    It's okay if the job requirement is a little out of the skillset of the user, but it should be close enough.

    ### CANDIDATE PREFERENCES
    <PREFERENCES>
    ${JSON.stringify(preferences, null, 2)}
    </PREFERENCES>

    ### TARGET JOB DESCRIPTION
    <JOB_DESCRIPTION>
    ${jobDescription}
    </JOB_DESCRIPTION>

    ### TASK INSTRUCTIONS
    1. **Analyze:** Compare the job description against the candidate's preferences, paying special attention to deal-breakers and required tech stacks.
    2. **Score:** Calculate a realistic match score out of 100 based on alignment. Be strict.
    3. **Identify Red Flags:** Look for common corporate red flags (e.g., "fast-paced environment" meaning overwork, unrealistic requirements for the pay, vague descriptions).
    4. **Output:** Respond ONLY with valid JSON matching the enforced schema. Do not include markdown formatting or extra text outside the JSON.
  `;

  try {
    // The SDK validates the response against the schema and throws if it doesn't match
    const { output } = await generateText({
      model: getModel(aiKey, model, "fast"),
      output: Output.object({ schema: JudgeResponseSchema }),
      temperature: temperatureFor(aiKey.provider, temperature),
      prompt,
    });
    return output;
  } catch (error) {
    // The message only: SDK errors carry the request (prompt included), and the job sync's
    // logs are public on a public repository
    console.error("Job Judgment Error:", error instanceof Error ? error.message : String(error));
    throw error;
  }
};
