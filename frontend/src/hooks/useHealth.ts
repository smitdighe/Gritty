import { useQuery, type UseQueryOptions } from '@tanstack/react-query';
import { getHealth } from '@/api/endpoints';
import { queryKeys } from '@/lib/queryKeys';
import type { Health } from '@/types/domain';
import type { GrittyApiError } from '@/api/GrittyApiError';

type Options = Omit<
  UseQueryOptions<Health, GrittyApiError, Health, ReturnType<typeof queryKeys.health>>,
  'queryKey' | 'queryFn'
>;

export function useHealth(options?: Options) {
  return useQuery({
    queryKey: queryKeys.health(),
    queryFn: () => getHealth(),
    ...options,
  });
}
