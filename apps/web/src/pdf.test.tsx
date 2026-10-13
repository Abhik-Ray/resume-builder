import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { DEFAULT_RESUME_DATA } from "./data/ResumeData";
import type { ResumeDataType } from "./types/input";
import { MyDocument } from "./pdf";

vi.mock("@react-pdf/renderer", () => import("./test/reactPdfMock"));

const resume: ResumeDataType = {
  ...DEFAULT_RESUME_DATA,
  profile: {
    name: "Jane Doe",
    contacts: ["jane@example.com", "+1 555 0100", "Remote"],
    education: { institute: "State University", degree: "BSc", field: "Computer Science" },
  },
  experience: [
    {
      companyName: "Acme",
      position: "Senior Dev",
      range: "2022 - Present",
      bullets: ["original acme bullet"],
      canTweak: true,
    },
    {
      companyName: "Initech",
      position: "Intern",
      range: "2021",
      bullets: ["Wrote TPS reports", "Fixed printers"],
    },
  ],
};

const renderDoc = () =>
  render(
    <MyDocument
      resume={resume}
      summaryData="Tailored summary"
      mainExperienceData={["Generated bullet 1", "Generated bullet 2"]}
      skillsData={["React", "TypeScript"]}
    />,
  );

describe("MyDocument", () => {
  it("sets the document metadata from the profile", () => {
    renderDoc();
    const doc = screen.getByTestId("pdf-document");
    expect(doc).toHaveAttribute("data-title", "Jane Doe Resume");
    expect(doc).toHaveAttribute("data-author", "Jane Doe");
    expect(screen.getByTestId("pdf-page")).toHaveAttribute("data-size", "A4");
  });

  it("renders the name in capitals and the contacts separated by bullets", () => {
    const { container } = renderDoc();
    expect(screen.getByText("JANE DOE")).toBeInTheDocument();
    expect(container).toHaveTextContent("jane@example.com • +1 555 0100 • Remote");
  });

  it("renders the generated summary", () => {
    renderDoc();
    expect(screen.getByText("Tailored summary")).toBeInTheDocument();
  });

  it("uses generated bullets only for the position the AI may rewrite", () => {
    const { container } = renderDoc();
    expect(container).toHaveTextContent("• Generated bullet 1 • Generated bullet 2");
    expect(container).not.toHaveTextContent("original acme bullet");
    expect(container).toHaveTextContent("• Wrote TPS reports • Fixed printers");
  });

  it("renders every position's company, title and dates", () => {
    renderDoc();
    for (const text of ["Acme,", "Senior Dev", "2022 - Present", "Initech,", "Intern", "2021"]) {
      expect(screen.getByText(text)).toBeInTheDocument();
    }
  });

  it("renders education and skills", () => {
    const { container } = renderDoc();
    expect(screen.getByText("State University")).toBeInTheDocument();
    expect(container).toHaveTextContent("BSc • Computer Science");
    expect(screen.getByText("• React")).toBeInTheDocument();
    expect(screen.getByText("• TypeScript")).toBeInTheDocument();
  });

  it("renders the section headings", () => {
    renderDoc();
    for (const heading of ["SUMMARY", "EXPERIENCE", "EDUCATION", "SKILLS"]) {
      expect(screen.getByText(heading)).toBeInTheDocument();
    }
  });
});
