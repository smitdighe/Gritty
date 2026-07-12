import { memo } from 'react';
import { Handle, Position, type NodeProps } from 'reactflow';
import { cn } from '@/lib/cn';
import { shortenSha } from '@/lib/format';
import { HashRevealText } from '@/features/object-explorer/HashRevealText';

export interface CommitNodeData {
  sha: string;
  subject: string;
  author: string;
  isSelected: boolean;
  isHeadTarget: boolean;
  isAncestor: boolean;
  /** Dim only when some *other* commit is selected. */
  dimmed: boolean;
  hasHiddenParents: boolean;
  /** Optimistic, not-yet-confirmed commit awaiting the server's real sha. */
  isPending: boolean;
}

export const COMMIT_NODE_WIDTH = 148;
export const COMMIT_NODE_HEIGHT = 48;

/** Custom reactflow node: short sha (hash-reveal), subject, author, highlights. */
function CommitNodeImpl({ data }: NodeProps<CommitNodeData>) {
  return (
    <div
      style={{ width: COMMIT_NODE_WIDTH, height: COMMIT_NODE_HEIGHT }}
      className={cn(
        'flex flex-col justify-center gap-0.5 rounded-md border bg-bg-soft px-2 py-1 transition-[opacity,border-color,box-shadow]',
        'cursor-pointer select-none motion-safe:animate-fade-in',
        data.isPending
          ? 'border-dashed border-accent/60 opacity-70'
          : data.isSelected
            ? 'border-accent shadow-[0_0_0_1px] shadow-accent'
            : data.isHeadTarget
              ? 'border-accent/70'
              : data.isAncestor
                ? 'border-accent/30'
                : 'border-border',
        data.dimmed && !data.isPending && 'opacity-40',
      )}
    >
      {/* Parent side (left) is the target; child side (right) is the source. */}
      <Handle type="target" position={Position.Left} className="!h-1.5 !w-1.5 !border-0 !bg-border" />
      <Handle type="source" position={Position.Right} className="!h-1.5 !w-1.5 !border-0 !bg-border" />

      <div className="flex items-center gap-1">
        {data.isPending ? (
          <>
            <span className="h-2 w-2 shrink-0 rounded-full bg-tag motion-safe:animate-pulse-soft" />
            <span className="text-[11px] text-tag">committing…</span>
          </>
        ) : (
          <>
            <span
              className={cn('h-2 w-2 shrink-0 rounded-full', data.isHeadTarget ? 'bg-accent' : 'bg-hash-400')}
            />
            <HashRevealText value={shortenSha(data.sha)} className="text-[11px] text-hash" />
            {data.hasHiddenParents && (
              <span className="text-[10px] text-fg-faint" title="older history hidden">⋯</span>
            )}
          </>
        )}
      </div>
      <div className="truncate text-[11px] leading-tight text-fg" title={data.subject}>
        {data.subject}
      </div>
      <div className="truncate text-[10px] leading-tight text-fg-faint">{data.author}</div>
    </div>
  );
}

export const CommitNode = memo(CommitNodeImpl);
