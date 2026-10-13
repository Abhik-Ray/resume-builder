// The AI providers a key can belong to. The web app's PROVIDERS (apps/web/src/utils/providers.ts)
// adds labels and key links for each of these ids.
export const PROVIDER_IDS = ["gemini", "openai", "anthropic"] as const;

export type ProviderId = (typeof PROVIDER_IDS)[number];

// Anthropic rejects calls from a browser unless they opt in with this header.
// Fine here: each user brings their own key and it never leaves their browser
// except to Anthropic. Harmless from the job sync.
export const ANTHROPIC_BROWSER_HEADER = { "anthropic-dangerous-direct-browser-access": "true" };
