import { createBrowserRouter, Navigate, type RouteObject } from 'react-router-dom';
import { RootLayout } from './RootLayout';

/** Lazy page loader: adapts a default-export page to a react-router `lazy` route. */
const page = (loader: () => Promise<{ default: React.ComponentType }>) => async () => ({
  Component: (await loader()).default,
});

/**
 * Route table. The `/dev/ui` preview route is included ONLY in dev builds via
 * the `import.meta.env.DEV` guard, so a production bundle has no reference to it
 * and the URL falls through to the 404 route.
 */
export const routes: RouteObject[] = [
  {
    path: '/',
    element: <RootLayout />,
    children: [
      { index: true, element: <Navigate to="/repo" replace /> },
      { path: 'repo', lazy: page(() => import('@/pages/RepoPage')) },
      { path: 'repo/commit/:sha', lazy: page(() => import('@/pages/CommitDetailPage')) },
      { path: 'repo/objects', lazy: page(() => import('@/pages/ObjectExplorerPage')) },
      { path: 'repo/objects/:sha', lazy: page(() => import('@/pages/ObjectInspectorPage')) },
    ],
  },
  ...(import.meta.env.DEV
    ? [{ path: '/dev/ui', lazy: page(() => import('@/pages/UiPreviewPage')) }]
    : []),
  { path: '*', lazy: page(() => import('@/pages/NotFoundPage')) },
];

export function createAppRouter() {
  return createBrowserRouter(routes);
}
