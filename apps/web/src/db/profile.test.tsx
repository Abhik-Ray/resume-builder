import { screen } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";
import { DEFAULT_RESUME_DATA } from "../data/ResumeData";
import {
  fakeSupabase,
  profileRow,
  renderWithRouter,
  resetDb,
  seedProfile,
  TEST_USER,
} from "../test/utils";
import { db } from "./db";
import { detailsToProfile, fetchProfile, updateProfile, useProfile } from "./profile";

const custom = { ...DEFAULT_RESUME_DATA, currentRole: "Staff Engineer" };

const home = {
  city: "Pune",
  region: "",
  country: "IN",
  searchRadiusKm: 30,
  includeRemote: false,
};

describe("fetchProfile", () => {
  beforeEach(resetDb);

  it("creates an empty profile on first sign-in", async () => {
    const profile = await fetchProfile(TEST_USER.id);
    expect(profile).toMatchObject({ user_id: TEST_USER.id, resume_data: null, search_radius_km: 50 });
    expect(fakeSupabase.rows("profiles")).toHaveLength(1);
  });

  it("imports resume data saved in this browser before sign-in", async () => {
    await db.resumeData.put({ id: "current", data: custom, updatedAt: 1 });
    expect((await fetchProfile(TEST_USER.id)).resume_data).toEqual(custom);
  });

  it("returns the existing profile without importing", async () => {
    seedProfile({ home_city: "Delhi" }, null);
    await db.resumeData.put({ id: "current", data: custom, updatedAt: 1 });
    const profile = await fetchProfile(TEST_USER.id);
    expect(profile).toMatchObject({ home_city: "Delhi", resume_data: null });
    expect(fakeSupabase.rows("profiles")).toHaveLength(1);
  });

  it("throws load errors", async () => {
    fakeSupabase.failNext("profiles", "network down");
    await expect(fetchProfile(TEST_USER.id)).rejects.toMatchObject({ message: "network down" });
  });

  it("fails without a signed-in user", async () => {
    fakeSupabase.reset({ signedIn: false });
    await expect(fetchProfile(TEST_USER.id)).rejects.toMatchObject({ code: "42501" });
  });
});

describe("updateProfile", () => {
  it("writes the patch and returns the row", async () => {
    seedProfile();
    const row = await updateProfile(TEST_USER.id, { home_city: "Mumbai" });
    expect(row.home_city).toBe("Mumbai");
    expect(profileRow()?.home_city).toBe("Mumbai");
  });

  it("throws when the row is missing", async () => {
    await expect(updateProfile(TEST_USER.id, { home_city: "Mumbai" })).rejects.toBeTruthy();
  });
});

describe("detailsToProfile", () => {
  it("splits the resume data from the home location and marks complete details", () => {
    const patch = detailsToProfile({ ...custom, home });
    expect(patch).toMatchObject({
      resume_data: custom,
      home_city: "Pune",
      home_region: null,
      home_country: "IN",
      search_radius_km: 30,
      include_remote: false,
    });
    expect(patch.details_completed_at).toEqual(expect.any(String));
  });

  it("leaves details_completed_at empty while something required is missing", () => {
    const noEmail = { ...custom, profile: { ...custom.profile, contacts: ["+91 98765 43210"] } };
    expect(detailsToProfile({ ...noEmail, home }).details_completed_at).toBeNull();
  });
});

describe("useProfile", () => {
  it("loads the signed-in user's profile", async () => {
    seedProfile({ home_city: "Chennai" });
    const City = () => <p>{useProfile().data?.home_city ?? "Loading"}</p>;
    renderWithRouter(<City />);
    expect(await screen.findByText("Chennai")).toBeInTheDocument();
  });
});
