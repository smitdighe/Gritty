/**
 * Test helpers for driving the *real* system `git` as an oracle, plus temp-dir
 * management. If `git` is not installed, `hasGit` is false and callers should
 * skip parity assertions rather than fail.
 */

import { execFileSync, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

/** Whether a usable `git` is on PATH. Evaluated once at import time. */
export const hasGit = (() => {
  try {
    execFileSync('git', ['--version'], { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
})();

/**
 * Run git in `cwd`. Returns stdout as a Buffer (so binary output survives).
 * @param {string} cwd
 * @param {string[]} args
 * @param {{ input?: Buffer|string, env?: Record<string,string> }} [opts]
 * @returns {Buffer}
 */
export function git(cwd, args, opts = {}) {
  const res = spawnSync('git', args, {
    cwd,
    input: opts.input,
    env: { ...process.env, ...opts.env },
  });
  if (res.status !== 0) {
    throw new Error(
      `git ${args.join(' ')} failed (${res.status}): ${res.stderr?.toString() ?? ''}`,
    );
  }
  return res.stdout;
}

/** `git ...` returning trimmed stdout as a string. */
export function gitStr(cwd, args, opts = {}) {
  return git(cwd, args, opts).toString('utf8').trim();
}

/**
 * Run git without throwing on a non-zero exit (needed for `git diff`, which
 * exits 1 when differences exist). Returns the raw spawnSync result.
 */
export function gitRaw(cwd, args, opts = {}) {
  return spawnSync('git', args, { cwd, input: opts.input, env: { ...process.env, ...opts.env } });
}

/** Create a fresh temp directory (auto-unique). Caller cleans up via `rmDir`. */
export function makeTempDir(prefix = 'gritty-test-') {
  return fs.mkdtempSync(path.join(os.tmpdir(), prefix));
}

/** Recursively remove a directory, ignoring errors. */
export function rmDir(dir) {
  fs.rmSync(dir, { recursive: true, force: true });
}

/** Init a real git repo in a fresh temp dir; returns its path. */
export function initGitRepo() {
  const dir = makeTempDir('gritty-git-');
  git(dir, ['init', '-q']);
  // Deterministic identity in case any command needs it.
  git(dir, ['config', 'user.name', 'Test']);
  git(dir, ['config', 'user.email', 'test@example.com']);
  return dir;
}
