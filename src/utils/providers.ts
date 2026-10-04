// AI providers a key can belong to. Add new providers here and a health check
// for them in verifyProviderKey (utils/AIHealthCheck.ts).
export const PROVIDERS = [{ id: "gemini", label: "Gemini" }] as const;

export type ProviderId = (typeof PROVIDERS)[number]["id"];

export const getProvider = (id: ProviderId) =>
  PROVIDERS.find((p) => p.id === id) ?? PROVIDERS[0];
