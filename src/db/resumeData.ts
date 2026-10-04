import { useLiveQuery } from "dexie-react-hooks";
import { DEFAULT_RESUME_DATA } from "../data/ResumeData";
import type { ResumeDataType } from "../types/input";
import { db } from "./db";

const RECORD_ID = "current";

export const saveResumeData = (data: ResumeDataType) =>
  db.resumeData.put({ id: RECORD_ID, data, updatedAt: Date.now() });

export const resetResumeData = () => db.resumeData.delete(RECORD_ID);

// Saved data, or the defaults when nothing has been saved. undefined while loading.
export const useResumeData = () =>
  useLiveQuery(async () => {
    const record = await db.resumeData.get(RECORD_ID);
    return {
      data: record?.data ?? DEFAULT_RESUME_DATA,
      isCustom: !!record,
    };
  });
