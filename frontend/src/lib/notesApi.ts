/**
 * Bheem Notes API Client
 *
 * API calls for Notes management.
 */

const API_BASE = '/api/v1/notes';

// ===========================================
// Types
// ===========================================

export interface ChecklistItem {
  id: string;
  text: string;
  is_checked: boolean;
  order: number;
}

export interface NoteLabel {
  id: string;
  name: string;
  color: string | null;
}

export interface Note {
  id: string;
  title: string | null;
  content: string | null;
  content_html: string | null;
  color: string;
  is_pinned: boolean;
  is_archived: boolean;
  is_trashed: boolean;
  is_checklist: boolean;
  checklist_items: ChecklistItem[] | null;
  word_count: number;
  created_at: string;
  updated_at: string;
  labels: NoteLabel[];
}

export interface CreateNoteRequest {
  title?: string;
  content?: string;
  content_html?: string;
  color?: string;
  is_pinned?: boolean;
  is_checklist?: boolean;
  checklist_items?: ChecklistItem[];
  label_ids?: string[];
}

export interface UpdateNoteRequest {
  title?: string;
  content?: string;
  content_html?: string;
  color?: string;
  is_pinned?: boolean;
  is_checklist?: boolean;
  checklist_items?: ChecklistItem[];
  label_ids?: string[];
  position?: number;
}

export interface ListNotesParams {
  is_pinned?: boolean;
  is_archived?: boolean;
  is_trashed?: boolean;
  label_id?: string;
  search?: string;
  color?: string;
  sort_by?: 'created_at' | 'updated_at' | 'title';
  sort_order?: 'asc' | 'desc';
  skip?: number;
  limit?: number;
}

export interface NoteCounts {
  active: number;
  pinned: number;
  archived: number;
  trashed: number;
}

export interface SearchResult {
  query: string;
  count: number;
  results: Note[];
}

export interface SetReminderRequest {
  reminder_time: string;
  is_recurring?: boolean;
  recurrence_pattern?: 'daily' | 'weekly' | 'monthly';
}

export interface ShareNoteRequest {
  user_id: string;
  user_email: string;
  user_name?: string;
  permission?: 'view' | 'edit';
}

// ===========================================
// Helper Functions
// ===========================================

function getAuthHeaders(): HeadersInit {
  const token = typeof window !== 'undefined' ? localStorage.getItem('auth_token') : null;
  return {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

function buildUrl(endpoint: string, params?: Record<string, string | number | boolean | undefined>): string {
  const url = `${API_BASE}${endpoint}`;

  if (!params) return url;

  const searchParams = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null) {
      searchParams.append(key, String(value));
    }
  });

  const queryString = searchParams.toString();
  return queryString ? `${url}?${queryString}` : url;
}

// ===========================================
// Note API Functions
// ===========================================

export async function createNote(request: CreateNoteRequest): Promise<Note> {
  const response = await fetch(buildUrl(''), {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify(request),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.detail || 'Failed to create note');
  }

  return response.json();
}

export async function listNotes(params: ListNotesParams = {}): Promise<Note[]> {
  const response = await fetch(buildUrl('', params as Record<string, string | number | boolean | undefined>), {
    method: 'GET',
    headers: getAuthHeaders(),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.detail || 'Failed to list notes');
  }

  return response.json();
}

export async function getNote(noteId: string): Promise<Note> {
  const response = await fetch(buildUrl(`/${noteId}`), {
    method: 'GET',
    headers: getAuthHeaders(),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.detail || 'Failed to get note');
  }

  return response.json();
}

export async function updateNote(noteId: string, updates: UpdateNoteRequest): Promise<Note> {
  const response = await fetch(buildUrl(`/${noteId}`), {
    method: 'PUT',
    headers: getAuthHeaders(),
    body: JSON.stringify(updates),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.detail || 'Failed to update note');
  }

  return response.json();
}

export async function deleteNote(noteId: string, permanent: boolean = false): Promise<void> {
  const response = await fetch(buildUrl(`/${noteId}`, { permanent }), {
    method: 'DELETE',
    headers: getAuthHeaders(),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.detail || 'Failed to delete note');
  }
}

export async function getNoteCounts(): Promise<NoteCounts> {
  const response = await fetch(buildUrl('/count'), {
    method: 'GET',
    headers: getAuthHeaders(),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.detail || 'Failed to get note counts');
  }

  return response.json();
}

export async function searchNotes(
  query: string,
  includeArchived: boolean = false,
  includeTrashed: boolean = false,
): Promise<SearchResult> {
  const response = await fetch(buildUrl('/search', {
    q: query,
    include_archived: includeArchived,
    include_trashed: includeTrashed,
  }), {
    method: 'GET',
    headers: getAuthHeaders(),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.detail || 'Failed to search notes');
  }

  return response.json();
}

// ===========================================
// Note Action Functions
// ===========================================

export async function togglePin(noteId: string): Promise<Note> {
  const response = await fetch(buildUrl(`/${noteId}/pin`), {
    method: 'POST',
    headers: getAuthHeaders(),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.detail || 'Failed to toggle pin');
  }

  return response.json();
}

export async function archiveNote(noteId: string): Promise<Note> {
  const response = await fetch(buildUrl(`/${noteId}/archive`), {
    method: 'POST',
    headers: getAuthHeaders(),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.detail || 'Failed to archive note');
  }

  return response.json();
}

export async function unarchiveNote(noteId: string): Promise<Note> {
  const response = await fetch(buildUrl(`/${noteId}/unarchive`), {
    method: 'POST',
    headers: getAuthHeaders(),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.detail || 'Failed to unarchive note');
  }

  return response.json();
}

export async function restoreNote(noteId: string): Promise<Note> {
  const response = await fetch(buildUrl(`/${noteId}/restore`), {
    method: 'POST',
    headers: getAuthHeaders(),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.detail || 'Failed to restore note');
  }

  return response.json();
}

export async function changeNoteColor(noteId: string, color: string): Promise<Note> {
  const response = await fetch(buildUrl(`/${noteId}/color`, { color }), {
    method: 'POST',
    headers: getAuthHeaders(),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.detail || 'Failed to change color');
  }

  return response.json();
}

export async function copyNote(noteId: string): Promise<Note> {
  const response = await fetch(buildUrl(`/${noteId}/copy`), {
    method: 'POST',
    headers: getAuthHeaders(),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.detail || 'Failed to copy note');
  }

  return response.json();
}

// ===========================================
// Label Functions
// ===========================================

export async function listLabels(): Promise<NoteLabel[]> {
  const response = await fetch(buildUrl('/labels'), {
    method: 'GET',
    headers: getAuthHeaders(),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.detail || 'Failed to list labels');
  }

  return response.json();
}

export async function createLabel(name: string, color?: string): Promise<NoteLabel> {
  const response = await fetch(buildUrl('/labels'), {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify({ name, color }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.detail || 'Failed to create label');
  }

  return response.json();
}

export async function updateLabel(labelId: string, name?: string, color?: string): Promise<NoteLabel> {
  const response = await fetch(buildUrl(`/labels/${labelId}`), {
    method: 'PUT',
    headers: getAuthHeaders(),
    body: JSON.stringify({ name, color }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.detail || 'Failed to update label');
  }

  return response.json();
}

export async function deleteLabel(labelId: string): Promise<void> {
  const response = await fetch(buildUrl(`/labels/${labelId}`), {
    method: 'DELETE',
    headers: getAuthHeaders(),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.detail || 'Failed to delete label');
  }
}

// ===========================================
// Reminder Functions
// ===========================================

export async function setReminder(noteId: string, request: SetReminderRequest): Promise<void> {
  const response = await fetch(buildUrl(`/${noteId}/reminder`), {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify(request),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.detail || 'Failed to set reminder');
  }
}

export async function removeReminder(noteId: string): Promise<void> {
  const response = await fetch(buildUrl(`/${noteId}/reminder`), {
    method: 'DELETE',
    headers: getAuthHeaders(),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.detail || 'Failed to remove reminder');
  }
}

// ===========================================
// Sharing Functions
// ===========================================

export async function shareNote(noteId: string, request: ShareNoteRequest): Promise<void> {
  const response = await fetch(buildUrl(`/${noteId}/share`), {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify(request),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.detail || 'Failed to share note');
  }
}

export async function removeShare(noteId: string, userId: string): Promise<void> {
  const response = await fetch(buildUrl(`/${noteId}/share/${userId}`), {
    method: 'DELETE',
    headers: getAuthHeaders(),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.detail || 'Failed to remove share');
  }
}

// ===========================================
// Color Constants
// ===========================================

export const NOTE_COLORS = {
  default: { name: 'Default', value: '#ffffff', dark: '#202124' },
  red: { name: 'Red', value: '#f28b82', dark: '#5c2b29' },
  orange: { name: 'Orange', value: '#fbbc04', dark: '#614a19' },
  yellow: { name: 'Yellow', value: '#fff475', dark: '#635d19' },
  green: { name: 'Green', value: '#ccff90', dark: '#345920' },
  teal: { name: 'Teal', value: '#a7ffeb', dark: '#16504b' },
  blue: { name: 'Blue', value: '#cbf0f8', dark: '#2d555e' },
  purple: { name: 'Purple', value: '#aecbfa', dark: '#1e3a5f' },
  pink: { name: 'Pink', value: '#fdcfe8', dark: '#42275e' },
  brown: { name: 'Brown', value: '#e6c9a8', dark: '#442f19' },
  gray: { name: 'Gray', value: '#e8eaed', dark: '#3c3f43' },
} as const;

export type NoteColorKey = keyof typeof NOTE_COLORS;
