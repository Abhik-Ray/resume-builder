import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { fakeSupabase, renderWithRouter } from "../../test/utils";
import StatsPage from "./StatsPage";
import { fillWeeks } from "./weeks";

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
