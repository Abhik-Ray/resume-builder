import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { addApiKey } from "../../db/apiKeys";
import { fakeSupabase, GEMINI_KEY, renderWithRouter, resetDb, seedProfile, TEST_USER } from "../../test/utils";
import type { JudgeResponseType } from "../../utils/AIResumeJudge";
import JobsPage from "./JobsPage";

vi.mock("../../utils/AIHealthCheck", () => ({ verifyProviderKey: vi.fn() }));
vi.mock("../../utils/AIResumeJudge", () => ({ judgeJobPosting: vi.fn() }));

import { verifyProviderKey } from "../../utils/AIHealthCheck";
import { judgeJobPosting } from "../../utils/AIResumeJudge";

const verify = vi.mocked(verifyProviderKey);
const judge = vi.mocked(judgeJobPosting);

const verdict: JudgeResponseType = {
  overallMatchScore: 82,
  matchAnalysis: "Strong React fit.",
  pros: ["React"],
  cons: ["Long commute"],
  isRemote: "Hybrid",
  redFlags: [],
  verdict: "Apply Immediately",
};

const seedJobs = () => {
  fakeSupabase.seed("jobs", [
    { id: "j1", source: "adzuna", external_id: "1", company: "Acme", title: "React Developer", location: "Bengaluru", remote: false, url: "https://jobs.example/1", description: "React and TypeScript" },
    { id: "j2", source: "jooble", external_id: "2", company: "Globex", title: "Frontend Engineer", location: null, remote: true, url: "https://jobs.example/2", description: "Remote role" },
    { id: "j3", source: "jsearch", external_id: "3", company: "Initech", title: "UI Developer", location: "Pune", remote: false, url: "https://jobs.example/3", description: null },
  ]);
  fakeSupabase.seed("job_matches", [
    { user_id: TEST_USER.id, job_id: "j1", keyword_score: 4, created_at: "2026-10-12T01:00:00Z" },
    { user_id: TEST_USER.id, job_id: "j2", keyword_score: 3, created_at: "2026-10-12T02:00:00Z" },
    { user_id: TEST_USER.id, job_id: "j3", keyword_score: 3, state: "dismissed", created_at: "2026-10-11T00:00:00Z" },
    // Someone else's match isn't shown
    { user_id: "someone-else", job_id: "j3", keyword_score: 9 },
  ]);
  fakeSupabase.seed("sync_runs", [
    { id: 1, started_at: "2026-10-12T00:30:00Z", finished_at: "2026-10-12T00:32:00Z", matches_new: 14, jobs_seen: 50, jobs_new: 20, errors: [] },
  ]);
};

const card = (name: string) => screen.getByRole("listitem", { name });

const setup = async () => {
  const user = userEvent.setup();
  const view = renderWithRouter(<JobsPage />, {
    path: "/jobs",
    routes: [{ path: "/resume", element: <p>Resume page</p> }],
  });
  await screen.findByRole("heading", { name: "Jobs" });
  return { user, ...view };
};

describe("JobsPage", () => {
  beforeEach(async () => {
    await resetDb();
    seedProfile();
    verify.mockReset().mockResolvedValue({ status: "healthy", valid: true });
    judge.mockReset().mockResolvedValue(verdict);
  });

  it("lists new matches with the last sync", async () => {
    seedJobs();
    await setup();
    expect(await screen.findByText(/Last updated .*, 14 new matches/)).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "New (2)" })).toHaveAttribute("aria-selected", "true");
    expect(screen.getByRole("tab", { name: "Dismissed (1)" })).toBeInTheDocument();
    const items = screen.getAllByRole("listitem").map((li) => li.getAttribute("aria-label"));
    expect(items).toEqual(["Frontend Engineer at Globex", "React Developer at Acme"]);
    expect(within(card("Frontend Engineer at Globex")).getByText(/Globex · Remote ·/)).toBeInTheDocument();
  });

  it("flags postings that are no longer listed", async () => {
    seedJobs();
    fakeSupabase.seed("jobs", [
      { id: "j1", source: "adzuna", external_id: "1", company: "Acme", title: "React Developer", url: "https://jobs.example/1", closed_at: "2026-10-01T00:00:00Z" },
    ]);
    await setup();
    const acme = await screen.findByRole("listitem", { name: "React Developer at Acme" });
    expect(within(acme).getByText(/No longer listed since .*it may be closed/)).toBeInTheDocument();
    expect(within(card("Frontend Engineer at Globex")).queryByText(/No longer listed/)).not.toBeInTheDocument();
  });

  it("says when the job search hasn't run", async () => {
    await setup();
    expect(await screen.findByText("The daily job search hasn't run yet.")).toBeInTheDocument();
    expect(screen.getByText(/No new matches/)).toBeInTheDocument();
  });

  it("dismisses and restores a match", async () => {
    seedJobs();
    const { user } = await setup();
    await user.click(within(await screen.findByRole("listitem", { name: "React Developer at Acme" })).getByRole("button", { name: "Dismiss" }));
    await waitFor(() => expect(screen.queryByRole("listitem", { name: "React Developer at Acme" })).not.toBeInTheDocument());
    expect(fakeSupabase.rows("job_matches").find((m) => m.job_id === "j1" && m.user_id === TEST_USER.id)?.state).toBe("dismissed");

    await user.click(screen.getByRole("tab", { name: /Dismissed/ }));
    await user.click(within(card("React Developer at Acme")).getByRole("button", { name: "Back to new" }));
    await waitFor(() => expect(screen.getByRole("tab", { name: "New (2)" })).toBeInTheDocument());
  });

  it("marks a match applied and creates the application", async () => {
    seedJobs();
    const { user } = await setup();
    await user.click(within(await screen.findByRole("listitem", { name: "React Developer at Acme" })).getByRole("button", { name: "Mark applied" }));
    await waitFor(() => expect(screen.getByRole("tab", { name: "Applied (1)" })).toBeInTheDocument());
    expect(fakeSupabase.rows("applications")[0]).toMatchObject({
      company: "Acme",
      title: "React Developer",
      url: "https://jobs.example/1",
      job_id: "j1",
      status: "applied",
    });
  });

  it("opens the Resume page with the job", async () => {
    seedJobs();
    const { user, router } = await setup();
    await user.click(within(await screen.findByRole("listitem", { name: "React Developer at Acme" })).getByRole("button", { name: "Generate resume" }));
    expect(await screen.findByText("Resume page")).toBeInTheDocument();
    expect(router.state.location.state).toEqual({
      job: { jobId: "j1", title: "React Developer", company: "Acme", url: "https://jobs.example/1", description: "React and TypeScript" },
    });
  });

  it("judges new matches with the saved key and saves the verdicts", async () => {
    seedJobs();
    await addApiKey({ label: "Main", provider: "gemini", key: GEMINI_KEY });
    const { user } = await setup();
    await user.click(await screen.findByRole("button", { name: "Judge 2 new jobs" }));

    expect(await screen.findByText("All new jobs judged")).toBeInTheDocument();
    expect(verify).toHaveBeenCalledWith("gemini", GEMINI_KEY);
    expect(judge).toHaveBeenCalledTimes(2);
    expect(judge).toHaveBeenCalledWith(
      expect.objectContaining({ key: GEMINI_KEY }),
      "auto",
      expect.stringContaining("React and TypeScript"),
      expect.objectContaining({ preferredWorkModel: expect.any(String) }),
    );
    const mine = fakeSupabase.rows("job_matches").filter((m) => m.user_id === TEST_USER.id && m.state === "new");
    expect(mine.every((m) => (m.verdict as JudgeResponseType).verdict === "Apply Immediately")).toBe(true);
    expect(await screen.findAllByText(/· Apply Immediately/)).toHaveLength(2);
    expect(screen.queryByRole("button", { name: /Judge/ })).not.toBeInTheDocument();
  });

  it("stops when the key is rejected", async () => {
    seedJobs();
    verify.mockResolvedValue({ status: "unhealthy", valid: false, reason: "bad" });
    await addApiKey({ label: "Main", provider: "gemini", key: GEMINI_KEY });
    const { user } = await setup();
    await user.click(await screen.findByRole("button", { name: "Judge 2 new jobs" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Gemini servers unreachable or invalid key");
    expect(judge).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "Judge 2 new jobs" })).toBeEnabled();
  });

  it("reports jobs that couldn't be judged and keeps the rest", async () => {
    seedJobs();
    judge.mockResolvedValueOnce(verdict).mockRejectedValueOnce(new Error("quota exceeded"));
    await addApiKey({ label: "Main", provider: "gemini", key: GEMINI_KEY });
    const { user } = await setup();
    await user.click(await screen.findByRole("button", { name: "Judge 2 new jobs" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("1 couldn't be judged: quota exceeded");
    expect(await screen.findByRole("button", { name: "Judge 1 new jobs" })).toBeEnabled();
  });

  it("asks for a key before judging", async () => {
    seedJobs();
    await setup();
    expect(await screen.findByRole("link", { name: "Add an AI key" })).toHaveAttribute("href", "/settings/api-keys");
  });

  it("shows load errors", async () => {
    fakeSupabase.failNext("job_matches", "network down");
    await setup();
    expect(await screen.findByRole("alert")).toHaveTextContent("Couldn't load your matches: network down");
  });
});
