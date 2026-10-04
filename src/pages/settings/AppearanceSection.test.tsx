import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it } from "vitest";
import { THEME_STORAGE_KEY } from "../../theme/theme";
import AppearanceSection from "./AppearanceSection";

describe("AppearanceSection", () => {
  afterEach(() => document.documentElement.classList.remove("dark"));

  it("selects System by default", () => {
    render(<AppearanceSection />);
    expect(screen.getByRole("radio", { name: /System/ })).toBeChecked();
  });

  it("switches and remembers the theme", async () => {
    render(<AppearanceSection />);

    await userEvent.click(screen.getByRole("radio", { name: /Dark/ }));
    expect(screen.getByRole("radio", { name: /Dark/ })).toBeChecked();
    expect(document.documentElement).toHaveClass("dark");
    expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe("dark");

    await userEvent.click(screen.getByRole("radio", { name: /Light/ }));
    expect(document.documentElement).not.toHaveClass("dark");
    expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe("light");
  });

  it("shows the stored theme", () => {
    localStorage.setItem(THEME_STORAGE_KEY, "light");
    render(<AppearanceSection />);
    expect(screen.getByRole("radio", { name: /Light/ })).toBeChecked();
  });
});
