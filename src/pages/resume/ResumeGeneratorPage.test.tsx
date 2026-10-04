import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { DEFAULT_RESUME_DATA, toUserData } from "../../data/ResumeData";
import { addApiKey } from "../../db/apiKeys";
import { saveResumeData } from "../../db/resumeData";
import { GEMINI_KEY, renderWithRouter, resetDb } from "../../test/utils";
import type { JudgeResponseType } from "../../utils/AIResumeJudge";
import ResumeGeneratorPage from "./ResumeGeneratorPage";

vi.mock("@google/genai", () => ({
  GoogleGenAI: vi.fn(function (this: { apiKey: string }, options: { apiKey: string }) {
    this.apiKey = options.apiKey;
  }),
}));
vi.mock("../../utils/AIHealthCheck", () => ({ verifyApiKey: vi.fn() }));
vi.mock("../../utils/AIResumeJudge", () => ({ judgeJobPosting: vi.fn() }));
vi.mock("../../utils/AIResumeBuilder", () => ({ generateResumeSection: vi.fn() }));
vi.mock("../../ResumePreview", () => ({
  default: (props: { summaryData: string; skillsData: string[]; mainExperienceData: string[] }) => (
    <div data-testid="preview">
      <p>{props.summaryData}</p>
      <p>{props.skillsData.join(", ")}</p>
      <p>{props.mainExperienceData.join(" | ")}</p>
    </div>
  ),
}));

import { GoogleGenAI } from "@google/genai";
import { verifyApiKey } from "../../utils/AIHealthCheck";
import { generateResumeSection } from "../../utils/AIResumeBuilder";
import { judgeJobPosting } from "../../utils/AIResumeJudge";

const verify = vi.mocked(verifyApiKey);
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
    verify.mockReset().mockResolvedValue({ status: "healthy", valid: true });
    judge.mockReset().mockResolvedValue(judgement);
    generate.mockReset().mockImplementation(async (_client, section) => SECTIONS[section] as never);
  });

  describe("without a key", () => {
    it("links to the API key settings and disables the review", async () => {
      const user = await setup();
      expect(screen.getByText(/No Gemini key saved/)).toBeInTheDocument();
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
      expect(screen.queryByText(/No Gemini key saved/)).not.toBeInTheDocument();
      // A single key needs no picker
      expect(screen.queryByLabelText("Gemini key")).not.toBeInTheDocument();
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
      await saveResumeData({ ...DEFAULT_RESUME_DATA, jobPreferences: preferences });
      const user = await setup();
      await reviewJob(user, "Senior React role");

      expect(await screen.findByText("Apply Immediately")).toBeInTheDocument();
      expect(GoogleGenAI).toHaveBeenCalledWith({ apiKey: GEMINI_KEY });
      expect(judge).toHaveBeenCalledWith(expect.anything(), "Senior React role", preferences);
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
      await saveResumeData(resume);
      const user = await setup();
      await reviewJob(user, "JD text");
      await user.click(await screen.findByRole("button", { name: "Generate resume" }));

      const preview = await screen.findByTestId("preview");
      expect(within(preview).getByText("Generated summary")).toBeInTheDocument();
      expect(within(preview).getByText("React, Vite")).toBeInTheDocument();
      expect(within(preview).getByText("Generated bullet")).toBeInTheDocument();
      for (const section of ["summary", "skills", "experience"]) {
        expect(generate).toHaveBeenCalledWith(expect.anything(), section, "JD text", toUserData(resume));
      }
      expect(currentStep()).toHaveTextContent("Resume");
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
      const picker = await screen.findByLabelText("Gemini key");
      expect(within(picker).getByRole("option", { selected: true })).toHaveTextContent("Personal");

      await user.selectOptions(picker, "Work");
      await reviewJob(user);
      await waitFor(() => expect(GoogleGenAI).toHaveBeenCalledWith({ apiKey: "work-key" }));
    });
  });
});
