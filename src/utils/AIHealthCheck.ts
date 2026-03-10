import { GoogleGenAI } from "@google/genai";

export const verifyApiKey = async (apiKey: string) => {
  const ai = new GoogleGenAI({ apiKey });

  try {
    // Fetching model metadata is a fast, lightweight way to verify auth
    await ai.models.get({ model: "gemini-2.5-flash" });
    
    console.log("✅ API Key is valid and active.");
    return { status: "healthy", valid: true };
    
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    // A 403 or 401 error means the key is invalid, revoked, or blocked
    console.error("❌ API Key validation failed:", errorMessage);
    return { status: "unhealthy", valid: false, reason: errorMessage };
  }
};