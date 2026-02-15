import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { Input } from '@/renderer/components/ui/input';

describe('Input Component', () => {
  it('renders input with default props', () => {
    render(<Input placeholder='Enter text' />);
    const input = screen.getByPlaceholderText('Enter text');
    expect(input).toBeInTheDocument();
    expect(input).toHaveClass('flex', 'h-10', 'w-full', 'rounded-md');
  });

  it('handles value changes', () => {
    const handleChange = jest.fn();
    render(<Input onChange={handleChange} />);

    const input = screen.getByRole('textbox');
    fireEvent.change(input, { target: { value: 'test value' } });
    expect(handleChange).toHaveBeenCalled();
  });

  it('supports different input types', () => {
    const { rerender } = render(<Input type='text' data-testid='input' />);
    expect(screen.getByTestId('input')).toHaveAttribute('type', 'text');

    rerender(<Input type='password' data-testid='input' />);
    expect(screen.getByTestId('input')).toHaveAttribute('type', 'password');

    rerender(<Input type='email' data-testid='input' />);
    expect(screen.getByTestId('input')).toHaveAttribute('type', 'email');
  });

  it('disables when disabled prop is true', () => {
    render(<Input disabled data-testid='input' />);
    const input = screen.getByTestId('input');
    expect(input).toBeDisabled();
    expect(input).toHaveClass('disabled:cursor-not-allowed');
  });

  it('forwards ref correctly', () => {
    const ref = React.createRef<HTMLInputElement>();
    render(<Input ref={ref} data-testid='input' />);
    expect(ref.current).toBeInstanceOf(HTMLInputElement);
  });
});
