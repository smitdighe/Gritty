import { describe, it, expect, afterEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import {
  MemoryRouter,
  Routes,
  Route,
  Navigate,
  type RouteObject,
} from 'react-router-dom';
import { QueryClientProvider } from '@tanstack/react-query';
import MockAdapter from 'axios-mock-adapter';
import type { ReactNode } from 'react';
import { routes } from './router';
import { apiClient } from '@/api/client';
import { createQueryClient } from '@/lib/queryClient';
import CommitDetailPage from '@/pages/CommitDetailPage';
import ObjectInspectorPage from '@/pages/ObjectInspectorPage';
import RepoPage from '@/pages/RepoPage';
import NotFoundPage from '@/pages/NotFoundPage';

const mock = new MockAdapter(apiClient);
afterEach(() => mock.reset());

function providers(children: ReactNode) {
  const qc = createQueryClient();
  return <QueryClientProvider client={qc}>{children}</QueryClientProvider>;
}

const IDENT = { name: 'Ada', email: 'a@x.dev', timestamp: 1609459200, timezone: '+0000' };
const COMMIT = { tree: 'b'.repeat(40), parents: [], author: IDENT, committer: IDENT, message: 'init' };

// --- Structural checks on the exported route table (no data-router needed). ---
describe('route table', () => {
  const root = routes.find((r) => r.path === '/') as RouteObject;
  const childPaths = (root.children ?? []).map((c) => c.path);

  it('mounts the layout at / with an index redirect to /repo', () => {
    expect(root).toBeDefined();
    const index = (root.children ?? []).find((c) => c.index);
    expect(index).toBeDefined();
    // index element is <Navigate to="/repo" replace />
    const el = index!.element as React.ReactElement<{ to: string }>;
    expect(el.type).toBe(Navigate);
    expect(el.props.to).toBe('/repo');
  });

  it('declares every feature route incl. :sha params', () => {
    expect(childPaths).toEqual(
      expect.arrayContaining([
        'repo',
        'repo/commit/:sha',
        'repo/objects',
        'repo/objects/:sha',
      ]),
    );
    for (const c of root.children ?? []) {
      if (c.path) expect(typeof c.lazy).toBe('function');
    }
  });

  it('includes the /dev/ui route only in DEV', () => {
    const hasDevUi = routes.some((r) => r.path === '/dev/ui');
    expect(hasDevUi).toBe(import.meta.env.DEV);
  });

  it('ends with a catch-all 404 route', () => {
    const wildcard = routes.find((r) => r.path === '*');
    expect(wildcard).toBeDefined();
    expect(typeof wildcard!.lazy).toBe('function');
  });
});

// --- Behavioral checks: pages resolve params via the component router. ---
describe('pages', () => {
  it('RepoPage renders its feature panels', async () => {
    mock.onGet('/status').reply(200, {
      branch: 'main',
      headSha: 'a'.repeat(40),
      staged: [],
      unstaged: [],
      untracked: [],
    });
    mock.onGet('/branches').reply(200, { branches: [], current: 'main' });
    mock.onGet('/log').reply(200, []);

    render(
      providers(
        <MemoryRouter initialEntries={['/repo']}>
          <Routes>
            <Route path="/repo" element={<RepoPage />} />
          </Routes>
        </MemoryRouter>,
      ),
    );
    expect(await screen.findByText('Branches')).toBeInTheDocument();
    expect(screen.getByText('Staging')).toBeInTheDocument();
    expect(screen.getByText('Commits')).toBeInTheDocument();
  });

  it('CommitDetailPage reads the :sha param and renders commit metadata', async () => {
    const sha = 'abcdef1234567890abcdef1234567890abcdef12';
    mock.onGet(`/objects/${sha}`).reply(200, { type: 'commit', size: 100, content: COMMIT });

    render(
      providers(
        <MemoryRouter initialEntries={[`/repo/commit/${sha}`]}>
          <Routes>
            <Route path="/repo/commit/:sha" element={<CommitDetailPage />} />
          </Routes>
        </MemoryRouter>,
      ),
    );
    expect(await screen.findByText(/Commit abcdef1/i)).toBeInTheDocument();
    expect(screen.getByText('init')).toBeInTheDocument();
  });

  it('ObjectInspectorPage reads the :sha param', () => {
    const sha = '1111111111111111111111111111111111111111';
    render(
      <MemoryRouter initialEntries={[`/repo/objects/${sha}`]}>
        <Routes>
          <Route path="/repo/objects/:sha" element={<ObjectInspectorPage />} />
        </Routes>
      </MemoryRouter>,
    );
    expect(screen.getByText(sha)).toBeInTheDocument();
  });

  it('NotFoundPage renders a 404 with a link back to /repo', () => {
    render(
      <MemoryRouter initialEntries={['/nope']}>
        <NotFoundPage />
      </MemoryRouter>,
    );
    expect(screen.getByText('404')).toBeInTheDocument();
    const link = screen.getByRole('link', { name: /back to repository/i });
    expect(link).toHaveAttribute('href', '/repo');
  });
});
