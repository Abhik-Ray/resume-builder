import { describe, expect, it, vi } from "vitest";

// Each factory returns a provider function that labels the model it builds
const { factory } = vi.hoisted(() => ({
  factory: (name: string) =>
    vi.fn((settings: object) => (modelId: string) => ({ provider: name, settings, modelId })),
}));

vi.mock("@ai-sdk/google", () => ({ createGoogle: factory("google") }));
vi.mock("@ai-sdk/openai", () => ({ createOpenAI: factory("openai") }));
vi.mock("@ai-sdk/anthropic", () => ({ createAnthropic: factory("anthropic") }));

import { getModel, temperatureFor } from "./aiModel";
import { MODELS } from "./models";

describe("getModel", () => {
  it("builds a Gemini model with the key", () => {
    expect(getModel({ provider: "gemini", key: "g" }, "auto", "fast")).toEqual({
      provider: "google",
      settings: { apiKey: "g" },
      modelId: MODELS.gemini.fast,
    });
  });

  it("builds an OpenAI model with the key", () => {
    expect(getModel({ provider: "openai", key: "o" }, "auto", "creative")).toEqual({
      provider: "openai",
      settings: { apiKey: "o" },
      modelId: MODELS.openai.creative,
    });
  });

  it("opts Anthropic into browser access", () => {
    expect(getModel({ provider: "anthropic", key: "a" }, "claude-opus-5-5", "fast")).toEqual({
      provider: "anthropic",
      settings: {
        apiKey: "a",
        headers: { "anthropic-dangerous-direct-browser-access": "true" },
      },
      modelId: "claude-opus-5-5",
    });
  });
});

describe("temperatureFor", () => {
  it("drops temperature only for OpenAI", () => {
    expect(temperatureFor("openai", 0.2)).toBeUndefined();
    expect(temperatureFor("gemini", 0.2)).toBe(0.2);
    expect(temperatureFor("anthropic", 0.7)).toBe(0.7);
  });
});
