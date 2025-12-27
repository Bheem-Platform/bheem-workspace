import { api } from './api';
import type {
  Tenant,
  TenantCreate,
  TenantUpdate,
  TenantUser,
  TenantUserCreate,
  TenantUserUpdate,
  Domain,
  DomainCreate,
  DomainDNSRecords,
  Developer,
  DeveloperCreate,
  DeveloperProjectAccess,
  ActivityLog,
  MailboxCreate,
  MeetSettings,
  MailStats,
  MeetStats,
  DocsStats,
  AdminDashboard,
} from '@/types/admin';

// ==================== TENANTS ====================

export const listTenants = (params?: {
  skip?: number;
  limit?: number;
  search?: string;
  plan?: string;
  is_active?: boolean;
}) => api.get<Tenant[]>('/admin/tenants', { params });

export const createTenant = (data: TenantCreate) =>
  api.post<Tenant>('/admin/tenants', data);

export const getTenant = (tenantId: string) =>
  api.get<Tenant>(`/admin/tenants/${tenantId}`);

export const updateTenant = (tenantId: string, data: TenantUpdate) =>
  api.patch<Tenant>(`/admin/tenants/${tenantId}`, data);

export const deleteTenant = (tenantId: string) =>
  api.delete(`/admin/tenants/${tenantId}`);

// ==================== TENANT USERS ====================

export const listTenantUsers = (tenantId: string, params?: {
  skip?: number;
  limit?: number;
  role?: string;
}) => api.get<TenantUser[]>(`/admin/tenants/${tenantId}/users`, { params });

export const addTenantUser = (tenantId: string, data: TenantUserCreate) =>
  api.post<TenantUser>(`/admin/tenants/${tenantId}/users`, data);

export const updateTenantUser = (tenantId: string, userId: string, data: TenantUserUpdate) =>
  api.patch<TenantUser>(`/admin/tenants/${tenantId}/users/${userId}`, data);

export const removeTenantUser = (tenantId: string, userId: string) =>
  api.delete(`/admin/tenants/${tenantId}/users/${userId}`);

// ==================== DOMAINS ====================

export const listDomains = (tenantId: string) =>
  api.get<Domain[]>(`/admin/tenants/${tenantId}/domains`);

export const addDomain = (tenantId: string, data: DomainCreate) =>
  api.post<Domain>(`/admin/tenants/${tenantId}/domains`, data);

export const getDomainDNSRecords = (tenantId: string, domainId: string) =>
  api.get<DomainDNSRecords>(`/admin/tenants/${tenantId}/domains/${domainId}/dns-records`);

export const verifyDomain = (tenantId: string, domainId: string) =>
  api.post(`/admin/tenants/${tenantId}/domains/${domainId}/verify`);

export const removeDomain = (tenantId: string, domainId: string) =>
  api.delete(`/admin/tenants/${tenantId}/domains/${domainId}`);

// ==================== MAIL ====================

export const listMailboxes = (tenantId: string, domain?: string) =>
  api.get(`/admin/tenants/${tenantId}/mail/mailboxes`, { params: { domain } });

export const createMailbox = (tenantId: string, data: MailboxCreate) =>
  api.post(`/admin/tenants/${tenantId}/mail/mailboxes`, data);

export const deleteMailbox = (tenantId: string, email: string) =>
  api.delete(`/admin/tenants/${tenantId}/mail/mailboxes/${encodeURIComponent(email)}`);

export const getMailStats = (tenantId: string) =>
  api.get<MailStats>(`/admin/tenants/${tenantId}/mail/stats`);

// ==================== MEET ====================

export const getMeetStats = (tenantId: string) =>
  api.get<MeetStats>(`/admin/tenants/${tenantId}/meet/stats`);

export const getMeetSettings = (tenantId: string) =>
  api.get<MeetSettings>(`/admin/tenants/${tenantId}/meet/settings`);

export const updateMeetSettings = (tenantId: string, data: Partial<MeetSettings>) =>
  api.patch(`/admin/tenants/${tenantId}/meet/settings`, data);

// ==================== DOCS ====================

export const getDocsStats = (tenantId: string) =>
  api.get<DocsStats>(`/admin/tenants/${tenantId}/docs/stats`);

// ==================== DEVELOPERS ====================

export const listDevelopers = (params?: { skip?: number; limit?: number }) =>
  api.get<Developer[]>('/admin/developers', { params });

export const createDeveloper = (data: DeveloperCreate) =>
  api.post<Developer>('/admin/developers', data);

export const grantProjectAccess = (developerId: string, data: DeveloperProjectAccess) =>
  api.post(`/admin/developers/${developerId}/projects`, data);

// ==================== ACTIVITY LOG ====================

export const getActivityLog = (tenantId: string, params?: {
  user_id?: string;
  action?: string;
  limit?: number;
}) => api.get<ActivityLog[]>(`/admin/tenants/${tenantId}/activity`, { params });

// ==================== DASHBOARD ====================

export const getAdminDashboard = (tenantId: string) =>
  api.get<AdminDashboard>(`/admin/tenants/${tenantId}/dashboard`);

// ==================== HELPER FUNCTIONS ====================

export const formatBytes = (bytes: number, decimals = 2): string => {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
};

export const formatMB = (mb: number): string => {
  if (mb < 1024) return `${mb.toFixed(1)} MB`;
  return `${(mb / 1024).toFixed(1)} GB`;
};

export const formatHours = (hours: number): string => {
  if (hours < 1) return `${Math.round(hours * 60)} min`;
  return `${hours.toFixed(1)} hrs`;
};

export const getUsageColor = (percent: number): string => {
  if (percent >= 90) return 'red';
  if (percent >= 75) return 'orange';
  if (percent >= 50) return 'yellow';
  return 'green';
};

export const getPlanColor = (plan: string): string => {
  switch (plan) {
    case 'enterprise': return 'purple';
    case 'business': return 'blue';
    case 'starter': return 'green';
    default: return 'gray';
  }
};
