import { createHashRouter, Navigate } from "react-router";
import { lazy } from "react";
import { DashboardLayout } from "./layouts/DashboardLayout";

// Hash URLs because GitHub Pages can't fall back to index.html for deep links
const HomePage = lazy(() => import("./pages/HomePage"));
const ResumeGeneratorPage = lazy(() => import("./pages/resume/ResumeGeneratorPage"));
const SettingsLayout = lazy(() => import("./pages/settings/SettingsLayout"));
const SettingsHome = lazy(() => import("./pages/settings/SettingsHome"));
const ApiKeysSection = lazy(() => import("./pages/settings/ApiKeysSection"));
const ResumeDataSection = lazy(() => import("./pages/settings/ResumeDataSection"));

export const router = createHashRouter([
  {
    path: "/",
    element: <DashboardLayout />,
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
          { path: "*", element: <Navigate to="/settings" replace /> },
        ],
      },
      { path: "*", element: <Navigate to="/" replace /> },
    ],
  },
]);
