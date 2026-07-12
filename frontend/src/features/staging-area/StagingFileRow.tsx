import { cn } from '@/lib/cn';
import type { StagingItemType } from '@/lib/staging';

const META: Record<StagingItemType, { label: string; glyph: string; className: string }> = {
  'new file': { label: 'new', glyph: 'A', className: 'text-diff-add' },
  modified: { label: 'modified', glyph: 'M', className: 'text-tag' },
  deleted: { label: 'deleted', glyph: 'D', className: 'text-diff-remove' },
  untracked: { label: 'untracked', glyph: '?', className: 'text-fg-faint' },
};

/** Static file row (no column-to-column motion yet — phase 5/6). */
export function StagingFileRow({ path, type }: { path: string; type: StagingItemType }) {
  const meta = META[type];
  return (
    <div className="flex items-center gap-2 rounded px-2 py-1 text-sm hover:bg-bg-hover">
      <span
        title={meta.label}
        className={cn('inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-sm border border-border text-[10px] font-bold', meta.className)}
      >
        {meta.glyph}
      </span>
      <span className="truncate text-fg" title={path}>
        {path}
      </span>
    </div>
  );
}
