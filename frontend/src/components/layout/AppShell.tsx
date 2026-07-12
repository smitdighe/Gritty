import { useState, type ReactNode } from 'react';
import { Sidebar } from './Sidebar';
import { TopBar, type RepoCleanliness } from './TopBar';
import type { BranchRef } from '@/types/domain';

export interface AppShellProps {
  children?: ReactNode;
  /** Chrome props — all optional, driven by mock/undefined data in this phase. */
  repoName?: string;
  repoPath?: string;
  currentBranch?: BranchRef | null;
  status?: RepoCleanliness;
}

/**
 * Structural shell: TopBar, a Sidebar, and a scrollable main region. Responsive
 * at the `md` (768px) breakpoint — the sidebar is a static column at md+ and an
 * off-canvas drawer (with backdrop) below it, toggled from the TopBar.
 */
export function AppShell({
  children,
  repoName,
  repoPath,
  currentBranch,
  status,
}: AppShellProps) {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const closeDrawer = () => setDrawerOpen(false);

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-bg text-fg">
      <TopBar repoName={repoName} status={status} onMenuClick={() => setDrawerOpen(true)} />

      <div className="relative flex min-h-0 flex-1">
        {/* Static sidebar at md and up. */}
        <Sidebar
          className="hidden md:flex"
          repoPath={repoPath}
          currentBranch={currentBranch}
        />

        {/* Mobile drawer below md. */}
        {drawerOpen && (
          <div className="md:hidden">
            <div
              className="fixed inset-0 z-40 bg-black/60"
              onClick={closeDrawer}
              aria-hidden="true"
            />
            <Sidebar
              className="fixed inset-y-0 left-0 z-50 shadow-xl"
              repoPath={repoPath}
              currentBranch={currentBranch}
              onNavigate={closeDrawer}
            />
          </div>
        )}

        <main className="min-w-0 flex-1 overflow-auto p-4">{children}</main>
      </div>
    </div>
  );
}
