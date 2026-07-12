import { useStatus } from '@/hooks';
import { Panel } from '@/components/ui/Panel';
import { Badge } from '@/components/ui/Badge';
import { shortenSha, pluralize } from '@/lib/format';
import { isClean } from '@/lib/staging';
import { ErrorNote, LoadingRows } from '@/features/common/states';

/** HEAD / branch / cleanliness + change counts, from live /status. */
export function StatusSummary() {
  const { data, isLoading, isError, error } = useStatus();

  return (
    <Panel title="Status">
      {isLoading && <LoadingRows rows={3} />}
      {isError && <ErrorNote error={error} />}
      {data && (
        <div
          className="flex flex-col gap-3 text-sm motion-safe:animate-fade-in"
          aria-live="polite"
        >
          <div className="flex items-center justify-between">
            <span className="text-fg-muted">Branch</span>
            <span className="text-fg">{data.branch ?? <em className="text-fg-faint">detached</em>}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-fg-muted">HEAD</span>
            <span className="text-hash">{data.headSha ? shortenSha(data.headSha) : '—'}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-fg-muted">State</span>
            {isClean(data) ? <Badge variant="add">clean</Badge> : <Badge variant="remove">dirty</Badge>}
          </div>
          <div className="mt-1 grid grid-cols-3 gap-2 border-t border-border pt-2 text-center">
            <Count label="staged" value={data.staged.length} />
            <Count label="unstaged" value={data.unstaged.length} />
            <Count label="untracked" value={data.untracked.length} />
          </div>
          <p className="text-xs text-fg-faint">
            {pluralize(data.staged.length + data.unstaged.length + data.untracked.length, 'change')}
          </p>
        </div>
      )}
    </Panel>
  );
}

function Count({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex flex-col">
      <span className="text-lg font-semibold text-fg">{value}</span>
      <span className="text-xs uppercase tracking-wide text-fg-faint">{label}</span>
    </div>
  );
}
