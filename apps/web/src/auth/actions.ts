import { getSupabase } from "../lib/supabase";

// Google is the only sign-in method. Returns to the site root; the router then shows #/.
export const signInWithGoogle = async () => {
  const { error } = await getSupabase().auth.signInWithOAuth({
    provider: "google",
    options: { redirectTo: `${window.location.origin}${import.meta.env.BASE_URL}` },
  });
  if (error) throw error;
};

export const signOut = async () => {
  const { error } = await getSupabase().auth.signOut();
  if (error) throw error;
};
