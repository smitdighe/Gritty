import { z } from 'zod';
import type { GrittyApiErrorBody } from '@/types/domain';

/**
 * Error body the wrapper surfaces for a typed backend GrittyError
 * (util/errors.js). `code` is a stable machine-readable string such as
 * NotARepo / BadObject / RefNotFound / UsageError.
 */
export const grittyApiErrorBodySchema = z.object({
  error: z.object({
    code: z.string(),
    message: z.string(),
  }),
});

export function parseApiErrorBody(data: unknown): GrittyApiErrorBody {
  return grittyApiErrorBodySchema.parse(data);
}

/** Loose check used by the interceptor to decide if a 4xx/5xx body is a GrittyError. */
export function isGrittyApiErrorBody(data: unknown): data is GrittyApiErrorBody {
  return grittyApiErrorBodySchema.safeParse(data).success;
}

// --- drift guard.
type MutualEqual<A, B> = [A] extends [B] ? ([B] extends [A] ? true : never) : never;
const _errOk: MutualEqual<GrittyApiErrorBody, z.infer<typeof grittyApiErrorBodySchema>> = true;
void _errOk;
