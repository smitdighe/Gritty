import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { BranchPointer } from './BranchPointer';
import { layoutCommitGraph } from './layout';
import type { Commit } from '@/types/domain';

function entry(sha: string, parents: string[]): { sha: string; commit: Commit } {
  const id = { name: 'a', email: 'a@a', timestamp: 1, timezone: '+0000' };
  return { sha, commit: { tree: 't', parents, author: id, committer: id, message: sha } };
}

const COMMITS = [entry('B', ['A']), entry('A', [])];

/**
 * Renders the branch pointer at the flow position layout assigns to whichever
 * commit `main` points at — i.e. a real checkout moves the branch ref, layout
 * recomputes the position, and the SAME pointer element must travel.
 */
function Harness({ mainSha }: { mainSha: string }) {
  const model = layoutCommitGraph({
    commits: COMMITS,
    branches: [{ name: 'main', sha: mainSha }],
    headSha: mainSha,
    currentBranch: 'main',
  });
  const bp = model.branchPointers.find((p) => p.name === 'main')!;
  return <BranchPointer layoutId="main" label="main" variant="branch" x={bp.x ?? 0} y={bp.y ?? 0} />;
}

describe('BranchPointer — moves via layout transition, not remount', () => {
  it('keeps the same DOM node when the branch ref moves to another commit', () => {
    const { getByTestId, rerender } = render(<Harness mainSha="A" />);

    const before = getByTestId('branch-pointer-main');
    expect(before).toHaveAttribute('data-x', '0'); // A is at generation 0 → x=0

    // Simulate a checkout/commit that repoints main from A to B.
    rerender(<Harness mainSha="B" />);

    const after = getByTestId('branch-pointer-main');
    // Same element instance (no unmount/remount) — this is the layout animation.
    expect(after).toBe(before);
    // Position updated to B's generation-1 column.
    expect(after).toHaveAttribute('data-x', '168');
    expect(after.style.left).toBe('168px');
  });

  it('renders a detached HEAD pill with its own identity', () => {
    const { getByTestId } = render(
      <BranchPointer layoutId="HEAD" label="1e4f9a2" variant="detached" x={10} y={20} />,
    );
    const el = getByTestId('branch-pointer-HEAD');
    expect(el).toHaveTextContent('detached');
    expect(el).toHaveTextContent('1e4f9a2');
  });
});
