/**
 * Sentry Client Configuration
 *
 * This file configures Sentry for the client-side (browser).
 */

import * as Sentry from '@sentry/nextjs';

const SENTRY_DSN = process.env.NEXT_PUBLIC_SENTRY_DSN;

Sentry.init({
  dsn: SENTRY_DSN,

  // Environment
  environment: process.env.NODE_ENV,

  // Disable in development unless explicitly enabled
  enabled: process.env.NODE_ENV === 'production' || process.env.NEXT_PUBLIC_SENTRY_ENABLED === 'true',

  // Performance Monitoring
  tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 1.0,

  // Session Replay
  replaysSessionSampleRate: 0.1,
  replaysOnErrorSampleRate: 1.0,

  // Integrations
  integrations: [
    Sentry.replayIntegration({
      maskAllText: true,
      blockAllMedia: true,
    }),
    Sentry.browserTracingIntegration({
      tracePropagationTargets: ['localhost', /^https:\/\/[^/]*\.bheem\.com/],
    }),
  ],

  // Release tracking
  release: process.env.NEXT_PUBLIC_SENTRY_RELEASE || 'development',

  // Ignore common errors
  ignoreErrors: [
    // Network errors
    'Network Error',
    'Failed to fetch',
    'NetworkError',
    'Load failed',
    'ChunkLoadError',

    // Browser extensions
    'ResizeObserver loop limit exceeded',
    'ResizeObserver loop completed with undelivered notifications',

    // User-initiated
    'AbortError',
    'User cancelled',

    // Common React errors that are often false positives
    'Minified React error',
  ],

  // Before sending callback for filtering/modifying events
  beforeSend(event, hint) {
    // Don't send events in development by default
    if (process.env.NODE_ENV === 'development' && process.env.NEXT_PUBLIC_SENTRY_ENABLED !== 'true') {
      console.log('[Sentry] Event captured in development:', event);
      return null;
    }

    // Filter out specific errors
    const error = hint.originalException as Error | undefined;
    if (error?.message?.includes('cancelled')) {
      return null;
    }

    return event;
  },

  // Debug mode for development
  debug: process.env.NODE_ENV === 'development',
});
