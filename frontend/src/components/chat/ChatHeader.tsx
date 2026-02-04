/**
 * Chat header with conversation info and actions
 */

import { Phone, Video, MoreVertical, Users, Archive, LogOut, Bell, BellOff, Info, ExternalLink } from 'lucide-react';
import { useState } from 'react';
import type { Conversation } from '@/stores/chatStore';
import OnlineIndicator from './OnlineIndicator';

interface ChatHeaderProps {
  conversation: Conversation;
  currentUserId: string;
  isOnline?: boolean;
  typingText?: string;
  onAudioCall?: () => void;
  onVideoCall?: () => void;
  onArchive?: () => void;
  onLeave?: () => void;
  onToggleMute?: () => void;
  onViewInfo?: () => void;
  isMuted?: boolean;
}

export default function ChatHeader({
  conversation,
  currentUserId,
  isOnline = false,
  typingText,
  onAudioCall,
  onVideoCall,
  onArchive,
  onLeave,
  onToggleMute,
  onViewInfo,
  isMuted = false,
}: ChatHeaderProps) {
  const [showMenu, setShowMenu] = useState(false);

  // Get display info
  const getDisplayInfo = () => {
    if (conversation.type === 'group') {
      const activeParticipants = conversation.participants.filter((p) => !p.left_at);
      return {
        name: conversation.name || 'Unnamed Group',
        subtitle: `${activeParticipants.length} participants`,
        avatar: conversation.avatar_url,
        initials: (conversation.name || 'UG').slice(0, 2).toUpperCase(),
      };
    }

    const other = conversation.participants.find((p) => p.user_id !== currentUserId);
    if (other) {
      return {
        name: other.user_name,
        subtitle: other.company_name || other.user_email || (isOnline ? 'Online' : 'Offline'),
        avatar: other.user_avatar,
        initials: other.user_name
          .split(' ')
          .map((n) => n[0])
          .join('')
          .toUpperCase()
          .slice(0, 2),
        isExternal: other.participant_type !== 'internal',
      };
    }

    return { name: 'Unknown', subtitle: '', avatar: null, initials: '?' };
  };

  const { name, subtitle, avatar, initials, isExternal } = getDisplayInfo();

  return (
    <div className="flex items-center justify-between px-4 py-3 bg-white border-b border-gray-200">
      {/* Left: Avatar and info */}
      <div className="flex items-center gap-3">
        {/* Avatar */}
        <div className="relative">
          {avatar ? (
            <img
              src={avatar}
              alt={name}
              className="w-10 h-10 rounded-full object-cover"
            />
          ) : (
            <div
              className={`
                w-10 h-10 rounded-full flex items-center justify-center text-white font-medium text-sm
                bg-gradient-to-br from-[#977DFF] to-[#0033FF]
              `}
            >
              {conversation.type === 'group' ? <Users size={18} /> : initials}
            </div>
          )}

          {conversation.type === 'direct' && (
            <div className="absolute bottom-0 right-0">
              <OnlineIndicator isOnline={isOnline} size="sm" />
            </div>
          )}
        </div>

        {/* Name and status */}
        <div>
          <div className="flex items-center gap-1">
            <h3 className="font-semibold text-gray-900">{name}</h3>
            {isExternal && (
              <ExternalLink size={14} className="text-gray-400" />
            )}
          </div>
          {typingText ? (
            <p className="text-xs font-medium bg-gradient-to-r from-[#977DFF] to-[#0033FF] bg-clip-text text-transparent">{typingText}</p>
          ) : (
            <p className="text-xs text-gray-500">{subtitle}</p>
          )}
        </div>
      </div>

      {/* Right: Actions */}
      <div className="flex items-center gap-1">
        {/* Audio call */}
        <button
          onClick={onAudioCall}
          className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
          title="Audio call"
        >
          <Phone size={20} />
        </button>

        {/* Video call */}
        <button
          onClick={onVideoCall}
          className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
          title="Video call"
        >
          <Video size={20} />
        </button>

        {/* More options */}
        <div className="relative">
          <button
            onClick={() => setShowMenu(!showMenu)}
            className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
            title="More options"
          >
            <MoreVertical size={20} />
          </button>

          {/* Dropdown menu */}
          {showMenu && (
            <>
              <div
                className="fixed inset-0 z-10"
                onClick={() => setShowMenu(false)}
              />
              <div className="absolute right-0 top-full mt-1 w-48 bg-white rounded-lg shadow-lg border border-gray-200 py-1 z-20">
                <button
                  onClick={() => {
                    onViewInfo?.();
                    setShowMenu(false);
                  }}
                  className="flex items-center gap-2 w-full px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                >
                  <Info size={16} />
                  View info
                </button>

                <button
                  onClick={() => {
                    onToggleMute?.();
                    setShowMenu(false);
                  }}
                  className="flex items-center gap-2 w-full px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                >
                  {isMuted ? <Bell size={16} /> : <BellOff size={16} />}
                  {isMuted ? 'Unmute' : 'Mute notifications'}
                </button>

                <hr className="my-1 border-gray-100" />

                <button
                  onClick={() => {
                    onArchive?.();
                    setShowMenu(false);
                  }}
                  className="flex items-center gap-2 w-full px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                >
                  <Archive size={16} />
                  Archive chat
                </button>

                {conversation.type === 'group' && (
                  <button
                    onClick={() => {
                      onLeave?.();
                      setShowMenu(false);
                    }}
                    className="flex items-center gap-2 w-full px-4 py-2 text-sm text-red-600 hover:bg-red-50"
                  >
                    <LogOut size={16} />
                    Leave group
                  </button>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
