import { useQuery, type UseQueryOptions } from '@tanstack/react-query';
import { getDiff, type DiffParams } from '@/api/endpoints';
import { queryKeys } from '@/lib/queryKeys';
import type { DiffChange } from '@/types/domain';
import type { GrittyApiError } from '@/api/GrittyApiError';

type Options = Omit<
  UseQueryOptions<DiffChange[], GrittyApiError, DiffChange[], ReturnType<typeof queryKeys.diff>>,
  'queryKey' | 'queryFn'
>;

/**
 * Diff query. A commit-vs-commit diff (`a` and `b` both set) is immutable —
 * both trees are content-addressed — so it never polls and never goes stale.
 * A worktree diff (no `a`/`b`) is refreshed by mutation invalidation, not
 * polled here.
 */
export function useDiff(params: DiffParams = {}, options?: Options) {
  const immutable = params.a != null && params.b != null;
  return useQuery({
    queryKey: queryKeys.diff(params),
    queryFn: () => getDiff(params),
    ...(immutable ? { staleTime: Infinity, gcTime: Infinity, refetchInterval: false as const } : {}),
    ...options,
  });
}
