import type {
  ApplicationInput,
  ApplicationRow,
  ApplicationStatus,
  ResumeSnapshot,
  TablesInsert,
} from "@resume-builder/shared";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useUserId } from "../auth/session";
import { getSupabase } from "../lib/supabase";

export const applicationsKey = (userId: string) => ["applications", userId] as const;
// Anything derived from applications (the stats views); refreshed after every change
export const statsKey = (userId: string) => ["stats", userId] as const;

export interface NewApplication extends ApplicationInput {
  jdText?: string | null;
  resumeSnapshot?: ResumeSnapshot | null;
  jobId?: string | null;
}

export const fetchApplications = async (): Promise<ApplicationRow[]> => {
  const { data, error } = await getSupabase()
    .from("applications")
    .select("*")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data;
};

export const createApplication = async (input: NewApplication): Promise<ApplicationRow> => {
  const row: TablesInsert<"applications"> = {
    company: input.company,
    title: input.title,
    url: input.url,
    status: input.status,
    jd_text: input.jdText ?? null,
    resume_snapshot: (input.resumeSnapshot ?? null) as TablesInsert<"applications">["resume_snapshot"],
    job_id: input.jobId ?? null,
  };
  const { data, error } = await getSupabase().from("applications").insert(row).select("*").single();
  if (error) throw error;
  return data;
};

// The trigger records the change in application_events
export const setApplicationStatus = async (
  id: string,
  status: ApplicationStatus,
): Promise<ApplicationRow> => {
  const { data, error } = await getSupabase()
    .from("applications")
    .update({ status })
    .eq("id", id)
    .select("*")
    .single();
  if (error) throw error;
  return data;
};

export const deleteApplication = async (id: string) => {
  const { error } = await getSupabase().from("applications").delete().eq("id", id);
  if (error) throw error;
};

export const useApplications = () => {
  const userId = useUserId();
  return useQuery({ queryKey: applicationsKey(userId), queryFn: fetchApplications });
};

// Mutations refresh the list and the stats
const useApplicationMutation = <A, R>(mutationFn: (args: A) => Promise<R>) => {
  const userId = useUserId();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn,
    onSettled: () =>
      Promise.all([
        queryClient.invalidateQueries({ queryKey: applicationsKey(userId) }),
        queryClient.invalidateQueries({ queryKey: statsKey(userId) }),
      ]),
  });
};

export const useCreateApplication = () => useApplicationMutation(createApplication);

export const useSetApplicationStatus = () =>
  useApplicationMutation(({ id, status }: { id: string; status: ApplicationStatus }) =>
    setApplicationStatus(id, status),
  );

export const useDeleteApplication = () => useApplicationMutation(deleteApplication);
