import { DiffLine } from './DiffLine';
import type { DiffHunk as DiffHunkModel } from '@/lib/diff';

/** One @@ hunk: its header row followed by its lines. */
export function DiffHunk({ hunk }: { hunk: DiffHunkModel }) {
  return (
    <div>
      <div className="bg-bg-hover px-2 py-0.5 font-mono text-xs text-accent">{hunk.header}</div>
      <div>
        {hunk.lines.map((line, i) => (
          <DiffLine key={i} line={line} />
        ))}
      </div>
    </div>
  );
}
