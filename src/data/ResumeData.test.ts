import { describe, expect, it } from "vitest";
import type { ResumeDataType } from "../types/input";
import { DEFAULT_RESUME_DATA, getTweakableBullets, toUserData } from "./ResumeData";

const withExperience = (experience: ResumeDataType["experience"]): ResumeDataType => ({
  ...DEFAULT_RESUME_DATA,
  experience,
});

describe("DEFAULT_RESUME_DATA", () => {
  it("has exactly one position the AI may rewrite", () => {
    expect(DEFAULT_RESUME_DATA.experience.filter((p) => p.canTweak)).toHaveLength(1);
  });
});

describe("getTweakableBullets", () => {
  it("returns the bullets of the position marked canTweak", () => {
    const data = withExperience([
      { companyName: "A", position: "P", range: "R", bullets: ["fixed"] },
      { companyName: "B", position: "P", range: "R", bullets: ["tweak me"], canTweak: true },
    ]);
    expect(getTweakableBullets(data)).toEqual(["tweak me"]);
  });

  it("returns an empty list when no position can be rewritten", () => {
    const data = withExperience([
      { companyName: "A", position: "P", range: "R", bullets: ["fixed"] },
    ]);
    expect(getTweakableBullets(data)).toEqual([]);
  });
});

describe("toUserData", () => {
  it("copies the candidate fields the prompts use", () => {
    const userData = toUserData(DEFAULT_RESUME_DATA);
    expect(userData.currentRole).toBe(DEFAULT_RESUME_DATA.currentRole);
    expect(userData.yearsOfExperience).toBe(DEFAULT_RESUME_DATA.yearsOfExperience);
    expect(userData.requireRemote).toBe(DEFAULT_RESUME_DATA.requireRemote);
    expect(userData.hardSkills).toEqual(DEFAULT_RESUME_DATA.hardSkills);
  });

  it("flattens projects into work history tagged with their company", () => {
    const data = withExperience([
      {
        companyName: "Acme",
        position: "Dev",
        range: "R",
        bullets: [],
        projects: [
          { projectName: "One", tasks: ["t1"] },
          { projectName: "Two", tasks: ["t2", "t3"] },
        ],
      },
      { companyName: "NoProjects", position: "Dev", range: "R", bullets: [] },
    ]);
    expect(toUserData(data).rawWorkHistory).toEqual([
      { companyName: "Acme", projectName: "One", tasks: ["t1"] },
      { companyName: "Acme", projectName: "Two", tasks: ["t2", "t3"] },
    ]);
  });
});
