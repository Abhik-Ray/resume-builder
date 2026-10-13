import { isDetailsComplete } from "@resume-builder/shared";
import { Loader2 } from "lucide-react";
import { useEffect, type ReactNode } from "react";
import { Navigate, useLocation, useNavigate } from "react-router";
import { useProfile } from "../db/profile";
import { markDetailsPromptShown, useAuth, useUserId, wasDetailsPromptShown } from "./session";

export const DETAILS_PATH = "/settings/resume-data";

const Spinner = () => (
  <div className="flex min-h-screen items-center justify-center">
    <Loader2 className="animate-spin" aria-label="Loading" />
  </div>
);

// Everything but #/login sits behind this guard
export const RequireAuth = ({ children }: { children: ReactNode }) => {
  const { session, loading } = useAuth();
  if (loading) return <Spinner />;
  if (!session) return <Navigate to="/login" replace />;
  return (
    <>
      <DetailsPrompt />
      {children}
    </>
  );
};

// After each sign-in, incomplete details open the Details page once; other pages stay open
const DetailsPrompt = () => {
  const userId = useUserId();
  const { data: profile } = useProfile();
  const navigate = useNavigate();
  const { pathname } = useLocation();

  useEffect(() => {
    if (!profile || wasDetailsPromptShown(userId)) return;
    markDetailsPromptShown(userId);
    if (!isDetailsComplete(profile) && pathname !== DETAILS_PATH) {
      navigate(DETAILS_PATH, { replace: true });
    }
  }, [profile, userId, pathname, navigate]);

  return null;
};
