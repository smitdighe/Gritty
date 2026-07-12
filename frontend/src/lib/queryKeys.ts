import type { LogParams } from '@/api/endpoints/log';
import type { DiffParams } from '@/api/endpoints/diff';

/**
 * Centralized react-query keys. Hierarchical + `as const` so partial keys can
 * target broad invalidation (e.g. `queryKeys.log()` invalidates every log
 * query regardless of params).
 */
export const queryKeys = {
  health: () => ['health'] as const,
  status: () => ['status'] as const,
  log: (params: LogParams = {}) => ['log', params] as const,
  diff: (params: DiffParams = {}) => ['diff', params] as const,
  branches: () => ['branches'] as const,
  object: (sha: string) => ['object', sha] as const,
} as const;

/** Root segments, for coarse invalidation of a whole resource family. */
export const queryKeyRoots = {
  health: ['health'] as const,
  status: ['status'] as const,
  log: ['log'] as const,
  diff: ['diff'] as const,
  branches: ['branches'] as const,
  object: ['object'] as const,
} as const;
