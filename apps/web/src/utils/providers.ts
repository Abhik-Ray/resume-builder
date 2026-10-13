import type { ProviderId } from "@resume-builder/ai/providers";

export { ANTHROPIC_BROWSER_HEADER, type ProviderId } from "@resume-builder/ai/providers";

// AI providers a key can belong to, with what the Settings page shows for each. Add new
// providers to PROVIDER_IDS (packages/ai/src/providers.ts) and here, with their models in
// MODELS (packages/ai/src/models.ts), a client in getModel (packages/ai/src/aiModel.ts) and a
// health check in verifyProviderKey (utils/AIHealthCheck.ts).
export const PROVIDERS = [
  {
    id: "gemini",
    label: "Gemini",
    keyUrl: "https://aistudio.google.com/apikey",
    note: "Google AI Studio keys have a free tier.",
  },
  {
    id: "openai",
    label: "OpenAI",
    keyUrl: "https://platform.openai.com/api-keys",
    note: "Needs an OpenAI API key. A ChatGPT subscription doesn't include API access; API usage is billed separately.",
  },
  {
    id: "anthropic",
    label: "Anthropic",
    keyUrl: "https://console.anthropic.com/settings/keys",
    note: "Needs an Anthropic API key. A Claude subscription doesn't include API access; API usage is billed separately.",
  },
] as const satisfies readonly { id: ProviderId; label: string; keyUrl: string; note: string }[];

export const getProvider = (id: ProviderId) =>
  PROVIDERS.find((p) => p.id === id) ?? PROVIDERS[0];
