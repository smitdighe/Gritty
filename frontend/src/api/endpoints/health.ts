import { apiClient } from '../client';
import { parseHealth } from '../schemas/health.schema';
import type { Health } from '@/types/domain';

/** GET /health */
export async function getHealth(): Promise<Health> {
  const res = await apiClient.get('/health');
  return parseHealth(res.data);
}
