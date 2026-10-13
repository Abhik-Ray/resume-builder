import { isActiveStatus } from "@resume-builder/shared";
import { Link } from "react-router";
import { formatPercent } from "../components/charts/format";
import { StatTile } from "../components/charts/StatTile";
import { useApplications } from "../db/applications";
import { useStats } from "../db/stats";

const getErrorMessage = (error: unknown) =>
  error instanceof Error ? error.message : String(error);

const HomePage = () => {
  const applications = useApplications();
  const stats = useStats();
  const error = applications.error ?? stats.error;
  const active = applications.data?.filter((a) => isActiveStatus(a.status)).length;

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-4 p-4">
      <h1 className="text-lg font-semibold">Dashboard</h1>
      {error ? (
        <p role="alert" className="text-sm text-red-600 dark:text-red-400">
          Couldn't load your dashboard: {getErrorMessage(error)}
        </p>
      ) : (
        <div className="grid gap-3 sm:grid-cols-3">
          <StatTile label="Active applications" value={active === undefined ? "…" : String(active)} />
          <StatTile
            label="Response rate"
            value={stats.data ? formatPercent(stats.data.response?.response_rate) : "…"}
          />
          <StatTile
            label="Applied in total"
            value={stats.data ? String(stats.data.response?.applied ?? 0) : "…"}
          />
        </div>
      )}
      <p className="text-sm text-muted-foreground">
        Track applications on the{" "}
        <Link to="/applications" className="font-medium text-foreground underline">
          Applications
        </Link>{" "}
        page and see the trends on{" "}
        <Link to="/stats" className="font-medium text-foreground underline">
          Stats
        </Link>
        .
      </p>
    </div>
  );
};

export default HomePage;
