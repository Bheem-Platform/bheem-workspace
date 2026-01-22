import { useState } from 'react';
import { motion } from 'framer-motion';
import {
  Video,
  Calendar,
  Clock,
  Users,
  Copy,
  Check,
  MoreHorizontal,
  ExternalLink,
  Trash2,
  Play,
} from 'lucide-react';
import { MeetAvatar, MeetAvatarGroup } from './ui';
import type { Meeting } from '@/types/meet';

interface MeetingCardProps {
  meeting: Meeting;
  onJoin: () => void;
  onEnd?: () => void;
  onCopyLink?: () => void;
}

function formatRelativeTime(date: string): string {
  const now = new Date();
  const then = new Date(date);
  const diffMs = then.getTime() - now.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffMs < 0) {
    // Past
    if (diffMins > -60) return `${Math.abs(diffMins)}m ago`;
    if (diffHours > -24) return `${Math.abs(diffHours)}h ago`;
    return then.toLocaleDateString();
  }

  // Future
  if (diffMins < 60) return `in ${diffMins}m`;
  if (diffHours < 24) return `in ${diffHours}h`;
  if (diffDays === 1) return 'Tomorrow';
  return then.toLocaleDateString();
}

function formatTime(date: string): string {
  return new Date(date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

export default function MeetingCard({ meeting, onJoin, onEnd, onCopyLink }: MeetingCardProps) {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  const isLive = meeting.status === 'active';
  const isScheduled = meeting.status === 'scheduled';
  const isPast = meeting.status === 'ended';

  const handleCopy = async () => {
    if (meeting.joinUrl) {
      await navigator.clipboard.writeText(meeting.joinUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
    onCopyLink?.();
    setIsMenuOpen(false);
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className={`
        relative group
        bg-white
        border border-gray-200
        rounded-2xl p-5 shadow-sm
        hover:bg-gray-50 hover:border-gray-300
        transition-all duration-200
        ${isLive ? 'ring-2 ring-[#977DFF]/30' : ''}
      `}
    >
      {/* Live indicator */}
      {isLive && (
        <div className="absolute top-4 right-4 flex items-center gap-1.5">
          <span className="relative flex h-2.5 w-2.5">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#977DFF] opacity-75" />
            <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-[#0033FF]" />
          </span>
          <span className="text-xs font-medium text-[#977DFF]">LIVE</span>
        </div>
      )}

      {/* Content */}
      <div className="flex items-start gap-4">
        {/* Icon */}
        <div className={`
          w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0
          ${isLive ? 'bg-gradient-to-br from-[#FFCCF2]/20 via-[#977DFF]/20 to-[#0033FF]/20' : 'bg-gray-100'}
        `}>
          <Video size={22} className={isLive ? 'text-[#977DFF]' : 'text-gray-500'} />
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0">
          <h3 className="text-base font-semibold text-gray-900 truncate mb-1">
            {meeting.title || 'Untitled Meeting'}
          </h3>

          <div className="flex flex-wrap items-center gap-3 text-sm text-gray-500">
            {meeting.scheduledStart && (
              <div className="flex items-center gap-1.5">
                <Calendar size={14} />
                <span>{formatRelativeTime(meeting.scheduledStart)}</span>
              </div>
            )}
            {meeting.scheduledStart && (
              <div className="flex items-center gap-1.5">
                <Clock size={14} />
                <span>{formatTime(meeting.scheduledStart)}</span>
              </div>
            )}
            <div className="flex items-center gap-1.5">
              <span className="font-mono text-xs bg-gray-100 px-2 py-0.5 rounded text-gray-600">
                {meeting.roomCode}
              </span>
            </div>
          </div>

          {/* Participants */}
          {meeting.participantsCount > 0 && (
            <div className="flex items-center gap-2 mt-3">
              <MeetAvatarGroup
                avatars={[
                  { name: 'User 1' },
                  { name: 'User 2' },
                  { name: 'User 3' },
                ]}
                max={3}
                size="xs"
              />
              <span className="text-xs text-gray-600">
                {meeting.participantsCount} participant{meeting.participantsCount !== 1 ? 's' : ''}
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Actions */}
      <div className={`
        flex items-center gap-2 mt-4 pt-4 border-t border-gray-200
        transition-opacity duration-200
      `}>
        {!isPast && (
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={onJoin}
            className={`
              flex-1 flex items-center justify-center gap-2
              py-2.5 rounded-xl font-medium text-sm
              transition-colors duration-150
              ${isLive
                ? 'bg-gradient-to-r from-[#977DFF] to-[#0033FF] text-white hover:from-[#8B6FFF] hover:to-[#0029CC]'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }
            `}
          >
            <Play size={16} />
            <span>{isLive ? 'Join Now' : 'Start'}</span>
          </motion.button>
        )}

        <button
          onClick={handleCopy}
          className="p-2.5 rounded-xl bg-gray-100 text-gray-500 hover:text-gray-700 hover:bg-gray-200 transition-colors"
          title="Copy meeting link"
        >
          {copied ? <Check size={18} className="text-[#977DFF]" /> : <Copy size={18} />}
        </button>

        <div className="relative">
          <button
            onClick={() => setIsMenuOpen(!isMenuOpen)}
            className="p-2.5 rounded-xl bg-gray-100 text-gray-500 hover:text-gray-700 hover:bg-gray-200 transition-colors"
          >
            <MoreHorizontal size={18} />
          </button>

          {isMenuOpen && (
            <>
              <div
                className="fixed inset-0 z-10"
                onClick={() => setIsMenuOpen(false)}
              />
              <motion.div
                initial={{ opacity: 0, scale: 0.95, y: -10 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                className="absolute right-0 bottom-full mb-2 bg-white border border-gray-200 rounded-xl shadow-lg py-1 min-w-[160px] z-20"
              >
                <button
                  onClick={() => {
                    window.open(`/meet/room/${meeting.roomCode}`, '_blank');
                    setIsMenuOpen(false);
                  }}
                  className="w-full flex items-center gap-2 px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                >
                  <ExternalLink size={16} />
                  <span>Open in new tab</span>
                </button>
                {onEnd && !isPast && (
                  <button
                    onClick={() => {
                      onEnd();
                      setIsMenuOpen(false);
                    }}
                    className="w-full flex items-center gap-2 px-4 py-2 text-sm text-red-600 hover:bg-red-50"
                  >
                    <Trash2 size={16} />
                    <span>End meeting</span>
                  </button>
                )}
              </motion.div>
            </>
          )}
        </div>
      </div>
    </motion.div>
  );
}
