import { apiClient } from '../client';
import { parseCommitResult } from '../schemas/commit.schema';
import type { CommitResult } from '@/types/domain';

/** POST /commits { message } */
export async function createCommit(message: string): Promise<CommitResult> {
  const res = await apiClient.post('/commits', { message });
  return parseCommitResult(res.data);
}
