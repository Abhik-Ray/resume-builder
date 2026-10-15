import { describe, expect, it } from "vitest";
import { MODELS, resolveModelId } from "./models";
import { PROVIDERS } from "./providers";

describe("MODELS", () => {
  it.each(PROVIDERS.map((p) => p.id))("offers %s's fast and creative models", (provider) => {
    const ids = MODELS[provider].options.map((m) => m.id);
    expect(ids).toContain(MODELS[provider].fast);
    expect(ids).toContain(MODELS[provider].creative);
  });

  it("uses each provider's own model ids", () => {
    expect(MODELS.gemini.fast).toMatch(/^gemini-/);
    expect(MODELS.openai.fast).toMatch(/^gpt-/);
    expect(MODELS.anthropic.fast).toMatch(/^claude-/);
  });
});

describe("resolveModelId", () => {
  it("maps auto to the tier's model", () => {
    expect(resolveModelId("anthropic", "auto", "fast")).toBe(MODELS.anthropic.fast);
    expect(resolveModelId("anthropic", "auto", "creative")).toBe(MODELS.anthropic.creative);
  });

  it("keeps a chosen model for every tier", () => {
    expect(resolveModelId("anthropic", "claude-opus-5-5", "fast")).toBe("claude-opus-5-5");
  });
});
