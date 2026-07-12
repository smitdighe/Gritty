import { type HTMLAttributes } from 'react';
import { cn } from '@/lib/cn';

export interface SkeletonProps extends HTMLAttributes<HTMLDivElement> {
  /** Round the placeholder fully (avatars, dots). */
  circle?: boolean;
}

/**
 * Loading placeholder. Uses a shimmer only under motion-safe; reduced-motion
 * users get a static muted block (the pulse is gated behind `motion-safe:`).
 */
export function Skeleton({ circle = false, className, ...props }: SkeletonProps) {
  return (
    <div
      aria-hidden="true"
      className={cn(
        'relative overflow-hidden bg-bg-hover',
        circle ? 'rounded-full' : 'rounded',
        // Pulse only when motion is allowed.
        'motion-safe:animate-pulse-soft',
        className,
      )}
      {...props}
    >
      {/* Sheen sweep, motion-safe only. */}
      <div
        className={cn(
          'pointer-events-none absolute inset-0 -translate-x-full',
          'bg-gradient-to-r from-transparent via-white/5 to-transparent',
          'motion-safe:animate-shimmer motion-reduce:hidden',
        )}
      />
    </div>
  );
}
