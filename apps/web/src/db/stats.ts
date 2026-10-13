import type { Database } from "@resume-builder/shared";
import { useQuery } from "@tanstack/react-query";
import { useUserId } from "../auth/session";
import { getSupabase } from "../lib/supabase";
import { statsKey } from "./applications";

type Views = Database["public"]["Views"];
export type FunnelRow = Views["application_funnel"]["Row"];
export type WeeklyRow = Views["applications_weekly"]["Row"];
export type TransitionRow = Views["status_transitions"]["Row"];
export type ResponseStatsRow = Views["response_stats"]["Row"];
export type MatchStatsRow = Views["match_stats"]["Row"];

export interface Stats {
  funnel: FunnelRow[];
  weekly: WeeklyRow[];
  transitions: TransitionRow[];
  response: ResponseStatsRow | null;
  matches: MatchStatsRow[];
}

// The stats views run as the caller (security_invoker), so RLS limits them to the user's rows
export const fetchStats = async (): Promise<Stats> => {
  const supabase = getSupabase();
  const [funnel, weekly, transitions, response, matches] = await Promise.all([
    supabase.from("application_funnel").select("*").order("position"),
    supabase.from("applications_weekly").select("*").order("week"),
    supabase.from("status_transitions").select("*"),
    supabase.from("response_stats").select("*").maybeSingle(),
    supabase.from("match_stats").select("*").order("day"),
  ]);
  for (const result of [funnel, weekly, transitions, response, matches]) {
    if (result.error) throw result.error;
  }
  return {
    funnel: funnel.data ?? [],
    weekly: weekly.data ?? [],
    transitions: transitions.data ?? [],
    response: response.data ?? null,
    matches: matches.data ?? [],
  };
};

export const useStats = () => {
  const userId = useUserId();
  return useQuery({ queryKey: statsKey(userId), queryFn: fetchStats });
};
