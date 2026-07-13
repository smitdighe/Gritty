/**
 * `gritty add <paths...>` — stage file contents into the index. Directories are
 * added recursively (skipping `.gritty`); a pathspec that no longer exists on
 * disk but is tracked stages its deletion, mirroring `git add`.
 */

import fs from 'node:fs/promises';
import path from 'node:path';
import { Repo, GITTY_DIR } from '../../core/repo/repo.js';
import { Index } from '../../core/index/index.js';
import { entryFromStat } from '../../core/index/indexEntry.js';
import { writeBlob } from '../../core/objects/blob.js';
import { walkFiles, lstatIndexFields, readLink } from '../../util/fsx.js';
import { UsageError } from '../../util/errors.js';

/** Repo-relative, forward-slash path for an absolute path. */
function toRel(repo, abs) {
  return path.relative(repo.root, abs).split(path.sep).join('/');
}

/**
 * @param {{ cwd?: string, paths?: string[] }} [opts]
 * @returns {Promise<string>}
 */
export async function addCommand({ cwd = process.cwd(), paths } = {}) {
  if (!paths || paths.length === 0) {
    throw new UsageError('nothing specified, nothing added');
  }
  const repo = await Repo.find(cwd);
  const index = await Index.read(repo.indexPath);

  const toAdd = new Set();
  const toRemove = new Set();

  for (const spec of paths) {
    const abs = path.resolve(cwd, spec);
    const rel = toRel(repo, abs);
    if (rel === '' ? false : rel.startsWith('..')) {
      throw new UsageError(`pathspec '${spec}' is outside the repository`);
    }
    const st = await lstatIndexFields(abs);
    if (st === null) {
      // Missing on disk: stage deletion of matching tracked entries.
      const prefix = rel === '' ? '' : `${rel}/`;
      let matched = false;
      for (const entry of index.list()) {
        if (entry.path === rel || (prefix && entry.path.startsWith(prefix))) {
          toRemove.add(entry.path);
          matched = true;
        }
      }
      if (!matched) throw new UsageError(`pathspec '${spec}' did not match any files`);
    } else if (st.isDirectory) {
      for (const f of await walkFiles(abs, (_p, name) => name === GITTY_DIR)) {
        toAdd.add(f);
      }
      // Also stage deletions: tracked entries under this directory that no
      // longer exist on disk (walkFiles only sees files that are still there).
      const dirPrefix = rel === '' ? '' : `${rel}/`;
      for (const entry of index.list()) {
        if (rel !== '' && !entry.path.startsWith(dirPrefix)) continue;
        const entryAbs = repo.worktreePath(...entry.path.split('/'));
        if ((await lstatIndexFields(entryAbs)) === null) toRemove.add(entry.path);
      }
    } else {
      toAdd.add(abs);
    }
  }

  const staged = [];
  for (const abs of toAdd) {
    const rel = toRel(repo, abs);
    const st = await lstatIndexFields(abs);
    if (st === null) continue; // raced away; skip
    const content = st.isSymbolicLink
      ? Buffer.from(await readLink(abs), 'utf8')
      : await fs.readFile(abs);
    const sha = await writeBlob(repo.store, content);
    index.add(entryFromStat(st, sha, rel));
    staged.push(rel);
  }
  for (const rel of toRemove) index.remove(rel);

  await index.write();

  const parts = [];
  if (staged.length) parts.push(`staged ${staged.length} file(s)`);
  if (toRemove.size) parts.push(`removed ${toRemove.size} file(s)`);
  return parts.length ? parts.join(', ') : 'no changes';
}
