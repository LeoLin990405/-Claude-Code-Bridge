import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { Button } from '@/renderer/components/ui/button';

describe('Button Component', () => {
  it('renders correctly with default props', () => {
    render(<Button>Click me</Button>);
    const button = screen.getByRole('button', { name: 'Click me' });
    expect(button).toBeInTheDocument();
    expect(button).toHaveClass('bg-primary');
  });

  it('handles click events', () => {
    const handleClick = jest.fn();
    render(<Button onClick={handleClick}>Click me</Button>);

    fireEvent.click(screen.getByRole('button'));
    expect(handleClick).toHaveBeenCalledTimes(1);
  });

  it('applies variant styles correctly', () => {
    const { rerender } = render(<Button variant='destructive'>Delete</Button>);
    const button = screen.getByRole('button');
    expect(button).toHaveClass('bg-destructive');

    rerender(<Button variant='outline'>Cancel</Button>);
    expect(button).toHaveClass('border');

    rerender(<Button variant='ghost'>Ghost</Button>);
    expect(button).toHaveClass('hover:bg-accent');

    rerender(<Button variant='link'>Link</Button>);
    expect(button).toHaveClass('underline-offset-4');
  });

  it('applies size styles correctly', () => {
    const { rerender } = render(<Button size='sm'>Small</Button>);
    const button = screen.getByRole('button');
    expect(button).toHaveClass('h-9');

    rerender(<Button size='lg'>Large</Button>);
    expect(button).toHaveClass('h-11');

    rerender(<Button size='icon'>Icon</Button>);
    expect(button).toHaveClass('h-10 w-10');
  });

  it('disables when disabled prop is true', () => {
    render(<Button disabled>Disabled</Button>);
    const button = screen.getByRole('button');
    expect(button).toBeDisabled();
    expect(button).toHaveClass('disabled:opacity-50');
  });

  it('renders as child component when asChild is true', () => {
    render(
      <Button asChild>
        <a href='/test'>Link Button</a>
      </Button>
    );
    const link = screen.getByRole('link', { name: 'Link Button' });
    expect(link).toBeInTheDocument();
    expect(link).toHaveClass('bg-primary');
  });
});
