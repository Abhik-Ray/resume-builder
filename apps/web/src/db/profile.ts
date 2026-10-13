import type { Details, ProfileRow, TablesUpdate } from "@resume-builder/shared";
import { isDetailsComplete } from "@resume-builder/shared";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useUserId } from "../auth/session";
import { getSupabase } from "../lib/supabase";
import type { ResumeDataType } from "../types/input";

export const profileKey = (userId: string) => ["profile", userId] as const;

// Resume data saved in this browser before sign-in existed, imported into a new profile.
// Dexie loads on demand so it stays out of the main bundle.
const readLocalResumeData = async (): Promise<ResumeDataType | null> => {
  try {
    const { db } = await import("./db");
    return (await db.resumeData.get("current"))?.data ?? null;
  } catch {
    return null;
  }
};

const UNIQUE_VIOLATION = "23505";

// The user's profile, created on first sign-in (pre-filled from IndexedDB)
export const fetchProfile = async (userId: string): Promise<ProfileRow> => {
  const supabase = getSupabase();
  const existing = await supabase.from("profiles").select("*").eq("user_id", userId).maybeSingle();
  if (existing.error) throw existing.error;
  if (existing.data) return existing.data;

  const resumeData = await readLocalResumeData();
  const created = await supabase
    .from("profiles")
    .insert({ user_id: userId, resume_data: resumeData as ProfileRow["resume_data"] })
    .select("*")
    .single();
  if (!created.error) return created.data;
  // Another tab created it first
  if (created.error.code !== UNIQUE_VIOLATION) throw created.error;
  const retry = await supabase.from("profiles").select("*").eq("user_id", userId).single();
  if (retry.error) throw retry.error;
  return retry.data;
};

export const updateProfile = async (
  userId: string,
  patch: TablesUpdate<"profiles">,
): Promise<ProfileRow> => {
  const { data, error } = await getSupabase()
    .from("profiles")
    .update(patch)
    .eq("user_id", userId)
    .select("*")
    .single();
  if (error) throw error;
  return data;
};

// Columns written by the Details page
export const detailsToProfile = (details: Details): TablesUpdate<"profiles"> => {
  const { home, ...resume } = details;
  const patch = {
    resume_data: resume as ProfileRow["resume_data"],
    home_city: home.city,
    home_region: home.region || null,
    home_country: home.country,
    search_radius_km: home.searchRadiusKm,
    include_remote: home.includeRemote,
  };
  return {
    ...patch,
    details_completed_at: isDetailsComplete(patch) ? new Date().toISOString() : null,
  };
};

export const useProfile = () => {
  const userId = useUserId();
  return useQuery({ queryKey: profileKey(userId), queryFn: () => fetchProfile(userId) });
};

export const useUpdateProfile = () => {
  const userId = useUserId();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (patch: TablesUpdate<"profiles">) => updateProfile(userId, patch),
    onSuccess: (row) => queryClient.setQueryData(profileKey(userId), row),
  });
};
