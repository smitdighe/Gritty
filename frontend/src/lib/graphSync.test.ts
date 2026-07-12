import { describe, it, expect } from 'vitest';
import { detectExternalChange, type RepoSnapshot } from './graphSync';

const snap = (p: Partial<RepoSnapshot>): RepoSnapshot => ({
  branch: 'main',
  headSha: 'A',
  branchNames: ['main'],
  shas: ['A', 'B'],
  ...p,
});

describe('detectExternalChange', () => {
  it('never diverges on first load (no prev)', () => {
    expect(detectExternalChange(null, snap({})).diverged).toBe(false);
  });

  it('does not diverge for a normal new commit (shared history)', () => {
    const prev = snap({ headSha: 'A', shas: ['A', 'B'] });
    // A new commit C advances main; A/B still present.
    const next = snap({ headSha: 'C', shas: ['C', 'A', 'B'] });
    expect(detectExternalChange(prev, next).diverged).toBe(false);
  });

  it('detects the checked-out branch being deleted externally', () => {
    const prev = snap({ branch: 'feature', branchNames: ['main', 'feature'] });
    const next = snap({ branch: 'feature', branchNames: ['main'] }); // feature gone
    const r = detectExternalChange(prev, next);
    expect(r.diverged).toBe(true);
    expect(r.reason).toBe('branch-deleted');
    expect(r.message).toMatch(/feature/);
  });

  it('detects HEAD sha vanishing from the incoming history', () => {
    const prev = snap({ headSha: 'A', shas: ['A', 'B'] });
    const next = snap({ headSha: 'A', shas: ['B', 'C'] }); // A no longer present
    const r = detectExternalChange(prev, next);
    expect(r.diverged).toBe(true);
    expect(r.reason).toBe('head-vanished');
  });

  it('detects a fully disjoint history (external reset)', () => {
    // headSha null so the head-vanished rule doesn't pre-empt the disjoint one.
    const prev = snap({ branch: null, headSha: null, shas: ['X', 'Y'], branchNames: [] });
    const next = snap({ branch: null, headSha: null, shas: ['Z', 'W'], branchNames: [] });
    const r = detectExternalChange(prev, next);
    expect(r.diverged).toBe(true);
    expect(r.reason).toBe('history-disjoint');
  });
});
