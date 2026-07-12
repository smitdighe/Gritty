import { describe, it, expect, afterEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClientProvider } from '@tanstack/react-query';
import MockAdapter from 'axios-mock-adapter';
import type { ReactNode } from 'react';
import { apiClient } from '@/api/client';
import { createQueryClient } from '@/lib/queryClient';
import { useStatus } from './useStatus';

const mock = new MockAdapter(apiClient);
afterEach(() => mock.reset());

function wrapper() {
  const qc = createQueryClient();
  return function Wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={qc}>{children}</QueryClientProvider>;
  };
}

describe('useStatus', () => {
  it('returns parsed, typed status from a mocked response', async () => {
    mock.onGet('/status').reply(200, {
      branch: 'main',
      headSha: 'a'.repeat(40),
      staged: [{ path: 'README.md', type: 'new file' }],
      unstaged: [],
      untracked: ['scratch.txt'],
    });

    const { result } = renderHook(() => useStatus(), { wrapper: wrapper() });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.branch).toBe('main');
    expect(result.current.data?.staged[0]).toEqual({ path: 'README.md', type: 'new file' });
    expect(result.current.data?.untracked).toEqual(['scratch.txt']);
  });

  it('exposes a typed GrittyApiError on a 404', async () => {
    mock.onGet('/status').reply(404, {
      error: { code: 'NotARepo', message: 'not a gritty repository' },
    });

    const { result } = renderHook(() => useStatus(), { wrapper: wrapper() });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error?.code).toBe('NotARepo');
  });
});
