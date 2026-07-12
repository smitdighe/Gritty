import { useQuery, type UseQueryOptions } from '@tanstack/react-query';
import { getLog, type LogParams } from '@/api/endpoints';
import { queryKeys } from '@/lib/queryKeys';
import { POLL_INTERVAL_MS } from '@/lib/env';
import type { LogEntry } from '@/types/domain';
import type { GrittyApiError } from '@/api/GrittyApiError';

type Options = Omit<
  UseQueryOptions<LogEntry[], GrittyApiError, LogEntry[], ReturnType<typeof queryKeys.log>>,
  'queryKey' | 'queryFn'
>;

/** Live commit log — polls while mounted, paused while the tab is hidden. */
export function useLog(params: LogParams = {}, options?: Options) {
  return useQuery({
    queryKey: queryKeys.log(params),
    queryFn: () => getLog(params),
    refetchInterval: POLL_INTERVAL_MS,
    refetchIntervalInBackground: false,
    ...options,
  });
}
