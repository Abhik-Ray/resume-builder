import { ChevronRight } from "lucide-react";
import { Link } from "react-router";
import { SETTINGS_SECTIONS } from "./sections";

const SettingsHome = () => (
  <>
    <h1 className="text-lg font-semibold">Settings</h1>
    <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {SETTINGS_SECTIONS.map(({ id, title, description, icon: Icon }) => (
        <li key={id}>
          <Link
            to={id}
            className="group flex h-full flex-col gap-3 rounded-lg border p-4 transition-colors hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
          >
            <span className="flex size-9 items-center justify-center rounded-md bg-muted">
              <Icon className="size-5" />
            </span>
            <span className="flex items-center justify-between gap-2 text-sm font-semibold">
              {title}
              <ChevronRight className="size-4 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
            </span>
            <span className="text-xs text-muted-foreground">{description}</span>
          </Link>
        </li>
      ))}
    </ul>
  </>
);

export default SettingsHome;
