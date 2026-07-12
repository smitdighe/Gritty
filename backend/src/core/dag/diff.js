/**
 * Diffing: an O(ND) Myers line diff for blobs, unified-hunk formatting, and a
 * recursive tree-vs-tree comparison that reports added/deleted/modified paths.
 */

import { readTree } from '../objects/tree.js';
import { entryType } from '../objects/tree.js';

/**
 * Myers shortest-edit-script over two arrays of lines.
 * @param {string[]} a
 * @param {string[]} b
 * @returns {Array<{ type: 'equal'|'insert'|'delete', value: string }>}
 */
export function myersDiff(a, b) {
  const N = a.length;
  const M = b.length;
  const MAX = N + M;
  if (MAX === 0) return [];
  const offset = MAX;
  const v = new Array(2 * MAX + 1).fill(0);
  const trace = [];

  let done = false;
  for (let d = 0; d <= MAX && !done; d++) {
    trace.push(v.slice());
    for (let k = -d; k <= d; k += 2) {
      let x;
      if (k === -d || (k !== d && v[offset + k - 1] < v[offset + k + 1])) {
        x = v[offset + k + 1]; // move down (insert from b)
      } else {
        x = v[offset + k - 1] + 1; // move right (delete from a)
      }
      let y = x - k;
      while (x < N && y < M && a[x] === b[y]) {
        x++;
        y++;
      }
      v[offset + k] = x;
      if (x >= N && y >= M) {
        done = true;
        break;
      }
    }
  }

  // Backtrack through the saved frontiers to reconstruct the script.
  const script = [];
  let x = N;
  let y = M;
  for (let d = trace.length - 1; d >= 0; d--) {
    const vprev = trace[d];
    const k = x - y;
    let prevK;
    if (k === -d || (k !== d && vprev[offset + k - 1] < vprev[offset + k + 1])) {
      prevK = k + 1;
    } else {
      prevK = k - 1;
    }
    const prevX = vprev[offset + prevK];
    const prevY = prevX - prevK;
    while (x > prevX && y > prevY) {
      script.push({ type: 'equal', value: a[x - 1] });
      x--;
      y--;
    }
    if (d > 0) {
      if (x === prevX) {
        script.push({ type: 'insert', value: b[y - 1] });
        y--;
      } else {
        script.push({ type: 'delete', value: a[x - 1] });
        x--;
      }
    }
  }
  script.reverse();
  return script;
}

const NO_NEWLINE = '\\ No newline at end of file';

/**
 * Split text into lines for diffing, keeping each line's terminating `\n` on the
 * token. This makes a trailing-newline-only change ("b" vs "b\n") a real edit to
 * the final line — exactly how git sees it — and lets the formatter emit the
 * `\ No newline at end of file` marker for whichever side lacks the terminator.
 */
function splitLines(text) {
  if (text === '') return [];
  return text.split(/(?<=\n)/);
}

function fmtRange(start, count) {
  if (count === 0) return `${start},0`;
  if (count === 1) return `${start}`;
  return `${start},${count}`;
}

/**
 * Format a Myers script as unified-diff hunk text (no file header lines).
 * @param {ReturnType<typeof myersDiff>} script
 * @param {number} context lines of context around changes
 * @returns {string[]} hunk lines
 */
export function formatHunks(script, context = 3) {
  // Number each script element by old/new line.
  const rows = [];
  let oldN = 0;
  let newN = 0;
  for (const op of script) {
    if (op.type === 'equal') rows.push({ ...op, oldN: ++oldN, newN: ++newN });
    else if (op.type === 'delete') rows.push({ ...op, oldN: ++oldN, newN: null });
    else rows.push({ ...op, oldN: null, newN: ++newN });
  }

  const isChange = (r) => r.type !== 'equal';
  const out = [];
  const n = rows.length;
  let i = 0;
  while (i < n) {
    if (!isChange(rows[i])) {
      i++;
      continue;
    }
    const start = Math.max(0, i - context);
    // Extend the hunk across changes separated by gaps <= 2*context equals.
    let lastChange = i;
    let j = i;
    while (j < n) {
      if (isChange(rows[j])) {
        lastChange = j;
        j++;
      } else {
        let k = j;
        while (k < n && !isChange(rows[k])) k++;
        if (k >= n || k - j > 2 * context) break;
        j = k;
      }
    }
    const end = Math.min(n - 1, lastChange + context);

    // Build the hunk body + header.
    const slice = rows.slice(start, end + 1);
    let oldStart = null;
    let newStart = null;
    let oldCount = 0;
    let newCount = 0;
    const body = [];
    // Emit a line, stripping the token's trailing `\n`; if the token had none,
    // follow it with git's "no newline at end of file" marker.
    const emit = (prefix, value) => {
      const noNl = !value.endsWith('\n');
      body.push(`${prefix}${noNl ? value : value.slice(0, -1)}`);
      if (noNl) body.push(NO_NEWLINE);
    };
    for (const r of slice) {
      if (r.type === 'equal') {
        oldStart ??= r.oldN;
        newStart ??= r.newN;
        oldCount++;
        newCount++;
        emit(' ', r.value);
      } else if (r.type === 'delete') {
        oldStart ??= r.oldN;
        oldCount++;
        emit('-', r.value);
      } else {
        newStart ??= r.newN;
        newCount++;
        emit('+', r.value);
      }
    }
    out.push(`@@ -${fmtRange(oldStart ?? 0, oldCount)} +${fmtRange(newStart ?? 0, newCount)} @@`);
    out.push(...body);
    i = end + 1;
  }
  return out;
}

/** True if a buffer looks binary (contains a NUL in its first 8k). */
export function isBinary(buf) {
  const n = Math.min(buf.length, 8000);
  for (let i = 0; i < n; i++) if (buf[i] === 0) return true;
  return false;
}

/**
 * A git-style unified diff for one path between two blob buffers. Either side
 * may be `null` (added / deleted file).
 * @param {{ path: string, oldBuf: Buffer|null, newBuf: Buffer|null, oldMode?: string, newMode?: string }} spec
 * @returns {string}
 */
export function unifiedDiff({ path, oldBuf, newBuf, oldMode, newMode }) {
  const lines = [`diff --git a/${path} b/${path}`];
  if (oldBuf === null) lines.push(`new file mode ${newMode ?? '100644'}`);
  if (newBuf === null) lines.push(`deleted file mode ${oldMode ?? '100644'}`);
  if (oldBuf !== null && newBuf !== null && oldMode && newMode && oldMode !== newMode) {
    lines.push(`old mode ${oldMode}`, `new mode ${newMode}`);
  }

  if ((oldBuf && isBinary(oldBuf)) || (newBuf && isBinary(newBuf))) {
    lines.push(`Binary files a/${path} and b/${path} differ`);
    return lines.join('\n');
  }

  const oldText = oldBuf ? oldBuf.toString('utf8') : '';
  const newText = newBuf ? newBuf.toString('utf8') : '';
  if (oldText === newText) return lines.join('\n'); // metadata-only change

  const script = myersDiff(splitLines(oldText), splitLines(newText));
  const hunks = formatHunks(script);
  lines.push(`--- ${oldBuf === null ? '/dev/null' : `a/${path}`}`);
  lines.push(`+++ ${newBuf === null ? '/dev/null' : `b/${path}`}`);
  lines.push(...hunks);
  return lines.join('\n');
}

/**
 * @typedef {object} TreeChange
 * @property {'add'|'delete'|'modify'} type
 * @property {string} path
 * @property {string|null} oldSha
 * @property {string|null} newSha
 * @property {string|null} oldMode
 * @property {string|null} newMode
 */

/**
 * Recursively diff two trees, yielding per-file changes (sorted by path).
 * @param {import('../objects/objectStore.js').ObjectStore} store
 * @param {string|null} treeA old tree id (null = empty)
 * @param {string|null} treeB new tree id (null = empty)
 * @param {string} [prefix]
 * @returns {Promise<TreeChange[]>}
 */
export async function diffTrees(store, treeA, treeB, prefix = '') {
  const a = treeA ? indexByName(await readTree(store, treeA)) : new Map();
  const b = treeB ? indexByName(await readTree(store, treeB)) : new Map();
  const names = [...new Set([...a.keys(), ...b.keys()])].sort();

  const changes = [];
  for (const name of names) {
    const ea = a.get(name);
    const eb = b.get(name);
    const p = prefix ? `${prefix}/${name}` : name;
    const aIsTree = ea && entryType(ea.mode) === 'tree';
    const bIsTree = eb && entryType(eb.mode) === 'tree';

    if (ea && eb && ea.sha === eb.sha && ea.mode === eb.mode) continue; // identical

    if (aIsTree || bIsTree) {
      // Descend, treating a file-vs-dir swap as recursion against an empty side.
      const subChanges = await diffTrees(
        store,
        aIsTree ? ea.sha : null,
        bIsTree ? eb.sha : null,
        p,
      );
      changes.push(...subChanges);
      // A file replaced by a dir (or vice-versa) also adds/deletes the file side.
      if (ea && !aIsTree) changes.push(mk('delete', p, ea, null));
      if (eb && !bIsTree) changes.push(mk('add', p, null, eb));
      continue;
    }

    if (ea && !eb) changes.push(mk('delete', p, ea, null));
    else if (!ea && eb) changes.push(mk('add', p, null, eb));
    else changes.push(mk('modify', p, ea, eb));
  }
  changes.sort((x, y) => (x.path < y.path ? -1 : x.path > y.path ? 1 : 0));
  return changes;
}

function mk(type, path, ea, eb) {
  return {
    type,
    path,
    oldSha: ea ? ea.sha : null,
    newSha: eb ? eb.sha : null,
    oldMode: ea ? ea.mode : null,
    newMode: eb ? eb.mode : null,
  };
}

function indexByName(entries) {
  const m = new Map();
  for (const e of entries) m.set(e.name, e);
  return m;
}
