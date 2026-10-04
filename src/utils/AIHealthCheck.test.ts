import type { GoogleGenAI } from "@google/genai";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { MODELS } from "./models";

const { modelsGet } = vi.hoisted(() => ({ modelsGet: vi.fn() }));

vi.mock("@google/genai", () => ({
  GoogleGenAI: vi.fn(function (this: { models: unknown }) {
    this.models = { get: modelsGet };
  }),
}));

import { GoogleGenAI as MockGoogleGenAI } from "@google/genai";
import { verifyApiKey, verifyProviderKey } from "./AIHealthCheck";

const fakeClient = (get: () => Promise<unknown>) =>
  ({ models: { get } }) as unknown as GoogleGenAI;

describe("verifyApiKey", () => {
  beforeEach(() => {
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  it("reports a valid key when model metadata can be fetched", async () => {
    const get = vi.fn().mockResolvedValue({});
    await expect(verifyApiKey(fakeClient(get))).resolves.toEqual({
      status: "healthy",
      valid: true,
    });
    expect(get).toHaveBeenCalledWith({ model: MODELS.fast });
  });

  it("reports an invalid key with the reason when the call fails", async () => {
    const get = vi.fn().mockRejectedValue(new Error("API key not valid"));
    await expect(verifyApiKey(fakeClient(get))).resolves.toEqual({
      status: "unhealthy",
      valid: false,
      reason: "API key not valid",
    });
  });

  it("handles non-Error rejections", async () => {
    const get = vi.fn().mockRejectedValue("offline");
    const result = await verifyApiKey(fakeClient(get));
    expect(result).toMatchObject({ valid: false, reason: "offline" });
  });
});

describe("verifyProviderKey", () => {
  it("builds a Gemini client with the key and checks it", async () => {
    modelsGet.mockResolvedValue({});
    const result = await verifyProviderKey("gemini", "my-key");
    expect(MockGoogleGenAI).toHaveBeenCalledWith({ apiKey: "my-key" });
    expect(result).toMatchObject({ valid: true });
  });
});
