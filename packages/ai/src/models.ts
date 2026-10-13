import type { ProviderId } from "./providers";

export type ModelTier = "fast" | "creative";

// "auto" picks the tier each task asks for; anything else is a model id
export type ModelChoice = "auto" | (string & {});

interface ProviderModels {
  fast: string;
  creative: string;
  // Shown in the model picker
  options: { id: string; label: string }[];
}

// Central place for model ids used across the app
export const MODELS: Record<ProviderId, ProviderModels> = {
  gemini: {
    fast: "gemini-2.5-flash",
    creative: "gemini-2.5-pro",
    options: [
      { id: "gemini-2.5-flash", label: "Gemini 2.5 Flash" },
      { id: "gemini-2.5-pro", label: "Gemini 2.5 Pro" },
    ],
  },
  openai: {
    fast: "gpt-6-luna",
    creative: "gpt-6.1-sol",
    options: [
      { id: "gpt-6-luna", label: "GPT-6 Luna" },
      { id: "gpt-6.1-sol", label: "GPT-6.1 Sol" },
      { id: "gpt-6-astra", label: "GPT-6 Astra" },
    ],
  },
  anthropic: {
    fast: "claude-haiku-4-5",
    creative: "claude-sonnet-5-5",
    options: [
      { id: "claude-haiku-4-5", label: "Claude Haiku 4.5" },
      { id: "claude-sonnet-5-5", label: "Claude Sonnet 5.5" },
      { id: "claude-opus-5-5", label: "Claude Opus 5.5" },
    ],
  },
};

export const resolveModelId = (provider: ProviderId, choice: ModelChoice, tier: ModelTier) =>
  choice === "auto" ? MODELS[provider][tier] : choice;
