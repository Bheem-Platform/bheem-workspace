/**
 * Shared types for mail stores
 */
import type { Email, MailFolder, ComposeEmail, MailSearchParams, MailPagination } from '@/types/mail';
import type { Conversation } from '@/lib/mailApi';

// Loading state interface shared across stores
export interface MailLoadingState {
  folders: boolean;
  emails: boolean;
  email: boolean;
  conversations: boolean;
  conversation: boolean;
  search: boolean;
  send: boolean;
  action: boolean;
}

// Common pagination interface
export interface PaginationState {
  page: number;
  limit: number;
  total: number;
  hasMore: boolean;
}

// Re-export types for convenience
export type { Email, MailFolder, ComposeEmail, MailSearchParams, MailPagination, Conversation };
