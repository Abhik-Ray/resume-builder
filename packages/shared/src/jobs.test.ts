import { describe, expect, it } from "vitest";
import { Constants } from "./database";
import {
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
