import { generateText, Output } from "ai";
import { z } from "zod";
import type { UserData } from "../types/input";
import { getModel, temperatureFor, type AIKey } from "./aiModel";
import type { ModelChoice, ModelTier } from "./models";

// Every field is required; the SDK validates responses against these
const SECTION_SCHEMAS = {
  summary: z.object({
    summary: z.string().describe("A professional, persuasive summary of the candidate."),
  }),
  experience: z.object({
    bulletPoints: z
      .array(z.string().describe("The final, polished bullet point text."))
      .describe("A prioritized list of high-impact resume bullet points."),
  }),
  skills: z.object({
    technicalSkills: z.array(z.string()),
  }),
};

export type SectionResults = {
  [K in keyof typeof SECTION_SCHEMAS]: z.infer<(typeof SECTION_SCHEMAS)[K]>;
};

export type SectionType = keyof SectionResults;

export const generateResumeSection = async <T extends SectionType>(
  aiKey: AIKey,
  model: ModelChoice,
  sectionType: T,
  jobDescription: string,
  userData: UserData,
): Promise<SectionResults[T]> => {
  // A. HYBRID STRATEGY SELECTOR (tiers apply when the model is "auto")
  let tier: ModelTier = "fast"; // Default to fast/cheap
  let temperature = 0.3; // Default to strict
  let specificInstructions = "";

  switch (sectionType) {
    case "summary":
      tier = "creative"; // Use the stronger model for creative writing
      temperature = 0.7; // Higher temp for better flair
      specificInstructions =
        "Focus on narrative flow, career trajectory, and 'soft' leadership qualities. Make it sound human, not robotic. Keep it to 30 ATS friendly words or less";
      break;

    case "experience":
      tier = "fast"; // Recommended for speed + smarts
      temperature = 0.3;
      specificInstructions = `
        1. **Analyze** the <TARGET_JOB_DESCRIPTION> to identify the top 5 critical skills.
        2. **Synthesize and Rewrite** the candidate's <RAW_WORK_HISTORY> into a single, optimized, rewritten list of ATS friendly bullet points and keywords (aim for 5-7 strong points).
        3. **Filter & Merge:** - **DISCARD** weak or irrelevant tasks (e.g., "attended meetings").
           - **MERGE** related small tasks into one strong achievement.
           - **RANK** the most impactful points at the top.
        4. **Format:** Output ONLY the final bullet point text. Do not include original tasks or metadata.
      `;
      break;

    case "skills":
      tier = "fast";
      temperature = 0.1;
      specificInstructions =
        "Extract hard technical skills from the user history that match the job description. Rewrite the wording for ATS friendliness as necessary. Do not add verbose skills, generalize them (eg: If the Job requies Google Analytics Tag Manager GA4, output 'Google Analytics')";
      break;
  }

  // B. CONSTRUCT PROMPT
  const prompt = `
    ### ROLE
    You are an expert Resume Strategist and ATS Specialist.
    
    ### TARGET CONTEXT
    <JOB_DESCRIPTION>
    ${jobDescription}
    </JOB_DESCRIPTION>

    ### CANDIDATE DATA
    <USER_DATA>
    ${JSON.stringify(userData)}
    </USER_DATA>

    ### TASK INSTRUCTIONS
    1. **Goal:** specific instructions for ${sectionType}: "${specificInstructions}"
    2. **ATS Optimization:** Prioritize keywords found in the Job Description.
    3. **Remote Emphasis:** ${
      userData.requireRemote
        ? "Highlight ability to work asynchronously and self-manage."
        : "Focus on collaboration."
    }
    4. **Output:** Respond ONLY with valid JSON matching the enforced schema.
  `;

  // C. EXECUTE (throws if the response doesn't match the section's schema)
  try {
    const { output } = await generateText({
      model: getModel(aiKey, model, tier),
      output: Output.object({
        // TS can't narrow the schema union by the generic section type
        schema: SECTION_SCHEMAS[sectionType] as unknown as z.ZodType<SectionResults[T]>,
      }),
      temperature: temperatureFor(aiKey.provider, temperature),
      prompt,
    });
    return output;
  } catch (error) {
    console.error(`Resume ${sectionType} generation error:`, error);
    throw error;
  }
};
