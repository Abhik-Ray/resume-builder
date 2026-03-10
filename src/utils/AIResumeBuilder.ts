import { GoogleGenAI } from "@google/genai";
import type { UserData } from "../types/input";

export const geminiTest = async (ai: GoogleGenAI) => {
  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents:
      "In a scale of 1 to 10, what is the worth of love? in 30 words or less",
  });
  return response;
};

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
};

export type SectionType = "summary" | "experience" | "skills";

export const generateResumeSection = async (
  client: GoogleGenAI,
  sectionType: SectionType,
  jobDescription: string,
  userData: UserData,
) => {
  // A. HYBRID STRATEGY SELECTOR
  let modelName = "gemini-2.5-flash"; // Default to fast/cheap
  let temperature = 0.3; // Default to strict
  let targetSchema = null;
  let specificInstructions = "";

  switch (sectionType) {
    case "summary":
      modelName = "gemini-2.5-pro"; // Use PRO for creative writing
      temperature = 0.7; // Higher temp for better flair
      targetSchema = SUMMARY_SCHEMA;
      specificInstructions =
        "Focus on narrative flow, career trajectory, and 'soft' leadership qualities. Make it sound human, not robotic. Keep it to 30 ATS friendly words or less";
      break;

    case "experience":
      modelName = "gemini-2.5-flash"; // Recommended for speed + smarts
      temperature = 0.3;
      targetSchema = EXPERIENCE_SCHEMA;
      specificInstructions = `
        1. **Analyze** the <TARGET_JOB_DESCRIPTION> to identify the top 3 critical skills.
        2. **Synthesize** the candidate's <RAW_WORK_HISTORY> into a single, optimized list of ATS friendly bullet points (aim for 3-5 strong points).
        3. **Filter & Merge:** - **DISCARD** weak or irrelevant tasks (e.g., "attended meetings").
           - **MERGE** related small tasks into one strong achievement.
           - **RANK** the most impactful points at the top.
        4. **Format:** Output ONLY the final bullet point text. Do not include original tasks or metadata.
      `;;
      break;

    case "skills":
      modelName = "gemini-2.5-flash";
      temperature = 0.1; // Very low temp for pure extraction
      targetSchema = SKILLS_SCHEMA;
      specificInstructions =
        "Extract hard technical skills from the user history that match the job description. Maximum 8 skills. Keep the wording ATS friendly";
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

    // In the new SDK, response.text() often handles the parsing automatically if valid JSON
    // But we manually parse to be safe and consistent with your frontend needs
    const textResponse = response.text;
    return textResponse ? JSON.parse(textResponse) : null;
  } catch (error) {
    console.error("Gemini Generation Error:", error);
    throw error;
  }
};
