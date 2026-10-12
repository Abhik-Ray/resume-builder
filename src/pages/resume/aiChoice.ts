import type { ApiKeyRecord } from "../../db/db";
import { readStored } from "../../lib/storage";
import type { ModelChoice } from "../../utils/models";
import { PROVIDERS, type ProviderId } from "../../utils/providers";

// The last key and per-provider model picked on the Resume page, remembered in this browser
export const KEY_CHOICE_STORAGE = "resume.aiKeyId";
export const modelChoiceStorage = (provider: ProviderId) => `resume.aiModel.${provider}`;

export const readKeyChoice = () => {
  const stored = Number(readStored(KEY_CHOICE_STORAGE));
  return Number.isInteger(stored) && stored > 0 ? stored : null;
};

export const readModelChoices = () =>
  Object.fromEntries(
    PROVIDERS.map((p) => [p.id, readStored(modelChoiceStorage(p.id)) ?? "auto"]),
  ) as Record<ProviderId, ModelChoice>;

// The remembered key, else the default key of the first provider that has keys
export const pickKey = (keys: ApiKeyRecord[], selectedId: number | null) =>
  keys.find((k) => k.id === selectedId) ??
  PROVIDERS.map((p) => keys.find((k) => k.provider === p.id && k.isDefault)).find(Boolean) ??
  keys[0];
