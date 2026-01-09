/**
 * Dashboard API functions
 */
import { api } from './api';
import type { UserDashboardData, AdminDashboardData, ServiceStats, ActivityData } from '@/types/dashboard';

// User Dashboard APIs
export async function getUserDashboard(password: string): Promise<UserDashboardData> {
  const response = await api.get('/user-workspace/dashboard', {
    params: { password },
  });
  return response.data;
}

// Admin Dashboard APIs
export async function getAdminDashboard(tenantId: string): Promise<AdminDashboardData> {
  const response = await api.get(`/admin/tenants/${tenantId}/dashboard`);
  return response.data;
}

export async function getMailStats(tenantId: string): Promise<ServiceStats['mail']> {
  const response = await api.get(`/admin/tenants/${tenantId}/mail/stats`);
  return response.data;
}

export async function getMeetStats(tenantId: string): Promise<ServiceStats['meet']> {
  const response = await api.get(`/admin/tenants/${tenantId}/meet/stats`);
  return response.data;
}

export async function getDocsStats(tenantId: string): Promise<ServiceStats['docs']> {
  const response = await api.get(`/admin/tenants/${tenantId}/docs/stats`);
  return response.data;
}

export async function getActivityReport(
  tenantId: string,
  params: { period?: string; group_by?: string } = {}
): Promise<{ timeline: ActivityData[] }> {
  const response = await api.get(`/admin/tenants/${tenantId}/reports/activity`, {
    params: {
      period: params.period || 'week',
      group_by: params.group_by || 'day',
    },
  });
  return response.data;
}

export async function getUsageReport(tenantId: string): Promise<{
  users: { total: number; active: number; new_in_period: number };
  storage: { mail_mb: number; docs_mb: number; meet_mb: number; recordings_mb: number };
  activity: { total: number; by_action: Record<string, number> };
}> {
  const response = await api.get(`/admin/tenants/${tenantId}/reports/usage`);
  return response.data;
}

// Utility functions for transforming data
export function transformActivityToChartData(activities: ActivityData[]): { label: string; value: number }[] {
  return activities.map((a) => ({
    label: formatDateLabel(a.date),
    value: a.count,
  }));
}

export function transformStorageToDonutData(usage: {
  mail_mb: number;
  docs_mb: number;
  meet_mb: number;
  recordings_mb: number;
}): { label: string; value: number; color: string }[] {
  return [
    { label: 'Mail', value: usage.mail_mb, color: '#3B82F6' },
    { label: 'Docs', value: usage.docs_mb, color: '#A855F7' },
    { label: 'Meet', value: usage.meet_mb, color: '#22C55E' },
    { label: 'Recordings', value: usage.recordings_mb, color: '#F97316' },
  ].filter((item) => item.value > 0);
}

function formatDateLabel(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diffDays = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));

  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7) {
    return date.toLocaleDateString('en-US', { weekday: 'short' });
  }
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

export function formatStorageSize(mb: number): string {
  if (mb >= 1024) {
    return `${(mb / 1024).toFixed(1)} GB`;
  }
  return `${Math.round(mb)} MB`;
}

export function calculatePercentage(used: number, quota: number): number {
  if (quota <= 0) return 0;
  return Math.min(100, Math.round((used / quota) * 100));
}

export function getTimeAgo(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / (1000 * 60));
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}
