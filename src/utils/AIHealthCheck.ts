import { GoogleGenAI } from "@google/genai";
import { MODELS } from "./models";
import type { ProviderId } from "./providers";

export const verifyApiKey = async (ai: GoogleGenAI) => {
  try {
    // Fetching model metadata is a fast, lightweight way to verify auth
    await ai.models.get({ model: MODELS.fast });

    return { status: "healthy", valid: true };
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    // A 403 or 401 error means the key is invalid, revoked, or blocked
    console.error("❌ API Key validation failed:", errorMessage);
    return { status: "unhealthy", valid: false, reason: errorMessage };
  }
};

// Health-checks a raw key for the given provider
export const verifyProviderKey = (provider: ProviderId, apiKey: string) => {
  switch (provider) {
    case "gemini":
      return verifyApiKey(new GoogleGenAI({ apiKey }));
  }
};
