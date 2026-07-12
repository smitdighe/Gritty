import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect } from 'vitest';
import { Tabs } from './Tabs';

const items = [
  { id: 'a', label: 'A', content: <div>panel a</div> },
  { id: 'b', label: 'B', content: <div>panel b</div> },
];

describe('Tabs', () => {
  it('shows the first tab by default', () => {
    render(<Tabs items={items} />);
    expect(screen.getByText('panel a')).toBeInTheDocument();
    expect(screen.queryByText('panel b')).not.toBeInTheDocument();
  });

  it('switches panels on click', async () => {
    render(<Tabs items={items} />);
    await userEvent.click(screen.getByRole('tab', { name: 'B' }));
    expect(screen.getByText('panel b')).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'B' })).toHaveAttribute('aria-selected', 'true');
  });
});
