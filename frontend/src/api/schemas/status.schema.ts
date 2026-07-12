import { z } from 'zod';
import type { StatusChange, RepoStatus } from '@/types/domain';

export const statusChangeTypeSchema = z.enum(['new file', 'modified', 'deleted']);

export const statusChangeSchema = z.object({
  path: z.string(),
  type: statusChangeTypeSchema,
});

export const repoStatusSchema = z.object({
  branch: z.string().nullable(),
  headSha: z.string().nullable(),
  staged: z.array(statusChangeSchema),
  unstaged: z.array(statusChangeSchema),
  untracked: z.array(z.string()),
});

export function parseStatus(data: unknown): RepoStatus {
  return repoStatusSchema.parse(data);
}

// --- drift guard.
type MutualEqual<A, B> = [A] extends [B] ? ([B] extends [A] ? true : never) : never;
const _changeOk: MutualEqual<StatusChange, z.infer<typeof statusChangeSchema>> = true;
const _statusOk: MutualEqual<RepoStatus, z.infer<typeof repoStatusSchema>> = true;
void _changeOk;
void _statusOk;
