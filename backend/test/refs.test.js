import { test } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import fs from 'node:fs/promises';
import { Refs, isValidBranchName } from '../src/core/refs/refs.js';
import { Head } from '../src/core/refs/head.js';
import { init } from '../src/core/repo/init.js';
import { Repo } from '../src/core/repo/repo.js';
import { RefNotFound, NotARepo } from '../src/util/errors.js';
import { readIfExists } from '../src/util/fsx.js';
import { makeTempDir, rmDir } from './helpers/git.js';

const SHA_A = 'a'.repeat(40);
const SHA_B = 'b'.repeat(40);

test('refs: update writes "<sha>\\n" and read returns the sha', async () => {
  const dir = makeTempDir();
  try {
    const refs = new Refs(dir);
    await refs.update('refs/heads/main', SHA_A);
    const raw = await readIfExists(refs.refPath('refs/heads/main'));
    assert.equal(raw.toString('utf8'), `${SHA_A}\n`);
    assert.equal(await refs.read('refs/heads/main'), SHA_A);
  } finally {
    rmDir(dir);
  }
});

test('refs: read follows symbolic redirects', async () => {
  const dir = makeTempDir();
  try {
    const refs = new Refs(dir);
    await refs.update('refs/heads/main', SHA_A);
    // Hand-write a symbolic ref pointing at main.
    await fs.mkdir(path.join(dir, 'refs', 'heads'), { recursive: true });
    await fs.writeFile(refs.refPath('refs/heads/alias'), 'ref: refs/heads/main\n');
    assert.equal(await refs.read('refs/heads/alias'), SHA_A);
  } finally {
    rmDir(dir);
  }
});

test('refs: read is null for missing, resolve throws RefNotFound', async () => {
  const dir = makeTempDir();
  try {
    const refs = new Refs(dir);
    assert.equal(await refs.read('refs/heads/nope'), null);
    await assert.rejects(() => refs.resolve('refs/heads/nope'), (e) => e instanceof RefNotFound);
  } finally {
    rmDir(dir);
  }
});

test('refs: listBranches returns sorted name/sha pairs incl. nested', async () => {
  const dir = makeTempDir();
  try {
    const refs = new Refs(dir);
    await refs.update('refs/heads/main', SHA_A);
    await refs.update('refs/heads/feature/x', SHA_B);
    const branches = await refs.listBranches();
    assert.deepEqual(branches, [
      { name: 'feature/x', sha: SHA_B },
      { name: 'main', sha: SHA_A },
    ]);
  } finally {
    rmDir(dir);
  }
});

test('refs: delete removes the ref', async () => {
  const dir = makeTempDir();
  try {
    const refs = new Refs(dir);
    await refs.update('refs/heads/tmp', SHA_A);
    await refs.delete('refs/heads/tmp');
    assert.equal(await refs.exists('refs/heads/tmp'), false);
    await refs.delete('refs/heads/tmp'); // idempotent
  } finally {
    rmDir(dir);
  }
});

test('isValidBranchName enforces a sane subset of git rules', () => {
  for (const ok of ['main', 'feature/x', 'release-1.0', 'a_b']) {
    assert.equal(isValidBranchName(ok), true, ok);
  }
  for (const bad of ['', '-x', '/x', 'x/', 'a..b', 'a b', 'a~b', 'a:b', 'x.lock', 'a//b']) {
    assert.equal(isValidBranchName(bad), false, bad);
  }
});

test('head: symbolic vs detached round-trip', async () => {
  const dir = makeTempDir();
  try {
    const head = new Head(dir);
    await head.setSymbolic('refs/heads/main');
    assert.deepEqual(await head.read(), { type: 'symbolic', ref: 'refs/heads/main' });
    assert.equal(await head.readRaw(), 'ref: refs/heads/main');

    await head.setDetached(SHA_A);
    assert.deepEqual(await head.read(), { type: 'detached', sha: SHA_A });
  } finally {
    rmDir(dir);
  }
});

test('head: null before init, malformed throws', async () => {
  const dir = makeTempDir();
  try {
    const head = new Head(dir);
    assert.equal(await head.read(), null);
    await fs.writeFile(head.path, 'garbage');
    await assert.rejects(() => head.read());
  } finally {
    rmDir(dir);
  }
});

test('init: scaffolds .gritty with HEAD -> main and reports reinit', async () => {
  const dir = makeTempDir();
  try {
    const { repo, gitdir, reinitialized } = await init(dir);
    assert.equal(reinitialized, false);
    assert.equal(await readIfExists(path.join(gitdir, 'HEAD')).then((b) => b.toString()), 'ref: refs/heads/main\n');
    assert.equal(await repo.currentBranch(), 'main');
    assert.equal(await repo.resolveHead(), null); // unborn branch

    const again = await init(dir);
    assert.equal(again.reinitialized, true);
  } finally {
    rmDir(dir);
  }
});

test('repo: find walks up to the .gritty root; throws NotARepo otherwise', async () => {
  const dir = makeTempDir();
  try {
    await init(dir);
    const nested = path.join(dir, 'a', 'b', 'c');
    await fs.mkdir(nested, { recursive: true });
    const repo = await Repo.find(nested);
    assert.equal(repo.root, path.resolve(dir));

    const orphan = makeTempDir();
    try {
      await assert.rejects(() => Repo.find(orphan), (e) => e instanceof NotARepo);
    } finally {
      rmDir(orphan);
    }
  } finally {
    rmDir(dir);
  }
});
