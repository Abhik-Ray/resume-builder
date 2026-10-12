import { MODELS } from "./models";
import { ANTHROPIC_BROWSER_HEADER, type ProviderId } from "./providers";

export interface KeyHealth {
  status: "healthy" | "unhealthy";
  valid: boolean;
  reason?: string;
}

// Model metadata endpoints: a fast way to check auth without spending tokens.
// The key always goes in a header, never in the URL.
const healthRequest = (provider: ProviderId, apiKey: string): [string, RequestInit] => {
  switch (provider) {
    case "gemini":
      return [
        `https://generativelanguage.googleapis.com/v1beta/models/${MODELS.gemini.fast}`,
        { headers: { "x-goog-api-key": apiKey } },
      ];
    case "openai":
      return [
        "https://api.openai.com/v1/models",
        { headers: { Authorization: `Bearer ${apiKey}` } },
      ];
    case "anthropic":
      return [
        "https://api.anthropic.com/v1/models",
        {
          headers: {
            "x-api-key": apiKey,
            "anthropic-version": "2023-06-01",
            ...ANTHROPIC_BROWSER_HEADER,
          },
        },
      ];
  }
};

// The provider's own error message, when the body has one
const readError = async (response: Response) => {
  try {
    const body = await response.json();
    const message = body?.error?.message;
    if (typeof message === "string" && message) return `${response.status}: ${message}`;
  } catch {
    // Not JSON
  }
  return `${response.status} ${response.statusText}`.trim();
};

// Health-checks a raw key for the given provider
export const verifyProviderKey = async (
  provider: ProviderId,
  apiKey: string,
): Promise<KeyHealth> => {
  try {
    const response = await fetch(...healthRequest(provider, apiKey));
    if (response.ok) return { status: "healthy", valid: true };
    // A 401 or 403 means the key is invalid, revoked, or blocked
    const reason = await readError(response);
    console.error(`❌ ${provider} key validation failed:`, reason);
    return { status: "unhealthy", valid: false, reason };
  } catch (error: unknown) {
    const reason = error instanceof Error ? error.message : String(error);
    console.error(`❌ ${provider} key validation failed:`, reason);
    return { status: "unhealthy", valid: false, reason };
  }
};
