import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createMemoryRouter, RouterProvider } from "react-router";
import { render } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AppProviders } from "../../auth/AppProviders";
import { supabase } from "../../test/fakeSupabase";
import { fakeSupabase } from "../../test/utils";
import LoginPage from "./LoginPage";

const renderLogin = () => {
  const router = createMemoryRouter(
    [
      {
        element: <AppProviders />,
        children: [
          { path: "/login", element: <LoginPage /> },
          { path: "/", element: <p>Home</p> },
        ],
      },
    ],
    { initialEntries: ["/login"] },
  );
  render(<RouterProvider router={router} />);
  return router;
};

describe("LoginPage", () => {
  beforeEach(() => fakeSupabase.reset({ signedIn: false }));

  it("signs in with Google and returns to the site root", async () => {
    const signIn = vi.spyOn(supabase.auth, "signInWithOAuth");
    renderLogin();
    await userEvent.click(await screen.findByRole("button", { name: "Continue with Google" }));
    expect(signIn).toHaveBeenCalledWith({
      provider: "google",
      options: { redirectTo: `${window.location.origin}${import.meta.env.BASE_URL}` },
    });
  });

  it("shows sign-in errors and lets the user retry", async () => {
    vi.spyOn(supabase.auth, "signInWithOAuth").mockResolvedValue({
      data: {},
      error: new Error("provider disabled"),
    } as never);
    renderLogin();
    const button = await screen.findByRole("button", { name: "Continue with Google" });
    await userEvent.click(button);
    expect(await screen.findByRole("alert")).toHaveTextContent("Sign-in failed: provider disabled");
    expect(button).toBeEnabled();
  });

  it("sends signed-in users home", async () => {
    fakeSupabase.reset();
    const router = renderLogin();
    expect(await screen.findByText("Home")).toBeInTheDocument();
    expect(router.state.location.pathname).toBe("/");
  });
});
