import { describe, expect, it } from "vitest";
import { MODELS } from "./models";

describe("MODELS", () => {
  it("defines a fast and a creative Gemini model", () => {
    expect(MODELS.fast).toMatch(/^gemini-/);
    expect(MODELS.creative).toMatch(/^gemini-/);
  });
});
