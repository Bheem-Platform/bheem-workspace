import { create } from 'zustand';
import { api } from '@/lib/api';

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
  isAuthenticated: boolean;
  isLoading: boolean;

  // Actions
  initialize: () => Promise<void>;
  setAuth: (token: string, user: User) => Promise<void>;
  logout: () => Promise<void>;
  fetchCurrentUser: () => Promise<User | null>;
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

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  token: null,
  isAuthenticated: false,
  isLoading: true,

  initialize: async () => {
    if (typeof window === 'undefined') {
      set({ isLoading: false });
      return;
    }

    const token = localStorage.getItem('auth_token');
    if (token) {
      const payload = decodeToken(token);
      if (payload && payload.exp * 1000 > Date.now()) {
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
        set({ user, token, isAuthenticated: true, isLoading: false });

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
      } else {
        // Token expired
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

  logout: async () => {
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
    }
    set({ token: null, user: null, isAuthenticated: false });
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
