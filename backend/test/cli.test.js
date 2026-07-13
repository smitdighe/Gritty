import { test } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import fs from 'node:fs/promises';
import { initCommand } from '../src/cli/commands/init.js';
import { addCommand } from '../src/cli/commands/add.js';
import { commitCommand } from '../src/cli/commands/commit.js';
import { Repo } from '../src/core/repo/repo.js';
import { readCommit } from '../src/core/objects/commit.js';
import { Index } from '../src/core/index/index.js';
import { computeStatus } from '../src/core/workdir/workdir.js';
import { UsageError } from '../src/util/errors.js';
import { hasGit, git, gitStr, makeTempDir, rmDir } from './helpers/git.js';

const env = { GRITTY_AUTHOR_NAME: 'Ada', GRITTY_AUTHOR_EMAIL: 'ada@example.com' };
const now = new Date('2005-04-07T22:13:13.000Z');

async function seedRepo(dir) {
  await initCommand({ cwd: dir });
  await fs.writeFile(path.join(dir, 'a.txt'), 'hello\n');
  await fs.mkdir(path.join(dir, 'src'));
  await fs.writeFile(path.join(dir, 'src', 'main.js'), 'console.log(1)\n');
}

test('init + add + commit builds a git-valid object graph', async () => {
  const dir = makeTempDir();
  try {
    await seedRepo(dir);
    const addOut = await addCommand({ cwd: dir, paths: ['.'] });
    assert.match(addOut, /staged 2 file\(s\)/);

    const out = await commitCommand({ cwd: dir, message: 'first commit', now, env });
    assert.match(out, /^\[main \(root-commit\) [0-9a-f]{7}\] first commit$/);

    const repo = await Repo.find(dir);
    const head = await repo.resolveHead();
    assert.ok(head);
    const commit = await readCommit(repo.store, head);
    assert.equal(commit.parents.length, 0);
    assert.equal(commit.author.name, 'Ada');

    if (hasGit) {
      const gd = path.join(dir, '.gritty');
      git(dir, ['--git-dir', gd, 'fsck']); // throws if the graph is invalid
      const lsTree = gitStr(dir, ['--git-dir', gd, 'ls-tree', '-r', 'HEAD']);
      assert.match(lsTree, /\ta\.txt$/m);
      assert.match(lsTree, /\tsrc\/main\.js$/m);
      assert.match(gitStr(dir, ['--git-dir', gd, 'log', '--oneline']), /first commit/);
    }
  } finally {
    rmDir(dir);
  }
});

test('file->directory swap produces a git-valid tree (no duplicate entries)', async () => {
  const dir = makeTempDir();
  try {
    await initCommand({ cwd: dir });
    await fs.writeFile(path.join(dir, 'x'), 'i am a file\n');
    await addCommand({ cwd: dir, paths: ['.'] });
    await commitCommand({ cwd: dir, message: 'file', now, env });

    // Replace the file `x` with a directory `x/` containing a file.
    await fs.rm(path.join(dir, 'x'));
    await fs.mkdir(path.join(dir, 'x'));
    await fs.writeFile(path.join(dir, 'x', 'y.txt'), 'now a dir\n');
    await addCommand({ cwd: dir, paths: ['x'] });
    await commitCommand({ cwd: dir, message: 'swap', now, env });

    const repo = await Repo.find(dir);
    const commit = await readCommit(repo.store, await repo.resolveHead());
    // The stale `x` blob must be gone; only `x/y.txt` remains.
    if (hasGit) {
      const gd = path.join(dir, '.gritty');
      git(dir, ['--git-dir', gd, 'fsck']); // would throw "duplicateEntries" before the fix
      const lsTree = gitStr(dir, ['--git-dir', gd, 'ls-tree', '-r', '--name-only', '-z', commit.tree])
        .split('\0')
        .filter(Boolean);
      assert.deepEqual(lsTree, ['x/y.txt']);
    }
  } finally {
    rmDir(dir);
  }
});

test('second commit is parented on the first', async () => {
  const dir = makeTempDir();
  try {
    await seedRepo(dir);
    await addCommand({ cwd: dir, paths: ['.'] });
    const repo = await Repo.find(dir);
    await commitCommand({ cwd: dir, message: 'one', now, env });
    const first = await repo.resolveHead();

    await fs.writeFile(path.join(dir, 'a.txt'), 'hello again\n');
    await addCommand({ cwd: dir, paths: ['a.txt'] });
    await commitCommand({ cwd: dir, message: 'two', now, env });

    const second = await repo.resolveHead();
    assert.notEqual(second, first);
    const commit = await readCommit(repo.store, second);
    assert.deepEqual(commit.parents, [first]);
  } finally {
    rmDir(dir);
  }
});

test('add stages a deletion for a removed tracked file', async () => {
  const dir = makeTempDir();
  try {
    await seedRepo(dir);
    await addCommand({ cwd: dir, paths: ['.'] });
    await commitCommand({ cwd: dir, message: 'one', now, env });

    await fs.rm(path.join(dir, 'a.txt'));
    const out = await addCommand({ cwd: dir, paths: ['a.txt'] });
    assert.match(out, /removed 1 file/);

    await commitCommand({ cwd: dir, message: 'drop a', now, env });
    const repo = await Repo.find(dir);
    const commit = await readCommit(repo.store, await repo.resolveHead());
    if (hasGit) {
      const gd = path.join(dir, '.gritty');
      const lsTree = gitStr(dir, ['--git-dir', gd, 'ls-tree', '-r', commit.tree]);
      assert.doesNotMatch(lsTree, /a\.txt/);
      assert.match(lsTree, /src\/main\.js/);
    }
  } finally {
    rmDir(dir);
  }
});

test('add <dir> (incl. "." for the repo root) also stages deletions under it', async () => {
  const dir = makeTempDir();
  try {
    await seedRepo(dir);
    await addCommand({ cwd: dir, paths: ['.'] });
    await commitCommand({ cwd: dir, message: 'one', now, env });

    // Delete a tracked file, then stage via the *directory* (not the exact path).
    // Previously `add .` only walked existing files on disk and never noticed
    // a tracked file had disappeared, so the deletion never got staged.
    await fs.rm(path.join(dir, 'a.txt'));
    const out = await addCommand({ cwd: dir, paths: ['.'] });
    assert.match(out, /removed 1 file/);

    const repo = await Repo.find(dir);
    const index = await Index.read(repo.indexPath);
    assert.equal(index.has('a.txt'), false);
    assert.equal(index.has('src/main.js'), true);

    // Must be stageable into a real commit, not stuck as a phantom unstaged change.
    await commitCommand({ cwd: dir, message: 'drop a via dir add', now, env });
    const status = await computeStatus(repo);
    assert.deepEqual(status.unstaged, []);
  } finally {
    rmDir(dir);
  }
});

test('commit rejects empty message and empty index', async () => {
  const dir = makeTempDir();
  try {
    await initCommand({ cwd: dir });
    await assert.rejects(() => commitCommand({ cwd: dir, message: '  ', now, env }), (e) => e instanceof UsageError);
    await assert.rejects(() => commitCommand({ cwd: dir, message: 'x', now, env }), (e) => e instanceof UsageError);
  } finally {
    rmDir(dir);
  }
});

test('committing an unchanged tree is refused', async () => {
  const dir = makeTempDir();
  try {
    await seedRepo(dir);
    await addCommand({ cwd: dir, paths: ['.'] });
    await commitCommand({ cwd: dir, message: 'one', now, env });
    // Nothing changed, index still holds the same tree.
    await assert.rejects(
      () => commitCommand({ cwd: dir, message: 'again', now, env }),
      /nothing to commit/,
    );
  } finally {
    rmDir(dir);
  }
});
