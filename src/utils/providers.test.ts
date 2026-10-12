import { describe, expect, it } from "vitest";
import { getProvider, PROVIDERS, type ProviderId } from "./providers";

describe("providers", () => {
  it("offers Gemini, OpenAI and Anthropic", () => {
    expect(PROVIDERS.map((p) => p.id)).toEqual(["gemini", "openai", "anthropic"]);
  });

  it("looks a provider up by id", () => {
    expect(getProvider("anthropic")).toMatchObject({ id: "anthropic", label: "Anthropic" });
  });

  it("links each provider to where its keys are created", () => {
    for (const p of PROVIDERS) expect(p.keyUrl).toMatch(/^https:\/\//);
  });

  it("falls back to the first provider for an unknown id", () => {
    expect(getProvider("unknown" as ProviderId)).toBe(PROVIDERS[0]);
  });
});
