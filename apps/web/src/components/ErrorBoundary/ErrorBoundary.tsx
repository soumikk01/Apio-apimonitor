import React, { Component, ReactNode } from 'react';
import { toast } from 'sonner';

interface Props {
  children: ReactNode;
  /** Custom UI to render when an error is caught. */
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

/**
 * ErrorBoundary — global safety net for runtime React errors.
 *
 * Catches errors during rendering, lifecycle methods, and hooks of any child
 * component tree, preventing the entire page from crashing ("white screen").
 *
 * Usage:
 *   <ErrorBoundary>
 *     <PotentiallyFlakyComponent />
 *   </ErrorBoundary>
 *
 *   // Custom fallback:
 *   <ErrorBoundary fallback={<CustomErrorScreen />}>
 *     <PotentiallyFlakyComponent />
 *   </ErrorBoundary>
 */
export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    // Store the error so we can display details in development mode.
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    // Always log for visibility during debugging.
    console.error('[ErrorBoundary] Caught an error:', error, errorInfo);

    // Surface a user-friendly toast notification.
    toast.error('Something went wrong. Please try again or reload the page.');

    // TODO: send to a remote error tracker in production
    // e.g. Sentry.captureException(error, { extra: errorInfo });
  }

  /** Reset the boundary so children can attempt to re-render. */
  private handleRetry = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      // Allow the caller to supply a fully custom fallback UI.
      if (this.props.fallback) return this.props.fallback;

      const isDev = process.env.NODE_ENV === 'development';

      return (
        <div
          role="alert"
          aria-live="assertive"
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            minHeight: '200px',
            padding: '2.5rem 2rem',
            textAlign: 'center',
            gap: '1rem',
          }}
        >
          {/* Icon */}
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            width="48"
            height="48"
            style={{ color: 'var(--text-muted, #888)', opacity: 0.7 }}
            aria-hidden="true"
          >
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="8" x2="12" y2="12" />
            <line x1="12" y1="16" x2="12.01" y2="16" />
          </svg>

          <h2 style={{ fontSize: '1.25rem', fontWeight: 600, margin: 0 }}>
            Uh-oh! Something went wrong
          </h2>
          <p style={{ fontSize: '0.9rem', color: 'var(--text-muted, #888)', margin: 0, maxWidth: '420px' }}>
            An unexpected error occurred. You can try again, or reload the page if the problem persists.
          </p>

          {/* Development-only: show error details for faster debugging */}
          {isDev && this.state.error && (
            <pre
              style={{
                background: 'rgba(239,68,68,0.1)',
                border: '1px solid rgba(239,68,68,0.3)',
                borderRadius: '8px',
                padding: '0.75rem 1rem',
                fontSize: '0.78rem',
                color: '#ef4444',
                textAlign: 'left',
                maxWidth: '600px',
                overflow: 'auto',
                maxHeight: '200px',
                whiteSpace: 'pre-wrap',
                wordBreak: 'break-word',
              }}
            >
              {this.state.error.message}
              {'\n'}
              {this.state.error.stack}
            </pre>
          )}

          {/* Recovery actions */}
          <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', justifyContent: 'center' }}>
            <button
              onClick={this.handleRetry}
              style={{
                padding: '0.55rem 1.25rem',
                borderRadius: '8px',
                border: '1px solid var(--border, #333)',
                background: 'var(--surface, #1a1a1a)',
                color: 'var(--text, #fff)',
                fontSize: '0.875rem',
                fontWeight: 500,
                cursor: 'pointer',
              }}
            >
              Try again
            </button>
            <button
              onClick={() => window.location.reload()}
              style={{
                padding: '0.55rem 1.25rem',
                borderRadius: '8px',
                border: 'none',
                background: 'var(--accent, #3b82f6)',
                color: '#fff',
                fontSize: '0.875rem',
                fontWeight: 500,
                cursor: 'pointer',
              }}
            >
              Reload page
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
