import type { RepoStatus, StatusChangeType } from '@/types/domain';

/**
 * Bucketing of `computeStatus` output into a three-snapshot board:
 * HEAD → Index → Worktree. A change is "present" in a snapshot column when
 * that snapshot holds a divergent version of the path, per the exact semantics
 * of backend/src/core/workdir/workdir.js:
 *
 *   staged   = HEAD  vs index    (types: 'new file' | 'modified' | 'deleted')
 *   unstaged = index vs worktree (types: 'modified' | 'deleted')
 *   untracked= worktree files with no index entry
 *
 * Column membership (only divergent paths are listed — the board shows changes,
 * not every tracked file, because /status does not enumerate the HEAD tree):
 *
 *   HEAD col     — staged 'modified'/'deleted' (the path exists at HEAD and has
 *                  a staged change against it). A staged 'new file' is NOT at
 *                  HEAD, so it is excluded here.
 *   Index col    — every staged change (index diverges from HEAD).
 *   Worktree col — untracked paths + every unstaged change (worktree diverges
 *                  from index).
 *
 * A file that is both staged AND unstaged (e.g. staged a modification, then
 * edited again) appears in all three columns — the classic HEAD/index/worktree
 * three-way divergence.
 */

export type StagingColumn = 'head' | 'index' | 'worktree';

export type StagingItemType = StatusChangeType | 'untracked';

export interface StagingItem {
  path: string;
  type: StagingItemType;
}

export interface StagingBuckets {
  head: StagingItem[];
  index: StagingItem[];
  worktree: StagingItem[];
}

const byPath = (a: StagingItem, b: StagingItem) => (a.path < b.path ? -1 : a.path > b.path ? 1 : 0);

export function bucketStatus(status: RepoStatus): StagingBuckets {
  const head: StagingItem[] = [];
  const index: StagingItem[] = [];
  const worktree: StagingItem[] = [];

  // Staged = HEAD vs index. Every staged change diverges the index from HEAD.
  for (const c of status.staged) {
    index.push({ path: c.path, type: c.type });
    // The path exists at HEAD unless it was newly added in the index.
    if (c.type === 'modified' || c.type === 'deleted') {
      head.push({ path: c.path, type: c.type });
    }
  }

  // Unstaged = index vs worktree. The worktree holds the divergent version.
  for (const c of status.unstaged) {
    worktree.push({ path: c.path, type: c.type });
  }

  // Untracked = worktree-only files (never added to the index).
  for (const path of status.untracked) {
    worktree.push({ path, type: 'untracked' });
  }

  head.sort(byPath);
  index.sort(byPath);
  worktree.sort(byPath);
  return { head, index, worktree };
}

/** True when the working tree has no staged, unstaged, or untracked changes. */
export function isClean(status: RepoStatus): boolean {
  return (
    status.staged.length === 0 &&
    status.unstaged.length === 0 &&
    status.untracked.length === 0
  );
}
