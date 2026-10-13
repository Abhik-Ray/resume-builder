import {
  MATCH_STATE_LABELS,
  MATCH_STATES,
  missingDetails,
  type MatchState,
} from "@resume-builder/shared";
import {
  Bookmark,
  Check,
  ExternalLink,
  FileText,
  Loader2,
  RotateCcw,
  Sparkles,
  X,
} from "lucide-react";
import { useState } from "react";
import { Link, useNavigate } from "react-router";
import { SelectField } from "../../components/form/fields";
import { Button } from "../../components/ui/button";
import { useApiKeys } from "../../db/apiKeys";
import { useCreateApplication } from "../../db/applications";
import type { ApiKeyRecord } from "../../db/db";
import { useLatestSyncRun, useMatches, useUpdateMatch, type Match } from "../../db/matches";
import { useProfile } from "../../db/profile";
import { resumeFromProfile } from "../../db/resumeData";
import { writeStored } from "../../lib/storage";
import { cn } from "../../lib/utils";
import { verifyProviderKey } from "../../utils/AIHealthCheck";
import { judgeJobPosting } from "../../utils/AIResumeJudge";
import { getProvider } from "../../utils/providers";
import { KEY_CHOICE_STORAGE, pickKey, readKeyChoice } from "../resume/aiChoice";
import { judgeInBatches } from "./judging";
import type { JobForResume } from "./jobForResume";

const getErrorMessage = (error: unknown) =>
  error instanceof Error ? error.message : String(error);

const formatTime = (iso: string) =>
  new Date(iso).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });

const JobsPage = () => {
  const matches = useMatches();
  const [tab, setTab] = useState<MatchState>("new");

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-4 p-4">
      <div className="flex flex-wrap items-end gap-2">
        <div className="mr-auto">
          <h1 className="text-lg font-semibold">Jobs</h1>
          <LastSync />
        </div>
        <Link to="/settings/searches" className="text-xs underline">
          Edit searches
        </Link>
      </div>

      {matches.isPending ? (
        <div className="flex justify-center p-8">
          <Loader2 className="animate-spin" aria-label="Loading" />
        </div>
      ) : matches.isError ? (
        <p role="alert" className="text-sm text-red-600 dark:text-red-400">
          Couldn't load your matches: {getErrorMessage(matches.error)}
        </p>
      ) : (
        <>
          <div role="tablist" aria-label="Match state" className="flex gap-1 border-b">
            {MATCH_STATES.map((state) => {
              const count = matches.data.filter((m) => m.state === state).length;
              return (
                <button
                  key={state}
                  type="button"
                  role="tab"
                  aria-selected={tab === state}
                  onClick={() => setTab(state)}
                  className={cn(
                    "-mb-px border-b-2 px-3 py-2 text-sm",
                    tab === state
                      ? "border-primary font-medium"
                      : "border-transparent text-muted-foreground",
                  )}
                >
                  {MATCH_STATE_LABELS[state]} ({count})
                </button>
              );
            })}
          </div>
          {tab === "new" && <JudgeBar matches={matches.data.filter((m) => m.state === "new")} />}
          <MatchList matches={matches.data.filter((m) => m.state === tab)} state={tab} />
        </>
      )}
    </div>
  );
};

export default JobsPage;

const LastSync = () => {
  const run = useLatestSyncRun();
  if (run.isPending) return null;
  if (run.isError) {
    return <p className="text-xs text-muted-foreground">Couldn't check when the job search last ran.</p>;
  }
  if (!run.data) {
    return <p className="text-xs text-muted-foreground">The daily job search hasn't run yet.</p>;
  }
  return (
    <p className="text-xs text-muted-foreground">
      Last updated {formatTime(run.data.finished_at ?? run.data.started_at)}, {run.data.matches_new} new
      matches
    </p>
  );
};

// Judges unjudged new matches with the user's own key, a few at a time, in the browser
const JudgeBar = ({ matches }: { matches: Match[] }) => {
  const keys = useApiKeys();
  const profile = useProfile();
  const updateMatch = useUpdateMatch();
  const [selectedKeyId, setSelectedKeyId] = useState(readKeyChoice);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const [message, setMessage] = useState<{ type: "error" | "status"; text: string } | null>(null);
  const unjudged = matches.filter((m) => !m.verdict);

  if (!keys || !profile.data) return null;
  const activeKey = pickKey(keys, selectedKeyId);
  const missing = missingDetails(profile.data);

  const status = message && (
    <p
      role={message.type === "error" ? "alert" : "status"}
      className={cn("text-xs", message.type === "error" && "text-red-600 dark:text-red-400")}
    >
      {message.text}
    </p>
  );
  // Nothing left to judge: keep the last result in view
  if (unjudged.length === 0 && !progress) return status || null;
  if (!activeKey) {
    return (
      <p className="rounded-md border p-3 text-xs">
        <Link to="/settings/api-keys" className="font-medium underline">
          Add an AI key
        </Link>{" "}
        to judge new jobs against your preferences.
      </p>
    );
  }
  if (missing.length > 0) {
    return (
      <p className="rounded-md border p-3 text-xs">
        <Link to="/settings/resume-data" className="font-medium underline">
          Finish your details
        </Link>{" "}
        to judge jobs against your preferences.
      </p>
    );
  }

  const onJudge = async (key: ApiKeyRecord) => {
    setMessage(null);
    setProgress({ done: 0, total: unjudged.length });
    try {
      const { valid } = await verifyProviderKey(key.provider, key.key);
      if (!valid) {
        setMessage({ type: "error", text: `${getProvider(key.provider).label} servers unreachable or invalid key` });
        return;
      }
      const preferences = resumeFromProfile(profile.data).data.jobPreferences;
      const { failed } = await judgeInBatches(
        unjudged,
        async (match) => {
          const verdict = await judgeJobPosting(
            key,
            "auto",
            `${match.job.title} at ${match.job.company}\n${match.job.location ?? ""}\n\n${match.job.description ?? ""}`,
            preferences,
          );
          await updateMatch.mutateAsync({ jobId: match.job_id, patch: { verdict } });
        },
        (done) => setProgress({ done, total: unjudged.length }),
      );
      setMessage(
        failed.length
          ? { type: "error", text: `${failed.length} couldn't be judged: ${getErrorMessage(failed[0].error)}` }
          : { type: "status", text: "All new jobs judged" },
      );
    } catch (error) {
      setMessage({ type: "error", text: `Judging failed: ${getErrorMessage(error)}` });
    } finally {
      setProgress(null);
    }
  };

  return (
    <div className="flex flex-wrap items-end gap-3 rounded-lg border p-3">
      <SelectField
        className="min-w-56"
        label="AI key"
        options={keys.map((k) => ({ value: String(k.id), label: `${k.label} · ${getProvider(k.provider).label}` }))}
        value={String(activeKey.id)}
        onChange={(event) => {
          setSelectedKeyId(Number(event.target.value));
          writeStored(KEY_CHOICE_STORAGE, event.target.value);
        }}
        disabled={!!progress}
      />
      <Button className="rounded-md" onClick={() => onJudge(activeKey)} disabled={!!progress}>
        {progress ? <Loader2 className="animate-spin" /> : <Sparkles />}
        {progress ? `Judging ${progress.done} of ${progress.total}…` : `Judge ${unjudged.length} new jobs`}
      </Button>
      {status}
    </div>
  );
};

const MatchList = ({ matches, state }: { matches: Match[]; state: MatchState }) =>
  matches.length === 0 ? (
    <p className="rounded-lg border p-8 text-center text-sm text-muted-foreground">
      {state === "new" ? (
        <>
          No new matches.{" "}
          <Link to="/settings/searches" className="underline">
            Add or widen a search
          </Link>{" "}
          and the next morning's run will look again.
        </>
      ) : (
        `No ${MATCH_STATE_LABELS[state].toLowerCase()} jobs.`
      )}
    </p>
  ) : (
    <ul className="flex flex-col gap-3">
      {matches.map((match) => (
        <MatchCard key={match.job_id} match={match} />
      ))}
    </ul>
  );

const MatchCard = ({ match }: { match: Match }) => {
  const { job, verdict } = match;
  const updateMatch = useUpdateMatch();
  const createApplication = useCreateApplication();
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);
  const label = `${job.title} at ${job.company}`;

  const setState = async (state: MatchState) => {
    setError(null);
    try {
      await updateMatch.mutateAsync({ jobId: match.job_id, patch: { state } });
    } catch (cause) {
      setError(`Update failed: ${getErrorMessage(cause)}`);
    }
  };

  const onApplied = async () => {
    setError(null);
    try {
      await createApplication.mutateAsync({
        company: job.company,
        title: job.title,
        url: job.url,
        status: "applied",
        jdText: job.description,
        jobId: job.id,
      });
      await updateMatch.mutateAsync({ jobId: match.job_id, patch: { state: "applied" } });
    } catch (cause) {
      setError(`Saving the application failed: ${getErrorMessage(cause)}`);
    }
  };

  const onGenerate = () => {
    const forResume: JobForResume = {
      jobId: job.id,
      title: job.title,
      company: job.company,
      url: job.url,
      description: job.description ?? "",
    };
    navigate("/resume", { state: { job: forResume } });
  };

  const busy = updateMatch.isPending || createApplication.isPending;

  return (
    <li aria-label={label} className="flex flex-col gap-2 rounded-lg border p-4">
      <div className="flex flex-wrap items-start gap-2">
        <div className="mr-auto flex flex-col">
          <a
            href={job.url}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1 font-semibold underline-offset-2 hover:underline"
          >
            {job.title}
            <ExternalLink className="size-3" aria-hidden />
          </a>
          <span className="text-xs text-muted-foreground">
            {job.company}
            {job.location && ` · ${job.location}`}
            {job.remote && " · Remote"}
            {` · keyword score ${match.keyword_score}`}
          </span>
        </div>
        {verdict && (
          <span className="rounded-md border px-2 py-1 text-xs">
            <strong>{verdict.overallMatchScore}</strong> · {verdict.verdict}
          </span>
        )}
      </div>
      {verdict ? (
        <details className="text-xs">
          <summary className="cursor-pointer">{verdict.matchAnalysis}</summary>
          <ul className="mt-2 list-disc pl-5">
            {verdict.pros.map((p) => (
              <li key={`pro-${p}`}>{p}</li>
            ))}
            {verdict.cons.map((c) => (
              <li key={`con-${c}`} className="text-muted-foreground">
                {c}
              </li>
            ))}
            {verdict.redFlags.map((r) => (
              <li key={`flag-${r}`} className="text-red-600 dark:text-red-400">
                {r}
              </li>
            ))}
          </ul>
        </details>
      ) : (
        job.description && <p className="line-clamp-2 text-xs text-muted-foreground">{job.description}</p>
      )}
      {error && (
        <p role="alert" className="text-xs text-red-600 dark:text-red-400">
          {error}
        </p>
      )}
      <div className="flex flex-wrap gap-2">
        <Button size="sm" className="rounded-md" onClick={onGenerate}>
          <FileText /> Generate resume
        </Button>
        {match.state !== "applied" && (
          <Button size="sm" variant="outline" className="rounded-md" onClick={onApplied} disabled={busy}>
            <Check /> Mark applied
          </Button>
        )}
        {match.state === "new" && (
          <Button size="sm" variant="ghost" className="rounded-md" onClick={() => setState("saved")} disabled={busy}>
            <Bookmark /> Save
          </Button>
        )}
        {match.state !== "dismissed" && match.state !== "applied" && (
          <Button size="sm" variant="ghost" className="rounded-md" onClick={() => setState("dismissed")} disabled={busy}>
            <X /> Dismiss
          </Button>
        )}
        {(match.state === "dismissed" || match.state === "saved") && (
          <Button size="sm" variant="ghost" className="rounded-md" onClick={() => setState("new")} disabled={busy}>
            <RotateCcw /> Back to new
          </Button>
        )}
      </div>
    </li>
  );
};
