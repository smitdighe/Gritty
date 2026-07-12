import { z } from 'zod';
import type { BranchRef, BranchList, CheckoutResult } from '@/types/domain';

export const branchRefSchema = z.object({
  name: z.string(),
  sha: z.string(),
});

export const branchListSchema = z.object({
  branches: z.array(branchRefSchema),
  current: z.string().nullable(),
});

export const checkoutResultSchema = z.object({
  switchedTo: z.string(),
  detached: z.boolean(),
});

export function parseBranchList(data: unknown): BranchList {
  return branchListSchema.parse(data);
}

export function parseBranchRef(data: unknown): BranchRef {
  return branchRefSchema.parse(data);
}

export function parseCheckoutResult(data: unknown): CheckoutResult {
  return checkoutResultSchema.parse(data);
}

// --- drift guard.
type MutualEqual<A, B> = [A] extends [B] ? ([B] extends [A] ? true : never) : never;
const _refOk: MutualEqual<BranchRef, z.infer<typeof branchRefSchema>> = true;
const _listOk: MutualEqual<BranchList, z.infer<typeof branchListSchema>> = true;
const _checkoutOk: MutualEqual<CheckoutResult, z.infer<typeof checkoutResultSchema>> = true;
void _refOk;
void _listOk;
void _checkoutOk;
