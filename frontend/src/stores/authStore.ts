import { create } from 'zustand';
import { api } from '@/lib/api';

// Bheem Passport URL for token refresh
const PASSPORT_URL = process.env.NEXT_PUBLIC_PASSPORT_URL || 'https://platform.bheem.co.uk';

interface User {
  id: string;
  user_id?: string;
  username: string;
  email?: string;
  role: string;
  company_id?: string;
  company_code?: string;
  companies?: string[];
  person_id?: string;
  // Workspace tenant info (for external customers)
  workspace_tenant_id?: string;
  workspace_role?: string;
}

interface AuthState {
  user: User | null;
  token: string | null;
  refreshToken: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  tokenExpiresAt: number | null;

  // Actions
  initialize: () => Promise<void>;
  setAuth: (token: string, user: User) => Promise<void>;
  loginWithOAuth: (accessToken: string, refreshToken?: string) => Promise<void>;
  logout: () => Promise<void>;
  fetchCurrentUser: () => Promise<User | null>;
  refreshAccessToken: () => Promise<boolean>;
  scheduleTokenRefresh: () => void;
}

// Decode JWT token payload
const decodeToken = (token: string): any => {
  try {
    const base64Url = token.split('.')[1];
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    const jsonPayload = decodeURIComponent(
      atob(base64)
        .split('')
        .map((c) => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
        .join('')
    );
    return JSON.parse(jsonPayload);
  } catch {
    return null;
  }
};

// Token refresh timer
let refreshTimer: NodeJS.Timeout | null = null;

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  token: null,
  refreshToken: null,
  isAuthenticated: false,
  isLoading: true,
  tokenExpiresAt: null,

  // Refresh access token using refresh token
  refreshAccessToken: async () => {
    if (typeof window === 'undefined') return false;

    const refreshToken = localStorage.getItem('refresh_token');
    if (!refreshToken) {
      console.log('[Auth] No refresh token available');
      return false;
    }

    try {
      console.log('[Auth] Refreshing access token...');
      // Bheem Passport expects refresh_token as query parameter
      const response = await fetch(`${PASSPORT_URL}/api/v1/auth/refresh?refresh_token=${encodeURIComponent(refreshToken)}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('[Auth] Token refresh failed:', response.status, errorText);
        return false;
      }

      const data = await response.json();
      const { access_token, refresh_token: newRefreshToken, expires_in } = data;

      if (!access_token) {
        console.error('[Auth] No access token in refresh response');
        return false;
      }

      // Store new tokens
      localStorage.setItem('auth_token', access_token);
      if (newRefreshToken) {
        localStorage.setItem('refresh_token', newRefreshToken);
      }

      // Update state
      const payload = decodeToken(access_token);
      const tokenExpiresAt = payload?.exp ? payload.exp * 1000 : Date.now() + (expires_in || 1800) * 1000;

      set({
        token: access_token,
        refreshToken: newRefreshToken || refreshToken,
        tokenExpiresAt,
      });

      // Schedule next refresh
      get().scheduleTokenRefresh();

      console.log('[Auth] Token refreshed successfully, expires at:', new Date(tokenExpiresAt));
      return true;
    } catch (error) {
      console.error('[Auth] Token refresh error:', error);
      return false;
    }
  },

  // Schedule automatic token refresh before expiration
  scheduleTokenRefresh: () => {
    if (typeof window === 'undefined') return;

    // Clear existing timer
    if (refreshTimer) {
      clearTimeout(refreshTimer);
      refreshTimer = null;
    }

    const { tokenExpiresAt, refreshAccessToken } = get();
    if (!tokenExpiresAt) return;

    // Refresh 5 minutes before expiration (or immediately if less than 5 min left)
    const timeUntilExpiry = tokenExpiresAt - Date.now();
    const refreshIn = Math.max(0, timeUntilExpiry - 5 * 60 * 1000); // 5 minutes before

    if (refreshIn <= 0) {
      // Token is about to expire or already expired, refresh now
      console.log('[Auth] Token expiring soon, refreshing now...');
      refreshAccessToken();
    } else {
      console.log(`[Auth] Scheduling token refresh in ${Math.round(refreshIn / 1000 / 60)} minutes`);
      refreshTimer = setTimeout(() => {
        refreshAccessToken();
      }, refreshIn);
    }
  },

  initialize: async () => {
    if (typeof window === 'undefined') {
      set({ isLoading: false });
      return;
    }

    const token = localStorage.getItem('auth_token');
    const refreshToken = localStorage.getItem('refresh_token');

    if (token) {
      const payload = decodeToken(token);
      const tokenExpiresAt = payload?.exp ? payload.exp * 1000 : 0;
      const isTokenValid = payload && tokenExpiresAt > Date.now();

      if (isTokenValid) {
        // Token is still valid
        const user: User = {
          id: payload.user_id || payload.sub,
          user_id: payload.user_id,
          username: payload.username,
          email: payload.email,
          role: payload.role,
          company_id: payload.company_id,
          company_code: payload.company_code,
          companies: payload.companies,
          person_id: payload.person_id,
        };
        set({ user, token, refreshToken, isAuthenticated: true, isLoading: false, tokenExpiresAt });

        // Schedule token refresh
        get().scheduleTokenRefresh();

        // Fetch workspace info for external customers
        try {
          const workspaceRes = await api.get('/user-workspace/me');
          const workspace = workspaceRes.data;
          if (workspace?.id) {
            set((state) => ({
              user: state.user ? {
                ...state.user,
                workspace_tenant_id: workspace.id,
                workspace_role: workspace.role
              } : null
            }));
          }
        } catch (error) {
          // User might not have a workspace yet, which is fine
          console.log('[Auth] No workspace found for user');
        }
      } else if (refreshToken) {
        // Token expired but we have refresh token - try to refresh
        console.log('[Auth] Access token expired, attempting refresh...');
        const refreshed = await get().refreshAccessToken();

        if (refreshed) {
          // Re-initialize with new token
          const newToken = localStorage.getItem('auth_token');
          if (newToken) {
            const newPayload = decodeToken(newToken);
            if (newPayload) {
              const user: User = {
                id: newPayload.user_id || newPayload.sub,
                user_id: newPayload.user_id,
                username: newPayload.username,
                email: newPayload.email,
                role: newPayload.role,
                company_id: newPayload.company_id,
                company_code: newPayload.company_code,
                companies: newPayload.companies,
                person_id: newPayload.person_id,
              };
              set({ user, token: newToken, isAuthenticated: true, isLoading: false });

              // Fetch workspace info
              try {
                const workspaceRes = await api.get('/user-workspace/me');
                const workspace = workspaceRes.data;
                if (workspace?.id) {
                  set((state) => ({
                    user: state.user ? {
                      ...state.user,
                      workspace_tenant_id: workspace.id,
                      workspace_role: workspace.role
                    } : null
                  }));
                }
              } catch (error) {
                console.log('[Auth] No workspace found for user');
              }
              return;
            }
          }
        }

        // Refresh failed, clear tokens and logout
        console.log('[Auth] Token refresh failed, logging out');
        localStorage.removeItem('auth_token');
        localStorage.removeItem('refresh_token');
        set({ isLoading: false });
      } else {
        // Token expired and no refresh token
        localStorage.removeItem('auth_token');
        set({ isLoading: false });
      }
    } else {
      set({ isLoading: false });
    }
  },

  setAuth: async (token, user) => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('auth_token', token);
    }
    set({ token, user, isAuthenticated: true, isLoading: false });

    // Fetch workspace info for external customers
    try {
      const workspaceRes = await api.get('/user-workspace/me');
      const workspace = workspaceRes.data;
      if (workspace?.id) {
        set((state) => ({
          user: state.user ? {
            ...state.user,
            workspace_tenant_id: workspace.id,
            workspace_role: workspace.role
          } : null
        }));
        console.log('[Auth] Workspace tenant ID set:', workspace.id);
      }
    } catch (error) {
      console.warn('[Auth] Could not fetch workspace info:', error);
    }

    // Create SSO session for seamless cross-service authentication (mail, docs, meet)
    try {
      await api.post('/sso/session/create', {}, {
        withCredentials: true  // Important: include cookies in request
      });
      console.log('[Auth] SSO session created for cross-service authentication');
    } catch (error) {
      console.warn('[Auth] Could not create SSO session:', error);
      // Non-critical - user can still use the app, just might need to re-auth for external services
    }
  },

  loginWithOAuth: async (accessToken, refreshToken) => {
    if (typeof window === 'undefined') {
      return;
    }

    // Store tokens
    localStorage.setItem('auth_token', accessToken);
    if (refreshToken) {
      localStorage.setItem('refresh_token', refreshToken);
    }

    // Decode JWT to extract user info
    const payload = decodeToken(accessToken);
    if (!payload) {
      throw new Error('Invalid access token');
    }

    const tokenExpiresAt = payload.exp ? payload.exp * 1000 : Date.now() + 30 * 24 * 60 * 60 * 1000; // Default 30 days

    const user: User = {
      id: payload.user_id || payload.sub,
      user_id: payload.user_id,
      username: payload.username || payload.email,
      email: payload.email,
      role: payload.role || 'Customer',
      company_id: payload.company_id,
      company_code: payload.company_code,
      companies: payload.companies,
      person_id: payload.person_id,
    };

    set({
      token: accessToken,
      refreshToken: refreshToken || null,
      user,
      isAuthenticated: true,
      isLoading: false,
      tokenExpiresAt,
    });

    // Schedule token refresh
    get().scheduleTokenRefresh();

    // Fetch workspace info for external customers
    try {
      const workspaceRes = await api.get('/user-workspace/me');
      const workspace = workspaceRes.data;
      if (workspace?.id) {
        set((state) => ({
          user: state.user ? {
            ...state.user,
            workspace_tenant_id: workspace.id,
            workspace_role: workspace.role
          } : null
        }));
        console.log('[Auth] Workspace tenant ID set:', workspace.id);
      }
    } catch (error) {
      console.warn('[Auth] Could not fetch workspace info:', error);
    }

    // Create SSO session for seamless cross-service authentication
    try {
      await api.post('/sso/session/create', {}, {
        withCredentials: true
      });
      console.log('[Auth] SSO session created for cross-service authentication');
    } catch (error) {
      console.warn('[Auth] Could not create SSO session:', error);
    }
  },

  logout: async () => {
    // Clear refresh timer
    if (refreshTimer) {
      clearTimeout(refreshTimer);
      refreshTimer = null;
    }

    // Clear SSO session cookie first
    try {
      await api.post('/sso/logout', {}, {
        withCredentials: true
      });
      console.log('[Auth] SSO session cleared');
    } catch (error) {
      console.warn('[Auth] Could not clear SSO session:', error);
    }

    if (typeof window !== 'undefined') {
      localStorage.removeItem('auth_token');
      localStorage.removeItem('refresh_token');
    }
    set({ token: null, refreshToken: null, user: null, isAuthenticated: false, tokenExpiresAt: null });
  },

  fetchCurrentUser: async () => {
    try {
      const response = await api.get('/auth/me');
      const user = response.data;
      set({ user, isAuthenticated: true });
      return user;
    } catch {
      return null;
    }
  },
}));

// Helper hook to get tenant ID from current user
export const useCurrentTenantId = (): string => {
  const user = useAuthStore((state) => state.user);
  // First try workspace_tenant_id (for external customers who created their own workspace)
  // Then fall back to company_code (for internal/ERP users)
  // Never return 'default' - this causes multi-tenancy issues
  if (user?.workspace_tenant_id) {
    return user.workspace_tenant_id;
  }
  if (user?.company_code) {
    return user.company_code.toLowerCase();
  }
  // Return empty string instead of 'default' to prevent accessing wrong tenant
  return '';
};

// Helper hook to check if user is super admin
export const useIsSuperAdmin = (): boolean => {
  const user = useAuthStore((state) => state.user);
  return user?.role === 'SuperAdmin';
};

// Hook to require authentication - redirects to login if not authenticated
export const useRequireAuth = (redirectTo = '/login') => {
  const { isAuthenticated, isLoading } = useAuthStore();

  if (typeof window !== 'undefined' && !isLoading && !isAuthenticated) {
    window.location.href = redirectTo;
  }

  return { isAuthenticated, isLoading };
};
