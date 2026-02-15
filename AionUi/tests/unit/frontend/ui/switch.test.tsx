import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { Switch } from '@/renderer/components/ui/switch';

describe('Switch Component', () => {
  it('renders switch with default props', () => {
    render(<Switch data-testid='switch' />);
    const switchEl = screen.getByTestId('switch');
    expect(switchEl).toBeInTheDocument();
  });

  it('toggles state on click', () => {
    const handleCheckedChange = jest.fn();
    render(<Switch onCheckedChange={handleCheckedChange} data-testid='switch' />);

    const switchEl = screen.getByTestId('switch');
    fireEvent.click(switchEl);
    expect(handleCheckedChange).toHaveBeenCalledWith(true);
  });

  it('disables when disabled prop is true', () => {
    render(<Switch disabled data-testid='switch' />);
    const switchEl = screen.getByTestId('switch');
    expect(switchEl).toHaveClass('disabled:cursor-not-allowed');
  });

  it('shows checked state styling', () => {
    render(<Switch checked data-testid='switch' />);
    const switchEl = screen.getByTestId('switch');
    expect(switchEl).toHaveClass('data-[state=checked]:bg-primary');
  });
});
