import { beforeEach, describe, expect, it } from "vitest";
import { db } from "./db";

// Deleting the database makes the next open run the "populate" migration again
const recreateDb = async () => {
  await db.delete();
  await db.open();
};

describe("db", () => {
  beforeEach(async () => {
    localStorage.clear();
    await db.delete();
  });

  it("creates the apiKeys and resumeData tables", async () => {
    await db.open();
    expect(db.tables.map((t) => t.name).sort()).toEqual(["apiKeys", "resumeData"]);
  });

  it("moves a legacy localStorage key into the database as the default Gemini key", async () => {
    localStorage.setItem("geminiKey", "legacy-key");
    await recreateDb();

    expect(await db.apiKeys.toArray()).toEqual([
      expect.objectContaining({
        label: "Gemini key",
        provider: "gemini",
        key: "legacy-key",
        isDefault: true,
      }),
    ]);
    expect(localStorage.getItem("geminiKey")).toBeNull();
  });

  it("creates no key when there is nothing to migrate", async () => {
    await recreateDb();
    expect(await db.apiKeys.count()).toBe(0);
  });

  it("only migrates when the database is first created", async () => {
    await recreateDb();
    localStorage.setItem("geminiKey", "added-later");
    db.close();
    await db.open();

    expect(await db.apiKeys.count()).toBe(0);
    expect(localStorage.getItem("geminiKey")).toBe("added-later");
  });
});
