/**
 * `gritty checkout <branch|commit>` — switch HEAD to a branch (symbolic) or a
 * commit (detached), updating the working tree and index to match. Local edits
 * to files that differ between the two trees block the switch, as in git; edits
 * to unrelated files are carried across.
 */

import { Repo } from '../../core/repo/repo.js';
import { Refs } from '../../core/refs/refs.js';
import { readCommit } from '../../core/objects/commit.js';
import { diffTrees } from '../../core/dag/diff.js';
import { computeStatus, flattenTree, applyCheckout } from '../../core/workdir/workdir.js';
import { UsageError } from '../../util/errors.js';

/**
 * @param {{ cwd?: string, target?: string }} [opts]
 * @returns {Promise<string>}
 */
export async function checkoutCommand({ cwd = process.cwd(), target } = {}) {
  if (!target) throw new UsageError('you must specify a branch or commit to check out');
  const repo = await Repo.find(cwd);

  // Resolve the target: prefer a branch (→ symbolic HEAD), else a commit (→ detached).
  const branchRef = Refs.branchRef(target);
  const isBranch = await repo.refs.exists(branchRef);
  const commitSha = isBranch ? await repo.refs.resolve(branchRef) : await repo.resolveRevision(target);
  const targetTree = (await readCommit(repo.store, commitSha)).tree;

  const currentHead = await repo.resolveHead();
  const currentTree = currentHead ? (await readCommit(repo.store, currentHead)).tree : null;

  // Guard against clobbering local work on paths this switch would touch.
  const changes = await diffTrees(repo.store, currentTree, targetTree);
  const changedPaths = new Set(changes.map((c) => c.path));
  const status = await computeStatus(repo);
  const dirty = [...status.staged, ...status.unstaged].map((c) => c.path);
  const blocked = dirty.filter((p) => changedPaths.has(p));
  if (blocked.length) {
    throw new UsageError(
      `your local changes to the following files would be overwritten by checkout: ${blocked.join(', ')}`,
    );
  }
  const untracked = new Set(status.untracked);
  const wouldClobber = [...changedPaths].filter((p) => untracked.has(p));
  if (wouldClobber.length) {
    throw new UsageError(
      `the following untracked files would be overwritten by checkout: ${wouldClobber.join(', ')}`,
    );
  }
  // Untracked target paths not in changedPaths but present anyway (currentTree === targetTree edge).
  if (changedPaths.size === 0) {
    const targetFiles = await flattenTree(repo.store, targetTree);
    const clobber = [...targetFiles.keys()].filter((p) => untracked.has(p));
    if (clobber.length) {
      throw new UsageError(
        `the following untracked files would be overwritten by checkout: ${clobber.join(', ')}`,
      );
    }
  }

  await applyCheckout(repo, targetTree, currentTree);

  if (isBranch) {
    await repo.head.setSymbolic(branchRef);
    return `Switched to branch '${target}'`;
  }
  await repo.head.setDetached(commitSha);
  return `Note: switching to '${target}'.\nHEAD is now at ${commitSha.slice(0, 7)} (detached)`;
}
