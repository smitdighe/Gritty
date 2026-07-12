/**
 * Working-directory operations: flatten a tree to paths, list the working tree,
 * compare HEAD ↔ index ↔ worktree (status), and materialize a tree onto disk
 * (checkout).
 *
 * Note on modes: Windows can't represent the executable bit, so status compares
 * blob content (sha) rather than 100644-vs-100755, matching git's behavior with
 * core.filemode=false. Symlinks are checked out as regular files there.
 */

import fs from 'node:fs/promises';
import path from 'node:path';
import { readTree, entryType } from '../objects/tree.js';
import { readBlob, blobId } from '../objects/blob.js';
import { readCommit } from '../objects/commit.js';
import { Index } from '../index/index.js';
import { entryFromStat } from '../index/indexEntry.js';
import { diffTrees } from '../dag/diff.js';
import { walkFiles, lstatIndexFields, readLink, mkdirp, atomicWrite } from '../../util/fsx.js';
import { GITTY_DIR } from '../repo/repo.js';

/**
 * Flatten a tree into `path -> { sha, mode }`, descending subtrees.
 * @param {import('../objects/objectStore.js').ObjectStore} store
 * @param {string} treeSha
 * @param {string} [prefix]
 * @returns {Promise<Map<string, { sha: string, mode: string }>>}
 */
export async function flattenTree(store, treeSha, prefix = '') {
  const out = new Map();
  for (const e of await readTree(store, treeSha)) {
    const p = prefix ? `${prefix}/${e.name}` : e.name;
    if (entryType(e.mode) === 'tree') {
      for (const [k, v] of await flattenTree(store, e.sha, p)) out.set(k, v);
    } else {
      out.set(p, { sha: e.sha, mode: e.mode });
    }
  }
  return out;
}

/** Repo-relative ('/'-separated) paths of every working-tree file (minus `.gritty`). */
export async function listWorktreeFiles(repo) {
  const abs = await walkFiles(repo.root, (_p, name) => name === GITTY_DIR);
  return abs.map((a) => path.relative(repo.root, a).split(path.sep).join('/'));
}

/** Blob id + mode of a working file, or null if it's gone (or replaced by a directory). */
async function worktreeBlob(repo, rel) {
  const abs = repo.worktreePath(...rel.split('/'));
  const st = await lstatIndexFields(abs);
  // Missing, or the path is no longer a file (e.g. a tracked file became a
  // directory): treat the blob as gone so status reports a deletion instead of
  // crashing on an EISDIR read.
  if (st === null || (!st.isFile && !st.isSymbolicLink)) return null;
  const content = st.isSymbolicLink ? Buffer.from(await readLink(abs), 'utf8') : await fs.readFile(abs);
  return { sha: blobId(content), st, content };
}

/**
 * The HEAD tree flattened, or an empty map on an unborn branch.
 * @returns {Promise<Map<string, { sha: string, mode: string }>>}
 */
async function headTreeFiles(repo) {
  const head = await repo.resolveHead();
  if (!head) return new Map();
  return flattenTree(repo.store, (await readCommit(repo.store, head)).tree);
}

/**
 * @typedef {{ path: string, type: 'new file'|'modified'|'deleted' }} Change
 * @typedef {object} Status
 * @property {string|null} branch
 * @property {string|null} headSha
 * @property {Change[]} staged    HEAD vs index
 * @property {Change[]} unstaged  index vs worktree
 * @property {string[]} untracked worktree files not in the index
 */

/**
 * Compute status by comparing HEAD, the index, and the working tree.
 * @param {import('../repo/repo.js').Repo} repo
 * @returns {Promise<Status>}
 */
export async function computeStatus(repo) {
  const index = await Index.read(repo.indexPath);
  const head = await headTreeFiles(repo);
  const worktree = new Set(await listWorktreeFiles(repo));
  const indexPaths = new Set([...index.entries.keys()]);

  // Staged: HEAD vs index.
  const staged = [];
  for (const p of [...new Set([...head.keys(), ...indexPaths])].sort()) {
    const h = head.get(p);
    const i = index.get(p);
    if (h && !i) staged.push({ path: p, type: 'deleted' });
    else if (!h && i) staged.push({ path: p, type: 'new file' });
    else if (h && i && h.sha !== i.sha) staged.push({ path: p, type: 'modified' });
  }

  // Unstaged: index vs worktree.
  const unstaged = [];
  for (const e of index.list()) {
    const w = await worktreeBlob(repo, e.path);
    if (w === null) unstaged.push({ path: e.path, type: 'deleted' });
    else if (w.sha !== e.sha) unstaged.push({ path: e.path, type: 'modified' });
  }

  // Untracked: worktree files with no index entry.
  const untracked = [...worktree].filter((p) => !indexPaths.has(p)).sort();

  return { branch: await repo.currentBranch(), headSha: await repo.resolveHead(), staged, unstaged, untracked };
}

/** Remove now-empty directories from `dir` up toward the repo root. */
async function pruneEmptyDirs(repo, dir) {
  let cur = dir;
  while (cur !== repo.root && cur.startsWith(repo.root)) {
    try {
      if ((await fs.readdir(cur)).length > 0) break;
      await fs.rmdir(cur);
    } catch {
      break;
    }
    cur = path.dirname(cur);
  }
}

/**
 * Materialize `targetTree` onto the working tree, applying only the paths that
 * differ from `currentTree`, and rewrite matching index entries. Unrelated
 * files (tracked or not) are left untouched.
 * @param {import('../repo/repo.js').Repo} repo
 * @param {string} targetTree
 * @param {string|null} currentTree
 */
export async function applyCheckout(repo, targetTree, currentTree) {
  const changes = await diffTrees(repo.store, currentTree, targetTree);
  const index = await Index.read(repo.indexPath);

  for (const c of changes) {
    const abs = repo.worktreePath(...c.path.split('/'));
    if (c.type === 'delete') {
      await fs.rm(abs, { force: true });
      index.remove(c.path);
      await pruneEmptyDirs(repo, path.dirname(abs));
    } else {
      const content = await readBlob(repo.store, c.newSha);
      await mkdirp(path.dirname(abs));
      await atomicWrite(abs, content);
      const st = await lstatIndexFields(abs);
      const entry = entryFromStat(st, c.newSha, c.path);
      entry.mode = parseInt(c.newMode, 8); // keep the tree's intended mode (e.g. exec)
      index.add(entry);
    }
  }
  await index.write();
}
