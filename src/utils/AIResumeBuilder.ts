import { GoogleGenAI } from "@google/genai";
import type { UserData } from "../types/input";
import { MODELS } from "./models";

const SUMMARY_SCHEMA = {
  type: "OBJECT",
  properties: {
    summary: {
      type: "STRING",
      description: "A professional, persuasive summary of the candidate.",
    },
  },
  required: ["summary"],
};

const EXPERIENCE_SCHEMA = {
  type: "OBJECT",
  properties: {
    bulletPoints: {
      type: "ARRAY",
      description: "A prioritized list of high-impact resume bullet points.",
      items: {
        type: "STRING",
        description: "The final, polished bullet point text.",
      },
    },
  },
  required: ["bulletPoints"],
};

const SKILLS_SCHEMA = {
  type: "OBJECT",
  properties: {
    technicalSkills: { type: "ARRAY", items: { type: "STRING" } },
    // softSkills: { type: "ARRAY", items: { type: "STRING" } },
  },
  required: ["technicalSkills"],
};

export interface SectionResults {
  summary: { summary: string };
  experience: { bulletPoints: string[] };
  skills: { technicalSkills: string[] };
}

export type SectionType = keyof SectionResults;

const REQUIRED_KEY: Record<SectionType, string> = {
  summary: "summary",
  experience: "bulletPoints",
  skills: "technicalSkills",
};

export const generateResumeSection = async <T extends SectionType>(
  client: GoogleGenAI,
  sectionType: T,
  jobDescription: string,
  userData: UserData,
): Promise<SectionResults[T]> => {
  // A. HYBRID STRATEGY SELECTOR
  let modelName: string = MODELS.fast; // Default to fast/cheap
  let temperature = 0.3; // Default to strict
  let targetSchema = null;
  let specificInstructions = "";

  switch (sectionType) {
    case "summary":
      modelName = MODELS.creative; // Use PRO for creative writing
      temperature = 0.7; // Higher temp for better flair
      targetSchema = SUMMARY_SCHEMA;
      specificInstructions =
        "Focus on narrative flow, career trajectory, and 'soft' leadership qualities. Make it sound human, not robotic. Keep it to 30 ATS friendly words or less";
      break;

    case "experience":
      modelName = MODELS.fast; // Recommended for speed + smarts
      temperature = 0.3;
      targetSchema = EXPERIENCE_SCHEMA;
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
      modelName = MODELS.fast;
      temperature = 0.1;
      targetSchema = SKILLS_SCHEMA;
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

  // C. EXECUTE (Updated for @google/genai syntax)
  try {
    const response = await client.models.generateContent({
      model: modelName,
      config: {
        responseMimeType: "application/json",
        responseSchema: targetSchema, // Cast ensures compatibility with strict types
        temperature: temperature,
      },
      contents: prompt,
    });

    const textResponse = response.text;
    if (!textResponse) {
      throw new Error(`Received empty ${sectionType} response from the model.`);
    }
    const parsed = JSON.parse(textResponse);
    if (parsed?.[REQUIRED_KEY[sectionType]] === undefined) {
      throw new Error(`Model response for ${sectionType} is missing required data.`);
    }
    return parsed;
  } catch (error) {
    console.error("Gemini Generation Error:", error);
    throw error;
  }
};
