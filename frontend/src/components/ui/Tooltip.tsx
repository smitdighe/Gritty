import { useId, useState, type ReactNode } from 'react';
import { cn } from '@/lib/cn';

export type TooltipSide = 'top' | 'bottom' | 'left' | 'right';

export interface TooltipProps {
  content: ReactNode;
  side?: TooltipSide;
  children: ReactNode;
  className?: string;
}

const SIDE: Record<TooltipSide, string> = {
  top: 'bottom-full left-1/2 -translate-x-1/2 mb-1.5',
  bottom: 'top-full left-1/2 -translate-x-1/2 mt-1.5',
  left: 'right-full top-1/2 -translate-y-1/2 mr-1.5',
  right: 'left-full top-1/2 -translate-y-1/2 ml-1.5',
};

/**
 * CSS-only hover/focus tooltip (no portal, no motion). Wraps its trigger in an
 * inline-flex span; reveals on hover and keyboard focus.
 */
export function Tooltip({ content, side = 'top', children, className }: TooltipProps) {
  const id = useId();
  const [open, setOpen] = useState(false);

  return (
    <span
      className="relative inline-flex"
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
      onFocus={() => setOpen(true)}
      onBlur={() => setOpen(false)}
    >
      <span aria-describedby={open ? id : undefined}>{children}</span>
      <span
        role="tooltip"
        id={id}
        hidden={!open}
        className={cn(
          'pointer-events-none absolute z-50 whitespace-nowrap rounded border border-border',
          'bg-bg-inset px-2 py-1 text-xs text-fg shadow-lg',
          SIDE[side],
          className,
        )}
      >
        {content}
      </span>
    </span>
  );
}
