import { FileText, LayoutDashboard, Loader2, Settings } from "lucide-react";
import { NavLink, Outlet } from "react-router";
import { Suspense } from "react";
import { cn } from "../lib/utils";

const NAV_ITEMS = [
  { to: "/", label: "Home", icon: LayoutDashboard, end: true },
  { to: "/resume", label: "Resume", icon: FileText, end: false },
  { to: "/settings", label: "Settings", icon: Settings, end: false },
];

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
