import { describe, expect, it } from "vitest";
import { DEFAULT_RESUME_DATA } from "../data/ResumeData";
import { resumeFromProfile } from "./resumeData";

const custom = { ...DEFAULT_RESUME_DATA, currentRole: "Staff Engineer" };

describe("resumeFromProfile", () => {
  it("falls back to the defaults when nothing is saved", () => {
    expect(resumeFromProfile({ resume_data: null })).toEqual({
      data: DEFAULT_RESUME_DATA,
      isCustom: false,
    });
  });

  it("returns the saved data", () => {
    expect(resumeFromProfile({ resume_data: custom as never })).toEqual({
      data: custom,
      isCustom: true,
    });
  });
});
