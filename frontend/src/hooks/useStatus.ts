import { useQuery, type UseQueryOptions } from '@tanstack/react-query';
import { getStatus } from '@/api/endpoints';
import { queryKeys } from '@/lib/queryKeys';
import { POLL_INTERVAL_MS } from '@/lib/env';
import type { RepoStatus } from '@/types/domain';
import type { GrittyApiError } from '@/api/GrittyApiError';

type Options = Omit<
  UseQueryOptions<RepoStatus, GrittyApiError, RepoStatus, ReturnType<typeof queryKeys.status>>,
  'queryKey' | 'queryFn'
>;

/**
 * Live status. Polls every VITE_POLL_INTERVAL_MS while mounted; the interval is
 * per active observer, so it stops when no component renders it, and
 * refetchIntervalInBackground:false pauses it while the tab is hidden.
 */
export function useStatus(options?: Options) {
  return useQuery({
    queryKey: queryKeys.status(),
    queryFn: () => getStatus(),
    refetchInterval: POLL_INTERVAL_MS,
    refetchIntervalInBackground: false,
    ...options,
  });
}
