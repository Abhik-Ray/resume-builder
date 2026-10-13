import type { ProfileRow } from "@resume-builder/shared";
import { DEFAULT_RESUME_DATA } from "../data/ResumeData";
import type { ResumeDataType } from "../types/input";
import { useProfile } from "./profile";

export interface ResumeDataState {
  data: ResumeDataType;
  // False while the built-in defaults are shown
  isCustom: boolean;
}

// The profile's resume data, or the defaults when the user hasn't saved their own
export const resumeFromProfile = (profile: Pick<ProfileRow, "resume_data">): ResumeDataState => {
  const saved = profile.resume_data as ResumeDataType | null;
  return { data: saved ?? DEFAULT_RESUME_DATA, isCustom: !!saved };
};

// undefined while loading. Pages that must show load errors use useProfile() directly.
export const useResumeData = (): ResumeDataState | undefined => {
  const { data } = useProfile();
  return data ? resumeFromProfile(data) : undefined;
};
