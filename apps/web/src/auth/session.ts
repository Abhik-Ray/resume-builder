import type { Session } from "@supabase/supabase-js";
import { createContext, useContext } from "react";

export interface AuthState {
  session: Session | null;
  // True until the stored session (or the OAuth code in the URL) has been checked
  loading: boolean;
}

export const AuthContext = createContext<AuthState | null>(null);

export const useAuth = (): AuthState => {
  const state = useContext(AuthContext);
  if (!state) throw new Error("useAuth must be used inside <AuthProvider>");
  return state;
};

// The signed-in user's id. Only call this below <RequireAuth>.
export const useUserId = (): string => {
  const { session } = useAuth();
  if (!session) throw new Error("useUserId needs a signed-in user");
  return session.user.id;
};

// Remembers, per browser tab, that the details prompt was shown after this sign-in
const promptKey = (userId: string) => `details-prompted:${userId}`;

export const wasDetailsPromptShown = (userId: string): boolean => {
  try {
    return sessionStorage.getItem(promptKey(userId)) === "1";
  } catch {
    return false;
  }
};

export const markDetailsPromptShown = (userId: string) => {
  try {
    sessionStorage.setItem(promptKey(userId), "1");
  } catch {
    // Storage can be unavailable (private mode, blocked site data)
  }
};

export const clearDetailsPrompt = (userId: string) => {
  try {
    sessionStorage.removeItem(promptKey(userId));
  } catch {
    // Storage can be unavailable
  }
};
