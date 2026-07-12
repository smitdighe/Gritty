import { z } from 'zod';
import type { DiffChange } from '@/types/domain';

/**
 * !!! UNCONFIRMED RESPONSE SHAPE — NEEDS VERIFICATION AGAINST THE REAL WRAPPER !!!
 *
 * No REST wrapper exists in the backend yet (backend is core + CLI only), so the
 * /diff response shape cannot be observed. dag/diff.js produces a raw unified
 * diff STRING per file via `unifiedDiff(...)` (the `diff --git a/… b/…` block).
 *
 * DOCUMENTED ASSUMPTION (per phase-2 spec): /diff returns an ARRAY of
 * `{ path, diffText }`, one element per changed file, where `diffText` is that
 * exact unified-diff block. Both /diff (worktree-vs-index) and /diff?a=&b=
 * (commit-vs-commit) are assumed to share this shape.
 *
 * TODO(confirm): the wrapper might instead return a single concatenated diff
 * string, or structured hunks `{ path, hunks: [...] }`. If so, update this
 * schema + DiffChange + the /diff endpoint together. See final report.
 */
export const diffChangeSchema = z.object({
  path: z.string(),
  diffText: z.string(),
});

export const diffSchema = z.array(diffChangeSchema);

export function parseDiff(data: unknown): DiffChange[] {
  return diffSchema.parse(data);
}

// --- drift guard.
type MutualEqual<A, B> = [A] extends [B] ? ([B] extends [A] ? true : never) : never;
const _diffOk: MutualEqual<DiffChange, z.infer<typeof diffChangeSchema>> = true;
void _diffOk;
