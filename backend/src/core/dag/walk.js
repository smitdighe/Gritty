/**
 * Commit-graph traversal. The history DAG is walked in reverse-chronological
 * order (most recent committer date first) using a small date-ordered frontier,
 * which is what `log` wants and handles merges (a commit reachable by several
 * paths is visited once).
 */

import { readCommit } from '../objects/commit.js';

/**
 * Walk ancestry from one or more starting commits.
 * @param {import('../objects/objectStore.js').ObjectStore} store
 * @param {string|string[]} start starting commit id(s)
 * @param {{ limit?: number }} [opts]
 * @returns {AsyncGenerator<{ sha: string, commit: import('../objects/commit.js').Commit }>}
 */
export async function* walkHistory(store, start, { limit = Infinity } = {}) {
  const seen = new Set();
  /** @type {Array<{ sha: string, commit: import('../objects/commit.js').Commit }>} */
  const frontier = [];

  const enqueue = async (sha) => {
    if (seen.has(sha)) return;
    seen.add(sha);
    frontier.push({ sha, commit: await readCommit(store, sha) });
  };

  for (const s of Array.isArray(start) ? start : [start]) await enqueue(s);

  let emitted = 0;
  while (frontier.length > 0 && emitted < limit) {
    // Pop the most recent commit by committer timestamp (stable enough for log).
    let bestIdx = 0;
    for (let i = 1; i < frontier.length; i++) {
      if (frontier[i].commit.committer.timestamp > frontier[bestIdx].commit.committer.timestamp) {
        bestIdx = i;
      }
    }
    const [node] = frontier.splice(bestIdx, 1);
    yield node;
    emitted++;
    for (const parent of node.commit.parents) await enqueue(parent);
  }
}

/**
 * Collect the full set of ancestor commit ids of `start` (inclusive).
 * @param {import('../objects/objectStore.js').ObjectStore} store
 * @param {string} start
 * @returns {Promise<Set<string>>}
 */
export async function ancestors(store, start) {
  const seen = new Set();
  const stack = [start];
  while (stack.length) {
    const sha = stack.pop();
    if (seen.has(sha)) continue;
    seen.add(sha);
    const commit = await readCommit(store, sha);
    stack.push(...commit.parents);
  }
  return seen;
}
