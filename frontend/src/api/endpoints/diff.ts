import { apiClient } from '../client';
import { parseDiff } from '../schemas/diff.schema';
import type { DiffChange } from '@/types/domain';

export interface DiffParams {
  /** Old commit-ish for a commit-vs-commit diff. */
  a?: string;
  /** New commit-ish for a commit-vs-commit diff. */
  b?: string;
}

/**
 * GET /diff (worktree-vs-index) or GET /diff?a=&b= (commit-vs-commit).
 * Returns one {@link DiffChange} per changed file.
 * NOTE: response shape is an assumption — see diff.schema.ts.
 */
export async function getDiff(params: DiffParams = {}): Promise<DiffChange[]> {
  const res = await apiClient.get('/diff', {
    params: {
      ...(params.a != null ? { a: params.a } : {}),
      ...(params.b != null ? { b: params.b } : {}),
    },
  });
  return parseDiff(res.data);
}
