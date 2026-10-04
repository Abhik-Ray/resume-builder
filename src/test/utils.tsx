import { render } from "@testing-library/react";
import type { ReactNode } from "react";
import { createMemoryRouter, RouterProvider, type RouteObject } from "react-router";
import { db } from "../db/db";

// Wipes every table; the next query reopens the database
export const resetDb = async () => {
  await db.delete();
  await db.open();
};

// Renders `element` at `path` inside a data router (needed for useBlocker, Link, ...)
export const renderWithRouter = (
  element: ReactNode,
  { path = "/", routes = [] }: { path?: string; routes?: RouteObject[] } = {},
) => {
  const router = createMemoryRouter(
    [{ path, element }, ...routes, { path: "*", element: <p>Elsewhere</p> }],
    { initialEntries: [path] },
  );
  return { router, ...render(<RouterProvider router={router} />) };
};

export const GEMINI_KEY = "AIzaTestKey_0123456789abcdefghijklmnopq";
