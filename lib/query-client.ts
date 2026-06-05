import { QueryClient } from "@tanstack/react-query";

/**
 * Shared QueryClient instance for React Query.
 * API calls are now handled directly through lib/api.ts using Bearer token auth.
 */
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchInterval: false,
      refetchOnWindowFocus: false,
      staleTime: 5 * 60 * 1000,
      retry: 1,
    },
    mutations: {
      retry: false,
    },
  },
});
