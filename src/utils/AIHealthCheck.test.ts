import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { verifyProviderKey } from "./AIHealthCheck";
import { MODELS } from "./models";

const fetchMock = vi.fn<typeof fetch>();

const jsonResponse = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

const lastCall = () => {
  const [url, init] = fetchMock.mock.calls.at(-1)!;
  return { url: String(url), headers: init?.headers as Record<string, string> };
};

describe("verifyProviderKey", () => {
  beforeEach(() => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    fetchMock.mockReset().mockResolvedValue(jsonResponse(200, {}));
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it.each([
    [
      "gemini",
      `https://generativelanguage.googleapis.com/v1beta/models/${MODELS.gemini.fast}`,
      { "x-goog-api-key": "my-key" },
    ],
    ["openai", "https://api.openai.com/v1/models", { Authorization: "Bearer my-key" }],
    [
      "anthropic",
      "https://api.anthropic.com/v1/models",
      {
        "x-api-key": "my-key",
        "anthropic-version": "2023-06-01",
        "anthropic-dangerous-direct-browser-access": "true",
      },
    ],
  ] as const)("checks a %s key against its models endpoint", async (provider, url, headers) => {
    await expect(verifyProviderKey(provider, "my-key")).resolves.toEqual({
      status: "healthy",
      valid: true,
    });
    const call = lastCall();
    expect(call.url).toBe(url);
    expect(call.url).not.toContain("my-key");
    expect(call.headers).toEqual(headers);
  });

  it("reports a rejected key with the provider's message", async () => {
    fetchMock.mockResolvedValue(jsonResponse(401, { error: { message: "Invalid API key" } }));
    await expect(verifyProviderKey("openai", "bad")).resolves.toEqual({
      status: "unhealthy",
      valid: false,
      reason: "401: Invalid API key",
    });
  });

  it("falls back to the status when the error body isn't JSON", async () => {
    fetchMock.mockResolvedValue(new Response("nope", { status: 403, statusText: "Forbidden" }));
    const result = await verifyProviderKey("anthropic", "bad");
    expect(result).toMatchObject({ valid: false, reason: "403 Forbidden" });
  });

  it("reports network failures as invalid", async () => {
    fetchMock.mockRejectedValue(new TypeError("Failed to fetch"));
    const result = await verifyProviderKey("gemini", "k");
    expect(result).toMatchObject({ valid: false, reason: "Failed to fetch" });
  });

  it("never logs the key", async () => {
    const log = vi.mocked(console.error);
    fetchMock.mockResolvedValue(jsonResponse(401, { error: { message: "bad" } }));
    await verifyProviderKey("openai", "secret-key-123");
    expect(JSON.stringify(log.mock.calls)).not.toContain("secret-key-123");
  });
});
