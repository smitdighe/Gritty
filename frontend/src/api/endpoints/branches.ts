import { apiClient } from '../client';
import { branchRefSchema, parseBranchList } from '../schemas/branch.schema';
import type { BranchList, BranchRef } from '@/types/domain';

/** GET /branches */
export async function getBranches(): Promise<BranchList> {
  const res = await apiClient.get('/branches');
  return parseBranchList(res.data);
}

/**
 * POST /branches { name }. The wrapper may return 204 (no body) or the created
 * branch — return the parsed {@link BranchRef} when a body is present, else null.
 */
export async function createBranch(name: string): Promise<BranchRef | null> {
  const res = await apiClient.post('/branches', { name });
  if (res.status === 204 || res.data == null || res.data === '') return null;
  return branchRefSchema.parse(res.data);
}
