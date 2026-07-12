import { useMemo } from 'react';
import { cn } from '@/lib/cn';
import { shortenSha } from '@/lib/format';
import { Badge } from '@/components/ui/Badge';
import { HashRevealText } from '@/features/object-explorer/HashRevealText';
import { isPendingSha } from '@/hooks/optimistic';
import type { GraphModel, GraphNode } from './layout';

export interface CompactGraphProps {
  model: GraphModel;
  selectedSha: string | null;
  onSelect: (sha: string) => void;
}

/**
 * Narrow-viewport fallback for the commit graph. reactflow's pan/zoom canvas is
 * unusable on a phone, so below the md breakpoint the same layout model renders
 * as a legible vertical list (newest first) with branch/HEAD badges on the node
 * they point at. No pan/zoom, no motion travel — just the current state.
 */
export function CompactGraph({ model, selectedSha, onSelect }: CompactGraphProps) {
  const headSha = model.head.kind === 'unborn' ? null : model.head.sha;

  const pillsByNode = useMemo(() => {
    const map = new Map<string, { label: string; variant: 'branch' | 'head' | 'muted' }[]>();
    const add = (nodeId: string, pill: { label: string; variant: 'branch' | 'head' | 'muted' }) => {
      const list = map.get(nodeId) ?? [];
      list.push(pill);
      map.set(nodeId, list);
    };
    for (const bp of model.branchPointers) {
      if (bp.nodeId) add(bp.nodeId, { label: bp.name, variant: 'branch' });
    }
    if (model.head.kind !== 'unborn' && model.head.nodeId) {
      add(model.head.nodeId, {
        label: model.head.kind === 'detached' ? `HEAD (detached)` : 'HEAD',
        variant: 'head',
      });
    }
    return map;
  }, [model]);

  // Newest first.
  const ordered = useMemo(
    () =>
      [...model.nodes].sort(
        (a, b) => b.generation - a.generation || b.commit.committer.timestamp - a.commit.committer.timestamp,
      ),
    [model.nodes],
  );

  return (
    <ul className="flex flex-col divide-y divide-border-muted">
      {ordered.map((n) => (
        <CompactRow
          key={n.id}
          node={n}
          pills={pillsByNode.get(n.id) ?? []}
          isSelected={n.sha === selectedSha}
          isHead={n.sha === headSha}
          onSelect={onSelect}
        />
      ))}
    </ul>
  );
}

function CompactRow({
  node,
  pills,
  isSelected,
  isHead,
  onSelect,
}: {
  node: GraphNode;
  pills: { label: string; variant: 'branch' | 'head' | 'muted' }[];
  isSelected: boolean;
  isHead: boolean;
  onSelect: (sha: string) => void;
}) {
  const pending = isPendingSha(node.sha);
  return (
    <li>
      <button
        type="button"
        onClick={() => onSelect(node.sha)}
        className={cn(
          'flex w-full items-start gap-2 px-3 py-2 text-left transition-colors',
          'outline-none focus-visible:ring-2 focus-visible:ring-accent',
          isSelected ? 'bg-accent-muted' : 'hover:bg-bg-hover',
        )}
      >
        <span
          className={cn(
            'mt-1 h-2 w-2 shrink-0 rounded-full',
            pending ? 'bg-tag motion-safe:animate-pulse-soft' : isHead ? 'bg-accent' : 'bg-hash-400',
          )}
        />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            {pending ? (
              <span className="text-xs text-tag">committing…</span>
            ) : (
              <HashRevealText value={shortenSha(node.sha)} className="text-xs text-hash" />
            )}
            <span className="truncate text-sm text-fg">{node.commit.message.split('\n')[0]}</span>
          </div>
          <div className="mt-0.5 flex flex-wrap items-center gap-1">
            <span className="text-xs text-fg-faint">{node.commit.author.name}</span>
            {pills.map((p) => (
              <Badge key={p.label} variant={p.variant === 'head' ? 'head' : 'branch'}>
                {p.label}
              </Badge>
            ))}
          </div>
        </div>
      </button>
    </li>
  );
}
