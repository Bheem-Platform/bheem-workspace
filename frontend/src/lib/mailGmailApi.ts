/**
 * Gmail-like Features API Client
 * Categories, Snooze, Starred, Important
 */
import { api } from './api';

// ==========================================
// Types
// ==========================================

export interface CategoryCounts {
  primary: number;
  social: number;
  updates: number;
  promotions: number;
  forums: number;
}

export interface MailCounts {
  starred: number;
  important: number;
  snoozed: number;
  categories: CategoryCounts;
}

export interface SnoozeInfo {
  id: string;
  message_id: string;
  snooze_until: string;
  original_folder: string;
  subject?: string;
  sender?: string;
  snippet?: string;
}

export interface SnoozeOptions {
  [key: string]: string;
}

export interface EmailFlags {
  is_starred: boolean;
  is_important: boolean;
  auto_important: boolean;
  importance_reason?: string;
  is_snoozed: boolean;
  snooze_until?: string;
  category: string;
}

// ==========================================
// Categories API
// ==========================================

export const categoriesApi = {
  /**
   * Get email counts per category
   */
  getCounts: async (): Promise<{ counts: CategoryCounts; categories: string[] }> => {
    const response = await api.get('/mail/categories');
    return response.data;
  },

  /**
   * Get message IDs for a specific category
   */
  getByCategory: async (
    category: string,
    limit = 50,
    offset = 0
  ): Promise<{ category: string; count: number; message_ids: string[] }> => {
    const response = await api.get(`/mail/categories/${category}`, {
      params: { limit, offset }
    });
    return response.data;
  },

  /**
   * Set category for an email
   */
  setCategory: async (messageId: string, category: string): Promise<void> => {
    await api.post('/mail/categories/set', {
      message_id: messageId,
      category
    });
  },

  /**
   * Auto-categorize multiple emails
   */
  bulkCategorize: async (
    emails: Array<{ id: string; from?: string; subject?: string; headers?: any }>
  ): Promise<{ categorized: Record<string, string[]>; total: number }> => {
    const response = await api.post('/mail/categories/bulk-categorize', { emails });
    return response.data;
  },

  /**
   * Get category for a specific message
   */
  getMessageCategory: async (messageId: string): Promise<string> => {
    const response = await api.get(`/mail/categories/message/${messageId}`);
    return response.data.category;
  },

  /**
   * Get category rules
   */
  getRules: async (includeSystem = true) => {
    const response = await api.get('/mail/categories/rules', {
      params: { include_system: includeSystem }
    });
    return response.data.rules;
  },

  /**
   * Create a new category rule
   */
  createRule: async (
    name: string,
    category: string,
    conditions: Record<string, any>,
    priority = 0
  ) => {
    const response = await api.post('/mail/categories/rules', {
      name, category, conditions, priority
    });
    return response.data.rule;
  },

  /**
   * Delete a category rule
   */
  deleteRule: async (ruleId: string) => {
    await api.delete(`/mail/categories/rules/${ruleId}`);
  }
};

// ==========================================
// Snooze API
// ==========================================

export const snoozeApi = {
  /**
   * Get all snoozed emails
   */
  getSnoozed: async (
    limit = 50,
    offset = 0
  ): Promise<{ count: number; snoozed: SnoozeInfo[] }> => {
    const response = await api.get('/mail/snoozed', {
      params: { limit, offset }
    });
    return response.data;
  },

  /**
   * Snooze an email
   */
  snooze: async (
    messageId: string,
    options: {
      snooze_until?: string;
      snooze_option?: string; // later_today, tomorrow, tomorrow_morning, next_week, next_weekend
      original_folder?: string;
      subject?: string;
      sender?: string;
      snippet?: string;
    }
  ): Promise<{ success: boolean; message_id: string; snooze_until: string }> => {
    const response = await api.post('/mail/snooze', {
      message_id: messageId,
      ...options
    });
    return response.data;
  },

  /**
   * Get available snooze options with calculated times
   */
  getOptions: async (): Promise<{ options: SnoozeOptions; labels: Record<string, string> }> => {
    const response = await api.get('/mail/snooze/options');
    return response.data;
  },

  /**
   * Unsnooze an email
   */
  unsnooze: async (messageId: string): Promise<{ success: boolean; original_folder: string }> => {
    const response = await api.delete(`/mail/snooze/${messageId}`);
    return response.data;
  },

  /**
   * Update snooze time
   */
  updateTime: async (messageId: string, snoozeUntil: string): Promise<void> => {
    await api.put(`/mail/snooze/${messageId}`, { snooze_until: snoozeUntil });
  },

  /**
   * Get snooze info for a specific email
   */
  getInfo: async (messageId: string): Promise<SnoozeInfo | null> => {
    const response = await api.get(`/mail/snooze/${messageId}`);
    return response.data.is_snoozed ? response.data : null;
  }
};

// ==========================================
// Starred API
// ==========================================

export const starredApi = {
  /**
   * Get all starred email message IDs
   */
  getStarred: async (
    limit = 50,
    offset = 0
  ): Promise<{ count: number; message_ids: string[] }> => {
    const response = await api.get('/mail/starred', {
      params: { limit, offset }
    });
    return response.data;
  },

  /**
   * Star an email
   */
  star: async (messageId: string): Promise<void> => {
    await api.post('/mail/star', { message_id: messageId });
  },

  /**
   * Unstar an email
   */
  unstar: async (messageId: string): Promise<void> => {
    await api.delete(`/mail/star/${messageId}`);
  },

  /**
   * Toggle star status
   */
  toggle: async (messageId: string): Promise<{ is_starred: boolean }> => {
    const response = await api.post(`/mail/star/${messageId}/toggle`);
    return response.data;
  }
};

// ==========================================
// Important API
// ==========================================

export const importantApi = {
  /**
   * Get all important email message IDs
   */
  getImportant: async (
    limit = 50,
    offset = 0
  ): Promise<{ count: number; message_ids: string[] }> => {
    const response = await api.get('/mail/important', {
      params: { limit, offset }
    });
    return response.data;
  },

  /**
   * Mark email as important
   */
  mark: async (messageId: string, reason?: string): Promise<void> => {
    await api.post('/mail/important', {
      message_id: messageId,
      reason
    });
  },

  /**
   * Remove important flag
   */
  unmark: async (messageId: string): Promise<void> => {
    await api.delete(`/mail/important/${messageId}`);
  }
};

// ==========================================
// Combined API
// ==========================================

export const mailFlagsApi = {
  /**
   * Get all flags for an email
   */
  getFlags: async (messageId: string): Promise<EmailFlags> => {
    const response = await api.get(`/mail/flags/${messageId}`);
    return response.data;
  },

  /**
   * Get flags for multiple emails
   */
  getBulkFlags: async (
    messageIds: string[]
  ): Promise<Record<string, EmailFlags>> => {
    const response = await api.post('/mail/flags/bulk', { message_ids: messageIds });
    return response.data.flags;
  },

  /**
   * Get all counts
   */
  getAllCounts: async (): Promise<MailCounts> => {
    const response = await api.get('/mail/counts');
    return response.data;
  }
};

// Default export with all APIs
const mailGmailApi = {
  categories: categoriesApi,
  snooze: snoozeApi,
  starred: starredApi,
  important: importantApi,
  flags: mailFlagsApi
};

export default mailGmailApi;
