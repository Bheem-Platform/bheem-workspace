/**
 * Sentry Server Configuration
 *
 * This file configures Sentry for the server-side (Node.js).
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

  // Release tracking
  release: process.env.NEXT_PUBLIC_SENTRY_RELEASE || 'development',

  // Ignore common errors
  ignoreErrors: [
    'ECONNRESET',
    'ENOTFOUND',
    'ETIMEDOUT',
    'socket hang up',
  ],

  // Before sending callback
  beforeSend(event, _hint) {
    // Don't send events in development by default
    if (process.env.NODE_ENV === 'development' && process.env.NEXT_PUBLIC_SENTRY_ENABLED !== 'true') {
      console.log('[Sentry Server] Event captured in development:', event);
      return null;
    }

    return event;
  },

  // Debug mode for development
  debug: process.env.NODE_ENV === 'development',
});
