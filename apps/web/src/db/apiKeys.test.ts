import { renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";
import { resetDb } from "../test/utils";
import type { ProviderId } from "../utils/providers";
import {
  addApiKey,
  deleteApiKey,
  maskKey,
  setDefaultApiKey,
  updateApiKey,
  useApiKeys,
  useProviderKeys,
} from "./apiKeys";
import { db } from "./db";

// Lets tests exercise multi-provider logic before a second provider exists
const OTHER = "other" as ProviderId;

const add = (label: string, provider: ProviderId = "gemini") =>
  addApiKey({ label, provider, key: `key-${label}` });

const defaults = async () =>
  (await db.apiKeys.toArray()).filter((k) => k.isDefault).map((k) => k.label);

describe("apiKeys", () => {
  beforeEach(resetDb);

  describe("addApiKey", () => {
    it("makes the first key of a provider the default", async () => {
      await add("first");
      await add("second");
      expect(await defaults()).toEqual(["first"]);
    });

    it("tracks defaults per provider", async () => {
      await add("gemini-1");
      await add("other-1", OTHER);
      expect(await defaults()).toEqual(["gemini-1", "other-1"]);
    });

    it("stores the key with a creation time", async () => {
      const id = await add("first");
      const record = await db.apiKeys.get(id);
      expect(record).toMatchObject({ label: "first", provider: "gemini", key: "key-first" });
      expect(record?.createdAt).toEqual(expect.any(Number));
    });
  });

  describe("setDefaultApiKey", () => {
    it("moves the default within the provider", async () => {
      await add("first");
      const second = await add("second");
      await setDefaultApiKey(second);
      expect(await defaults()).toEqual(["second"]);
    });

    it("leaves other providers alone", async () => {
      await add("gemini-1");
      const gemini2 = await add("gemini-2");
      await add("other-1", OTHER);
      await setDefaultApiKey(gemini2);
      expect(await defaults()).toEqual(["gemini-2", "other-1"]);
    });

    it("rejects an unknown id", async () => {
      await expect(setDefaultApiKey(999)).rejects.toThrow("Key not found");
    });
  });

  describe("deleteApiKey", () => {
    it("promotes the oldest remaining key when the default is deleted", async () => {
      const first = await add("first");
      await add("second");
      await add("third");
      await deleteApiKey(first);
      expect(await defaults()).toEqual(["second"]);
    });

    it("keeps the default when another key is deleted", async () => {
      await add("first");
      const second = await add("second");
      await deleteApiKey(second);
      expect(await defaults()).toEqual(["first"]);
      expect(await db.apiKeys.count()).toBe(1);
    });
  });

  describe("updateApiKey", () => {
    it("updates label and key", async () => {
      const id = await add("first");
      await updateApiKey(id, { label: "renamed", provider: "gemini", key: "new-key" });
      expect(await db.apiKeys.get(id)).toMatchObject({
        label: "renamed",
        key: "new-key",
        isDefault: true,
      });
    });

    it("keeps one default on each side when a key changes provider", async () => {
      const gemini1 = await add("gemini-1");
      await add("gemini-2");
      await add("other-1", OTHER);
      await updateApiKey(gemini1, { label: "gemini-1", provider: OTHER, key: "k" });
      expect(await defaults()).toEqual(["gemini-2", "other-1"]);
    });

    it("rejects an unknown id", async () => {
      await expect(
        updateApiKey(999, { label: "x", provider: "gemini", key: "k" }),
      ).rejects.toThrow("Key not found");
    });
  });

  describe("maskKey", () => {
    it("shows only the first and last four characters", () => {
      expect(maskKey("AIzaSyABCDEFGH1234")).toBe("AIza••••1234");
    });

    it("hides short keys completely", () => {
      expect(maskKey("12345678")).toBe("••••");
    });
  });

  describe("hooks", () => {
    it("useApiKeys lists keys oldest first and updates live", async () => {
      await add("first");
      const { result } = renderHook(() => useApiKeys());
      await waitFor(() => expect(result.current?.map((k) => k.label)).toEqual(["first"]));

      await add("second");
      await waitFor(() =>
        expect(result.current?.map((k) => k.label)).toEqual(["first", "second"]),
      );
    });

    it("useProviderKeys only returns that provider's keys", async () => {
      await add("gemini-1");
      await add("other-1", OTHER);
      const { result } = renderHook(() => useProviderKeys("gemini"));
      await waitFor(() => expect(result.current?.map((k) => k.label)).toEqual(["gemini-1"]));
    });
  });
});
