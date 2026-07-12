/**
 * A small client-side parser for the unified-diff text the backend emits per
 * file (backend/src/core/dag/diff.js `unifiedDiff`). Phase-2 assumed the
 * wrapper returns `{ path, diffText }[]` where diffText is exactly that block:
 *
 *   diff --git a/<path> b/<path>
 *   [new file mode <m> | deleted file mode <m> | old mode <m> / new mode <m>]
 *   [Binary files a/<path> and b/<path> differ]        <- binary: no hunks
 *   --- a/<path>            (or /dev/null when added)
 *   +++ b/<path>            (or /dev/null when deleted)
 *   @@ -<l>,<c> +<l>,<c> @@
 *    context
 *   -removed
 *   +added
 *   \ No newline at end of file                         <- marks preceding line
 */

export type DiffLineKind = 'context' | 'add' | 'del';

export interface DiffLine {
  kind: DiffLineKind;
  content: string;
  /** git's "\ No newline at end of file" applied to this line. */
  noNewline: boolean;
  /** 1-based line number in the old file (null for added lines). */
  oldLineNo: number | null;
  /** 1-based line number in the new file (null for removed lines). */
  newLineNo: number | null;
}

export interface DiffHunk {
  header: string;
  oldStart: number;
  oldCount: number;
  newStart: number;
  newCount: number;
  lines: DiffLine[];
}

export type FileChangeKind = 'added' | 'deleted' | 'modified' | 'renamed';

export interface ParsedFileDiff {
  path: string;
  oldPath: string | null;
  changeKind: FileChangeKind;
  binary: boolean;
  /** Old/new file modes if the diff reported them. */
  oldMode: string | null;
  newMode: string | null;
  hunks: DiffHunk[];
}

const HUNK_RE = /^@@ -(\d+)(?:,(\d+))? \+(\d+)(?:,(\d+))? @@/;
const GIT_HEADER_RE = /^diff --git a\/(.+) b\/(.+)$/;
const NO_NEWLINE = '\\ No newline at end of file';

/** Parse a single file's unified-diff block. */
export function parseFileDiff(diffText: string): ParsedFileDiff {
  const lines = diffText.split('\n');

  let path = '';
  let oldPath: string | null = null;
  let binary = false;
  let added = false;
  let deleted = false;
  let oldMode: string | null = null;
  let newMode: string | null = null;
  const hunks: DiffHunk[] = [];

  let current: DiffHunk | null = null;
  let oldNo = 0;
  let newNo = 0;

  for (const line of lines) {
    const gitHeader = GIT_HEADER_RE.exec(line);
    if (gitHeader) {
      oldPath = gitHeader[1];
      path = gitHeader[2];
      continue;
    }
    if (line.startsWith('new file mode')) {
      added = true;
      newMode = line.slice('new file mode'.length).trim() || null;
      continue;
    }
    if (line.startsWith('deleted file mode')) {
      deleted = true;
      oldMode = line.slice('deleted file mode'.length).trim() || null;
      continue;
    }
    if (line.startsWith('old mode')) {
      oldMode = line.slice('old mode'.length).trim() || null;
      continue;
    }
    if (line.startsWith('new mode')) {
      newMode = line.slice('new mode'.length).trim() || null;
      continue;
    }
    if (line.startsWith('rename from')) {
      oldPath = line.slice('rename from'.length).trim();
      continue;
    }
    if (line.startsWith('Binary files')) {
      binary = true;
      continue;
    }
    // File header lines. `--- /dev/null` => added; `+++ /dev/null` => deleted.
    if (line.startsWith('--- ')) {
      if (line.slice(4).trim() === '/dev/null') added = true;
      continue;
    }
    if (line.startsWith('+++ ')) {
      if (line.slice(4).trim() === '/dev/null') deleted = true;
      continue;
    }
    if (line.startsWith('index ')) continue; // "index abc..def mode" — skip

    const hunk = HUNK_RE.exec(line);
    if (hunk) {
      current = {
        header: line,
        oldStart: Number(hunk[1]),
        oldCount: hunk[2] === undefined ? 1 : Number(hunk[2]),
        newStart: Number(hunk[3]),
        newCount: hunk[4] === undefined ? 1 : Number(hunk[4]),
        lines: [],
      };
      oldNo = current.oldStart;
      newNo = current.newStart;
      hunks.push(current);
      continue;
    }

    if (!current) continue; // preamble noise outside any hunk

    if (line === NO_NEWLINE) {
      const last = current.lines[current.lines.length - 1];
      if (last) last.noNewline = true;
      continue;
    }

    const marker = line[0];
    const content = line.slice(1);
    if (marker === '+') {
      current.lines.push({ kind: 'add', content, noNewline: false, oldLineNo: null, newLineNo: newNo++ });
    } else if (marker === '-') {
      current.lines.push({ kind: 'del', content, noNewline: false, oldLineNo: oldNo++, newLineNo: null });
    } else if (marker === ' ' || line === '') {
      // A bare empty line inside a hunk is a context line for an empty source line.
      current.lines.push({ kind: 'context', content, noNewline: false, oldLineNo: oldNo++, newLineNo: newNo++ });
    }
  }

  const changeKind: FileChangeKind =
    oldPath && path && oldPath !== path
      ? 'renamed'
      : added
        ? 'added'
        : deleted
          ? 'deleted'
          : 'modified';

  return { path: path || oldPath || '', oldPath, changeKind, binary, oldMode, newMode, hunks };
}

/** Parse an array of per-file diff blocks. */
export function parseDiffFiles(files: { path: string; diffText: string }[]): ParsedFileDiff[] {
  return files.map((f) => parseFileDiff(f.diffText));
}

/** Added/removed line counts for a parsed file diff (for summaries). */
export function diffStats(file: ParsedFileDiff): { additions: number; deletions: number } {
  let additions = 0;
  let deletions = 0;
  for (const h of file.hunks) {
    for (const l of h.lines) {
      if (l.kind === 'add') additions++;
      else if (l.kind === 'del') deletions++;
    }
  }
  return { additions, deletions };
}
