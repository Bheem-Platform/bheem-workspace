// Mail Types for Bheem Mail

export interface EmailAddress {
  name: string;
  email: string;
}

export interface Attachment {
  id: string;
  filename: string;
  contentType: string;
  size: number;
  contentId?: string;
}

export interface Email {
  id: string;
  messageId: string;
  from: EmailAddress;
  to: EmailAddress[];
  cc?: EmailAddress[];
  bcc?: EmailAddress[];
  replyTo?: EmailAddress;
  subject: string;
  body: string;
  bodyHtml?: string;
  bodyText?: string;
  date: string;
  receivedDate?: string;
  isRead: boolean;
  isStarred: boolean;
  isFlagged: boolean;
  hasAttachments: boolean;
  attachments: Attachment[];
  folder: string;
  labels: string[];
  threadId?: string;
  inReplyTo?: string;
  references?: string[];
  priority?: 'high' | 'normal' | 'low';
}

export interface MailFolder {
  id: string;
  name: string;
  path: string;
  type: 'inbox' | 'sent' | 'drafts' | 'spam' | 'trash' | 'archive' | 'custom';
  unreadCount: number;
  totalCount: number;
  icon?: string;
  color?: string;
  isSystem: boolean;
  parentId?: string;
  children?: MailFolder[];
}

export interface ComposeEmail {
  to: string[];
  cc?: string[];
  bcc?: string[];
  subject: string;
  body: string;
  isHtml: boolean;
  attachments?: File[];
  inReplyTo?: string;
  references?: string[];
  replyType?: 'reply' | 'replyAll' | 'forward';
  originalEmail?: Email;
  // Confidential mode settings
  confidential?: {
    enabled: boolean;
    expiresInHours?: number;
    passcode?: string;
    passcodeType?: 'sms' | 'email' | 'none';
    noForward?: boolean;
    noCopy?: boolean;
    noPrint?: boolean;
    noDownload?: boolean;
  };
}

export interface EmailNudge {
  id: string;
  messageId: string;
  nudgeType: 'sent_no_reply' | 'received_no_reply' | 'custom';
  remindAt: string;
  snoozeUntil?: string;
  status: 'pending' | 'shown' | 'dismissed' | 'replied' | 'snoozed';
  subject?: string;
  recipientEmail?: string;
  sentAt?: string;
  note?: string;
}

export interface MailCredentials {
  email: string;
  password: string;
}

export interface MailSearchParams {
  query?: string;
  folder?: string;
  from?: string;
  to?: string;
  subject?: string;
  hasAttachment?: boolean;
  isUnread?: boolean;
  isStarred?: boolean;
  dateFrom?: string;
  dateTo?: string;
  page?: number;
  limit?: number;
}

export interface MailPagination {
  page: number;
  limit: number;
  total: number;
  hasMore: boolean;
}

export interface MailState {
  // Data
  folders: MailFolder[];
  emails: Email[];
  selectedEmail: Email | null;
  currentFolder: string;

  // UI State
  isComposeOpen: boolean;
  composeData: Partial<ComposeEmail>;
  searchQuery: string;
  searchParams: MailSearchParams;
  selectedEmails: string[];

  // Pagination
  pagination: MailPagination;

  // Loading states
  loading: {
    folders: boolean;
    emails: boolean;
    email: boolean;
    send: boolean;
    action: boolean;
  };

  // Error
  error: string | null;

  // Credentials
  isAuthenticated: boolean;
}

// API Request/Response Types
export interface SendEmailRequest {
  to: string[];
  cc?: string[];
  bcc?: string[];
  subject: string;
  body: string;
  isHtml?: boolean;
  attachments?: File[];
  inReplyTo?: string;
}

export interface MoveEmailRequest {
  fromFolder: string;
  toFolder: string;
}

export interface MailLoginResponse {
  success: boolean;
  message?: string;
  folders?: MailFolder[];
}

export interface EmailListResponse {
  emails?: Email[];
  messages?: Email[];  // Alternative response format from API
  total?: number;
  count?: number;  // Alternative count field
  page?: number;
  limit?: number;
  hasMore?: boolean;
}

// Conversation Threading
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
