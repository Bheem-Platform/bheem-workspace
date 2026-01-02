import { create } from 'zustand';
import type {
  Tenant,
  TenantUser,
  Domain,
  Developer,
  ActivityLog,
  AdminDashboard,
} from '@/types/admin';
import * as adminApi from '@/lib/adminApi';

interface AdminState {
  // Current context
  currentTenantId: string | null;
  userRole: 'super_admin' | 'tenant_admin' | null;

  // UI State
  sidebarOpen: boolean;
  activeModal: string | null;

  // Data
  tenants: Tenant[];
  currentTenant: Tenant | null;
  tenantUsers: TenantUser[];
  domains: Domain[];
  developers: Developer[];
  activityLogs: ActivityLog[];
  dashboard: AdminDashboard | null;

  // Loading states
  loading: {
    tenants: boolean;
    tenant: boolean;
    users: boolean;
    domains: boolean;
    developers: boolean;
    activity: boolean;
    dashboard: boolean;
  };

  // Error states
  error: string | null;

  // Actions - UI
  setCurrentTenant: (tenantId: string | null) => void;
  setUserRole: (role: 'super_admin' | 'tenant_admin' | null) => void;
  toggleSidebar: () => void;
  openModal: (modalId: string) => void;
  closeModal: () => void;
  clearError: () => void;

  // Actions - Tenants
  fetchTenants: (params?: { search?: string; plan?: string; is_active?: boolean }) => Promise<void>;
  fetchTenant: (tenantId: string) => Promise<void>;
  createTenant: (data: Parameters<typeof adminApi.createTenant>[0]) => Promise<Tenant | null>;
  updateTenant: (tenantId: string, data: Parameters<typeof adminApi.updateTenant>[1]) => Promise<Tenant | null>;
  deleteTenant: (tenantId: string) => Promise<boolean>;

  // Actions - Users
  fetchTenantUsers: (tenantId: string) => Promise<void>;
  addUser: (tenantId: string, data: Parameters<typeof adminApi.addTenantUser>[1]) => Promise<TenantUser | null>;
  updateUser: (tenantId: string, userId: string, data: Parameters<typeof adminApi.updateTenantUser>[2]) => Promise<TenantUser | null>;
  removeUser: (tenantId: string, userId: string) => Promise<boolean>;

  // Actions - Domains
  fetchDomains: (tenantId: string) => Promise<void>;
  addDomain: (tenantId: string, data: Parameters<typeof adminApi.addDomain>[1]) => Promise<Domain | null>;
  verifyDomain: (tenantId: string, domainId: string) => Promise<any>;
  removeDomain: (tenantId: string, domainId: string) => Promise<boolean>;

  // Actions - Developers
  fetchDevelopers: () => Promise<void>;
  createDeveloper: (data: Parameters<typeof adminApi.createDeveloper>[0]) => Promise<Developer | null>;

  // Actions - Activity
  fetchActivityLogs: (tenantId: string, params?: { limit?: number; action?: string }) => Promise<void>;

  // Aliases for convenience
  users: TenantUser[];
  fetchUsers: (tenantId: string) => Promise<void>;

  // Actions - Dashboard
  fetchDashboard: (tenantId: string) => Promise<void>;
}

export const useAdminStore = create<AdminState>((set, get) => ({
  // Initial state
  currentTenantId: null,
  userRole: null,
  sidebarOpen: true,
  activeModal: null,
  tenants: [],
  currentTenant: null,
  tenantUsers: [],
  domains: [],
  developers: [],
  activityLogs: [],
  dashboard: null,
  loading: {
    tenants: false,
    tenant: false,
    users: false,
    domains: false,
    developers: false,
    activity: false,
    dashboard: false,
  },
  error: null,

  // UI Actions
  setCurrentTenant: (tenantId) => set({ currentTenantId: tenantId }),
  setUserRole: (role) => set({ userRole: role }),
  toggleSidebar: () => set((state) => ({ sidebarOpen: !state.sidebarOpen })),
  openModal: (modalId) => set({ activeModal: modalId }),
  closeModal: () => set({ activeModal: null }),
  clearError: () => set({ error: null }),

  // Tenant Actions
  fetchTenants: async (params) => {
    set((state) => ({ loading: { ...state.loading, tenants: true }, error: null }));
    try {
      const response = await adminApi.listTenants(params);
      set({ tenants: response.data, loading: { ...get().loading, tenants: false } });
    } catch (error: any) {
      set({
        error: error.response?.data?.detail || 'Failed to fetch tenants',
        loading: { ...get().loading, tenants: false },
      });
    }
  },

  fetchTenant: async (tenantId) => {
    set((state) => ({ loading: { ...state.loading, tenant: true }, error: null }));
    try {
      const response = await adminApi.getTenant(tenantId);
      set({ currentTenant: response.data, loading: { ...get().loading, tenant: false } });
    } catch (error: any) {
      set({
        error: error.response?.data?.detail || 'Failed to fetch tenant',
        loading: { ...get().loading, tenant: false },
      });
    }
  },

  createTenant: async (data) => {
    try {
      const response = await adminApi.createTenant(data);
      set((state) => ({ tenants: [response.data, ...state.tenants] }));
      return response.data;
    } catch (error: any) {
      set({ error: error.response?.data?.detail || 'Failed to create tenant' });
      return null;
    }
  },

  updateTenant: async (tenantId, data) => {
    try {
      const response = await adminApi.updateTenant(tenantId, data);
      set((state) => ({
        tenants: state.tenants.map((t) => (t.id === tenantId ? response.data : t)),
        currentTenant: state.currentTenant?.id === tenantId ? response.data : state.currentTenant,
      }));
      return response.data;
    } catch (error: any) {
      set({ error: error.response?.data?.detail || 'Failed to update tenant' });
      return null;
    }
  },

  deleteTenant: async (tenantId) => {
    try {
      await adminApi.deleteTenant(tenantId);
      set((state) => ({
        tenants: state.tenants.filter((t) => t.id !== tenantId),
      }));
      return true;
    } catch (error: any) {
      set({ error: error.response?.data?.detail || 'Failed to delete tenant' });
      return false;
    }
  },

  // User Actions
  fetchTenantUsers: async (tenantId) => {
    set((state) => ({ loading: { ...state.loading, users: true }, error: null }));
    try {
      const response = await adminApi.listTenantUsers(tenantId);
      set({ tenantUsers: response.data, loading: { ...get().loading, users: false } });
    } catch (error: any) {
      set({
        error: error.response?.data?.detail || 'Failed to fetch users',
        loading: { ...get().loading, users: false },
      });
    }
  },

  addUser: async (tenantId, data) => {
    try {
      const response = await adminApi.addTenantUser(tenantId, data);
      set((state) => ({ tenantUsers: [response.data, ...state.tenantUsers], error: null }));
      return response.data;
    } catch (error: any) {
      let errorMsg = 'Failed to add user';
      const detail = error.response?.data?.detail;
      if (typeof detail === 'string') {
        errorMsg = detail;
      } else if (Array.isArray(detail)) {
        errorMsg = detail.map((e: any) => e.msg || JSON.stringify(e)).join(', ');
      } else if (detail && typeof detail === 'object') {
        errorMsg = detail.msg || JSON.stringify(detail);
      }
      set({ error: errorMsg });
      return null;
    }
  },

  updateUser: async (tenantId, userId, data) => {
    try {
      const response = await adminApi.updateTenantUser(tenantId, userId, data);
      set((state) => ({
        tenantUsers: state.tenantUsers.map((u) => (u.user_id === userId ? response.data : u)),
      }));
      return response.data;
    } catch (error: any) {
      set({ error: error.response?.data?.detail || 'Failed to update user' });
      return null;
    }
  },

  removeUser: async (tenantId, userId) => {
    try {
      await adminApi.removeTenantUser(tenantId, userId);
      set((state) => ({
        tenantUsers: state.tenantUsers.filter((u) => u.user_id !== userId),
      }));
      return true;
    } catch (error: any) {
      set({ error: error.response?.data?.detail || 'Failed to remove user' });
      return false;
    }
  },

  // Domain Actions
  fetchDomains: async (tenantId) => {
    set((state) => ({ loading: { ...state.loading, domains: true }, error: null }));
    try {
      const response = await adminApi.listDomains(tenantId);
      set({ domains: response.data, loading: { ...get().loading, domains: false } });
    } catch (error: any) {
      set({
        error: error.response?.data?.detail || 'Failed to fetch domains',
        loading: { ...get().loading, domains: false },
      });
    }
  },

  addDomain: async (tenantId, data) => {
    try {
      const response = await adminApi.addDomain(tenantId, data);
      set((state) => ({ domains: [response.data, ...state.domains] }));
      return response.data;
    } catch (error: any) {
      const errorDetail = error.response?.data?.detail || '';

      // Handle "domain already registered" - it was likely added on a previous attempt
      if (errorDetail.toLowerCase().includes('already registered') ||
          errorDetail.toLowerCase().includes('already exists')) {
        // Refresh domains list to get the existing domain
        await get().fetchDomains(tenantId);
        // Find the domain that was just added
        const existingDomain = get().domains.find(
          (d) => d.domain.toLowerCase() === data.domain.toLowerCase()
        );
        if (existingDomain) {
          // Domain exists, return it so UI can redirect
          set({ error: null });
          return existingDomain;
        }
        set({ error: 'This domain was already added. Please refresh to see it.' });
      } else {
        set({ error: errorDetail || 'Failed to add domain' });
      }
      return null;
    }
  },

  verifyDomain: async (tenantId, domainId) => {
    try {
      const response = await adminApi.verifyDomain(tenantId, domainId);
      // Refresh domains to get updated status
      get().fetchDomains(tenantId);
      return response.data;
    } catch (error: any) {
      set({ error: error.response?.data?.detail || 'Failed to verify domain' });
      return null;
    }
  },

  removeDomain: async (tenantId, domainId) => {
    try {
      await adminApi.removeDomain(tenantId, domainId);
      set((state) => ({
        domains: state.domains.filter((d) => d.id !== domainId),
      }));
      return true;
    } catch (error: any) {
      set({ error: error.response?.data?.detail || 'Failed to remove domain' });
      return false;
    }
  },

  // Developer Actions
  fetchDevelopers: async () => {
    set((state) => ({ loading: { ...state.loading, developers: true }, error: null }));
    try {
      const response = await adminApi.listDevelopers();
      set({ developers: response.data, loading: { ...get().loading, developers: false } });
    } catch (error: any) {
      set({
        error: error.response?.data?.detail || 'Failed to fetch developers',
        loading: { ...get().loading, developers: false },
      });
    }
  },

  createDeveloper: async (data) => {
    try {
      const response = await adminApi.createDeveloper(data);
      set((state) => ({ developers: [response.data, ...state.developers] }));
      return response.data;
    } catch (error: any) {
      set({ error: error.response?.data?.detail || 'Failed to create developer' });
      return null;
    }
  },

  // Activity Actions
  fetchActivityLogs: async (tenantId, params) => {
    set((state) => ({ loading: { ...state.loading, activity: true }, error: null }));
    try {
      const response = await adminApi.getActivityLog(tenantId, params);
      set({ activityLogs: response.data, loading: { ...get().loading, activity: false } });
    } catch (error: any) {
      set({
        error: error.response?.data?.detail || 'Failed to fetch activity logs',
        loading: { ...get().loading, activity: false },
      });
    }
  },

  // Dashboard Actions
  fetchDashboard: async (tenantId) => {
    set((state) => ({ loading: { ...state.loading, dashboard: true }, error: null }));
    try {
      const response = await adminApi.getAdminDashboard(tenantId);
      set({ dashboard: response.data, loading: { ...get().loading, dashboard: false } });
    } catch (error: any) {
      set({
        error: error.response?.data?.detail || 'Failed to fetch dashboard',
        loading: { ...get().loading, dashboard: false },
      });
    }
  },

  // Aliases - expose tenantUsers as users for convenience
  get users() {
    return get().tenantUsers;
  },
  fetchUsers: async (tenantId) => {
    return get().fetchTenantUsers(tenantId);
  },
}));
