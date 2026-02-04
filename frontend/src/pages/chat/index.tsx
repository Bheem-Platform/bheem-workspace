/**
 * Bheem Workspace - Native Chat System
 * Real-time messaging with Team (internal) and Connect (external) tabs
 */

'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/router';
import { MessageCircle, Loader2 } from 'lucide-react';
import { useAuthStore, useRequireAuth } from '@/stores/authStore';
import {
  useChatStore,
  useTypingIndicator,
  type Conversation,
  type CallLog,
} from '@/stores/chatStore';
import WorkspaceLayout from '@/components/workspace/WorkspaceLayout';
import {
  ConversationList,
  MessageThread,
  ChatHeader,
  NewChatModal,
  ChatLiveKitProvider,
  CallModal,
  IncomingCallModal,
  ConversationInfoPanel,
  ReadReceiptsModal,
} from '@/components/chat';
import { api } from '@/lib/api';

export default function ChatPage() {
  const router = useRouter();
  const { user } = useAuthStore();
  const { isAuthenticated, isLoading: authLoading } = useRequireAuth();

  const {
    activeConversation,
    messages,
    isLoading,
    isSending,
    error,
    activeTab,
    onlineUsers,
    infoPanelOpen,
    fetchConversations,
    fetchMessages,
    fetchUnreadCounts,
    fetchChatToken,
    sendMessage,
    editMessage,
    deleteMessage,
    addReaction,
    archiveConversation,
    leaveConversation,
    markAsRead,
    setActiveConversation,
    setInfoPanelOpen,
    chatToken,
    wsUrl,
  } = useChatStore();

  const [showNewChatModal, setShowNewChatModal] = useState(false);
  const [liveKitReady, setLiveKitReady] = useState(false);

  // Read receipts modal state
  const [readReceiptsMessageId, setReadReceiptsMessageId] = useState<string | null>(null);

  // Call state
  const [isCallActive, setIsCallActive] = useState(false);
  const [currentCall, setCurrentCall] = useState<CallLog | null>(null);
  const [callToken, setCallToken] = useState<string | null>(null);
  const [callWsUrl, setCallWsUrl] = useState<string | null>(null);
  const [callType, setCallType] = useState<'audio' | 'video'>('audio');
  const [isInitiatingCall, setIsInitiatingCall] = useState(false);

  // Incoming call state (from store)
  const { activeCall, incomingCall, initiateCall, answerCall, endCall, declineCall, setIncomingCall } = useChatStore();

  // Get typing indicator text for active conversation
  const typingText = useTypingIndicator(activeConversation?.id || '');

  // Current user ID
  const currentUserId = user?.id || user?.user_id || '';

  // Initialize chat on mount
  useEffect(() => {
    if (!isAuthenticated || authLoading || !currentUserId) return;

    // Fetch conversations for the default tab (all)
    fetchConversations();
    fetchUnreadCounts();
  }, [isAuthenticated, authLoading, currentUserId, fetchConversations, fetchUnreadCounts]);

  // Poll for unread counts only (not full conversation refresh to avoid UI flicker)
  // This ensures unread counts update even when not connected to a specific LiveKit room
  useEffect(() => {
    if (!isAuthenticated || authLoading || !currentUserId) return;

    // Poll every 10 seconds for unread counts only (lightweight)
    const pollInterval = setInterval(() => {
      fetchUnreadCounts();
    }, 10000);

    return () => clearInterval(pollInterval);
  }, [isAuthenticated, authLoading, currentUserId, fetchUnreadCounts]);

  // Fetch LiveKit token when conversation changes
  useEffect(() => {
    if (activeConversation && currentUserId) {
      fetchChatToken(activeConversation.id).then(() => {
        setLiveKitReady(true);
      });
    } else {
      setLiveKitReady(false);
    }
  }, [activeConversation?.id, currentUserId, fetchChatToken]);

  // Check if other user in direct chat is online
  const isOtherUserOnline = useCallback(
    (conversation: Conversation | null) => {
      if (!conversation || conversation.type !== 'direct') return false;
      const other = conversation.participants.find((p) => p.user_id !== currentUserId);
      return other?.user_id ? onlineUsers.has(other.user_id) : false;
    },
    [currentUserId, onlineUsers]
  );

  // Handle sending message
  const handleSendMessage = useCallback(
    async (content: string, files?: File[], replyToId?: string) => {
      if (!activeConversation) return;
      await sendMessage(activeConversation.id, content, files, replyToId);
    },
    [activeConversation, sendMessage]
  );

  // Handle edit message
  const handleEditMessage = useCallback(
    async (messageId: string, content: string) => {
      if (!activeConversation) return;
      await editMessage(activeConversation.id, messageId, content);
    },
    [activeConversation, editMessage]
  );

  // Handle delete message
  const handleDeleteMessage = useCallback(
    async (messageId: string) => {
      if (!activeConversation) return;
      await deleteMessage(activeConversation.id, messageId);
    },
    [activeConversation, deleteMessage]
  );

  // Handle reaction
  const handleReaction = useCallback(
    async (messageId: string, emoji: string) => {
      if (!activeConversation) return;
      await addReaction(activeConversation.id, messageId, emoji);
    },
    [activeConversation, addReaction]
  );

  // Handle typing indicator - broadcast via LiveKit
  const { broadcastTypingFn } = useChatStore();
  const handleTyping = useCallback((isTyping: boolean) => {
    if (broadcastTypingFn) {
      broadcastTypingFn(isTyping);
    }
  }, [broadcastTypingFn]);

  // Handle load more messages
  const handleLoadMore = useCallback(() => {
    if (!activeConversation) return;
    const currentMessages = messages[activeConversation.id] || [];
    if (currentMessages.length > 0) {
      fetchMessages(activeConversation.id, currentMessages[0].id);
    }
  }, [activeConversation, messages, fetchMessages]);

  // Handle audio/video calls
  const handleAudioCall = useCallback(async () => {
    if (!activeConversation || isInitiatingCall) return;

    setIsInitiatingCall(true);
    setCallType('audio');

    try {
      // Initiate call via store
      const result = await initiateCall(activeConversation.id, 'audio');

      if (result) {
        setCurrentCall(result.call);
        setCallToken(result.token);
        setCallWsUrl(result.wsUrl);
        setIsCallActive(true);
      }
    } catch (error) {
      console.error('Failed to initiate audio call:', error);
    } finally {
      setIsInitiatingCall(false);
    }
  }, [activeConversation, isInitiatingCall, initiateCall]);

  const handleVideoCall = useCallback(async () => {
    if (!activeConversation || isInitiatingCall) return;

    setIsInitiatingCall(true);
    setCallType('video');

    try {
      // Initiate call via store
      const result = await initiateCall(activeConversation.id, 'video');

      if (result) {
        setCurrentCall(result.call);
        setCallToken(result.token);
        setCallWsUrl(result.wsUrl);
        setIsCallActive(true);
      }
    } catch (error) {
      console.error('Failed to initiate video call:', error);
    } finally {
      setIsInitiatingCall(false);
    }
  }, [activeConversation, isInitiatingCall, initiateCall]);

  // Handle answering incoming call
  const handleAnswerCall = useCallback(async () => {
    if (!incomingCall) return;

    try {
      const result = await answerCall(incomingCall.id);

      if (result) {
        setCurrentCall(result.call);
        setCallToken(result.token);
        setCallWsUrl(result.wsUrl);
        setCallType(result.call.call_type as 'audio' | 'video');
        setIsCallActive(true);
      }
    } catch (error) {
      console.error('Failed to answer call:', error);
    }
  }, [incomingCall, answerCall]);

  // Handle declining incoming call
  const handleDeclineCall = useCallback(async () => {
    if (!incomingCall) return;

    try {
      await declineCall(incomingCall.id);
    } catch (error) {
      console.error('Failed to decline call:', error);
    }
  }, [incomingCall, declineCall]);

  // Handle ending active call
  const handleEndCall = useCallback(async () => {
    if (!currentCall) return;

    try {
      await endCall(currentCall.id);
    } catch (error) {
      console.error('Failed to end call:', error);
    } finally {
      setIsCallActive(false);
      setCurrentCall(null);
      setCallToken(null);
      setCallWsUrl(null);
    }
  }, [currentCall, endCall]);

  // Close call modal
  const handleCloseCallModal = useCallback(() => {
    if (currentCall) {
      handleEndCall();
    } else {
      setIsCallActive(false);
    }
  }, [currentCall, handleEndCall]);

  // Close incoming call modal
  const handleCloseIncomingCall = useCallback(() => {
    setIncomingCall(null);
  }, [setIncomingCall]);

  // Get other participant name for call display
  const getOtherParticipantName = useCallback(() => {
    if (!activeConversation) return 'Unknown';
    if (activeConversation.type === 'group') return activeConversation.name || 'Group Call';
    const other = activeConversation.participants.find((p) => p.user_id !== currentUserId);
    return other?.user_name || 'Unknown';
  }, [activeConversation, currentUserId]);

  // Get caller name for incoming call
  const getCallerName = useCallback(() => {
    return incomingCall?.caller_name || 'Unknown';
  }, [incomingCall]);

  // Handle archive
  const handleArchive = useCallback(async () => {
    if (!activeConversation) return;
    await archiveConversation(activeConversation.id);
  }, [activeConversation, archiveConversation]);

  // Handle leave group
  const handleLeave = useCallback(async () => {
    if (!activeConversation) return;
    await leaveConversation(activeConversation.id);
  }, [activeConversation, leaveConversation]);

  // Handle view info panel
  const handleViewInfo = useCallback(() => {
    setInfoPanelOpen(true);
  }, [setInfoPanelOpen]);

  // Handle show read receipts modal
  const handleShowReadReceipts = useCallback((messageId: string) => {
    setReadReceiptsMessageId(messageId);
  }, []);

  // Handle close info panel
  const handleCloseInfoPanel = useCallback(() => {
    setInfoPanelOpen(false);
  }, [setInfoPanelOpen]);

  // Loading state
  if (authLoading) {
    return (
      <WorkspaceLayout title="Chat">
        <div className="flex items-center justify-center h-[calc(100vh-10rem)]">
          <div className="text-center">
            <Loader2 size={40} className="animate-spin text-[#977DFF] mx-auto mb-4" />
            <p className="text-gray-600">Loading Chat...</p>
          </div>
        </div>
      </WorkspaceLayout>
    );
  }

  // Get messages for active conversation
  const conversationMessages = activeConversation
    ? messages[activeConversation.id] || []
    : [];

  // Render content with or without LiveKit provider
  const renderChatContent = () => {
    if (!activeConversation) {
      return (
        <div className="flex-1 flex items-center justify-center bg-gray-50">
          <div className="text-center">
            <div className="w-20 h-20 bg-orange-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <MessageCircle size={40} className="text-orange-600" />
            </div>
            <h2 className="text-xl font-semibold text-gray-900 mb-2">
              Welcome to Bheem Chat
            </h2>
            <p className="text-gray-500 mb-4 max-w-sm">
              Select a conversation from the sidebar or start a new chat to begin messaging.
            </p>
            <button
              onClick={() => setShowNewChatModal(true)}
              className="px-6 py-2 bg-orange-500 text-white rounded-lg font-medium hover:bg-orange-600 transition-colors"
            >
              Start New Chat
            </button>
          </div>
        </div>
      );
    }

    const chatContent = (
      <div className="flex-1 flex flex-col h-full">
        {/* Chat header */}
        <ChatHeader
          conversation={activeConversation}
          currentUserId={currentUserId}
          isOnline={isOtherUserOnline(activeConversation)}
          typingText={typingText}
          onAudioCall={handleAudioCall}
          onVideoCall={handleVideoCall}
          onArchive={handleArchive}
          onLeave={handleLeave}
          onViewInfo={handleViewInfo}
        />

        {/* Message thread */}
        <div className="flex-1 overflow-hidden relative">
          <MessageThread
            conversation={activeConversation}
            messages={conversationMessages}
            currentUserId={currentUserId}
            typingText={typingText}
            isLoading={isLoading}
            isSending={isSending}
            onSendMessage={handleSendMessage}
            onEditMessage={handleEditMessage}
            onDeleteMessage={handleDeleteMessage}
            onReaction={handleReaction}
            onTyping={handleTyping}
            onLoadMore={handleLoadMore}
            hasMoreMessages={conversationMessages.length >= 50}
            onShowReadReceipts={handleShowReadReceipts}
          />
        </div>
      </div>
    );

    // Wrap with LiveKit provider if we have a token
    if (liveKitReady && chatToken && wsUrl) {
      return (
        <ChatLiveKitProvider
          conversationId={activeConversation.id}
          token={chatToken}
          wsUrl={wsUrl}
          currentUserId={currentUserId}
          currentUserName={user?.username || 'User'}
        >
          {chatContent}
        </ChatLiveKitProvider>
      );
    }

    return chatContent;
  };

  return (
    <WorkspaceLayout title="Chat">
      <div className="h-[calc(100vh-8rem)] flex bg-white rounded-xl shadow-sm overflow-hidden -m-4 lg:-m-6">
        {/* Conversation list sidebar */}
        <div className="w-80 flex-shrink-0 border-r border-gray-200">
          <ConversationList
            currentUserId={currentUserId}
            onNewChat={() => setShowNewChatModal(true)}
          />
        </div>

        {/* Main chat area */}
        {renderChatContent()}
      </div>

      {/* New chat modal */}
      <NewChatModal
        isOpen={showNewChatModal}
        onClose={() => setShowNewChatModal(false)}
        activeTab={activeTab}
        currentUserId={currentUserId}
      />

      {/* Error toast */}
      {error && (
        <div className="fixed bottom-4 right-4 bg-red-500 text-white px-4 py-2 rounded-lg shadow-lg">
          {error}
        </div>
      )}

      {/* Call Modal */}
      <CallModal
        isOpen={isCallActive}
        call={currentCall}
        token={callToken}
        wsUrl={callWsUrl}
        callType={callType}
        participantName={user?.username || 'You'}
        otherParticipantName={getOtherParticipantName()}
        onEndCall={handleEndCall}
        onClose={handleCloseCallModal}
      />

      {/* Incoming Call Modal */}
      <IncomingCallModal
        isOpen={!!incomingCall}
        call={incomingCall}
        callerName={getCallerName()}
        onAnswer={handleAnswerCall}
        onDecline={handleDeclineCall}
        onClose={handleCloseIncomingCall}
      />

      {/* Conversation Info Panel */}
      {activeConversation && (
        <ConversationInfoPanel
          conversation={activeConversation}
          currentUserId={currentUserId}
          isOpen={infoPanelOpen}
          onClose={handleCloseInfoPanel}
        />
      )}

      {/* Read Receipts Modal */}
      <ReadReceiptsModal
        messageId={readReceiptsMessageId || ''}
        isOpen={!!readReceiptsMessageId}
        onClose={() => setReadReceiptsMessageId(null)}
      />

      {/* Call initiating indicator */}
      {isInitiatingCall && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/50">
          <div className="bg-white rounded-lg p-6 text-center">
            <Loader2 size={32} className="animate-spin text-[#977DFF] mx-auto mb-3" />
            <p className="text-gray-700">Starting call...</p>
          </div>
        </div>
      )}
    </WorkspaceLayout>
  );
}
