'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { X, PhoneOff, Users, LogOut } from 'lucide-react';
import { MeetButton } from './ui';

interface EndMeetingModalProps {
  isOpen: boolean;
  onClose: () => void;
  onLeave: () => void;
  onEndForAll?: () => void;
  isHost?: boolean;
  participantCount?: number;
}

export default function EndMeetingModal({
  isOpen,
  onClose,
  onLeave,
  onEndForAll,
  isHost = false,
  participantCount = 1,
}: EndMeetingModalProps) {
  if (!isOpen) return null;

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-black/70 backdrop-blur-sm"
          />

          {/* Modal */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            className="relative w-full max-w-md mx-4 bg-gray-800 rounded-2xl shadow-2xl border border-gray-700 overflow-hidden"
          >
            {/* Header */}
            <div className="flex items-center justify-between p-6 border-b border-gray-700">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-red-500/20 flex items-center justify-center">
                  <PhoneOff size={20} className="text-red-400" />
                </div>
                <h2 className="text-lg font-semibold text-white">Leave Meeting?</h2>
              </div>
              <button
                onClick={onClose}
                className="p-2 text-gray-400 hover:text-white rounded-lg hover:bg-gray-700 transition-colors"
              >
                <X size={20} />
              </button>
            </div>

            {/* Content */}
            <div className="p-6">
              <p className="text-gray-400 text-sm mb-6">
                {isHost && participantCount > 1
                  ? `You're the host of this meeting with ${participantCount - 1} other participant${participantCount > 2 ? 's' : ''}. What would you like to do?`
                  : 'Are you sure you want to leave this meeting?'}
              </p>

              <div className="space-y-3">
                {/* Leave meeting option */}
                <motion.button
                  whileHover={{ scale: 1.01 }}
                  whileTap={{ scale: 0.99 }}
                  onClick={() => {
                    onLeave();
                    onClose();
                  }}
                  className="w-full flex items-center gap-4 p-4 bg-gray-700/50 hover:bg-gray-700 rounded-xl border border-gray-600 transition-colors group"
                >
                  <div className="w-12 h-12 rounded-xl bg-amber-500/20 flex items-center justify-center group-hover:bg-amber-500/30 transition-colors">
                    <LogOut size={24} className="text-amber-400" />
                  </div>
                  <div className="flex-1 text-left">
                    <h3 className="text-white font-medium">Leave meeting</h3>
                    <p className="text-gray-400 text-sm">
                      {isHost && participantCount > 1
                        ? 'Others can continue without you'
                        : 'Exit the meeting room'}
                    </p>
                  </div>
                </motion.button>

                {/* End for all option (host only) */}
                {isHost && onEndForAll && participantCount > 1 && (
                  <motion.button
                    whileHover={{ scale: 1.01 }}
                    whileTap={{ scale: 0.99 }}
                    onClick={() => {
                      onEndForAll();
                      onClose();
                    }}
                    className="w-full flex items-center gap-4 p-4 bg-red-500/10 hover:bg-red-500/20 rounded-xl border border-red-500/30 transition-colors group"
                  >
                    <div className="w-12 h-12 rounded-xl bg-red-500/20 flex items-center justify-center group-hover:bg-red-500/30 transition-colors">
                      <Users size={24} className="text-red-400" />
                    </div>
                    <div className="flex-1 text-left">
                      <h3 className="text-red-400 font-medium">End meeting for everyone</h3>
                      <p className="text-gray-400 text-sm">
                        All {participantCount - 1} participant{participantCount > 2 ? 's' : ''} will be removed
                      </p>
                    </div>
                  </motion.button>
                )}
              </div>
            </div>

            {/* Footer */}
            <div className="flex items-center justify-end gap-3 p-6 pt-0">
              <MeetButton variant="ghost" onClick={onClose}>
                Cancel
              </MeetButton>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
