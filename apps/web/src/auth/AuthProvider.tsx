import type { Session } from "@supabase/supabase-js";
import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { getSupabase, isSupabaseConfigured } from "../lib/supabase";
import { AuthContext, clearDetailsPrompt } from "./session";

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const queryClient = useQueryClient();
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(isSupabaseConfigured);
  const userId = useRef<string | null>(null);

  useEffect(() => {
    if (!isSupabaseConfigured) return;
    const supabase = getSupabase();
    let active = true;

    supabase.auth
      .getSession()
      .then(({ data }) => {
        if (!active) return;
        userId.current = data.session?.user.id ?? null;
        setSession(data.session);
      })
      .catch(() => {
        if (active) setSession(null);
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    const { data } = supabase.auth.onAuthStateChange((event, next) => {
      if (event === "SIGNED_OUT") {
        // Next sign-in prompts for missing details again, and no data outlives the session
        if (userId.current) clearDetailsPrompt(userId.current);
        queryClient.clear();
      }
      userId.current = next?.user.id ?? null;
      setSession(next);
      setLoading(false);
    });

    return () => {
      active = false;
      data.subscription.unsubscribe();
    };
  }, [queryClient]);

  return <AuthContext.Provider value={{ session, loading }}>{children}</AuthContext.Provider>;
};
