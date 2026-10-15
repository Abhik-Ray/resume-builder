import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createMemoryRouter, RouterProvider } from "react-router";
import { describe, expect, it } from "vitest";
import { DashboardLayout } from "./DashboardLayout";

const renderAt = (path: string) => {
  const router = createMemoryRouter(
    [
      {
        path: "/",
        element: <DashboardLayout />,
        children: [
          { index: true, element: <p>Home content</p> },
          { path: "resume", element: <p>Resume content</p> },
          { path: "settings/*", element: <p>Settings content</p> },
        ],
      },
    ],
    { initialEntries: [path] },
  );
  render(<RouterProvider router={router} />);
  return router;
};

describe("DashboardLayout", () => {
  it("renders the navigation and the current page", () => {
    renderAt("/");
    for (const name of ["Home", "Resume", "Settings"]) {
      expect(screen.getByRole("link", { name })).toBeInTheDocument();
    }
    expect(screen.getByText("Home content")).toBeInTheDocument();
  });

  it("marks only the active link as current", () => {
    renderAt("/resume");
    expect(screen.getByRole("link", { name: "Resume" })).toHaveAttribute("aria-current", "page");
    // Home uses `end`, so it is not active on child routes
    expect(screen.getByRole("link", { name: "Home" })).not.toHaveAttribute("aria-current");
  });

  it("keeps Settings active on its sub pages", () => {
    renderAt("/settings/api-keys");
    expect(screen.getByRole("link", { name: "Settings" })).toHaveAttribute(
      "aria-current",
      "page",
    );
  });

  it("navigates between pages", async () => {
    const router = renderAt("/");
    await userEvent.click(screen.getByRole("link", { name: "Settings" }));
    expect(screen.getByText("Settings content")).toBeInTheDocument();
    expect(router.state.location.pathname).toBe("/settings");
  });
});
