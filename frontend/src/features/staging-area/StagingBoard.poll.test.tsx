import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import { QueryClientProvider } from '@tanstack/react-query';
import MockAdapter from 'axios-mock-adapter';
import type { ReactNode } from 'react';
import { apiClient } from '@/api/client';
import { createQueryClient } from '@/lib/queryClient';
import { StagingBoard } from './StagingBoard';

const mock = new MockAdapter(apiClient);

beforeEach(() => vi.useFakeTimers());
afterEach(() => {
  vi.useRealTimers();
  mock.reset();
});

function wrap(children: ReactNode) {
  const qc = createQueryClient();
  return render(<QueryClientProvider client={qc}>{children}</QueryClientProvider>);
}

const clean = {
  branch: 'main',
  headSha: 'a'.repeat(40),
  staged: [],
  unstaged: [],
  untracked: [],
};
const editedExternally = {
  ...clean,
  unstaged: [{ path: 'README.md', type: 'modified' }],
};

describe('StagingBoard live poll', () => {
  it('reflects a file edited outside the browser within one poll interval, no remount', async () => {
    let calls = 0;
    mock.onGet('/status').reply(() => {
      calls += 1;
      return [200, calls === 1 ? clean : editedExternally];
    });

    wrap(<StagingBoard />);

    // Initial fetch.
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1);
    });
    expect(screen.getByText('Staging')).toBeInTheDocument();
    const titleNode = screen.getByText('Staging');
    expect(screen.queryByText('README.md')).not.toBeInTheDocument();

    // One poll interval later (default 3000ms), the external edit shows up.
    await act(async () => {
      await vi.advanceTimersByTimeAsync(3000);
    });
    expect(screen.getByText('README.md')).toBeInTheDocument();
    // Same Panel title node — the board updated in place, it did not remount.
    expect(screen.getByText('Staging')).toBe(titleNode);
    expect(calls).toBeGreaterThanOrEqual(2);
  });
});
