import { useEffect, useState } from 'react';
import { useReducedMotion } from 'framer-motion';
import { cn } from '@/lib/cn';

const HEX = '0123456789abcdef';
const DURATION_MS = 500;
const TICK_MS = 30;
const STEPS = Math.ceil(DURATION_MS / TICK_MS);

function randomHexLike(ch: string): string {
  // Preserve non-hex characters (e.g. an ellipsis) so only hash digits scramble.
  return HEX.includes(ch) ? HEX[(Math.random() * 16) | 0] : ch;
}

export interface HashRevealTextProps {
  /** The final text to resolve to (typically a short or full sha). */
  value: string;
  className?: string;
  title?: string;
}

/**
 * Scrambles through random hex and resolves left-to-right to `value` over a
 * short (~500ms) burst — a garnish for a freshly-appearing hash. Left-to-right
 * (not all-at-once) reads as the hash "locking in" digit by digit, which suits
 * a content-addressed id. Under reduced motion it renders `value` immediately.
 */
export function HashRevealText({ value, className, title }: HashRevealTextProps) {
  const reduced = useReducedMotion();
  const [display, setDisplay] = useState(value);

  useEffect(() => {
    if (reduced) {
      setDisplay(value);
      return;
    }

    // Drive the reveal off a tick counter (not a wall clock) so it advances
    // deterministically under both real and faked timers.
    let tick = 0;
    setDisplay(value.split('').map((c) => randomHexLike(c)).join(''));

    const timer = setInterval(() => {
      tick += 1;
      const revealed = Math.min(value.length, Math.floor((tick / STEPS) * value.length));
      let out = '';
      for (let i = 0; i < value.length; i++) {
        out += i < revealed ? value[i] : randomHexLike(value[i]);
      }
      setDisplay(out);
      if (revealed >= value.length) clearInterval(timer);
    }, TICK_MS);

    return () => clearInterval(timer);
  }, [value, reduced]);

  return (
    <span className={cn('tabular-nums', className)} title={title ?? value}>
      {display}
    </span>
  );
}
