import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  applyTheme,
  getTheme,
  resolveTheme,
  setTheme,
  THEME_STORAGE_KEY,
  watchSystemTheme,
} from "./theme";

// jsdom has no matchMedia; this one lets tests flip the OS preference
const mockSystemTheme = (initialDark: boolean) => {
  let dark = initialDark;
  const listeners = new Set<() => void>();
  vi.stubGlobal("matchMedia", (query: string) => ({
    get matches() {
      return query.includes("dark") && dark;
    },
    addEventListener: (_: string, cb: () => void) => listeners.add(cb),
    removeEventListener: (_: string, cb: () => void) => listeners.delete(cb),
  }));
  return {
    setDark: (value: boolean) => {
      dark = value;
      listeners.forEach((cb) => cb());
    },
  };
};

const isDark = () => document.documentElement.classList.contains("dark");

describe("theme", () => {
  beforeEach(() => mockSystemTheme(false));
  afterEach(() => {
    vi.unstubAllGlobals();
    document.documentElement.classList.remove("dark");
  });

  it("defaults to system", () => {
    expect(getTheme()).toBe("system");
  });

  it("ignores unknown stored values", () => {
    localStorage.setItem(THEME_STORAGE_KEY, "purple");
    expect(getTheme()).toBe("system");
  });

  it("resolves system from the OS preference", () => {
    expect(resolveTheme("system")).toBe("light");
    mockSystemTheme(true);
    expect(resolveTheme("system")).toBe("dark");
    expect(resolveTheme("light")).toBe("light");
  });

  it("stores and applies an explicit theme", () => {
    setTheme("dark");
    expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe("dark");
    expect(isDark()).toBe(true);
    expect(document.documentElement.style.colorScheme).toBe("dark");

    setTheme("light");
    expect(isDark()).toBe(false);
  });

  it("clears storage when going back to system", () => {
    setTheme("dark");
    setTheme("system");
    expect(localStorage.getItem(THEME_STORAGE_KEY)).toBeNull();
    expect(isDark()).toBe(false);
  });

  it("follows OS changes only while on system", () => {
    const os = mockSystemTheme(false);
    const stop = watchSystemTheme();
    applyTheme();

    os.setDark(true);
    expect(isDark()).toBe(true);

    setTheme("light");
    os.setDark(true);
    expect(isDark()).toBe(false);

    stop();
  });
});
