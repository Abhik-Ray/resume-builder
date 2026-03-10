import { GoogleGenAI } from "@google/genai";
import { JobPreferenceData } from "./data/JobPreferenceData";
import { Loader2 } from "lucide-react";
import { judgeJobPosting, type JudgeResponseType } from "./utils/AIResumeJudge";
import { useState } from "react";
import { verifyApiKey } from "./utils/AIHealthCheck";
import { JudgeResponse } from "./JudgeResponse";

const steps = [
  { no: 1, name: "Enter Job Description" },
  { no: 2, name: "Job Review" },
  { no: 3, name: "Resume Rebuild" },
] as const;

// type StepNumbers = (typeof steps)[number]["no"];

const sampleJudgeResponse = {
  overallMatchScore: 30,
  matchAnalysis:
    "This role aligns well with your desired Front End Developer role and core tech stack, particularly React and JavaScript. However, the absence of any mention of remote work is a significant deal-breaker, as your preference is for a fully remote position. Salary information is also missing.",
  pros: [
    "The role is a direct match for 'Front End Developer' and 'Software Developer' desired roles.",
    "Strong alignment with core tech stack, specifically React and JavaScript.",
    "Opportunity to work with the MERN stack (MongoDB, Express.js, React, Node.js).",
    "Responsibilities include developing new user-facing features and building reusable components.",
  ],
  cons: [
    "The job description does not mention remote work, which is a deal-breaker for your preferred work model.",
    "Salary information is not provided, making it impossible to assess against your target.",
    "Specific tech like React Native, Next.js, and Typescript are not explicitly mentioned as requirements.",
    "The role is not in game development, which is one of your desired areas.",
  ],
  isRemote: ["On Site"],
  redFlags: [
    "No mention of remote work, which is a deal-breaker for the candidate.",
    "The phrase 'fast-paced environment' often implies high pressure and potential for overwork.",
    "Expectations to 'Provide technical guidance and mentorship to junior developers' and 'Lead code reviews' with only '3+ years of professional experience' might indicate high expectations for the experience level.",
  ],
  verdict: "Hard Pass",
};

export const NewApp = () => {
  const [geminiKey, setGeminiKey] = useState<string>("");
  const [jobDescription, setJobDescription] = useState("");
  const [step, setStep] = useState<(typeof steps)[number]>(steps[1]);
  const [judgeResponse, setJudgeResponse] =
    useState<JudgeResponseType>(sampleJudgeResponse);
  const [judgement, setJudgement] = useState<boolean | null>(null);
  const [stepError, setStepError] = useState<string | null>(null);
  const [aiCore, setAICore] = useState<GoogleGenAI | null>(null);
  // const aiCore = config.GeminiKey
  //     ? new GoogleGenAI({ apiKey: config.GeminiKey })
  //     : null;

  console.log({
    geminiKey,
    jobDescription,
    step,
    judgeResponse,
    judgement,
    stepError,
  });

  const initializeAICore = async (geminiKey: string) => {
    return new GoogleGenAI({ apiKey: geminiKey });
  };

  const onJudgeClick = async () => {
    setStepError("");
    if (!geminiKey.length) {
      setStepError("Please Enter a valid Gemini Key");
      return;
    }
    if (!jobDescription.length) {
      setStepError("Please Enter a valid job description");
      return;
    }

    const isGeminiKeyValid = await isHealthy();

    if (!isGeminiKeyValid) {
      setStepError("Gemini servers unreachable or invalid key");
      return;
    }

    const aiCoreObject = await initializeAICore(geminiKey);

    setAICore(aiCoreObject);

    if (!aiCore) {
      setStepError("Couldn't initialize aiCore");
      return;
    }

    setJudgeResponse(
      await judgeJobPosting(aiCoreObject, jobDescription, JobPreferenceData),
    );

    setStep(steps[1]);
  };

  const isHealthy = async (): Promise<boolean> => {
    return verifyApiKey(geminiKey)
      .then((response) => response.valid)
      .catch(() => false)
      .finally(() => false);
  };

  return (
    <div className="flex flex-col justify-center items-center h-screen w-screen">
      <div className="flex flex-col w-xl gap-4">
        {stepError && (
          <div className="border border-red-600 text-red-400 bg-red-50 rounded-2xl text-xs p-2">
            {stepError}
          </div>
        )}
        {step.no === 1 && (
          <>
            <div className="flex flex-col border border-blue-700 rounded-3xl">
              <label
                className="text-xs ml-4 px-2 bg-white relative -top-2.5 w-fit text-blue-700"
                htmlFor="gemini-key"
              >
                Enter The Gemini Key 🗝️
              </label>
              <input
                className="px-2 outline-hidden relative -top-2"
                id="gemini-key"
                type="text"
                value={geminiKey}
                onChange={(event) => setGeminiKey(event.target.value)}
              />
            </div>
            <div className="flex flex-col border border-blue-700 rounded-3xl">
              <label
                htmlFor="job-description"
                className="text-xs ml-4 px-2 bg-white relative -top-2.5 w-fit text-blue-700"
              >
                Paste the Job Description here 📜
              </label>
              <textarea
                name="job-description"
                id="job-description"
                className="outline-hidden resize-none pl-2 mr-1 -top-2 relative"
                onChange={(val) => {
                  setJobDescription(val.target.value);
                }}
                value={jobDescription}
              />
            </div>
            <button
              className="p-2 bg-blue-700 text-white rounded-3xl cursor-pointer"
              onClick={onJudgeClick}
            >
              Judge the job ⚖️
            </button>
          </>
        )}
      </div>
      {step.no === 2 && (
        <>
          <div className="flex flex-col justify-center w-full">
            {judgeResponse ? (
              <div className="flex flex-col justify-center items-center w-full">
                <JudgeResponse judgeResponse={sampleJudgeResponse} />
                <button className=" w-50 p-2 bg-blue-700 text-white rounded-3xl cursor-pointer">
                  {judgeResponse.overallMatchScore > 70
                    ? "Proceed with Resume"
                    : "Still proceed with resume"}
                </button>
              </div>
            ) : (
              <Loader2 className="animate-spin" />
            )}
          </div>
        </>
      )}
      {step.no === 3 && <div></div>}
    </div>
  );
};
