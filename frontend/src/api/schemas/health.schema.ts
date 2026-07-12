import { z } from 'zod';
import type { Health } from '@/types/domain';

export const healthSchema = z.object({
  ok: z.boolean(),
});

export function parseHealth(data: unknown): Health {
  return healthSchema.parse(data);
}

// --- drift guard.
type MutualEqual<A, B> = [A] extends [B] ? ([B] extends [A] ? true : never) : never;
const _healthOk: MutualEqual<Health, z.infer<typeof healthSchema>> = true;
void _healthOk;
