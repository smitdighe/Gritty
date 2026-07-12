/** `gritty status` — summarize staged, unstaged, and untracked changes. */

import { Repo } from '../../core/repo/repo.js';
import { computeStatus } from '../../core/workdir/workdir.js';

const LABEL = { 'new file': 'new file:   ', modified: 'modified:   ', deleted: 'deleted:    ' };

/**
 * @param {{ cwd?: string }} [opts]
 * @returns {Promise<string>}
 */
export async function statusCommand({ cwd = process.cwd() } = {}) {
  const repo = await Repo.find(cwd);
  const s = await computeStatus(repo);

  const lines = [];
  lines.push(s.branch ? `On branch ${s.branch}` : `HEAD detached at ${s.headSha?.slice(0, 7) ?? '???'}`);
  if (s.headSha === null && s.branch) lines.push('', 'No commits yet');

  if (s.staged.length) {
    lines.push('', 'Changes to be committed:');
    for (const c of s.staged) lines.push(`\t${LABEL[c.type]}${c.path}`);
  }
  if (s.unstaged.length) {
    lines.push('', 'Changes not staged for commit:');
    for (const c of s.unstaged) lines.push(`\t${LABEL[c.type]}${c.path}`);
  }
  if (s.untracked.length) {
    lines.push('', 'Untracked files:');
    for (const p of s.untracked) lines.push(`\t${p}`);
  }

  if (!s.staged.length && !s.unstaged.length && !s.untracked.length) {
    lines.push('', 'nothing to commit, working tree clean');
  }
  return lines.join('\n');
}
