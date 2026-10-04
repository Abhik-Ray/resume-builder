import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { JudgeResponseType } from "../../utils/AIResumeJudge";
import { JudgeResponse } from "./JudgeResponse";

const judgement: JudgeResponseType = {
  overallMatchScore: 76,
  matchAnalysis: "Strong React overlap.",
  pros: ["Fully remote", "React and TypeScript"],
  cons: ["Lower salary band"],
  isRemote: "Fully Remote very likely to work from India",
  redFlags: ["Vague responsibilities"],
  verdict: "Apply Immediately",
};

const section = (title: string) =>
  screen.getByRole("heading", { name: title }).closest("section") as HTMLElement;

describe("JudgeResponse", () => {
  it("shows the score, verdict and remote rating", () => {
    render(<JudgeResponse judgeResponse={judgement} />);
    expect(screen.getByText("76%")).toBeInTheDocument();
    expect(screen.getByText("Apply Immediately")).toBeInTheDocument();
    expect(screen.getByText(judgement.isRemote)).toBeInTheDocument();
  });

  it("shows the analysis and each list in its own card", () => {
    render(<JudgeResponse judgeResponse={judgement} />);
    expect(within(section("Match analysis")).getByText("Strong React overlap.")).toBeInTheDocument();

    const pros = within(section("Pros")).getAllByRole("listitem");
    expect(pros.map((li) => li.textContent)).toEqual(judgement.pros);
    expect(within(section("Cons")).getByText("Lower salary band")).toBeInTheDocument();
    expect(within(section("Red flags")).getByText("Vague responsibilities")).toBeInTheDocument();
  });

  it("shows placeholders for empty lists", () => {
    render(<JudgeResponse judgeResponse={{ ...judgement, pros: [], cons: [], redFlags: [] }} />);
    expect(within(section("Pros")).getByText("None found")).toBeInTheDocument();
    expect(within(section("Cons")).getByText("None found")).toBeInTheDocument();
    expect(within(section("Red flags")).getByText("No red flags found")).toBeInTheDocument();
  });
});
