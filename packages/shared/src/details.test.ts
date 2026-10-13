import { describe, expect, it } from "vitest";
import { detailsSchema, homeLocationSchema, toDetailsFormValues } from "./details";
import { missingDetails } from "./detailsCheck";
import type { ResumeDataType } from "./resumeData";

const resume: ResumeDataType = {
  profile: {
    name: "Ada Lovelace",
    contacts: ["ada@example.com", "+44 20 7946 0000"],
    education: { institute: "University", degree: "BSc", field: "Mathematics" },
  },
  currentRole: "Engineer",
  yearsOfExperience: "5",
  requireRemote: false,
  summary: "Writes programs.",
  hardSkills: ["TypeScript"],
  featuredSkills: ["TypeScript"],
  experience: [{ companyName: "Engines", position: "Engineer", range: "2020 - Present", bullets: ["Built it"] }],
  jobPreferences: {
    desiredRoles: ["Engineer"],
    preferredWorkModel: "Remote",
    coreTechStack: ["TypeScript"],
    dealBreakers: [],
    careerGoals: "Lead a team",
  },
};

const complete = { resume_data: resume, home_city: "Pune", home_country: "IN" };

describe("missingDetails", () => {
  it("is empty for a complete profile", () => {
    expect(missingDetails(complete)).toEqual([]);
  });

  it("lists everything for a missing or blank profile", () => {
    const all = [
      "Name",
      "Contact email",
      "Current role",
      "At least one position",
      "Home city",
      "Home country",
    ];
    expect(missingDetails(undefined)).toEqual(all);
    expect(missingDetails({ resume_data: null, home_city: null, home_country: null })).toEqual(all);
  });

  it("needs an email among the contacts", () => {
    const noEmail = { ...resume, profile: { ...resume.profile, contacts: ["+44 20 7946 0000"] } };
    expect(missingDetails({ ...complete, resume_data: noEmail })).toEqual(["Contact email"]);
  });

  it("treats whitespace as missing", () => {
    expect(
      missingDetails({ ...complete, resume_data: { ...resume, currentRole: "  " }, home_city: " " }),
    ).toEqual(["Current role", "Home city"]);
  });

  it("needs at least one position", () => {
    expect(missingDetails({ ...complete, resume_data: { ...resume, experience: [] } })).toEqual([
      "At least one position",
    ]);
  });
});

describe("homeLocationSchema", () => {
  const valid = { city: "Pune", region: "", country: "in", searchRadiusKm: 50, includeRemote: true };

  it("accepts a location and upper-cases the country", () => {
    expect(homeLocationSchema.parse(valid)).toEqual({ ...valid, country: "IN" });
  });

  it.each([
    [{ city: " " }, "city", "City is required"],
    [{ country: "India" }, "country", "Use the two-letter country code, e.g. IN"],
    [{ searchRadiusKm: Number.NaN }, "searchRadiusKm", "Enter a number"],
    [{ searchRadiusKm: 0 }, "searchRadiusKm", "At least 1 km"],
    [{ searchRadiusKm: 501 }, "searchRadiusKm", "At most 500 km"],
    [{ searchRadiusKm: 2.5 }, "searchRadiusKm", "Use whole kilometres"],
  ])("rejects %o", (patch, path, message) => {
    const result = homeLocationSchema.safeParse({ ...valid, ...patch });
    expect(result.success).toBe(false);
    expect(result.error?.issues.map((i) => [i.path.join("."), i.message])).toContainEqual([
      path,
      message,
    ]);
  });
});

describe("toDetailsFormValues", () => {
  it("fills the home location from the profile", () => {
    const values = toDetailsFormValues(resume, {
      home_city: "Pune",
      home_region: null,
      home_country: "IN",
      search_radius_km: 25,
      include_remote: false,
    });
    expect(values.home).toEqual({
      city: "Pune",
      region: "",
      country: "IN",
      searchRadiusKm: 25,
      includeRemote: false,
    });
    expect(detailsSchema.safeParse(values).success).toBe(true);
  });

  it("uses the defaults without a profile", () => {
    expect(toDetailsFormValues(resume, null).home).toEqual({
      city: "",
      region: "",
      country: "",
      searchRadiusKm: 50,
      includeRemote: true,
    });
  });
});
