/**
 * reactflow paints edge strokes and the background via JS color values, not
 * Tailwind classes, so these must be literal hex. They mirror the phase-1
 * theme tokens in tailwind.config.ts exactly — keep them in sync:
 *   mainlineEdge → accent.soft   (#1f6feb)
 *   mergeEdge    → hash.DEFAULT  (#8b949e)
 *   background   → border.muted  (#21262d)
 */
export const GRAPH_COLORS = {
  mainlineEdge: '#1f6feb',
  mergeEdge: '#8b949e',
  background: '#21262d',
} as const;

export const GRAPH_EDGE = {
  mainline: { stroke: GRAPH_COLORS.mainlineEdge, strokeWidth: 2 },
  merge: { stroke: GRAPH_COLORS.mergeEdge, strokeWidth: 1.5, strokeDasharray: '4 3' },
} as const;
