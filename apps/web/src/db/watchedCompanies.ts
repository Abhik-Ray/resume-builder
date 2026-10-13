import type { WatchedCompanyInput, WatchedCompanyRow } from "@resume-builder/shared";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useUserId } from "../auth/session";
import { getSupabase } from "../lib/supabase";

export const watchedCompaniesKey = (userId: string) => ["watchedCompanies", userId] as const;

export const fetchWatchedCompanies = async (): Promise<WatchedCompanyRow[]> => {
  const { data, error } = await getSupabase()
    .from("watched_companies")
    .select("*")
    .order("name", { ascending: true });
  if (error) throw error;
  return data;
};

const UNIQUE_VIOLATION = "23505";

export const watchCompany = async (input: WatchedCompanyInput): Promise<WatchedCompanyRow> => {
  const { data, error } = await getSupabase().from("watched_companies").insert(input).select("*").single();
  if (error?.code === UNIQUE_VIOLATION) throw new Error("You already watch this board");
  if (error) throw error;
  return data;
};

export const unwatchCompany = async (id: string) => {
  const { error } = await getSupabase().from("watched_companies").delete().eq("id", id);
  if (error) throw error;
};

export const useWatchedCompanies = () => {
  const userId = useUserId();
  return useQuery({ queryKey: watchedCompaniesKey(userId), queryFn: fetchWatchedCompanies });
};

const useWatchMutation = <A, R>(mutationFn: (args: A) => Promise<R>) => {
  const userId = useUserId();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn,
    onSettled: () => queryClient.invalidateQueries({ queryKey: watchedCompaniesKey(userId) }),
  });
};

export const useWatchCompany = () => useWatchMutation(watchCompany);
export const useUnwatchCompany = () => useWatchMutation(unwatchCompany);
