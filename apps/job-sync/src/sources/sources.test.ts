import { describe, expect, it, vi } from "vitest";
import adzunaFixture from "../fixtures/adzuna.json";
import joobleFixture from "../fixtures/jooble.json";
import jsearchFixture from "../fixtures/jsearch.json";
import { SourceError, USER_AGENT, type SearchQuery } from "../types";
import { adzunaSource } from "./adzuna";
import { configuredSources } from ".";
import { joobleSource } from "./jooble";
import { jsearchSource } from "./jsearch";

const local: SearchQuery = {
  keywords: ["react", "typescript"],
  country: "IN",
  city: "Bengaluru",
  region: "Karnataka",
  radiusKm: 50,
  remote: false,
};
const remote: SearchQuery = { ...local, city: null, region: null, radiusKm: 0, remote: true };

const respond = (body: unknown, status = 200) =>
  vi.fn<typeof fetch>(
    async () => new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } }),
  );

const calledUrl = (fetchFn: ReturnType<typeof respond>) => new URL(String(fetchFn.mock.calls[0][0]));
const calledInit = (fetchFn: ReturnType<typeof respond>) => fetchFn.mock.calls[0][1] ?? {};

describe("Adzuna", () => {
  it("normalizes results", async () => {
    const fetchFn = respond(adzunaFixture);
    const jobs = await adzunaSource("id", "key", fetchFn).searchJobs(local);
    expect(jobs).toEqual([
      {
        source: "adzuna",
        externalId: "4401234567",
        company: "Acme Labs",
        title: "Senior React Developer",
        location: "Bengaluru, Karnataka",
        remote: false,
        url: "https://www.adzuna.in/land/ad/4401234567",
        description: "Build our TypeScript front end with React. Hybrid in Bengaluru.",
        postedAt: "2026-10-12T05:21:00Z",
      },
      expect.objectContaining({ externalId: "4401234568", company: "Unknown company", remote: true, description: null }),
    ]);
  });

  it("searches the home city within the radius", async () => {
    const fetchFn = respond(adzunaFixture);
    await adzunaSource("id", "key", fetchFn).searchJobs(local);
    const url = calledUrl(fetchFn);
    expect(url.pathname).toBe("/v1/api/jobs/in/search/1");
    expect(Object.fromEntries(url.searchParams)).toMatchObject({
      what_or: "react typescript",
      where: "Bengaluru",
      distance: "50",
    });
    expect(calledInit(fetchFn).headers).toMatchObject({ "User-Agent": USER_AGENT });
  });

  it("searches remote jobs without a location", async () => {
    const fetchFn = respond({ results: [] });
    await adzunaSource("id", "key", fetchFn).searchJobs(remote);
    const params = calledUrl(fetchFn).searchParams;
    expect(params.get("what_and")).toBe("remote");
    expect(params.has("where")).toBe(false);
  });

  it("refuses countries Adzuna doesn't cover", async () => {
    await expect(adzunaSource("id", "key", respond({})).searchJobs({ ...local, country: "AE" })).rejects.toThrow(
      "Adzuna doesn't cover AE",
    );
  });

  it("fails on HTTP errors without echoing the URL", async () => {
    const error = await adzunaSource("id", "secret-key", respond({ error: "x" }, 401))
      .searchJobs(local)
      .catch((e: unknown) => e);
    expect(error).toBeInstanceOf(SourceError);
    expect(String(error)).toContain("HTTP 401");
    expect(String(error)).not.toContain("secret-key");
  });

  it("explains network failures", async () => {
    const fetchFn = vi.fn<typeof fetch>(async () => {
      throw new TypeError("fetch failed", { cause: { code: "ENOTFOUND" } });
    });
    await expect(adzunaSource("id", "key", fetchFn).searchJobs(local)).rejects.toThrow(
      "Adzuna request failed: ENOTFOUND",
    );
  });

  it("fails when the response shape changes", async () => {
    await expect(
      adzunaSource("id", "key", respond({ results: [{ id: "1" }] })).searchJobs(local),
    ).rejects.toThrow(/didn't match the expected shape at results\.0\.title/);
  });
});

describe("Jooble", () => {
  it("normalizes results", async () => {
    const jobs = await joobleSource("key", respond(joobleFixture)).searchJobs(local);
    expect(jobs).toEqual([
      {
        source: "jooble",
        externalId: "-123456789",
        company: "Globex",
        title: "React.js Developer",
        location: "Bengaluru, Karnataka",
        remote: false,
        url: "https://jooble.org/desc/-123456789",
        description: "...looking for a React developer with Redux experience...",
        postedAt: "2026-10-12T00:00:00.0000000",
      },
      expect.objectContaining({ externalId: "987654321", company: "Unknown company", location: null, remote: true }),
    ]);
  });

  it("posts the keywords and location", async () => {
    const fetchFn = respond({ jobs: [] });
    await joobleSource("key", fetchFn).searchJobs(local);
    expect(calledUrl(fetchFn).pathname).toBe("/api/key");
    expect(JSON.parse(String(calledInit(fetchFn).body))).toMatchObject({
      keywords: "react typescript",
      location: "Bengaluru, Karnataka, India",
      radius: "50",
    });
  });
});

describe("JSearch", () => {
  it("normalizes results", async () => {
    const jobs = await jsearchSource("key", respond(jsearchFixture)).searchJobs(local);
    expect(jobs).toEqual([
      {
        source: "jsearch",
        externalId: "aBcD123==",
        company: "Initech",
        title: "React Developer",
        location: "Bengaluru, Karnataka, IN",
        remote: false,
        url: "https://careers.initech.example/jobs/1",
        description: "We use React, TypeScript and GraphQL.",
        postedAt: "2026-10-12T03:00:00.000Z",
      },
      expect.objectContaining({ externalId: "eFgH456==", remote: true, location: "IN", company: "Unknown company" }),
    ]);
  });

  it("sends the key in headers and the location in the query", async () => {
    const fetchFn = respond({ data: [] });
    await jsearchSource("key", fetchFn).searchJobs(local);
    expect(calledUrl(fetchFn).searchParams.get("query")).toBe("react typescript in Bengaluru, Karnataka");
    expect(calledUrl(fetchFn).search).not.toContain("key=");
    expect(calledInit(fetchFn).headers).toMatchObject({ "X-RapidAPI-Key": "key" });
  });

  it("asks for remote jobs only on remote searches", async () => {
    const fetchFn = respond({ data: [] });
    await jsearchSource("key", fetchFn).searchJobs(remote);
    expect(calledUrl(fetchFn).searchParams.get("remote_jobs_only")).toBe("true");
  });
});

describe("configuredSources", () => {
  it("uses only sources with credentials", () => {
    expect(configuredSources({}).map((s) => s.name)).toEqual([]);
    expect(configuredSources({ ADZUNA_APP_ID: "a", ADZUNA_APP_KEY: "b", RAPIDAPI_KEY: "c" }).map((s) => s.name)).toEqual([
      "adzuna",
      "jsearch",
    ]);
  });
});
