import { Suspense } from 'react';
import { Outlet } from 'react-router-dom';
import { AppShell } from '@/components/layout';
import { Skeleton } from '@/components/ui/Skeleton';
import { useBranches, useStatus } from '@/hooks';
import { useVisibilityRefetch } from './useVisibilityRefetch';
import { useRepoStore } from '@/store/repoStore';
import { isClean } from '@/lib/staging';
import type { BranchRef } from '@/types/domain';
import type { RepoCleanliness } from '@/components/layout';

function PageFallback() {
  return (
    <div className="flex flex-col gap-3">
      <Skeleton className="h-6 w-48" />
      <Skeleton className="h-32 w-full" />
    </div>
  );
}

/**
 * Layout route: connects live chrome data (current branch via useBranches +
 * store, cleanliness via useStatus) and streams lazy pages into the shell.
 */
export function RootLayout() {
  useVisibilityRefetch();
  const activeRepoPath = useRepoStore((s) => s.activeRepoPath);
  const branches = useBranches();
  const status = useStatus();

  const current: BranchRef | null =
    branches.data?.current != null
      ? (branches.data.branches.find((b) => b.name === branches.data!.current) ?? {
          name: branches.data.current,
          sha: '',
        })
      : null;

  const cleanliness: RepoCleanliness = status.data
    ? isClean(status.data)
      ? 'clean'
      : 'dirty'
    : 'unknown';

  return (
    <AppShell
      repoName="gritty"
      repoPath={activeRepoPath ?? undefined}
      currentBranch={current}
      status={cleanliness}
    >
      <Suspense fallback={<PageFallback />}>
        <Outlet />
      </Suspense>
    </AppShell>
  );
}
