import { useSyncExternalStore } from "react";

export type Theme = "system" | "light" | "dark";

export const THEMES: readonly Theme[] = ["system", "light", "dark"];

// localStorage rather than IndexedDB: index.html reads it synchronously before
// first paint so the page doesn't flash light. Keep the key in sync there.
export const THEME_STORAGE_KEY = "theme";

const DARK_QUERY = "(prefers-color-scheme: dark)";

const listeners = new Set<() => void>();

const isTheme = (value: unknown): value is Theme => THEMES.includes(value as Theme);

export const getTheme = (): Theme => {
  try {
    const stored = localStorage.getItem(THEME_STORAGE_KEY);
    return isTheme(stored) ? stored : "system";
  } catch {
    // Storage can be unavailable (private mode, blocked site data)
    return "system";
  }
};

const systemPrefersDark = () =>
  typeof window.matchMedia === "function" && window.matchMedia(DARK_QUERY).matches;

export const resolveTheme = (theme: Theme): "light" | "dark" =>
  theme === "system" ? (systemPrefersDark() ? "dark" : "light") : theme;

export const applyTheme = (theme: Theme = getTheme()) => {
  const dark = resolveTheme(theme) === "dark";
  document.documentElement.classList.toggle("dark", dark);
  document.documentElement.style.colorScheme = dark ? "dark" : "light";
};

export const setTheme = (theme: Theme) => {
  try {
    if (theme === "system") localStorage.removeItem(THEME_STORAGE_KEY);
    else localStorage.setItem(THEME_STORAGE_KEY, theme);
  } catch {
    // Still apply it for this session
  }
  applyTheme(theme);
  listeners.forEach((listener) => listener());
};

// Follows OS changes while the theme is "system". Returns a cleanup function.
export const watchSystemTheme = () => {
  if (typeof window.matchMedia !== "function") return () => {};
  const query = window.matchMedia(DARK_QUERY);
  const onChange = () => {
    if (getTheme() === "system") applyTheme("system");
  };
  query.addEventListener("change", onChange);
  return () => query.removeEventListener("change", onChange);
};

const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};

export const useTheme = () => useSyncExternalStore(subscribe, getTheme);
