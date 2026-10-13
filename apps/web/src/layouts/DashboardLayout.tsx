import {
  BarChart3,
  Briefcase,
  FileText,
  Inbox,
  LayoutDashboard,
  Loader2,
  LogOut,
  Settings,
} from "lucide-react";
import { NavLink, Outlet } from "react-router";
import { Suspense, useState } from "react";
import { signOut } from "../auth/actions";
import { useAuth } from "../auth/session";
import { cn } from "../lib/utils";

const NAV_ITEMS = [
  { to: "/", label: "Home", icon: LayoutDashboard, end: true },
  { to: "/jobs", label: "Jobs", icon: Inbox, end: false },
  { to: "/resume", label: "Resume", icon: FileText, end: false },
  { to: "/applications", label: "Applications", icon: Briefcase, end: false },
  { to: "/stats", label: "Stats", icon: BarChart3, end: false },
  { to: "/settings", label: "Settings", icon: Settings, end: false },
];

const getErrorMessage = (error: unknown) =>
  error instanceof Error ? error.message : String(error);

const SignOutButton = () => {
  const { session } = useAuth();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onSignOut = async () => {
    setError(null);
    setBusy(true);
    try {
      await signOut();
    } catch (cause) {
      setError(`Sign-out failed: ${getErrorMessage(cause)}`);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="ml-auto flex flex-col gap-1 md:mt-auto md:ml-0">
      {session?.user.email && (
        <span className="hidden truncate px-3 text-xs text-muted-foreground md:block">
          {session.user.email}
        </span>
      )}
      <button
        type="button"
        onClick={onSignOut}
        disabled={busy}
        className="flex items-center gap-2 rounded-md px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-sidebar-accent/60 disabled:opacity-50"
      >
        <LogOut className="size-4" />
        Sign out
      </button>
      {error && (
        <p role="alert" className="px-3 text-xs text-red-600 dark:text-red-400">
          {error}
        </p>
      )}
    </div>
  );
};

export const DashboardLayout = () => (
  <div className="flex flex-col md:flex-row min-h-screen w-full">
    <nav className="flex md:flex-col gap-1 border-b md:border-b-0 md:border-r bg-sidebar p-2 md:p-3 md:w-52 md:min-h-screen shrink-0">
      <span className="hidden md:block px-2 pb-4 pt-1 text-sm font-bold">
        Resume Builder
      </span>
      {NAV_ITEMS.map(({ to, label, icon: Icon, end }) => (
        <NavLink
          key={to}
          to={to}
          end={end}
          className={({ isActive }) =>
            cn(
              "flex items-center gap-2 rounded-md px-3 py-2 text-sm transition-colors",
              isActive
                ? "bg-sidebar-accent text-sidebar-accent-foreground font-medium"
                : "text-muted-foreground hover:bg-sidebar-accent/60",
            )
          }
        >
          <Icon className="size-4" />
          {label}
        </NavLink>
      ))}
      <SignOutButton />
    </nav>
    <main className="flex-1 min-w-0 overflow-y-auto">
      <Suspense
        fallback={
          <div className="flex justify-center p-8">
            <Loader2 className="animate-spin" />
          </div>
        }
      >
        <Outlet />
      </Suspense>
    </main>
  </div>
);
