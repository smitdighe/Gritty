import { describe, it, expect } from 'vitest';
import { layoutCommitGraph, X_SPACING, Y_SPACING, type LayoutInput } from './layout';
import type { Commit, BranchRef } from '@/types/domain';

function ident(ts: number) {
  return { name: 'Ada', email: 'ada@x.dev', timestamp: ts, timezone: '+0000' };
}
function entry(sha: string, parents: string[], ts: number): { sha: string; commit: Commit } {
  return { sha, commit: { tree: `tree-${sha}`, parents, author: ident(ts), committer: ident(ts), message: `msg ${sha}` } };
}
function run(partial: Partial<LayoutInput> & Pick<LayoutInput, 'commits'>) {
  return layoutCommitGraph({ branches: [], headSha: null, ...partial });
}
function noOverlap(nodes: { x: number; y: number }[]) {
  const seen = new Set<string>();
  for (const n of nodes) {
    const key = `${n.x},${n.y}`;
    if (seen.has(key)) return false;
    seen.add(key);
  }
  return true;
}

describe('layoutCommitGraph — empty / unborn', () => {
  it('returns empty structure and an unborn HEAD for no commits', () => {
    const m = run({ commits: [], headSha: null });
    expect(m.nodes).toEqual([]);
    expect(m.edges).toEqual([]);
    expect(m.branchPointers).toEqual([]);
    expect(m.head).toEqual({ kind: 'unborn' });
    expect(m.totalCount).toBe(0);
  });

  it('keeps a symbolic HEAD with no node when commits are empty', () => {
    const m = run({ commits: [], headSha: 'a'.repeat(40), currentBranch: 'main' });
    expect(m.head).toMatchObject({ kind: 'symbolic', branch: 'main', nodeId: null });
  });
});

describe('layoutCommitGraph — single root', () => {
  it('places one root at generation 0, lane 0, no edges', () => {
    const A = entry('A', [], 1);
    const m = run({ commits: [A], headSha: 'A', currentBranch: 'main' });
    expect(m.nodes).toHaveLength(1);
    expect(m.nodes[0]).toMatchObject({ generation: 0, lane: 0, x: 0, y: 0, isRoot: true });
    expect(m.edges).toEqual([]);
    expect(m.head).toMatchObject({ kind: 'symbolic', branch: 'main', nodeId: 'A' });
  });
});

describe('layoutCommitGraph — linear chain', () => {
  const commits = [entry('C', ['B'], 3), entry('B', ['A'], 2), entry('A', [], 1)];

  it('assigns increasing generations on a single lane', () => {
    const m = run({ commits, headSha: 'C', currentBranch: 'main' });
    const gen = Object.fromEntries(m.nodes.map((n) => [n.sha, n.generation]));
    const lane = Object.fromEntries(m.nodes.map((n) => [n.sha, n.lane]));
    expect(gen).toEqual({ A: 0, B: 1, C: 2 });
    expect(lane).toEqual({ A: 0, B: 0, C: 0 });
    expect(m.edges.map((e) => e.id).sort()).toEqual(['B->A', 'C->B']);
    expect(noOverlap(m.nodes)).toBe(true);
  });
});

describe('layoutCommitGraph — divergence (two children of one parent)', () => {
  // A <- B ; B <- C ; B <- D  (C and D diverge from B)
  const commits = [entry('C', ['B'], 4), entry('D', ['B'], 3), entry('B', ['A'], 2), entry('A', [], 1)];

  it('separates the diverging tips into distinct lanes', () => {
    const m = run({ commits, headSha: 'C', currentBranch: 'main' });
    const byId = Object.fromEntries(m.nodes.map((n) => [n.sha, n]));
    expect(byId.C.generation).toBe(2);
    expect(byId.D.generation).toBe(2);
    expect(byId.C.lane).not.toBe(byId.D.lane); // never overlap
    expect(noOverlap(m.nodes)).toBe(true);
  });
});

describe('layoutCommitGraph — merge commit (2 parents)', () => {
  // R root; P1,P2 children of R; M merges P1 (mainline) + P2
  const commits = [
    entry('M', ['P1', 'P2'], 4),
    entry('P2', ['R'], 3),
    entry('P1', ['R'], 2),
    entry('R', [], 1),
  ];

  it('creates one mainline edge and one merge edge, no overlap', () => {
    const m = run({ commits, headSha: 'M', currentBranch: 'main' });
    const byId = Object.fromEntries(m.nodes.map((n) => [n.sha, n]));
    expect(byId.M.generation).toBe(2);
    expect(byId.P1.generation).toBe(1);
    expect(byId.P2.generation).toBe(1);
    expect(byId.P1.lane).not.toBe(byId.P2.lane);

    const mainline = m.edges.find((e) => e.id === 'M->P1');
    const merge = m.edges.find((e) => e.id === 'M->P2');
    expect(mainline).toMatchObject({ parentIndex: 0, isMainline: true });
    expect(merge).toMatchObject({ parentIndex: 1, isMainline: false });
    expect(noOverlap(m.nodes)).toBe(true);
  });
});

describe('layoutCommitGraph — two branches on the same commit', () => {
  const commits = [entry('B', ['A'], 2), entry('A', [], 1)];
  const branches: BranchRef[] = [
    { name: 'main', sha: 'B' },
    { name: 'feature', sha: 'B' },
  ];

  it('anchors both branch pointers to the same node', () => {
    const m = run({ commits, branches, headSha: 'B', currentBranch: 'main' });
    const main = m.branchPointers.find((p) => p.name === 'main');
    const feature = m.branchPointers.find((p) => p.name === 'feature');
    expect(main?.nodeId).toBe('B');
    expect(feature?.nodeId).toBe('B');
    expect(main?.x).toBe(feature?.x);
    expect(main?.y).toBe(feature?.y);
  });
});

describe('layoutCommitGraph — detached HEAD mid-history', () => {
  const commits = [entry('C', ['B'], 3), entry('B', ['A'], 2), entry('A', [], 1)];

  it('marks a detached HEAD on its node and flags ancestors', () => {
    const m = run({ commits, headSha: 'B', currentBranch: null });
    expect(m.head).toMatchObject({ kind: 'detached', sha: 'B', nodeId: 'B' });
    const byId = Object.fromEntries(m.nodes.map((n) => [n.sha, n]));
    expect(byId.A.isAncestorOfHead).toBe(true); // A is an ancestor of B
    expect(byId.B.isAncestorOfHead).toBe(false); // HEAD node itself excluded
    expect(byId.C.isAncestorOfHead).toBe(false); // C is a descendant, not ancestor
  });
});

describe('layoutCommitGraph — truncation to newest N generations', () => {
  const commits = [
    entry('D', ['C'], 4),
    entry('C', ['B'], 3),
    entry('B', ['A'], 2),
    entry('A', [], 1),
  ];

  it('renders only the newest generations and flags hidden parents', () => {
    const m = run({ commits, headSha: 'D', currentBranch: 'main', maxGenerations: 2 });
    expect(m.visibleCount).toBe(2);
    expect(m.truncated).toBe(true);
    expect(m.hiddenCount).toBe(2);
    const shas = m.nodes.map((n) => n.sha).sort();
    expect(shas).toEqual(['C', 'D']);
    const c = m.nodes.find((n) => n.sha === 'C')!;
    expect(c.hasHiddenParents).toBe(true); // B is hidden
    expect(c.x).toBe(0); // rebased so newest-visible window starts at x=0
    const d = m.nodes.find((n) => n.sha === 'D')!;
    expect(d.x).toBe(X_SPACING);
    // an edge to a hidden parent is dropped
    expect(m.edges.map((e) => e.id)).toEqual(['D->C']);
  });

  it('reports a branch pointer to an off-window commit as null node', () => {
    const m = run({
      commits,
      branches: [{ name: 'old', sha: 'A' }],
      headSha: 'D',
      currentBranch: 'main',
      maxGenerations: 2,
    });
    expect(m.branchPointers.find((p) => p.name === 'old')?.nodeId).toBeNull();
  });
});

describe('layoutCommitGraph — lane/coordinate invariants on a branchy graph', () => {
  // root A; B,C both from A; D merges B+C; E from D
  const commits = [
    entry('E', ['D'], 6),
    entry('D', ['B', 'C'], 5),
    entry('C', ['A'], 3),
    entry('B', ['A'], 4),
    entry('A', [], 1),
  ];

  it('never places two nodes at the same (generation, lane)', () => {
    const m = run({ commits, headSha: 'E', currentBranch: 'main' });
    expect(noOverlap(m.nodes)).toBe(true);
    // y is a multiple of the lane spacing
    for (const n of m.nodes) expect(n.y % Y_SPACING).toBe(0);
    expect(m.laneCount).toBeGreaterThanOrEqual(2);
  });
});
