import { api } from './api';
import type {
  Email,
  MailFolder,
  SendEmailRequest,
  EmailListResponse,
  MailLoginResponse,
} from '@/types/mail';

// Mail Authentication
export const loginMail = async (email: string, password: string): Promise<MailLoginResponse> => {
  const response = await api.post('/mail/login', null, {
    params: { email, password },
  });
  return response.data;
};

// Folders
export const getFolders = async (email: string, password: string): Promise<MailFolder[]> => {
  const response = await api.get('/mail/folders', {
    params: { email, password },
  });
  return response.data;
};

// Messages
export const getMessages = async (
  email: string,
  password: string,
  folder: string = 'INBOX',
  page: number = 1,
  limit: number = 50
): Promise<EmailListResponse> => {
  const response = await api.get('/mail/messages', {
    params: { email, password, folder, page, limit },
  });
  return response.data;
};

export const getInbox = async (
  email: string,
  password: string,
  page: number = 1,
  limit: number = 50
): Promise<EmailListResponse> => {
  const response = await api.get('/mail/inbox', {
    params: { email, password, page, limit },
  });
  return response.data;
};

export const getMessage = async (
  email: string,
  password: string,
  messageId: string
): Promise<Email> => {
  const response = await api.get(`/mail/messages/${messageId}`, {
    params: { email, password },
  });
  return response.data;
};

// Send Email
export const sendEmail = async (
  email: string,
  password: string,
  data: SendEmailRequest
): Promise<{ success: boolean; message_id?: string }> => {
  const formData = new FormData();
  formData.append('email', email);
  formData.append('password', password);

  data.to.forEach((to) => formData.append('to', to));
  if (data.cc) data.cc.forEach((cc) => formData.append('cc', cc));
  if (data.bcc) data.bcc.forEach((bcc) => formData.append('bcc', bcc));
  formData.append('subject', data.subject);
  formData.append('body', data.body);
  formData.append('is_html', String(data.isHtml ?? true));

  if (data.attachments) {
    data.attachments.forEach((file) => {
      formData.append('attachments', file);
    });
  }

  const response = await api.post('/mail/send', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
    params: { email, password },
  });
  return response.data;
};

// Move Email
export const moveEmail = async (
  email: string,
  password: string,
  messageId: string,
  fromFolder: string,
  toFolder: string
): Promise<{ success: boolean }> => {
  const response = await api.post(
    `/mail/messages/${messageId}/move`,
    { from_folder: fromFolder, to_folder: toFolder },
    { params: { email, password } }
  );
  return response.data;
};

// Delete Email (move to Trash)
export const deleteEmail = async (
  email: string,
  password: string,
  messageId: string
): Promise<{ success: boolean }> => {
  const response = await api.delete(`/mail/messages/${messageId}`, {
    params: { email, password },
  });
  return response.data;
};

// Mark as Read/Unread
export const markAsRead = async (
  email: string,
  password: string,
  messageId: string,
  isRead: boolean
): Promise<{ success: boolean }> => {
  const response = await api.patch(
    `/mail/messages/${messageId}`,
    { is_read: isRead },
    { params: { email, password } }
  );
  return response.data;
};

// Star/Unstar Email
export const toggleStar = async (
  email: string,
  password: string,
  messageId: string,
  isStarred: boolean
): Promise<{ success: boolean }> => {
  const response = await api.patch(
    `/mail/messages/${messageId}`,
    { is_starred: isStarred },
    { params: { email, password } }
  );
  return response.data;
};

// Search Emails
export const searchEmails = async (
  email: string,
  password: string,
  query: string,
  folder?: string
): Promise<EmailListResponse> => {
  const response = await api.get('/mail/search', {
    params: { email, password, query, folder },
  });
  return response.data;
};

// Get Attachment
export const getAttachment = async (
  email: string,
  password: string,
  messageId: string,
  attachmentId: string
): Promise<Blob> => {
  const response = await api.get(
    `/mail/messages/${messageId}/attachments/${attachmentId}`,
    {
      params: { email, password },
      responseType: 'blob',
    }
  );
  return response.data;
};

// Transactional Email (via Notify service)
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

// Send Welcome Email
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

// Send Meeting Invite
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

// Helper to format email addresses
export function formatEmailAddress(addr: { name?: string; email: string }): string {
  if (addr.name) {
    return `${addr.name} <${addr.email}>`;
  }
  return addr.email;
}

// Helper to parse email address
export function parseEmailAddress(str: string): { name: string; email: string } {
  const match = str.match(/^(.+?)\s*<(.+?)>$/);
  if (match) {
    return { name: match[1].trim(), email: match[2].trim() };
  }
  return { name: '', email: str.trim() };
}
