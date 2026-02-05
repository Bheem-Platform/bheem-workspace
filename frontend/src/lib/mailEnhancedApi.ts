/**
 * Bheem Workspace - Enhanced Mail API Client
 *
 * Frontend API client for confidential emails and nudges.
 * Phase 9: Email Enhancements
 */

import { api as baseApi } from '@/lib/api';

// Create a wrapper that prepends the mail path
const api = {
  get: (url: string, config?: any) => baseApi.get(`/mail${url}`, config),
  post: (url: string, data?: any, config?: any) => baseApi.post(`/mail${url}`, data, config),
  put: (url: string, data?: any, config?: any) => baseApi.put(`/mail${url}`, data, config),
  patch: (url: string, data?: any, config?: any) => baseApi.patch(`/mail${url}`, data, config),
  delete: (url: string, config?: any) => baseApi.delete(`/mail${url}`, config),
};

// ============================================
// Types - Confidential Emails
// ============================================

export interface ConfidentialEmail {
  id: string;
  message_id: string;
  expires_at?: string;
  passcode_type: 'sms' | 'email' | 'none';
  no_forward: boolean;
  no_copy: boolean;
  no_print: boolean;
  no_download: boolean;
  is_revoked: boolean;
  revoked_at?: string;
  recipient_accesses: Array<{
    email: string;
    accessed_at: string;
    ip?: string;
  }>;
  created_at: string;
}

export interface ConfidentialEmailCreate {
  message_id: string;
  expires_in_hours?: number;
  passcode?: string;
  passcode_type?: 'sms' | 'email' | 'none';
  no_forward?: boolean;
  no_copy?: boolean;
  no_print?: boolean;
  no_download?: boolean;
}

export interface AccessCheckResult {
  allowed: boolean;
  reason?: string;
  restrictions?: {
    no_forward: boolean;
    no_copy: boolean;
    no_print: boolean;
    no_download: boolean;
  };
  expires_at?: string;
}

// ============================================
// Types - Nudges
// ============================================

export interface EmailNudge {
  id: string;
  message_id: string;
  nudge_type: 'sent_no_reply' | 'received_no_reply' | 'custom';
  remind_at: string;
  snooze_until?: string;
  status: 'pending' | 'shown' | 'dismissed' | 'replied' | 'snoozed';
  subject?: string;
  recipient_email?: string;
  sent_at?: string;
  note?: string;
  created_at: string;
}

export interface NudgeSettings {
  nudges_enabled: boolean;
  sent_no_reply_days: number;
  received_no_reply_days: number;
  nudge_sent_emails: boolean;
  nudge_received_emails: boolean;
  nudge_important_only: boolean;
  quiet_hours_start?: string;
  quiet_hours_end?: string;
  quiet_weekends: boolean;
  excluded_senders: string[];
  excluded_domains: string[];
}

export interface NudgeCreate {
  message_id: string;
  nudge_type?: 'sent_no_reply' | 'received_no_reply' | 'custom';
  remind_at: Date;
  subject?: string;
  recipient_email?: string;
  note?: string;
}

// ============================================
// Confidential Email API
// ============================================

export const confidentialApi = {
  async create(data: ConfidentialEmailCreate): Promise<ConfidentialEmail> {
    const response = await api.post('/confidential', data);
    return response.data;
  },

  async list(includeExpired = false): Promise<ConfidentialEmail[]> {
    const response = await api.get('/confidential', {
      params: { include_expired: includeExpired }
    });
    return response.data;
  },

  async get(messageId: string): Promise<ConfidentialEmail> {
    const response = await api.get(`/confidential/${messageId}`);
    return response.data;
  },

  async checkAccess(messageId: string, passcode?: string): Promise<AccessCheckResult> {
    const response = await api.post(`/confidential/${messageId}/check-access`, {
      passcode
    });
    return response.data;
  },

  async revoke(messageId: string): Promise<void> {
    await api.post(`/confidential/${messageId}/revoke`);
  },

  async updateExpiration(messageId: string, expiresAt?: Date): Promise<void> {
    await api.patch(`/confidential/${messageId}/expiration`, {
      expires_at: expiresAt?.toISOString()
    });
  },

  async delete(messageId: string): Promise<void> {
    await api.delete(`/confidential/${messageId}`);
  }
};

// ============================================
// Nudge API
// ============================================

export const nudgeApi = {
  // Settings
  async getSettings(): Promise<NudgeSettings> {
    const response = await api.get('/nudges/settings');
    return response.data;
  },

  async updateSettings(settings: Partial<NudgeSettings>): Promise<NudgeSettings> {
    const response = await api.patch('/nudges/settings', settings);
    return response.data;
  },

  // Nudges
  async create(data: NudgeCreate): Promise<EmailNudge> {
    const response = await api.post('/nudges', {
      ...data,
      remind_at: data.remind_at.toISOString()
    });
    return response.data;
  },

  async list(includeFuture = false): Promise<EmailNudge[]> {
    const response = await api.get('/nudges', {
      params: { include_future: includeFuture }
    });
    return response.data;
  },

  async getDue(): Promise<EmailNudge[]> {
    const response = await api.get('/nudges/due');
    return response.data;
  },

  async getCount(): Promise<number> {
    const response = await api.get('/nudges/count');
    return response.data.count;
  },

  async get(nudgeId: string): Promise<EmailNudge> {
    const response = await api.get(`/nudges/${nudgeId}`);
    return response.data;
  },

  async markShown(nudgeId: string): Promise<void> {
    await api.post(`/nudges/${nudgeId}/shown`);
  },

  async dismiss(nudgeId: string): Promise<void> {
    await api.post(`/nudges/${nudgeId}/dismiss`);
  },

  async snooze(nudgeId: string, hours = 24): Promise<void> {
    await api.post(`/nudges/${nudgeId}/snooze`, { hours });
  },

  async markReplied(messageId: string): Promise<void> {
    await api.post(`/nudges/message/${messageId}/replied`);
  },

  async delete(nudgeId: string): Promise<void> {
    await api.delete(`/nudges/${nudgeId}`);
  }
};

export default { confidentialApi, nudgeApi };
