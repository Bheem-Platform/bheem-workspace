/**
 * Mail Stores - Combined exports and backward compatibility
 *
 * This module provides a unified interface to all mail-related stores:
 * - mailInboxStore: Core emails and folders
 * - mailComposeStore: Email composition
 * - mailConversationStore: Conversation threading
 * - mailSearchStore: Email search
 */

// Export individual stores
export { useMailInboxStore } from './mailInboxStore';
export { useMailComposeStore, useReplyToEmail, useReplyAllToEmail, useForwardEmail } from './mailComposeStore';
export { useMailConversationStore } from './mailConversationStore';
export { useMailSearchStore } from './mailSearchStore';

// Export types
export * from './mailTypes';

// Export helpers
export { checkSession, parseEmailAddress, getFolderType, isSystemFolder } from './mailHelpers';

// ===========================================
// Combined hook for backward compatibility
// ===========================================
import { useMailInboxStore } from './mailInboxStore';
import { useMailComposeStore } from './mailComposeStore';
import { useMailConversationStore } from './mailConversationStore';
import { useMailSearchStore } from './mailSearchStore';

/**
 * Combined mail store hook for backward compatibility
 * Use individual stores for better performance and code splitting
 */
export function useMailStore() {
  const inbox = useMailInboxStore();
  const compose = useMailComposeStore();
  const conversation = useMailConversationStore();
  const search = useMailSearchStore();

  return {
    // Inbox state
    folders: inbox.folders,
    emails: inbox.emails,
    selectedEmail: inbox.selectedEmail,
    currentFolder: inbox.currentFolder,
    selectedEmails: inbox.selectedEmails,
    pagination: inbox.pagination,

    // Conversation state
    conversations: conversation.conversations,
    selectedConversation: conversation.selectedConversation,
    viewMode: conversation.viewMode,
    conversationPagination: conversation.conversationPagination,

    // Compose state
    isComposeOpen: compose.isComposeOpen,
    composeData: compose.composeData,

    // Search state
    searchQuery: search.searchQuery,
    searchParams: search.searchParams,
    isSearchActive: search.isSearchActive,
    searchResults: search.searchResults,
    searchResultsCount: search.searchResultsCount,
    searchByFolder: search.searchByFolder,

    // Combined loading state
    loading: {
      folders: inbox.loading.folders,
      emails: inbox.loading.emails,
      email: inbox.loading.email,
      action: inbox.loading.action,
      conversations: conversation.loading.conversations,
      conversation: conversation.loading.conversation,
      search: search.loading.search,
      send: compose.loading.send,
    },

    // Combined error (first non-null error)
    error: inbox.error || compose.error || conversation.error || search.error,

    // Inbox actions
    fetchFolders: inbox.fetchFolders,
    fetchEmails: inbox.fetchEmails,
    fetchEmail: inbox.fetchEmail,
    selectEmail: inbox.selectEmail,
    moveEmail: inbox.moveEmail,
    deleteEmail: inbox.deleteEmail,
    markAsRead: inbox.markAsRead,
    toggleStar: inbox.toggleStar,
    selectMultipleEmails: inbox.selectMultipleEmails,
    toggleEmailSelection: inbox.toggleEmailSelection,
    clearSelection: inbox.clearSelection,

    // Compose actions
    sendEmail: compose.sendEmail,
    openCompose: compose.openCompose,
    closeCompose: compose.closeCompose,
    updateComposeData: compose.updateComposeData,

    // Conversation actions
    fetchConversations: conversation.fetchConversations,
    fetchConversation: conversation.fetchConversation,
    fetchMessageThread: conversation.fetchMessageThread,
    selectConversation: conversation.selectConversation,
    setViewMode: conversation.setViewMode,

    // Search actions
    searchEmails: search.searchEmails,
    searchConversations: search.searchConversations,
    setSearchQuery: search.setSearchQuery,
    clearSearch: search.clearSearch,

    // Folder action (with view mode awareness)
    setCurrentFolder: (folder: string) => {
      inbox.setCurrentFolder(folder);
      conversation.selectConversation(null);
      if (conversation.viewMode === 'threaded') {
        conversation.fetchConversations(folder);
      }
    },

    // Utility actions
    clearError: () => {
      inbox.clearError();
      compose.clearError();
      conversation.clearError();
      search.clearError();
    },

    reset: () => {
      inbox.reset();
      compose.reset();
      conversation.reset();
      search.reset();
    },
  };
}
