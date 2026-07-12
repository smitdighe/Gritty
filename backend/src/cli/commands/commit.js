/**
 * `gritty commit -m <msg>` — snapshot the index as a tree, write a commit that
 * points at it (parented on the current HEAD), and advance the branch.
 */

import { Repo } from '../../core/repo/repo.js';
import { Index } from '../../core/index/index.js';
import { writeTreeFromIndex } from '../../core/index/indexToTree.js';
import { writeCommit, readCommit } from '../../core/objects/commit.js';
import { resolveIdentity } from '../identity.js';
import { UsageError } from '../../util/errors.js';

/**
 * @param {{ cwd?: string, message?: string, now?: Date, env?: NodeJS.ProcessEnv }} [opts]
 * @returns {Promise<string>}
 */
export async function commitCommand({ cwd = process.cwd(), message, now, env } = {}) {
  if (!message || message.trim() === '') {
    throw new UsageError('aborting commit due to empty commit message');
  }
  const repo = await Repo.find(cwd);
  const index = await Index.read(repo.indexPath);
  if (index.size === 0) {
    throw new UsageError('nothing to commit (no files staged)');
  }

  const tree = await writeTreeFromIndex(repo.store, index);
  const parentSha = await repo.resolveHead();
  const parents = parentSha ? [parentSha] : [];

  // Refuse an empty commit (index tree identical to the parent's tree).
  if (parentSha) {
    const parent = await readCommit(repo.store, parentSha);
    if (parent.tree === tree) {
      throw new UsageError('nothing to commit, working tree clean');
    }
  }

  const { author, committer } = resolveIdentity({ now, env });
  const normalized = message.endsWith('\n') ? message : `${message}\n`;
  const commitSha = await writeCommit(repo.store, {
    tree,
    parents,
    author,
    committer,
    message: normalized,
  });

  // Advance whatever HEAD points at.
  const head = await repo.head.read();
  if (head && head.type === 'symbolic') {
    await repo.refs.update(head.ref, commitSha);
  } else {
    await repo.head.setDetached(commitSha);
  }

  const branch = (await repo.currentBranch()) ?? 'detached HEAD';
  const rootNote = parents.length === 0 ? ' (root-commit)' : '';
  const summary = normalized.split('\n')[0];
  return `[${branch}${rootNote} ${commitSha.slice(0, 7)}] ${summary}`;
}
