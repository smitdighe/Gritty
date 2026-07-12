import { test } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import fs from 'node:fs/promises';
import { myersDiff, formatHunks, diffTrees, unifiedDiff } from '../src/core/dag/diff.js';
import { ObjectStore } from '../src/core/objects/objectStore.js';
import { writeBlob } from '../src/core/objects/blob.js';
import { writeTree, Mode } from '../src/core/objects/tree.js';
import { hasGit, gitRaw, initGitRepo, makeTempDir, rmDir } from './helpers/git.js';

// Mirror diff.js splitLines: keep each line's trailing `\n` on the token so a
// missing-final-newline shows up as a real edit.
const toLines = (t) => (t === '' ? [] : t.split(/(?<=\n)/));

/** Rebuild both sequences from a diff script (checks the script is well-formed). */
function reconstruct(script) {
  const a = [];
  const b = [];
  for (const op of script) {
    if (op.type === 'equal') {
      a.push(op.value);
      b.push(op.value);
    } else if (op.type === 'delete') a.push(op.value);
    else b.push(op.value);
  }
  return { a, b };
}

test('myers: identical inputs are all "equal"', () => {
  const script = myersDiff(['a', 'b', 'c'], ['a', 'b', 'c']);
  assert.ok(script.every((op) => op.type === 'equal'));
  assert.equal(script.length, 3);
});

test('myers: pure insertion and pure deletion', () => {
  const ins = myersDiff([], ['x', 'y']);
  assert.deepEqual(ins, [
    { type: 'insert', value: 'x' },
    { type: 'insert', value: 'y' },
  ]);
  const del = myersDiff(['x', 'y'], []);
  assert.deepEqual(del, [
    { type: 'delete', value: 'x' },
    { type: 'delete', value: 'y' },
  ]);
});

test('myers: script reconstructs both sequences (Myers paper example)', () => {
  const a = ['a', 'b', 'c', 'a', 'b', 'b', 'a'];
  const b = ['c', 'b', 'a', 'b', 'a', 'c'];
  const script = myersDiff(a, b);
  const { a: ra, b: rb } = reconstruct(script);
  assert.deepEqual(ra, a);
  assert.deepEqual(rb, b);
  // Minimal edit distance for this classic pair is 5.
  const edits = script.filter((op) => op.type !== 'equal').length;
  assert.equal(edits, 5);
});

test('formatHunks: single change with context header', () => {
  const a = toLines('l1\nl2\nl3\nl4\nl5\n');
  const b = toLines('l1\nl2\nCHANGED\nl4\nl5\n');
  const hunks = formatHunks(myersDiff(a, b), 3);
  assert.equal(hunks[0], '@@ -1,5 +1,5 @@');
  assert.ok(hunks.includes('-l3'));
  assert.ok(hunks.includes('+CHANGED'));
});

test('unifiedDiff: added and deleted files use /dev/null', () => {
  const added = unifiedDiff({ path: 'new.txt', oldBuf: null, newBuf: Buffer.from('hi\n'), newMode: '100644' });
  assert.match(added, /new file mode 100644/);
  assert.match(added, /--- \/dev\/null/);
  assert.match(added, /\+\+\+ b\/new\.txt/);
  assert.match(added, /\+hi/);

  const deleted = unifiedDiff({ path: 'gone.txt', oldBuf: Buffer.from('bye\n'), newBuf: null, oldMode: '100644' });
  assert.match(deleted, /deleted file mode 100644/);
  assert.match(deleted, /\+\+\+ \/dev\/null/);
});

test('unifiedDiff: binary content is reported, not dumped', () => {
  const out = unifiedDiff({
    path: 'img.bin',
    oldBuf: Buffer.from([0, 1, 2]),
    newBuf: Buffer.from([0, 3]),
  });
  assert.match(out, /Binary files a\/img\.bin and b\/img\.bin differ/);
});

test('diffTrees: reports add / delete / modify incl. nested', async () => {
  const dir = makeTempDir();
  try {
    const store = new ObjectStore(path.join(dir, 'objects'));
    const keep = await writeBlob(store, 'keep\n');
    const oldF = await writeBlob(store, 'old\n');
    const newF = await writeBlob(store, 'new\n');
    const gone = await writeBlob(store, 'gone\n');
    const added = await writeBlob(store, 'added\n');

    const subOld = await writeTree(store, [{ mode: Mode.FILE, name: 'f.txt', sha: oldF }]);
    const subNew = await writeTree(store, [{ mode: Mode.FILE, name: 'f.txt', sha: newF }]);

    const treeA = await writeTree(store, [
      { mode: Mode.FILE, name: 'keep.txt', sha: keep },
      { mode: Mode.FILE, name: 'gone.txt', sha: gone },
      { mode: Mode.DIR, name: 'sub', sha: subOld },
    ]);
    const treeB = await writeTree(store, [
      { mode: Mode.FILE, name: 'keep.txt', sha: keep },
      { mode: Mode.FILE, name: 'added.txt', sha: added },
      { mode: Mode.DIR, name: 'sub', sha: subNew },
    ]);

    const changes = await diffTrees(store, treeA, treeB);
    const byPath = Object.fromEntries(changes.map((c) => [c.path, c.type]));
    assert.deepEqual(byPath, {
      'added.txt': 'add',
      'gone.txt': 'delete',
      'sub/f.txt': 'modify',
    });
  } finally {
    rmDir(dir);
  }
});

test('myers hunks match `git diff` byte-for-byte', { skip: !hasGit }, async () => {
  const repo = initGitRepo();
  try {
    const aText = 'l1\nl2\nl3\nl4\nl5\nl6\nl7\nl8\nl9\nl10\n';
    const bText = 'l1\nL2\nl3\nl4\nl6\nl7\nl8\nINSERT\nl9\nl10\n';
    await fs.writeFile(path.join(repo, 'a'), aText);
    await fs.writeFile(path.join(repo, 'b'), bText);

    const res = gitRaw(repo, ['diff', '--no-index', '-U3', 'a', 'b']);
    const gitHunkLines = res.stdout
      .toString('utf8')
      .split('\n')
      .filter((l) => /^(@@|[ +-])/.test(l) && !l.startsWith('+++') && !l.startsWith('---'));

    const ours = formatHunks(myersDiff(toLines(aText), toLines(bText)), 3);
    assert.deepEqual(ours, gitHunkLines.filter((l) => l !== ''));
  } finally {
    rmDir(repo);
  }
});

test('unifiedDiff emits "\\ No newline at end of file" exactly like git', { skip: !hasGit }, async () => {
  const repo = initGitRepo();
  try {
    // From the first `@@` onward, matching git's hunk region (incl. `\` lines).
    const hunkRegion = (text) => {
      const lines = text.split('\n');
      const i = lines.findIndex((l) => l.startsWith('@@'));
      const region = i < 0 ? [] : lines.slice(i);
      while (region.length && region[region.length - 1] === '') region.pop();
      return region;
    };

    const cases = [
      { name: 'old-no-nl-new-nl', a: 'a\nb\nc', b: 'a\nb\nc\n' },
      { name: 'old-nl-new-no-nl', a: 'a\nb\nc\n', b: 'a\nb\nc' },
      { name: 'both-no-nl-change', a: 'a\nb\nc', b: 'a\nb\nd' },
      { name: 'added-file-no-nl', a: null, b: 'only\nlines' },
      { name: 'deleted-file-no-nl', a: 'only\nlines', b: null },
    ];

    for (const c of cases) {
      // Write both sides as files and let git diff them.
      const aPath = path.join(repo, `${c.name}.a`);
      const bPath = path.join(repo, `${c.name}.b`);
      await fs.writeFile(aPath, c.a ?? '');
      await fs.writeFile(bPath, c.b ?? '');
      const gitArgs = ['diff', '--no-index', '-U3', c.a === null ? '/dev/null' : aPath, c.b === null ? '/dev/null' : bPath];
      const git = hunkRegion(gitRaw(repo, gitArgs).stdout.toString('utf8'));

      const ours = hunkRegion(
        unifiedDiff({
          path: 'f',
          oldBuf: c.a === null ? null : Buffer.from(c.a),
          newBuf: c.b === null ? null : Buffer.from(c.b),
        }),
      );
      assert.deepEqual(ours, git, `case ${c.name}`);
    }
  } finally {
    rmDir(repo);
  }
});
