import { describe, it, expect } from 'vitest';
import { bucketStatus, isClean } from './staging';
import type { RepoStatus } from '@/types/domain';

function status(partial: Partial<RepoStatus>): RepoStatus {
  return {
    branch: 'main',
    headSha: 'a'.repeat(40),
    staged: [],
    unstaged: [],
    untracked: [],
    ...partial,
  };
}

describe('bucketStatus', () => {
  it('places untracked files in the Worktree column only', () => {
    const b = bucketStatus(status({ untracked: ['scratch.txt'] }));
    expect(b.worktree).toEqual([{ path: 'scratch.txt', type: 'untracked' }]);
    expect(b.index).toEqual([]);
    expect(b.head).toEqual([]);
  });

  it('places a staged new file in Index but NOT HEAD (absent at HEAD)', () => {
    const b = bucketStatus(status({ staged: [{ path: 'new.txt', type: 'new file' }] }));
    expect(b.index).toEqual([{ path: 'new.txt', type: 'new file' }]);
    expect(b.head).toEqual([]);
    expect(b.worktree).toEqual([]);
  });

  it('places a staged deletion in BOTH Index and HEAD (existed at HEAD)', () => {
    const b = bucketStatus(status({ staged: [{ path: 'gone.txt', type: 'deleted' }] }));
    expect(b.index).toEqual([{ path: 'gone.txt', type: 'deleted' }]);
    expect(b.head).toEqual([{ path: 'gone.txt', type: 'deleted' }]);
    expect(b.worktree).toEqual([]);
  });

  it('places an unstaged change in the Worktree column', () => {
    const b = bucketStatus(status({ unstaged: [{ path: 'edit.txt', type: 'modified' }] }));
    expect(b.worktree).toEqual([{ path: 'edit.txt', type: 'modified' }]);
    expect(b.index).toEqual([]);
    expect(b.head).toEqual([]);
  });

  it('shows a file staged AND unstaged in all three columns (HEAD/Index/Worktree)', () => {
    const b = bucketStatus(
      status({
        staged: [{ path: 'both.txt', type: 'modified' }],
        unstaged: [{ path: 'both.txt', type: 'modified' }],
      }),
    );
    expect(b.head).toEqual([{ path: 'both.txt', type: 'modified' }]);
    expect(b.index).toEqual([{ path: 'both.txt', type: 'modified' }]);
    expect(b.worktree).toEqual([{ path: 'both.txt', type: 'modified' }]);
  });

  it('sorts each column by path', () => {
    const b = bucketStatus(status({ untracked: ['z.txt', 'a.txt', 'm.txt'] }));
    expect(b.worktree.map((i) => i.path)).toEqual(['a.txt', 'm.txt', 'z.txt']);
  });

  it('handles a mixed status correctly', () => {
    const b = bucketStatus(
      status({
        staged: [
          { path: 'added.txt', type: 'new file' },
          { path: 'removed.txt', type: 'deleted' },
        ],
        unstaged: [{ path: 'working.txt', type: 'modified' }],
        untracked: ['note.md'],
      }),
    );
    expect(b.index.map((i) => i.path)).toEqual(['added.txt', 'removed.txt']);
    expect(b.head.map((i) => i.path)).toEqual(['removed.txt']); // only the deletion existed at HEAD
    expect(b.worktree.map((i) => i.path)).toEqual(['note.md', 'working.txt']);
  });
});

describe('isClean', () => {
  it('is true only when all three arrays are empty', () => {
    expect(isClean(status({}))).toBe(true);
    expect(isClean(status({ untracked: ['x'] }))).toBe(false);
    expect(isClean(status({ staged: [{ path: 'x', type: 'modified' }] }))).toBe(false);
  });
});
