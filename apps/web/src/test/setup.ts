// IndexedDB for Dexie, and DOM matchers like toBeInTheDocument
import "fake-indexeddb/auto";
import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterEach, beforeEach, vi } from "vitest";
import { fakeSupabase } from "./fakeSupabase";

// Supabase is in-memory in every test, with a signed-in user and no rows
vi.mock("../lib/supabase", () => import("./fakeSupabase"));

beforeEach(() => fakeSupabase.reset());

afterEach(() => {
  cleanup();
  localStorage.clear();
  sessionStorage.clear();
});
