import { GoogleGenAI } from "@google/genai";

// 1. Define the User Preferences Input Type
export interface JobPreferences {
  desiredRoles: string[];
  targetSalary?: string;
  preferredWorkModel: "Remote" | "Hybrid" | "On-site" | "Any";
  coreTechStack: string[];
  dealBreakers: string[]; // e.g., "Weekend work", "Legacy codebase"
  careerGoals: string; // e.g., "Looking for mentorship", "Want to lead a team"
}

// 2. Define the strict JSON Schema for the output
const JOB_JUDGMENT_SCHEMA = {
  type: "OBJECT",
  properties: {
    overallMatchScore: {
      type: "INTEGER",
      description:
        "A score from 1 to 100 representing how well the job matches the user's preferences.",
    },
    matchAnalysis: {
      type: "STRING",
      description:
        "A brief, 2-3 sentence summary explaining the score and overall fit.",
    },
    pros: {
      type: "ARRAY",
      items: { type: "STRING" },
      description:
        "Positive aspects of the job that directly align with the user's preferences.",
    },
    cons: {
      type: "ARRAY",
      items: { type: "STRING" },
      description:
        "Aspects of the job that misalign with the user's preferences or represent missing data.",
    },
    isRemote: {
      type: "ARRAY",
      items: { type: "STRING" },
      description:
        "Rate how likely is the job more remote, answer in any of the following strings: 'On Site', 'Hybrid', 'Possible Remote', 'Fully Remote with possibility to work from India', 'Fully Remote very likely to work from India'",
    },
    redFlags: {
      type: "ARRAY",
      items: { type: "STRING" },
      description:
        "Any toxic traits, vague responsibilities, impossible requirements, or deal-breakers found.",
    },
    verdict: {
      type: "STRING",
      description:
        "A final 2-3 word recommendation (e.g., 'Apply Immediately', 'Proceed with Caution', 'Hard Pass').",
    },
  },
  required: [
    "overallMatchScore",
    "matchAnalysis",
    "pros",
    "cons",
    "isRemote",
    "redFlags",
    "verdict",
  ],
};

export interface JudgeResponseType {
  overallMatchScore: number;
  matchAnalysis: string;
  pros: string[];
  cons: string[];
  isRemote: string[];
  redFlags: string[];
  verdict: string;
}

// 3. The Main Evaluation Function
export const judgeJobPosting = async (
  client: GoogleGenAI,
  jobDescription: string,
  preferences: JobPreferences,
) => {
  // Use Gemini 2.5 Flash: It's fast, cost-effective, and excellent at structured data extraction/analysis.
  const modelName = "gemini-2.5-flash";
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
    1. **Analyze:** Compare the jobscore out of 100 based on alignment. Be strict. 
    3. **Identify Red Flags:** Look for common corporate red  description against the candidate's preferences, paying special attention to deal-breakers and required tech stacks.
    2. **Score:** Calculate a realistic match flags (e.g., "fast-paced environment" meaning overwork, unrealistic requirements for the pay, vague descriptions).
    4. **Output:** Respond ONLY with valid JSON matching the enforced schema. Do not include markdown formatting or extra text outside the JSON.
  `;

  try {
    const response = await client.models.generateContent({
      model: modelName,
      config: {
        responseMimeType: "application/json",
        responseSchema: JOB_JUDGMENT_SCHEMA,
        temperature: temperature,
      },
      contents: prompt,
    });

    const textResponse = response.text;

    if (!textResponse) {
      throw new Error("Received empty response from the model.");
    }

    return JSON.parse(textResponse);
  } catch (error) {
    console.error("Job Judgment Error:", error);
    throw error;
  }
};
