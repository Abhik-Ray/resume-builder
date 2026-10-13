import { ArrowLeft, Check, KeyRound, Loader2, RotateCcw, Sparkles } from "lucide-react";
import { judgeJobPosting, type JudgeResponseType } from "../../utils/AIResumeJudge";
import { lazy, Suspense, useState } from "react";
import { Link, useLocation } from "react-router";
import { verifyProviderKey } from "../../utils/AIHealthCheck";
import { JudgeResponse } from "./JudgeResponse";
import { Button } from "../../components/ui/button";
import { SelectField, TextAreaField } from "../../components/form/fields";
import { generateResumeSection } from "../../utils/AIResumeBuilder";
import { getTweakableBullets, toUserData } from "../../data/ResumeData";
import { resumeFromProfile } from "../../db/resumeData";
import { useProfile } from "../../db/profile";
import { missingDetails, type ResumeSnapshot } from "@resume-builder/shared";
import { DETAILS_PATH } from "../../auth/RequireAuth";
import { useCreateApplication } from "../../db/applications";
import { ApplicationForm } from "../applications/ApplicationForm";
import type { JobForResume } from "../jobs/jobForResume";
import { useUpdateMatch } from "../../db/matches";
import { useApiKeys } from "../../db/apiKeys";
import type { ApiKeyRecord } from "../../db/db";
import type { ResumeDataType } from "../../types/input";
import { cn } from "../../lib/utils";
import { writeStored } from "../../lib/storage";
import { MODELS, type ModelChoice } from "../../utils/models";
import { getProvider } from "../../utils/providers";
import { listProviderModels, mergeModelOptions, type ModelOption } from "../../utils/providerModels";
import { useQuery } from "@tanstack/react-query";
import {
  KEY_CHOICE_STORAGE,
  modelChoiceStorage,
  pickKey,
  readKeyChoice,
  readModelChoices,
} from "./aiChoice";

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
  const profile = useProfile();
  const keys = useApiKeys();
  // Set when the Jobs page sent a match here
  const fromJob = (useLocation().state as { job?: JobForResume } | null)?.job;

  const content = () => {
    if (profile.isError) {
      return (
        <p role="alert" className="text-sm text-red-600 dark:text-red-400">
          Couldn't load your details: {getErrorMessage(profile.error)}
        </p>
      );
    }
    if (profile.isPending || !keys) return <Spinner />;
    const missing = missingDetails(profile.data);
    if (missing.length > 0) return <FinishDetails missing={missing} />;
    return (
      <ResumeGenerator
        // A new job starts the flow over
        key={fromJob?.jobId}
        resume={resumeFromProfile(profile.data).data}
        keys={keys}
        fromJob={fromJob}
      />
    );
  };

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-4 p-4">
      <h1 className="text-lg font-semibold">Resume</h1>
      {content()}
    </div>
  );
};

// The AI needs these details; saving them on the Details page comes back here
const FinishDetails = ({ missing }: { missing: string[] }) => (
  <div className="flex flex-col items-start gap-3 rounded-lg border p-4">
    <div>
      <h2 className="font-semibold">Finish your details to generate resumes</h2>
      <p className="text-sm text-muted-foreground">Still needed: {missing.join(", ")}.</p>
    </div>
    <Button asChild className="rounded-md">
      <Link to={`${DETAILS_PATH}?from=/resume`}>Go to Details</Link>
    </Button>
  </div>
);

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

interface AIPickerProps {
  keys: ApiKeyRecord[];
  activeKey: ApiKeyRecord;
  model: ModelChoice;
  modelOptions: ModelOption[];
  // Set when the account's own model list couldn't be loaded
  modelsNote?: string;
  onKeyChange: (id: number) => void;
  onModelChange: (model: ModelChoice) => void;
  disabled: boolean;
}

// Key and model dropdowns; the model list follows the key's provider
const AIPicker = ({
  keys,
  activeKey,
  model,
  modelOptions,
  modelsNote,
  onKeyChange,
  onModelChange,
  disabled,
}: AIPickerProps) => (
  <div className="grid gap-4 sm:grid-cols-2">
    <SelectField
      label="AI key"
      options={keys.map((k) => ({
        value: String(k.id),
        label: `${k.label} · ${getProvider(k.provider).label}`,
      }))}
      value={String(activeKey.id)}
      onChange={(event) => onKeyChange(Number(event.target.value))}
      disabled={disabled}
    />
    <SelectField
      label="Model"
      options={[
        { value: "auto", label: "Auto (fast for analysis, stronger for the summary)" },
        ...modelOptions.map((m) => ({ value: m.id, label: m.label })),
      ]}
      value={model}
      onChange={(event) => onModelChange(event.target.value)}
      disabled={disabled}
    />
    {modelsNote && <p className="text-xs text-muted-foreground sm:col-span-2">{modelsNote}</p>}
  </div>
);

interface ResumeGeneratorProps {
  resume: ResumeDataType;
  keys: ApiKeyRecord[];
  fromJob?: JobForResume;
}

const ResumeGenerator = ({ resume, keys, fromJob }: ResumeGeneratorProps) => {
  const [selectedKeyId, setSelectedKeyId] = useState(readKeyChoice);
  const [modelChoices, setModelChoices] = useState(readModelChoices);
  const [jobDescription, setJobDescription] = useState(fromJob?.description ?? "");
  const [step, setStep] = useState<number>(0);
  const [judgeResponse, setJudgeResponse] = useState<JudgeResponseType>();
  const [stepError, setStepError] = useState<string | null>(null);
  // The key that last passed the health check, so it isn't re-checked on every call
  const [verifiedKey, setVerifiedKey] = useState<Pick<ApiKeyRecord, "id" | "key"> | null>(null);
  const [isJudgementLoading, setIsJudgementLoading] = useState<boolean>(false);
  const [isPdfLoading, setIsPdfLoading] = useState<boolean>(false);
  const [summaryData, setSummaryData] = useState(resume.summary);
  const [experienceData, setExperienceData] = useState<string[]>(() =>
    getTweakableBullets(resume),
  );
  const [skillsData, setSkillsData] = useState(resume.featuredSkills);

  const activeKey = pickKey(keys, selectedKeyId);
  // The models this key can use, from the provider; the curated list until (or unless) it loads
  const accountModels = useQuery({
    queryKey: ["providerModels", activeKey?.id, activeKey?.provider],
    queryFn: () => listProviderModels(activeKey!.provider, activeKey!.key),
    enabled: !!activeKey,
    staleTime: 60 * 60 * 1000,
    retry: false,
  });
  const modelOptions = activeKey
    ? mergeModelOptions(MODELS[activeKey.provider].options, accountModels.data)
    : [];
  const storedModel = activeKey ? modelChoices[activeKey.provider] : "auto";
  // A remembered model that is no longer offered falls back to auto
  const model: ModelChoice = modelOptions.some((m) => m.id === storedModel) ? storedModel : "auto";
  const isBusy = isJudgementLoading || isPdfLoading;

  const onKeyChange = (id: number) => {
    setSelectedKeyId(id);
    writeStored(KEY_CHOICE_STORAGE, String(id));
  };

  const onModelChange = (choice: ModelChoice) => {
    if (!activeKey) return;
    setModelChoices((choices) => ({ ...choices, [activeKey.provider]: choice }));
    writeStored(modelChoiceStorage(activeKey.provider), choice);
  };

  // Checks the key with its provider unless it already passed; sets the error on failure
  const ensureVerified = async (key: ApiKeyRecord) => {
    if (verifiedKey?.id === key.id && verifiedKey.key === key.key) return true;
    const { valid } = await verifyProviderKey(key.provider, key.key);
    if (!valid) {
      setStepError(`${getProvider(key.provider).label} servers unreachable or invalid key`);
      return false;
    }
    setVerifiedKey({ id: key.id, key: key.key });
    return true;
  };

  const picker = activeKey && (
    <AIPicker
      keys={keys}
      activeKey={activeKey}
      model={model}
      modelOptions={modelOptions}
      modelsNote={
        accountModels.isError ? "Couldn't load your account's model list; showing the defaults." : undefined
      }
      onKeyChange={onKeyChange}
      onModelChange={onModelChange}
      disabled={isBusy}
    />
  );

  const onJudgeClick = async () => {
    setStepError(null);
    if (!activeKey) {
      setStepError("Add an AI key in Settings first");
      return;
    }
    if (!jobDescription.trim().length) {
      setStepError("Please enter a job description");
      return;
    }

    setIsJudgementLoading(true);
    try {
      if (!(await ensureVerified(activeKey))) return;

      setJudgeResponse(
        await judgeJobPosting(activeKey, model, jobDescription, resume.jobPreferences),
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
    if (!activeKey) {
      setStepError("Add an AI key in Settings first");
      return;
    }

    setIsPdfLoading(true);
    // Start downloading the PDF renderer while the AI calls run
    loadResumePreview().catch(() => {});
    try {
      // The key may have been switched since the review
      if (!(await ensureVerified(activeKey))) return;

      const userData = toUserData(resume);
      const [summary, skills, experience] = await Promise.all([
        generateResumeSection(activeKey, model, "summary", jobDescription, userData),
        generateResumeSection(activeKey, model, "skills", jobDescription, userData),
        generateResumeSection(activeKey, model, "experience", jobDescription, userData),
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
                No AI key saved.{" "}
                <Link to="/settings/api-keys" className="font-medium underline">
                  Add one in Settings
                </Link>{" "}
                to review jobs and generate resumes.
              </span>
            </p>
          ) : (
            picker
          )}
          {fromJob && (
            <p className="text-xs text-muted-foreground">
              From {fromJob.title} at {fromJob.company}. Job sites often share only a summary:{" "}
              <a href={fromJob.url} target="_blank" rel="noreferrer" className="underline">
                open the posting
              </a>{" "}
              and paste the full description for a better match.
            </p>
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
            {picker && <div className="rounded-lg border p-4">{picker}</div>}
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
        <>
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
          <SaveAsApplication
            fromJob={fromJob}
            jobDescription={jobDescription}
            snapshot={{
              resume,
              summary: summaryData,
              skills: skillsData,
              experienceBullets: experienceData,
            }}
          />
        </>
      )}
    </>
  );
};

// Saves the job with the exact resume generated for it, for the tracker
const SaveAsApplication = ({
  fromJob,
  jobDescription,
  snapshot,
}: {
  fromJob?: JobForResume;
  jobDescription: string;
  snapshot: ResumeSnapshot;
}) => {
  const createApplication = useCreateApplication();
  const updateMatch = useUpdateMatch();
  const [saved, setSaved] = useState(false);

  if (saved) {
    return (
      <p role="status" className="rounded-lg border p-4 text-sm">
        Saved to your{" "}
        <Link to="/applications" className="font-medium underline">
          applications
        </Link>
        .
      </p>
    );
  }

  return (
    <section aria-label="Save as application" className="flex flex-col gap-3 rounded-lg border p-4">
      <div>
        <h2 className="text-base font-semibold">Save as application</h2>
        <p className="text-xs text-muted-foreground">
          Keeps the job description and this exact resume with the application.
        </p>
      </div>
      <ApplicationForm
        submitLabel="Save as application"
        defaultValues={
          fromJob && { company: fromJob.company, title: fromJob.title, url: fromJob.url }
        }
        onSubmit={async (values) => {
          await createApplication.mutateAsync({
            ...values,
            jdText: jobDescription,
            resumeSnapshot: snapshot,
            jobId: fromJob?.jobId,
          });
          if (fromJob) {
            await updateMatch.mutateAsync({ jobId: fromJob.jobId, patch: { state: "applied" } });
          }
          setSaved(true);
        }}
      />
    </section>
  );
};
