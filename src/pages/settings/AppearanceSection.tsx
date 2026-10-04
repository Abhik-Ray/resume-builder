import { Monitor, Moon, Sun, type LucideIcon } from "lucide-react";
import { cn } from "../../lib/utils";
import { setTheme, useTheme, type Theme } from "../../theme/theme";

const OPTIONS: { value: Theme; label: string; description: string; icon: LucideIcon }[] = [
  { value: "system", label: "System", description: "Match your device setting", icon: Monitor },
  { value: "light", label: "Light", description: "Always use the light theme", icon: Sun },
  { value: "dark", label: "Dark", description: "Always use the dark theme", icon: Moon },
];

const AppearanceSection = () => {
  const theme = useTheme();

  return (
    <>
      <h1 className="text-lg font-semibold">Appearance</h1>
      <fieldset className="flex flex-col gap-2">
        <legend className="pb-2 text-xs font-medium text-muted-foreground">Theme</legend>
        <div className="grid gap-3 sm:grid-cols-3">
          {OPTIONS.map(({ value, label, description, icon: Icon }) => (
            <label
              key={value}
              className={cn(
                "flex cursor-pointer items-start gap-3 rounded-lg border p-4 transition-colors hover:bg-muted/50 has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-ring/50",
                theme === value && "border-primary bg-muted/50",
              )}
            >
              <input
                type="radio"
                name="theme"
                value={value}
                checked={theme === value}
                onChange={() => setTheme(value)}
                className="sr-only"
              />
              <span className="flex size-9 shrink-0 items-center justify-center rounded-md bg-muted">
                <Icon className="size-5" />
              </span>
              <span className="flex flex-col gap-1">
                <span className="text-sm font-semibold">{label}</span>
                <span className="text-xs text-muted-foreground">{description}</span>
              </span>
            </label>
          ))}
        </div>
      </fieldset>
    </>
  );
};

export default AppearanceSection;
