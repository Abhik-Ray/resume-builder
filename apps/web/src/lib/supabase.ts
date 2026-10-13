import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@resume-builder/shared";

// Tests replace this module with test/fakeSupabase.ts (see test/setup.ts)

const url = import.meta.env.VITE_SUPABASE_URL;
// Public by design: it only identifies the project. RLS and the missing anon grants make it
// useless without a signed-in user.
const publishableKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

export const isSupabaseConfigured = Boolean(url && publishableKey);

let client: SupabaseClient<Database> | undefined;

// Created on first use so the app still loads (and shows an error) without the env vars
export const getSupabase = (): SupabaseClient<Database> => {
  if (!url || !publishableKey) {
    throw new Error(
      "Supabase isn't configured: set VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY",
    );
  }
  client ??= createClient<Database>(url, publishableKey, {
    auth: {
      // The OAuth redirect returns ?code= in the query string, which doesn't clash with the
      // hash router's #/ URLs; detectSessionInUrl exchanges it on load.
      flowType: "pkce",
      detectSessionInUrl: true,
      persistSession: true,
      autoRefreshToken: true,
    },
  });
  return client;
};
