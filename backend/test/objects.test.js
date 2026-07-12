import { test } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { ObjectStore } from '../src/core/objects/objectStore.js';
import { writeBlob, readBlob, blobId } from '../src/core/objects/blob.js';
import { treeId, writeTree, Mode } from '../src/core/objects/tree.js';
import { commitId, writeCommit } from '../src/core/objects/commit.js';
import { BadObject } from '../src/util/errors.js';
import { hasGit, git, gitStr, initGitRepo, makeTempDir, rmDir } from './helpers/git.js';

test('store round-trips content through write -> read', async () => {
  const dir = makeTempDir();
  try {
    const store = new ObjectStore(path.join(dir, 'objects'));
    const content = Buffer.from('some file contents\n');
    const sha = await store.write('blob', content);
    assert.ok(await store.has(sha));

    const obj = await store.read(sha);
    assert.equal(obj.type, 'blob');
    assert.equal(obj.size, content.length);
    assert.deepEqual(obj.content, content);
  } finally {
    rmDir(dir);
  }
});

test('objects land at objects/<xx>/<38>', async () => {
  const dir = makeTempDir();
  try {
    const store = new ObjectStore(path.join(dir, 'objects'));
    const sha = await writeBlob(store, 'hello\n');
    assert.equal(sha, 'ce013625030ba8dba906f756967f9e9ca394464a');
    assert.equal(
      store.objectPath(sha),
      path.join(dir, 'objects', 'ce', '013625030ba8dba906f756967f9e9ca394464a'),
    );
  } finally {
    rmDir(dir);
  }
});

test('write is idempotent for identical content', async () => {
  const dir = makeTempDir();
  try {
    const store = new ObjectStore(path.join(dir, 'objects'));
    const a = await writeBlob(store, 'dup\n');
    const b = await writeBlob(store, 'dup\n');
    assert.equal(a, b);
  } finally {
    rmDir(dir);
  }
});

test('read throws BadObject for a missing id', async () => {
  const dir = makeTempDir();
  try {
    const store = new ObjectStore(path.join(dir, 'objects'));
    await assert.rejects(
      () => store.read('0000000000000000000000000000000000000000'),
      (err) => err instanceof BadObject,
    );
  } finally {
    rmDir(dir);
  }
});

test('binary content survives a round-trip byte-exact', async () => {
  const dir = makeTempDir();
  try {
    const store = new ObjectStore(path.join(dir, 'objects'));
    const bytes = Buffer.from([0, 1, 2, 255, 254, 0, 10, 13, 127, 128]);
    const sha = await writeBlob(store, bytes);
    assert.deepEqual(await readBlob(store, sha), bytes);
  } finally {
    rmDir(dir);
  }
});

// ---- Byte compatibility with real git ------------------------------------

test('blob id equals `git hash-object` and object is readable by git', { skip: !hasGit }, async () => {
  const repo = initGitRepo();
  try {
    const content = Buffer.from('gritty ↔ git parity check\nsecond line\n');

    // 1. Same id as real git computes for the same bytes.
    const gitId = gitStr(repo, ['hash-object', '-t', 'blob', '--stdin'], { input: content });
    assert.equal(blobId(content), gitId);

    // 2. Write it with Gritty straight into git's own object db...
    const store = new ObjectStore(path.join(repo, '.git', 'objects'));
    const sha = await writeBlob(store, content);
    assert.equal(sha, gitId);

    // 3. ...and real git can read it back, byte-for-byte.
    assert.equal(gitStr(repo, ['cat-file', '-t', sha]), 'blob');
    assert.deepEqual(git(repo, ['cat-file', '-p', sha]), content);
  } finally {
    rmDir(repo);
  }
});

test('tree id equals `git mktree` (incl. the file-vs-dir sort)', { skip: !hasGit }, async () => {
  const repo = initGitRepo();
  try {
    const store = new ObjectStore(path.join(repo, '.git', 'objects'));

    // A subtree "foo" and a file "foo.txt" — the ordering trap.
    const inner = await writeBlob(store, 'x');
    const subSha = await writeTree(store, [{ mode: Mode.FILE, name: 'inner', sha: inner }]);
    const fileSha = await writeBlob(store, 'top-level\n');

    const entries = [
      { mode: Mode.DIR, name: 'foo', sha: subSha },
      { mode: Mode.FILE, name: 'foo.txt', sha: fileSha },
    ];

    // git mktree sorts for us, so a matching id proves our sort is correct.
    const mktreeInput =
      `040000 tree ${subSha}\tfoo\n` + `100644 blob ${fileSha}\tfoo.txt\n`;
    const gitTree = gitStr(repo, ['mktree'], { input: mktreeInput });
    assert.equal(treeId(entries), gitTree);

    const ourTree = await writeTree(store, entries);
    assert.equal(ourTree, gitTree);
    // git can read our tree and reports the canonical order.
    const listing = gitStr(repo, ['cat-file', '-p', ourTree]);
    assert.match(listing, /foo\.txt\n.*foo$/s);
  } finally {
    rmDir(repo);
  }
});

test('commit id equals `git commit-tree`', { skip: !hasGit }, async () => {
  const repo = initGitRepo();
  try {
    const store = new ObjectStore(path.join(repo, '.git', 'objects'));
    const blob = await writeBlob(store, 'hello\n');
    const tree = await writeTree(store, [{ mode: Mode.FILE, name: 'greeting.txt', sha: blob }]);

    const ident = {
      name: 'Ada Lovelace',
      email: 'ada@example.com',
      timestamp: 1112911993,
      timezone: '+0200',
    };
    const message = 'first commit'; // no trailing newline — git commit-tree stores verbatim
    const commit = { tree, parents: [], author: ident, committer: ident, message };

    const env = {
      GIT_AUTHOR_NAME: ident.name,
      GIT_AUTHOR_EMAIL: ident.email,
      GIT_AUTHOR_DATE: `@${ident.timestamp} ${ident.timezone}`,
      GIT_COMMITTER_NAME: ident.name,
      GIT_COMMITTER_EMAIL: ident.email,
      GIT_COMMITTER_DATE: `@${ident.timestamp} ${ident.timezone}`,
    };
    const gitCommit = gitStr(repo, ['commit-tree', tree], { input: message, env });
    assert.equal(commitId(commit), gitCommit);

    const ourCommit = await writeCommit(store, commit);
    assert.equal(ourCommit, gitCommit);
    assert.equal(gitStr(repo, ['cat-file', '-t', ourCommit]), 'commit');
  } finally {
    rmDir(repo);
  }
});

test('merge commit preserves parent order', { skip: !hasGit }, async () => {
  const repo = initGitRepo();
  try {
    const store = new ObjectStore(path.join(repo, '.git', 'objects'));
    const blob = await writeBlob(store, 'root\n');
    const tree = await writeTree(store, [{ mode: Mode.FILE, name: 'f', sha: blob }]);
    const ident = { name: 'A', email: 'a@b.c', timestamp: 1000000000, timezone: '+0000' };
    const env = {
      GIT_AUTHOR_NAME: ident.name, GIT_AUTHOR_EMAIL: ident.email,
      GIT_AUTHOR_DATE: `@${ident.timestamp} ${ident.timezone}`,
      GIT_COMMITTER_NAME: ident.name, GIT_COMMITTER_EMAIL: ident.email,
      GIT_COMMITTER_DATE: `@${ident.timestamp} ${ident.timezone}`,
    };
    const p1 = gitStr(repo, ['commit-tree', tree], { input: 'p1', env });
    const p2 = gitStr(repo, ['commit-tree', tree], { input: 'p2', env });

    const merge = { tree, parents: [p1, p2], author: ident, committer: ident, message: 'merge' };
    const gitMerge = gitStr(repo, ['commit-tree', tree, '-p', p1, '-p', p2], { input: 'merge', env });
    assert.equal(commitId(merge), gitMerge);
    // Swapping parents must change the id.
    const swapped = { ...merge, parents: [p2, p1] };
    assert.notEqual(commitId(swapped), gitMerge);
  } finally {
    rmDir(repo);
  }
});
