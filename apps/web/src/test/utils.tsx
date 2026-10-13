import { render } from "@testing-library/react";
import type { ReactNode } from "react";
import { createMemoryRouter, RouterProvider, type RouteObject } from "react-router";
import type { ResumeDataType } from "../types/input";
import { AppProviders } from "../auth/AppProviders";
import { RequireAuth } from "../auth/RequireAuth";
import { markDetailsPromptShown } from "../auth/session";
import { DEFAULT_RESUME_DATA } from "../data/ResumeData";
import { db } from "../db/db";
import { fakeSupabase, TEST_USER } from "./fakeSupabase";

export { fakeSupabase, TEST_USER };

// Wipes every table; the next query reopens the database
export const resetDb = async () => {
  await db.delete();
  await db.open();
};

// Renders `element` at `path` inside a data router (needed for useBlocker, Link, ...), behind
// the sign-in guard with the query client and auth session the app provides. The details
// prompt after sign-in is skipped unless `detailsPrompt` is set.
export const renderWithRouter = (
  element: ReactNode,
  {
    path = "/",
    routes = [],
    detailsPrompt = false,
  }: { path?: string; routes?: RouteObject[]; detailsPrompt?: boolean } = {},
) => {
  if (!detailsPrompt) markDetailsPromptShown(TEST_USER.id);
  const router = createMemoryRouter(
    [
      {
        element: <AppProviders />,
        children: [
          { path, element: <RequireAuth>{element}</RequireAuth> },
          ...routes,
          { path: "/login", element: <p>Login page</p> },
          { path: "*", element: <p>Elsewhere</p> },
        ],
      },
    ],
    { initialEntries: [path] },
  );
  return { router, ...render(<RouterProvider router={router} />) };
};

// A profile for the signed-in test user; complete (resume data and home location) by default
export const seedProfile = (
  patch: Record<string, unknown> = {},
  resume: ResumeDataType | null = DEFAULT_RESUME_DATA,
) =>
  fakeSupabase.seed("profiles", [
    {
      user_id: TEST_USER.id,
      resume_data: resume,
      home_city: "Bengaluru",
      home_country: "IN",
      details_completed_at: "2026-01-01T00:00:00.000Z",
      ...patch,
    },
  ]);

export const profileRow = () => fakeSupabase.rows("profiles").find((r) => r.user_id === TEST_USER.id);

// Fake keys: tests never reach a provider
export const GEMINI_KEY = "AIzaTestKey_0123456789abcdefghijklmnopq";
export const OPENAI_KEY = "sk-test-openai-0123456789abcdef";
export const ANTHROPIC_KEY = "sk-ant-test-0123456789abcdef";
