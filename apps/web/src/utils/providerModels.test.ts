import { afterEach, describe, expect, it, vi } from "vitest";
import { ANTHROPIC_KEY, GEMINI_KEY, OPENAI_KEY } from "../test/utils";
import { listProviderModels, mergeModelOptions } from "./providerModels";

const stubFetch = (body: unknown, status = 200) => {
  const fetchMock = vi.fn(async () => new Response(JSON.stringify(body), { status }));
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
};

describe("listProviderModels", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("keeps OpenAI's chat models and sends the key in a header", async () => {
    const fetchMock = stubFetch({
      data: [{ id: "gpt-6-luna" }, { id: "text-embedding-3-large" }, { id: "gpt-6-realtime" }, { id: "o5-mini" }, { id: "dall-e-4" }],
    });
    expect(await listProviderModels("openai", OPENAI_KEY)).toEqual([
      { id: "gpt-6-luna", label: "gpt-6-luna" },
      { id: "o5-mini", label: "o5-mini" },
    ]);
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).not.toContain(OPENAI_KEY);
    expect(init.headers).toEqual({ Authorization: `Bearer ${OPENAI_KEY}` });
  });

  it("uses Anthropic's display names with the browser header", async () => {
    const fetchMock = stubFetch({ data: [{ id: "claude-opus-5-5", display_name: "Claude Opus 5.5" }] });
    expect(await listProviderModels("anthropic", ANTHROPIC_KEY)).toEqual([
      { id: "claude-opus-5-5", label: "Claude Opus 5.5" },
    ]);
    const [, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(init.headers).toMatchObject({ "x-api-key": ANTHROPIC_KEY, "anthropic-dangerous-direct-browser-access": "true" });
  });

  it("keeps Gemini models that generate content", async () => {
    stubFetch({
      models: [
        { name: "models/gemini-3-pro", displayName: "Gemini 3 Pro", supportedGenerationMethods: ["generateContent"] },
        { name: "models/text-embedding-005", supportedGenerationMethods: ["embedContent"] },
        { name: "models/gemini-embedding", supportedGenerationMethods: ["embedContent"] },
      ],
    });
    expect(await listProviderModels("gemini", GEMINI_KEY)).toEqual([{ id: "gemini-3-pro", label: "Gemini 3 Pro" }]);
  });

  it("fails on HTTP errors", async () => {
    stubFetch({ error: { message: "bad key" } }, 401);
    await expect(listProviderModels("openai", OPENAI_KEY)).rejects.toThrow("The model list returned HTTP 401");
  });
});

describe("mergeModelOptions", () => {
  it("keeps the curated models first and adds the rest once", () => {
    expect(
      mergeModelOptions(
        [{ id: "a", label: "A (curated)" }],
        [
          { id: "a", label: "a" },
          { id: "b", label: "b" },
        ],
      ),
    ).toEqual([
      { id: "a", label: "A (curated)" },
      { id: "b", label: "b" },
    ]);
    expect(mergeModelOptions([{ id: "a", label: "A" }], undefined)).toEqual([{ id: "a", label: "A" }]);
  });
});
