import { type HTMLAttributes, type ReactNode } from 'react';
import { cn } from '@/lib/cn';

export type BadgeVariant = 'default' | 'branch' | 'head' | 'add' | 'remove' | 'muted';

export interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  variant?: BadgeVariant;
  children: ReactNode;
}

const VARIANTS: Record<BadgeVariant, string> = {
  default: 'border-border bg-bg-soft text-fg',
  branch: 'border-branch/40 bg-branch/10 text-branch',
  head: 'border-accent/50 bg-accent-muted text-accent',
  add: 'border-diff-add/40 bg-diff-add-bg text-diff-add',
  remove: 'border-diff-remove/40 bg-diff-remove-bg text-diff-remove',
  muted: 'border-border-muted bg-transparent text-fg-muted',
};

export function Badge({ variant = 'default', className, children, ...props }: BadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium leading-none',
        VARIANTS[variant],
        className,
      )}
      {...props}
    >
      {children}
    </span>
  );
}
