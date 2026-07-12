import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect } from 'vitest';
import { Tooltip } from './Tooltip';

describe('Tooltip', () => {
  it('renders its trigger', () => {
    render(
      <Tooltip content="full sha">
        <span>1e4f9a2</span>
      </Tooltip>,
    );
    expect(screen.getByText('1e4f9a2')).toBeInTheDocument();
  });

  it('reveals content on hover', async () => {
    render(
      <Tooltip content="full sha">
        <span>hash</span>
      </Tooltip>,
    );
    const tip = screen.getByRole('tooltip', { hidden: true });
    expect(tip).not.toBeVisible();
    await userEvent.hover(screen.getByText('hash'));
    expect(screen.getByRole('tooltip')).toBeVisible();
  });
});
