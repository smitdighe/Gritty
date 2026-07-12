import { render } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { Skeleton } from './Skeleton';

describe('Skeleton', () => {
  it('renders an aria-hidden placeholder', () => {
    const { container } = render(<Skeleton className="h-4 w-24" data-testid="sk" />);
    const el = container.querySelector('[data-testid="sk"]');
    expect(el).toBeTruthy();
    expect(el).toHaveAttribute('aria-hidden', 'true');
  });

  it('gates its pulse behind motion-safe', () => {
    const { container } = render(<Skeleton data-testid="sk" />);
    const el = container.querySelector('[data-testid="sk"]')!;
    expect(el.className).toContain('motion-safe:animate-pulse-soft');
  });
});
