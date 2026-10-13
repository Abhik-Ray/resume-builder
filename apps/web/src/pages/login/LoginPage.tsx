import { Loader2 } from "lucide-react";
import { useState } from "react";
import { Navigate } from "react-router";
import { signInWithGoogle } from "../../auth/actions";
import { useAuth } from "../../auth/session";
import { Button } from "../../components/ui/button";
import { isSupabaseConfigured } from "../../lib/supabase";

const getErrorMessage = (error: unknown) =>
  error instanceof Error ? error.message : String(error);

// The only public page
const LoginPage = () => {
  const { session, loading } = useAuth();
  const [error, setError] = useState<string | null>(
    isSupabaseConfigured ? null : "Sign-in isn't set up for this site yet.",
  );
  const [redirecting, setRedirecting] = useState(false);

  if (!loading && session) return <Navigate to="/" replace />;

  const onSignIn = async () => {
    setError(null);
    setRedirecting(true);
    try {
      // Leaves the page on success
      await signInWithGoogle();
    } catch (cause) {
      setError(`Sign-in failed: ${getErrorMessage(cause)}`);
      setRedirecting(false);
    }
  };

  return (
    <main className="flex min-h-screen items-center justify-center p-4">
      <div className="flex w-full max-w-sm flex-col gap-4 rounded-lg border p-6 text-center">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Resume Builder</h1>
          <p className="text-sm text-muted-foreground">Sign in to continue</p>
        </div>
        <Button
          className="rounded-md"
          onClick={onSignIn}
          disabled={loading || redirecting || !isSupabaseConfigured}
        >
          {redirecting && <Loader2 className="animate-spin" />}
          Continue with Google
        </Button>
        {error && (
          <p role="alert" className="text-xs text-red-600 dark:text-red-400">
            {error}
          </p>
        )}
      </div>
    </main>
  );
};

export default LoginPage;
