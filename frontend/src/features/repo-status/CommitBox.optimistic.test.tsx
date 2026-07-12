import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import MockAdapter from 'axios-mock-adapter';
import { apiClient } from '@/api/client';
import { createQueryClient } from '@/lib/queryClient';
import { queryKeys } from '@/lib/queryKeys';
import { LOG_MAX } from '@/lib/constants';
import { CommitBox } from './CommitBox';
import { CommitList } from '@/features/commit-log/CommitList';
import type { RepoStatus, BranchList, LogEntry } from '@/types/domain';

const mock = new MockAdapter(apiClient);
afterEach(() => mock.reset());

const SHA = 'a'.repeat(40);
const ident = { name: 'Ada', email: 'a@x.dev', timestamp: 1609459200, timezone: '+0000' };
const status: RepoStatus = {
  branch: 'main',
  headSha: SHA,
  staged: [{ path: 'file.txt', type: 'modified' }],
  unstaged: [],
  untracked: [],
};
const branches: BranchList = { branches: [{ name: 'main', sha: SHA }], current: 'main' };
const log: LogEntry[] = [
  { sha: SHA, commit: { tree: 't', parents: [], author: ident, committer: ident, message: 'real commit' } },
];

describe('useCommit optimistic rollback', () => {
  it('removes the pending node and shows the real error inline on a 400 UsageError', async () => {
    // GETs (used by onSettled refetch) return the unchanged history.
    mock.onGet('/status').reply(200, status);
    mock.onGet('/branches').reply(200, branches);
    mock.onGet('/log').reply(200, log);
    // The commit itself is rejected by the backend.
    mock.onPost('/commits').reply(400, {
      error: { code: 'UsageError', message: 'nothing to commit (no files staged)' },
    });

    const qc = createQueryClient();
    qc.setQueryData(queryKeys.status(), status);
    qc.setQueryData(queryKeys.branches(), branches);
    qc.setQueryData(queryKeys.log({ max: LOG_MAX }), log);

    render(
      <QueryClientProvider client={qc}>
        <MemoryRouter>
          <CommitBox />
          <CommitList />
        </MemoryRouter>
      </QueryClientProvider>,
    );

    const list = screen.getByRole('list'); // the CommitList

    await userEvent.type(screen.getByLabelText('Commit message'), 'my staged change');
    await userEvent.click(screen.getByRole('button', { name: 'Commit' }));

    // The real backend error is surfaced inline, verbatim, near the action.
    await waitFor(() =>
      expect(screen.getByText('nothing to commit (no files staged)')).toBeInTheDocument(),
    );
    expect(screen.getByText('UsageError')).toBeInTheDocument();

    // Rollback left the log with only the real commit — the pending optimistic
    // entry (author "you") is gone. Scope to the list to avoid the textarea value.
    expect(within(list).queryByText('my staged change')).not.toBeInTheDocument();
    expect(within(list).queryByText('you')).not.toBeInTheDocument();
    expect(within(list).getByText('real commit')).toBeInTheDocument();
  });
});
