import { describe, expect, it } from "vitest";
import { DEFAULT_RESUME_DATA } from "../../data/ResumeData";
import { resumeDataSchema, toFormValues, type ResumeFormValues } from "./resumeDataSchema";

const valid = () => structuredClone(toFormValues(DEFAULT_RESUME_DATA));

// Map of "dotted.path" -> message for a failing parse
const issuesOf = (values: ResumeFormValues) => {
  const result = resumeDataSchema.safeParse(values);
  if (result.success) return {};
  return Object.fromEntries(result.error.issues.map((i) => [i.path.join("."), i.message]));
};

describe("toFormValues", () => {
  it("fills optional fields so every input is controlled", () => {
    const values = toFormValues({
      ...DEFAULT_RESUME_DATA,
      experience: [{ companyName: "A", position: "P", range: "R", bullets: ["b"] }],
      jobPreferences: { ...DEFAULT_RESUME_DATA.jobPreferences, targetSalary: undefined },
    });
    expect(values.experience[0]).toMatchObject({ canTweak: false, projects: [] });
    expect(values.jobPreferences.targetSalary).toBe("");
  });
});

describe("resumeDataSchema", () => {
  it("accepts the default resume data", () => {
    expect(resumeDataSchema.safeParse(valid()).success).toBe(true);
  });

  it("trims text fields", () => {
    const values = valid();
    values.profile.name = "  Jane Doe  ";
    const result = resumeDataSchema.parse(values);
    expect(result.profile.name).toBe("Jane Doe");
  });

  it("requires text fields", () => {
    const values = valid();
    values.profile.name = "   ";
    values.profile.education.degree = "";
    values.currentRole = "";
    expect(issuesOf(values)).toMatchObject({
      "profile.name": "Name is required",
      "profile.education.degree": "Degree is required",
      currentRole: "Current role is required",
    });
  });

  it("limits text length", () => {
    const values = valid();
    values.profile.name = "x".repeat(101);
    expect(issuesOf(values)["profile.name"]).toMatch(/at most 100/);
  });

  describe("contacts", () => {
    it.each([
      "jane@example.com",
      "+91 98765 43210",
      "(555) 123-4567",
      "https://example.com/me",
      "Hyderabad, TG",
    ])("accepts %s", (contact) => {
      const values = valid();
      values.profile.contacts = [contact];
      expect(issuesOf(values)).toEqual({});
    });

    it.each([
      ["jane@", "Invalid email address"],
      ["+12", "Phone numbers need 7–15 digits"],
      ["https://", "Invalid URL"],
    ])("rejects %s", (contact, message) => {
      const values = valid();
      values.profile.contacts = [contact];
      expect(issuesOf(values)["profile.contacts.0"]).toBe(message);
    });

    it("needs at least one and at most eight", () => {
      const values = valid();
      values.profile.contacts = [];
      expect(issuesOf(values)["profile.contacts"]).toBe("Add at least one contact");
      values.profile.contacts = Array.from({ length: 9 }, (_, i) => `Place ${i}`);
      expect(issuesOf(values)["profile.contacts"]).toMatch(/At most 8/);
    });
  });

  it("validates years of experience", () => {
    const values = valid();
    for (const bad of ["abc", "3.555", "-1"]) {
      values.yearsOfExperience = bad;
      expect(issuesOf(values).yearsOfExperience).toMatch(/Enter a number/);
    }
    values.yearsOfExperience = "61";
    expect(issuesOf(values).yearsOfExperience).toBe("Must be 60 or less");
    values.yearsOfExperience = "3.5";
    expect(issuesOf(values).yearsOfExperience).toBeUndefined();
  });

  it("flags duplicate list entries case-insensitively", () => {
    const values = valid();
    values.hardSkills = ["React", "react"];
    expect(issuesOf(values)["hardSkills.1"]).toBe("Duplicate entry");
  });

  it("flags empty list entries and empty required lists", () => {
    const values = valid();
    values.featuredSkills = [];
    values.jobPreferences.coreTechStack = ["React", " "];
    expect(issuesOf(values)).toMatchObject({
      featuredSkills: "Add at least 1 skill",
      "jobPreferences.coreTechStack.1": "Technology is required",
    });
  });

  it("allows an empty deal-breaker list", () => {
    const values = valid();
    values.jobPreferences.dealBreakers = [];
    expect(issuesOf(values)).toEqual({});
  });

  it("allows only one position to be rewritten by the AI", () => {
    const values = valid();
    values.experience.forEach((p) => (p.canTweak = true));
    const issues = issuesOf(values);
    expect(issues["experience.0.canTweak"]).toBeUndefined();
    expect(issues["experience.1.canTweak"]).toBe("Only one position can be rewritten by the AI");
  });

  it("validates nested projects", () => {
    const values = valid();
    values.experience[0].projects = [{ projectName: "", tasks: [] }];
    expect(issuesOf(values)).toMatchObject({
      "experience.0.projects.0.projectName": "Project name is required",
      "experience.0.projects.0.tasks": "Add at least 1 task",
    });
  });

  it("only accepts known work models", () => {
    const values = valid();
    values.jobPreferences.preferredWorkModel = "Office" as never;
    expect(issuesOf(values)["jobPreferences.preferredWorkModel"]).toBeDefined();
  });
});
