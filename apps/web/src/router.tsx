import { createHashRouter, Navigate, type RouteObject } from "react-router";
import { lazy, Suspense } from "react";
import { DashboardLayout } from "./layouts/DashboardLayout";
import { AppProviders } from "./auth/AppProviders";
import { RequireAuth } from "./auth/RequireAuth";

// Hash URLs because GitHub Pages can't fall back to index.html for deep links
const LoginPage = lazy(() => import("./pages/login/LoginPage"));
const HomePage = lazy(() => import("./pages/HomePage"));
const ResumeGeneratorPage = lazy(() => import("./pages/resume/ResumeGeneratorPage"));
const SettingsLayout = lazy(() => import("./pages/settings/SettingsLayout"));
const SettingsHome = lazy(() => import("./pages/settings/SettingsHome"));
const ApiKeysSection = lazy(() => import("./pages/settings/ApiKeysSection"));
const ResumeDataSection = lazy(() => import("./pages/settings/ResumeDataSection"));
const AppearanceSection = lazy(() => import("./pages/settings/AppearanceSection"));

// Exported separately so tests can mount them in a memory router
export const routes: RouteObject[] = [
  {
    // Query client and auth session for every page
    element: <AppProviders />,
    children: [
      {
        path: "login",
        element: (
          <Suspense fallback={null}>
            <LoginPage />
          </Suspense>
        ),
      },
      {
        path: "/",
        element: (
          <RequireAuth>
            <DashboardLayout />
          </RequireAuth>
        ),
        children: [
          { index: true, element: <HomePage /> },
          { path: "resume", element: <ResumeGeneratorPage /> },
          {
            path: "settings",
            element: <SettingsLayout />,
            // Paths match the ids in pages/settings/sections.ts (the tile grid)
            children: [
              { index: true, element: <SettingsHome /> },
              { path: "api-keys", element: <ApiKeysSection /> },
              { path: "resume-data", element: <ResumeDataSection /> },
              { path: "appearance", element: <AppearanceSection /> },
              { path: "*", element: <Navigate to="/settings" replace /> },
            ],
          },
          { path: "*", element: <Navigate to="/" replace /> },
        ],
      },
    ],
  },
];

export const router = createHashRouter(routes);
