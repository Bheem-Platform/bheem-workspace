/**
 * Bheem Workspace - Meeting AI API Client
 *
 * Frontend API client for AI meeting summaries, action items, and highlights.
 * Phase 11: AI Meeting Summaries
 */

import { api as baseApi } from '@/lib/api';

// Create a wrapper that prepends the meet/ai path
const api = {
  get: (url: string, config?: any) => baseApi.get(`/meet/ai${url}`, config),
  post: (url: string, data?: any, config?: any) => baseApi.post(`/meet/ai${url}`, data, config),
  put: (url: string, data?: any, config?: any) => baseApi.put(`/meet/ai${url}`, data, config),
  patch: (url: string, data?: any, config?: any) => baseApi.patch(`/meet/ai${url}`, data, config),
  delete: (url: string, config?: any) => baseApi.delete(`/meet/ai${url}`, config),
};

// ============================================
// Types - Meeting Summary
// ============================================

export interface MeetingSummary {
  id: string;
  meeting_id: string;
  title?: string;
  summary?: string;
  key_points: string[];
  decisions: string[];
  topics: Array<{
    topic: string;
    duration_minutes?: number;
    participants?: string[];
  }>;
  overall_sentiment?: string;
  engagement_score?: number;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  meeting_date?: string;
  created_at: string;
}

export interface SummaryCreate {
  meeting_id: string;
  title: string;
  summary: string;
  key_points?: string[];
  decisions?: string[];
  topics?: Array<{ topic: string; duration_minutes?: number }>;
  meeting_date?: Date;
}

// ============================================
// Types - Action Items
// ============================================

export interface ActionItem {
  id: string;
  meeting_id: string;
  title: string;
  description?: string;
  priority: 'low' | 'medium' | 'high' | 'urgent';
  assignee_id?: string;
  assignee_name?: string;
  due_date?: string;
  status: 'open' | 'in_progress' | 'completed' | 'cancelled';
  completed_at?: string;
  context?: string;
  confidence_score?: number;
  created_at: string;
}

export interface ActionItemCreate {
  meeting_id: string;
  summary_id: string;
  title: string;
  description?: string;
  priority?: 'low' | 'medium' | 'high' | 'urgent';
  assignee_id?: string;
  assignee_name?: string;
  assignee_email?: string;
  due_date?: Date;
}

export interface ActionItemUpdate {
  title?: string;
  description?: string;
  priority?: string;
  assignee_id?: string;
  assignee_name?: string;
  due_date?: Date;
  status?: string;
}

// ============================================
// Types - Highlights
// ============================================

export interface MeetingHighlight {
  id: string;
  meeting_id: string;
  highlight_type: 'decision' | 'question' | 'concern' | 'agreement' | 'action' | 'important';
  title?: string;
  content: string;
  timestamp_seconds?: number;
  participants: Array<{ id?: string; name: string }>;
  is_bookmarked: boolean;
  confidence_score?: number;
  created_at: string;
}

// ============================================
// Types - Analysis
// ============================================

export interface AnalyzeRequest {
  meeting_id: string;
  transcript: string;
  participants?: Array<{ id?: string; name: string; email?: string }>;
}

// ============================================
// Summary API
// ============================================

export const summaryApi = {
  async create(data: SummaryCreate): Promise<MeetingSummary> {
    const response = await api.post('/summaries', {
      ...data,
      meeting_date: data.meeting_date?.toISOString()
    });
    return response.data;
  },

  async list(
    startDate?: Date,
    endDate?: Date,
    skip = 0,
    limit = 20
  ): Promise<MeetingSummary[]> {
    const response = await api.get('/summaries', {
      params: {
        start_date: startDate?.toISOString(),
        end_date: endDate?.toISOString(),
        skip,
        limit
      }
    });
    return response.data;
  },

  async get(summaryId: string): Promise<MeetingSummary> {
    const response = await api.get(`/summaries/${summaryId}`);
    return response.data;
  },

  async getMeetingSummary(meetingId: string): Promise<MeetingSummary | null> {
    const response = await api.get(`/meetings/${meetingId}/summary`);
    return response.data;
  },

  async share(summaryId: string, userIds: string[]): Promise<void> {
    await api.post(`/summaries/${summaryId}/share`, { user_ids: userIds });
  }
};

// ============================================
// Action Items API
// ============================================

export const actionItemsApi = {
  async create(data: ActionItemCreate): Promise<ActionItem> {
    const response = await api.post('/action-items', {
      ...data,
      due_date: data.due_date?.toISOString()
    });
    return response.data;
  },

  async list(
    meetingId?: string,
    summaryId?: string,
    status?: string
  ): Promise<ActionItem[]> {
    const response = await api.get('/action-items', {
      params: { meeting_id: meetingId, summary_id: summaryId, status }
    });
    return response.data;
  },

  async getMyItems(includeCompleted = false): Promise<ActionItem[]> {
    const response = await api.get('/action-items/my', {
      params: { include_completed: includeCompleted }
    });
    return response.data;
  },

  async update(actionItemId: string, data: ActionItemUpdate): Promise<ActionItem> {
    const response = await api.patch(`/action-items/${actionItemId}`, {
      ...data,
      due_date: data.due_date?.toISOString()
    });
    return response.data;
  },

  async complete(actionItemId: string): Promise<void> {
    await api.post(`/action-items/${actionItemId}/complete`);
  }
};

// ============================================
// Highlights API
// ============================================

export const highlightsApi = {
  async getMeetingHighlights(
    meetingId: string,
    highlightType?: string
  ): Promise<MeetingHighlight[]> {
    const response = await api.get(`/meetings/${meetingId}/highlights`, {
      params: { highlight_type: highlightType }
    });
    return response.data;
  },

  async bookmark(highlightId: string): Promise<void> {
    await api.post(`/highlights/${highlightId}/bookmark`);
  }
};

// ============================================
// Analysis API
// ============================================

export const analysisApi = {
  async analyze(data: AnalyzeRequest): Promise<MeetingSummary> {
    const response = await api.post('/analyze', data);
    return response.data;
  }
};

export default { summaryApi, actionItemsApi, highlightsApi, analysisApi };
