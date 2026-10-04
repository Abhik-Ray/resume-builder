import { render, screen } from "@testing-library/react";
import { createMemoryRouter, RouterProvider } from "react-router";
import { beforeEach, describe, expect, it } from "vitest";
import { routes } from "./router";
import { resetDb } from "./test/utils";

// Pages are lazy-loaded; the first import can be slow (e.g. under coverage)
const LAZY = { timeout: 5000 };

const renderAt = (path: string) => {
  const router = createMemoryRouter(routes, { initialEntries: [path] });
  render(<RouterProvider router={router} />);
  return router;
};

describe("routes", () => {
  beforeEach(resetDb);

  it("shows the dashboard home at /", async () => {
    renderAt("/");
    expect(await screen.findByRole("heading", { name: "Dashboard" }, LAZY)).toBeInTheDocument();
  });

  it("shows the resume generator at /resume", async () => {
    renderAt("/resume");
    expect(await screen.findByRole("heading", { name: "Resume" }, LAZY)).toBeInTheDocument();
    expect(await screen.findByLabelText("Job description", undefined, LAZY)).toBeInTheDocument();
  });

  it("shows the settings tiles at /settings", async () => {
    renderAt("/settings");
    expect(await screen.findByRole("heading", { name: "Settings" }, LAZY)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /API Keys/ })).toBeInTheDocument();
  });

  it("shows the API keys page at /settings/api-keys", async () => {
    renderAt("/settings/api-keys");
    expect(await screen.findByRole("heading", { name: "API keys" }, LAZY)).toBeInTheDocument();
  });

  it("shows the resume data page at /settings/resume-data", async () => {
    renderAt("/settings/resume-data");
    expect(await screen.findByRole("heading", { name: "Resume data" }, LAZY)).toBeInTheDocument();
  });

  it("shows the appearance page at /settings/appearance", async () => {
    renderAt("/settings/appearance");
    expect(await screen.findByRole("heading", { name: "Appearance" }, LAZY)).toBeInTheDocument();
  });

  it("sends unknown settings pages back to the tiles", async () => {
    const router = renderAt("/settings/nope");
    expect(await screen.findByRole("link", { name: /Resume Data/ }, LAZY)).toBeInTheDocument();
    expect(router.state.location.pathname).toBe("/settings");
  });

  it("sends unknown pages home", async () => {
    const router = renderAt("/does-not-exist");
    expect(await screen.findByRole("heading", { name: "Dashboard" }, LAZY)).toBeInTheDocument();
    expect(router.state.location.pathname).toBe("/");
  });
});
