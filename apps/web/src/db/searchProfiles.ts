import {
  toSearchProfileColumns,
  type SearchProfileInput,
  type SearchProfileRow,
} from "@resume-builder/shared";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useUserId } from "../auth/session";
import { getSupabase } from "../lib/supabase";

export const searchProfilesKey = (userId: string) => ["searchProfiles", userId] as const;

export const fetchSearchProfiles = async (): Promise<SearchProfileRow[]> => {
  const { data, error } = await getSupabase()
    .from("search_profiles")
    .select("*")
    .order("created_at", { ascending: true });
  if (error) throw error;
  return data;
};

// Creates when `id` is missing, else updates
export const saveSearchProfile = async ({
  id,
  input,
}: {
  id?: string;
  input: SearchProfileInput;
}): Promise<SearchProfileRow> => {
  const columns = toSearchProfileColumns(input);
  const supabase = getSupabase();
  const { data, error } = id
    ? await supabase.from("search_profiles").update(columns).eq("id", id).select("*").single()
    : await supabase.from("search_profiles").insert(columns).select("*").single();
  if (error) throw error;
  return data;
};

export const deleteSearchProfile = async (id: string) => {
  const { error } = await getSupabase().from("search_profiles").delete().eq("id", id);
  if (error) throw error;
};

export const useSearchProfiles = () => {
  const userId = useUserId();
  return useQuery({ queryKey: searchProfilesKey(userId), queryFn: fetchSearchProfiles });
};

const useSearchMutation = <A, R>(mutationFn: (args: A) => Promise<R>) => {
  const userId = useUserId();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn,
    onSettled: () => queryClient.invalidateQueries({ queryKey: searchProfilesKey(userId) }),
  });
};

export const useSaveSearchProfile = () => useSearchMutation(saveSearchProfile);
export const useDeleteSearchProfile = () => useSearchMutation(deleteSearchProfile);
