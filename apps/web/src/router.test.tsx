import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createMemoryRouter, RouterProvider } from "react-router";
import { beforeEach, describe, expect, it } from "vitest";
import { markDetailsPromptShown } from "./auth/session";
import { routes } from "./router";
import { fakeSupabase, resetDb, seedProfile, TEST_USER } from "./test/utils";

// Pages are lazy-loaded; the first import can be slow (e.g. under coverage)
const LAZY = { timeout: 5000 };

const renderAt = (path: string) => {
  const router = createMemoryRouter(routes, { initialEntries: [path] });
  render(<RouterProvider router={router} />);
  return router;
};

describe("routes", () => {
  beforeEach(async () => {
    await resetDb();
    seedProfile();
  });

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

describe("sign-in", () => {
  beforeEach(resetDb);

  it("sends signed-out visitors to the login page", async () => {
    fakeSupabase.reset({ signedIn: false });
    const router = renderAt("/resume");
    expect(
      await screen.findByRole("button", { name: "Continue with Google" }, LAZY),
    ).toBeInTheDocument();
    expect(router.state.location.pathname).toBe("/login");
  });

  it("sends signed-in users from the login page home", async () => {
    seedProfile();
    markDetailsPromptShown(TEST_USER.id);
    const router = renderAt("/login");
    expect(await screen.findByRole("heading", { name: "Dashboard" }, LAZY)).toBeInTheDocument();
    expect(router.state.location.pathname).toBe("/");
  });

  it("returns to the login page after signing out", async () => {
    seedProfile();
    markDetailsPromptShown(TEST_USER.id);
    const router = renderAt("/");
    await screen.findByRole("heading", { name: "Dashboard" }, LAZY);
    await userEvent.click(screen.getByRole("button", { name: "Sign out" }));
    expect(
      await screen.findByRole("button", { name: "Continue with Google" }, LAZY),
    ).toBeInTheDocument();
    expect(router.state.location.pathname).toBe("/login");
  });
});

describe("details prompt", () => {
  beforeEach(resetDb);

  it("opens the Details page after sign-in when details are missing", async () => {
    const router = renderAt("/");
    expect(
      await screen.findByText("Fill in your details to get started.", undefined, LAZY),
    ).toBeInTheDocument();
    expect(router.state.location.pathname).toBe("/settings/resume-data");
  });

  it("prompts once per sign-in, so other pages stay reachable", async () => {
    const router = renderAt("/");
    await screen.findByText("Fill in your details to get started.", undefined, LAZY);
    await router.navigate("/settings");
    expect(await screen.findByRole("heading", { name: "Settings" }, LAZY)).toBeInTheDocument();
    expect(router.state.location.pathname).toBe("/settings");
  });

  it("prompts again after signing out and back in", async () => {
    const router = renderAt("/");
    await screen.findByText("Fill in your details to get started.", undefined, LAZY);
    await router.navigate("/");
    await screen.findByRole("heading", { name: "Dashboard" }, LAZY);

    await userEvent.click(screen.getByRole("button", { name: "Sign out" }));
    await screen.findByRole("button", { name: "Continue with Google" }, LAZY);
    act(() => fakeSupabase.signIn());
    await router.navigate("/");
    expect(
      await screen.findByText("Fill in your details to get started.", undefined, LAZY),
    ).toBeInTheDocument();
  });

  it("doesn't prompt when the details are complete", async () => {
    seedProfile();
    renderAt("/");
    expect(await screen.findByRole("heading", { name: "Dashboard" }, LAZY)).toBeInTheDocument();
  });
});
