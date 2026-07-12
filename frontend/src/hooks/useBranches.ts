import { useQuery, type UseQueryOptions } from '@tanstack/react-query';
import { getBranches } from '@/api/endpoints';
import { queryKeys } from '@/lib/queryKeys';
import { POLL_INTERVAL_MS } from '@/lib/env';
import type { BranchList } from '@/types/domain';
import type { GrittyApiError } from '@/api/GrittyApiError';

type Options = Omit<
  UseQueryOptions<BranchList, GrittyApiError, BranchList, ReturnType<typeof queryKeys.branches>>,
  'queryKey' | 'queryFn'
>;

/** Live branch list — polls while mounted, paused while the tab is hidden. */
export function useBranches(options?: Options) {
  return useQuery({
    queryKey: queryKeys.branches(),
    queryFn: () => getBranches(),
    refetchInterval: POLL_INTERVAL_MS,
    refetchIntervalInBackground: false,
    ...options,
  });
}
