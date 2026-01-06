import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import * as mailApi from '@/lib/mailApi';

// ===========================================
// Types
// ===========================================

interface MailSession {
  email: string;
  sessionId: string;
  expiresAt: string; // ISO date string
  active: boolean;
}

interface NextcloudCredentials {
  username: string;
  password: string;
  serverUrl?: string;
  lastValidated?: string;
}

interface CredentialsState {
  // Mail session (secure - no password stored)
  mailSession: MailSession | null;

  // Nextcloud (still uses local storage - to be migrated)
  nextcloudCredentials: NextcloudCredentials | null;

  // Authentication status
  isMailAuthenticated: boolean;
  isNextcloudAuthenticated: boolean;

  // Loading states
  loading: {
    mail: boolean;
    nextcloud: boolean;
  };

  // Errors
  error: string | null;

  // Mail Session Actions
  createMailSession: (email: string, password: string) => Promise<boolean>;
  refreshMailSession: () => Promise<boolean>;
  destroyMailSession: () => Promise<void>;
  checkMailSession: () => Promise<boolean>;

  // Nextcloud Actions (legacy)
  setNextcloudCredentials: (credentials: NextcloudCredentials) => void;
  clearNextcloudCredentials: () => void;

  // Common Actions
  clearAllCredentials: () => void;
  setLoading: (service: 'mail' | 'nextcloud', loading: boolean) => void;
  setError: (error: string | null) => void;

  // Getters
  getMailCredentials: () => { email: string } | null;
  getNextcloudCredentials: () => NextcloudCredentials | null;
  isSessionValid: () => boolean;
}

// Simple encoding for Nextcloud (to be migrated to server-side sessions)
const encode = (str: string): string => {
  if (typeof window !== 'undefined') {
    return btoa(str);
  }
  return str;
};

const decode = (str: string): string => {
  if (typeof window !== 'undefined') {
    try {
      return atob(str);
    } catch {
      return str;
    }
  }
  return str;
};

export const useCredentialsStore = create<CredentialsState>()(
  persist(
    (set, get) => ({
      // Initial state
      mailSession: null,
      nextcloudCredentials: null,
      isMailAuthenticated: false,
      isNextcloudAuthenticated: false,
      loading: {
        mail: false,
        nextcloud: false,
      },
      error: null,

      // ===========================================
      // Mail Session Actions (Secure)
      // ===========================================

      createMailSession: async (email: string, password: string) => {
        set((state) => ({
          loading: { ...state.loading, mail: true },
          error: null,
        }));

        try {
          const response = await mailApi.createMailSession(email, password);

          if (response.success && response.session_id) {
            const expiresAt = new Date(
              Date.now() + (response.expires_in_seconds || 86400) * 1000
            ).toISOString();

            set({
              mailSession: {
                email: response.email || email,
                sessionId: response.session_id,
                expiresAt,
                active: true,
              },
              isMailAuthenticated: true,
              error: null,
            });

            return true;
          }

          set({ error: response.message || 'Failed to create mail session' });
          return false;
        } catch (error: any) {
          const message =
            error.response?.data?.detail ||
            error.message ||
            'Failed to authenticate with mail server';
          set({ error: message, isMailAuthenticated: false });
          return false;
        } finally {
          set((state) => ({ loading: { ...state.loading, mail: false } }));
        }
      },

      refreshMailSession: async () => {
        const session = get().mailSession;
        if (!session) return false;

        try {
          const response = await mailApi.refreshMailSession();

          if (response.success) {
            const expiresAt = new Date(
              Date.now() + (response.expires_in_seconds || 86400) * 1000
            ).toISOString();

            set((state) => ({
              mailSession: state.mailSession
                ? { ...state.mailSession, expiresAt, active: true }
                : null,
            }));

            return true;
          }

          return false;
        } catch (error) {
          // Session expired or invalid
          set({
            mailSession: null,
            isMailAuthenticated: false,
          });
          return false;
        }
      },

      destroyMailSession: async () => {
        try {
          await mailApi.destroyMailSession();
        } catch (error) {
          // Ignore errors - session may already be expired
        } finally {
          set({
            mailSession: null,
            isMailAuthenticated: false,
          });
        }
      },

      checkMailSession: async () => {
        const session = get().mailSession;

        // Quick local check first
        if (!session) {
          set({ isMailAuthenticated: false });
          return false;
        }

        // Check if session expired locally
        const expiresAt = new Date(session.expiresAt);
        if (expiresAt < new Date()) {
          set({
            mailSession: null,
            isMailAuthenticated: false,
          });
          return false;
        }

        // Verify with server
        try {
          const status = await mailApi.getMailSessionStatus();

          if (status.active) {
            const expiresAt = new Date(
              Date.now() + (status.expires_in_seconds || 0) * 1000
            ).toISOString();

            set((state) => ({
              mailSession: state.mailSession
                ? {
                    ...state.mailSession,
                    expiresAt,
                    active: true,
                  }
                : null,
              isMailAuthenticated: true,
            }));

            return true;
          }

          set({
            mailSession: null,
            isMailAuthenticated: false,
          });
          return false;
        } catch (error) {
          // Server check failed - keep local state for now
          return get().isMailAuthenticated;
        }
      },

      // ===========================================
      // Nextcloud Actions (Legacy - to be migrated)
      // ===========================================

      setNextcloudCredentials: (credentials) => {
        set({
          nextcloudCredentials: {
            username: credentials.username,
            password: encode(credentials.password),
            serverUrl: credentials.serverUrl,
            lastValidated: new Date().toISOString(),
          },
          isNextcloudAuthenticated: true,
          error: null,
        });
      },

      clearNextcloudCredentials: () => {
        set({
          nextcloudCredentials: null,
          isNextcloudAuthenticated: false,
        });
      },

      // ===========================================
      // Common Actions
      // ===========================================

      clearAllCredentials: () => {
        const { destroyMailSession } = get();
        destroyMailSession();
        set({
          mailSession: null,
          nextcloudCredentials: null,
          isMailAuthenticated: false,
          isNextcloudAuthenticated: false,
        });
      },

      setLoading: (service, loading) => {
        set((state) => ({
          loading: {
            ...state.loading,
            [service]: loading,
          },
        }));
      },

      setError: (error) => {
        set({ error });
      },

      // ===========================================
      // Getters
      // ===========================================

      getMailCredentials: () => {
        const session = get().mailSession;
        if (!session || !session.active) return null;

        // Check if session expired
        const expiresAt = new Date(session.expiresAt);
        if (expiresAt < new Date()) {
          return null;
        }

        return {
          email: session.email,
        };
      },

      getNextcloudCredentials: () => {
        const creds = get().nextcloudCredentials;
        if (!creds) return null;
        return {
          ...creds,
          password: decode(creds.password),
        };
      },

      isSessionValid: () => {
        const session = get().mailSession;
        if (!session || !session.active) return false;

        const expiresAt = new Date(session.expiresAt);
        return expiresAt > new Date();
      },
    }),
    {
      name: 'bheem-credentials',
      partialize: (state) => ({
        // Only persist session metadata - no passwords!
        mailSession: state.mailSession,
        nextcloudCredentials: state.nextcloudCredentials,
        isMailAuthenticated: state.isMailAuthenticated,
        isNextcloudAuthenticated: state.isNextcloudAuthenticated,
      }),
    }
  )
);

// ===========================================
// Hooks
// ===========================================

/**
 * Check if mail session needs refresh (less than 1 hour remaining)
 */
export function useNeedsSessionRefresh(): boolean {
  const mailSession = useCredentialsStore((state) => state.mailSession);

  if (!mailSession?.expiresAt) return true;

  const expiresAt = new Date(mailSession.expiresAt);
  const now = new Date();
  const hoursRemaining = (expiresAt.getTime() - now.getTime()) / (1000 * 60 * 60);

  return hoursRemaining < 1;
}

/**
 * Hook to require mail authentication
 */
export function useRequireMailAuth() {
  const { isMailAuthenticated, mailSession, isSessionValid } = useCredentialsStore();

  return {
    isAuthenticated: isMailAuthenticated && mailSession !== null && isSessionValid(),
    email: mailSession?.email,
  };
}

/**
 * Hook to require Nextcloud authentication
 */
export function useRequireNextcloudAuth() {
  const { isNextcloudAuthenticated, nextcloudCredentials } = useCredentialsStore();
  return {
    isAuthenticated: isNextcloudAuthenticated && nextcloudCredentials !== null,
    credentials: nextcloudCredentials,
  };
}

/**
 * Hook to auto-refresh session when it's about to expire
 */
export function useAutoRefreshSession() {
  const { mailSession, refreshMailSession, isMailAuthenticated } = useCredentialsStore();

  // This can be called in a useEffect to auto-refresh
  const scheduleRefresh = () => {
    if (!mailSession || !isMailAuthenticated) return;

    const expiresAt = new Date(mailSession.expiresAt);
    const now = new Date();
    const msUntilExpiry = expiresAt.getTime() - now.getTime();

    // Refresh when 10% of time is remaining
    const refreshAt = msUntilExpiry * 0.9;

    if (refreshAt > 0) {
      setTimeout(() => {
        refreshMailSession();
      }, refreshAt);
    }
  };

  return { scheduleRefresh };
}
