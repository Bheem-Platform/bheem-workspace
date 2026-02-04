/**
 * Bheem Workspace - Chat Store
 * State management for direct messages and group chats
 */

import { create } from 'zustand';
import axios from 'axios';
import { api } from '@/lib/api';

// ============================================
// TYPES
// ============================================

export interface Participant {
  id: string;
  user_id: string | null;
  user_name: string;
  user_email?: string;
  user_avatar?: string;
  role: string;
  unread_count: number;
  is_muted: boolean;
  participant_type: 'internal' | 'external_user' | 'guest';
  external_contact_id?: string;
  company_name?: string;
  joined_at: string;
  left_at?: string;
  last_seen_at?: string;  // For presence tracking
  is_online?: boolean;    // Computed from last_seen_at
}

// Presence information for a participant
export interface ParticipantPresence {
  user_id: string;
  user_name: string;
  user_avatar?: string;
  last_seen_at?: string;
  is_online: boolean;
  participant_type: string;
}

// Read receipt details
export interface ReadReceiptUser {
  user_id: string;
  user_name: string;
  user_avatar?: string;
  last_read_at?: string;
}

export interface MessageReadReceipts {
  message_id: string;
  sender_id: string;
  delivered_to: ReadReceiptUser[];
  read_by: ReadReceiptUser[];
  total_delivered: number;
  total_read: number;
  total_participants: number;
}

export interface Attachment {
  id: string;
  file_name: string;
  file_type?: string;
  file_size?: number;
  file_url: string;
  thumbnail_url?: string;
  width?: number;
  height?: number;
}

export interface Message {
  id: string;
  conversation_id: string;
  sender_id: string;
  sender_name: string;
  sender_avatar?: string;
  content?: string;
  message_type: 'text' | 'image' | 'file' | 'system' | 'call';
  reply_to_id?: string;
  reactions: Record<string, string[]>;
  is_edited: boolean;
  is_deleted: boolean;
  delivered_to: string[];
  read_by: string[];
  attachments: Attachment[];
  is_external_sender: boolean;
  call_log_id?: string;
  created_at: string;
  updated_at?: string;
}

export interface Conversation {
  id: string;
  type: 'direct' | 'group';
  scope: 'internal' | 'external' | 'cross_tenant';
  name?: string;
  description?: string;
  avatar_url?: string;
  created_by: string;
  last_message_at?: string;
  last_message_preview?: string;
  last_message_sender_name?: string;
  is_archived: boolean;
  participants: Participant[];
  created_at: string;
}

export interface ExternalContact {
  id: string;
  email: string;
  name: string;
  avatar_url?: string;
  phone?: string;
  company_name?: string;
  job_title?: string;
  is_active: boolean;
  is_blocked: boolean;
  notes?: string;
  tags: string[];
  linked_user_id?: string;
  created_at: string;
  last_contacted_at?: string;
}

export interface CallLog {
  id: string;
  conversation_id: string;
  call_type: 'audio' | 'video';
  room_name: string;
  caller_id: string;
  caller_name: string;
  status: 'ringing' | 'ongoing' | 'ended' | 'missed' | 'declined' | 'no_answer';
  duration_seconds: number;
  started_at: string;
  ended_at?: string;
}

export interface TeamMember {
  id: string;
  name: string;
  email?: string;
  avatar?: string;
  job_title?: string;
  department?: string;
  is_online?: boolean;
}

// Chat Tab - New filter-based tabs
export type ChatTab = 'all' | 'unread' | 'teams';

// Shared file types
export interface SharedFile {
  id: string;
  file_name: string;
  file_type?: string;
  file_size?: number;
  file_url: string;
  thumbnail_url?: string;
  width?: number;
  height?: number;
  sender_name: string;
  sent_at?: string;
}

export interface SharedLink {
  url: string;
  sender_name: string;
  sent_at?: string;
  message_preview?: string;
}

export interface ConversationStats {
  message_count: number;
  media_count: number;
  link_count: number;
  started_at?: string;
}

export interface SharedFilesData {
  images: SharedFile[];
  documents: SharedFile[];
  links: SharedLink[];
  totals?: {
    images: number;
    documents: number;
    links: number;
  };
}

// ============================================
// STATE INTERFACE
// ============================================

interface ChatState {
  // Data
  conversations: Conversation[];
  archivedConversations: Conversation[];
  activeConversation: Conversation | null;
  messages: Record<string, Message[]>; // conversation_id -> messages
  externalContacts: ExternalContact[];
  teamMembers: TeamMember[];

  // Shared files and stats (for info panel)
  sharedFiles: SharedFilesData | null;
  conversationStats: ConversationStats | null;

  // Real-time
  chatToken: string | null;
  wsUrl: string | null;
  isConnected: boolean;
  typingUsers: Record<string, Record<string, string>>; // conversation_id -> { user_id: user_name }
  onlineUsers: Set<string>;

  // Presence tracking
  participantPresence: Record<string, ParticipantPresence[]>; // conversation_id -> participants presence

  // Unread counts
  unreadCounts: Record<string, number>;
  totalUnread: number;

  // Active calls
  activeCall: CallLog | null;
  incomingCall: CallLog | null;

  // UI State
  isLoading: boolean;
  isSending: boolean;
  isUploading: boolean;
  error: string | null;
  activeTab: ChatTab;
  showArchived: boolean;
  infoPanelOpen: boolean;

  // Search
  searchQuery: string;
  searchResults: (Conversation | TeamMember | ExternalContact)[];

  // ============================================
  // ACTIONS
  // ============================================

  // Conversations
  fetchConversations: (scope?: 'internal' | 'external' | 'all') => Promise<void>;
  fetchMessages: (conversationId: string, before?: string) => Promise<void>;
  setActiveConversation: (conversation: Conversation | null) => void;

  // Sending messages
  sendMessage: (conversationId: string, content: string, files?: File[], replyToId?: string) => Promise<Message | null>;
  editMessage: (conversationId: string, messageId: string, content: string) => Promise<void>;
  deleteMessage: (conversationId: string, messageId: string) => Promise<void>;
  addReaction: (conversationId: string, messageId: string, emoji: string) => Promise<void>;
  forwardMessage: (messageId: string, targetConversationIds: string[]) => Promise<boolean>;

  // Create conversations
  createDirectConversation: (user: {
    id: string;
    name: string;
    email?: string;
    avatar?: string;
    tenant_id?: string;
    external_contact_id?: string;
  }) => Promise<Conversation | null>;
  createGroupConversation: (name: string, participants: { id: string; name: string; email?: string }[], description?: string) => Promise<Conversation | null>;
  archiveConversation: (conversationId: string) => Promise<void>;
  unarchiveConversation: (conversationId: string) => Promise<void>;
  leaveConversation: (conversationId: string) => Promise<void>;
  muteConversation: (conversationId: string, muted: boolean) => Promise<void>;
  pinConversation: (conversationId: string, pinned: boolean) => Promise<void>;
  removeGroupMember: (conversationId: string, memberId: string) => Promise<boolean>;
  addGroupMembers: (conversationId: string, participants: Array<{id: string; name: string; email?: string; type: string; tenant_id?: string}>) => Promise<boolean>;
  updateGroupDetails: (conversationId: string, name?: string, description?: string) => Promise<boolean>;
  updateGroupAvatar: (conversationId: string, file: File) => Promise<void>;

  // Archived conversations
  fetchArchivedConversations: () => Promise<void>;
  setShowArchived: (show: boolean) => void;

  // Conversation info panel
  fetchSharedFiles: (conversationId: string) => Promise<void>;
  fetchConversationStats: (conversationId: string) => Promise<void>;
  setInfoPanelOpen: (open: boolean) => void;

  // External contacts
  fetchExternalContacts: () => Promise<void>;
  createExternalContact: (contact: Partial<ExternalContact>) => Promise<ExternalContact | null>;
  inviteExternalContact: (conversationId: string, email: string, name?: string, message?: string) => Promise<void>;

  // Team members
  searchTeamMembers: (query: string) => Promise<void>;

  // Read receipts and delivery tracking
  markAsRead: (conversationId: string, messageId?: string) => Promise<string[]>;
  fetchUnreadCounts: () => Promise<void>;
  markMessagesDelivered: (conversationId: string, messageIds?: string[]) => Promise<void>;
  fetchMessageReadReceipts: (messageId: string) => Promise<MessageReadReceipts | null>;
  updateMessageDelivery: (conversationId: string, messageId: string, userId: string) => void;
  updateMessageReadBy: (conversationId: string, messageId: string, userId: string) => void;

  // Presence tracking
  sendPresenceHeartbeat: () => Promise<void>;
  fetchConversationPresence: (conversationId: string) => Promise<void>;
  updateParticipantPresence: (conversationId: string, userId: string, lastSeen: string, isOnline: boolean) => void;

  // Calls
  initiateCall: (conversationId: string, callType: 'audio' | 'video') => Promise<{ call: CallLog; token: string; wsUrl: string; roomName: string } | null>;
  answerCall: (callId: string) => Promise<{ call: CallLog; token: string; wsUrl: string; roomName: string } | null>;
  endCall: (callId: string, reason?: string) => Promise<void>;
  declineCall: (callId: string) => Promise<void>;
  getCallToken: (callId: string) => Promise<{ token: string; wsUrl: string; roomName: string } | null>;

  // Real-time connection
  fetchChatToken: (conversationId: string) => Promise<{ token: string; wsUrl: string; roomName: string } | null>;
  setConnected: (connected: boolean) => void;

  // Broadcast callbacks (set by ChatLiveKitProvider)
  broadcastMessageFn: ((message: Message) => void) | null;
  setBroadcastMessageFn: (fn: ((message: Message) => void) | null) => void;
  broadcastDeleteFn: ((conversationId: string, messageId: string) => void) | null;
  setBroadcastDeleteFn: (fn: ((conversationId: string, messageId: string) => void) | null) => void;
  broadcastEditFn: ((conversationId: string, messageId: string, content: string) => void) | null;
  setBroadcastEditFn: (fn: ((conversationId: string, messageId: string, content: string) => void) | null) => void;
  broadcastTypingFn: ((isTyping: boolean) => void) | null;
  setBroadcastTypingFn: (fn: ((isTyping: boolean) => void) | null) => void;
  broadcastReadReceiptFn: ((messageIds: string[]) => void) | null;
  setBroadcastReadReceiptFn: (fn: ((messageIds: string[]) => void) | null) => void;

  // Real-time message handling (called by LiveKit provider)
  addMessage: (message: Message) => void;
  updateMessage: (message: Message) => void;
  removeMessage: (conversationId: string, messageId: string) => void;
  setTyping: (conversationId: string, userId: string, userName: string, isTyping: boolean) => void;
  setUserOnline: (userId: string, isOnline: boolean) => void;
  setIncomingCall: (call: CallLog | null) => void;

  // UI
  setActiveTab: (tab: ChatTab) => void;
  setSearchQuery: (query: string) => void;
  clearError: () => void;
  reset: () => void;
}

// ============================================
// STORE IMPLEMENTATION
// ============================================

export const useChatStore = create<ChatState>((set, get) => ({
  // Initial state
  conversations: [],
  archivedConversations: [],
  activeConversation: null,
  messages: {},
  externalContacts: [],
  teamMembers: [],
  sharedFiles: null,
  conversationStats: null,
  chatToken: null,
  wsUrl: null,
  isConnected: false,
  typingUsers: {},
  onlineUsers: new Set(),
  broadcastMessageFn: null,
  broadcastDeleteFn: null,
  broadcastEditFn: null,
  broadcastTypingFn: null,
  broadcastReadReceiptFn: null,
  participantPresence: {},
  unreadCounts: {},
  totalUnread: 0,
  activeCall: null,
  incomingCall: null,
  isLoading: false,
  isSending: false,
  isUploading: false,
  error: null,
  activeTab: 'all',
  showArchived: false,
  infoPanelOpen: false,
  searchQuery: '',
  searchResults: [],

  // ============================================
  // CONVERSATIONS
  // ============================================

  fetchConversations: async (scope = 'all') => {
    set({ isLoading: true, error: null });
    try {
      const params: Record<string, string | boolean> = {};
      const activeTab = get().activeTab;

      // Map tab to API params
      if (activeTab === 'unread') {
        params.unread_only = true;
      } else if (activeTab === 'teams') {
        params.conv_type = 'group';
      }
      // 'all' tab doesn't need any filter params

      // Legacy scope support (if passed explicitly)
      if (scope !== 'all') {
        params.scope = scope;
      }

      const res = await api.get('/messages/conversations', { params });
      // API returns { conversations: [...], total: number }
      const data = res.data;
      set({ conversations: data.conversations || data });
    } catch (err: any) {
      set({ error: err.response?.data?.detail || 'Failed to fetch conversations' });
    } finally {
      set({ isLoading: false });
    }
  },

  fetchMessages: async (conversationId: string, before?: string) => {
    set({ isLoading: true });
    try {
      const params: Record<string, string> = {};
      if (before) params.before = before;

      const res = await api.get(`/messages/conversations/${conversationId}/messages`, { params });

      set((state) => ({
        messages: {
          ...state.messages,
          [conversationId]: before
            ? [...res.data, ...(state.messages[conversationId] || [])]
            : res.data,
        },
      }));
    } catch (err: any) {
      set({ error: err.response?.data?.detail || 'Failed to fetch messages' });
    } finally {
      set({ isLoading: false });
    }
  },

  setActiveConversation: (conversation) => {
    set({ activeConversation: conversation });
    if (conversation) {
      // Fetch messages if not already loaded
      if (!get().messages[conversation.id]) {
        get().fetchMessages(conversation.id);
      }
      // Mark as read
      get().markAsRead(conversation.id);
    }
  },

  // ============================================
  // MESSAGING
  // ============================================

  sendMessage: async (conversationId, content, files, replyToId) => {
    set({ isSending: true, error: null });
    try {
      let res;

      if (files && files.length > 0) {
        // Send with files
        console.log('[chatStore] Sending message with files:', files.length);
        files.forEach((f, i) => console.log(`[chatStore] File ${i}: ${f.name}, size: ${f.size}, type: ${f.type}`));

        set({ isUploading: true });
        const formData = new FormData();
        formData.append('content', content || '');
        formData.append('message_type', 'file');
        if (replyToId) formData.append('reply_to_id', replyToId);

        // Append each file
        files.forEach((file, index) => {
          console.log(`[chatStore] Appending file ${index} to FormData: ${file.name}`);
          formData.append('files', file);
        });

        // Debug: Log FormData entries
        console.log('[chatStore] FormData entries:');
        for (const [key, value] of formData.entries()) {
          console.log(`  ${key}:`, value instanceof File ? `File(${value.name}, ${value.size} bytes)` : value);
        }

        // Use axios directly to properly handle FormData
        // The browser will set the correct Content-Type with boundary
        const token = typeof window !== 'undefined' ? localStorage.getItem('auth_token') : null;
        console.log('[chatStore] Making POST request to with-files endpoint...');

        res = await axios.post(
          `/api/v1/messages/conversations/${conversationId}/messages/with-files`,
          formData,
          {
            headers: {
              ...(token ? { Authorization: `Bearer ${token}` } : {}),
            },
            withCredentials: true,
          }
        );
        console.log('[chatStore] Response:', res.data);
        set({ isUploading: false });
      } else {
        // Send text only
        res = await api.post(`/messages/conversations/${conversationId}/messages`, {
          content,
          message_type: 'text',
          reply_to_id: replyToId,
        });
      }

      const message = res.data;

      // Broadcast message via LiveKit for real-time delivery
      const { broadcastMessageFn } = get();
      console.log('[chatStore] Broadcasting message, broadcastMessageFn exists:', !!broadcastMessageFn);
      if (broadcastMessageFn) {
        console.log('[chatStore] Calling broadcastMessageFn with message:', message.id);
        broadcastMessageFn(message);
      } else {
        console.warn('[chatStore] broadcastMessageFn is null - LiveKit not connected?');
      }

      // Add to local messages and update conversation order
      set((state) => {
        // Update conversations with last message info
        const updatedConversations = state.conversations.map((c) => {
          if (c.id === conversationId) {
            return {
              ...c,
              last_message_at: message.created_at,
              last_message_preview: message.content?.substring(0, 100) ||
                (message.attachments?.length > 0
                  ? (message.attachments[0].file_type?.startsWith('audio/') ? '🎤 Voice message' :
                     message.attachments[0].file_type?.startsWith('image/') ? '📷 Photo' :
                     '📎 ' + message.attachments[0].file_name)
                  : ''),
              last_message_sender_name: message.sender_name,
            };
          }
          return c;
        });

        // Sort conversations by last_message_at (newest first)
        const sortedConversations = [...updatedConversations].sort((a, b) => {
          const aTime = a.last_message_at ? new Date(a.last_message_at).getTime() : 0;
          const bTime = b.last_message_at ? new Date(b.last_message_at).getTime() : 0;
          return bTime - aTime;
        });

        return {
          messages: {
            ...state.messages,
            [conversationId]: [...(state.messages[conversationId] || []), message],
          },
          conversations: sortedConversations,
        };
      });

      return message;
    } catch (err: any) {
      set({ error: err.response?.data?.detail || 'Failed to send message', isUploading: false });
      return null;
    } finally {
      set({ isSending: false });
    }
  },

  editMessage: async (conversationId, messageId, content) => {
    try {
      const res = await api.put(
        `/messages/conversations/${conversationId}/messages/${messageId}`,
        { content }
      );

      // Broadcast edit to other participants via LiveKit
      const { broadcastEditFn } = get();
      if (broadcastEditFn) {
        broadcastEditFn(conversationId, messageId, content);
      }

      set((state) => ({
        messages: {
          ...state.messages,
          [conversationId]: (state.messages[conversationId] || []).map((m) =>
            m.id === messageId ? res.data : m
          ),
        },
      }));
    } catch (err: any) {
      set({ error: err.response?.data?.detail || 'Failed to edit message' });
    }
  },

  deleteMessage: async (conversationId, messageId) => {
    try {
      await api.delete(`/messages/conversations/${conversationId}/messages/${messageId}`);

      // Broadcast delete to other participants via LiveKit
      const { broadcastDeleteFn } = get();
      if (broadcastDeleteFn) {
        broadcastDeleteFn(conversationId, messageId);
      }

      set((state) => ({
        messages: {
          ...state.messages,
          [conversationId]: (state.messages[conversationId] || []).map((m) =>
            m.id === messageId ? { ...m, is_deleted: true, content: undefined } : m
          ),
        },
      }));
    } catch (err: any) {
      set({ error: err.response?.data?.detail || 'Failed to delete message' });
    }
  },

  addReaction: async (conversationId, messageId, emoji) => {
    try {
      const res = await api.post(
        `/messages/conversations/${conversationId}/messages/${messageId}/react`,
        { emoji }
      );

      set((state) => ({
        messages: {
          ...state.messages,
          [conversationId]: (state.messages[conversationId] || []).map((m) =>
            m.id === messageId ? { ...m, reactions: res.data.reactions } : m
          ),
        },
      }));
    } catch (err: any) {
      console.error('Failed to add reaction:', err);
    }
  },

  forwardMessage: async (messageId, targetConversationIds) => {
    try {
      await api.post(`/messages/messages/${messageId}/forward`, {
        target_conversation_ids: targetConversationIds,
      });
      return true;
    } catch (err: any) {
      set({ error: err.response?.data?.detail || 'Failed to forward message' });
      return false;
    }
  },

  // ============================================
  // CREATE CONVERSATIONS
  // ============================================

  createDirectConversation: async (user) => {
    try {
      // Determine participant type based on user properties
      const participantType = user.external_contact_id ? 'guest' :
                              user.tenant_id ? 'external_user' : 'internal';

      const res = await api.post('/messages/conversations/direct', {
        participant: {
          id: user.id,
          name: user.name,
          email: user.email,
          type: participantType,
          tenant_id: user.tenant_id,
          external_contact_id: user.external_contact_id,
        },
      });

      const conversation = res.data;

      set((state) => ({
        conversations: [conversation, ...state.conversations.filter(c => c.id !== conversation.id)],
        activeConversation: conversation,
      }));

      return conversation;
    } catch (err: any) {
      set({ error: err.response?.data?.detail || 'Failed to create conversation' });
      return null;
    }
  },

  createGroupConversation: async (name, participants, description) => {
    try {
      const res = await api.post('/messages/conversations/group', {
        name,
        description,
        participants: participants.map(p => ({
          id: p.id,
          name: p.name,
          email: p.email,
          type: 'internal', // Default to internal for team members
        })),
      });

      const conversation = res.data;

      set((state) => ({
        conversations: [conversation, ...state.conversations],
        activeConversation: conversation,
      }));

      return conversation;
    } catch (err: any) {
      set({ error: err.response?.data?.detail || 'Failed to create group' });
      return null;
    }
  },

  archiveConversation: async (conversationId) => {
    try {
      await api.post(`/messages/conversations/${conversationId}/archive`);

      set((state) => {
        const archivedConv = state.conversations.find((c) => c.id === conversationId);
        return {
          conversations: state.conversations.filter((c) => c.id !== conversationId),
          archivedConversations: archivedConv
            ? [{ ...archivedConv, is_archived: true }, ...state.archivedConversations]
            : state.archivedConversations,
          activeConversation: state.activeConversation?.id === conversationId ? null : state.activeConversation,
        };
      });
    } catch (err: any) {
      set({ error: err.response?.data?.detail || 'Failed to archive conversation' });
    }
  },

  unarchiveConversation: async (conversationId) => {
    try {
      await api.post(`/messages/conversations/${conversationId}/unarchive`);

      set((state) => {
        const unarchivedConv = state.archivedConversations.find((c) => c.id === conversationId);
        return {
          archivedConversations: state.archivedConversations.filter((c) => c.id !== conversationId),
          conversations: unarchivedConv
            ? [{ ...unarchivedConv, is_archived: false }, ...state.conversations]
            : state.conversations,
        };
      });
    } catch (err: any) {
      set({ error: err.response?.data?.detail || 'Failed to unarchive conversation' });
    }
  },

  muteConversation: async (conversationId, muted) => {
    try {
      await api.post(`/messages/conversations/${conversationId}/mute`, null, {
        params: { muted },
      });
    } catch (err: any) {
      set({ error: err.response?.data?.detail || 'Failed to update mute settings' });
    }
  },

  pinConversation: async (conversationId, pinned) => {
    try {
      await api.post(`/messages/conversations/${conversationId}/pin`, null, {
        params: { pinned },
      });
    } catch (err: any) {
      set({ error: err.response?.data?.detail || 'Failed to update pin settings' });
    }
  },

  removeGroupMember: async (conversationId, memberId) => {
    try {
      await api.delete(`/messages/conversations/${conversationId}/members/${memberId}`);

      // Update local state - remove member from participants
      set((state) => {
        const updatedConversations = state.conversations.map((conv) => {
          if (conv.id === conversationId) {
            return {
              ...conv,
              participants: conv.participants.filter((p) => p.user_id !== memberId),
            };
          }
          return conv;
        });

        const activeConversation = state.activeConversation?.id === conversationId
          ? {
              ...state.activeConversation,
              participants: state.activeConversation.participants.filter((p) => p.user_id !== memberId),
            }
          : state.activeConversation;

        return { conversations: updatedConversations, activeConversation };
      });

      return true;
    } catch (err: any) {
      set({ error: err.response?.data?.detail || 'Failed to remove member' });
      return false;
    }
  },

  addGroupMembers: async (conversationId, participants) => {
    try {
      const response = await api.post(`/messages/conversations/${conversationId}/members`, {
        participants,
      });

      // Refresh conversation to get updated participants
      const convResponse = await api.get(`/messages/conversations/${conversationId}`);
      const updatedConv = convResponse.data;

      set((state) => {
        const updatedConversations = state.conversations.map((conv) =>
          conv.id === conversationId ? updatedConv : conv
        );

        const activeConversation = state.activeConversation?.id === conversationId
          ? updatedConv
          : state.activeConversation;

        return { conversations: updatedConversations, activeConversation };
      });

      return true;
    } catch (err: any) {
      set({ error: err.response?.data?.detail || 'Failed to add members' });
      return false;
    }
  },

  updateGroupDetails: async (conversationId, name, description) => {
    try {
      const response = await api.put(`/messages/conversations/${conversationId}`, {
        name,
        description,
      });

      const updatedConv = response.data;

      set((state) => {
        const updatedConversations = state.conversations.map((conv) =>
          conv.id === conversationId ? updatedConv : conv
        );

        const activeConversation = state.activeConversation?.id === conversationId
          ? updatedConv
          : state.activeConversation;

        return { conversations: updatedConversations, activeConversation };
      });

      return true;
    } catch (err: any) {
      set({ error: err.response?.data?.detail || 'Failed to update group' });
      return false;
    }
  },

  updateGroupAvatar: async (conversationId, file) => {
    try {
      const formData = new FormData();
      formData.append('avatar', file);

      // Use axios directly to avoid Content-Type header issues with FormData
      const token = typeof window !== 'undefined' ? localStorage.getItem('auth_token') : null;
      const res = await axios.put(
        `/api/v1/messages/conversations/${conversationId}/avatar`,
        formData,
        {
          headers: {
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
          withCredentials: true,
        }
      );

      // Update the conversation in local state
      set((state) => ({
        conversations: state.conversations.map((c) =>
          c.id === conversationId ? { ...c, avatar_url: res.data.avatar_url } : c
        ),
        activeConversation:
          state.activeConversation?.id === conversationId
            ? { ...state.activeConversation, avatar_url: res.data.avatar_url }
            : state.activeConversation,
      }));
    } catch (err: any) {
      set({ error: err.response?.data?.detail || 'Failed to update avatar' });
      throw err;
    }
  },

  fetchArchivedConversations: async () => {
    try {
      const res = await api.get('/messages/conversations', {
        params: { archived_only: true },
      });
      const data = res.data;
      set({ archivedConversations: data.conversations || data });
    } catch (err: any) {
      console.error('Failed to fetch archived conversations:', err);
    }
  },

  setShowArchived: (show) => set({ showArchived: show }),

  fetchSharedFiles: async (conversationId) => {
    try {
      const res = await api.get(`/messages/conversations/${conversationId}/files`);
      set({ sharedFiles: res.data });
    } catch (err: any) {
      console.error('Failed to fetch shared files:', err);
    }
  },

  fetchConversationStats: async (conversationId) => {
    try {
      const res = await api.get(`/messages/conversations/${conversationId}/stats`);
      set({ conversationStats: res.data });
    } catch (err: any) {
      console.error('Failed to fetch conversation stats:', err);
    }
  },

  setInfoPanelOpen: (open) => {
    set({ infoPanelOpen: open });
    // Fetch data when opening panel
    if (open) {
      const activeConv = get().activeConversation;
      if (activeConv) {
        get().fetchSharedFiles(activeConv.id);
        get().fetchConversationStats(activeConv.id);
      }
    } else {
      // Clear data when closing panel
      set({ sharedFiles: null, conversationStats: null });
    }
  },

  leaveConversation: async (conversationId) => {
    try {
      await api.post(`/messages/conversations/${conversationId}/leave`);

      set((state) => ({
        conversations: state.conversations.filter((c) => c.id !== conversationId),
        activeConversation: state.activeConversation?.id === conversationId ? null : state.activeConversation,
      }));
    } catch (err: any) {
      set({ error: err.response?.data?.detail || 'Failed to leave conversation' });
    }
  },

  // ============================================
  // EXTERNAL CONTACTS
  // ============================================

  fetchExternalContacts: async () => {
    try {
      const res = await api.get('/messages/contacts');
      set({ externalContacts: res.data });
    } catch (err: any) {
      console.error('Failed to fetch external contacts:', err);
    }
  },

  createExternalContact: async (contact) => {
    try {
      const res = await api.post('/messages/contacts', contact);
      const newContact = res.data;

      set((state) => ({
        externalContacts: [newContact, ...state.externalContacts],
      }));

      return newContact;
    } catch (err: any) {
      set({ error: err.response?.data?.detail || 'Failed to create contact' });
      return null;
    }
  },

  inviteExternalContact: async (conversationId, email, name, message) => {
    try {
      await api.post('/messages/invitations', {
        conversation_id: conversationId,
        email,
        name,
        message,
      });
    } catch (err: any) {
      set({ error: err.response?.data?.detail || 'Failed to send invitation' });
      throw err;
    }
  },

  // ============================================
  // TEAM MEMBERS
  // ============================================

  searchTeamMembers: async (query) => {
    try {
      const res = await api.get('/messages/team/search', { params: { q: query || '' } });
      set({ teamMembers: res.data });
    } catch (err: any) {
      console.error('Failed to search team members:', err);
    }
  },

  // ============================================
  // READ RECEIPTS
  // ============================================

  markAsRead: async (conversationId, messageId) => {
    try {
      const res = await api.post(`/messages/conversations/${conversationId}/read`, {
        message_id: messageId,
      });

      const markedIds = res.data.marked_message_ids || [];

      // Broadcast read receipt to other participants via LiveKit
      const { broadcastReadReceiptFn } = get();
      if (broadcastReadReceiptFn && markedIds.length > 0) {
        broadcastReadReceiptFn(markedIds);
      }

      set((state) => {
        const currentUnread = state.unreadCounts[conversationId] || 0;
        return {
          unreadCounts: {
            ...state.unreadCounts,
            [conversationId]: 0,
          },
          totalUnread: Math.max(0, state.totalUnread - currentUnread),
        };
      });

      return markedIds;
    } catch (err) {
      console.error('Failed to mark as read:', err);
      return [];
    }
  },

  fetchUnreadCounts: async () => {
    try {
      const res = await api.get('/messages/unread');
      set({
        unreadCounts: res.data.conversations || {},
        totalUnread: res.data.total || 0,
      });
    } catch (err) {
      console.error('Failed to fetch unread counts:', err);
    }
  },

  markMessagesDelivered: async (conversationId, messageIds) => {
    try {
      await api.post(`/messages/conversations/${conversationId}/delivered`, {
        message_ids: messageIds,
      });
    } catch (err) {
      console.error('Failed to mark messages as delivered:', err);
    }
  },

  fetchMessageReadReceipts: async (messageId) => {
    try {
      const res = await api.get(`/messages/messages/${messageId}/read-receipts`);
      return res.data;
    } catch (err) {
      console.error('Failed to fetch read receipts:', err);
      return null;
    }
  },

  updateMessageDelivery: (conversationId, messageId, userId) => {
    set((state) => {
      const messages = state.messages[conversationId] || [];
      const updatedMessages = messages.map((msg) => {
        if (msg.id === messageId && !msg.delivered_to.includes(userId)) {
          return {
            ...msg,
            delivered_to: [...msg.delivered_to, userId],
          };
        }
        return msg;
      });

      return {
        messages: {
          ...state.messages,
          [conversationId]: updatedMessages,
        },
      };
    });
  },

  updateMessageReadBy: (conversationId, messageId, userId) => {
    set((state) => {
      const messages = state.messages[conversationId] || [];
      const updatedMessages = messages.map((msg) => {
        if (msg.id === messageId && !msg.read_by.includes(userId)) {
          return {
            ...msg,
            read_by: [...msg.read_by, userId],
          };
        }
        return msg;
      });

      return {
        messages: {
          ...state.messages,
          [conversationId]: updatedMessages,
        },
      };
    });
  },

  // Presence tracking
  sendPresenceHeartbeat: async () => {
    try {
      await api.post('/messages/presence/heartbeat');
    } catch (err) {
      console.error('Failed to send presence heartbeat:', err);
    }
  },

  fetchConversationPresence: async (conversationId) => {
    try {
      const res = await api.get(`/messages/conversations/${conversationId}/presence`);
      set((state) => ({
        participantPresence: {
          ...state.participantPresence,
          [conversationId]: res.data.participants || [],
        },
      }));
    } catch (err) {
      console.error('Failed to fetch conversation presence:', err);
    }
  },

  updateParticipantPresence: (conversationId, userId, lastSeen, isOnline) => {
    set((state) => {
      const presenceList = state.participantPresence[conversationId] || [];
      const updatedPresence = presenceList.map((p) => {
        if (p.user_id === userId) {
          return { ...p, last_seen_at: lastSeen, is_online: isOnline };
        }
        return p;
      });

      return {
        participantPresence: {
          ...state.participantPresence,
          [conversationId]: updatedPresence,
        },
      };
    });
  },

  // ============================================
  // CALLS
  // ============================================

  initiateCall: async (conversationId, callType) => {
    try {
      // First initiate the call
      const res = await api.post(`/messages/calls/initiate`, {
        conversation_id: conversationId,
        call_type: callType,
      });

      const call = res.data;
      set({ activeCall: call });

      // Then fetch the token for the call
      const tokenRes = await api.post(`/messages/calls/${call.id}/token`);

      return {
        call,
        token: tokenRes.data.token,
        wsUrl: tokenRes.data.ws_url,
        roomName: tokenRes.data.room_name,
      };
    } catch (err: any) {
      set({ error: err.response?.data?.detail || 'Failed to initiate call' });
      return null;
    }
  },

  answerCall: async (callId) => {
    try {
      // First answer the call
      const res = await api.post(`/messages/calls/${callId}/answer`);
      const call = res.data;

      set({ activeCall: call, incomingCall: null });

      // Then fetch the token for the call
      const tokenRes = await api.post(`/messages/calls/${callId}/token`);

      return {
        call,
        token: tokenRes.data.token,
        wsUrl: tokenRes.data.ws_url,
        roomName: tokenRes.data.room_name,
      };
    } catch (err: any) {
      set({ error: err.response?.data?.detail || 'Failed to answer call' });
      return null;
    }
  },

  endCall: async (callId, reason) => {
    try {
      await api.post(`/messages/calls/${callId}/end`, { reason });
      set({ activeCall: null });
    } catch (err: any) {
      set({ error: err.response?.data?.detail || 'Failed to end call' });
    }
  },

  declineCall: async (callId) => {
    try {
      await api.post(`/messages/calls/${callId}/decline`);
      set({ incomingCall: null });
    } catch (err: any) {
      set({ error: err.response?.data?.detail || 'Failed to decline call' });
    }
  },

  getCallToken: async (callId) => {
    try {
      const res = await api.post(`/messages/calls/${callId}/token`);
      return {
        token: res.data.token,
        wsUrl: res.data.ws_url,
        roomName: res.data.room_name,
      };
    } catch (err: any) {
      console.error('Failed to get call token:', err);
      return null;
    }
  },

  // ============================================
  // REAL-TIME CONNECTION
  // ============================================

  fetchChatToken: async (conversationId) => {
    try {
      const res = await api.post(`/messages/conversations/${conversationId}/token`);
      set({
        chatToken: res.data.token,
        wsUrl: res.data.ws_url,
      });
      return res.data;
    } catch (err) {
      console.error('Failed to fetch chat token:', err);
      return null;
    }
  },

  setConnected: (connected) => set({ isConnected: connected }),

  setBroadcastMessageFn: (fn) => set({ broadcastMessageFn: fn }),
  setBroadcastDeleteFn: (fn) => set({ broadcastDeleteFn: fn }),
  setBroadcastEditFn: (fn) => set({ broadcastEditFn: fn }),
  setBroadcastTypingFn: (fn) => set({ broadcastTypingFn: fn }),
  setBroadcastReadReceiptFn: (fn) => set({ broadcastReadReceiptFn: fn }),

  // ============================================
  // REAL-TIME MESSAGE HANDLING
  // ============================================

  addMessage: (message) => {
    set((state) => {
      const conversationId = message.conversation_id;
      const existingMessages = state.messages[conversationId] || [];

      // Check for duplicate
      if (existingMessages.some((m) => m.id === message.id)) {
        return state;
      }

      // Update unread count if not the active conversation
      let unreadCounts = state.unreadCounts;
      let totalUnread = state.totalUnread;
      if (state.activeConversation?.id !== conversationId) {
        const currentCount = unreadCounts[conversationId] || 0;
        unreadCounts = { ...unreadCounts, [conversationId]: currentCount + 1 };
        totalUnread = totalUnread + 1;
      }

      // Update conversation's last message preview
      const conversations = state.conversations.map((c) => {
        if (c.id === conversationId) {
          // Generate appropriate preview text
          let preview = message.content?.substring(0, 100) || '';
          if (!preview && message.attachments?.length > 0) {
            const firstAttachment = message.attachments[0];
            if (firstAttachment.file_type?.startsWith('audio/')) {
              preview = '🎤 Voice message';
            } else if (firstAttachment.file_type?.startsWith('image/')) {
              preview = '📷 Photo';
            } else if (firstAttachment.file_type?.startsWith('video/')) {
              preview = '🎬 Video';
            } else {
              preview = '📎 ' + firstAttachment.file_name;
            }
          }

          return {
            ...c,
            last_message_at: message.created_at,
            last_message_preview: preview,
            last_message_sender_name: message.sender_name,
          };
        }
        return c;
      });

      // Move conversation to top
      const sortedConversations = [...conversations].sort((a, b) => {
        const aTime = a.last_message_at ? new Date(a.last_message_at).getTime() : 0;
        const bTime = b.last_message_at ? new Date(b.last_message_at).getTime() : 0;
        return bTime - aTime;
      });

      return {
        messages: {
          ...state.messages,
          [conversationId]: [...existingMessages, message],
        },
        conversations: sortedConversations,
        unreadCounts,
        totalUnread,
      };
    });
  },

  updateMessage: (message) => {
    set((state) => ({
      messages: {
        ...state.messages,
        [message.conversation_id]: (state.messages[message.conversation_id] || []).map((m) =>
          m.id === message.id ? message : m
        ),
      },
    }));
  },

  removeMessage: (conversationId, messageId) => {
    set((state) => ({
      messages: {
        ...state.messages,
        [conversationId]: (state.messages[conversationId] || []).map((m) =>
          m.id === messageId ? { ...m, is_deleted: true, content: undefined } : m
        ),
      },
    }));
  },

  setTyping: (conversationId, userId, userName, isTyping) => {
    set((state) => {
      const conversationTyping = state.typingUsers[conversationId] || {};

      if (isTyping) {
        return {
          typingUsers: {
            ...state.typingUsers,
            [conversationId]: { ...conversationTyping, [userId]: userName },
          },
        };
      } else {
        const { [userId]: _, ...remaining } = conversationTyping;
        return {
          typingUsers: {
            ...state.typingUsers,
            [conversationId]: remaining,
          },
        };
      }
    });
  },

  setUserOnline: (userId, isOnline) => {
    set((state) => {
      const newOnlineUsers = new Set(state.onlineUsers);
      if (isOnline) {
        newOnlineUsers.add(userId);
      } else {
        newOnlineUsers.delete(userId);
      }
      return { onlineUsers: newOnlineUsers };
    });
  },

  setIncomingCall: (call) => set({ incomingCall: call }),

  // ============================================
  // UI ACTIONS
  // ============================================

  setActiveTab: (tab) => {
    set({ activeTab: tab });
    // Fetch conversations for the selected tab (filters are applied in fetchConversations)
    get().fetchConversations();

    // Also fetch archived conversations when on 'all' tab
    if (tab === 'all') {
      get().fetchArchivedConversations();
    }
  },

  setSearchQuery: (query) => set({ searchQuery: query }),

  clearError: () => set({ error: null }),

  reset: () =>
    set({
      conversations: [],
      archivedConversations: [],
      activeConversation: null,
      messages: {},
      externalContacts: [],
      teamMembers: [],
      sharedFiles: null,
      conversationStats: null,
      chatToken: null,
      wsUrl: null,
      isConnected: false,
      typingUsers: {},
      onlineUsers: new Set(),
      participantPresence: {},
      unreadCounts: {},
      totalUnread: 0,
      activeCall: null,
      incomingCall: null,
      error: null,
      activeTab: 'all',
      showArchived: false,
      infoPanelOpen: false,
      searchQuery: '',
      searchResults: [],
    }),
}));

// ============================================
// HELPER HOOKS
// ============================================

/**
 * Get the other participant in a direct conversation
 */
export const useOtherParticipant = (conversation: Conversation | null, currentUserId: string) => {
  if (!conversation || conversation.type !== 'direct') return null;
  return conversation.participants.find((p) => p.user_id !== currentUserId);
};

/**
 * Get conversation display name
 */
export const useConversationDisplayName = (
  conversation: Conversation | null,
  currentUserId: string
): string => {
  if (!conversation) return '';

  if (conversation.type === 'group') {
    return conversation.name || 'Unnamed Group';
  }

  // For direct conversations, show the other person's name
  const other = conversation.participants.find((p) => p.user_id !== currentUserId);
  return other?.user_name || 'Unknown';
};

/**
 * Get typing indicator text
 */
export const useTypingIndicator = (conversationId: string): string => {
  const typingUsers = useChatStore((state) => state.typingUsers[conversationId] || {});
  const names = Object.values(typingUsers);

  if (names.length === 0) return '';
  if (names.length === 1) return `${names[0]} is typing...`;
  if (names.length === 2) return `${names[0]} and ${names[1]} are typing...`;
  return `${names.length} people are typing...`;
};
