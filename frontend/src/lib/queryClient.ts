import { QueryClient } from '@tanstack/react-query';

/**
 * App query client. No polling here (that's phase 6); retries are disabled
 * because the axios layer already does a single network-failure retry and
 * throws typed GrittyApiError — react-query retrying 4xx would be wrong.
 */
export function createQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        refetchOnWindowFocus: false,
        staleTime: 1000,
      },
      mutations: {
        retry: false,
      },
    },
  });
}
