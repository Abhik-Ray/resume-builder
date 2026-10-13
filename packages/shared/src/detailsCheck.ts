import type { Database } from "./database";
import type { ResumeDataType } from "./resumeData";

export type ProfileRow = Database["public"]["Tables"]["profiles"]["Row"];

// Kept free of zod so the sign-in guard doesn't pull it into the main bundle
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const isEmail = (value: string) => EMAIL.test(value.trim());

// The details everything else needs. The rest of the resume can be filled in later.
export interface DetailsCheckInput {
  // jsonb from the database, or ResumeDataType before it is saved
  resume_data: unknown;
  home_city: string | null;
  home_country: string | null;
}

export const missingDetails = (profile: DetailsCheckInput | null | undefined): string[] => {
  const resume = profile?.resume_data as ResumeDataType | null | undefined;
  const missing: string[] = [];
  if (!resume?.profile?.name?.trim()) missing.push("Name");
  if (!resume?.profile?.contacts?.some(isEmail)) missing.push("Contact email");
  if (!resume?.currentRole?.trim()) missing.push("Current role");
  if (!resume?.experience?.length) missing.push("At least one position");
  if (!profile?.home_city?.trim()) missing.push("Home city");
  if (!profile?.home_country?.trim()) missing.push("Home country");
  return missing;
};

export const isDetailsComplete = (profile: DetailsCheckInput | null | undefined): boolean =>
  missingDetails(profile).length === 0;
