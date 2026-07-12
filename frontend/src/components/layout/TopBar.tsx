import { Badge } from '@/components/ui/Badge';
import { cn } from '@/lib/cn';

export type RepoCleanliness = 'clean' | 'dirty' | 'unknown';

export interface TopBarProps {
  repoName?: string;
  /** Working-tree state, driven by a prop (real status wired in phase 4/6). */
  status?: RepoCleanliness;
  /** Toggle the mobile sidebar drawer (shown below the md breakpoint). */
  onMenuClick?: () => void;
}

function StatusBadge({ status }: { status: RepoCleanliness }) {
  if (status === 'clean') return <Badge variant="add">clean</Badge>;
  if (status === 'dirty') return <Badge variant="remove">dirty</Badge>;
  return <Badge variant="muted">—</Badge>;
}

export function TopBar({ repoName, status = 'unknown', onMenuClick }: TopBarProps) {
  return (
    <header className="flex h-12 shrink-0 items-center justify-between border-b border-border bg-bg-soft px-3">
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={onMenuClick}
          aria-label="Toggle navigation"
          className={cn(
            'md:hidden -ml-1 rounded p-1.5 text-fg-muted transition-colors hover:bg-bg-hover hover:text-fg',
            'outline-none focus-visible:ring-2 focus-visible:ring-accent',
          )}
        >
          {/* hamburger */}
          <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true" fill="currentColor">
            <rect x="1" y="3" width="14" height="1.6" rx="0.8" />
            <rect x="1" y="7.2" width="14" height="1.6" rx="0.8" />
            <rect x="1" y="11.4" width="14" height="1.6" rx="0.8" />
          </svg>
        </button>
        <span className="font-sans text-sm font-semibold tracking-tight text-fg">Gritty</span>
        <span className="text-fg-faint">/</span>
        <span className="truncate text-sm text-fg-muted">{repoName ?? 'Repo name'}</span>
      </div>
      <div className="flex items-center gap-2">
        <StatusBadge status={status} />
      </div>
    </header>
  );
}
