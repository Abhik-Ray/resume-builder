import { describe, expect, it } from "vitest";
import { planQueries } from "./query";
import type { UserSearch } from "./types";

const search = (patch: Partial<UserSearch> = {}): UserSearch => ({
  userId: "u1",
  searchProfileId: "s1",
  keywords: ["React", "TypeScript"],
  excludeKeywords: [],
  minScore: 3,
  remoteOnly: false,
  includeRemote: false,
  country: "in",
  city: "Bengaluru",
  region: "Karnataka",
  radiusKm: 50,
  ...patch,
});

describe("planQueries", () => {
  it("builds a local query from the home location", () => {
    const [planned] = planQueries([search()]);
    expect(planned.query).toEqual({
      keywords: ["react", "typescript"],
      country: "IN",
      city: "Bengaluru",
      region: "Karnataka",
      radiusKm: 50,
      remote: false,
    });
  });

  it("adds a remote query without a location when include remote is on", () => {
    const queries = planQueries([search({ includeRemote: true })]).map((q) => q.query);
    expect(queries).toEqual([
      expect.objectContaining({ remote: false, city: "Bengaluru" }),
      { keywords: ["react", "typescript"], country: "IN", city: null, region: null, radiusKm: 0, remote: true },
    ]);
  });

  it("only searches remote for remote-only searches", () => {
    expect(planQueries([search({ remoteOnly: true })]).map((q) => q.query.remote)).toEqual([true]);
  });

  it("shares identical queries across users, whatever the keyword order or case", () => {
    const queries = planQueries([
      search({ userId: "u1", excludeKeywords: ["php"] }),
      search({ userId: "u2", searchProfileId: "s2", keywords: ["typescript", "react"] }),
      search({ userId: "u3", searchProfileId: "s3", city: "Pune" }),
    ]);
    expect(queries).toHaveLength(2);
    expect(queries[0].searches.map((s) => s.userId)).toEqual(["u1", "u2"]);
    expect(queries[1].searches.map((s) => s.userId)).toEqual(["u3"]);
  });

  it("shares remote queries between cities", () => {
    const queries = planQueries([
      search({ remoteOnly: true }),
      search({ userId: "u2", remoteOnly: true, city: "Pune" }),
    ]);
    expect(queries).toHaveLength(1);
  });

  it("skips searches without keywords", () => {
    expect(planQueries([search({ keywords: [" "] })])).toEqual([]);
  });
});
