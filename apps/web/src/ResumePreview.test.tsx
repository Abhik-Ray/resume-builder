import { render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { DEFAULT_RESUME_DATA } from "./data/ResumeData";
import ResumePreview from "./ResumePreview";

vi.mock("@react-pdf/renderer", () => import("./test/reactPdfMock"));

describe("ResumePreview", () => {
  it("renders the resume document inside a full-size PDF viewer", () => {
    render(
      <ResumePreview
        resume={DEFAULT_RESUME_DATA}
        summaryData="Preview summary"
        mainExperienceData={["Bullet"]}
        skillsData={["React"]}
      />,
    );
    const viewer = screen.getByTestId("pdf-viewer");
    expect(viewer).toHaveClass("h-full", "w-full");
    expect(within(viewer).getByTestId("pdf-document")).toBeInTheDocument();
    expect(within(viewer).getByText("Preview summary")).toBeInTheDocument();
  });
});
