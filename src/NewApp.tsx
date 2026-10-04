import { GoogleGenAI } from "@google/genai";
import { Loader, Loader2 } from "lucide-react";
import { judgeJobPosting, type JudgeResponseType } from "./utils/AIResumeJudge";
import { lazy, Suspense, useState } from "react";
import { verifyApiKey } from "./utils/AIHealthCheck";
import { JudgeResponse } from "./JudgeResponse";
import { Button } from "./components/ui/button";
import { generateResumeSection } from "./utils/AIResumeBuilder";
import {
  defaultTweakableBullets,
  ResumeData,
  userData,
} from "./data/ResumeData";
import { Stepper } from "./components/ui/stepper";

// The PDF renderer is large, so load it only when the resume is generated
const loadResumePreview = () => import("./ResumePreview");
const ResumePreview = lazy(loadResumePreview);

const steps = [
  { no: 0, title: "1. Job Description", description: "Paste Job Description" },
  {
    no: 1,
    title: "2. Job Review",
    description: "AI will review the job based on your parameters",
  },
  {
    no: 2,
    title: "3. Resume Rebuild",
    description: "Rebuild Resume related to the required parameters",
  },
];

const getLocalKey = () => {
  return localStorage.getItem("geminiKey") ?? "";
};

const getErrorMessage = (error: unknown) =>
  error instanceof Error ? error.message : String(error);

export const NewApp = () => {
  const [geminiKey, setGeminiKey] = useState<string>(getLocalKey());
  const [jobDescription, setJobDescription] = useState("");
  const [step, setStep] = useState<number>(0);
  const [judgeResponse, setJudgeResponse] = useState<JudgeResponseType>();
  const [stepError, setStepError] = useState<string | null>(null);
  const [aiCore, setAICore] = useState<GoogleGenAI | null>(null);
  const [isJudgementLoading, setIsJudgementLoading] = useState<boolean>(false);
  const [isPdfLoading, setIsPdfLoading] = useState<boolean>(false);
  const [summaryData, setSummaryData] = useState(ResumeData.summary);
  const [experienceData, setExperienceData] = useState<string[]>(
    defaultTweakableBullets,
  );
  const [skillsData, setSkillsData] = useState(ResumeData.featuredSkills);

  const onJudgeClick = async () => {
    setStepError(null);
    if (!geminiKey.length) {
      setStepError("Please Enter a valid Gemini Key");
      return;
    }
    if (!jobDescription.length) {
      setStepError("Please Enter a valid job description");
      return;
    }

    setIsJudgementLoading(true);
    try {
      const aiCoreObject = new GoogleGenAI({ apiKey: geminiKey });
      const { valid } = await verifyApiKey(aiCoreObject);
      if (!valid) {
        setStepError("Gemini servers unreachable or invalid key");
        return;
      }

      localStorage.setItem("geminiKey", geminiKey);
      setAICore(aiCoreObject);

      setJudgeResponse(
        await judgeJobPosting(
          aiCoreObject,
          jobDescription,
          ResumeData.jobPreferences,
        ),
      );
      setStep(1);
    } catch (error) {
      setStepError(`Job review failed: ${getErrorMessage(error)}`);
    } finally {
      setIsJudgementLoading(false);
    }
  };

  const onGenerateClick = async () => {
    setStepError(null);
    if (!aiCore) {
      setStepError("Could not initialize Gemini");
      return;
    }

    setIsPdfLoading(true);
    // Start downloading the PDF renderer while the AI calls run
    loadResumePreview().catch(() => {});
    try {
      const [summary, skills, experience] = await Promise.all([
        generateResumeSection(aiCore, "summary", jobDescription, userData),
        generateResumeSection(aiCore, "skills", jobDescription, userData),
        generateResumeSection(aiCore, "experience", jobDescription, userData),
      ]);

      setSummaryData(summary.summary);
      setSkillsData(skills.technicalSkills);
      setExperienceData(experience.bulletPoints);
      setStep(2);
    } catch (error) {
      setStepError(`Resume generation failed: ${getErrorMessage(error)}`);
    } finally {
      setIsPdfLoading(false);
    }
  };

  const onResetClick = () => {
    setJobDescription("");
    setStep(0);
    setJudgeResponse(undefined);
    setStepError(null);
    setSummaryData(ResumeData.summary);
    setExperienceData(defaultTweakableBullets);
    setSkillsData(ResumeData.featuredSkills);
  };

  return (
    <div className="flex flex-col justify-center items-center w-screen overflow-y-auto">
      <div className="flex flex-col w-full max-w-xl p-4 gap-4">
        <Stepper steps={steps} currentStep={step} onStepChange={setStep} />
        <Button
          className="mb-4 mt-2"
          variant={"destructive"}
          onClick={onResetClick}
          disabled={isJudgementLoading || isPdfLoading}
        >
          Reset
        </Button>
        {stepError && (
          <div className="border border-red-600 text-red-400 bg-red-50 rounded-2xl text-xs p-2">
            {stepError}
          </div>
        )}
        {step === 0 && (
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
                type="password"
                autoComplete="off"
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
            <Button
              className="p-2 bg-blue-700 text-white rounded-3xl cursor-pointer"
              onClick={onJudgeClick}
              disabled={isJudgementLoading}
            >
              {!isJudgementLoading ? (
                "Judge the job ⚖️"
              ) : (
                <>
                  Judging... <Loader2 className="animate-spin" />
                </>
              )}
            </Button>
          </>
        )}
      </div>
      {step === 1 && (
        <>
          <div className="flex flex-col justify-center w-full">
            {judgeResponse ? (
              <div className="flex flex-col justify-center items-center w-full">
                <JudgeResponse judgeResponse={judgeResponse} />
                <Button
                  className="my-4 w-50 p-2 bg-blue-700 text-white rounded-3xl cursor-pointer"
                  onClick={onGenerateClick}
                  disabled={isPdfLoading}
                >
                  {!isPdfLoading
                    ? judgeResponse.overallMatchScore > 70
                      ? "Proceed with Resume"
                      : "Still proceed with resume"
                    : "PDF is Loading"}
                </Button>
              </div>
            ) : (
              <Loader2 className="animate-spin" />
            )}
          </div>
        </>
      )}
      {step === 2 && (
        <div className="w-screen h-screen">
          {!isPdfLoading ? (
            <Suspense fallback={<Loader className="animate-spin" />}>
              <ResumePreview
                summaryData={summaryData}
                mainExperienceData={experienceData}
                skillsData={skillsData}
              />
            </Suspense>
          ) : (
            <Loader className="animate-spin" />
          )}
        </div>
      )}
    </div>
  );
};
