import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { HashRevealText } from './HashRevealText';

function setReducedMotion(reduced: boolean) {
  window.matchMedia = ((query: string) =>
    ({
      matches: reduced && query.includes('prefers-reduced-motion'),
      media: query,
      onchange: null,
      addListener: () => {},
      removeListener: () => {},
      addEventListener: () => {},
      removeEventListener: () => {},
      dispatchEvent: () => false,
    })) as unknown as typeof window.matchMedia;
}

afterEach(() => vi.restoreAllMocks());

describe('HashRevealText', () => {
  it('renders the final hash immediately under reduced motion (no scramble)', () => {
    setReducedMotion(true);
    render(<HashRevealText value="1e4f9a2" />);
    expect(screen.getByText('1e4f9a2')).toBeInTheDocument();
  });

  it('resolves to the real hash once the animation completes', () => {
    setReducedMotion(false);
    vi.useFakeTimers();
    try {
      render(<HashRevealText value="abcdef0" />);
      // Advance beyond the reveal duration; the interval resolves left-to-right.
      vi.advanceTimersByTime(1000);
      expect(screen.getByTitle('abcdef0').textContent).toBe('abcdef0');
    } finally {
      vi.useRealTimers();
    }
  });
});
