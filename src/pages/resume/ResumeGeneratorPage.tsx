import { GoogleGenAI } from "@google/genai";
import { ArrowLeft, Check, KeyRound, Loader2, RotateCcw, Sparkles } from "lucide-react";
import { judgeJobPosting, type JudgeResponseType } from "../../utils/AIResumeJudge";
import { lazy, Suspense, useState } from "react";
import { Link } from "react-router";
import { verifyApiKey } from "../../utils/AIHealthCheck";
import { JudgeResponse } from "./JudgeResponse";
import { Button } from "../../components/ui/button";
import { SelectField, TextAreaField } from "../../components/form/fields";
import { generateResumeSection } from "../../utils/AIResumeBuilder";
import { getTweakableBullets, toUserData } from "../../data/ResumeData";
import { useResumeData } from "../../db/resumeData";
import { useProviderKeys } from "../../db/apiKeys";
import type { ApiKeyRecord } from "../../db/db";
import type { ResumeDataType } from "../../types/input";
import { cn } from "../../lib/utils";

// The PDF renderer is large, so load it only when the resume is generated
const loadResumePreview = () => import("../../ResumePreview");
const ResumePreview = lazy(loadResumePreview);

const STEPS = ["Job description", "Job review", "Resume"];

const getErrorMessage = (error: unknown) =>
  error instanceof Error ? error.message : String(error);

const Spinner = () => (
  <div className="flex justify-center p-8">
    <Loader2 className="animate-spin" />
  </div>
);

const ResumeGeneratorPage = () => {
  const resume = useResumeData();
  const geminiKeys = useProviderKeys("gemini");

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-4 p-4">
      <h1 className="text-lg font-semibold">Resume</h1>
      {!resume || !geminiKeys ? (
        <Spinner />
      ) : (
        <ResumeGenerator resume={resume.data} geminiKeys={geminiKeys} />
      )}
    </div>
  );
};

export default ResumeGeneratorPage;

// Step progress bar
const StepTabs = ({ current }: { current: number }) => (
  <ol className="flex gap-1 border-b">
    {STEPS.map((label, index) => (
      <li
        key={label}
        aria-current={index === current ? "step" : undefined}
        className={cn(
          "-mb-px flex items-center gap-2 border-b-2 px-3 py-2 text-sm",
          index === current
            ? "border-primary font-medium text-foreground"
            : "border-transparent text-muted-foreground",
        )}
      >
        <span
          className={cn(
            "flex size-5 items-center justify-center rounded-full border text-[10px]",
            index < current && "border-primary bg-primary text-primary-foreground",
            index === current && "border-primary",
          )}
        >
          {index < current ? <Check className="size-3" /> : index + 1}
        </span>
        <span className={cn(index !== current && "hidden sm:inline")}>{label}</span>
      </li>
    ))}
  </ol>
);

interface ResumeGeneratorProps {
  resume: ResumeDataType;
  geminiKeys: ApiKeyRecord[];
}

const ResumeGenerator = ({ resume, geminiKeys }: ResumeGeneratorProps) => {
  const [selectedKeyId, setSelectedKeyId] = useState<number | null>(null);
  const [jobDescription, setJobDescription] = useState("");
  const [step, setStep] = useState<number>(0);
  const [judgeResponse, setJudgeResponse] = useState<JudgeResponseType>();
  const [stepError, setStepError] = useState<string | null>(null);
  const [aiCore, setAICore] = useState<GoogleGenAI | null>(null);
  const [isJudgementLoading, setIsJudgementLoading] = useState<boolean>(false);
  const [isPdfLoading, setIsPdfLoading] = useState<boolean>(false);
  const [summaryData, setSummaryData] = useState(resume.summary);
  const [experienceData, setExperienceData] = useState<string[]>(() =>
    getTweakableBullets(resume),
  );
  const [skillsData, setSkillsData] = useState(resume.featuredSkills);

  const activeKey =
    geminiKeys.find((k) => k.id === selectedKeyId) ??
    geminiKeys.find((k) => k.isDefault) ??
    geminiKeys[0];
  const isBusy = isJudgementLoading || isPdfLoading;

  const onJudgeClick = async () => {
    setStepError(null);
    if (!activeKey) {
      setStepError("Add a Gemini key in Settings first");
      return;
    }
    if (!jobDescription.trim().length) {
      setStepError("Please enter a job description");
      return;
    }

    setIsJudgementLoading(true);
    try {
      const aiCoreObject = new GoogleGenAI({ apiKey: activeKey.key });
      const { valid } = await verifyApiKey(aiCoreObject);
      if (!valid) {
        setStepError("Gemini servers unreachable or invalid key");
        return;
      }

      setAICore(aiCoreObject);

      setJudgeResponse(
        await judgeJobPosting(aiCoreObject, jobDescription, resume.jobPreferences),
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
      const userData = toUserData(resume);
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
    setSummaryData(resume.summary);
    setExperienceData(getTweakableBullets(resume));
    setSkillsData(resume.featuredSkills);
  };

  const goBack = () => {
    setStepError(null);
    setStep((s) => s - 1);
  };

  return (
    <>
      <StepTabs current={step} />

      <div className="flex flex-wrap items-center gap-2">
        <div className="mr-auto">
          <h2 className="text-base font-semibold">{STEPS[step]}</h2>
          <p className="text-xs text-muted-foreground">
            {step === 0 && "Paste the job description to review it against your preferences."}
            {step === 1 && "How well the job matches your preferences."}
            {step === 2 && "Your resume, tailored to this job."}
          </p>
        </div>
        {step > 0 && (
          <Button variant="ghost" className="rounded-md" onClick={goBack} disabled={isBusy}>
            <ArrowLeft /> Back
          </Button>
        )}
        <Button
          variant="destructive"
          className="rounded-md"
          onClick={onResetClick}
          disabled={isBusy || (step === 0 && !jobDescription)}
        >
          <RotateCcw /> Start over
        </Button>
      </div>

      {stepError && (
        <p
          role="alert"
          className="rounded-md border border-red-600 bg-red-50 p-2 text-xs text-red-600 dark:border-red-500/60 dark:bg-red-950/40 dark:text-red-400"
        >
          {stepError}
        </p>
      )}

      {step === 0 && (
        <div className="flex flex-col gap-4 rounded-lg border p-4">
          {!activeKey ? (
            <p className="flex items-center gap-2 rounded-md border border-amber-500 bg-amber-50 p-2 text-xs text-amber-800 dark:border-amber-500/60 dark:bg-amber-950/40 dark:text-amber-300">
              <KeyRound className="size-4 shrink-0" />
              <span>
                No Gemini key saved.{" "}
                <Link to="/settings/api-keys" className="font-medium underline">
                  Add one in Settings
                </Link>{" "}
                to review jobs and generate resumes.
              </span>
            </p>
          ) : (
            geminiKeys.length > 1 && (
              <SelectField
                className="sm:max-w-xs"
                label="Gemini key"
                options={geminiKeys.map((k) => ({ value: String(k.id), label: k.label }))}
                value={String(activeKey.id)}
                onChange={(event) => setSelectedKeyId(Number(event.target.value))}
              />
            )
          )}
          <TextAreaField
            label="Job description"
            rows={14}
            placeholder="Paste the full job posting here"
            value={jobDescription}
            onChange={(event) => setJobDescription(event.target.value)}
          />
          <div className="flex justify-end">
            <Button
              className="rounded-md"
              onClick={onJudgeClick}
              disabled={isJudgementLoading || !activeKey}
            >
              {isJudgementLoading && <Loader2 className="animate-spin" />}
              {isJudgementLoading ? "Reviewing…" : "Review job"}
            </Button>
          </div>
        </div>
      )}

      {step === 1 &&
        (judgeResponse ? (
          <>
            <JudgeResponse judgeResponse={judgeResponse} />
            <div className="flex justify-end">
              <Button className="rounded-md" onClick={onGenerateClick} disabled={isPdfLoading}>
                {isPdfLoading ? <Loader2 className="animate-spin" /> : <Sparkles />}
                {isPdfLoading
                  ? "Generating…"
                  : judgeResponse.overallMatchScore > 70
                    ? "Generate resume"
                    : "Generate resume anyway"}
              </Button>
            </div>
          </>
        ) : (
          <Spinner />
        ))}

      {step === 2 && (
        <div className="h-[calc(100vh-12rem)] min-h-96 overflow-hidden rounded-lg border">
          <Suspense fallback={<Spinner />}>
            <ResumePreview
              resume={resume}
              summaryData={summaryData}
              mainExperienceData={experienceData}
              skillsData={skillsData}
            />
          </Suspense>
        </div>
      )}
    </>
  );
};
