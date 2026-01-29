/**
 * ErrorBoundary Component Tests
 */

import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import {
  ErrorBoundary,
  PageErrorBoundary,
  ComponentErrorBoundary,
  withErrorBoundary,
} from '../shared/ErrorBoundary';

// ===========================================
// Test Utilities
// ===========================================

// Component that throws an error
const ThrowError = ({ error }: { error?: Error }) => {
  if (error) throw error;
  return <div>No error</div>;
};

// Suppress console.error during tests
const originalError = console.error;
beforeAll(() => {
  console.error = jest.fn();
});
afterAll(() => {
  console.error = originalError;
});

// ===========================================
// Tests
// ===========================================

describe('ErrorBoundary', () => {
  it('renders children when there is no error', () => {
    render(
      <ErrorBoundary>
        <div>Test content</div>
      </ErrorBoundary>
    );

    expect(screen.getByText('Test content')).toBeInTheDocument();
  });

  it('renders error UI when child throws an error', () => {
    const testError = new Error('Test error message');

    render(
      <ErrorBoundary>
        <ThrowError error={testError} />
      </ErrorBoundary>
    );

    expect(screen.getByText('Something went wrong')).toBeInTheDocument();
    expect(screen.getByText('Test error message')).toBeInTheDocument();
  });

  it('renders custom fallback when provided', () => {
    const testError = new Error('Test error');
    const customFallback = <div>Custom error UI</div>;

    render(
      <ErrorBoundary fallback={customFallback}>
        <ThrowError error={testError} />
      </ErrorBoundary>
    );

    expect(screen.getByText('Custom error UI')).toBeInTheDocument();
  });

  it('calls onError callback when error occurs', () => {
    const onError = jest.fn();
    const testError = new Error('Test error');

    render(
      <ErrorBoundary onError={onError}>
        <ThrowError error={testError} />
      </ErrorBoundary>
    );

    expect(onError).toHaveBeenCalledWith(
      testError,
      expect.objectContaining({ componentStack: expect.any(String) })
    );
  });

  it('resets error state when Try Again is clicked', () => {
    const testError = new Error('Test error');
    let shouldThrow = true;

    const ConditionalThrow = () => {
      if (shouldThrow) throw testError;
      return <div>Success</div>;
    };

    const { rerender } = render(
      <ErrorBoundary>
        <ConditionalThrow />
      </ErrorBoundary>
    );

    expect(screen.getByText('Something went wrong')).toBeInTheDocument();

    // Stop throwing and click Try Again
    shouldThrow = false;
    fireEvent.click(screen.getByText('Try Again'));

    // Need to rerender for the component to try again
    rerender(
      <ErrorBoundary>
        <ConditionalThrow />
      </ErrorBoundary>
    );
  });

  it('shows technical details when showDetails is true', () => {
    const testError = new Error('Test error');

    render(
      <ErrorBoundary showDetails>
        <ThrowError error={testError} />
      </ErrorBoundary>
    );

    const detailsButton = screen.getByText(/Technical Details/);
    expect(detailsButton).toBeInTheDocument();

    fireEvent.click(detailsButton);

    expect(screen.getByText(/Component Stack/)).toBeInTheDocument();
  });
});

describe('PageErrorBoundary', () => {
  it('renders children when there is no error', () => {
    render(
      <PageErrorBoundary>
        <div>Page content</div>
      </PageErrorBoundary>
    );

    expect(screen.getByText('Page content')).toBeInTheDocument();
  });

  it('renders error UI when child throws', () => {
    const testError = new Error('Page error');

    render(
      <PageErrorBoundary>
        <ThrowError error={testError} />
      </PageErrorBoundary>
    );

    expect(screen.getByText('Something went wrong')).toBeInTheDocument();
  });
});

describe('ComponentErrorBoundary', () => {
  it('renders children when there is no error', () => {
    render(
      <ComponentErrorBoundary>
        <div>Component content</div>
      </ComponentErrorBoundary>
    );

    expect(screen.getByText('Component content')).toBeInTheDocument();
  });

  it('renders minimal error UI when child throws', () => {
    const testError = new Error('Component error');

    render(
      <ComponentErrorBoundary name="TestComponent">
        <ThrowError error={testError} />
      </ComponentErrorBoundary>
    );

    expect(screen.getByText('Error loading TestComponent')).toBeInTheDocument();
  });

  it('renders custom fallback when provided', () => {
    const testError = new Error('Component error');

    render(
      <ComponentErrorBoundary fallback={<div>Custom fallback</div>}>
        <ThrowError error={testError} />
      </ComponentErrorBoundary>
    );

    expect(screen.getByText('Custom fallback')).toBeInTheDocument();
  });
});

describe('withErrorBoundary HOC', () => {
  it('wraps component with error boundary', () => {
    const TestComponent = () => <div>Wrapped component</div>;
    const WrappedComponent = withErrorBoundary(TestComponent);

    render(<WrappedComponent />);

    expect(screen.getByText('Wrapped component')).toBeInTheDocument();
  });

  it('catches errors from wrapped component', () => {
    const ErrorComponent = () => {
      throw new Error('HOC error');
    };
    const WrappedComponent = withErrorBoundary(ErrorComponent);

    render(<WrappedComponent />);

    expect(screen.getByText('Something went wrong')).toBeInTheDocument();
  });

  it('sets correct displayName', () => {
    const TestComponent = () => <div>Test</div>;
    TestComponent.displayName = 'TestComponent';
    const WrappedComponent = withErrorBoundary(TestComponent);

    expect(WrappedComponent.displayName).toBe('withErrorBoundary(TestComponent)');
  });
});
