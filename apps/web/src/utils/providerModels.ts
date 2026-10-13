import { ANTHROPIC_BROWSER_HEADER, type ProviderId } from "./providers";

export interface ModelOption {
  id: string;
  label: string;
}

// OpenAI lists every model its API serves; keep the chat ones
const OPENAI_CHAT = /^(gpt-|o\d)/;
const OPENAI_NOT_CHAT = /(audio|realtime|tts|transcribe|image|search|embedding|instruct)/;

const parse = async (response: Response) => {
  if (!response.ok) throw new Error(`The model list returned HTTP ${response.status}`);
  return response.json();
};

// The models this key can use, from the provider's own list. The key goes in a header.
export const listProviderModels = async (provider: ProviderId, apiKey: string): Promise<ModelOption[]> => {
  switch (provider) {
    case "openai": {
      const body = (await parse(
        await fetch("https://api.openai.com/v1/models", { headers: { Authorization: `Bearer ${apiKey}` } }),
      )) as { data?: { id: string }[] };
      return (body.data ?? [])
        .map((m) => m.id)
        .filter((id) => OPENAI_CHAT.test(id) && !OPENAI_NOT_CHAT.test(id))
        .sort()
        .map((id) => ({ id, label: id }));
    }
    case "anthropic": {
      const body = (await parse(
        await fetch("https://api.anthropic.com/v1/models?limit=100", {
          headers: { "x-api-key": apiKey, "anthropic-version": "2023-06-01", ...ANTHROPIC_BROWSER_HEADER },
        }),
      )) as { data?: { id: string; display_name?: string }[] };
      return (body.data ?? []).map((m) => ({ id: m.id, label: m.display_name || m.id }));
    }
    case "gemini": {
      const body = (await parse(
        await fetch("https://generativelanguage.googleapis.com/v1beta/models?pageSize=200", {
          headers: { "x-goog-api-key": apiKey },
        }),
      )) as { models?: { name: string; displayName?: string; supportedGenerationMethods?: string[] }[] };
      return (body.models ?? [])
        .filter((m) => m.name.includes("gemini") && m.supportedGenerationMethods?.includes("generateContent"))
        .map((m) => {
          const id = m.name.replace(/^models\//, "");
          return { id, label: m.displayName || id };
        });
    }
  }
};

// The curated models first, then the rest of the account's, without repeats
export const mergeModelOptions = (curated: ModelOption[], fromAccount: ModelOption[] | undefined) => {
  const known = new Set(curated.map((m) => m.id));
  return [...curated, ...(fromAccount ?? []).filter((m) => !known.has(m.id))];
};
