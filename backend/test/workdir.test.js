import { test } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import fs from 'node:fs/promises';
import { initCommand } from '../src/cli/commands/init.js';
import { addCommand } from '../src/cli/commands/add.js';
import { commitCommand } from '../src/cli/commands/commit.js';
import { branchCommand } from '../src/cli/commands/branch.js';
import { checkoutCommand } from '../src/cli/commands/checkout.js';
import { diffCommand } from '../src/cli/commands/diff.js';
import { computeStatus } from '../src/core/workdir/workdir.js';
import { Repo } from '../src/core/repo/repo.js';
import { UsageError } from '../src/util/errors.js';
import { hasGit, gitStr, makeTempDir, rmDir } from './helpers/git.js';

const env = { GRITTY_AUTHOR_NAME: 'Ada', GRITTY_AUTHOR_EMAIL: 'ada@example.com' };
const now = new Date('2005-04-07T22:13:13.000Z');

async function commitAll(dir, msg) {
  await addCommand({ cwd: dir, paths: ['.'] });
  await commitCommand({ cwd: dir, message: msg, now, env });
}

test('status/diff do not crash when a tracked file becomes a directory', async () => {
  const dir = makeTempDir();
  try {
    await initCommand({ cwd: dir });
    await fs.writeFile(path.join(dir, 'x'), 'i am a file\n');
    await commitAll(dir, 'c1');

    // Replace the tracked file `x` with a directory (a typechange in the worktree).
    await fs.rm(path.join(dir, 'x'));
    await fs.mkdir(path.join(dir, 'x'));
    await fs.writeFile(path.join(dir, 'x', 'y.txt'), 'y\n');

    // Previously these threw a raw EISDIR error.
    const repo = await Repo.find(dir);
    const status = await computeStatus(repo);
    assert.deepEqual(status.unstaged, [{ path: 'x', type: 'deleted' }]);
    assert.deepEqual(status.untracked, ['x/y.txt']);

    const diff = await diffCommand({ cwd: dir });
    assert.match(diff, /deleted file mode/);
    assert.match(diff, /-i am a file/);
  } finally {
    rmDir(dir);
  }
});

test('branch: create, list with current marker, reject dup/unborn', async () => {
  const dir = makeTempDir();
  try {
    await initCommand({ cwd: dir });
    await assert.rejects(() => branchCommand({ cwd: dir, name: 'x' }), (e) => e instanceof UsageError);

    await fs.writeFile(path.join(dir, 'a.txt'), 'a\n');
    await commitAll(dir, 'c1');

    await branchCommand({ cwd: dir, name: 'feature' });
    // Branches list sorted by name; the current branch is marked with '*'.
    assert.equal(await branchCommand({ cwd: dir }), '  feature\n* main');
    await assert.rejects(() => branchCommand({ cwd: dir, name: 'feature' }), /already exists/);
  } finally {
    rmDir(dir);
  }
});

test('checkout switches trees and rewrites the worktree', async () => {
  const dir = makeTempDir();
  try {
    await initCommand({ cwd: dir });
    await fs.writeFile(path.join(dir, 'f.txt'), 'v1\n');
    await commitAll(dir, 'c1');
    await branchCommand({ cwd: dir, name: 'feature' });

    await checkoutCommand({ cwd: dir, target: 'feature' });
    await fs.writeFile(path.join(dir, 'f.txt'), 'v2\n');
    await fs.writeFile(path.join(dir, 'g.txt'), 'only on feature\n');
    await commitAll(dir, 'c2');

    await checkoutCommand({ cwd: dir, target: 'main' });
    assert.equal(await fs.readFile(path.join(dir, 'f.txt'), 'utf8'), 'v1\n');
    await assert.rejects(() => fs.stat(path.join(dir, 'g.txt'))); // removed on main

    // Clean state per git.
    if (hasGit) {
      const gd = path.join(dir, '.gritty');
      const porcelain = gitStr(dir, ['--git-dir', gd, '--work-tree', dir, 'status', '--porcelain'])
        .split('\n')
        .filter((l) => l && !l.includes('.gritty'));
      assert.deepEqual(porcelain, []);
    }
  } finally {
    rmDir(dir);
  }
});

test('checkout is blocked by conflicting local changes', async () => {
  const dir = makeTempDir();
  try {
    await initCommand({ cwd: dir });
    await fs.writeFile(path.join(dir, 'f.txt'), 'v1\n');
    await commitAll(dir, 'c1');
    await branchCommand({ cwd: dir, name: 'feature' });
    await checkoutCommand({ cwd: dir, target: 'feature' });
    await fs.writeFile(path.join(dir, 'f.txt'), 'v2\n');
    await commitAll(dir, 'c2');
    await checkoutCommand({ cwd: dir, target: 'main' });

    // Locally modify f.txt (which differs between branches) and try to switch.
    await fs.writeFile(path.join(dir, 'f.txt'), 'local edit\n');
    await assert.rejects(
      () => checkoutCommand({ cwd: dir, target: 'feature' }),
      /would be overwritten/,
    );
  } finally {
    rmDir(dir);
  }
});

test('checkout <commit> detaches HEAD', async () => {
  const dir = makeTempDir();
  try {
    await initCommand({ cwd: dir });
    await fs.writeFile(path.join(dir, 'f.txt'), 'v1\n');
    await commitAll(dir, 'c1');
    const repo = await Repo.find(dir);
    const sha = await repo.resolveHead();

    const out = await checkoutCommand({ cwd: dir, target: sha });
    assert.match(out, /detached/);
    assert.equal(await repo.currentBranch(), null);
    assert.deepEqual(await repo.head.read(), { type: 'detached', sha });
  } finally {
    rmDir(dir);
  }
});

test('status categories match `git status --porcelain`', { skip: !hasGit }, async () => {
  const dir = makeTempDir();
  try {
    await initCommand({ cwd: dir });
    await fs.writeFile(path.join(dir, 'a.txt'), 'a\n');
    await fs.writeFile(path.join(dir, 'b.txt'), 'b\n');
    await fs.writeFile(path.join(dir, 'c.txt'), 'c\n');
    await commitAll(dir, 'baseline');

    // Craft one of every category.
    await fs.writeFile(path.join(dir, 'new.txt'), 'new\n'); // staged add
    await fs.writeFile(path.join(dir, 'a.txt'), 'a2\n'); // staged modify
    await fs.rm(path.join(dir, 'b.txt')); // staged delete
    await addCommand({ cwd: dir, paths: ['new.txt', 'a.txt', 'b.txt'] });
    await fs.writeFile(path.join(dir, 'c.txt'), 'c2\n'); // unstaged modify
    await fs.writeFile(path.join(dir, 'u.txt'), 'u\n'); // untracked

    const repo = await Repo.find(dir);
    const ours = normalizeOurs(await computeStatus(repo));

    const gd = path.join(dir, '.gritty');
    const porcelain = gitStr(dir, ['--git-dir', gd, '--work-tree', dir, 'status', '--porcelain', '-uall']);
    const theirs = normalizeGit(porcelain);

    assert.deepEqual(ours, theirs);
  } finally {
    rmDir(dir);
  }
});

function normalizeOurs(status) {
  const S = { 'new file': 'A', modified: 'M', deleted: 'D' };
  return {
    staged: status.staged.map((c) => `${S[c.type]} ${c.path}`).sort(),
    unstaged: status.unstaged.map((c) => `${S[c.type]} ${c.path}`).sort(),
    untracked: [...status.untracked].sort(),
  };
}

function normalizeGit(porcelain) {
  const staged = [];
  const unstaged = [];
  const untracked = [];
  for (const line of porcelain.split('\n')) {
    if (!line) continue;
    const code = line.slice(0, 2);
    const p = line.slice(3);
    if (p.startsWith('.gritty')) continue;
    if (code === '??') {
      untracked.push(p);
      continue;
    }
    if ('AMD'.includes(code[0])) staged.push(`${code[0]} ${p}`);
    if ('MD'.includes(code[1])) unstaged.push(`${code[1]} ${p}`);
  }
  return { staged: staged.sort(), unstaged: unstaged.sort(), untracked: untracked.sort() };
}
