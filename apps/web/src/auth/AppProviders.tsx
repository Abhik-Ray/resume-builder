import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState, type ReactNode } from "react";
import { Outlet } from "react-router";
import { AuthProvider } from "./AuthProvider";

const createQueryClient = () =>
  new QueryClient({
    defaultOptions: {
      // One retry for flaky networks; none in tests so error states show at once
      queries: { retry: import.meta.env.MODE === "test" ? false : 1, staleTime: 30_000 },
    },
  });

// Data and auth for the whole app. Used as the root route, so it sits inside the router.
export const AppProviders = ({ children }: { children?: ReactNode }) => {
  const [queryClient] = useState(createQueryClient);
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>{children ?? <Outlet />}</AuthProvider>
    </QueryClientProvider>
  );
};
