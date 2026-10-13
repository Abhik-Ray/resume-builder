import { describe, expect, it } from "vitest";
import { applicationInputSchema, APPLICATION_STATUSES, isActiveStatus } from "./applications";
import { Constants } from "./database";

describe("APPLICATION_STATUSES", () => {
  it("matches the database enum, in order", () => {
    expect(APPLICATION_STATUSES).toEqual(Constants.public.Enums.application_status);
  });

  it("treats only open statuses as active", () => {
    expect(APPLICATION_STATUSES.filter(isActiveStatus)).toEqual([
      "saved",
      "applied",
      "screening",
      "interview",
      "offer",
    ]);
  });
});

describe("applicationInputSchema", () => {
  const valid = { company: " Acme ", title: "Engineer", url: "", status: "applied" as const };

  it("trims text and turns an empty URL into null", () => {
    expect(applicationInputSchema.parse(valid)).toEqual({
      company: "Acme",
      title: "Engineer",
      url: null,
      status: "applied",
    });
  });

  it("keeps a valid URL", () => {
    expect(applicationInputSchema.parse({ ...valid, url: "https://jobs.example.com/1" }).url).toBe(
      "https://jobs.example.com/1",
    );
  });

  it.each([
    [{ company: " " }, "company", "Company is required"],
    [{ title: "" }, "title", "Job title is required"],
    [{ url: "jobs.example.com" }, "url", "Enter a full URL"],
  ])("rejects %o", (patch, path, message) => {
    const result = applicationInputSchema.safeParse({ ...valid, ...patch });
    expect(result.error?.issues.map((i) => [i.path.join("."), i.message])).toContainEqual([
      path,
      message,
    ]);
  });
});
