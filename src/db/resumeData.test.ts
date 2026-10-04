import { renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";
import { DEFAULT_RESUME_DATA } from "../data/ResumeData";
import { resetDb } from "../test/utils";
import { db } from "./db";
import { resetResumeData, saveResumeData, useResumeData } from "./resumeData";

const custom = { ...DEFAULT_RESUME_DATA, currentRole: "Staff Engineer" };

describe("resumeData", () => {
  beforeEach(resetDb);

  it("falls back to the defaults when nothing is saved", async () => {
    const { result } = renderHook(() => useResumeData());
    await waitFor(() =>
      expect(result.current).toEqual({ data: DEFAULT_RESUME_DATA, isCustom: false }),
    );
  });

  it("saves a single record with a timestamp", async () => {
    await saveResumeData(custom);
    await saveResumeData(custom);
    const records = await db.resumeData.toArray();
    expect(records).toHaveLength(1);
    expect(records[0]).toMatchObject({ id: "current", data: custom });
    expect(records[0].updatedAt).toEqual(expect.any(Number));
  });

  it("returns saved data and updates live", async () => {
    const { result } = renderHook(() => useResumeData());
    await waitFor(() => expect(result.current?.isCustom).toBe(false));

    await saveResumeData(custom);
    await waitFor(() => expect(result.current).toEqual({ data: custom, isCustom: true }));
  });

  it("resetResumeData goes back to the defaults", async () => {
    await saveResumeData(custom);
    const { result } = renderHook(() => useResumeData());
    await waitFor(() => expect(result.current?.isCustom).toBe(true));

    await resetResumeData();
    await waitFor(() =>
      expect(result.current).toEqual({ data: DEFAULT_RESUME_DATA, isCustom: false }),
    );
  });
});
