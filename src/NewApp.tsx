import { GoogleGenAI } from "@google/genai";
import { JobPreferenceData } from "./data/JobPreferenceData";
import { Loader, Loader2 } from "lucide-react";
import { judgeJobPosting, type JudgeResponseType } from "./utils/AIResumeJudge";
import { useState } from "react";
import { verifyApiKey } from "./utils/AIHealthCheck";
import { JudgeResponse } from "./JudgeResponse";
import { Button } from "./components/ui/button";
import { generateResumeSection } from "./utils/AIResumeBuilder";
import { userData } from "./data/UserData";
import { SummaryData } from "./data/SummaryData";
import { SkillsData } from "./data/SkillsData";
import { MainExperienceData } from "./data/MainExperienceData";
import { MyDocument } from "./pdf";
import { PDFViewer } from "@react-pdf/renderer";
import { Stepper } from "./components/ui/stepper";

const steps = [
  { no: 0, title: "1. Job Description", description: "Paste Job Desription" },
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

export const NewApp = () => {
  const [geminiKey, setGeminiKey] = useState<string>(getLocalKey());
  const [jobDescription, setJobDescription] = useState("");
  const [step, setStep] = useState<number>(0);
  const [judgeResponse, setJudgeResponse] = useState<JudgeResponseType>();
  const [stepError, setStepError] = useState<string | null>(null);
  const [aiCore, setAICore] = useState<GoogleGenAI | null>(null);
  const [isJudgementLoading, setIsJudgementLoading] = useState<boolean>(false);
  const [isPdfLoading, setIsPdfLoading] = useState<boolean>(false);
  const [summaryData, setSummaryData] = useState(SummaryData);
  const [experienceData, setExperienceData] =
    useState<string[]>(MainExperienceData);
  const [skillsData, setSkillsData] = useState(SkillsData);

  console.log({
    geminiKey,
    jobDescription,
    step,
    judgeResponse,
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

    localStorage.setItem('geminiKey', geminiKey);

    if (!isGeminiKeyValid) {
      setStepError("Gemini servers unreachable or invalid key");
      return;
    }

    setIsJudgementLoading(true);

    const aiCoreObject = await initializeAICore(geminiKey);

    setAICore(aiCoreObject);

    if (!aiCoreObject) {
      setStepError("Couldn't initialize aiCore");
      return;
    }

    setJudgeResponse(
      await judgeJobPosting(aiCoreObject, jobDescription, JobPreferenceData),
    );

    setIsJudgementLoading(false);

    setStep(1);
  };

  const isHealthy = async (): Promise<boolean> => {
    return verifyApiKey(geminiKey)
      .then((response) => response.valid)
      .catch(() => false)
      .finally(() => false);
  };

  const genarateSummary = async () => {
    if (!aiCore) {
      setStepError("Could not initialize Gemini");
      return;
    }
    return generateResumeSection(aiCore, "summary", jobDescription, userData);
  };

  const genarateExperienceData = async () => {
    if (!aiCore) {
      setStepError("Could not initialize Gemini");
      return;
    }
    return generateResumeSection(
      aiCore,
      "experience",
      jobDescription,
      userData,
    );
  };

  const genarateSkills = async () => {
    if (!aiCore) {
      setStepError("Could not initialize Gemini");
      return;
    }
    return generateResumeSection(aiCore, "skills", jobDescription, userData);
  };

  const onGenerateClick = async () => {
    if (!aiCore) {
      setStepError("Could not initialize Gemini");
      return;
    }
    setIsPdfLoading(true);
    const summary = await genarateSummary();
    const skills = await genarateSkills();
    const experience = await genarateExperienceData();

    setSummaryData(summary["summary"]);
    setSkillsData(skills?.["technicalSkills"]);
    setExperienceData(experience["bulletPoints"]);
    setIsPdfLoading(false);

    setStep(2);
  };

  return (
    <div className="flex flex-col justify-center items-center w-screen overflow-y-auto">
      <div className="flex flex-col w-full max-w-xl p-4 gap-4">
        <Stepper steps={steps} currentStep={step} onStepChange={setStep} />
        <Button
          className="mb-4 mt-2"
          variant={"destructive"}
          onClick={() => window.location.reload()}
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
            <PDFViewer
              className={`h-full w-full ${isPdfLoading ? "hidden" : ""}`}
            >
              <MyDocument
                summaryData={summaryData}
                mainExperienceData={experienceData}
                skillsData={skillsData}
              />
            </PDFViewer>
          ) : (
            <Loader className="animate-spin" />
          )}
        </div>
      )}
    </div>
  );
};
