import { cn } from '@/lib/cn';
import type { DiffLine as DiffLineModel } from '@/lib/diff';

const KIND_STYLES = {
  add: 'bg-diff-add-bg text-diff-add',
  del: 'bg-diff-remove-bg text-diff-remove',
  context: 'text-fg-muted',
} as const;

const PREFIX = { add: '+', del: '-', context: ' ' } as const;

/** One diff line: gutter line numbers, +/-/space marker, colored content. */
export function DiffLine({ line }: { line: DiffLineModel }) {
  return (
    <div className={cn('flex font-mono text-xs leading-5', KIND_STYLES[line.kind])}>
      <span className="w-10 shrink-0 select-none px-1 text-right text-fg-faint">
        {line.oldLineNo ?? ''}
      </span>
      <span className="w-10 shrink-0 select-none px-1 text-right text-fg-faint">
        {line.newLineNo ?? ''}
      </span>
      <span className="w-4 shrink-0 select-none text-center">{PREFIX[line.kind]}</span>
      <span className="whitespace-pre-wrap break-all">
        {line.content}
        {line.noNewline && (
          <span className="ml-2 rounded bg-bg-hover px-1 text-[10px] text-fg-faint">no newline at EOF</span>
        )}
      </span>
    </div>
  );
}
