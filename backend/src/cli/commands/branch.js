/**
 * `gritty branch` — list branches (marking the current one), or
 * `gritty branch <name>` — create a branch at the current commit.
 */

import { Repo } from '../../core/repo/repo.js';
import { Refs, isValidBranchName } from '../../core/refs/refs.js';
import { UsageError } from '../../util/errors.js';

/**
 * @param {{ cwd?: string, name?: string }} [opts]
 * @returns {Promise<string>}
 */
export async function branchCommand({ cwd = process.cwd(), name } = {}) {
  const repo = await Repo.find(cwd);

  if (!name) {
    const branches = await repo.refs.listBranches();
    const current = await repo.currentBranch();
    return branches.map((b) => `${b.name === current ? '* ' : '  '}${b.name}`).join('\n');
  }

  if (!isValidBranchName(name)) throw new UsageError(`'${name}' is not a valid branch name`);
  const ref = Refs.branchRef(name);
  if (await repo.refs.exists(ref)) throw new UsageError(`a branch named '${name}' already exists`);

  const head = await repo.resolveHead();
  if (!head) throw new UsageError(`cannot create branch '${name}': no commit yet`);
  await repo.refs.update(ref, head);
  return ''; // git is silent on branch creation
}
