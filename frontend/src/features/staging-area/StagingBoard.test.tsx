import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import { QueryClientProvider } from '@tanstack/react-query';
import MockAdapter from 'axios-mock-adapter';
import type { ReactNode } from 'react';
import { apiClient } from '@/api/client';
import { createQueryClient } from '@/lib/queryClient';
import { StagingBoard } from './StagingBoard';

const mock = new MockAdapter(apiClient);
afterEach(() => mock.reset());

function wrap(children: ReactNode) {
  const qc = createQueryClient();
  return render(<QueryClientProvider client={qc}>{children}</QueryClientProvider>);
}

/** Locate a column's body by its uppercase title, returning a scoped query. */
function column(title: string) {
  const heading = screen.getByText(title);
  // title bar is a sibling within the column container
  const col = heading.closest('div')!.parentElement!;
  return within(col);
}

describe('StagingBoard (bucketing rendered)', () => {
  it('renders each change in the correct column', async () => {
    mock.onGet('/status').reply(200, {
      branch: 'main',
      headSha: 'a'.repeat(40),
      staged: [
        { path: 'added.txt', type: 'new file' },
        { path: 'removed.txt', type: 'deleted' },
      ],
      unstaged: [{ path: 'working.txt', type: 'modified' }],
      untracked: ['note.md'],
    });

    wrap(<StagingBoard />);

    await waitFor(() => expect(screen.getByText('Index')).toBeInTheDocument());

    // Index: both staged files.
    expect(column('Index').getByText('added.txt')).toBeInTheDocument();
    expect(column('Index').getByText('removed.txt')).toBeInTheDocument();

    // HEAD: only the staged deletion (existed at HEAD); the new file must NOT appear.
    expect(column('HEAD').getByText('removed.txt')).toBeInTheDocument();
    expect(column('HEAD').queryByText('added.txt')).not.toBeInTheDocument();

    // Worktree: untracked + unstaged.
    expect(column('Worktree').getByText('note.md')).toBeInTheDocument();
    expect(column('Worktree').getByText('working.txt')).toBeInTheDocument();
  });

  it('surfaces a typed error instead of blanking', async () => {
    mock.onGet('/status').reply(404, {
      error: { code: 'NotARepo', message: 'not a gritty repository' },
    });

    wrap(<StagingBoard />);

    await waitFor(() =>
      expect(screen.getByText(/not a gritty repository/i)).toBeInTheDocument(),
    );
    expect(screen.getByText('NotARepo')).toBeInTheDocument();
  });
});
