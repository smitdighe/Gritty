/**
 * `gritty log` — walk HEAD's ancestry and print commits in git's "medium"
 * format (most recent first).
 */

import { Repo } from '../../core/repo/repo.js';
import { walkHistory } from '../../core/dag/walk.js';
import { formatGitDate } from '../format.js';
import { UsageError } from '../../util/errors.js';

/**
 * @param {{ cwd?: string, max?: number, start?: string }} [opts]
 * @returns {Promise<string>}
 */
export async function logCommand({ cwd = process.cwd(), max, start } = {}) {
  const repo = await Repo.find(cwd);
  const head = start ? await repo.resolveRevision(start) : await repo.resolveHead();
  if (!head) {
    const branch = (await repo.currentBranch()) ?? 'HEAD';
    throw new UsageError(`your current branch '${branch}' does not have any commits yet`);
  }

  const blocks = [];
  for await (const { sha, commit } of walkHistory(repo.store, head, { limit: max ?? Infinity })) {
    blocks.push(formatCommit(sha, commit));
  }
  return blocks.join('\n\n');
}

function formatCommit(sha, commit) {
  const lines = [`commit ${sha}`];
  if (commit.parents.length > 1) {
    lines.push(`Merge: ${commit.parents.map((p) => p.slice(0, 7)).join(' ')}`);
  }
  lines.push(`Author: ${commit.author.name} <${commit.author.email}>`);
  lines.push(`Date:   ${formatGitDate(commit.author.timestamp, commit.author.timezone)}`);
  lines.push('');
  for (const line of commit.message.replace(/\n+$/, '').split('\n')) {
    lines.push(`    ${line}`);
  }
  return lines.join('\n');
}
