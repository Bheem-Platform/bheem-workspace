import { api } from './api';
import type {
  Email,
  MailFolder,
  SendEmailRequest,
  EmailListResponse,
  MailLoginResponse,
} from '@/types/mail';

// ===========================================
// Session Management (Secure - Phase 1.1)
// ===========================================

export interface MailSessionResponse {
  success: boolean;
  message: string;
  email?: string;
  session_id?: string;
  expires_in_seconds?: number;
  folders?: string[];
}

export interface MailSessionStatus {
  active: boolean;
  email?: string;
  expires_in_seconds?: number;
  session_id?: string;
  message?: string;
}

/**
 * Create a secure mail session.
 * Credentials are sent in the request body (not URL) and stored
 * encrypted on the server. The frontend only stores session status.
 */
export const createMailSession = async (
  email: string,
  password: string
): Promise<MailSessionResponse> => {
  const response = await api.post('/mail/session/create', {
    email,
    password,
  });
  return response.data;
};

/**
 * Check mail session status.
 */
export const getMailSessionStatus = async (): Promise<MailSessionStatus> => {
  const response = await api.get('/mail/session/status');
  return response.data;
};

/**
 * Refresh mail session TTL.
 */
export const refreshMailSession = async (): Promise<{ success: boolean; expires_in_seconds: number }> => {
  const response = await api.post('/mail/session/refresh');
  return response.data;
};

/**
 * Destroy mail session (logout from mail).
 */
export const destroyMailSession = async (): Promise<{ success: boolean; message: string }> => {
  const response = await api.delete('/mail/session');
  return response.data;
};

// ===========================================
// Legacy login (deprecated - uses session internally)
// ===========================================

/**
 * @deprecated Use createMailSession instead
 */
export const loginMail = async (email: string, password: string): Promise<MailLoginResponse> => {
  const response = await api.post('/mail/session/create', {
    email,
    password,
  });
  return response.data;
};

// ===========================================
// Folders (Session-based)
// ===========================================

export const getFolders = async (): Promise<{ folders: string[] }> => {
  const response = await api.get('/mail/folders');
  return response.data;
};

// ===========================================
// Messages (Session-based)
// ===========================================

export const getMessages = async (
  folder: string = 'INBOX',
  page: number = 1,
  limit: number = 50
): Promise<EmailListResponse> => {
  const response = await api.get('/mail/messages', {
    params: { folder, page, limit },
  });
  return response.data;
};

export const getInbox = async (
  folder: string = 'INBOX',
  page: number = 1,
  limit: number = 50
): Promise<EmailListResponse> => {
  const response = await api.get('/mail/inbox', {
    params: { folder, page, limit },
  });
  return response.data;
};

export const getMessage = async (
  messageId: string,
  folder: string = 'INBOX'
): Promise<Email> => {
  const response = await api.get(`/mail/messages/${messageId}`, {
    params: { folder },
  });
  return response.data;
};

// ===========================================
// Send Email (Session-based)
// ===========================================

export const sendEmail = async (
  data: SendEmailRequest
): Promise<{ success: boolean; message: string; from?: string; to?: string[] }> => {
  const response = await api.post('/mail/send', {
    to: data.to,
    cc: data.cc || [],
    bcc: data.bcc || [],
    subject: data.subject,
    body: data.body,
    is_html: data.isHtml ?? true,
    in_reply_to: data.inReplyTo,
  });
  return response.data;
};

// ===========================================
// Email Actions (Session-based)
// ===========================================

export const moveEmail = async (
  messageId: string,
  fromFolder: string,
  toFolder: string
): Promise<{ success: boolean }> => {
  const response = await api.post(`/mail/messages/${messageId}/move`, {
    from_folder: fromFolder,
    to_folder: toFolder,
  });
  return response.data;
};

export const deleteEmail = async (
  messageId: string,
  folder: string = 'INBOX'
): Promise<{ success: boolean }> => {
  const response = await api.delete(`/mail/messages/${messageId}`, {
    params: { folder },
  });
  return response.data;
};

export const markAsRead = async (
  messageId: string,
  isRead: boolean
): Promise<{ success: boolean }> => {
  const response = await api.patch(`/mail/messages/${messageId}`, {
    is_read: isRead,
  });
  return response.data;
};

export const toggleStar = async (
  messageId: string,
  isStarred: boolean
): Promise<{ success: boolean }> => {
  const response = await api.patch(`/mail/messages/${messageId}`, {
    is_starred: isStarred,
  });
  return response.data;
};

// ===========================================
// Search (Phase 2.2)
// ===========================================

export interface SearchResponse {
  query: string;
  folder: string;
  count: number;
  results: Email[];
  by_folder?: Record<string, number>;
}

export interface ConversationSearchResponse {
  query: string;
  folder: string;
  conversation_count: number;
  conversations: Conversation[];
}

/**
 * Search emails using IMAP SEARCH.
 * @param query - Search query string
 * @param folder - Folder to search (null for all folders)
 * @param searchIn - Fields to search: 'subject', 'from', 'to', 'body', 'all'
 * @param limit - Maximum results
 */
export const searchEmails = async (
  query: string,
  folder?: string,
  searchIn: string = 'all',
  limit: number = 50
): Promise<SearchResponse> => {
  const response = await api.get('/mail/search', {
    params: {
      query,
      folder: folder || undefined,
      search_in: searchIn,
      limit,
    },
  });
  return response.data;
};

/**
 * Search emails with POST body (for complex queries).
 */
export const searchEmailsAdvanced = async (params: {
  query: string;
  folder?: string;
  searchIn?: string[];
  limit?: number;
}): Promise<SearchResponse> => {
  const response = await api.post('/mail/search', {
    query: params.query,
    folder: params.folder,
    search_in: params.searchIn || ['all'],
    limit: params.limit || 50,
  });
  return response.data;
};

/**
 * Search emails and return results grouped into conversations.
 */
export const searchConversations = async (
  query: string,
  folder?: string,
  limit: number = 50
): Promise<ConversationSearchResponse> => {
  const response = await api.get('/mail/search/conversations', {
    params: {
      query,
      folder: folder || undefined,
      limit,
    },
  });
  return response.data;
};

// ===========================================
// Conversation Threading (Phase 2.1)
// ===========================================

export interface Conversation {
  thread_id: string;
  subject: string;
  message_count: number;
  participants: string[];
  latest_date: string;
  oldest_date: string;
  preview: string;
  has_unread: boolean;
  messages: Email[];
}

export interface ConversationsResponse {
  folder: string;
  total_conversations: number;
  page: number;
  limit: number;
  conversations: Conversation[];
}

/**
 * Get emails grouped into threaded conversations.
 */
export const getConversations = async (
  folder: string = 'INBOX',
  page: number = 1,
  limit: number = 50
): Promise<ConversationsResponse> => {
  const response = await api.get('/mail/conversations', {
    params: { folder, page, limit },
  });
  return response.data;
};

/**
 * Get a single conversation thread by ID.
 */
export const getConversation = async (
  threadId: string,
  folder: string = 'INBOX'
): Promise<Conversation> => {
  const response = await api.get(`/mail/conversations/${encodeURIComponent(threadId)}`, {
    params: { folder },
  });
  return response.data;
};

/**
 * Get all messages in the same thread as the specified message.
 */
export const getMessageThread = async (
  messageId: string,
  folder: string = 'INBOX'
): Promise<{ thread_id: string; message_count: number; messages: Email[] }> => {
  const response = await api.get(`/mail/messages/${messageId}/thread`, {
    params: { folder },
  });
  return response.data;
};

// ===========================================
// Drafts (Phase 2.3)
// ===========================================

export interface DraftAddress {
  name?: string;
  email: string;
}

export interface Draft {
  id: string;
  subject: string;
  body: string;
  is_html: boolean;
  to_addresses: DraftAddress[];
  cc_addresses: DraftAddress[];
  bcc_addresses: DraftAddress[];
  attachments: any[];
  reply_to_message_id?: string;
  forward_message_id?: string;
  reply_type?: 'reply' | 'reply_all' | 'forward';
  created_at?: string;
  updated_at?: string;
}

export interface DraftListResponse {
  drafts: Draft[];
  total: number;
  page: number;
  limit: number;
}

/**
 * Create a new draft.
 */
export const createDraft = async (draft: Partial<Draft>): Promise<Draft> => {
  const response = await api.post('/mail/drafts', {
    subject: draft.subject || '',
    body: draft.body || '',
    is_html: draft.is_html ?? true,
    to_addresses: draft.to_addresses || [],
    cc_addresses: draft.cc_addresses || [],
    bcc_addresses: draft.bcc_addresses || [],
    attachments: draft.attachments || [],
    reply_to_message_id: draft.reply_to_message_id,
    forward_message_id: draft.forward_message_id,
    reply_type: draft.reply_type,
  });
  return response.data;
};

/**
 * Update an existing draft.
 */
export const updateDraft = async (
  draftId: string,
  updates: Partial<Draft>
): Promise<Draft> => {
  const response = await api.put(`/mail/drafts/${draftId}`, updates);
  return response.data;
};

/**
 * Get a single draft by ID.
 */
export const getDraft = async (draftId: string): Promise<Draft> => {
  const response = await api.get(`/mail/drafts/${draftId}`);
  return response.data;
};

/**
 * List all drafts.
 */
export const listDrafts = async (
  page: number = 1,
  limit: number = 50
): Promise<DraftListResponse> => {
  const response = await api.get('/mail/drafts', {
    params: { page, limit },
  });
  return response.data;
};

/**
 * Delete a draft.
 */
export const deleteDraft = async (
  draftId: string
): Promise<{ success: boolean }> => {
  const response = await api.delete(`/mail/drafts/${draftId}`);
  return response.data;
};

/**
 * Send a draft as an email.
 */
export const sendDraft = async (
  draftId: string
): Promise<{ success: boolean; to: string[] }> => {
  const response = await api.post(`/mail/drafts/${draftId}/send`);
  return response.data;
};

// ===========================================
// Signatures (Phase 2.4)
// ===========================================

export interface Signature {
  id: string;
  name: string;
  content: string;
  is_html: boolean;
  is_default: boolean;
  created_at?: string;
  updated_at?: string;
}

export interface SignatureListResponse {
  signatures: Signature[];
  count: number;
}

/**
 * Create a new email signature.
 */
export const createSignature = async (signature: {
  name: string;
  content: string;
  is_html?: boolean;
  is_default?: boolean;
}): Promise<Signature> => {
  const response = await api.post('/mail/signatures', signature);
  return response.data;
};

/**
 * Update an existing signature.
 */
export const updateSignature = async (
  signatureId: string,
  updates: Partial<Signature>
): Promise<Signature> => {
  const response = await api.put(`/mail/signatures/${signatureId}`, updates);
  return response.data;
};

/**
 * Get a single signature by ID.
 */
export const getSignature = async (signatureId: string): Promise<Signature> => {
  const response = await api.get(`/mail/signatures/${signatureId}`);
  return response.data;
};

/**
 * Get the default signature.
 */
export const getDefaultSignature = async (): Promise<Signature | null> => {
  const response = await api.get('/mail/signatures/default');
  return response.data;
};

/**
 * List all signatures.
 */
export const listSignatures = async (): Promise<SignatureListResponse> => {
  const response = await api.get('/mail/signatures');
  return response.data;
};

/**
 * Delete a signature.
 */
export const deleteSignature = async (
  signatureId: string
): Promise<{ success: boolean }> => {
  const response = await api.delete(`/mail/signatures/${signatureId}`);
  return response.data;
};

/**
 * Set a signature as the default.
 */
export const setDefaultSignature = async (
  signatureId: string
): Promise<{ success: boolean }> => {
  const response = await api.post(`/mail/signatures/${signatureId}/set-default`);
  return response.data;
};

// ===========================================
// Attachments (Session-based)
// ===========================================

export const getAttachment = async (
  messageId: string,
  attachmentId: string
): Promise<Blob> => {
  const response = await api.get(
    `/mail/messages/${messageId}/attachments/${attachmentId}`,
    {
      responseType: 'blob',
    }
  );
  return response.data;
};

// ===========================================
// Transactional Email (via Notify service)
// These don't use mail session - they use app auth
// ===========================================

export const sendTransactionalEmail = async (data: {
  to: string[];
  subject: string;
  body: string;
  cc?: string[];
  bcc?: string[];
  replyTo?: string;
  isHtml?: boolean;
}): Promise<{ success: boolean; message_id?: string }> => {
  const response = await api.post('/mail/bheem-tele/send', data);
  return response.data;
};

export const sendWelcomeEmail = async (data: {
  to: string;
  userName: string;
  workspaceName: string;
  loginUrl: string;
}): Promise<{ success: boolean }> => {
  const response = await api.post('/mail/bheem-tele/welcome', {
    to: data.to,
    user_name: data.userName,
    workspace_name: data.workspaceName,
    login_url: data.loginUrl,
  });
  return response.data;
};

export const sendMeetingInvite = async (data: {
  to: string[];
  meetingName: string;
  hostName: string;
  meetingUrl: string;
  scheduledTime?: string;
}): Promise<{ success: boolean }> => {
  const response = await api.post('/mail/bheem-tele/meeting-invite', {
    to: data.to,
    meeting_name: data.meetingName,
    host_name: data.hostName,
    meeting_url: data.meetingUrl,
    scheduled_time: data.scheduledTime,
  });
  return response.data;
};

// ===========================================
// Scheduled Emails (Phase 3.1)
// ===========================================

export interface ScheduledEmail {
  id: string;
  scheduled_at: string;
  status: 'pending' | 'sent' | 'cancelled' | 'failed';
  email_data: {
    to: string[];
    cc?: string[];
    bcc?: string[];
    subject: string;
    body: string;
    is_html?: boolean;
  };
  sent_at?: string;
  error_message?: string;
  created_at?: string;
}

export interface ScheduledEmailListResponse {
  scheduled_emails: ScheduledEmail[];
  count: number;
}

/**
 * Schedule an email for future delivery.
 */
export const scheduleEmail = async (data: {
  scheduled_at: string; // ISO datetime string
  to: string[];
  cc?: string[];
  bcc?: string[];
  subject: string;
  body: string;
  is_html?: boolean;
}): Promise<ScheduledEmail> => {
  const response = await api.post('/mail/scheduled', {
    scheduled_at: data.scheduled_at,
    to: data.to,
    cc: data.cc || [],
    bcc: data.bcc || [],
    subject: data.subject,
    body: data.body,
    is_html: data.is_html ?? true,
  });
  return response.data;
};

/**
 * List scheduled emails.
 */
export const listScheduledEmails = async (
  status?: 'pending' | 'sent' | 'cancelled' | 'failed',
  limit: number = 50
): Promise<ScheduledEmailListResponse> => {
  const response = await api.get('/mail/scheduled', {
    params: { status, limit },
  });
  return response.data;
};

/**
 * Get a single scheduled email by ID.
 */
export const getScheduledEmail = async (
  scheduledId: string
): Promise<ScheduledEmail> => {
  const response = await api.get(`/mail/scheduled/${scheduledId}`);
  return response.data;
};

/**
 * Update a scheduled email.
 */
export const updateScheduledEmail = async (
  scheduledId: string,
  updates: {
    scheduled_at?: string;
    to?: string[];
    cc?: string[];
    bcc?: string[];
    subject?: string;
    body?: string;
    is_html?: boolean;
  }
): Promise<ScheduledEmail> => {
  const response = await api.put(`/mail/scheduled/${scheduledId}`, updates);
  return response.data;
};

/**
 * Cancel a scheduled email.
 */
export const cancelScheduledEmail = async (
  scheduledId: string
): Promise<{ success: boolean; message: string }> => {
  const response = await api.delete(`/mail/scheduled/${scheduledId}`);
  return response.data;
};

/**
 * Send a scheduled email immediately.
 */
export const sendScheduledNow = async (
  scheduledId: string
): Promise<{ success: boolean; message: string; to: string[] }> => {
  const response = await api.post(`/mail/scheduled/${scheduledId}/send-now`);
  return response.data;
};

// ===========================================
// Undo Send (Phase 3.2) - Client-side implementation
// ===========================================

export interface SendWithUndoResponse {
  success: boolean;
  message: string;
  queue_id: string;
  send_at: string;
  delay_seconds: number;
  can_undo: boolean;
}

export interface QueuedEmailStatus {
  queue_id: string;
  status: 'pending' | 'sent' | 'cancelled' | 'failed';
  send_at: string;
  remaining_seconds: number;
  can_undo: boolean;
  email_data: {
    to: string[];
    cc?: string[];
    bcc?: string[];
    subject: string;
    body: string;
    is_html?: boolean;
    attachments?: Array<{ filename: string; content_type: string; content: string }>;
  };
}

// Client-side queue for undo functionality
interface QueuedEmail {
  queue_id: string;
  email_data: {
    to: string[];
    cc?: string[];
    bcc?: string[];
    subject: string;
    body: string;
    is_html?: boolean;
    attachments?: Array<{ filename: string; content_type: string; content: string }>;
  };
  send_at: Date;
  delay_seconds: number;
  status: 'pending' | 'sent' | 'cancelled' | 'failed';
  timeout_id?: ReturnType<typeof setTimeout>;
}

const emailQueue = new Map<string, QueuedEmail>();

/**
 * Convert a File to base64 encoded string
 */
const fileToBase64 = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => {
      const result = reader.result as string;
      // Remove the data:mime/type;base64, prefix
      const base64 = result.split(',')[1];
      resolve(base64);
    };
    reader.onerror = (error) => reject(error);
  });
};

/**
 * Generate a unique queue ID
 */
const generateQueueId = (): string => {
  return `queue_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
};

/**
 * Send an email with undo capability.
 * Uses client-side delay with /mail/send endpoint.
 * Supports file attachments converted to base64.
 */
export const sendEmailWithUndo = async (data: {
  to: string[];
  cc?: string[];
  bcc?: string[];
  subject: string;
  body: string;
  is_html?: boolean;
  delay_seconds?: number; // Default 5, max 120
  attachments?: File[];
}): Promise<SendWithUndoResponse> => {
  const queueId = generateQueueId();
  const delaySeconds = Math.min(Math.max(5, data.delay_seconds || 5), 120);
  const sendAt = new Date(Date.now() + delaySeconds * 1000);

  // Convert File attachments to base64 format
  let attachmentsData: Array<{ filename: string; content_type: string; content: string }> | undefined;
  if (data.attachments && data.attachments.length > 0) {
    attachmentsData = await Promise.all(
      data.attachments.map(async (file) => ({
        filename: file.name,
        content_type: file.type || 'application/octet-stream',
        content: await fileToBase64(file),
      }))
    );
  }

  // Build email data
  const emailData = {
    to: data.to,
    cc: data.cc || [],
    bcc: data.bcc || [],
    subject: data.subject,
    body: data.body,
    is_html: data.is_html ?? true,
    attachments: attachmentsData,
  };

  // Create queued email entry
  const queuedEmail: QueuedEmail = {
    queue_id: queueId,
    email_data: emailData,
    send_at: sendAt,
    delay_seconds: delaySeconds,
    status: 'pending',
  };

  // Set timeout to actually send the email
  queuedEmail.timeout_id = setTimeout(async () => {
    const entry = emailQueue.get(queueId);
    if (entry && entry.status === 'pending') {
      try {
        // Use the /mail/send endpoint with base64 attachments
        await api.post('/mail/send', entry.email_data);
        entry.status = 'sent';
      } catch (error) {
        entry.status = 'failed';
        console.error('Failed to send queued email:', error);
      }
    }
  }, delaySeconds * 1000);

  // Store in queue
  emailQueue.set(queueId, queuedEmail);

  return {
    success: true,
    message: `Email queued. Will be sent in ${delaySeconds} seconds unless cancelled.`,
    queue_id: queueId,
    send_at: sendAt.toISOString(),
    delay_seconds: delaySeconds,
    can_undo: true,
  };
};

/**
 * Get the status of a queued email.
 */
export const getQueuedEmailStatus = async (
  queueId: string
): Promise<QueuedEmailStatus> => {
  const entry = emailQueue.get(queueId);

  if (!entry) {
    throw new Error('Queued email not found');
  }

  const now = new Date();
  const remainingSeconds = Math.max(0, Math.floor((entry.send_at.getTime() - now.getTime()) / 1000));

  return {
    queue_id: entry.queue_id,
    status: entry.status,
    send_at: entry.send_at.toISOString(),
    remaining_seconds: remainingSeconds,
    can_undo: entry.status === 'pending' && remainingSeconds > 0,
    email_data: entry.email_data,
  };
};

/**
 * Cancel (undo) a queued email before it's sent.
 */
export const undoSend = async (
  queueId: string
): Promise<{ success: boolean; message: string; email_data?: any }> => {
  const entry = emailQueue.get(queueId);

  if (!entry) {
    return { success: false, message: 'Queued email not found' };
  }

  if (entry.status !== 'pending') {
    return { success: false, message: `Cannot cancel email with status: ${entry.status}` };
  }

  // Clear the timeout to prevent sending
  if (entry.timeout_id) {
    clearTimeout(entry.timeout_id);
  }

  entry.status = 'cancelled';

  return {
    success: true,
    message: 'Email cancelled successfully. Your draft has been preserved.',
    email_data: entry.email_data,
  };
};

/**
 * Clean up old entries from the queue (call periodically)
 */
export const cleanupEmailQueue = (): void => {
  const now = Date.now();
  const maxAge = 10 * 60 * 1000; // 10 minutes

  emailQueue.forEach((entry, queueId) => {
    if (entry.status !== 'pending' && now - entry.send_at.getTime() > maxAge) {
      emailQueue.delete(queueId);
    }
  });
};

// ===========================================
// Email Filters (Phase 3.3)
// ===========================================

export interface FilterCondition {
  field: 'from' | 'to' | 'cc' | 'subject' | 'body' | 'has_attachment';
  operator: 'contains' | 'not_contains' | 'equals' | 'not_equals' | 'starts_with' | 'ends_with' | 'matches_regex';
  value: string;
}

export interface FilterAction {
  action: 'move_to' | 'mark_as_read' | 'mark_as_starred' | 'apply_label' | 'delete' | 'forward_to' | 'skip_inbox' | 'never_spam';
  value?: string;
}

export interface MailFilter {
  id: string;
  name: string;
  is_enabled: boolean;
  priority: number;
  stop_processing: boolean;
  conditions: FilterCondition[];
  actions: FilterAction[];
  created_at?: string;
  updated_at?: string;
}

export interface FilterListResponse {
  filters: MailFilter[];
  count: number;
}

export interface FilterOptionsResponse {
  condition_fields: string[];
  condition_operators: string[];
  filter_actions: string[];
}

/**
 * Get available filter options (fields, operators, actions).
 */
export const getFilterOptions = async (): Promise<FilterOptionsResponse> => {
  const response = await api.get('/mail/filters/options');
  return response.data;
};

/**
 * Create a new email filter.
 */
export const createFilter = async (data: {
  name: string;
  conditions: FilterCondition[];
  actions: FilterAction[];
  is_enabled?: boolean;
  priority?: number;
  stop_processing?: boolean;
}): Promise<MailFilter> => {
  const response = await api.post('/mail/filters', data);
  return response.data;
};

/**
 * List all email filters.
 */
export const listFilters = async (
  enabledOnly: boolean = false
): Promise<FilterListResponse> => {
  const response = await api.get('/mail/filters', {
    params: { enabled_only: enabledOnly },
  });
  return response.data;
};

/**
 * Get a single filter by ID.
 */
export const getFilter = async (filterId: string): Promise<MailFilter> => {
  const response = await api.get(`/mail/filters/${filterId}`);
  return response.data;
};

/**
 * Update an existing filter.
 */
export const updateFilter = async (
  filterId: string,
  updates: {
    name?: string;
    conditions?: FilterCondition[];
    actions?: FilterAction[];
    is_enabled?: boolean;
    priority?: number;
    stop_processing?: boolean;
  }
): Promise<MailFilter> => {
  const response = await api.put(`/mail/filters/${filterId}`, updates);
  return response.data;
};

/**
 * Delete a filter.
 */
export const deleteFilter = async (
  filterId: string
): Promise<{ success: boolean; message: string }> => {
  const response = await api.delete(`/mail/filters/${filterId}`);
  return response.data;
};

/**
 * Toggle a filter on or off.
 */
export const toggleFilter = async (
  filterId: string,
  enabled: boolean
): Promise<{ success: boolean; is_enabled: boolean }> => {
  const response = await api.post(`/mail/filters/${filterId}/toggle`, null, {
    params: { enabled },
  });
  return response.data;
};

/**
 * Reorder filters by priority.
 */
export const reorderFilters = async (
  filterOrder: string[]
): Promise<FilterListResponse> => {
  const response = await api.post('/mail/filters/reorder', {
    filter_order: filterOrder,
  });
  return response.data;
};

/**
 * Test filter conditions against a sample email.
 */
export const testFilter = async (
  conditions: FilterCondition[],
  email: { from?: string; to?: string[]; cc?: string[]; subject?: string; body?: string; has_attachment?: boolean }
): Promise<{ matches: boolean; conditions_tested: number; email_fields_checked: string[] }> => {
  const response = await api.post('/mail/filters/test', {
    conditions,
    email,
  });
  return response.data;
};

// ===========================================
// Contacts (Phase 4.2)
// ===========================================

export interface MailContact {
  id: string;
  email: string;
  name?: string;
  frequency: number;
  is_favorite: boolean;
  source: 'auto' | 'manual' | 'import';
  last_contacted?: string;
  created_at?: string;
}

export interface ContactListResponse {
  contacts: MailContact[];
  total: number;
  page: number;
  limit: number;
}

/**
 * Search contacts for autocomplete.
 */
export const searchContacts = async (
  query: string,
  limit: number = 10
): Promise<{ suggestions: MailContact[]; query: string }> => {
  const response = await api.get('/mail/contacts/autocomplete', {
    params: { q: query, limit },
  });
  return response.data;
};

/**
 * List all contacts.
 */
export const listContacts = async (
  favoritesOnly: boolean = false,
  page: number = 1,
  limit: number = 50
): Promise<ContactListResponse> => {
  const response = await api.get('/mail/contacts', {
    params: { favorites_only: favoritesOnly, page, limit },
  });
  return response.data;
};

/**
 * Create a new contact.
 */
export const createContact = async (data: {
  email: string;
  name?: string;
  is_favorite?: boolean;
}): Promise<MailContact> => {
  const response = await api.post('/mail/contacts', data);
  return response.data;
};

/**
 * Update a contact.
 */
export const updateContact = async (
  contactId: string,
  updates: { name?: string; is_favorite?: boolean }
): Promise<MailContact> => {
  const response = await api.put(`/mail/contacts/${contactId}`, updates);
  return response.data;
};

/**
 * Delete a contact.
 */
export const deleteContact = async (
  contactId: string
): Promise<{ success: boolean }> => {
  const response = await api.delete(`/mail/contacts/${contactId}`);
  return response.data;
};

/**
 * Toggle contact favorite status.
 */
export const toggleContactFavorite = async (
  contactId: string,
  isFavorite: boolean
): Promise<{ success: boolean; is_favorite: boolean }> => {
  const response = await api.post(`/mail/contacts/${contactId}/favorite`, null, {
    params: { is_favorite: isFavorite },
  });
  return response.data;
};

/**
 * Import contacts in bulk.
 */
export const importContacts = async (
  contacts: Array<{ email: string; name?: string }>
): Promise<{ imported: number; skipped: number }> => {
  const response = await api.post('/mail/contacts/import', { contacts });
  return response.data;
};

// ===========================================
// Labels
// ===========================================

export interface MailLabel {
  id: string;
  name: string;
  color: string;
  description?: string;
  is_visible: boolean;
  show_in_list: boolean;
  message_count: number;
  created_at?: string;
  updated_at?: string;
}

export interface LabelListResponse {
  labels: MailLabel[];
  count: number;
}

/**
 * Create a new label.
 */
export const createLabel = async (data: {
  name: string;
  color?: string;
  description?: string;
}): Promise<MailLabel> => {
  const response = await api.post('/mail/labels', data);
  return response.data;
};

/**
 * List all labels.
 */
export const listLabels = async (
  visibleOnly: boolean = false
): Promise<LabelListResponse> => {
  const response = await api.get('/mail/labels', {
    params: { visible_only: visibleOnly },
  });
  return response.data;
};

/**
 * Update a label.
 */
export const updateLabel = async (
  labelId: string,
  updates: {
    name?: string;
    color?: string;
    description?: string;
    is_visible?: boolean;
    show_in_list?: boolean;
  }
): Promise<MailLabel> => {
  const response = await api.put(`/mail/labels/${labelId}`, updates);
  return response.data;
};

/**
 * Delete a label.
 */
export const deleteLabel = async (
  labelId: string
): Promise<{ success: boolean }> => {
  const response = await api.delete(`/mail/labels/${labelId}`);
  return response.data;
};

/**
 * Assign label to messages.
 */
export const assignLabel = async (
  labelId: string,
  messageIds: string[]
): Promise<{ success: boolean; assigned_count: number }> => {
  const response = await api.post(`/mail/labels/${labelId}/assign`, {
    message_ids: messageIds,
  });
  return response.data;
};

/**
 * Remove label from messages.
 */
export const removeLabel = async (
  labelId: string,
  messageIds: string[]
): Promise<{ success: boolean; assigned_count: number }> => {
  const response = await api.post(`/mail/labels/${labelId}/remove`, {
    message_ids: messageIds,
  });
  return response.data;
};

/**
 * Get labels for a specific message.
 */
export const getMessageLabels = async (
  messageId: string
): Promise<{ message_id: string; labels: MailLabel[] }> => {
  const response = await api.get(`/mail/labels/message/${messageId}`);
  return response.data;
};

// ===========================================
// Templates
// ===========================================

export interface MailTemplate {
  id: string;
  name: string;
  description?: string;
  subject: string;
  body: string;
  is_html: boolean;
  to_addresses: Array<{ email: string; name?: string }>;
  cc_addresses: Array<{ email: string; name?: string }>;
  category: string;
  created_at?: string;
  updated_at?: string;
}

export interface TemplateListResponse {
  templates: MailTemplate[];
  total: number;
  page: number;
  limit: number;
}

/**
 * Create a new email template.
 */
export const createTemplate = async (data: {
  name: string;
  subject?: string;
  body?: string;
  is_html?: boolean;
  description?: string;
  to_addresses?: Array<{ email: string; name?: string }>;
  cc_addresses?: Array<{ email: string; name?: string }>;
  category?: string;
}): Promise<MailTemplate> => {
  const response = await api.post('/mail/templates', data);
  return response.data;
};

/**
 * List templates.
 */
export const listTemplates = async (
  category?: string,
  search?: string,
  page: number = 1,
  limit: number = 50
): Promise<TemplateListResponse> => {
  const response = await api.get('/mail/templates', {
    params: { category, search, page, limit },
  });
  return response.data;
};

/**
 * Get a single template.
 */
export const getTemplate = async (templateId: string): Promise<MailTemplate> => {
  const response = await api.get(`/mail/templates/${templateId}`);
  return response.data;
};

/**
 * Update a template.
 */
export const updateTemplate = async (
  templateId: string,
  updates: Partial<MailTemplate>
): Promise<MailTemplate> => {
  const response = await api.put(`/mail/templates/${templateId}`, updates);
  return response.data;
};

/**
 * Delete a template.
 */
export const deleteTemplate = async (
  templateId: string
): Promise<{ success: boolean }> => {
  const response = await api.delete(`/mail/templates/${templateId}`);
  return response.data;
};

/**
 * Duplicate a template.
 */
export const duplicateTemplate = async (
  templateId: string,
  newName?: string
): Promise<MailTemplate> => {
  const response = await api.post(`/mail/templates/${templateId}/duplicate`, {
    new_name: newName,
  });
  return response.data;
};

/**
 * Get template categories.
 */
export const getTemplateCategories = async (): Promise<{ categories: string[] }> => {
  const response = await api.get('/mail/templates/categories');
  return response.data;
};

// ===========================================
// Vacation Responder
// ===========================================

export interface VacationSettings {
  id: string;
  is_enabled: boolean;
  is_active: boolean;
  subject: string;
  message: string;
  is_html: boolean;
  start_date?: string;
  end_date?: string;
  only_contacts: boolean;
  only_once: boolean;
  replied_count: number;
  created_at?: string;
  updated_at?: string;
}

/**
 * Get vacation responder settings.
 */
export const getVacationSettings = async (): Promise<VacationSettings> => {
  const response = await api.get('/mail/vacation');
  return response.data;
};

/**
 * Update vacation responder settings.
 */
export const updateVacationSettings = async (data: {
  is_enabled?: boolean;
  subject?: string;
  message: string;
  is_html?: boolean;
  start_date?: string;
  end_date?: string;
  only_contacts?: boolean;
  only_once?: boolean;
}): Promise<VacationSettings> => {
  const response = await api.put('/mail/vacation', data);
  return response.data;
};

/**
 * Enable vacation responder.
 */
export const enableVacation = async (): Promise<VacationSettings> => {
  const response = await api.post('/mail/vacation/enable');
  return response.data;
};

/**
 * Disable vacation responder.
 */
export const disableVacation = async (): Promise<VacationSettings> => {
  const response = await api.post('/mail/vacation/disable');
  return response.data;
};

/**
 * Clear vacation replied list.
 */
export const clearVacationReplies = async (): Promise<{ success: boolean }> => {
  const response = await api.post('/mail/vacation/clear-replies');
  return response.data;
};

// ===========================================
// Real-Time WebSocket (Phase 3.4)
// ===========================================

export interface MailWebSocketMessage {
  type: 'new_email' | 'email_updated' | 'folder_updated' | 'connected' | 'pong' | 'error';
  folder?: string;
  message_id?: string;
  update_type?: 'read' | 'starred' | 'moved' | 'deleted';
  preview?: { subject?: string; from?: string };
  unread_count?: number;
  timestamp?: string;
  data?: any;
}

/**
 * Create a WebSocket connection for real-time mail updates.
 *
 * @param token - JWT authentication token
 * @param onMessage - Callback for incoming messages
 * @param onConnect - Callback when connected
 * @param onDisconnect - Callback when disconnected
 * @returns Object with send function and close function
 */
export const createMailWebSocket = (
  token: string,
  onMessage: (message: MailWebSocketMessage) => void,
  onConnect?: () => void,
  onDisconnect?: () => void
): { send: (msg: object) => void; close: () => void } => {
  const wsUrl = `${window.location.protocol === 'https:' ? 'wss:' : 'ws:'}//${window.location.host}/api/v1/mail/ws?token=${token}`;

  const ws = new WebSocket(wsUrl);

  ws.onopen = () => {
    console.log('Mail WebSocket connected');
    onConnect?.();
  };

  ws.onmessage = (event) => {
    try {
      const message = JSON.parse(event.data) as MailWebSocketMessage;
      onMessage(message);
    } catch (e) {
      console.error('Failed to parse WebSocket message:', e);
    }
  };

  ws.onclose = () => {
    console.log('Mail WebSocket disconnected');
    onDisconnect?.();
  };

  ws.onerror = (error) => {
    console.error('Mail WebSocket error:', error);
  };

  // Keep-alive ping every 30 seconds
  const pingInterval = setInterval(() => {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ type: 'ping' }));
    }
  }, 30000);

  return {
    send: (msg: object) => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify(msg));
      }
    },
    close: () => {
      clearInterval(pingInterval);
      ws.close();
    },
  };
};

// ===========================================
// Calendar Integration (Phase 4.1)
// ===========================================

export interface DetectedEvent {
  title: string;
  start: string;
  end?: string;
  date_str?: string;
  time_str?: string;
  location?: string;
  duration_minutes?: number;
  source: string;
  confidence: number;
}

export interface DetectedEventsResponse {
  message_id: string;
  subject: string;
  events_detected: number;
  events: DetectedEvent[];
}

export interface AddToCalendarRequest {
  title: string;
  start: string;
  end?: string;
  location?: string;
  description?: string;
  calendar_id?: string;
  source_message_id?: string;
}

export interface AddToCalendarResponse {
  success: boolean;
  event_uid?: string;
  calendar_id: string;
  message?: string;
}

/**
 * Detect calendar events in an email.
 */
export const detectCalendarEvents = async (
  messageId: string,
  folder: string = 'INBOX'
): Promise<DetectedEventsResponse> => {
  const response = await api.get(`/mail/calendar/detect/${encodeURIComponent(messageId)}`, {
    params: { folder },
  });
  return response.data;
};

/**
 * Detect calendar events from text (for compose preview).
 */
export const detectEventsFromText = async (
  subject: string,
  body: string
): Promise<{ events_detected: number; events: DetectedEvent[] }> => {
  const response = await api.post('/mail/calendar/detect/text', null, {
    params: { subject, body },
  });
  return response.data;
};

/**
 * Add a detected event to the calendar.
 * Requires Nextcloud credentials.
 */
export const addEventToCalendar = async (
  event: AddToCalendarRequest,
  ncUser: string,
  ncPass: string
): Promise<AddToCalendarResponse> => {
  const response = await api.post('/mail/calendar/add', event, {
    params: { nc_user: ncUser, nc_pass: ncPass },
  });
  return response.data;
};

/**
 * Detect and add an event from an email to calendar in one call.
 */
export const addEmailEventToCalendar = async (
  messageId: string,
  eventIndex: number = 0,
  calendarId: string = 'personal',
  folder: string = 'INBOX',
  ncUser: string,
  ncPass: string
): Promise<AddToCalendarResponse> => {
  const response = await api.post(`/mail/calendar/add-from-email/${encodeURIComponent(messageId)}`, null, {
    params: {
      event_index: eventIndex,
      calendar_id: calendarId,
      folder,
      nc_user: ncUser,
      nc_pass: ncPass,
    },
  });
  return response.data;
};

/**
 * Parse ICS content and return extracted events.
 */
export const parseIcsContent = async (
  icsContent: string
): Promise<{ events_found: number; events: DetectedEvent[] }> => {
  const response = await api.post('/mail/calendar/parse-ics', null, {
    params: { ics_content: icsContent },
  });
  return response.data;
};

// ===========================================
// Phase 5.1: Shared Mailboxes / Team Inboxes
// ===========================================

export interface SharedMailbox {
  id: string;
  email: string;
  name: string;
  description?: string;
  is_active: boolean;
  role?: string;
  can_send?: boolean;
  can_delete?: boolean;
  can_manage_members?: boolean;
  created_at?: string;
}

export interface SharedMailboxMember {
  id: string;
  user_id: string;
  role: string;
  can_send: boolean;
  can_delete: boolean;
  can_manage_members: boolean;
  created_at?: string;
}

export interface EmailAssignment {
  id: string;
  mailbox_id: string;
  message_id: string;
  assigned_to?: string;
  assigned_by?: string;
  status: string;
  priority: string;
  due_date?: string;
  notes?: string;
  created_at?: string;
}

export interface SharedMailboxComment {
  id: string;
  user_id: string;
  comment: string;
  is_internal: boolean;
  created_at?: string;
}

// Shared Mailbox CRUD
export const createSharedMailbox = async (data: {
  email: string;
  name: string;
  description?: string;
}): Promise<{ success: boolean; mailbox: SharedMailbox }> => {
  const response = await api.post('/mail/shared', data);
  return response.data;
};

export const listSharedMailboxes = async (): Promise<{
  count: number;
  mailboxes: SharedMailbox[];
}> => {
  const response = await api.get('/mail/shared');
  return response.data;
};

export const getSharedMailbox = async (
  mailboxId: string
): Promise<SharedMailbox & { members: SharedMailboxMember[] }> => {
  const response = await api.get(`/mail/shared/${mailboxId}`);
  return response.data;
};

export const updateSharedMailbox = async (
  mailboxId: string,
  data: { name?: string; description?: string; is_active?: boolean }
): Promise<{ success: boolean }> => {
  const response = await api.put(`/mail/shared/${mailboxId}`, data);
  return response.data;
};

export const deleteSharedMailbox = async (mailboxId: string): Promise<{ success: boolean }> => {
  const response = await api.delete(`/mail/shared/${mailboxId}`);
  return response.data;
};

// Shared Mailbox Members
export const addSharedMailboxMember = async (
  mailboxId: string,
  data: {
    user_id: string;
    role?: string;
    can_send?: boolean;
    can_delete?: boolean;
    can_manage_members?: boolean;
  }
): Promise<{ success: boolean; member: SharedMailboxMember }> => {
  const response = await api.post(`/mail/shared/${mailboxId}/members`, data);
  return response.data;
};

export const listSharedMailboxMembers = async (
  mailboxId: string
): Promise<{ count: number; members: SharedMailboxMember[] }> => {
  const response = await api.get(`/mail/shared/${mailboxId}/members`);
  return response.data;
};

export const removeSharedMailboxMember = async (
  mailboxId: string,
  userId: string
): Promise<{ success: boolean }> => {
  const response = await api.delete(`/mail/shared/${mailboxId}/members/${userId}`);
  return response.data;
};

// Shared Mailbox Messages
export const getSharedMailboxMessages = async (
  mailboxId: string,
  folder: string = 'INBOX',
  page: number = 1,
  limit: number = 50
): Promise<{ mailbox_id: string; folder: string; page: number; count: number; messages: any[] }> => {
  const response = await api.get(`/mail/shared/${mailboxId}/messages`, {
    params: { folder, page, limit },
  });
  return response.data;
};

// Email Assignments
export const assignSharedEmail = async (
  mailboxId: string,
  data: {
    message_id: string;
    assigned_to: string;
    priority?: string;
    due_date?: string;
    notes?: string;
  }
): Promise<{ success: boolean; assignment: EmailAssignment }> => {
  const response = await api.post(`/mail/shared/${mailboxId}/assign`, data);
  return response.data;
};

export const getEmailAssignment = async (
  mailboxId: string,
  messageId: string
): Promise<{ assignment: EmailAssignment | null }> => {
  const response = await api.get(`/mail/shared/${mailboxId}/assignments/${encodeURIComponent(messageId)}`);
  return response.data;
};

export const updateAssignmentStatus = async (
  mailboxId: string,
  messageId: string,
  status: string
): Promise<{ success: boolean }> => {
  const response = await api.put(`/mail/shared/${mailboxId}/assignments/${encodeURIComponent(messageId)}/status`, {
    status,
  });
  return response.data;
};

export const getMyAssignments = async (
  status?: string
): Promise<{ count: number; assignments: EmailAssignment[] }> => {
  const response = await api.get('/mail/shared/my-assignments', {
    params: status ? { status } : {},
  });
  return response.data;
};

// Shared Mailbox Comments
export const addSharedMailboxComment = async (
  mailboxId: string,
  data: { message_id: string; comment: string; is_internal?: boolean }
): Promise<{ success: boolean; comment: SharedMailboxComment }> => {
  const response = await api.post(`/mail/shared/${mailboxId}/comments`, data);
  return response.data;
};

export const getSharedMailboxComments = async (
  mailboxId: string,
  messageId: string
): Promise<{ count: number; comments: SharedMailboxComment[] }> => {
  const response = await api.get(`/mail/shared/${mailboxId}/comments/${encodeURIComponent(messageId)}`);
  return response.data;
};

export const deleteSharedMailboxComment = async (
  mailboxId: string,
  commentId: string
): Promise<{ success: boolean }> => {
  const response = await api.delete(`/mail/shared/${mailboxId}/comments/${commentId}`);
  return response.data;
};

// Shared Mailbox Activity
export const getSharedMailboxActivity = async (
  mailboxId: string,
  messageId?: string,
  limit: number = 50
): Promise<{ count: number; activity: any[] }> => {
  const response = await api.get(`/mail/shared/${mailboxId}/activity`, {
    params: { message_id: messageId, limit },
  });
  return response.data;
};

// ===========================================
// Phase 5.3: Attachment Preview
// ===========================================

export interface AttachmentPreviewInfo {
  filename: string;
  content_type: string;
  file_size: number;
  can_preview: boolean;
  preview_type: string | null;
  language?: string;
  requires_conversion: boolean;
  too_large: boolean;
}

export interface AttachmentThumbnail {
  data_url: string;
  width: number;
  height: number;
  format: string;
  page_count?: number;
}

export interface TextPreview {
  content: string;
  language: string;
  line_count: number;
  truncated: boolean;
  total_lines?: number;
}

export interface ViewerConfig {
  viewer: string;
  supports_zoom?: boolean;
  supports_fullscreen?: boolean;
  supports_search?: boolean;
  supports_pages?: boolean;
  supports_line_numbers?: boolean;
  supports_copy?: boolean;
  supports_wrap?: boolean;
  supports_playback_speed?: boolean;
  supports_volume?: boolean;
  language?: string;
  message?: string;
}

/**
 * Get preview capabilities for an attachment.
 */
export const getAttachmentPreviewInfo = async (
  filename: string,
  contentType?: string,
  fileSize: number = 0
): Promise<AttachmentPreviewInfo> => {
  const response = await api.get('/mail/attachments/preview-info', {
    params: { filename, content_type: contentType, file_size: fileSize },
  });
  return response.data;
};

/**
 * Get viewer configuration for an attachment.
 */
export const getAttachmentViewerConfig = async (
  filename: string,
  contentType?: string
): Promise<ViewerConfig & { filename: string; content_type: string }> => {
  const response = await api.get('/mail/attachments/viewer-config', {
    params: { filename, content_type: contentType },
  });
  return response.data;
};

/**
 * Get thumbnail for an attachment.
 */
export const getAttachmentThumbnail = async (
  messageId: string,
  attachmentIndex: number,
  folder: string = 'INBOX',
  width: number = 200,
  height: number = 200
): Promise<AttachmentThumbnail> => {
  const response = await api.get(
    `/mail/attachments/${encodeURIComponent(messageId)}/thumbnail/${attachmentIndex}`,
    { params: { folder, width, height } }
  );
  return response.data;
};

/**
 * Get preview data for an attachment.
 */
export const getAttachmentPreview = async (
  messageId: string,
  attachmentIndex: number,
  folder: string = 'INBOX'
): Promise<{
  preview_available: boolean;
  preview_type?: string;
  filename: string;
  content_type?: string;
  reason?: string;
  content?: string;
  language?: string;
  line_count?: number;
  truncated?: boolean;
  viewer?: ViewerConfig;
}> => {
  const response = await api.get(
    `/mail/attachments/${encodeURIComponent(messageId)}/preview/${attachmentIndex}`,
    { params: { folder } }
  );
  return response.data;
};

/**
 * Get download URL for an attachment.
 */
export const getAttachmentDownloadUrl = (
  messageId: string,
  attachmentIndex: number,
  folder: string = 'INBOX',
  inline: boolean = false
): string => {
  const params = new URLSearchParams({ folder, inline: String(inline) });
  return `/api/v1/mail/attachments/${encodeURIComponent(messageId)}/download/${attachmentIndex}?${params}`;
};

/**
 * Download an attachment with proper authentication.
 * Returns a blob URL that can be used for download or preview.
 */
export const downloadAttachment = async (
  messageId: string,
  attachmentIndex: number,
  folder: string = 'INBOX'
): Promise<{ blobUrl: string; filename: string }> => {
  // Get auth token
  const token = typeof window !== 'undefined' ? localStorage.getItem('auth_token') : null;

  // Use fetch directly to ensure proper headers with blob response
  const url = `/api/v1/mail/attachments/${encodeURIComponent(messageId)}/download/${attachmentIndex}?folder=${encodeURIComponent(folder)}`;

  const response = await fetch(url, {
    method: 'GET',
    headers: {
      'Authorization': token ? `Bearer ${token}` : '',
    },
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Failed to download: ${response.status} - ${errorText}`);
  }

  // Get filename from Content-Disposition header or use default
  const contentDisposition = response.headers.get('content-disposition');
  let filename = `attachment_${attachmentIndex}`;
  if (contentDisposition) {
    const match = contentDisposition.match(/filename="?([^";\n]+)"?/);
    if (match) {
      filename = match[1];
    }
  }

  // Get the content type from response headers
  const contentType = response.headers.get('content-type') || 'application/octet-stream';

  // Create blob with explicit content type to ensure proper rendering
  const arrayBuffer = await response.arrayBuffer();
  const blob = new Blob([arrayBuffer], { type: contentType });
  const blobUrl = URL.createObjectURL(blob);
  return { blobUrl, filename };
};

/**
 * Download and save an attachment file.
 */
export const downloadAndSaveAttachment = async (
  messageId: string,
  attachmentIndex: number,
  folder: string = 'INBOX',
  filename?: string
): Promise<void> => {
  const { blobUrl, filename: detectedFilename } = await downloadAttachment(
    messageId,
    attachmentIndex,
    folder
  );

  // Create a temporary link and trigger download
  const link = document.createElement('a');
  link.href = blobUrl;
  link.download = filename || detectedFilename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);

  // Clean up the blob URL
  setTimeout(() => URL.revokeObjectURL(blobUrl), 1000);
};

/**
 * List all attachments for an email with preview info.
 */
export const listEmailAttachments = async (
  messageId: string,
  folder: string = 'INBOX'
): Promise<{
  message_id: string;
  count: number;
  attachments: Array<{
    index: number;
    filename: string;
    content_type: string;
    size: number;
    can_preview: boolean;
    preview_type: string | null;
    too_large: boolean;
  }>;
}> => {
  const response = await api.get(`/mail/attachments/${encodeURIComponent(messageId)}/attachments`, {
    params: { folder },
  });
  return response.data;
};

// ===========================================
// Helper Functions
// ===========================================

export function formatEmailAddress(addr: { name?: string; email: string }): string {
  if (addr.name) {
    return `${addr.name} <${addr.email}>`;
  }
  return addr.email;
}

export function parseEmailAddress(str: string): { name: string; email: string } {
  const match = str.match(/^(.+?)\s*<(.+?)>$/);
  if (match) {
    return { name: match[1].trim(), email: match[2].trim() };
  }
  return { name: '', email: str.trim() };
}

// ===========================================
// AI Features
// ===========================================

export interface AIComposeResponse {
  subject: string;
  body: string;
}

export interface AIRewriteResponse {
  body: string;
}

export interface AISummarizeResponse {
  summary: string;
  key_points: string[];
  action_items: string[];
  sentiment: string;
}

export interface AISmartReplyResponse {
  replies: string[];
}

export interface AIGrammarCheckResponse {
  score: number;
  tone: string;
  issues: Array<{ type: string; text: string; suggestion: string }>;
  suggestions: string[];
}

export interface AISubjectResponse {
  subjects: string[];
}

/**
 * Generate an email from a natural language prompt
 */
export const aiComposeEmail = async (
  prompt: string,
  tone: string = 'professional',
  context?: string
): Promise<AIComposeResponse> => {
  const response = await api.post('/mail/ai/compose', {
    prompt,
    tone,
    context,
  });
  return response.data;
};

/**
 * Rewrite an email with a different tone
 */
export const aiRewriteEmail = async (
  content: string,
  tone: string = 'professional'
): Promise<AIRewriteResponse> => {
  const response = await api.post('/mail/ai/rewrite', {
    content,
    tone,
  });
  return response.data;
};

/**
 * Summarize an email
 */
export const aiSummarizeEmail = async (
  content: string,
  maxLength: number = 200
): Promise<AISummarizeResponse> => {
  const response = await api.post('/mail/ai/summarize', {
    content,
    max_length: maxLength,
  });
  return response.data;
};

/**
 * Generate smart reply suggestions
 */
export const aiSmartReplies = async (
  emailContent: string,
  senderName: string,
  count: number = 3
): Promise<AISmartReplyResponse> => {
  const response = await api.post('/mail/ai/replies', {
    email_content: emailContent,
    sender_name: senderName,
    count,
  });
  return response.data;
};

/**
 * Check grammar and tone
 */
export const aiGrammarCheck = async (
  content: string
): Promise<AIGrammarCheckResponse> => {
  const response = await api.post('/mail/ai/grammar-check', {
    content,
  });
  return response.data;
};

/**
 * Generate subject line suggestions
 */
export const aiGenerateSubjects = async (
  body: string,
  count: number = 3
): Promise<AISubjectResponse> => {
  const response = await api.post('/mail/ai/subjects', {
    body,
    count,
  });
  return response.data;
};

/**
 * Check AI service status
 */
export const aiGetStatus = async (): Promise<{
  status: string;
  model: string;
  features: Record<string, boolean>;
  note?: string;
}> => {
  const response = await api.get('/mail/ai/status');
  return response.data;
};

// ===========================================
// Category Management
// ===========================================

/**
 * Bulk categorize emails
 */
export const bulkCategorizeEmails = async (
  emails: Array<{ id: string; from: string; subject: string; headers?: Record<string, string> }>
): Promise<{ success: boolean; categorized: Record<string, string[]>; total: number }> => {
  const response = await api.post('/mail/categories/bulk-categorize', { emails });
  return response.data;
};

/**
 * Get emails by category
 */
export const getEmailsByCategory = async (
  category: string,
  limit: number = 50,
  offset: number = 0
): Promise<{ category: string; count: number; message_ids: string[] }> => {
  const response = await api.get(`/mail/categories/${category}`, { params: { limit, offset } });
  return response.data;
};
