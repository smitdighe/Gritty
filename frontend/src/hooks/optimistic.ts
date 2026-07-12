import type { QueryClient, QueryKey } from '@tanstack/react-query';

/** A captured (key, data) pair for optimistic rollback. */
export type QuerySnapshot = [QueryKey, unknown][];

/** Snapshot every cached query under the given root keys, for later rollback. */
export function captureQueries(qc: QueryClient, roots: QueryKey[]): QuerySnapshot {
  const out: QuerySnapshot = [];
  for (const root of roots) {
    for (const [key, data] of qc.getQueriesData({ queryKey: root })) {
      out.push([key, data]);
    }
  }
  return out;
}

/** Restore a snapshot produced by {@link captureQueries}. */
export function restoreQueries(qc: QueryClient, snap: QuerySnapshot): void {
  for (const [key, data] of snap) {
    qc.setQueryData(key, data);
  }
}

/** Marker prefix for an optimistic, not-yet-confirmed commit sha. */
export const PENDING_PREFIX = 'pending-';

export function isPendingSha(sha: string): boolean {
  return sha.startsWith(PENDING_PREFIX);
}

export function makePendingSha(): string {
  return `${PENDING_PREFIX}${Date.now()}-${Math.random().toString(16).slice(2, 8)}`;
}
