/**
 * Single conversation preview item in the list
 */

import { Users, ExternalLink, Archive, ArchiveRestore } from 'lucide-react';
import type { Conversation } from '@/stores/chatStore';
import OnlineIndicator from './OnlineIndicator';

interface ConversationItemProps {
  conversation: Conversation;
  currentUserId: string;
  isSelected: boolean;
  unreadCount: number;
  isOnline?: boolean;
  isArchived?: boolean;
  onClick: () => void;
  onUnarchive?: () => void;
}

export default function ConversationItem({
  conversation,
  currentUserId,
  isSelected,
  unreadCount,
  isOnline = false,
  isArchived = false,
  onClick,
  onUnarchive,
}: ConversationItemProps) {
  // Get display name and avatar
  const getDisplayInfo = () => {
    if (conversation.type === 'group') {
      return {
        name: conversation.name || 'Unnamed Group',
        initials: (conversation.name || 'UG').slice(0, 2).toUpperCase(),
        avatar: conversation.avatar_url,
      };
    }

    // For direct conversations, show the other person
    const other = conversation.participants.find((p) => p.user_id !== currentUserId);
    if (other) {
      return {
        name: other.user_name,
        initials: other.user_name
          .split(' ')
          .map((n) => n[0])
          .join('')
          .toUpperCase()
          .slice(0, 2),
        avatar: other.user_avatar,
        companyName: other.company_name,
      };
    }

    return { name: 'Unknown', initials: '?', avatar: null };
  };

  const { name, initials, avatar, companyName } = getDisplayInfo();

  const formatTime = (dateStr?: string) => {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    const now = new Date();
    const isToday = date.toDateString() === now.toDateString();

    if (isToday) {
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    }

    const yesterday = new Date(now);
    yesterday.setDate(yesterday.getDate() - 1);
    if (date.toDateString() === yesterday.toDateString()) {
      return 'Yesterday';
    }

    return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
  };

  const isExternal = conversation.scope === 'external' || conversation.scope === 'cross_tenant';

  return (
    <div
      onClick={onClick}
      className={`
        flex items-start gap-3 px-4 py-3 cursor-pointer border-b border-gray-100 transition-all
        ${isSelected ? 'bg-gray-100' : 'hover:bg-gray-50'}
        ${unreadCount > 0 && !isSelected ? 'bg-gray-50' : ''}
      `}
    >
      {/* Avatar */}
      <div className="relative flex-shrink-0">
        {avatar ? (
          <img
            src={avatar}
            alt={name}
            className="w-12 h-12 rounded-full object-cover"
          />
        ) : (
          <div
            className={`
              w-12 h-12 rounded-full flex items-center justify-center text-white font-medium
              bg-gradient-to-br from-[#977DFF] to-[#0033FF]
            `}
          >
            {conversation.type === 'group' ? <Users size={20} /> : initials}
          </div>
        )}

        {/* Online indicator for direct chats */}
        {conversation.type === 'direct' && (
          <div className="absolute bottom-0 right-0">
            <OnlineIndicator isOnline={isOnline} size="sm" />
          </div>
        )}
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-1 min-w-0">
            <span className={`font-medium truncate ${unreadCount > 0 ? 'text-gray-900' : 'text-gray-700'} ${isArchived ? 'text-gray-500' : ''}`}>
              {name}
            </span>
            {isArchived && (
              <Archive size={14} className="text-gray-400 flex-shrink-0" />
            )}
            {isExternal && !isArchived && (
              <ExternalLink size={14} className="text-gray-400 flex-shrink-0" />
            )}
          </div>
          {isArchived && onUnarchive ? (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onUnarchive();
              }}
              className="flex items-center gap-1 px-2 py-1 text-xs text-[#977DFF] bg-gray-100 hover:bg-gray-200 rounded transition-colors"
              title="Unarchive conversation"
            >
              <ArchiveRestore size={14} />
              <span>Unarchive</span>
            </button>
          ) : (
            <span className="text-xs text-gray-500 flex-shrink-0">
              {formatTime(conversation.last_message_at)}
            </span>
          )}
        </div>

        {companyName && (
          <div className="text-xs text-gray-500 truncate">{companyName}</div>
        )}

        <div className="flex items-center justify-between gap-2 mt-0.5">
          <p className={`text-sm truncate ${unreadCount > 0 ? 'text-gray-800 font-medium' : 'text-gray-500'}`}>
            {conversation.last_message_preview || 'No messages yet'}
          </p>

          {unreadCount > 0 && (
            <span className="flex-shrink-0 w-5 h-5 rounded-full bg-gradient-to-r from-[#977DFF] to-[#0033FF] text-white text-xs flex items-center justify-center font-medium">
              {unreadCount > 9 ? '9+' : unreadCount}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
