import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import type { ReactElement } from 'react';
import { ErrorBoundary } from './ErrorBoundary';
import { GrittyApiError } from '@/api/GrittyApiError';

// Temporary throwing components live in this test only (never in app code).
function ThrowApi(): ReactElement {
  throw new GrittyApiError('not a gritty repository', 'NotARepo', { status: 404 });
}
function ThrowPlain(): ReactElement {
  throw new Error('boom');
}

describe('ErrorBoundary', () => {
  beforeEach(() => vi.spyOn(console, 'error').mockImplementation(() => {}));
  afterEach(() => vi.restoreAllMocks());

  it('renders a typed fallback for a GrittyApiError (code + message + hint)', () => {
    render(
      <ErrorBoundary>
        <ThrowApi />
      </ErrorBoundary>,
    );
    expect(screen.getByText(/Gritty error · NotARepo/)).toBeInTheDocument();
    expect(screen.getByText(/No Gritty repository was found/i)).toBeInTheDocument();
    expect(screen.getByText('not a gritty repository')).toBeInTheDocument();
  });

  it('renders a generic fallback for an unexpected JS error', () => {
    render(
      <ErrorBoundary>
        <ThrowPlain />
      </ErrorBoundary>,
    );
    expect(screen.getByText('Unexpected error')).toBeInTheDocument();
    expect(screen.getByText('boom')).toBeInTheDocument();
  });
});
