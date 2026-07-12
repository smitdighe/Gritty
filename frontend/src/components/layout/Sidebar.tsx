import { NavLink } from 'react-router-dom';
import { cn } from '@/lib/cn';
import type { BranchRef } from '@/types/domain';

export interface SidebarProps {
  /** Working-tree path of the active repo (mock/undefined in this phase). */
  repoPath?: string;
  /** Current branch, or null when detached; undefined when unknown. */
  currentBranch?: BranchRef | null;
  /** Called after a nav link is clicked (used to close the mobile drawer). */
  onNavigate?: () => void;
  className?: string;
}

interface NavItem {
  to: string;
  label: string;
  /** Match only the exact path (react-router `end`). */
  end?: boolean;
}

const NAV: NavItem[] = [
  { to: '/repo', label: 'Repository', end: true },
  { to: '/repo/objects', label: 'Objects' },
];

export function Sidebar({ repoPath, currentBranch, onNavigate, className }: SidebarProps) {
  return (
    <aside
      className={cn('flex w-64 shrink-0 flex-col border-r border-border bg-bg-soft', className)}
    >
      <div className="border-b border-border px-3 py-3">
        <div className="font-sans text-xs font-semibold uppercase tracking-wide text-fg-faint">
          Repository
        </div>
        <div className="mt-1 truncate text-sm text-fg-muted" title={repoPath}>
          {repoPath ?? '—'}
        </div>
        <div className="mt-0.5 truncate text-xs text-fg-faint">
          Branch: {currentBranch === undefined ? '—' : (currentBranch?.name ?? 'detached')}
        </div>
      </div>

      <nav className="flex min-h-0 flex-1 flex-col gap-0.5 overflow-y-auto p-2">
        {NAV.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.end}
            onClick={onNavigate}
            className={({ isActive }) =>
              cn(
                'font-sans rounded px-2 py-1.5 text-sm transition-colors',
                'outline-none focus-visible:ring-2 focus-visible:ring-accent',
                isActive ? 'bg-bg-hover text-fg' : 'text-fg-muted hover:bg-bg-hover hover:text-fg',
              )
            }
          >
            {item.label}
          </NavLink>
        ))}
      </nav>
    </aside>
  );
}
