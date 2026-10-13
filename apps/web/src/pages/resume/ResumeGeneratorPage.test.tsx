import { cleanup, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { DEFAULT_RESUME_DATA, toUserData } from "../../data/ResumeData";
import { addApiKey } from "../../db/apiKeys";
import {
  ANTHROPIC_KEY,
  fakeSupabase,
  GEMINI_KEY,
  renderWithRouter,
  resetDb,
  seedProfile,
  TEST_USER,
} from "../../test/utils";
import type { JudgeResponseType } from "../../utils/AIResumeJudge";
import { MODELS } from "../../utils/models";
import { KEY_CHOICE_STORAGE, modelChoiceStorage } from "./aiChoice";
import ResumeGeneratorPage from "./ResumeGeneratorPage";

vi.mock("../../utils/AIHealthCheck", () => ({ verifyProviderKey: vi.fn() }));
vi.mock("../../utils/AIResumeJudge", () => ({ judgeJobPosting: vi.fn() }));
vi.mock("../../utils/AIResumeBuilder", () => ({ generateResumeSection: vi.fn() }));
vi.mock("../../utils/providerModels", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../utils/providerModels")>()),
  listProviderModels: vi.fn(async () => []),
}));
vi.mock("../../ResumePreview", () => ({
  default: (props: { summaryData: string; skillsData: string[]; mainExperienceData: string[] }) => (
    <div data-testid="preview">
      <p>{props.summaryData}</p>
      <p>{props.skillsData.join(", ")}</p>
      <p>{props.mainExperienceData.join(" | ")}</p>
    </div>
  ),
}));

import { verifyProviderKey } from "../../utils/AIHealthCheck";
import { listProviderModels } from "../../utils/providerModels";
import { generateResumeSection } from "../../utils/AIResumeBuilder";
import { judgeJobPosting } from "../../utils/AIResumeJudge";

const verify = vi.mocked(verifyProviderKey);
const judge = vi.mocked(judgeJobPosting);
const generate = vi.mocked(generateResumeSection);

const judgement: JudgeResponseType = {
  overallMatchScore: 85,
  matchAnalysis: "Great overlap.",
  pros: ["Remote"],
  cons: [],
  isRemote: "Fully Remote very likely to work from India",
  redFlags: [],
  verdict: "Apply Immediately",
};

const SECTIONS = {
  summary: { summary: "Generated summary" },
  skills: { technicalSkills: ["React", "Vite"] },
  experience: { bulletPoints: ["Generated bullet"] },
};

const setup = async () => {
  const user = userEvent.setup();
  renderWithRouter(<ResumeGeneratorPage />, {
    path: "/resume",
    routes: [{ path: "/settings/api-keys", element: <p>Keys page</p> }],
  });
  await screen.findByLabelText("Job description");
  return user;
};

const reviewJob = async (user: ReturnType<typeof userEvent.setup>, jd = "React role") => {
  await user.type(screen.getByLabelText("Job description"), jd);
  await user.click(screen.getByRole("button", { name: "Review job" }));
};

const currentStep = () =>
  screen.getAllByRole("listitem").find((li) => li.getAttribute("aria-current") === "step");

describe("ResumeGeneratorPage", () => {
  beforeEach(async () => {
    await resetDb();
    seedProfile();
    verify.mockReset().mockResolvedValue({ status: "healthy", valid: true });
    judge.mockReset().mockResolvedValue(judgement);
    vi.mocked(listProviderModels).mockReset().mockResolvedValue([]);
    generate
      .mockReset()
      .mockImplementation(async (_key, _model, section) => SECTIONS[section] as never);
  });

  describe("without a key", () => {
    it("links to the API key settings and disables the review", async () => {
      const user = await setup();
      expect(screen.getByText(/No AI key saved/)).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "Review job" })).toBeDisabled();

      await user.click(screen.getByRole("link", { name: "Add one in Settings" }));
      expect(screen.getByText("Keys page")).toBeInTheDocument();
    });
  });

  describe("with a key", () => {
    beforeEach(async () => {
      await addApiKey({ label: "Personal", provider: "gemini", key: GEMINI_KEY });
    });

    it("starts on the job description step", async () => {
      await setup();
      expect(screen.getByRole("heading", { name: "Resume" })).toBeInTheDocument();
      expect(currentStep()).toHaveTextContent("Job description");
      expect(screen.queryByText(/No AI key saved/)).not.toBeInTheDocument();
    });

    it("shows the key and its provider's models, defaulting to auto", async () => {
      await setup();
      expect(screen.getByLabelText("AI key")).toHaveDisplayValue("Personal · Gemini");
      const model = screen.getByLabelText("Model");
      expect(model).toHaveValue("auto");
      const options = within(model)
        .getAllByRole("option")
        .map((o) => o.getAttribute("value"));
      expect(options).toEqual(["auto", ...MODELS.gemini.options.map((m) => m.id)]);
    });

    it("asks for a job description first", async () => {
      const user = await setup();
      await user.type(screen.getByLabelText("Job description"), "   ");
      await user.click(screen.getByRole("button", { name: "Review job" }));
      expect(screen.getByRole("alert")).toHaveTextContent("Please enter a job description");
      expect(verify).not.toHaveBeenCalled();
    });

    it("reviews the job with the saved key and preferences", async () => {
      const preferences = { ...DEFAULT_RESUME_DATA.jobPreferences, careerGoals: "Lead a team" };
      seedProfile({}, { ...DEFAULT_RESUME_DATA, jobPreferences: preferences });
      const user = await setup();
      await reviewJob(user, "Senior React role");

      expect(await screen.findByText("Apply Immediately")).toBeInTheDocument();
      expect(verify).toHaveBeenCalledWith("gemini", GEMINI_KEY);
      expect(judge).toHaveBeenCalledWith(
        expect.objectContaining({ provider: "gemini", key: GEMINI_KEY }),
        "auto",
        "Senior React role",
        preferences,
      );
      expect(currentStep()).toHaveTextContent("Job review");
    });

    it("stays on the first step when the key is rejected", async () => {
      verify.mockResolvedValue({ status: "unhealthy", valid: false, reason: "bad" });
      const user = await setup();
      await reviewJob(user);

      expect(await screen.findByRole("alert")).toHaveTextContent(
        "Gemini servers unreachable or invalid key",
      );
      expect(judge).not.toHaveBeenCalled();
      expect(currentStep()).toHaveTextContent("Job description");
      expect(screen.getByRole("button", { name: "Review job" })).toBeEnabled();
    });

    it("shows review failures", async () => {
      judge.mockRejectedValue(new Error("quota exceeded"));
      const user = await setup();
      await reviewJob(user);
      expect(await screen.findByRole("alert")).toHaveTextContent("Job review failed: quota exceeded");
      expect(screen.getByRole("button", { name: "Review job" })).toBeEnabled();
    });

    it("generates the resume sections and shows the preview", async () => {
      const resume = { ...DEFAULT_RESUME_DATA, currentRole: "Tech Lead" };
      seedProfile({}, resume);
      const user = await setup();
      await reviewJob(user, "JD text");
      await user.click(await screen.findByRole("button", { name: "Generate resume" }));

      const preview = await screen.findByTestId("preview");
      expect(within(preview).getByText("Generated summary")).toBeInTheDocument();
      expect(within(preview).getByText("React, Vite")).toBeInTheDocument();
      expect(within(preview).getByText("Generated bullet")).toBeInTheDocument();
      for (const section of ["summary", "skills", "experience"]) {
        expect(generate).toHaveBeenCalledWith(
          expect.objectContaining({ key: GEMINI_KEY }),
          "auto",
          section,
          "JD text",
          toUserData(resume),
        );
      }
      // The key passed on review isn't checked again
      expect(verify).toHaveBeenCalledTimes(1);
      expect(currentStep()).toHaveTextContent("Resume");
    });

    it("uses a model picked on the review step for generation", async () => {
      const user = await setup();
      await reviewJob(user);
      await screen.findByRole("button", { name: "Generate resume" });
      await user.selectOptions(screen.getByLabelText("Model"), "gemini-2.5-pro");
      await user.click(screen.getByRole("button", { name: "Generate resume" }));

      await screen.findByTestId("preview");
      expect(judge).toHaveBeenCalledWith(expect.anything(), "auto", expect.anything(), expect.anything());
      expect(generate).toHaveBeenCalledWith(
        expect.anything(),
        "gemini-2.5-pro",
        "summary",
        expect.anything(),
        expect.anything(),
      );
    });

    it("remembers the model per provider", async () => {
      const user = await setup();
      await user.selectOptions(screen.getByLabelText("Model"), "gemini-2.5-flash");
      expect(localStorage.getItem(modelChoiceStorage("gemini"))).toBe("gemini-2.5-flash");
    });

    it("falls back to auto when the remembered model is no longer offered", async () => {
      localStorage.setItem(modelChoiceStorage("gemini"), "gemini-1.0-retired");
      await setup();
      expect(screen.getByLabelText("Model")).toHaveValue("auto");
    });

    it("labels the button differently for weak matches", async () => {
      judge.mockResolvedValue({ ...judgement, overallMatchScore: 40 });
      const user = await setup();
      await reviewJob(user);
      expect(
        await screen.findByRole("button", { name: "Generate resume anyway" }),
      ).toBeInTheDocument();
    });

    it("shows generation failures and stays on the review", async () => {
      generate.mockRejectedValue(new Error("model overloaded"));
      const user = await setup();
      await reviewJob(user);
      await user.click(await screen.findByRole("button", { name: "Generate resume" }));

      expect(await screen.findByRole("alert")).toHaveTextContent(
        "Resume generation failed: model overloaded",
      );
      expect(currentStep()).toHaveTextContent("Job review");
      expect(screen.getByRole("button", { name: "Generate resume" })).toBeEnabled();
    });

    it("goes back a step", async () => {
      const user = await setup();
      await reviewJob(user, "Keep me");
      await user.click(await screen.findByRole("button", { name: "Back" }));
      expect(currentStep()).toHaveTextContent("Job description");
      expect(screen.getByLabelText("Job description")).toHaveValue("Keep me");
    });

    it("starts over from scratch", async () => {
      const user = await setup();
      expect(screen.getByRole("button", { name: "Start over" })).toBeDisabled();
      await reviewJob(user, "Old JD");
      await user.click(await screen.findByRole("button", { name: "Start over" }));
      expect(currentStep()).toHaveTextContent("Job description");
      expect(screen.getByLabelText("Job description")).toHaveValue("");
    });
  });

  describe("with several keys", () => {
    beforeEach(async () => {
      await addApiKey({ label: "Personal", provider: "gemini", key: GEMINI_KEY });
      await addApiKey({ label: "Work", provider: "gemini", key: "work-key" });
    });

    it("defaults to the default key and lets you pick another", async () => {
      const user = await setup();
      const picker = screen.getByLabelText("AI key");
      expect(picker).toHaveDisplayValue("Personal · Gemini");

      await user.selectOptions(picker, "Work · Gemini");
      await reviewJob(user);
      await waitFor(() => expect(verify).toHaveBeenCalledWith("gemini", "work-key"));
      expect(localStorage.getItem(KEY_CHOICE_STORAGE)).toBe((picker as HTMLSelectElement).value);
    });
  });

  describe("with keys from several providers", () => {
    beforeEach(async () => {
      await addApiKey({ label: "Personal", provider: "gemini", key: GEMINI_KEY });
      await addApiKey({ label: "Claude", provider: "anthropic", key: ANTHROPIC_KEY });
    });

    it("switches the model list and uses the Anthropic key", async () => {
      const user = await setup();
      await user.selectOptions(screen.getByLabelText("AI key"), "Claude · Anthropic");
      const model = screen.getByLabelText("Model");
      expect(within(model).getAllByRole("option").map((o) => o.getAttribute("value"))).toEqual([
        "auto",
        ...MODELS.anthropic.options.map((m) => m.id),
      ]);
      await user.selectOptions(model, "claude-opus-5-5");
      await reviewJob(user, "JD");

      await screen.findByText("Apply Immediately");
      expect(verify).toHaveBeenCalledWith("anthropic", ANTHROPIC_KEY);
      expect(judge).toHaveBeenCalledWith(
        expect.objectContaining({ provider: "anthropic", key: ANTHROPIC_KEY }),
        "claude-opus-5-5",
        "JD",
        expect.anything(),
      );
    });

    it("re-verifies a key switched to after the review", async () => {
      const user = await setup();
      await reviewJob(user);
      await screen.findByRole("button", { name: "Generate resume" });
      await user.selectOptions(screen.getByLabelText("AI key"), "Claude · Anthropic");
      await user.click(screen.getByRole("button", { name: "Generate resume" }));

      await screen.findByTestId("preview");
      expect(verify).toHaveBeenLastCalledWith("anthropic", ANTHROPIC_KEY);
      expect(generate).toHaveBeenCalledWith(
        expect.objectContaining({ provider: "anthropic" }),
        "auto",
        "summary",
        expect.anything(),
        expect.anything(),
      );
    });

    it("stays on the review when the switched-to key fails", async () => {
      const user = await setup();
      await reviewJob(user);
      await screen.findByRole("button", { name: "Generate resume" });
      verify.mockResolvedValue({ status: "unhealthy", valid: false, reason: "bad" });
      await user.selectOptions(screen.getByLabelText("AI key"), "Claude · Anthropic");
      await user.click(screen.getByRole("button", { name: "Generate resume" }));

      expect(await screen.findByRole("alert")).toHaveTextContent(
        "Anthropic servers unreachable or invalid key",
      );
      expect(generate).not.toHaveBeenCalled();
      expect(screen.getByRole("button", { name: "Generate resume" })).toBeEnabled();
    });

    it("remembers the chosen key", async () => {
      const user = await setup();
      await user.selectOptions(screen.getByLabelText("AI key"), "Claude · Anthropic");
      cleanup();
      await setup();
      expect(screen.getByLabelText("AI key")).toHaveDisplayValue("Claude · Anthropic");
    });
  });

  describe("models from the account", () => {
    it("adds the key's own models to the picker, and remembers a pick", async () => {
      vi.mocked(listProviderModels).mockResolvedValue([
        { id: "gemini-2.5-flash", label: "dup" },
        { id: "gemini-3-pro", label: "Gemini 3 Pro" },
      ]);
      await addApiKey({ label: "Main", provider: "gemini", key: GEMINI_KEY });
      const user = await setup();
      const option = await screen.findByRole("option", { name: "Gemini 3 Pro" });
      expect(screen.getAllByRole("option", { name: /Gemini 2.5 Flash|dup/ })).toHaveLength(1);
      await user.selectOptions(screen.getByLabelText("Model"), option);
      expect(screen.getByLabelText("Model")).toHaveValue("gemini-3-pro");
      expect(listProviderModels).toHaveBeenCalledWith("gemini", GEMINI_KEY);
    });

    it("falls back to the defaults when the list can't be loaded", async () => {
      vi.mocked(listProviderModels).mockRejectedValue(new Error("offline"));
      await addApiKey({ label: "Main", provider: "gemini", key: GEMINI_KEY });
      await setup();
      expect(await screen.findByText(/Couldn't load your account's model list/)).toBeInTheDocument();
      expect(screen.getByRole("option", { name: "Gemini 2.5 Pro" })).toBeInTheDocument();
    });
  });

  describe("save as application", () => {
    it("saves the job with the generated resume", async () => {
      await addApiKey({ label: "Main", provider: "gemini", key: GEMINI_KEY });
      const user = await setup();
      await reviewJob(user, "JD text");
      await user.click(await screen.findByRole("button", { name: "Generate resume" }));
      await screen.findByTestId("preview");

      const form = screen.getByRole("region", { name: "Save as application" });
      await user.type(within(form).getByLabelText("Company"), "Acme");
      await user.type(within(form).getByLabelText("Job title"), "Frontend Engineer");
      await user.click(within(form).getByRole("button", { name: "Save as application" }));

      expect(await screen.findByRole("link", { name: "applications" })).toHaveAttribute(
        "href",
        "/applications",
      );
      expect(fakeSupabase.rows("applications")[0]).toMatchObject({
        company: "Acme",
        title: "Frontend Engineer",
        status: "applied",
        jd_text: "JD text",
        resume_snapshot: {
          resume: DEFAULT_RESUME_DATA,
          summary: "Generated summary",
          skills: ["React", "Vite"],
          experienceBullets: ["Generated bullet"],
        },
      });
    });
  });

  describe("from a job match", () => {
    const job = {
      jobId: "j1",
      title: "React Developer",
      company: "Acme",
      url: "https://jobs.example/1",
      description: "React and TypeScript role",
    };

    it("fills in the job and links the saved application to the match", async () => {
      fakeSupabase.seed("job_matches", [{ user_id: TEST_USER.id, job_id: "j1" }]);
      await addApiKey({ label: "Main", provider: "gemini", key: GEMINI_KEY });
      const user = userEvent.setup();
      const { router } = renderWithRouter(<ResumeGeneratorPage />, { path: "/resume" });
      await router.navigate("/resume", { state: { job } });

      expect(await screen.findByLabelText("Job description")).toHaveValue("React and TypeScript role");
      expect(screen.getByRole("link", { name: "open the posting" })).toHaveAttribute("href", job.url);
      await user.click(screen.getByRole("button", { name: "Review job" }));
      await user.click(await screen.findByRole("button", { name: "Generate resume" }));
      await screen.findByTestId("preview");

      const form = screen.getByRole("region", { name: "Save as application" });
      expect(within(form).getByLabelText("Company")).toHaveValue("Acme");
      expect(within(form).getByLabelText("Job title")).toHaveValue("React Developer");
      await user.click(within(form).getByRole("button", { name: "Save as application" }));

      expect(await screen.findByRole("link", { name: "applications" })).toBeInTheDocument();
      expect(fakeSupabase.rows("applications")[0]).toMatchObject({ job_id: "j1", url: job.url });
      expect(fakeSupabase.rows("job_matches")[0].state).toBe("applied");
    });
  });

  describe("details gate", () => {
    it("asks for missing details and links to the Details page", async () => {
      seedProfile({ home_city: null }, null);
      const user = userEvent.setup();
      const { router } = renderWithRouter(<ResumeGeneratorPage />, {
        path: "/resume",
        routes: [{ path: "/settings/resume-data", element: <p>Details page</p> }],
      });
      expect(
        await screen.findByRole("heading", { name: "Finish your details to generate resumes" }),
      ).toBeInTheDocument();
      expect(screen.getByText(/Still needed: Name, .*Home city/)).toBeInTheDocument();
      expect(screen.queryByLabelText("Job description")).not.toBeInTheDocument();

      await user.click(screen.getByRole("link", { name: "Go to Details" }));
      expect(await screen.findByText("Details page")).toBeInTheDocument();
      expect(router.state.location.search).toBe("?from=/resume");
    });

    it("shows profile load errors", async () => {
      fakeSupabase.failNext("profiles", "network down");
      renderWithRouter(<ResumeGeneratorPage />, { path: "/resume" });
      expect(await screen.findByRole("alert")).toHaveTextContent(
        "Couldn't load your details: network down",
      );
    });
  });
});

