import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import Skeleton, { MetricCardSkeleton, TableSkeleton } from './Skeleton';

describe('Skeleton', () => {
  it('renders a single text line by default', () => {
    const { container } = render(<Skeleton />);
    const el = container.firstChild;
    expect(el).toBeInTheDocument();
    expect(el).toHaveClass('animate-pulse');
  });

  it('renders multiple lines when lines > 1', () => {
    const { container } = render(<Skeleton lines={3} />);
    const lines = container.querySelectorAll('.animate-pulse');
    expect(lines.length).toBe(3);
  });

  it('renders a card variant', () => {
    const { container } = render(<Skeleton variant="card" />);
    const el = container.firstChild;
    expect(el).toHaveClass('h-32', 'rounded-xl');
  });

  it('renders a circle variant', () => {
    const { container } = render(<Skeleton variant="circle" />);
    const el = container.firstChild;
    expect(el).toHaveClass('rounded-full');
  });

  it('applies custom width and height', () => {
    const { container } = render(<Skeleton width="200px" height="24px" />);
    const el = container.firstChild;
    expect(el.style.width).toBe('200px');
    expect(el.style.height).toBe('24px');
  });
});

describe('MetricCardSkeleton', () => {
  it('renders the specified number of cards', () => {
    const { container } = render(<MetricCardSkeleton count={3} />);
    const cards = container.querySelectorAll('.rounded-xl');
    expect(cards.length).toBe(3);
  });

  it('defaults to 4 cards', () => {
    const { container } = render(<MetricCardSkeleton />);
    const cards = container.querySelectorAll('.rounded-xl');
    expect(cards.length).toBe(4);
  });
});

describe('TableSkeleton', () => {
  it('renders the specified number of rows', () => {
    const { container } = render(<TableSkeleton rows={3} />);
    const rows = container.querySelectorAll('.rounded-lg');
    expect(rows.length).toBe(3);
  });
});
