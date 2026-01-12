/**
 * Bheem Docs - Editor API Client
 * API integration for document editor features
 */
import axios from 'axios';

const api = axios.create({
  baseURL: '/api/v1',
  headers: {
    'Content-Type': 'application/json',
  },
  withCredentials: true,  // Send cookies with requests
});

// Add auth token to requests
api.interceptors.request.use((config) => {
  const token = typeof window !== 'undefined' ? localStorage.getItem('auth_token') : null;
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// ===========================================
// Document CRUD
// ===========================================

export interface Document {
  id: string;
  title: string;
  content: any;
  content_html?: string;
  is_favorite: boolean;
  is_shared: boolean;
  is_editable: boolean;
  template_id?: string;
  folder_id?: string;
  created_at: string;
  updated_at: string;
  owner: {
    id: string;
    name: string;
    email: string;
  };
  // File info for uploaded documents
  mime_type?: string;
  file_name?: string;
  file_size?: number;
  storage_path?: string;
  document_type?: string;
}

export const getDocument = async (documentId: string): Promise<Document> => {
  const response = await api.get(`/docs/editor/documents/${documentId}`);
  const data = response.data;
  // Map editor_content to content for frontend compatibility
  return {
    ...data,
    content: data.editor_content || data.content,
  };
};

export const createDocument = async (data: {
  title: string;
  content?: any;
  template_id?: string;
  folder_id?: string;
}): Promise<Document> => {
  const response = await api.post('/docs/editor/documents', data);
  return response.data;
};

export const saveDocument = async (documentId: string, content: any, createVersion = false): Promise<void> => {
  await api.put(`/docs/editor/documents/${documentId}/content`, {
    content,
    create_version: createVersion,
  });
};

export const updateDocumentTitle = async (documentId: string, title: string): Promise<void> => {
  await api.patch(`/docs/editor/documents/${documentId}`, { title });
};

export const deleteDocument = async (documentId: string): Promise<void> => {
  await api.delete(`/docs/editor/documents/${documentId}`);
};

export const duplicateDocument = async (documentId: string): Promise<Document> => {
  const response = await api.post(`/docs/editor/documents/${documentId}/duplicate`);
  return response.data;
};

export const moveDocument = async (documentId: string, folderId: string): Promise<void> => {
  await api.post(`/docs/editor/documents/${documentId}/move`, { folder_id: folderId });
};

export const toggleFavorite = async (documentId: string, isFavorite: boolean): Promise<void> => {
  await api.patch(`/docs/editor/documents/${documentId}`, { is_favorite: isFavorite });
};

// ===========================================
// Comments
// ===========================================

export interface Comment {
  id: string;
  content: string;
  user: {
    id: string;
    name: string;
    email: string;
    avatar?: string;
  };
  position?: {
    start: number;
    end: number;
  };
  selection_text?: string;
  replies: Comment[];
  reactions: { emoji: string; users: string[] }[];
  resolved: boolean;
  created_at: string;
  updated_at: string;
}

export const getComments = async (documentId: string): Promise<Comment[]> => {
  const response = await api.get(`/docs/comments/documents/${documentId}`);
  return response.data.comments || [];
};

export const addComment = async (
  documentId: string,
  content: string,
  position?: { start: number; end: number },
  selectionText?: string
): Promise<Comment> => {
  const response = await api.post(`/docs/comments/documents/${documentId}`, {
    content,
    position,
    selection_text: selectionText,
  });
  return response.data;
};

export const replyToComment = async (
  documentId: string,
  commentId: string,
  content: string
): Promise<Comment> => {
  const response = await api.post(`/docs/comments/${commentId}/reply`, {
    content,
  });
  return response.data;
};

export const resolveComment = async (documentId: string, commentId: string): Promise<void> => {
  await api.post(`/docs/comments/${commentId}/resolve`);
};

export const deleteComment = async (documentId: string, commentId: string): Promise<void> => {
  await api.delete(`/docs/comments/${commentId}`);
};

export const editComment = async (
  documentId: string,
  commentId: string,
  content: string
): Promise<void> => {
  await api.put(`/docs/comments/${commentId}`, { content });
};

export const addReaction = async (
  documentId: string,
  commentId: string,
  emoji: string
): Promise<void> => {
  await api.post(`/docs/comments/${commentId}/reactions`, { emoji });
};

// ===========================================
// Version History
// ===========================================

export interface Version {
  id: string;
  version_number: number;
  title: string;
  content: any;
  user: {
    id: string;
    name: string;
    avatar?: string;
  };
  created_at: string;
  size_bytes: number;
  is_auto_save: boolean;
  is_current: boolean;
}

export const getVersionHistory = async (documentId: string): Promise<Version[]> => {
  const response = await api.get(`/docs/editor/documents/${documentId}/versions`);
  return response.data.versions || [];
};

export const getVersion = async (documentId: string, versionId: string): Promise<Version> => {
  const response = await api.get(`/docs/editor/documents/${documentId}/versions/${versionId}`);
  return response.data;
};

export const restoreVersion = async (documentId: string, versionId: string): Promise<void> => {
  await api.post(`/docs/editor/documents/${documentId}/versions/${versionId}/restore`);
};

export const createNamedVersion = async (documentId: string, title: string): Promise<Version> => {
  const response = await api.post(`/docs/editor/documents/${documentId}/versions`, { title });
  return response.data;
};

// ===========================================
// Templates
// ===========================================

export interface Template {
  id: string;
  name: string;
  description?: string;
  content: any;
  thumbnail_url?: string;
  category: string;
  is_public: boolean;
  created_at: string;
  updated_at: string;
}

export const getTemplates = async (category?: string): Promise<Template[]> => {
  const params = category ? { category } : {};
  const response = await api.get('/docs/editor/templates', { params });
  return response.data.templates || [];
};

export const getTemplate = async (templateId: string): Promise<Template> => {
  const response = await api.get(`/docs/editor/templates/${templateId}`);
  return response.data;
};

export const createFromTemplate = async (templateId: string, title: string): Promise<Document> => {
  const response = await api.post(`/docs/editor/templates/${templateId}/create`, { title });
  return response.data;
};

export const saveAsTemplate = async (
  documentId: string,
  name: string,
  description?: string,
  category?: string
): Promise<Template> => {
  const response = await api.post(`/docs/editor/documents/${documentId}/save-as-template`, {
    name,
    description,
    category,
  });
  return response.data;
};

// ===========================================
// Export
// ===========================================

export type ExportFormat = 'pdf' | 'docx' | 'html' | 'markdown' | 'txt';

export const exportDocument = async (
  documentId: string,
  format: ExportFormat
): Promise<Blob> => {
  const response = await api.post(`/docs/editor/documents/${documentId}/export`, {
    format,
  }, {
    responseType: 'blob',
  });
  return response.data;
};

// Get file download URL for uploaded documents
export const getFileDownloadUrl = async (documentId: string): Promise<string> => {
  const response = await api.get(`/docs/editor/documents/${documentId}/download-url`);
  return response.data.url;
};

// Get file content for text files (CSV, TXT, etc.)
export const getFileContent = async (documentId: string): Promise<string> => {
  const response = await api.get(`/docs/editor/documents/${documentId}/file-content`);
  return response.data.content;
};

// ===========================================
// AI Features
// ===========================================

export interface AIResult {
  result: string;
  tokens_used?: number;
}

export const summarizeText = async (
  documentId: string,
  text: string,
  style: 'concise' | 'detailed' | 'bullet_points' = 'concise'
): Promise<AIResult> => {
  const response = await api.post('/docs/ai/summarize', {
    document_id: documentId,
    text,
    style,
  });
  return response.data;
};

export const improveWriting = async (
  documentId: string,
  text: string,
  style: 'professional' | 'casual' | 'academic' | 'concise' = 'professional'
): Promise<AIResult> => {
  const response = await api.post('/docs/ai/improve', {
    document_id: documentId,
    text,
    style,
  });
  return response.data;
};

export const translateText = async (
  documentId: string,
  text: string,
  targetLanguage: string
): Promise<AIResult> => {
  const response = await api.post('/docs/ai/translate', {
    document_id: documentId,
    text,
    target_language: targetLanguage,
  });
  return response.data;
};

export const extractKeywords = async (
  documentId: string,
  text?: string
): Promise<{ keywords: string[] }> => {
  const response = await api.post('/docs/ai/keywords', {
    document_id: documentId,
    text,
  });
  return response.data;
};

export const suggestTags = async (
  documentId: string
): Promise<{ tags: string[] }> => {
  const response = await api.post('/docs/ai/suggest-tags', {
    document_id: documentId,
  });
  return response.data;
};

export const generateContent = async (
  documentId: string,
  prompt: string,
  style: string = 'professional'
): Promise<AIResult> => {
  const response = await api.post('/docs/ai/generate', {
    document_id: documentId,
    prompt,
    style,
  });
  return response.data;
};

// ===========================================
// Collaboration
// ===========================================

export interface CollaborationSession {
  session_id: string;
  document_id: string;
  users: {
    id: string;
    name: string;
    email: string;
    color: string;
    cursor_position?: number;
    is_editing: boolean;
  }[];
}

export const joinCollaboration = async (documentId: string): Promise<CollaborationSession> => {
  const response = await api.post(`/docs/collaboration/${documentId}/join`);
  return response.data;
};

export const leaveCollaboration = async (documentId: string): Promise<void> => {
  await api.post(`/docs/collaboration/${documentId}/leave`);
};

export const getCollaborators = async (documentId: string): Promise<CollaborationSession['users']> => {
  const response = await api.get(`/docs/collaboration/${documentId}/users`);
  return response.data.users || [];
};

// ===========================================
// Sharing
// ===========================================

export interface ShareSettings {
  is_public: boolean;
  access_level: 'view' | 'comment' | 'edit';
  shared_with: {
    type: 'user' | 'group' | 'email';
    id?: string;
    email?: string;
    access_level: 'view' | 'comment' | 'edit';
  }[];
  share_link?: string;
  link_expires_at?: string;
}

export const getShareSettings = async (documentId: string): Promise<ShareSettings> => {
  const response = await api.get(`/docs/editor/documents/${documentId}/share`);
  return response.data;
};

export const updateShareSettings = async (
  documentId: string,
  settings: Partial<ShareSettings>
): Promise<ShareSettings> => {
  const response = await api.put(`/docs/editor/documents/${documentId}/share`, settings);
  return response.data;
};

export const createShareLink = async (
  documentId: string,
  accessLevel: 'view' | 'comment' | 'edit',
  expiresInDays?: number
): Promise<{ share_link: string; expires_at?: string }> => {
  const response = await api.post(`/docs/editor/documents/${documentId}/share/link`, {
    access_level: accessLevel,
    expires_in_days: expiresInDays,
  });
  return response.data;
};

export const revokeShareLink = async (documentId: string): Promise<void> => {
  await api.delete(`/docs/editor/documents/${documentId}/share/link`);
};

// ===========================================
// Workflow
// ===========================================

export interface WorkflowStatus {
  status: 'draft' | 'pending_review' | 'approved' | 'rejected';
  submitted_at?: string;
  reviewed_at?: string;
  submitted_by?: { id: string; name: string };
  reviewed_by?: { id: string; name: string };
  comments?: string;
}

export const getWorkflowStatus = async (documentId: string): Promise<WorkflowStatus> => {
  const response = await api.get(`/docs/workflow/${documentId}/status`);
  return response.data;
};

export const submitForApproval = async (
  documentId: string,
  approvers: string[],
  message?: string
): Promise<void> => {
  await api.post(`/docs/workflow/${documentId}/submit`, {
    approvers,
    message,
  });
};

export const approveDocument = async (
  documentId: string,
  comments?: string
): Promise<void> => {
  await api.post(`/docs/workflow/${documentId}/approve`, { comments });
};

export const rejectDocument = async (
  documentId: string,
  reason: string
): Promise<void> => {
  await api.post(`/docs/workflow/${documentId}/reject`, { reason });
};
