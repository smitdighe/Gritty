import { motion, useReducedMotion, type Transition } from 'framer-motion';
import { cn } from '@/lib/cn';

export type PointerVariant = 'branch' | 'head' | 'detached';

export interface BranchPointerProps {
  /** Stable animation identity: branch name, or "HEAD" for the head marker. */
  layoutId: string;
  label: string;
  /** Flow-coordinate position of the pill's top-left. */
  x: number;
  y: number;
  variant: PointerVariant;
  title?: string;
}

const VARIANT: Record<PointerVariant, string> = {
  branch: 'border-branch/50 bg-branch/15 text-branch',
  head: 'border-accent/60 bg-accent-muted text-accent',
  detached: 'border-tag/60 bg-tag/15 text-tag',
};

const SPRING: Transition = { type: 'spring', stiffness: 500, damping: 34, mass: 0.6 };

/**
 * A branch/HEAD pill anchored to a node in flow coordinates. Movement between
 * nodes (checkout / commit / branch-create) is a framer LAYOUT animation keyed
 * by `layoutId` — the same element travels, it is never remounted at the new
 * spot. Under reduced motion it snaps (layout animation disabled) but still
 * updates position.
 */
export function BranchPointer({ layoutId, label, x, y, variant, title }: BranchPointerProps) {
  const reduced = useReducedMotion();
  return (
    <motion.div
      layout={!reduced}
      layoutId={layoutId}
      data-testid={`branch-pointer-${layoutId}`}
      data-x={x}
      data-y={y}
      transition={reduced ? { duration: 0 } : SPRING}
      style={{ position: 'absolute', left: x, top: y }}
      className={cn(
        'pointer-events-none z-10 flex items-center gap-1 whitespace-nowrap rounded-full border px-2 py-0.5',
        'font-sans text-[10px] font-semibold shadow-sm',
        VARIANT[variant],
      )}
      title={title ?? label}
    >
      {variant === 'detached' && <span className="opacity-70">detached</span>}
      {label}
    </motion.div>
  );
}
