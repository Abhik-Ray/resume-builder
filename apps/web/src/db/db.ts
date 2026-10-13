import Dexie, { type EntityTable } from "dexie";
import type { ResumeDataType } from "../types/input";
import type { ProviderId } from "../utils/providers";

export interface ApiKeyRecord {
  id: number;
  label: string;
  provider: ProviderId;
  key: string;
  // One default key per provider
  isDefault: boolean;
  createdAt: number;
}

export interface ResumeDataRecord {
  id: "current";
  data: ResumeDataType;
  updatedAt: number;
}

// Key used by the single-page version of the app, migrated on first open
const LEGACY_KEY_STORAGE = "geminiKey";

export const db = new Dexie("resume-builder") as Dexie & {
  apiKeys: EntityTable<ApiKeyRecord, "id">;
  resumeData: EntityTable<ResumeDataRecord, "id">;
};

db.version(1).stores({
  apiKeys: "++id, provider, createdAt",
  resumeData: "id",
});

db.on("populate", (tx) => {
  try {
    const legacyKey = localStorage.getItem(LEGACY_KEY_STORAGE);
    if (!legacyKey) return;
    tx.table("apiKeys").add({
      label: "Gemini key",
      provider: "gemini",
      key: legacyKey,
      isDefault: true,
      createdAt: Date.now(),
    });
    localStorage.removeItem(LEGACY_KEY_STORAGE);
  } catch {
    // Storage can be unavailable (private mode, blocked site data)
  }
});
