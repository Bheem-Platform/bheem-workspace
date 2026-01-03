import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  X,
  Mic,
  MicOff,
  Video,
  VideoOff,
  MoreVertical,
  Crown,
  Hand,
  UserPlus,
  Copy,
  Check,
  Search,
  Pin,
  UserMinus,
  Volume2,
  VolumeX,
} from 'lucide-react';
import { useMeetStore } from '@/stores/meetStore';
import { MeetAvatar, MeetButton } from './ui';
import type { Participant } from '@/types/meet';

interface ParticipantsPanelProps {
  onClose: () => void;
  roomCode?: string;
}

export default function ParticipantsPanel({ onClose, roomCode }: ParticipantsPanelProps) {
  const { participants, waitingParticipants } = useMeetStore();
  const [copied, setCopied] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const copyInviteLink = async () => {
    if (roomCode) {
      const link = `${window.location.origin}/meet/room/${roomCode}`;
      await navigator.clipboard.writeText(link);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  // Sort participants: host first, then by name
  const sortedParticipants = [...participants]
    .filter(p => p.name.toLowerCase().includes(searchQuery.toLowerCase()))
    .sort((a, b) => {
      if (a.isHost && !b.isHost) return -1;
      if (!a.isHost && b.isHost) return 1;
      return a.name.localeCompare(b.name);
    });

  // Waiting room participants (if any)
  const filteredWaitingParticipants = waitingParticipants?.filter(
    (p: any) => p.name?.toLowerCase().includes(searchQuery.toLowerCase())
  ) || [];

  return (
    <div className="h-full bg-gray-900/95 backdrop-blur-lg flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-800">
        <h3 className="font-semibold text-white">
          People <span className="text-gray-500 font-normal">({participants.length})</span>
        </h3>
        <button
          onClick={onClose}
          className="p-2 text-gray-400 hover:text-white rounded-lg hover:bg-gray-800 transition-colors"
        >
          <X size={18} />
        </button>
      </div>

      {/* Search */}
      <div className="px-4 py-3 border-b border-gray-800">
        <div className="relative">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search participants..."
            className="w-full pl-9 pr-4 py-2 bg-gray-800 border border-gray-700 rounded-xl text-sm text-white placeholder-gray-500 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none"
          />
        </div>
      </div>

      {/* Invite */}
      <div className="px-4 py-3 border-b border-gray-800">
        <motion.button
          whileHover={{ scale: 1.01 }}
          whileTap={{ scale: 0.99 }}
          onClick={copyInviteLink}
          className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-gray-800 hover:bg-gray-700 rounded-xl transition-colors"
        >
          {copied ? (
            <>
              <Check size={18} className="text-emerald-400" />
              <span className="text-emerald-400 font-medium text-sm">Link copied!</span>
            </>
          ) : (
            <>
              <UserPlus size={18} className="text-emerald-400" />
              <span className="text-white font-medium text-sm">Invite participants</span>
            </>
          )}
        </motion.button>
      </div>

      {/* Participants list */}
      <div className="flex-1 overflow-y-auto scrollbar-thin">
        {/* Waiting room section */}
        {filteredWaitingParticipants.length > 0 && (
          <div className="p-4 border-b border-gray-800">
            <h4 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">
              Waiting ({filteredWaitingParticipants.length})
            </h4>
            <div className="space-y-2">
              {filteredWaitingParticipants.map((participant: any) => (
                <WaitingParticipantItem key={participant.id} participant={participant} />
              ))}
            </div>
          </div>
        )}

        {/* In meeting section */}
        <div className="p-4">
          {sortedParticipants.length > 0 && (
            <h4 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">
              In meeting ({sortedParticipants.length})
            </h4>
          )}

          {sortedParticipants.length === 0 ? (
            <div className="text-center py-8">
              <div className="w-12 h-12 bg-gray-800 rounded-xl flex items-center justify-center mx-auto mb-3">
                <UserPlus size={24} className="text-gray-600" />
              </div>
              <p className="text-sm text-gray-400">No participants found</p>
              <p className="text-xs text-gray-600 mt-1">
                {searchQuery ? 'Try a different search' : 'Share the meeting link to invite others'}
              </p>
            </div>
          ) : (
            <div className="space-y-1">
              <AnimatePresence mode="popLayout">
                {sortedParticipants.map((participant) => (
                  <ParticipantItem key={participant.id} participant={participant} />
                ))}
              </AnimatePresence>
            </div>
          )}
        </div>
      </div>

      {/* Quick actions */}
      <div className="px-4 py-3 border-t border-gray-800">
        <div className="flex gap-2">
          <MeetButton variant="ghost" size="sm" className="flex-1">
            <VolumeX size={16} />
            Mute all
          </MeetButton>
        </div>
      </div>
    </div>
  );
}

interface ParticipantItemProps {
  participant: Participant;
}

function ParticipantItem({ participant }: ParticipantItemProps) {
  const [showMenu, setShowMenu] = useState(false);

  return (
    <motion.div
      layout
      initial={{ opacity: 0, x: -10 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -10 }}
      className="flex items-center gap-3 px-3 py-2.5 hover:bg-gray-800/50 rounded-xl group transition-colors"
    >
      {/* Avatar */}
      <div className="relative">
        <MeetAvatar
          name={participant.name}
          size="md"
          status={participant.isSpeaking ? 'speaking' : undefined}
        />
        {participant.isHandRaised && (
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            className="absolute -top-1 -right-1 w-5 h-5 bg-amber-500 rounded-full flex items-center justify-center"
          >
            <Hand size={10} className="text-white" />
          </motion.div>
        )}
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-white truncate">
            {participant.name}
          </span>
          {participant.isHost && (
            <Crown size={12} className="text-amber-400 flex-shrink-0" />
          )}
          {participant.isLocal && (
            <span className="text-xs text-gray-500">(You)</span>
          )}
        </div>
      </div>

      {/* Status indicators */}
      <div className="flex items-center gap-1.5">
        <div className={`p-1 rounded-full ${participant.isMuted ? 'bg-red-500/20' : 'bg-gray-700/50'}`}>
          {participant.isMuted ? (
            <MicOff size={14} className="text-red-400" />
          ) : (
            <Mic size={14} className="text-gray-400" />
          )}
        </div>
        <div className={`p-1 rounded-full ${participant.isVideoOff ? 'bg-red-500/20' : 'bg-gray-700/50'}`}>
          {participant.isVideoOff ? (
            <VideoOff size={14} className="text-red-400" />
          ) : (
            <Video size={14} className="text-gray-400" />
          )}
        </div>

        {/* More options */}
        <div className="relative opacity-0 group-hover:opacity-100 transition-opacity">
          <button
            onClick={() => setShowMenu(!showMenu)}
            className="p-1 hover:bg-gray-700 rounded-lg transition-colors"
          >
            <MoreVertical size={16} className="text-gray-400" />
          </button>

          <AnimatePresence>
            {showMenu && (
              <>
                <div className="fixed inset-0 z-10" onClick={() => setShowMenu(false)} />
                <motion.div
                  initial={{ opacity: 0, scale: 0.95, y: -10 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95, y: -10 }}
                  className="absolute right-0 bottom-full mb-1 bg-gray-800 rounded-xl shadow-xl border border-gray-700 py-1 min-w-[140px] z-20"
                >
                  <button
                    onClick={() => setShowMenu(false)}
                    className="w-full flex items-center gap-2 px-4 py-2 text-sm text-gray-300 hover:bg-gray-700/50"
                  >
                    <Pin size={14} />
                    Pin to screen
                  </button>
                  <button
                    onClick={() => setShowMenu(false)}
                    className="w-full flex items-center gap-2 px-4 py-2 text-sm text-gray-300 hover:bg-gray-700/50"
                  >
                    <VolumeX size={14} />
                    Mute for me
                  </button>
                  {!participant.isLocal && (
                    <button
                      onClick={() => setShowMenu(false)}
                      className="w-full flex items-center gap-2 px-4 py-2 text-sm text-red-400 hover:bg-red-500/10"
                    >
                      <UserMinus size={14} />
                      Remove
                    </button>
                  )}
                </motion.div>
              </>
            )}
          </AnimatePresence>
        </div>
      </div>
    </motion.div>
  );
}

interface WaitingParticipantItemProps {
  participant: Participant;
}

function WaitingParticipantItem({ participant }: WaitingParticipantItemProps) {
  return (
    <motion.div
      layout
      initial={{ opacity: 0, x: -10 }}
      animate={{ opacity: 1, x: 0 }}
      className="flex items-center gap-3 px-3 py-2.5 bg-amber-500/10 border border-amber-500/20 rounded-xl"
    >
      <MeetAvatar name={participant.name} size="md" />

      <div className="flex-1 min-w-0">
        <span className="text-sm font-medium text-white truncate block">
          {participant.name}
        </span>
        <span className="text-xs text-amber-400">Waiting to join</span>
      </div>

      <div className="flex items-center gap-1">
        <motion.button
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          className="p-2 bg-emerald-500 hover:bg-emerald-600 text-white rounded-lg"
          title="Admit"
        >
          <Check size={14} />
        </motion.button>
        <motion.button
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          className="p-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg"
          title="Deny"
        >
          <X size={14} />
        </motion.button>
      </div>
    </motion.div>
  );
}
