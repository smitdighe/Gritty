import { test } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import fs from 'node:fs/promises';
import { Index } from '../src/core/index/index.js';
import { entryFromStat, GitMode } from '../src/core/index/indexEntry.js';
import { ObjectStore } from '../src/core/objects/objectStore.js';
import { writeBlob, blobId } from '../src/core/objects/blob.js';
import { lstatIndexFields } from '../src/util/fsx.js';
import { hasGit, gitStr, initGitRepo, makeTempDir, rmDir } from './helpers/git.js';

/** A synthetic entry with fixed stat fields, for deterministic tests. */
function fakeEntry(pathName, sha, over = {}) {
  return {
    ctimeSec: 1700000000, ctimeNano: 0,
    mtimeSec: 1700000000, mtimeNano: 0,
    dev: 0, ino: 0, mode: GitMode.REGULAR, uid: 0, gid: 0, size: 3,
    sha, stage: 0, path: pathName, ...over,
  };
}

test('add purges directory/file conflicts (no duplicate tree names)', () => {
  // file "x" then dir entry "x/y": the stale file must be dropped.
  const a = new Index('/unused');
  a.add(fakeEntry('x', '11'.repeat(20)));
  a.add(fakeEntry('x/y', '22'.repeat(20)));
  assert.deepEqual(
    a.list().map((e) => e.path),
    ['x/y'],
  );

  // reverse: nested "x/y" then file "x" — everything under x/ must go.
  const b = new Index('/unused');
  b.add(fakeEntry('x/y', '33'.repeat(20)));
  b.add(fakeEntry('x/z', '44'.repeat(20)));
  b.add(fakeEntry('x', '55'.repeat(20)));
  assert.deepEqual(
    b.list().map((e) => e.path),
    ['x'],
  );

  // a sibling with a shared prefix but no '/' boundary must NOT be purged.
  const c = new Index('/unused');
  c.add(fakeEntry('x', '66'.repeat(20)));
  c.add(fakeEntry('x.txt', '77'.repeat(20)));
  assert.deepEqual(
    c.list().map((e) => e.path).sort(),
    ['x', 'x.txt'],
  );
});

test('index round-trips through write -> read', async () => {
  const dir = makeTempDir();
  try {
    const idxPath = path.join(dir, 'index');
    const idx = new Index(idxPath);
    idx.add(fakeEntry('b.txt', 'bb'.repeat(20)));
    idx.add(fakeEntry('a/deep/name.txt', 'aa'.repeat(20), { size: 10 }));
    await idx.write();

    const reloaded = await Index.read(idxPath);
    assert.equal(reloaded.size, 2);
    // Stored/returned sorted by path.
    assert.deepEqual(reloaded.list().map((e) => e.path), ['a/deep/name.txt', 'b.txt']);
    assert.deepEqual(reloaded.get('b.txt'), idx.get('b.txt'));
  } finally {
    rmDir(dir);
  }
});

test('add replaces by path; remove unstages', async () => {
  const idx = new Index('/unused');
  idx.add(fakeEntry('f', '11'.repeat(20)));
  idx.add(fakeEntry('f', '22'.repeat(20), { size: 9 }));
  assert.equal(idx.size, 1);
  assert.equal(idx.get('f').sha, '22'.repeat(20));
  assert.equal(idx.remove('f'), true);
  assert.equal(idx.size, 0);
});

test('read of empty/missing index yields an empty index', async () => {
  const dir = makeTempDir();
  try {
    const idx = await Index.read(path.join(dir, 'nope'));
    assert.equal(idx.size, 0);
  } finally {
    rmDir(dir);
  }
});

test('corrupt checksum is rejected', async () => {
  const dir = makeTempDir();
  try {
    const idxPath = path.join(dir, 'index');
    const idx = new Index(idxPath);
    idx.add(fakeEntry('a', '33'.repeat(20)));
    await idx.write();
    const buf = await fs.readFile(idxPath);
    buf[buf.length - 1] ^= 0xff; // flip a checksum byte
    await fs.writeFile(idxPath, buf);
    await assert.rejects(() => Index.read(idxPath), /checksum/);
  } finally {
    rmDir(dir);
  }
});

test('real git can read a Gritty-written index (`git ls-files --stage`)', { skip: !hasGit }, async () => {
  const repo = initGitRepo();
  try {
    const store = new ObjectStore(path.join(repo, '.git', 'objects'));

    // Two real files at different depths (exercises padding for various name lengths).
    await fs.writeFile(path.join(repo, 'a.txt'), 'hello\n');
    await fs.mkdir(path.join(repo, 'src'), { recursive: true });
    await fs.writeFile(path.join(repo, 'src', 'main.js'), 'console.log(1)\n');

    const idx = new Index(path.join(repo, '.git', 'index'));
    for (const rel of ['a.txt', 'src/main.js']) {
      const abs = path.join(repo, rel);
      const content = await fs.readFile(abs);
      const sha = await writeBlob(store, content);
      const st = await lstatIndexFields(abs);
      idx.add(entryFromStat(st, sha, rel));
    }
    await idx.write();

    const out = gitStr(repo, ['ls-files', '--stage']);
    const lines = out.split('\n').sort();
    assert.deepEqual(lines, [
      `100644 ${blobId('hello\n')} 0\ta.txt`,
      `100644 ${blobId('console.log(1)\n')} 0\tsrc/main.js`,
    ]);
    // HEAD is unborn, so both files read as staged-adds ("A "). Crucially the
    // second (worktree) column is a space, not "M": that proves our stat fields
    // match the working tree, so git trusts the index without re-hashing.
    const status = gitStr(repo, ['status', '--porcelain']).split('\n').sort();
    assert.deepEqual(status, ['A  a.txt', 'A  src/main.js']);
  } finally {
    rmDir(repo);
  }
});
