import type { JobMatchRow, JobRow, MatchState, SyncRunRow, TablesUpdate } from "@resume-builder/shared";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useUserId } from "../auth/session";
import { getSupabase } from "../lib/supabase";
import type { JudgeResponseType } from "../utils/AIResumeJudge";

export const matchesKey = (userId: string) => ["matches", userId] as const;
export const syncRunKey = ["syncRun"] as const;

export interface Match extends Omit<JobMatchRow, "verdict"> {
  verdict: JudgeResponseType | null;
  job: JobRow;
}

// Newest first. Jobs are read in a second request, since every user can read them.
export const fetchMatches = async (): Promise<Match[]> => {
  const supabase = getSupabase();
  const matches = await supabase.from("job_matches").select("*").order("created_at", { ascending: false });
  if (matches.error) throw matches.error;
  if (matches.data.length === 0) return [];
  const jobs = await supabase
    .from("jobs")
    .select("*")
    .in(
      "id",
      matches.data.map((m) => m.job_id),
    );
  if (jobs.error) throw jobs.error;
  const byId = new Map(jobs.data.map((j) => [j.id, j]));
  return matches.data.flatMap((m) => {
    const job = byId.get(m.job_id);
    return job ? [{ ...m, verdict: m.verdict as unknown as JudgeResponseType | null, job }] : [];
  });
};

// Users can change only the verdict and the state of their matches
export const updateMatch = async (
  jobId: string,
  patch: { state?: MatchState; verdict?: JudgeResponseType },
) => {
  const { error } = await getSupabase()
    .from("job_matches")
    .update(patch as TablesUpdate<"job_matches">)
    .eq("job_id", jobId);
  if (error) throw error;
};

export const fetchLatestSyncRun = async (): Promise<SyncRunRow | null> => {
  const { data, error } = await getSupabase()
    .from("sync_runs")
    .select("*")
    .order("started_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return data;
};

export const useMatches = () => {
  const userId = useUserId();
  return useQuery({ queryKey: matchesKey(userId), queryFn: fetchMatches });
};

export const useLatestSyncRun = () => useQuery({ queryKey: syncRunKey, queryFn: fetchLatestSyncRun });

export const useUpdateMatch = () => {
  const userId = useUserId();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ jobId, patch }: { jobId: string; patch: Parameters<typeof updateMatch>[1] }) =>
      updateMatch(jobId, patch),
    // Show the change at once; the refetch afterwards corrects anything that failed
    onMutate: ({ jobId, patch }) =>
      queryClient.setQueryData<Match[]>(matchesKey(userId), (old) =>
        old?.map((m) => (m.job_id === jobId ? { ...m, ...patch } : m)),
      ),
    onSettled: () => queryClient.invalidateQueries({ queryKey: matchesKey(userId) }),
  });
};
