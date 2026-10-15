import { createAnthropic } from "@ai-sdk/anthropic";
import { createGoogle } from "@ai-sdk/google";
import { createOpenAI } from "@ai-sdk/openai";
import type { LanguageModel } from "ai";
import { resolveModelId, type ModelChoice, type ModelTier } from "./models";
import { ANTHROPIC_BROWSER_HEADER, type ProviderId } from "./providers";

// A saved key; ApiKeyRecord satisfies this
export interface AIKey {
  provider: ProviderId;
  key: string;
}

// The only place that builds provider clients
export const getModel = (
  { provider, key }: AIKey,
  choice: ModelChoice,
  tier: ModelTier,
): LanguageModel => {
  const modelId = resolveModelId(provider, choice, tier);
  switch (provider) {
    case "gemini":
      return createGoogle({ apiKey: key })(modelId);
    case "openai":
      return createOpenAI({ apiKey: key })(modelId);
    case "anthropic":
      return createAnthropic({ apiKey: key, headers: ANTHROPIC_BROWSER_HEADER })(modelId);
  }
};

// OpenAI's current models are reasoning models, which reject `temperature`
export const temperatureFor = (provider: ProviderId, temperature: number) =>
  provider === "openai" ? undefined : temperature;
