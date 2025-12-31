// Admin Module TypeScript Types

// Enums
export type UserRole = 'admin' | 'manager' | 'member' | 'guest';
export type PlanType = 'free' | 'starter' | 'business' | 'enterprise';
export type DomainType = 'email' | 'workspace' | 'custom';
export type ServiceType = 'mail' | 'docs' | 'meet';
export type TenantMode = 'internal' | 'external';
export type SubscriptionStatusType = 'active' | 'pending' | 'cancelled' | 'suspended' | 'expired' | 'trial';
export type BillingCycle = 'monthly' | 'annual';

// Tenant
export interface Tenant {
  id: string;
  name: string;
  slug: string;
  domain: string | null;
  owner_email: string;
  plan: PlanType;
  is_active: boolean;
  is_suspended: boolean;
  settings: Record<string, any>;
  max_users: number;
  meet_quota_hours: number;
  docs_quota_mb: number;
  mail_quota_mb: number;
  recordings_quota_mb: number;
  meet_used_hours: number;
  docs_used_mb: number;
  mail_used_mb: number;
  recordings_used_mb: number;
  created_at: string;
  user_count: number;
  // ERP Integration Fields
  tenant_mode?: TenantMode;
  erp_company_code?: string;
  erp_company_id?: string;
  erp_customer_id?: string;
  erp_subscription_id?: string;
  subscription_status?: SubscriptionStatusType;
  subscription_plan?: string;
  subscription_period_end?: string;
}

export interface TenantCreate {
  name: string;
  slug: string;
  domain?: string | null;
  owner_email: string;
  plan?: PlanType;
}

export interface TenantUpdate {
  name?: string;
  domain?: string | null;
  plan?: PlanType;
  is_active?: boolean;
  settings?: Record<string, any>;
}

// Tenant User
export interface TenantUser {
  id: string;
  tenant_id: string;
  user_id: string;
  email: string;
  name: string;
  role: UserRole;
  is_active: boolean;
  permissions: Record<string, any>;
  invited_at: string | null;
  joined_at: string | null;
  last_login_at: string | null;
  created_at: string;
}

export interface TenantUserCreate {
  email: string;
  name: string;
  role?: UserRole;
}

export interface TenantUserUpdate {
  role?: UserRole;
  is_active?: boolean;
  permissions?: Record<string, any>;
}

// Domain
export interface Domain {
  id: string;
  tenant_id: string;
  domain: string;
  domain_type: DomainType;
  is_primary: boolean;
  is_active: boolean;
  verification_status: 'pending' | 'verified' | 'failed';
  mail_enabled: boolean;
  meet_enabled: boolean;
  spf_verified: boolean;
  dkim_verified: boolean;
  mx_verified: boolean;
  ownership_verified: boolean;
  mailgun_domain_id: string | null;
  cloudflare_zone_id: string | null;
  created_at: string;
  verified_at: string | null;
}

export interface DomainDnsRecord {
  id: string;
  record_type: string;
  name: string;
  value: string;
  priority?: number;
  purpose: string;
  is_verified: boolean;
}

export interface DomainCreate {
  domain: string;
  domain_type?: DomainType;
  is_primary?: boolean;
}

export interface DNSRecord {
  id: string;
  record_type: string;
  name: string;
  value: string;
  priority?: number | null;
  purpose?: string;
  is_verified: boolean;
}

export interface DomainDNSRecords {
  domain: string;
  verification_record: {
    record_type: string;
    name: string;
    value: string;
    purpose: string;
  };
  email_records: DNSRecord[];
}

// Developer
export interface Developer {
  id: string;
  name: string;
  email: string;
  company: string | null;
  website: string | null;
  api_key: string;
  is_active: boolean;
  projects?: DeveloperProject[];
  created_at: string;
}

export interface DeveloperCreate {
  name: string;
  email: string;
  company?: string;
  website?: string;
}

export interface DeveloperUpdate {
  name?: string;
  company?: string;
  website?: string;
  is_active?: boolean;
}

export interface DeveloperProject {
  id: string;
  developer_id: string;
  name: string;
  webhook_url?: string;
  created_at: string;
}

export interface DeveloperProjectAccess {
  project_name: string;
  access_level: string;
  git_branch_pattern?: string;
  can_push_to_main?: boolean;
  can_deploy_staging?: boolean;
  can_deploy_production?: boolean;
}

// Activity Log
export interface ActivityLog {
  id: string;
  tenant_id: string | null;
  user_id: string | null;
  user_email?: string | null;
  action: string;
  entity_type: string | null;
  entity_id: string | null;
  description: string | null;
  ip_address: string | null;
  extra_data: Record<string, any> | null;
  created_at: string;
}

// Mail
export interface Mailbox {
  id: string;
  email: string;
  display_name: string;
  is_active: boolean;
  storage_quota_mb: number;
  storage_used_mb: number;
  created_at: string;
}

export interface MailboxCreate {
  local_part: string;
  domain: string;
  name: string;
  password: string;
  quota_mb?: number;
}

export interface MailStats {
  domains: number;
  storage_quota_mb: number;
  storage_used_mb: number;
  usage_percent: number;
}

// Meet
export interface MeetSettings {
  max_participants: number;
  max_duration_minutes: number;
  allow_recording: boolean;
  waiting_room_enabled: boolean;
  chat_enabled: boolean;
  screen_share_enabled: boolean;
  hours_quota: number;
  hours_used: number;
  recordings_quota_mb: number;
  recordings_used_mb: number;
  meetings_this_month?: number;
  avg_participants?: number;
}

export interface MeetStats {
  hours_quota: number;
  hours_used: number;
  usage_percent: number;
  recordings_quota_mb: number;
  recordings_used_mb: number;
}

// Docs
export interface DocsStats {
  storage_quota_mb: number;
  storage_used_mb: number;
  usage_percent: number;
}

// Tenant Dashboard (Customer Admin)
export interface TenantDashboard {
  users: {
    total: number;
    active: number;
  };
  domains: {
    total: number;
    verified: number;
  };
  mail: {
    mailboxes: number;
  };
  meet: {
    rooms: number;
  };
  usage: {
    users_used: number;
    users_quota: number;
    meet_used: number;
    meet_quota: number;
    docs_used_mb: number;
    docs_quota_mb: number;
    mail_used_mb: number;
    mail_quota_mb: number;
  };
}

// Dashboard (Super Admin)
export interface AdminDashboard {
  tenant: Tenant;
  users: {
    total: number;
    max: number;
    by_role: Record<UserRole, number>;
  };
  domains: number;
  mail: {
    storage_used_mb: number;
    storage_quota_mb: number;
    usage_percent: number;
  };
  docs: {
    storage_used_mb: number;
    storage_quota_mb: number;
    usage_percent: number;
  };
  meet: {
    hours_used: number;
    hours_quota: number;
    usage_percent: number;
    recordings_used_mb: number;
    recordings_quota_mb: number;
  };
  recent_activity: {
    action: string;
    description: string | null;
    created_at: string;
  }[];
}

// Plan Quotas
export const PLAN_QUOTAS: Record<PlanType, {
  max_users: number;
  meet_hours: number;
  docs_mb: number;
  mail_mb: number;
  recordings_mb: number;
}> = {
  free: { max_users: 5, meet_hours: 10, docs_mb: 1024, mail_mb: 512, recordings_mb: 1024 },
  starter: { max_users: 25, meet_hours: 100, docs_mb: 10240, mail_mb: 5120, recordings_mb: 10240 },
  business: { max_users: 100, meet_hours: 500, docs_mb: 102400, mail_mb: 51200, recordings_mb: 204800 },
  enterprise: { max_users: 10000, meet_hours: 10000, docs_mb: 1048576, mail_mb: 524288, recordings_mb: 2097152 },
};

// API Response Types
export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  page_size: number;
}

export interface ApiError {
  detail: string;
  status_code?: number;
}

// ============================================
// ERP INTEGRATION TYPES
// ============================================

// Subscription Plans (from ERP SKU)
export interface SubscriptionPlan {
  sku_id: string;
  name: string;
  description: string;
  base_price: number;
  offer_price?: number;
  billing_cycle: BillingCycle;
  features: string[];
  max_users?: number;
  max_storage_gb?: number;
  max_meet_hours?: number;
  is_featured?: boolean;
}

// Subscription Status
export interface SubscriptionStatus {
  subscription_id: string | null;
  status: SubscriptionStatusType;
  payment_status?: string;
  plan: string | null;
  price: number | null;
  billing_cycle?: BillingCycle;
  next_billing_date: string | null;
  period_end: string | null;
  cancel_at_period_end?: boolean;
}

// Checkout Session (for Razorpay)
export interface CheckoutSession {
  checkout_id: string;
  order_id: string;
  amount: number;
  currency: string;
  plan_name: string;
  key_id: string;  // Razorpay public key
  gateway_response?: any;
}

export interface CheckoutRequest {
  plan_id: string;
  billing_cycle: BillingCycle;
}

// ERP Sync Types (Internal Mode)
export interface ERPSyncStatus {
  last_employee_sync?: string;
  last_project_sync?: string;
  employees_synced?: number;
  projects_synced?: number;
  sync_errors?: string[];
}

export interface ERPSyncResult {
  status: 'completed' | 'in_progress' | 'failed';
  synced: number;
  errors: { id: string; error: string }[];
  total: number;
}

export interface ERPEmployee {
  id: string;
  first_name: string;
  last_name: string;
  work_email: string;
  department?: string;
  job_title?: string;
  is_synced: boolean;
}

export interface ERPProject {
  id: string;
  name: string;
  description?: string;
  status: string;
  team_count: number;
  is_synced: boolean;
}

// Bheemverse Company (for Internal Mode)
export interface BheemverseCompany {
  company_code: string;
  company_id: string;
  company_name: string;
  description?: string;
  is_active: boolean;
}

// Invoice (from ERP Sales)
export interface Invoice {
  id: string;
  invoice_number: string;
  invoice_date: string;
  due_date: string;
  total_amount: number;
  currency: string;
  status: 'draft' | 'sent' | 'paid' | 'overdue' | 'cancelled';
  pdf_url?: string;
}

// Payment Record
export interface PaymentRecord {
  id: string;
  amount: number;
  currency: string;
  payment_method: string;
  status: 'pending' | 'completed' | 'failed' | 'refunded';
  gateway_payment_id?: string;
  paid_at?: string;
}

// ERP Integration Status (for dashboard)
export interface ERPIntegrationStatus {
  erp_connected: boolean;
  bheempay_connected: boolean;
  last_sync?: string;
  subscription_active: boolean;
  features_enabled: string[];
}
