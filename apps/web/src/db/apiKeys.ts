import { useLiveQuery } from "dexie-react-hooks";
import type { ProviderId } from "../utils/providers";
import { db, type ApiKeyRecord } from "./db";

export type ApiKeyInput = Pick<ApiKeyRecord, "label" | "provider" | "key">;

export const addApiKey = (input: ApiKeyInput) =>
  db.transaction("rw", db.apiKeys, async () => {
    const hasDefault =
      (await db.apiKeys
        .where("provider")
        .equals(input.provider)
        .filter((k) => k.isDefault)
        .count()) > 0;
    return db.apiKeys.add({
      ...input,
      isDefault: !hasDefault,
      createdAt: Date.now(),
    });
  });

export const updateApiKey = (id: number, input: ApiKeyInput) =>
  db.transaction("rw", db.apiKeys, async () => {
    const existing = await db.apiKeys.get(id);
    if (!existing) throw new Error("Key not found");
    await db.apiKeys.update(id, input);
    // Moving a key to another provider must keep one default on each side
    if (existing.provider !== input.provider) {
      await db.apiKeys.update(id, { isDefault: false });
      await ensureDefault(existing.provider);
      await ensureDefault(input.provider);
    }
  });

export const deleteApiKey = (id: number) =>
  db.transaction("rw", db.apiKeys, async () => {
    const existing = await db.apiKeys.get(id);
    await db.apiKeys.delete(id);
    if (existing?.isDefault) await ensureDefault(existing.provider);
  });

export const setDefaultApiKey = (id: number) =>
  db.transaction("rw", db.apiKeys, async () => {
    const target = await db.apiKeys.get(id);
    if (!target) throw new Error("Key not found");
    await db.apiKeys
      .where("provider")
      .equals(target.provider)
      .modify({ isDefault: false });
    await db.apiKeys.update(id, { isDefault: true });
  });

// Promote the oldest key of a provider when it has no default
const ensureDefault = async (provider: ProviderId) => {
  const keys = await db.apiKeys.where("provider").equals(provider).sortBy("createdAt");
  if (keys.length && !keys.some((k) => k.isDefault)) {
    await db.apiKeys.update(keys[0].id, { isDefault: true });
  }
};

export const maskKey = (key: string) =>
  key.length <= 8 ? "••••" : `${key.slice(0, 4)}••••${key.slice(-4)}`;

// undefined while loading
export const useApiKeys = () =>
  useLiveQuery(() => db.apiKeys.orderBy("createdAt").toArray());

export const useProviderKeys = (provider: ProviderId) =>
  useLiveQuery(
    () => db.apiKeys.where("provider").equals(provider).sortBy("createdAt"),
    [provider],
  );
