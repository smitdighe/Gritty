import { forwardRef, type HTMLAttributes, type ReactNode } from 'react';
import { cn } from '@/lib/cn';

export interface PanelProps extends Omit<HTMLAttributes<HTMLDivElement>, 'title'> {
  /** Optional header rendered in a bordered title bar. */
  title?: ReactNode;
  /** Right-aligned slot in the title bar (actions, counts). */
  actions?: ReactNode;
  /** Remove inner padding on the body (e.g. for edge-to-edge lists/graphs). */
  flush?: boolean;
}

export const Panel = forwardRef<HTMLDivElement, PanelProps>(function Panel(
  { title, actions, flush = false, className, children, ...props },
  ref,
) {
  return (
    <div
      ref={ref}
      className={cn(
        'flex min-h-0 flex-col overflow-hidden rounded-md border border-border bg-bg-soft',
        className,
      )}
      {...props}
    >
      {(title || actions) && (
        <div className="flex items-center justify-between gap-2 border-b border-border px-3 py-2">
          <div className="truncate font-sans text-xs font-semibold uppercase tracking-wide text-fg-muted">
            {title}
          </div>
          {actions && <div className="flex items-center gap-1">{actions}</div>}
        </div>
      )}
      <div className={cn('min-h-0 flex-1', flush ? '' : 'p-3', 'overflow-auto')}>
        {children}
      </div>
    </div>
  );
});
