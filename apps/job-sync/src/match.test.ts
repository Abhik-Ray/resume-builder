import { describe, expect, it } from "vitest";
import { boardLocationMatches, dedupeJobs, matchesSearch, scoreJob } from "./match";
import type { NormalizedJob, UserSearch } from "./types";

const job = (patch: Partial<NormalizedJob> = {}): NormalizedJob => ({
  source: "adzuna",
  externalId: "1",
  company: "Acme",
  title: "React Developer",
  location: "Bengaluru",
  remote: false,
  url: "https://example.com/1",
  description: "TypeScript and GraphQL",
  postedAt: null,
  ...patch,
});

const search = (patch: Partial<UserSearch> = {}): UserSearch => ({
  userId: "u1",
  searchProfileId: "s1",
  keywords: ["react", "typescript"],
  excludeKeywords: [],
  minScore: 3,
  remoteOnly: false,
  includeRemote: true,
  country: "IN",
  city: "Bengaluru",
  region: null,
  radiusKm: 50,
  ...patch,
});

describe("scoreJob", () => {
  it.each([
    ["title keyword and description keyword", {}, {}, 4],
    ["both in the title", { title: "React TypeScript Engineer" }, {}, 6],
    ["description only", { title: "Engineer" }, {}, 1],
    ["no keywords", { title: "Chef", description: "Cooking" }, {}, 0],
    ["no description", { description: null }, {}, 3],
    ["whole words only", { title: "Reactive Developer", description: "typescripts" }, {}, 0],
    ["case-insensitive", { title: "REACT developer" }, {}, 4],
    ["keywords with punctuation", { title: "Node.js developer" }, { keywords: ["node.js"] }, 3],
    ["an exclude keyword in the title", { title: "React PHP Developer" }, { excludeKeywords: ["php"] }, null],
    ["an exclude keyword in the description", {}, { excludeKeywords: ["graphql"] }, null],
    ["remote-only search, office job", {}, { remoteOnly: true }, null],
    ["remote-only search, remote job", { remote: true }, { remoteOnly: true }, 4],
  ] satisfies [string, Partial<NormalizedJob>, Partial<UserSearch>, number | null][])(
    "%s",
    (_, jobPatch, searchPatch, expected) => {
      expect(scoreJob(job(jobPatch), search(searchPatch))).toBe(expected);
    },
  );
});

describe("matchesSearch", () => {
  it("applies the minimum score", () => {
    expect(matchesSearch(job(), search({ minScore: 4 }))).toBe(4);
    expect(matchesSearch(job(), search({ minScore: 5 }))).toBeNull();
  });
});

describe("dedupeJobs", () => {
  it("drops repeats by id and the same posting from another source", () => {
    const jobs = dedupeJobs([
      job(),
      job(),
      job({ source: "jooble", externalId: "x", company: "ACME", title: "React developer!" }),
      job({ externalId: "2", title: "Vue Developer" }),
    ]);
    expect(jobs.map((j) => `${j.source}:${j.externalId}`)).toEqual(["adzuna:1", "adzuna:2"]);
  });
});

describe("boardLocationMatches", () => {
  it.each([
    ["in the search's city", { location: "Bengaluru, India" }, {}, true],
    ["in another city", { location: "Berlin" }, {}, false],
    ["with no location", { location: null }, {}, false],
    ["remote, remote wanted", { remote: true, location: "Anywhere" }, { includeRemote: true }, true],
    ["remote, remote not wanted", { remote: true, location: "Anywhere" }, { includeRemote: false }, false],
    ["remote, remote-only search", { remote: true }, { remoteOnly: true, includeRemote: false }, true],
    ["in the city, remote-only search", { location: "Bengaluru" }, { remoteOnly: true }, false],
  ] satisfies [string, Partial<NormalizedJob>, Partial<UserSearch>, boolean][])("%s", (_, jobPatch, searchPatch, expected) => {
    expect(boardLocationMatches(job(jobPatch), search(searchPatch))).toBe(expected);
  });
});
