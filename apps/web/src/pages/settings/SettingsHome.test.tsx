import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { renderWithRouter } from "../../test/utils";
import { SETTINGS_SECTIONS } from "./sections";
import SettingsHome from "./SettingsHome";

describe("SETTINGS_SECTIONS", () => {
  it("lists API Keys, Resume Data and Appearance with unique ids and descriptions", () => {
    expect(SETTINGS_SECTIONS.map((s) => s.title)).toEqual(["API Keys", "Resume Data", "Appearance"]);
    expect(new Set(SETTINGS_SECTIONS.map((s) => s.id)).size).toBe(SETTINGS_SECTIONS.length);
    for (const section of SETTINGS_SECTIONS) expect(section.description).not.toBe("");
  });
});

describe("SettingsHome", () => {
  // Waits for the sign-in guard to let the page through
  const renderHome = async () => {
    const view = renderWithRouter(<SettingsHome />, {
      path: "/settings",
      routes: SETTINGS_SECTIONS.map((s) => ({
        path: `/settings/${s.id}`,
        element: <p>{s.title} page</p>,
      })),
    });
    await screen.findByRole("heading", { name: "Settings" });
    return view;
  };

  it("shows a tile with title and description for each section", async () => {
    await renderHome();
    expect(screen.getByRole("heading", { name: "Settings" })).toBeInTheDocument();
    const tiles = screen.getAllByRole("link");
    expect(tiles).toHaveLength(SETTINGS_SECTIONS.length);
    SETTINGS_SECTIONS.forEach((section, index) => {
      expect(tiles[index]).toHaveTextContent(section.title);
      expect(tiles[index]).toHaveTextContent(section.description);
    });
  });

  it.each(SETTINGS_SECTIONS.map((s) => [s.title, s.id]))(
    "opens the %s page from its tile",
    async (title, id) => {
      const { router } = await renderHome();
      await userEvent.click(screen.getByRole("link", { name: new RegExp(title) }));
      expect(router.state.location.pathname).toBe(`/settings/${id}`);
      expect(screen.getByText(`${title} page`)).toBeInTheDocument();
    },
  );
});
