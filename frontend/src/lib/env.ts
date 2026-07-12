/** Runtime env access (Vite injects strings). */

function num(value: string | undefined, fallback: number): number {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

/** Poll interval for live queries (status/log/branches), ms. */
export const POLL_INTERVAL_MS = num(import.meta.env.VITE_POLL_INTERVAL_MS, 3000);

export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:8000';

export const API_KEY = import.meta.env.VITE_API_KEY ?? '';

export const FEATURE = {
  objectExplorer: import.meta.env.VITE_FEATURE_OBJECT_EXPLORER === 'true',
  diffScrubber: import.meta.env.VITE_FEATURE_DIFF_SCRUBBER === 'true',
} as const;
