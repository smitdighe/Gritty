import { apiClient } from '../client';
import { parseCheckoutResult } from '../schemas/branch.schema';
import type { CheckoutResult } from '@/types/domain';

/** POST /checkout { target } */
export async function checkout(target: string): Promise<CheckoutResult> {
  const res = await apiClient.post('/checkout', { target });
  return parseCheckoutResult(res.data);
}
