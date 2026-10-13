import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { fakeSupabase, renderWithRouter } from "../../test/utils";
import StatsPage from "./StatsPage";
import { fillDays, fillWeeks, todaysMatches } from "./weeks";

const seedStats = () => {
  fakeSupabase.seed("application_funnel", [
    { id: "f1", status: "saved", position: 1, applications: 5 },
    { id: "f2", status: "applied", position: 2, applications: 4 },
    { id: "f3", status: "interview", position: 4, applications: 1 },
  ]);
  fakeSupabase.seed("applications_weekly", [{ id: "w1", week: "2026-10-05", applications: 3 }]);
  fakeSupabase.seed("status_transitions", [
    { id: "t1", from_status: "applied", to_status: "rejected", transitions: 2 },
  ]);
  fakeSupabase.seed("response_stats", [
    { id: "r", applied: 4, responded: 2, response_rate: 0.5, median_days_to_response: 6.5 },
  ]);
  fakeSupabase.seed("match_stats", [
    { id: "m1", day: "2026-10-01", new_matches: 9, judged: 4, dismissed: 3 },
    { id: "m2", day: "2026-10-02", new_matches: 1, judged: 7, dismissed: 0 },
  ]);
};

describe("StatsPage", () => {
  it("shows the stat tiles, charts and transitions", async () => {
    seedStats();
    renderWithRouter(<StatsPage />, { path: "/stats" });

    expect(await screen.findByText("50%")).toBeInTheDocument();
    expect(screen.getByText("2 heard back")).toBeInTheDocument();
    expect(screen.getByText("6.5 d")).toBeInTheDocument();
    expect(screen.getByRole("img", { name: "Applied: 4 applications" })).toBeInTheDocument();
    const transitions = screen.getByRole("heading", { name: "Status changes" }).parentElement!;
    expect(within(transitions).getByText("Rejected")).toBeInTheDocument();
    expect(screen.getByText("Matches judged").nextSibling).toHaveTextContent("11");
    expect(screen.getByText("Matches dismissed").nextSibling).toHaveTextContent("3");
  });

  it("shows a tooltip on hover and a table view", async () => {
    seedStats();
    const user = userEvent.setup();
    renderWithRouter(<StatsPage />, { path: "/stats" });
    await user.hover(await screen.findByRole("img", { name: "Saved: 5 applications" }));
    expect(screen.getByRole("tooltip")).toHaveTextContent("5 applications · Saved");

    const funnel = screen.getByRole("figure", { name: "How far applications got" });
    await user.click(within(funnel).getByText("Show as table"));
    expect(within(funnel).getByRole("table", { name: "How far applications got" })).toBeInTheDocument();
  });

  it("works with no data yet", async () => {
    renderWithRouter(<StatsPage />, { path: "/stats" });
    expect(await screen.findByText("No status changes yet.")).toBeInTheDocument();
    expect(screen.getAllByText("—").length).toBeGreaterThan(0);
  });

  it("shows load errors", async () => {
    fakeSupabase.failNext("response_stats", "view missing");
    renderWithRouter(<StatsPage />, { path: "/stats" });
    expect(await screen.findByRole("alert")).toHaveTextContent("Couldn't load your stats: view missing");
  });
});

describe("fillWeeks", () => {
  it("returns the last 12 weeks with empty weeks as zero", () => {
    const weeks = fillWeeks(
      [
        { week: "2026-10-05", applications: 3 },
        { week: "2026-09-21", applications: 1 },
      ],
      new Date("2026-10-08T12:00:00Z"),
    );
    expect(weeks).toHaveLength(12);
    expect(weeks.at(-1)?.value).toBe(3);
    expect(weeks.at(-2)?.value).toBe(0);
    expect(weeks.at(-3)?.value).toBe(1);
    expect(weeks.slice(0, -3).every((w) => w.value === 0)).toBe(true);
  });
});

describe("fillDays and todaysMatches", () => {
  const rows = [
    { day: "2026-10-08", new_matches: 5, judged: 2, dismissed: 1 },
    { day: "2026-10-06", new_matches: 2, judged: 0, dismissed: 0 },
  ];
  const now = new Date("2026-10-08T18:00:00Z");

  it("returns the last 14 days with empty days as zero", () => {
    const days = fillDays(rows, now);
    expect(days).toHaveLength(14);
    expect(days.slice(-3).map((d) => d.value)).toEqual([2, 0, 5]);
  });

  it("reads today's new matches", () => {
    expect(todaysMatches(rows, now)).toBe(5);
    expect(todaysMatches(rows, new Date("2026-10-09T01:00:00Z"))).toBe(0);
  });
});

