import { describe, expect, it } from "vitest";
import { getProvider, PROVIDERS, type ProviderId } from "./providers";

describe("providers", () => {
  it("offers only Gemini for now", () => {
    expect(PROVIDERS.map((p) => p.id)).toEqual(["gemini"]);
  });

  it("looks a provider up by id", () => {
    expect(getProvider("gemini")).toEqual({ id: "gemini", label: "Gemini" });
  });

  it("falls back to the first provider for an unknown id", () => {
    expect(getProvider("unknown" as ProviderId)).toBe(PROVIDERS[0]);
  });
});
