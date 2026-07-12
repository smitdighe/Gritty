/** Shared UI constants. */

/**
 * Single commit-log fetch size. Both the commit graph and the commit list read
 * the same `useLog({ max: LOG_MAX })` query so they share one cache entry
 * instead of issuing two overlapping fetches with different keys.
 */
export const LOG_MAX = 500;

/** How many generations the graph renders before offering "load more". */
export const GRAPH_GENERATION_WINDOW = 40;

/** Narrow/wide split for the graph + layout (matches Tailwind's md breakpoint). */
export const WIDE_MEDIA_QUERY = '(min-width: 768px)';
