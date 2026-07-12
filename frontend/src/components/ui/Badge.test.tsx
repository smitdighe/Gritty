import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { Badge } from './Badge';

describe('Badge', () => {
  it('renders content', () => {
    render(<Badge>main</Badge>);
    expect(screen.getByText('main')).toBeInTheDocument();
  });

  it('applies branch variant classes', () => {
    render(<Badge variant="branch">feature</Badge>);
    expect(screen.getByText('feature').className).toContain('branch');
  });
});
