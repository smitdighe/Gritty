/**
 * `gritty diff` — two modes, matching the spec:
 *   - no args:          working tree vs the index (unstaged changes)
 *   - <revA> <revB>:    the trees of two commits
 */

import fs from 'node:fs/promises';
import { Repo } from '../../core/repo/repo.js';
import { Index } from '../../core/index/index.js';
import { readCommit } from '../../core/objects/commit.js';
import { readBlob, blobId } from '../../core/objects/blob.js';
import { diffTrees, unifiedDiff } from '../../core/dag/diff.js';
import { modeToTreeString, gitModeFromStat } from '../../core/index/indexEntry.js';
import { lstatIndexFields, readLink } from '../../util/fsx.js';
import { UsageError } from '../../util/errors.js';

/**
 * @param {{ cwd?: string, revs?: string[] }} [opts]
 * @returns {Promise<string>}
 */
export async function diffCommand({ cwd = process.cwd(), revs = [] } = {}) {
  const repo = await Repo.find(cwd);
  if (revs.length === 0) return diffWorktreeVsIndex(repo);
  if (revs.length === 2) return diffCommits(repo, revs[0], revs[1]);
  throw new UsageError('usage: gritty diff [<commitA> <commitB>]');
}

async function diffCommits(repo, revA, revB) {
  const a = await readCommit(repo.store, await repo.resolveRevision(revA));
  const b = await readCommit(repo.store, await repo.resolveRevision(revB));
  const changes = await diffTrees(repo.store, a.tree, b.tree);

  const blocks = [];
  for (const c of changes) {
    const oldBuf = c.oldSha ? await readBlob(repo.store, c.oldSha) : null;
    const newBuf = c.newSha ? await readBlob(repo.store, c.newSha) : null;
    blocks.push(
      unifiedDiff({ path: c.path, oldBuf, newBuf, oldMode: c.oldMode, newMode: c.newMode }),
    );
  }
  return blocks.join('\n');
}

async function diffWorktreeVsIndex(repo) {
  const index = await Index.read(repo.indexPath);
  const blocks = [];
  for (const entry of index.list()) {
    const abs = repo.worktreePath(...entry.path.split('/'));
    const oldMode = modeToTreeString(entry.mode);
    const st = await lstatIndexFields(abs);

    // Gone, or no longer a file (turned into a directory): show it as deleted
    // rather than crashing on an EISDIR read.
    if (st === null || (!st.isFile && !st.isSymbolicLink)) {
      const oldBuf = await readBlob(repo.store, entry.sha);
      blocks.push(unifiedDiff({ path: entry.path, oldBuf, newBuf: null, oldMode }));
      continue;
    }

    const content = st.isSymbolicLink
      ? Buffer.from(await readLink(abs), 'utf8')
      : await fs.readFile(abs);
    if (blobId(content) === entry.sha) continue; // unchanged in the worktree

    const oldBuf = await readBlob(repo.store, entry.sha);
    blocks.push(
      unifiedDiff({
        path: entry.path,
        oldBuf,
        newBuf: content,
        oldMode,
        newMode: modeToTreeString(gitModeFromStat(st)),
      }),
    );
  }
  return blocks.join('\n');
}
