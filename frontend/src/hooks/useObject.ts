import { useQuery, type UseQueryOptions } from '@tanstack/react-query';
import { getObject } from '@/api/endpoints';
import { queryKeys } from '@/lib/queryKeys';
import type { GritObject } from '@/types/domain';
import type { GrittyApiError } from '@/api/GrittyApiError';

type Options = Omit<
  UseQueryOptions<GritObject, GrittyApiError, GritObject, ReturnType<typeof queryKeys.object>>,
  'queryKey' | 'queryFn'
>;

/**
 * Fetch a single object; disabled automatically when `sha` is empty. Objects
 * are content-addressed (hash.js rule #1) — immutable once written — so this
 * never polls and never goes stale: fetch once, cache forever.
 */
export function useObject(sha: string, options?: Options) {
  return useQuery({
    queryKey: queryKeys.object(sha),
    queryFn: () => getObject(sha),
    enabled: sha.length > 0,
    staleTime: Infinity,
    gcTime: Infinity,
    refetchInterval: false,
    ...options,
  });
}
