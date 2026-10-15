import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createMemoryRouter, RouterProvider } from "react-router";
import { describe, expect, it } from "vitest";
import SettingsLayout from "./SettingsLayout";

const renderAt = (path: string) => {
  const router = createMemoryRouter(
    [
      {
        path: "/settings",
        element: <SettingsLayout />,
        children: [
          { index: true, element: <p>Tiles</p> },
          { path: "api-keys", element: <p>Keys page</p> },
        ],
      },
    ],
    { initialEntries: [path] },
  );
  render(<RouterProvider router={router} />);
  return router;
};

describe("SettingsLayout", () => {
  it("has no back link on the tile grid", () => {
    renderAt("/settings");
    expect(screen.getByText("Tiles")).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Settings" })).not.toBeInTheDocument();
  });

  it("treats a trailing slash as the tile grid", () => {
    renderAt("/settings/");
    expect(screen.queryByRole("link", { name: "Settings" })).not.toBeInTheDocument();
  });

  it("shows a back link on section pages", async () => {
    const router = renderAt("/settings/api-keys");
    expect(screen.getByText("Keys page")).toBeInTheDocument();

    await userEvent.click(screen.getByRole("link", { name: "Settings" }));
    expect(router.state.location.pathname).toBe("/settings");
    expect(screen.getByText("Tiles")).toBeInTheDocument();
  });
});
