import { useStatus } from '@/hooks';
import { Panel } from '@/components/ui/Panel';
import { bucketStatus, type StagingItem } from '@/lib/staging';
import { shortenSha, pluralize } from '@/lib/format';
import { StagingFileRow } from './StagingFileRow';
import { ErrorNote, LoadingRows } from '@/features/common/states';
import type { RepoStatus } from '@/types/domain';

/**
 * Three-snapshot staging board (HEAD → Index → Worktree). Bucketing follows
 * computeStatus semantics exactly — see src/lib/staging.ts.
 */
export function StagingBoard() {
  const { data, isLoading, isError, error } = useStatus();

  return (
    <Panel title="Staging" flush>
      <div className="p-3">
        {isLoading && <LoadingRows rows={4} />}
        {isError && <ErrorNote error={error} />}
        {data && <Board status={data} />}
      </div>
    </Panel>
  );
}

function Board({ status }: { status: RepoStatus }) {
  const buckets = bucketStatus(status);
  return (
    <div className="grid grid-cols-1 gap-3 md:grid-cols-3" role="group" aria-label="Staging areas">
      <Column
        title="HEAD"
        subtitle={status.headSha ? shortenSha(status.headSha) : 'unborn'}
        items={buckets.head}
        emptyLabel="committed baseline"
      />
      <Column title="Index" subtitle="staged" items={buckets.index} emptyLabel="nothing staged" />
      <Column title="Worktree" subtitle="working tree" items={buckets.worktree} emptyLabel="clean" />
    </div>
  );
}

function Column({
  title,
  subtitle,
  items,
  emptyLabel,
}: {
  title: string;
  subtitle: string;
  items: StagingItem[];
  emptyLabel: string;
}) {
  return (
    <div
      className="flex flex-col rounded border border-border bg-bg-inset"
      role="group"
      aria-label={`${title} — ${items.length} ${items.length === 1 ? 'file' : 'files'}`}
    >
      <div className="flex items-baseline justify-between border-b border-border px-2 py-1.5">
        <h3 className="font-sans text-xs font-semibold uppercase tracking-wide text-fg-muted">
          {title}
        </h3>
        <span className="text-xs text-hash">{subtitle}</span>
      </div>
      <div className="flex min-h-[3rem] flex-col gap-0.5 p-1.5">
        {items.length === 0 ? (
          <span className="px-2 py-1 text-xs text-fg-faint">{emptyLabel}</span>
        ) : (
          items.map((it) => <StagingFileRow key={`${it.type}:${it.path}`} path={it.path} type={it.type} />)
        )}
      </div>
      <div className="border-t border-border px-2 py-1 text-right text-xs text-fg-faint">
        {pluralize(items.length, 'file')}
      </div>
    </div>
  );
}
