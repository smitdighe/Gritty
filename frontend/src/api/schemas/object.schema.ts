import { z } from 'zod';
import type { TreeEntry, GritObject } from '@/types/domain';
import { commitSchema } from './commit.schema';

export const treeEntrySchema = z.object({
  mode: z.string(),
  name: z.string(),
  sha: z.string(),
});

/**
 * GET /objects/:sha, discriminated on `type`:
 *  - blob:   content is base64-encoded file bytes (a string)
 *  - tree:   content is the list of entries
 *  - commit: content is the parsed commit
 */
export const gritObjectSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('blob'), size: z.number(), content: z.string() }),
  z.object({ type: z.literal('tree'), size: z.number(), content: z.array(treeEntrySchema) }),
  z.object({ type: z.literal('commit'), size: z.number(), content: commitSchema }),
]);

export function parseTreeEntry(data: unknown): TreeEntry {
  return treeEntrySchema.parse(data);
}

export function parseObject(data: unknown): GritObject {
  return gritObjectSchema.parse(data);
}

// --- drift guard.
type MutualEqual<A, B> = [A] extends [B] ? ([B] extends [A] ? true : never) : never;
const _entryOk: MutualEqual<TreeEntry, z.infer<typeof treeEntrySchema>> = true;
const _objectOk: MutualEqual<GritObject, z.infer<typeof gritObjectSchema>> = true;
void _entryOk;
void _objectOk;
