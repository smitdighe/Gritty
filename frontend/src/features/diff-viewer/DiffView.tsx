import { useMemo } from 'react';
import { useDiff } from '@/hooks';
import { Panel } from '@/components/ui/Panel';
import { Badge } from '@/components/ui/Badge';
import { parseFileDiff, diffStats, type ParsedFileDiff, type FileChangeKind } from '@/lib/diff';
import { DiffHunk } from './DiffHunk';
import { ErrorNote, LoadingRows } from '@/features/common/states';

export interface DiffViewProps {
  /** Commit-vs-commit diff when both provided; otherwise worktree-vs-index. */
  a?: string;
  b?: string;
  title?: string;
}

const CHANGE_BADGE: Record<FileChangeKind, { variant: 'add' | 'remove' | 'branch' | 'muted'; label: string }> = {
  added: { variant: 'add', label: 'added' },
  deleted: { variant: 'remove', label: 'deleted' },
  modified: { variant: 'muted', label: 'modified' },
  renamed: { variant: 'branch', label: 'renamed' },
};

/** Renders per-file unified diffs, parsing raw diff text client-side. */
export function DiffView({ a, b, title = 'Diff' }: DiffViewProps) {
  const params = a != null && b != null ? { a, b } : {};
  const { data, isLoading, isError, error } = useDiff(params);

  const files = useMemo<ParsedFileDiff[]>(
    () => (data ? data.map((f) => parseFileDiff(f.diffText)) : []),
    [data],
  );

  return (
    <Panel title={title} flush>
      <div className="p-3">
        {isLoading && <LoadingRows rows={4} />}
        {isError && <ErrorNote error={error} />}
        {data && data.length === 0 && <p className="text-sm text-fg-faint">No changes.</p>}
      </div>

      {files.length > 0 && (
        <div className="flex flex-col gap-3 px-3 pb-3">
          {files.map((file) => (
            <FileDiff key={`${file.oldPath ?? ''}:${file.path}`} file={file} />
          ))}
        </div>
      )}
    </Panel>
  );
}

function FileDiff({ file }: { file: ParsedFileDiff }) {
  const badge = CHANGE_BADGE[file.changeKind];
  const { additions, deletions } = diffStats(file);

  return (
    <div className="overflow-hidden rounded border border-border">
      <div className="flex items-center justify-between gap-2 border-b border-border bg-bg-soft px-3 py-1.5">
        <div className="flex min-w-0 items-center gap-2">
          <Badge variant={badge.variant}>{badge.label}</Badge>
          <span className="truncate font-mono text-xs text-fg" title={file.path}>
            {file.changeKind === 'renamed' && file.oldPath ? `${file.oldPath} → ${file.path}` : file.path}
          </span>
        </div>
        {!file.binary && (
          <span className="shrink-0 text-xs">
            <span className="text-diff-add">+{additions}</span>{' '}
            <span className="text-diff-remove">-{deletions}</span>
          </span>
        )}
      </div>

      {file.binary ? (
        <div className="px-3 py-2 text-xs text-fg-faint">Binary file — no textual preview.</div>
      ) : file.hunks.length === 0 ? (
        <div className="px-3 py-2 text-xs text-fg-faint">No textual changes (metadata only).</div>
      ) : (
        <div className="divide-y divide-border-muted overflow-x-auto">
          {file.hunks.map((hunk, i) => (
            <DiffHunk key={i} hunk={hunk} />
          ))}
        </div>
      )}
    </div>
  );
}
