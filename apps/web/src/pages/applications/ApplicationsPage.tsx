import {
  APPLICATION_STATUSES,
  STATUS_LABELS,
  type ApplicationRow,
  type ApplicationStatus,
  type ResumeSnapshot,
} from "@resume-builder/shared";
import { Columns3, ExternalLink, FileText, Loader2, Plus, Table2, Trash2, X } from "lucide-react";
import { lazy, Suspense, useState } from "react";
import { Button } from "../../components/ui/button";
import { inputClass } from "../../components/form/styles";
import {
  useApplications,
  useCreateApplication,
  useDeleteApplication,
  useSetApplicationStatus,
} from "../../db/applications";
import { readStored, writeStored } from "../../lib/storage";
import { cn } from "../../lib/utils";
import { ApplicationForm } from "./ApplicationForm";
import { ApplicationsBoard } from "./ApplicationsBoard";

// Table or board, remembered in this browser
const VIEW_STORAGE = "applications.view";
type View = "table" | "board";
const readView = (): View => (readStored(VIEW_STORAGE) === "board" ? "board" : "table");

// The PDF renderer is large; it loads only when a saved resume is opened
const ResumePreview = lazy(() => import("../../ResumePreview"));

const getErrorMessage = (error: unknown) =>
  error instanceof Error ? error.message : String(error);

const formatDate = (iso: string | null) =>
  iso ? new Date(iso).toLocaleDateString(undefined, { dateStyle: "medium" }) : "—";

const Spinner = () => (
  <div className="flex justify-center p-8">
    <Loader2 className="animate-spin" aria-label="Loading" />
  </div>
);

const ApplicationsPage = () => {
  const applications = useApplications();
  const createApplication = useCreateApplication();
  const [adding, setAdding] = useState(false);
  const [view, setView] = useState(readView);
  const chooseView = (next: View) => {
    setView(next);
    writeStored(VIEW_STORAGE, next);
  };

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-4 p-4">
      <div className="flex flex-wrap items-center gap-2">
        <div className="mr-auto">
          <h1 className="text-lg font-semibold">Applications</h1>
          <p className="text-xs text-muted-foreground">
            Every change of status is recorded for the charts on the Stats page.
          </p>
        </div>
        <div role="group" aria-label="View" className="flex rounded-md border">
          {(
            [
              ["table", "Table", Table2],
              ["board", "Board", Columns3],
            ] as const
          ).map(([id, label, Icon]) => (
            <Button
              key={id}
              variant="ghost"
              size="sm"
              aria-pressed={view === id}
              className={cn("rounded-none first:rounded-l-md last:rounded-r-md", view === id && "bg-muted")}
              onClick={() => chooseView(id)}
            >
              <Icon /> {label}
            </Button>
          ))}
        </div>
        <Button
          variant={adding ? "ghost" : "default"}
          className="rounded-md"
          onClick={() => setAdding((open) => !open)}
        >
          {adding ? <X /> : <Plus />}
          {adding ? "Close" : "Add application"}
        </Button>
      </div>

      {adding && (
        <div className="rounded-lg border p-4">
          <ApplicationForm
            submitLabel="Add application"
            onSubmit={async (values) => {
              await createApplication.mutateAsync(values);
              setAdding(false);
            }}
          />
        </div>
      )}

      {applications.isPending ? (
        <Spinner />
      ) : applications.isError ? (
        <p role="alert" className="text-sm text-red-600 dark:text-red-400">
          Couldn't load your applications: {getErrorMessage(applications.error)}
        </p>
      ) : applications.data.length === 0 ? (
        <p className="rounded-lg border p-8 text-center text-sm text-muted-foreground">
          No applications yet. Add one here, or save one from the Resume page after generating a
          resume.
        </p>
      ) : view === "board" ? (
        <ApplicationsBoard applications={applications.data} />
      ) : (
        <ApplicationsTable applications={applications.data} />
      )}
    </div>
  );
};

export default ApplicationsPage;

const ApplicationsTable = ({ applications }: { applications: ApplicationRow[] }) => {
  const [openResume, setOpenResume] = useState<string | null>(null);
  const opened = applications.find((a) => a.id === openResume);

  return (
    <>
      <div className="overflow-x-auto rounded-lg border">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 text-left text-xs text-muted-foreground">
            <tr>
              <th className="px-3 py-2 font-medium">Company</th>
              <th className="px-3 py-2 font-medium">Job title</th>
              <th className="px-3 py-2 font-medium">Status</th>
              <th className="px-3 py-2 font-medium">Applied</th>
              <th className="px-3 py-2 font-medium">
                <span className="sr-only">Actions</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {applications.map((application) => (
              <ApplicationRowView
                key={application.id}
                application={application}
                onOpenResume={() => setOpenResume(application.id)}
              />
            ))}
          </tbody>
        </table>
      </div>
      {opened?.resume_snapshot && (
        <SavedResume
          title={`${opened.title} at ${opened.company}`}
          snapshot={opened.resume_snapshot as unknown as ResumeSnapshot}
          onClose={() => setOpenResume(null)}
        />
      )}
    </>
  );
};

const ApplicationRowView = ({
  application,
  onOpenResume,
}: {
  application: ApplicationRow;
  onOpenResume: () => void;
}) => {
  const setStatus = useSetApplicationStatus();
  const remove = useDeleteApplication();
  const [error, setError] = useState<string | null>(null);
  const label = `${application.title} at ${application.company}`;

  const onStatusChange = async (status: ApplicationStatus) => {
    setError(null);
    try {
      await setStatus.mutateAsync({ id: application.id, status });
    } catch (cause) {
      setError(`Status change failed: ${getErrorMessage(cause)}`);
    }
  };

  const onDelete = async () => {
    if (!window.confirm(`Delete ${label} and its history?`)) return;
    setError(null);
    try {
      await remove.mutateAsync(application.id);
    } catch (cause) {
      setError(`Delete failed: ${getErrorMessage(cause)}`);
    }
  };

  return (
    <tr className="border-t align-top">
      <td className="px-3 py-2 font-medium">{application.company}</td>
      <td className="px-3 py-2">
        {application.url ? (
          <a
            href={application.url}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1 underline-offset-2 hover:underline"
          >
            {application.title}
            <ExternalLink className="size-3" aria-hidden />
          </a>
        ) : (
          application.title
        )}
        {error && (
          <p role="alert" className="text-xs text-red-600 dark:text-red-400">
            {error}
          </p>
        )}
      </td>
      <td className="px-3 py-2">
        <select
          aria-label={`Status of ${label}`}
          className={cn(inputClass, "w-36")}
          value={application.status}
          disabled={setStatus.isPending}
          onChange={(event) => onStatusChange(event.target.value as ApplicationStatus)}
        >
          {APPLICATION_STATUSES.map((s) => (
            <option key={s} value={s}>
              {STATUS_LABELS[s]}
            </option>
          ))}
        </select>
      </td>
      <td className="px-3 py-2 whitespace-nowrap tabular-nums">{formatDate(application.applied_at)}</td>
      <td className="px-3 py-2">
        <div className="flex justify-end gap-1">
          {application.resume_snapshot !== null && (
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label={`Resume sent for ${label}`}
              onClick={onOpenResume}
            >
              <FileText />
            </Button>
          )}
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label={`Delete ${label}`}
            onClick={onDelete}
            disabled={remove.isPending}
          >
            <Trash2 />
          </Button>
        </div>
      </td>
    </tr>
  );
};

// Rebuilds the PDF from the snapshot saved with the application
const SavedResume = ({
  title,
  snapshot,
  onClose,
}: {
  title: string;
  snapshot: ResumeSnapshot;
  onClose: () => void;
}) => (
  <section aria-label={`Resume sent for ${title}`} className="flex flex-col gap-2">
    <div className="flex items-center justify-between">
      <h2 className="text-sm font-semibold">Resume sent for {title}</h2>
      <Button variant="ghost" size="sm" className="rounded-md" onClick={onClose}>
        <X /> Close
      </Button>
    </div>
    <div className="h-[calc(100vh-12rem)] min-h-96 overflow-hidden rounded-lg border">
      <Suspense fallback={<Spinner />}>
        <ResumePreview
          resume={snapshot.resume}
          summaryData={snapshot.summary}
          skillsData={snapshot.skills}
          mainExperienceData={snapshot.experienceBullets}
        />
      </Suspense>
    </div>
  </section>
);
