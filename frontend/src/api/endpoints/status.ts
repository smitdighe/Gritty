import { apiClient } from '../client';
import { parseStatus } from '../schemas/status.schema';
import type { RepoStatus } from '@/types/domain';

/** GET /status */
export async function getStatus(): Promise<RepoStatus> {
  const res = await apiClient.get('/status');
  return parseStatus(res.data);
}
