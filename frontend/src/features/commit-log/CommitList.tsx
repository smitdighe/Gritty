import { useRef, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useLog } from '@/hooks';
import { Panel } from '@/components/ui/Panel';
import { shortenSha, formatIdentTime } from '@/lib/format';
import { cn } from '@/lib/cn';
import { useRepoStore } from '@/store/repoStore';
import { ErrorNote, LoadingRows } from '@/features/common/states';
import { LOG_MAX } from '@/lib/constants';
import type { LogEntry } from '@/types/domain';

const ROW_HEIGHT = 56;
const OVERSCAN = 6;
const VIEWPORT_HEIGHT = 480;

export interface CommitListProps {
  /** Max commits to request. Defaults to the shared LOG_MAX so the graph and
   *  the list share one cache entry instead of issuing duplicate log fetches. */
  max?: number;
}

/**
 * Commit log with basic fixed-height windowing: only the visible slice (plus
 * overscan) is rendered, so a long history stays cheap. Row click navigates to
 * the commit detail route and records the selection in the store.
 */
export function CommitList({ max = LOG_MAX }: CommitListProps) {
  const { data, isLoading, isError, error } = useLog({ max });
  const navigate = useNavigate();
  const setSelectedCommitSha = useRepoStore((s) => s.setSelectedCommitSha);
  const selected = useRepoStore((s) => s.selectedCommitSha);

  const [scrollTop, setScrollTop] = useState(0);
  const scrollRef = useRef<HTMLDivElement>(null);

  const onScroll = useCallback(() => {
    if (scrollRef.current) setScrollTop(scrollRef.current.scrollTop);
  }, []);

  const openCommit = (sha: string) => {
    setSelectedCommitSha(sha);
    navigate(`/repo/commit/${sha}`);
  };

  return (
    <Panel title="Commits" flush>
      <div className="p-3">
        {isLoading && <LoadingRows rows={5} />}
        {isError && <ErrorNote error={error} />}
        {data && data.length === 0 && (
          <p className="text-sm text-fg-faint">No commits yet.</p>
        )}
      </div>

      {data && data.length > 0 && (
        <VirtualLog
          entries={data}
          scrollRef={scrollRef}
          scrollTop={scrollTop}
          onScroll={onScroll}
          selected={selected}
          onOpen={openCommit}
        />
      )}
    </Panel>
  );
}

interface VirtualLogProps {
  entries: LogEntry[];
  scrollRef: React.RefObject<HTMLDivElement>;
  scrollTop: number;
  onScroll: () => void;
  selected: string | null;
  onOpen: (sha: string) => void;
}

function VirtualLog({ entries, scrollRef, scrollTop, onScroll, selected, onOpen }: VirtualLogProps) {
  const total = entries.length;
  const start = Math.max(0, Math.floor(scrollTop / ROW_HEIGHT) - OVERSCAN);
  const visibleCount = Math.ceil(VIEWPORT_HEIGHT / ROW_HEIGHT) + OVERSCAN * 2;
  const end = Math.min(total, start + visibleCount);
  const slice = entries.slice(start, end);

  return (
    <div
      ref={scrollRef}
      onScroll={onScroll}
      className="overflow-auto border-t border-border"
      style={{ height: VIEWPORT_HEIGHT }}
      role="list"
    >
      <div style={{ height: total * ROW_HEIGHT, position: 'relative' }}>
        {slice.map((entry, i) => {
          const top = (start + i) * ROW_HEIGHT;
          return (
            <CommitRow
              key={entry.sha}
              entry={entry}
              top={top}
              selected={entry.sha === selected}
              onOpen={onOpen}
            />
          );
        })}
      </div>
    </div>
  );
}

function CommitRow({
  entry,
  top,
  selected,
  onOpen,
}: {
  entry: LogEntry;
  top: number;
  selected: boolean;
  onOpen: (sha: string) => void;
}) {
  const { sha, commit } = entry;
  const firstLine = commit.message.split('\n')[0];
  return (
    <button
      type="button"
      role="listitem"
      onClick={() => onOpen(sha)}
      style={{ position: 'absolute', top, height: ROW_HEIGHT }}
      className={cn(
        'flex w-full flex-col items-start gap-0.5 border-b border-border-muted px-3 py-2 text-left transition-colors',
        'outline-none focus-visible:ring-2 focus-visible:ring-accent',
        selected ? 'bg-accent-muted' : 'hover:bg-bg-hover',
      )}
    >
      <div className="flex w-full items-center gap-2">
        <span className="shrink-0 text-xs text-hash">{shortenSha(sha)}</span>
        <span className="truncate text-sm text-fg">{firstLine}</span>
      </div>
      <div className="flex w-full items-center gap-2 text-xs text-fg-faint">
        <span className="truncate">{commit.author.name}</span>
        <span>·</span>
        <span className="shrink-0">{formatIdentTime(commit.author.timestamp, commit.author.timezone)}</span>
      </div>
    </button>
  );
}
