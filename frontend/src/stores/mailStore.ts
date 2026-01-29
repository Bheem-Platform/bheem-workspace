/**
 * Mail Store - Re-export from modular stores
 *
 * This file maintains backward compatibility by re-exporting from the new
 * modular mail store structure in ./mail/
 *
 * For new code, prefer importing from individual stores:
 * - useMailInboxStore: Core emails and folders
 * - useMailComposeStore: Email composition
 * - useMailConversationStore: Conversation threading
 * - useMailSearchStore: Email search
 *
 * @deprecated Import from '@/stores/mail' instead for new code
 */

// Re-export everything from the mail module
export {
  // Combined hook (backward compatible)
  useMailStore,

  // Individual stores (preferred for new code)
  useMailInboxStore,
  useMailComposeStore,
  useMailConversationStore,
  useMailSearchStore,

  // Hooks
  useReplyToEmail,
  useReplyAllToEmail,
  useForwardEmail,

  // Types
  type Email,
  type MailFolder,
  type ComposeEmail,
  type MailSearchParams,
  type MailPagination,
  type Conversation,
  type MailLoadingState,
  type PaginationState,

  // Helpers
  checkSession,
  parseEmailAddress,
  getFolderType,
  isSystemFolder,
} from './mail';
