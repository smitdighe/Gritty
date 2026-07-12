import { apiClient } from '../client';
import { parseLog } from '../schemas/commit.schema';
import type { LogEntry } from '@/types/domain';

export interface LogParams {
  /** Max commits to return. */
  max?: number;
  /** Revision to start the walk from (defaults to HEAD server-side). */
  start?: string;
}

/** GET /log?max=&start= */
export async function getLog(params: LogParams = {}): Promise<LogEntry[]> {
  const res = await apiClient.get('/log', {
    params: {
      ...(params.max != null ? { max: params.max } : {}),
      ...(params.start != null ? { start: params.start } : {}),
    },
  });
  return parseLog(res.data);
}
