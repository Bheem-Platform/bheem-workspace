/**
 * Message thread - main chat area with messages
 */

import { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import { ArrowDown } from 'lucide-react';
import { useChatStore, type Message, type Conversation } from '@/stores/chatStore';
import MessageBubble from './MessageBubble';
import TypingIndicator from './TypingIndicator';
import MessageInput from './MessageInput';
import MediaViewer, { type MediaItem } from './MediaViewer';
import ForwardMessageModal from './ForwardMessageModal';

interface MessageThreadProps {
  conversation: Conversation;
  messages: Message[];
  currentUserId: string;
  typingText: string;
  isLoading?: boolean;
  isSending?: boolean;
  onSendMessage: (content: string, files?: File[], replyToId?: string) => void;
  onEditMessage: (messageId: string, content: string) => void;
  onDeleteMessage: (messageId: string) => void;
  onReaction: (messageId: string, emoji: string) => void;
  onTyping: (isTyping: boolean) => void;
  onLoadMore: () => void;
  hasMoreMessages?: boolean;
  onShowReadReceipts?: (messageId: string) => void;
}

export default function MessageThread({
  conversation,
  messages,
  currentUserId,
  typingText,
  isLoading = false,
  isSending = false,
  onSendMessage,
  onEditMessage,
  onDeleteMessage,
  onReaction,
  onTyping,
  onLoadMore,
  hasMoreMessages = false,
  onShowReadReceipts,
}: MessageThreadProps) {
  // Calculate total participants (excluding sender) for read receipts display
  const totalParticipants = conversation.participants.length - 1;
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const [showScrollButton, setShowScrollButton] = useState(false);
  const [replyingTo, setReplyingTo] = useState<Message | null>(null);
  const [editingMessage, setEditingMessage] = useState<Message | null>(null);
  const [mediaViewerOpen, setMediaViewerOpen] = useState(false);
  const [mediaViewerIndex, setMediaViewerIndex] = useState(0);
  const [currentMediaItems, setCurrentMediaItems] = useState<MediaItem[]>([]);
  const [forwardingMessage, setForwardingMessage] = useState<Message | null>(null);

  // Get forwardMessage from store
  const { forwardMessage } = useChatStore();

  // Collect all media items from messages for the viewer
  const allMediaItems = useMemo<MediaItem[]>(() => {
    const items: MediaItem[] = [];
    messages.forEach((msg) => {
      if (msg.attachments && msg.attachments.length > 0) {
        msg.attachments.forEach((att) => {
          // Include images and videos
          if (att.file_type?.startsWith('image/') || att.file_type?.startsWith('video/')) {
            items.push({
              id: att.id,
              url: att.file_url,
              thumbnailUrl: att.thumbnail_url,
              fileName: att.file_name,
              fileType: att.file_type || 'application/octet-stream',
              fileSize: att.file_size,
              senderName: msg.sender_name,
              timestamp: msg.created_at,
            });
          }
        });
      }
    });
    return items;
  }, [messages]);

  // Handle image click - find index and open viewer
  const handleMediaClick = useCallback((url: string) => {
    // Try to find the item in collection
    let index = allMediaItems.findIndex((item) => item.url === url);
    let itemsToShow = [...allMediaItems];

    // If not found, try matching by filename or partial URL
    if (index < 0) {
      const urlFileName = url.split('/').pop() || '';
      index = allMediaItems.findIndex((item) =>
        item.fileName === urlFileName || item.url.includes(urlFileName)
      );
    }

    // If still not found but we have a URL, create a single-item viewer
    if (index < 0 && url) {
      const fileName = url.split('/').pop() || 'image';
      const isImage = /\.(jpg|jpeg|png|gif|webp|bmp|svg)$/i.test(url);
      const isVideo = /\.(mp4|webm|ogg|mov|avi)$/i.test(url);

      const tempItem: MediaItem = {
        id: `temp-${Date.now()}`,
        url: url,
        fileName: fileName,
        fileType: isImage ? 'image/jpeg' : isVideo ? 'video/mp4' : 'application/octet-stream',
      };
      itemsToShow = [tempItem];
      index = 0;
    }

    if (index >= 0) {
      setCurrentMediaItems(itemsToShow);
      setMediaViewerIndex(index);
      setMediaViewerOpen(true);
    }
  }, [allMediaItems]);

  // Auto-scroll to bottom on new messages
  const scrollToBottom = useCallback((behavior: ScrollBehavior = 'smooth') => {
    messagesEndRef.current?.scrollIntoView({ behavior });
  }, []);

  useEffect(() => {
    // Scroll to bottom when messages change (new message)
    const container = messagesContainerRef.current;
    if (container) {
      const isAtBottom = container.scrollHeight - container.scrollTop - container.clientHeight < 100;
      if (isAtBottom) {
        scrollToBottom();
      }
    }
  }, [messages, scrollToBottom]);

  // Scroll on first load
  useEffect(() => {
    scrollToBottom('auto');
  }, [conversation.id, scrollToBottom]);

  // Handle scroll position for "scroll to bottom" button
  const handleScroll = useCallback(() => {
    const container = messagesContainerRef.current;
    if (container) {
      const isAtBottom = container.scrollHeight - container.scrollTop - container.clientHeight < 100;
      setShowScrollButton(!isAtBottom);

      // Load more when scrolled to top
      if (container.scrollTop === 0 && hasMoreMessages && !isLoading) {
        onLoadMore();
      }
    }
  }, [hasMoreMessages, isLoading, onLoadMore]);

  // Determine if we should show sender name (for group chats)
  const shouldShowSender = (message: Message, index: number) => {
    if (conversation.type !== 'group') return false;
    if (message.sender_id === currentUserId) return false;
    if (index === 0) return true;

    const prevMessage = messages[index - 1];
    return prevMessage.sender_id !== message.sender_id;
  };

  // Determine if we should show date separator
  const shouldShowDateSeparator = (message: Message, index: number) => {
    if (index === 0) return true;

    const prevMessage = messages[index - 1];
    const prevDate = new Date(prevMessage.created_at).toDateString();
    const currDate = new Date(message.created_at).toDateString();

    return prevDate !== currDate;
  };

  const formatDateSeparator = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const yesterday = new Date(now);
    yesterday.setDate(yesterday.getDate() - 1);

    if (date.toDateString() === now.toDateString()) {
      return 'Today';
    }
    if (date.toDateString() === yesterday.toDateString()) {
      return 'Yesterday';
    }
    return date.toLocaleDateString(undefined, {
      weekday: 'long',
      month: 'long',
      day: 'numeric',
      year: date.getFullYear() !== now.getFullYear() ? 'numeric' : undefined,
    });
  };

  const handleSend = (content: string, files?: File[]) => {
    if (editingMessage) {
      onEditMessage(editingMessage.id, content);
      setEditingMessage(null);
    } else {
      onSendMessage(content, files, replyingTo?.id);
      setReplyingTo(null);
    }
  };

  // Handle forward message
  const handleForward = useCallback(async (conversationIds: string[]) => {
    if (!forwardingMessage) return;
    await forwardMessage(forwardingMessage.id, conversationIds);
  }, [forwardingMessage, forwardMessage]);

  return (
    <div className="flex flex-col h-full bg-gray-50">
      {/* Messages area */}
      <div
        ref={messagesContainerRef}
        onScroll={handleScroll}
        className="flex-1 overflow-y-auto py-4"
      >
        {/* Loading indicator at top */}
        {isLoading && (
          <div className="flex justify-center py-4">
            <div className="animate-spin rounded-full h-6 w-6 border-2 border-[#FFCCF2] border-t-[#977DFF] border-r-[#0033FF]" />
          </div>
        )}

        {/* Load more button */}
        {hasMoreMessages && !isLoading && (
          <div className="flex justify-center py-2">
            <button
              onClick={onLoadMore}
              className="text-sm text-[#977DFF] hover:text-[#8066EE] font-medium"
            >
              Load earlier messages
            </button>
          </div>
        )}

        {/* Messages */}
        {messages.length === 0 && !isLoading ? (
          <div className="flex flex-col items-center justify-center h-full text-gray-500">
            <p className="text-lg font-medium">No messages yet</p>
            <p className="text-sm mt-1">Send a message to start the conversation</p>
          </div>
        ) : (
          messages.map((message, index) => (
            <div key={message.id}>
              {/* Date separator */}
              {shouldShowDateSeparator(message, index) && (
                <div className="flex justify-center my-4">
                  <div className="px-3 py-1 rounded-full bg-gray-200 text-gray-600 text-xs font-medium">
                    {formatDateSeparator(message.created_at)}
                  </div>
                </div>
              )}

              <MessageBubble
                message={message}
                isOwnMessage={message.sender_id === currentUserId}
                showSender={shouldShowSender(message, index)}
                isGroupChat={conversation.type === 'group'}
                totalParticipants={totalParticipants}
                onEdit={() => {
                  setEditingMessage(message);
                  setReplyingTo(null);
                }}
                onDelete={() => onDeleteMessage(message.id)}
                onReply={() => {
                  setReplyingTo(message);
                  setEditingMessage(null);
                }}
                onForward={() => setForwardingMessage(message)}
                onReaction={(emoji) => onReaction(message.id, emoji)}
                onImageClick={handleMediaClick}
                onShowReadReceipts={onShowReadReceipts}
              />
            </div>
          ))
        )}

        {/* Typing indicator */}
        <TypingIndicator text={typingText} />

        {/* Scroll anchor */}
        <div ref={messagesEndRef} />
      </div>

      {/* Scroll to bottom button */}
      {showScrollButton && (
        <button
          onClick={() => scrollToBottom()}
          className="absolute bottom-24 right-8 p-2 bg-white rounded-full shadow-lg border border-gray-200 text-gray-600 hover:text-gray-900 transition-colors"
        >
          <ArrowDown size={20} />
        </button>
      )}

      {/* Message input */}
      <MessageInput
        onSend={handleSend}
        onTyping={onTyping}
        disabled={isSending}
        placeholder={editingMessage ? 'Edit message...' : 'Type a message...'}
        replyingTo={
          replyingTo
            ? {
                id: replyingTo.id,
                senderName: replyingTo.sender_name,
                content: replyingTo.content || '',
                attachments: replyingTo.attachments?.map((att) => ({
                  id: att.id,
                  file_name: att.file_name,
                  file_type: att.file_type,
                  file_size: att.file_size,
                  thumbnail_url: att.thumbnail_url || att.file_url,
                })),
              }
            : editingMessage
            ? {
                id: editingMessage.id,
                senderName: 'Editing',
                content: editingMessage.content || '',
              }
            : null
        }
        onCancelReply={() => {
          setReplyingTo(null);
          setEditingMessage(null);
        }}
      />

      {/* Media viewer */}
      <MediaViewer
        media={currentMediaItems.length > 0 ? currentMediaItems : allMediaItems}
        currentIndex={mediaViewerIndex}
        isOpen={mediaViewerOpen}
        onClose={() => {
          setMediaViewerOpen(false);
          setCurrentMediaItems([]);
        }}
        onNavigate={(index) => setMediaViewerIndex(index)}
      />

      {/* Forward message modal */}
      <ForwardMessageModal
        isOpen={!!forwardingMessage}
        message={forwardingMessage}
        currentUserId={currentUserId}
        onClose={() => setForwardingMessage(null)}
        onForward={handleForward}
      />
    </div>
  );
}
