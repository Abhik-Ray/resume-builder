// AI providers a key can belong to. Add new providers here, with their models in
// MODELS (utils/models.ts), a client in getModel (utils/aiModel.ts) and a health
// check in verifyProviderKey (utils/AIHealthCheck.ts).
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
] as const;

export type ProviderId = (typeof PROVIDERS)[number]["id"];

// Anthropic rejects calls from a browser unless they opt in with this header.
// Fine here: each user brings their own key and it never leaves their browser
// except to Anthropic.
export const ANTHROPIC_BROWSER_HEADER = { "anthropic-dangerous-direct-browser-access": "true" };

export const getProvider = (id: ProviderId) =>
  PROVIDERS.find((p) => p.id === id) ?? PROVIDERS[0];
