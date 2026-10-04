import { GoogleGenAI } from "@google/genai";
import { MODELS } from "./models";

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
