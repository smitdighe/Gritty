import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { Panel } from './Panel';

describe('Panel', () => {
  it('renders children', () => {
    render(<Panel>body</Panel>);
    expect(screen.getByText('body')).toBeInTheDocument();
  });

  it('renders title and actions when provided', () => {
    render(
      <Panel title="Status" actions={<button type="button">refresh</button>}>
        content
      </Panel>,
    );
    expect(screen.getByText('Status')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'refresh' })).toBeInTheDocument();
  });
});
