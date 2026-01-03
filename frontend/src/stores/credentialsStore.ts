import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface MailCredentials {
  email: string;
  password: string;
  lastValidated?: string;
}

interface NextcloudCredentials {
  username: string;
  password: string;
  serverUrl?: string;
  lastValidated?: string;
}

interface CredentialsState {
  // Stored credentials (encrypted in production)
  mailCredentials: MailCredentials | null;
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

  // Actions
  setMailCredentials: (credentials: MailCredentials) => void;
  setNextcloudCredentials: (credentials: NextcloudCredentials) => void;
  clearMailCredentials: () => void;
  clearNextcloudCredentials: () => void;
  clearAllCredentials: () => void;
  setMailAuthenticated: (status: boolean) => void;
  setNextcloudAuthenticated: (status: boolean) => void;
  setLoading: (service: 'mail' | 'nextcloud', loading: boolean) => void;
  setError: (error: string | null) => void;

  // Getters
  getMailCredentials: () => MailCredentials | null;
  getNextcloudCredentials: () => NextcloudCredentials | null;
}

// Simple encoding (in production, use proper encryption)
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
      mailCredentials: null,
      nextcloudCredentials: null,
      isMailAuthenticated: false,
      isNextcloudAuthenticated: false,
      loading: {
        mail: false,
        nextcloud: false,
      },
      error: null,

      // Actions
      setMailCredentials: (credentials) => {
        set({
          mailCredentials: {
            email: credentials.email,
            password: encode(credentials.password),
            lastValidated: new Date().toISOString(),
          },
          isMailAuthenticated: true,
          error: null,
        });
      },

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

      clearMailCredentials: () => {
        set({
          mailCredentials: null,
          isMailAuthenticated: false,
        });
      },

      clearNextcloudCredentials: () => {
        set({
          nextcloudCredentials: null,
          isNextcloudAuthenticated: false,
        });
      },

      clearAllCredentials: () => {
        set({
          mailCredentials: null,
          nextcloudCredentials: null,
          isMailAuthenticated: false,
          isNextcloudAuthenticated: false,
        });
      },

      setMailAuthenticated: (status) => {
        set({ isMailAuthenticated: status });
      },

      setNextcloudAuthenticated: (status) => {
        set({ isNextcloudAuthenticated: status });
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

      // Getters - decode passwords
      getMailCredentials: () => {
        const creds = get().mailCredentials;
        if (!creds) return null;
        return {
          ...creds,
          password: decode(creds.password),
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
    }),
    {
      name: 'bheem-credentials',
      partialize: (state) => ({
        mailCredentials: state.mailCredentials,
        nextcloudCredentials: state.nextcloudCredentials,
        isMailAuthenticated: state.isMailAuthenticated,
        isNextcloudAuthenticated: state.isNextcloudAuthenticated,
      }),
    }
  )
);

// Hook to check if credentials need refresh (older than 24 hours)
export function useNeedsCredentialRefresh(service: 'mail' | 'nextcloud'): boolean {
  const credentials = useCredentialsStore((state) =>
    service === 'mail' ? state.mailCredentials : state.nextcloudCredentials
  );

  if (!credentials?.lastValidated) return true;

  const lastValidated = new Date(credentials.lastValidated);
  const now = new Date();
  const hoursDiff = (now.getTime() - lastValidated.getTime()) / (1000 * 60 * 60);

  return hoursDiff > 24;
}

// Hook to require mail authentication
export function useRequireMailAuth() {
  const { isMailAuthenticated, mailCredentials } = useCredentialsStore();
  return {
    isAuthenticated: isMailAuthenticated && mailCredentials !== null,
    credentials: mailCredentials,
  };
}

// Hook to require Nextcloud authentication
export function useRequireNextcloudAuth() {
  const { isNextcloudAuthenticated, nextcloudCredentials } = useCredentialsStore();
  return {
    isAuthenticated: isNextcloudAuthenticated && nextcloudCredentials !== null,
    credentials: nextcloudCredentials,
  };
}
