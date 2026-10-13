import { describe, expect, it } from "vitest";
import { Constants } from "./database";
import {
  parseBoard,
  watchedCompanySchema,
  MATCH_STATES,
  searchProfileSchema,
  toSearchProfileColumns,
  toSearchProfileFormValues,
} from "./jobs";

const valid = {
  name: "React roles",
  keywords: ["react", "typescript"],
  excludeKeywords: ["php"],
  locationOverride: "",
  remoteOnly: false,
  minScore: 3,
  active: true,
};

describe("MATCH_STATES", () => {
  it("matches the database enum", () => {
    expect(MATCH_STATES).toEqual(Constants.public.Enums.match_state);
  });
});

describe("searchProfileSchema", () => {
  it("accepts a search", () => {
    expect(searchProfileSchema.safeParse(valid).success).toBe(true);
  });

  it.each([
    [{ name: " " }, "name", "Name is required"],
    [{ keywords: [] }, "keywords", "Add at least 1 keyword"],
    [{ keywords: ["react", "React"] }, "keywords.1", "Duplicate entry"],
    [{ excludeKeywords: [""] }, "excludeKeywords.0", "Keyword is required"],
    [{ minScore: Number.NaN }, "minScore", "Enter a number"],
    [{ minScore: 0 }, "minScore", "At least 1"],
  ])("rejects %o", (patch, path, message) => {
    const result = searchProfileSchema.safeParse({ ...valid, ...patch });
    expect(result.error?.issues.map((i) => [i.path.join("."), i.message])).toContainEqual([
      path,
      message,
    ]);
  });
});

describe("column mapping", () => {
  it("round-trips through the form values", () => {
    const columns = toSearchProfileColumns(searchProfileSchema.parse(valid));
    expect(columns).toEqual({
      name: "React roles",
      keywords: ["react", "typescript"],
      exclude_keywords: ["php"],
      location_override: null,
      remote_only: false,
      min_score: 3,
      active: true,
    });
  });

  it("starts a new search with one empty keyword", () => {
    expect(toSearchProfileFormValues()).toMatchObject({ keywords: [""], minScore: 3, active: true });
  });
});

describe("parseBoard", () => {
  it.each([
    ["acme", "greenhouse", { provider: "greenhouse", board: "acme" }],
    ["https://boards.greenhouse.io/acme", "lever", { provider: "greenhouse", board: "acme" }],
    ["https://job-boards.greenhouse.io/acme/jobs/123", "lever", { provider: "greenhouse", board: "acme" }],
    ["jobs.lever.co/Globex", "greenhouse", { provider: "lever", board: "globex" }],
    ["https://jobs.lever.co/globex/abc-123", "greenhouse", { provider: "lever", board: "globex" }],
    ["two words", "lever", null],
    ["https://example.com/acme/jobs", "lever", { provider: "lever", board: "acme" }],
  ] as const)("%s", (value, fallback, expected) => {
    expect(parseBoard(value, fallback)).toEqual(expected);
  });
});

describe("watchedCompanySchema", () => {
  it("turns a board URL into the provider and token", () => {
    expect(
      watchedCompanySchema.parse({ name: " Acme ", provider: "lever", board: "https://boards.greenhouse.io/acme" }),
    ).toEqual({ name: "Acme", provider: "greenhouse", board: "acme" });
  });

  it("rejects something that isn't a board", () => {
    const result = watchedCompanySchema.safeParse({ name: "Acme", provider: "lever", board: "not a board!" });
    expect(result.error?.issues[0]).toMatchObject({
      path: ["board"],
      message: "Use the board's URL or its name, e.g. acme",
    });
  });
});
