/**
 * ForwardMessageModal - Modal to select conversations to forward a message to
 */

'use client';

import { useState, useMemo } from 'react';
import { X, Search, Users, Check, Forward, FileText, Image as ImageIcon, Video, Music } from 'lucide-react';
import { useChatStore, type Message, type Conversation } from '@/stores/chatStore';

interface ForwardMessageModalProps {
  isOpen: boolean;
  message: Message | null;
  currentUserId: string;
  onClose: () => void;
  onForward: (conversationIds: string[]) => Promise<void>;
}

export default function ForwardMessageModal({
  isOpen,
  message,
  currentUserId,
  onClose,
  onForward,
}: ForwardMessageModalProps) {
  const { conversations } = useChatStore();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedConversations, setSelectedConversations] = useState<string[]>([]);
  const [isForwarding, setIsForwarding] = useState(false);

  // Filter conversations based on search
  const filteredConversations = useMemo(() => {
    if (!searchQuery) return conversations;

    const query = searchQuery.toLowerCase();
    return conversations.filter((conv) => {
      if (conv.name?.toLowerCase().includes(query)) return true;
      return conv.participants.some((p) =>
        p.user_name.toLowerCase().includes(query)
      );
    });
  }, [conversations, searchQuery]);

  // Get display name for conversation
  const getConversationName = (conv: Conversation) => {
    if (conv.type === 'group') {
      return conv.name || 'Unnamed Group';
    }
    const other = conv.participants.find((p) => p.user_id !== currentUserId);
    return other?.user_name || 'Unknown';
  };

  // Get avatar info for conversation
  const getAvatarInfo = (conv: Conversation) => {
    if (conv.type === 'group') {
      return { avatar: conv.avatar_url, initials: (conv.name || 'UG').slice(0, 2).toUpperCase() };
    }
    const other = conv.participants.find((p) => p.user_id !== currentUserId);
    if (other) {
      return {
        avatar: other.user_avatar,
        initials: other.user_name.split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2),
      };
    }
    return { avatar: null, initials: '?' };
  };

  // Toggle conversation selection
  const toggleSelection = (convId: string) => {
    setSelectedConversations((prev) =>
      prev.includes(convId)
        ? prev.filter((id) => id !== convId)
        : [...prev, convId]
    );
  };

  // Handle forward
  const handleForward = async () => {
    if (selectedConversations.length === 0) return;

    setIsForwarding(true);
    try {
      await onForward(selectedConversations);
      setSelectedConversations([]);
      setSearchQuery('');
      onClose();
    } catch (error) {
      console.error('Failed to forward message:', error);
    } finally {
      setIsForwarding(false);
    }
  };

  // Get attachment icon
  const getAttachmentIcon = (fileType?: string) => {
    if (fileType?.startsWith('image/')) return <ImageIcon size={14} className="text-purple-500" />;
    if (fileType?.startsWith('video/')) return <Video size={14} className="text-pink-500" />;
    if (fileType?.startsWith('audio/')) return <Music size={14} className="text-[#977DFF]" />;
    return <FileText size={14} className="text-blue-500" />;
  };

  if (!isOpen || !message) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md mx-4 max-h-[80vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900">Forward Message</h3>
          <button
            onClick={onClose}
            className="p-1 text-gray-400 hover:text-gray-600 rounded"
          >
            <X size={20} />
          </button>
        </div>

        {/* Message preview */}
        <div className="px-4 py-3 bg-gray-50 border-b border-gray-200">
          <p className="text-xs text-gray-500 mb-1">Message to forward:</p>
          <div className="bg-white rounded-lg p-3 border border-gray-200">
            {message.attachments && message.attachments.length > 0 ? (
              <div className="flex items-center gap-2">
                {message.attachments[0].file_type?.startsWith('image/') ? (
                  <img
                    src={message.attachments[0].thumbnail_url || message.attachments[0].file_url}
                    alt=""
                    className="w-12 h-12 rounded object-cover"
                  />
                ) : (
                  <div className="w-10 h-10 rounded bg-gray-100 flex items-center justify-center">
                    {getAttachmentIcon(message.attachments[0].file_type)}
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-gray-800 truncate">
                    {message.attachments[0].file_name}
                  </p>
                  {message.attachments.length > 1 && (
                    <p className="text-xs text-gray-500">
                      +{message.attachments.length - 1} more
                    </p>
                  )}
                  {message.content && (
                    <p className="text-xs text-gray-500 truncate mt-1">{message.content}</p>
                  )}
                </div>
              </div>
            ) : (
              <p className="text-sm text-gray-800 line-clamp-2">{message.content}</p>
            )}
          </div>
        </div>

        {/* Search */}
        <div className="px-4 py-3 border-b border-gray-200">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
            <input
              type="text"
              placeholder="Search conversations..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-gray-100 border border-transparent rounded-lg text-sm focus:outline-none focus:border-[#977DFF] focus:bg-white"
            />
          </div>
        </div>

        {/* Conversations list */}
        <div className="flex-1 overflow-y-auto">
          {filteredConversations.length === 0 ? (
            <div className="p-8 text-center text-gray-500">
              No conversations found
            </div>
          ) : (
            filteredConversations.map((conv) => {
              const { avatar, initials } = getAvatarInfo(conv);
              const isSelected = selectedConversations.includes(conv.id);

              return (
                <div
                  key={conv.id}
                  onClick={() => toggleSelection(conv.id)}
                  className={`flex items-center gap-3 px-4 py-3 cursor-pointer transition-colors ${
                    isSelected ? 'bg-gray-100' : 'hover:bg-gray-50'
                  }`}
                >
                  {/* Avatar */}
                  <div className="relative flex-shrink-0">
                    {avatar ? (
                      <img
                        src={avatar}
                        alt=""
                        className="w-10 h-10 rounded-full object-cover"
                      />
                    ) : (
                      <div
                        className="w-10 h-10 rounded-full flex items-center justify-center text-white text-sm font-medium bg-gradient-to-br from-[#977DFF] to-[#0033FF]"
                      >
                        {conv.type === 'group' ? <Users size={18} /> : initials}
                      </div>
                    )}
                  </div>

                  {/* Name */}
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-gray-900 truncate">
                      {getConversationName(conv)}
                    </p>
                    {conv.type === 'group' && (
                      <p className="text-xs text-gray-500">
                        {conv.participants.length} members
                      </p>
                    )}
                  </div>

                  {/* Checkbox */}
                  <div
                    className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition-colors ${
                      isSelected
                        ? 'bg-gradient-to-r from-[#977DFF] to-[#0033FF] border-[#977DFF]'
                        : 'border-gray-300'
                    }`}
                  >
                    {isSelected && <Check size={12} className="text-white" />}
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Footer */}
        <div className="px-4 py-3 border-t border-gray-200 bg-gray-50">
          <div className="flex items-center justify-between">
            <p className="text-sm text-gray-600">
              {selectedConversations.length} selected
            </p>
            <button
              onClick={handleForward}
              disabled={selectedConversations.length === 0 || isForwarding}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-colors ${
                selectedConversations.length > 0 && !isForwarding
                  ? 'bg-gradient-to-r from-[#977DFF] to-[#0033FF] text-white hover:from-[#8066EE] hover:to-[#0029CC]'
                  : 'bg-gray-200 text-gray-400 cursor-not-allowed'
              }`}
            >
              <Forward size={18} />
              {isForwarding ? 'Forwarding...' : 'Forward'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
