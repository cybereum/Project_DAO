import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { RouteErrorBoundary } from './ErrorBoundary';

// Helper component that throws on render
function ThrowingChild({ error }) {
  throw error;
}

describe('RouteErrorBoundary', () => {
  // Suppress React error boundary console noise during tests
  let originalConsoleError;
  beforeEach(() => {
    originalConsoleError = console.error;
    console.error = vi.fn();
  });
  afterEach(() => {
    console.error = originalConsoleError;
  });

  it('renders children when no error occurs', () => {
    render(
      <RouteErrorBoundary>
        <p>Hello world</p>
      </RouteErrorBoundary>
    );
    expect(screen.getByText('Hello world')).toBeInTheDocument();
  });

  it('catches errors and shows recovery UI with "Try Again" button', () => {
    render(
      <RouteErrorBoundary>
        <ThrowingChild error={new Error('Test explosion')} />
      </RouteErrorBoundary>
    );

    expect(screen.getByText('This page encountered an error')).toBeInTheDocument();
    expect(screen.getByText('Test explosion')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /try again/i })).toBeInTheDocument();
  });

  it('resets error state when "Try Again" is clicked', () => {
    let shouldThrow = true;

    function MaybeThrow() {
      if (shouldThrow) {
        throw new Error('Temporary failure');
      }
      return <p>Recovered</p>;
    }

    render(
      <RouteErrorBoundary>
        <MaybeThrow />
      </RouteErrorBoundary>
    );

    expect(screen.getByText('This page encountered an error')).toBeInTheDocument();

    // Fix the underlying issue and click retry
    shouldThrow = false;
    fireEvent.click(screen.getByRole('button', { name: /try again/i }));

    expect(screen.getByText('Recovered')).toBeInTheDocument();
  });

  it('hides stack traces when import.meta.env.DEV is false', () => {
    const savedDev = import.meta.env.DEV;
    import.meta.env.DEV = false;

    const error = new Error('Production error');
    error.stack = 'Error: Production error\n    at SomeFile.jsx:42';

    render(
      <RouteErrorBoundary>
        <ThrowingChild error={error} />
      </RouteErrorBoundary>
    );

    expect(screen.getByText('This page encountered an error')).toBeInTheDocument();
    expect(screen.queryByText(/SomeFile\.jsx/)).not.toBeInTheDocument();

    import.meta.env.DEV = savedDev;
  });

  it('shows stack traces when import.meta.env.DEV is true', () => {
    const savedDev = import.meta.env.DEV;
    import.meta.env.DEV = true;

    const error = new Error('Dev error');
    error.stack = 'Error: Dev error\n    at DevFile.jsx:99';

    render(
      <RouteErrorBoundary>
        <ThrowingChild error={error} />
      </RouteErrorBoundary>
    );

    expect(screen.getByText('This page encountered an error')).toBeInTheDocument();
    expect(screen.getByText(/DevFile\.jsx:99/)).toBeInTheDocument();

    import.meta.env.DEV = savedDev;
  });
});
