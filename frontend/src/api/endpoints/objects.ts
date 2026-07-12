import { apiClient } from '../client';
import { parseObject } from '../schemas/object.schema';
import type { GritObject } from '@/types/domain';

/** GET /objects/:sha */
export async function getObject(sha: string): Promise<GritObject> {
  const res = await apiClient.get(`/objects/${encodeURIComponent(sha)}`);
  return parseObject(res.data);
}
