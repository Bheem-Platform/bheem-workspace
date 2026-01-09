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
  // ERP Integration Types
  SubscriptionPlan,
  SubscriptionStatus,
  CheckoutSession,
  CheckoutRequest,
  ERPSyncStatus,
  ERPSyncResult,
  Invoice,
  BillingCycle,
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

export const getTenantUser = (tenantId: string, userId: string) =>
  api.get<TenantUser>(`/admin/tenants/${tenantId}/users/${userId}`);

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

export const getDomain = (tenantId: string, domainId: string) =>
  api.get<Domain>(`/admin/tenants/${tenantId}/domains/${domainId}`);

export const updateDomain = (tenantId: string, domainId: string, data: {
  is_primary?: boolean;
  is_active?: boolean;
}) => api.patch(`/admin/tenants/${tenantId}/domains/${domainId}`, null, { params: data });

// ==================== MAIL ====================

export const listMailDomains = (tenantId: string) =>
  api.get(`/admin/tenants/${tenantId}/mail/domains`);

export const listMailboxes = (tenantId: string, domain?: string) =>
  api.get(`/admin/tenants/${tenantId}/mail/mailboxes`, { params: { domain } });

export const createMailbox = (tenantId: string, data: MailboxCreate) =>
  api.post(`/admin/tenants/${tenantId}/mail/mailboxes`, data);

export const deleteMailbox = (tenantId: string, email: string) =>
  api.delete(`/admin/tenants/${tenantId}/mail/mailboxes/${encodeURIComponent(email)}`);

export const getMailbox = (tenantId: string, email: string) =>
  api.get(`/admin/tenants/${tenantId}/mail/mailboxes/${encodeURIComponent(email)}`);

export const updateMailbox = (tenantId: string, email: string, data: {
  name?: string;
  quota_mb?: number;
  active?: boolean;
}) => api.patch(`/admin/tenants/${tenantId}/mail/mailboxes/${encodeURIComponent(email)}`, null, { params: data });

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

// ==================== DOCS ADMIN (Phase 4) ====================

export const listDocsUsers = (tenantId: string, params?: {
  search?: string;
  limit?: number;
  offset?: number;
}) => api.get(`/admin/tenants/${tenantId}/docs/users`, { params });

export const getDocsUser = (tenantId: string, username: string) =>
  api.get(`/admin/tenants/${tenantId}/docs/users/${username}`);

export const setDocsUserQuota = (tenantId: string, username: string, quotaMb: number) =>
  api.put(`/admin/tenants/${tenantId}/docs/users/${username}/quota`, { quota_mb: quotaMb });

export const disableDocsUser = (tenantId: string, username: string) =>
  api.post(`/admin/tenants/${tenantId}/docs/users/${username}/disable`);

export const enableDocsUser = (tenantId: string, username: string) =>
  api.post(`/admin/tenants/${tenantId}/docs/users/${username}/enable`);

export const listDocsShares = (tenantId: string, path?: string) =>
  api.get(`/admin/tenants/${tenantId}/docs/shares`, { params: { path } });

export const getDocsShare = (tenantId: string, shareId: string) =>
  api.get(`/admin/tenants/${tenantId}/docs/shares/${shareId}`);

export const updateDocsShare = (tenantId: string, shareId: string, data: {
  permissions?: number;
  expiration?: string;
  password?: string;
}) => api.put(`/admin/tenants/${tenantId}/docs/shares/${shareId}`, data);

export const deleteDocsShare = (tenantId: string, shareId: string) =>
  api.delete(`/admin/tenants/${tenantId}/docs/shares/${shareId}`);

export const listDocsGroups = (tenantId: string) =>
  api.get(`/admin/tenants/${tenantId}/docs/groups`);

export const createDocsGroup = (tenantId: string, name: string) =>
  api.post(`/admin/tenants/${tenantId}/docs/groups`, { name });

export const addUserToDocsGroup = (tenantId: string, username: string, groupName: string) =>
  api.post(`/admin/tenants/${tenantId}/docs/users/${username}/groups`, { group_name: groupName });

export const removeUserFromDocsGroup = (tenantId: string, username: string, groupName: string) =>
  api.delete(`/admin/tenants/${tenantId}/docs/users/${username}/groups/${groupName}`);

export const getDocsStorageStats = (tenantId: string) =>
  api.get(`/admin/tenants/${tenantId}/docs/storage/stats`);

export const getDocsStorageOverview = () =>
  api.get(`/admin/docs/storage/overview`);

// ==================== REPORTING (Phase 6) ====================

export const getUsageReport = (tenantId: string, params?: {
  period?: 'day' | 'week' | 'month' | 'year';
}) => api.get(`/admin/tenants/${tenantId}/reports/usage`, { params });

export const getActivityReport = (tenantId: string, params?: {
  period?: 'day' | 'week' | 'month';
  group_by?: 'hour' | 'day' | 'week';
}) => api.get(`/admin/tenants/${tenantId}/reports/activity`, { params });

export const getTenantsOverview = () =>
  api.get(`/admin/reports/tenants/overview`);

export const bulkUserOperation = (tenantId: string, data: {
  action: 'enable' | 'disable' | 'delete' | 'set_quota';
  user_ids: string[];
  quota_mb?: number;
}) => api.post(`/admin/tenants/${tenantId}/bulk/users`, data);

export const bulkTenantOperation = (data: {
  action: 'suspend' | 'activate' | 'update_plan';
  tenant_ids: string[];
  plan?: string;
}) => api.post(`/admin/bulk/tenants`, data);

export const exportUsers = (tenantId: string, format: 'json' | 'csv' = 'json') =>
  api.get(`/admin/tenants/${tenantId}/export/users`, { params: { format } });

export const exportActivity = (tenantId: string, params?: {
  format?: 'json' | 'csv';
  period?: 'day' | 'week' | 'month' | 'year';
}) => api.get(`/admin/tenants/${tenantId}/export/activity`, { params });

// ==================== HEALTH CHECK ====================

export const getHealthStatus = () =>
  api.get(`/health`);

export const getDetailedHealth = () =>
  api.get(`/health/detailed`);

export const getServiceHealth = (serviceName: string) =>
  api.get(`/health/services/${serviceName}`);

// ==================== DEVELOPERS ====================

export const listDevelopers = (params?: { skip?: number; limit?: number }) =>
  api.get<Developer[]>('/admin/developers', { params });

export const createDeveloper = (data: DeveloperCreate) =>
  api.post<Developer>('/admin/developers', data);

export const grantProjectAccess = (developerId: string, data: DeveloperProjectAccess) =>
  api.post(`/admin/developers/${developerId}/projects`, data);

export const getDeveloper = (developerId: string) =>
  api.get<Developer>(`/admin/developers/${developerId}`);

export const updateDeveloper = (developerId: string, data: {
  name?: string;
  email?: string;
  company?: string;
  website?: string;
  is_active?: boolean;
}) => api.patch(`/admin/developers/${developerId}`, null, { params: data });

export const deleteDeveloper = (developerId: string) =>
  api.delete(`/admin/developers/${developerId}`);

export const regenerateDeveloperApiKey = (developerId: string) =>
  api.post<{ api_key: string }>(`/admin/developers/${developerId}/regenerate-key`);

export const listDeveloperProjects = (developerId: string) =>
  api.get(`/admin/developers/${developerId}/projects`);

// ==================== ACTIVITY LOG ====================

export const getActivityLog = (tenantId: string, params?: {
  user_id?: string;
  action?: string;
  from_date?: string;
  to_date?: string;
  limit?: number;
}) => api.get<ActivityLog[]>(`/admin/tenants/${tenantId}/activity`, { params });

// ==================== DASHBOARD ====================

export const getAdminDashboard = (tenantId: string) =>
  api.get<AdminDashboard>(`/admin/tenants/${tenantId}/dashboard`);

// ==================== BILLING & SUBSCRIPTION (ERP Integration) ====================

export const getSubscriptionPlans = () =>
  api.get<{ plans: SubscriptionPlan[]; source: string }>('/billing/plans');

export const getSubscriptionStatus = (tenantId: string) =>
  api.get<SubscriptionStatus>(`/billing/subscription`, { params: { tenant_id: tenantId } });

export const createCheckoutSession = (tenantId: string, data: CheckoutRequest) =>
  api.post<CheckoutSession>('/billing/checkout', { ...data, tenant_id: tenantId });

export const getCheckoutStatus = (orderId: string) =>
  api.get<{ status: string; subscription_id?: string }>(`/billing/checkout/${orderId}/status`);

export const cancelSubscription = (tenantId: string, reason?: string) =>
  api.post('/billing/subscription/cancel', { tenant_id: tenantId, reason });

export const getInvoices = (tenantId: string, params?: { limit?: number; offset?: number }) =>
  api.get<Invoice[]>('/billing/invoices', { params: { tenant_id: tenantId, ...params } });

export const downloadInvoice = (invoiceId: string) =>
  api.get<{ url: string }>(`/billing/invoices/${invoiceId}/download`);

export const updateBillingCycle = (tenantId: string, billingCycle: BillingCycle) =>
  api.patch('/billing/subscription/cycle', { tenant_id: tenantId, billing_cycle: billingCycle });

// ==================== ERP SYNC (Internal Mode) ====================

export const getERPSyncStatus = (tenantId: string) =>
  api.get<ERPSyncStatus>('/erp-sync/status', { params: { tenant_id: tenantId } });

export const syncEmployees = (tenantId: string) =>
  api.post<ERPSyncResult>('/erp-sync/employees', { tenant_id: tenantId });

export const syncProjects = (tenantId: string) =>
  api.post<ERPSyncResult>('/erp-sync/projects', { tenant_id: tenantId });

export const provisionInternalTenant = (companyCode: string) =>
  api.post<{ tenant_id: string; name: string; slug: string }>('/erp-sync/provision', { company_code: companyCode });

export const listBheemverseCompanies = () =>
  api.get<{ companies: { company_code: string; company_name: string; company_id: string }[] }>('/erp-sync/companies');

// ==================== ERP INTEGRATION STATUS ====================

export const getERPIntegrationStatus = () =>
  api.get<{
    erp_connected: boolean;
    bheempay_connected: boolean;
    erp_url: string;
    bheempay_url: string;
  }>('/health/erp-integration');

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
