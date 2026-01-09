/**
 * Dashboard type definitions
 */

export interface DashboardStats {
  unreadEmails: number;
  todayEvents: number;
  recentDocs: number;
  activeMeets: number;
}

export interface UserDashboardData {
  user: {
    id: string;
    name: string;
    email: string;
    role: string;
    avatar?: string;
  };
  workspace: {
    name: string;
    slug: string;
    plan?: string;
  };
  summary: {
    unread_emails: number;
    today_events: number;
    total_files: number;
  };
  recent_emails: Array<{
    id: string;
    subject: string;
    from_name: string;
    received_at: string;
    is_read: boolean;
  }>;
  today_events: Array<{
    id: string;
    title: string;
    start_time: string;
    end_time: string;
    is_all_day: boolean;
  }>;
  recent_files: Array<{
    id: string;
    name: string;
    type: string;
    modified_at: string;
  }>;
}

export interface AdminDashboardData {
  tenant: {
    id: string;
    name: string;
    slug: string;
    plan: string;
    status: string;
    is_internal: boolean;
  };
  users: {
    total: number;
    by_role: Record<string, number>;
    active: number;
  };
  domains: {
    total: number;
    verified: number;
  };
  usage: {
    mail: { used_mb: number; quota_mb: number };
    docs: { used_mb: number; quota_mb: number };
    meet: { used_hours: number; quota_hours: number };
    recordings: { used_mb: number; quota_mb: number };
  };
  recent_activity: Array<{
    id: string;
    action: string;
    description: string;
    user_name?: string;
    created_at: string;
  }>;
}

export interface ServiceStats {
  mail: {
    domains: number;
    mailboxes: number;
    storage_used_mb: number;
    storage_quota_mb: number;
    emails_sent?: number;
    emails_received?: number;
  };
  meet: {
    hours_used: number;
    hours_quota: number;
    recordings_used_mb: number;
    recordings_quota_mb: number;
  };
  docs: {
    storage_used_mb: number;
    storage_quota_mb: number;
    total_files?: number;
  };
}

export interface ActivityData {
  date: string;
  count: number;
}

export interface ChartDataPoint {
  label: string;
  value: number;
}

export interface StorageBreakdown {
  label: string;
  value: number;
  color: string;
}
