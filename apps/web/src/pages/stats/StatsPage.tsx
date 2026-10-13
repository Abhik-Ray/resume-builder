import { STATUS_LABELS, type ApplicationStatus } from "@resume-builder/shared";
import { Loader2 } from "lucide-react";
import { ColumnChart, HorizontalBarChart } from "../../components/charts/BarChart";
import { formatDays, formatPercent } from "../../components/charts/format";
import { StatTile } from "../../components/charts/StatTile";
import { useStats, type TransitionRow } from "../../db/stats";
import { DAYS_SHOWN, fillDays, fillWeeks, WEEKS_SHOWN } from "./weeks";

const getErrorMessage = (error: unknown) =>
  error instanceof Error ? error.message : String(error);

const label = (status: ApplicationStatus | null) => (status ? STATUS_LABELS[status] : "—");

const StatsPage = () => {
  const stats = useStats();

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-4 p-4">
      <h1 className="text-lg font-semibold">Stats</h1>
      {stats.isPending ? (
        <div className="flex justify-center p-8">
          <Loader2 className="animate-spin" aria-label="Loading" />
        </div>
      ) : stats.isError ? (
        <p role="alert" className="text-sm text-red-600 dark:text-red-400">
          Couldn't load your stats: {getErrorMessage(stats.error)}
        </p>
      ) : (
        <>
          <div className="grid gap-3 sm:grid-cols-3">
            <StatTile label="Applied" value={String(stats.data.response?.applied ?? 0)} />
            <StatTile
              label="Response rate"
              value={formatPercent(stats.data.response?.response_rate)}
              note={`${stats.data.response?.responded ?? 0} heard back`}
            />
            <StatTile
              label="Median time to a response"
              value={formatDays(stats.data.response?.median_days_to_response)}
            />
          </div>
          <div className="grid gap-4 lg:grid-cols-2">
            <div className="rounded-lg border p-4">
              <HorizontalBarChart
                title="How far applications got"
                unit="applications"
                data={stats.data.funnel.map((row) => ({
                  label: label(row.status),
                  value: row.applications ?? 0,
                }))}
              />
            </div>
            <div className="rounded-lg border p-4">
              <ColumnChart
                title={`Applications per week (last ${WEEKS_SHOWN})`}
                unit="applications"
                data={fillWeeks(stats.data.weekly)}
              />
            </div>
          </div>
          <div className="grid gap-4 lg:grid-cols-2">
            <div className="rounded-lg border p-4">
              <ColumnChart
                title={`New job matches per day (last ${DAYS_SHOWN})`}
                unit="matches"
                data={fillDays(stats.data.matches)}
              />
            </div>
            <div className="grid content-start gap-3 sm:grid-cols-2">
              <StatTile
                label="Matches judged"
                value={String(stats.data.matches.reduce((sum, d) => sum + (d.judged ?? 0), 0))}
              />
              <StatTile
                label="Matches dismissed"
                value={String(stats.data.matches.reduce((sum, d) => sum + (d.dismissed ?? 0), 0))}
              />
            </div>
          </div>
          <TransitionsTable rows={stats.data.transitions} />
        </>
      )}
    </div>
  );
};

export default StatsPage;

// Stage flow as a ranked table: from → to and how often
const TransitionsTable = ({ rows }: { rows: TransitionRow[] }) => (
  <div className="rounded-lg border p-4">
    <h2 className="mb-2 text-sm font-semibold">Status changes</h2>
    {rows.length === 0 ? (
      <p className="text-xs text-muted-foreground">No status changes yet.</p>
    ) : (
      <table className="w-full text-xs">
        <thead className="text-left text-muted-foreground">
          <tr>
            <th className="py-1 font-medium">From</th>
            <th className="py-1 font-medium">To</th>
            <th className="py-1 text-right font-medium">Times</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={`${row.from_status}-${row.to_status}`} className="border-t">
              <td className="py-1">{label(row.from_status)}</td>
              <td className="py-1">{label(row.to_status)}</td>
              <td className="py-1 text-right tabular-nums">{row.transitions}</td>
            </tr>
          ))}
        </tbody>
      </table>
    )}
  </div>
);
