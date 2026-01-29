/**
 * Bheem Workspace - Enhanced Calendar API Client
 *
 * Frontend API client for world clock, focus time, and time insights.
 * Phase 10: Calendar Enhancements
 */

import axios from 'axios';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
const api = axios.create({ baseURL: `${API_BASE}/api/v1/calendar/enhanced` });

// ============================================
// Types - World Clock
// ============================================

export interface WorldClockCity {
  city: string;
  timezone: string;
  offset: string;
  current_time: string;
  is_dst: boolean;
}

export interface TimezoneConversion {
  source_time: string;
  source_timezone: string;
  target_time: string;
  target_timezone: string;
  offset_diff: string;
}

// ============================================
// Types - Focus Time
// ============================================

export interface FocusBlock {
  id: string;
  title: string;
  start_time: string;
  end_time: string;
  day_of_week: number;
  is_recurring: boolean;
  color: string;
  description?: string;
  auto_decline_meetings: boolean;
  show_as_busy: boolean;
  created_at: string;
}

export interface FocusBlockCreate {
  title: string;
  start_time: string;
  end_time: string;
  day_of_week: number;
  is_recurring?: boolean;
  color?: string;
  description?: string;
  auto_decline_meetings?: boolean;
  show_as_busy?: boolean;
}

// ============================================
// Types - Time Insights
// ============================================

export interface TimeInsight {
  category: string;
  hours: number;
  percentage: number;
  color: string;
}

export interface TimeInsightsReport {
  period: string;
  start_date: string;
  end_date: string;
  total_hours: number;
  meeting_hours: number;
  focus_hours: number;
  breakdown: TimeInsight[];
  busiest_day: string;
  busiest_hours: string;
  recommendations: string[];
}

// ============================================
// Types - Calendar Settings
// ============================================

export interface CalendarEnhancedSettings {
  primary_timezone: string;
  secondary_timezone?: string;
  show_dual_timezone: boolean;
  world_clock_cities: string[];
  default_event_duration: number;
  default_reminder_minutes: number;
  week_start_day: number;
  working_hours_start: string;
  working_hours_end: string;
  working_days: number[];
  focus_time_enabled: boolean;
  auto_schedule_focus: boolean;
  focus_time_hours_per_week: number;
  preferred_focus_time: 'morning' | 'afternoon' | 'evening';
}

// ============================================
// World Clock API
// ============================================

export const worldClockApi = {
  async getWorldClock(): Promise<WorldClockCity[]> {
    const response = await api.get('/world-clock');
    return response.data;
  },

  async addCity(city: string, timezone: string): Promise<void> {
    await api.post('/world-clock/add', { city, timezone });
  },

  async removeCity(city: string): Promise<void> {
    await api.delete(`/world-clock/${encodeURIComponent(city)}`);
  },

  async convertTime(
    time: string,
    fromTimezone: string,
    toTimezone: string
  ): Promise<TimezoneConversion> {
    const response = await api.post('/convert-time', {
      time,
      from_timezone: fromTimezone,
      to_timezone: toTimezone
    });
    return response.data;
  },

  async searchTimezones(query: string): Promise<string[]> {
    const response = await api.get('/timezones/search', {
      params: { query }
    });
    return response.data;
  }
};

// ============================================
// Focus Time API
// ============================================

export const focusTimeApi = {
  async listBlocks(): Promise<FocusBlock[]> {
    const response = await api.get('/focus-blocks');
    return response.data;
  },

  async createBlock(data: FocusBlockCreate): Promise<FocusBlock> {
    const response = await api.post('/focus-blocks', data);
    return response.data;
  },

  async updateBlock(id: string, data: Partial<FocusBlockCreate>): Promise<FocusBlock> {
    const response = await api.patch(`/focus-blocks/${id}`, data);
    return response.data;
  },

  async deleteBlock(id: string): Promise<void> {
    await api.delete(`/focus-blocks/${id}`);
  },

  async getSuggestions(hours: number = 10): Promise<FocusBlock[]> {
    const response = await api.get('/focus-blocks/suggestions', {
      params: { hours_per_week: hours }
    });
    return response.data;
  },

  async autoSchedule(): Promise<FocusBlock[]> {
    const response = await api.post('/focus-blocks/auto-schedule');
    return response.data;
  }
};

// ============================================
// Time Insights API
// ============================================

export const timeInsightsApi = {
  async getInsights(
    period: 'week' | 'month' | 'quarter' = 'week'
  ): Promise<TimeInsightsReport> {
    const response = await api.get('/insights', {
      params: { period }
    });
    return response.data;
  },

  async getCategories(): Promise<{ category: string; color: string }[]> {
    const response = await api.get('/insights/categories');
    return response.data;
  }
};

// ============================================
// Settings API
// ============================================

export const calendarSettingsApi = {
  async getSettings(): Promise<CalendarEnhancedSettings> {
    const response = await api.get('/settings');
    return response.data;
  },

  async updateSettings(settings: Partial<CalendarEnhancedSettings>): Promise<CalendarEnhancedSettings> {
    const response = await api.patch('/settings', settings);
    return response.data;
  }
};

export default { worldClockApi, focusTimeApi, timeInsightsApi, calendarSettingsApi };
