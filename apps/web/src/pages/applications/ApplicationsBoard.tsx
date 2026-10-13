import {
  APPLICATION_STATUSES,
  STATUS_LABELS,
  type ApplicationRow,
  type ApplicationStatus,
} from "@resume-builder/shared";
import { useState } from "react";
import { inputClass } from "../../components/form/styles";
import { useSetApplicationStatus } from "../../db/applications";
import { cn } from "../../lib/utils";

const getErrorMessage = (error: unknown) =>
  error instanceof Error ? error.message : String(error);

const DRAG_TYPE = "application/x-application-id";

// Kanban: one column per status. Drag a card to change its status, or use its dropdown.
export const ApplicationsBoard = ({ applications }: { applications: ApplicationRow[] }) => {
  const setStatus = useSetApplicationStatus();
  const [dropTarget, setDropTarget] = useState<ApplicationStatus | null>(null);
  const [error, setError] = useState<string | null>(null);

  const move = async (id: string, status: ApplicationStatus) => {
    const application = applications.find((a) => a.id === id);
    if (!application || application.status === status) return;
    setError(null);
    try {
      await setStatus.mutateAsync({ id, status });
    } catch (cause) {
      setError(`Status change failed: ${getErrorMessage(cause)}`);
    }
  };

  return (
    <div className="flex flex-col gap-2">
      {error && (
        <p role="alert" className="text-xs text-red-600 dark:text-red-400">
          {error}
        </p>
      )}
      <div className="flex gap-3 overflow-x-auto pb-2">
        {APPLICATION_STATUSES.map((status) => {
          const cards = applications.filter((a) => a.status === status);
          return (
            <section
              key={status}
              aria-label={STATUS_LABELS[status]}
              data-drop-target={dropTarget === status || undefined}
              onDragOver={(event) => {
                if (!event.dataTransfer.types.includes(DRAG_TYPE)) return;
                event.preventDefault();
                setDropTarget(status);
              }}
              onDragLeave={() => setDropTarget((current) => (current === status ? null : current))}
              onDrop={(event) => {
                event.preventDefault();
                setDropTarget(null);
                const id = event.dataTransfer.getData(DRAG_TYPE);
                if (id) void move(id, status);
              }}
              className={cn(
                "flex w-56 shrink-0 flex-col gap-2 rounded-lg border bg-muted/30 p-2",
                dropTarget === status && "border-primary bg-muted",
              )}
            >
              <h2 className="flex items-center justify-between px-1 text-xs font-semibold">
                {STATUS_LABELS[status]}
                <span className="font-normal text-muted-foreground">{cards.length}</span>
              </h2>
              {cards.map((application) => (
                <BoardCard key={application.id} application={application} onMove={move} />
              ))}
            </section>
          );
        })}
      </div>
    </div>
  );
};

const BoardCard = ({
  application,
  onMove,
}: {
  application: ApplicationRow;
  onMove: (id: string, status: ApplicationStatus) => Promise<void>;
}) => {
  const label = `${application.title} at ${application.company}`;
  return (
    <article
      aria-label={label}
      draggable
      onDragStart={(event) => {
        event.dataTransfer.setData(DRAG_TYPE, application.id);
        event.dataTransfer.effectAllowed = "move";
      }}
      className="flex cursor-grab flex-col gap-1 rounded-md border bg-background p-2 text-xs active:cursor-grabbing"
    >
      <span className="font-medium">{application.company}</span>
      <span className="text-muted-foreground">{application.title}</span>
      {/* The keyboard and touch way to move a card */}
      <select
        aria-label={`Status of ${label}`}
        className={cn(inputClass, "h-7 text-xs")}
        value={application.status}
        onChange={(event) => void onMove(application.id, event.target.value as ApplicationStatus)}
      >
        {APPLICATION_STATUSES.map((s) => (
          <option key={s} value={s}>
            {STATUS_LABELS[s]}
          </option>
        ))}
      </select>
    </article>
  );
};
