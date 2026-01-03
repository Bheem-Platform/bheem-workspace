import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Video,
  Calendar,
  Clock,
  Users,
  Link as LinkIcon,
  Copy,
  Check,
  ChevronRight,
  Sparkles,
  Shield,
} from 'lucide-react';
import { MeetModal, MeetModalActions, MeetButton, MeetInput } from './ui';
import { useMeetStore } from '@/stores/meetStore';
import type { CreateMeetingData } from '@/types/meet';

interface NewMeetingModalProps {
  isOpen: boolean;
  onClose: () => void;
}

type Step = 'create' | 'success';

export default function NewMeetingModal({ isOpen, onClose }: NewMeetingModalProps) {
  const { createMeeting, loading } = useMeetStore();

  const [step, setStep] = useState<Step>('create');
  const [mode, setMode] = useState<'instant' | 'schedule'>('instant');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [scheduledDate, setScheduledDate] = useState('');
  const [scheduledTime, setScheduledTime] = useState('');
  const [duration, setDuration] = useState(60);
  const [waitingRoom, setWaitingRoom] = useState(false);

  const [createdMeeting, setCreatedMeeting] = useState<{
    roomCode: string;
    joinUrl: string;
  } | null>(null);
  const [copied, setCopied] = useState(false);

  const handleCreate = async () => {
    const data: CreateMeetingData = {
      title: title || `Meeting ${new Date().toLocaleDateString()}`,
      description: description || undefined,
      durationMinutes: duration,
      settings: {
        waitingRoom: waitingRoom,
      },
    };

    if (mode === 'schedule' && scheduledDate && scheduledTime) {
      data.scheduledStart = new Date(`${scheduledDate}T${scheduledTime}`).toISOString();
    }

    const result = await createMeeting(data);
    if (result) {
      setCreatedMeeting(result);
      setStep('success');
    }
  };

  const handleCopyLink = async () => {
    if (createdMeeting) {
      await navigator.clipboard.writeText(createdMeeting.joinUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleJoinNow = () => {
    if (createdMeeting) {
      window.location.href = `/meet/room/${createdMeeting.roomCode}`;
    }
  };

  const handleClose = () => {
    setStep('create');
    setCreatedMeeting(null);
    setTitle('');
    setDescription('');
    setScheduledDate('');
    setScheduledTime('');
    setCopied(false);
    onClose();
  };

  return (
    <MeetModal
      isOpen={isOpen}
      onClose={handleClose}
      title={step === 'create' ? 'Start a Meeting' : undefined}
      size="md"
      showCloseButton={step === 'create'}
    >
      <AnimatePresence mode="wait">
        {step === 'create' ? (
          <motion.div
            key="create"
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 20 }}
            className="space-y-5"
          >
            {/* Mode Toggle */}
            <div className="flex bg-gray-700/50 rounded-xl p-1">
              <button
                onClick={() => setMode('instant')}
                className={`
                  flex-1 flex items-center justify-center gap-2 py-2.5 text-sm font-medium rounded-lg transition-all
                  ${mode === 'instant'
                    ? 'bg-emerald-500 text-white shadow-lg'
                    : 'text-gray-400 hover:text-white'
                  }
                `}
              >
                <Sparkles size={16} />
                <span>Start Now</span>
              </button>
              <button
                onClick={() => setMode('schedule')}
                className={`
                  flex-1 flex items-center justify-center gap-2 py-2.5 text-sm font-medium rounded-lg transition-all
                  ${mode === 'schedule'
                    ? 'bg-emerald-500 text-white shadow-lg'
                    : 'text-gray-400 hover:text-white'
                  }
                `}
              >
                <Calendar size={16} />
                <span>Schedule</span>
              </button>
            </div>

            {/* Title */}
            <MeetInput
              label="Meeting Title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Team standup, Client call..."
              leftIcon={<Video size={18} />}
            />

            {/* Schedule Fields */}
            {mode === 'schedule' && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="space-y-4"
              >
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                      Date
                    </label>
                    <div className="relative">
                      <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                      <input
                        type="date"
                        value={scheduledDate}
                        onChange={(e) => setScheduledDate(e.target.value)}
                        className="w-full pl-10 pr-4 py-3 bg-gray-800 border border-gray-700 rounded-xl text-white focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                      Time
                    </label>
                    <div className="relative">
                      <Clock className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                      <input
                        type="time"
                        value={scheduledTime}
                        onChange={(e) => setScheduledTime(e.target.value)}
                        className="w-full pl-10 pr-4 py-3 bg-gray-800 border border-gray-700 rounded-xl text-white focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none"
                      />
                    </div>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Duration
                  </label>
                  <select
                    value={duration}
                    onChange={(e) => setDuration(Number(e.target.value))}
                    className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-xl text-white focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none"
                  >
                    <option value={15}>15 minutes</option>
                    <option value={30}>30 minutes</option>
                    <option value={45}>45 minutes</option>
                    <option value={60}>1 hour</option>
                    <option value={90}>1.5 hours</option>
                    <option value={120}>2 hours</option>
                  </select>
                </div>
              </motion.div>
            )}

            {/* Waiting Room Toggle */}
            <div className="flex items-center justify-between p-4 bg-gray-700/30 rounded-xl">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-gray-700 flex items-center justify-center">
                  <Shield size={20} className="text-gray-400" />
                </div>
                <div>
                  <p className="text-sm font-medium text-white">Waiting Room</p>
                  <p className="text-xs text-gray-400">Approve participants before they join</p>
                </div>
              </div>
              <button
                onClick={() => setWaitingRoom(!waitingRoom)}
                className={`
                  w-12 h-7 rounded-full transition-colors duration-200
                  ${waitingRoom ? 'bg-emerald-500' : 'bg-gray-600'}
                `}
              >
                <motion.div
                  animate={{ x: waitingRoom ? 22 : 2 }}
                  transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                  className="w-5 h-5 rounded-full bg-white shadow"
                />
              </button>
            </div>

            {/* Actions */}
            <MeetModalActions>
              <MeetButton variant="ghost" onClick={handleClose}>
                Cancel
              </MeetButton>
              <MeetButton
                variant="primary"
                onClick={handleCreate}
                isLoading={loading.creating}
                rightIcon={<ChevronRight size={18} />}
              >
                {mode === 'instant' ? 'Start Meeting' : 'Schedule'}
              </MeetButton>
            </MeetModalActions>
          </motion.div>
        ) : (
          <motion.div
            key="success"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="text-center py-4"
          >
            {/* Success Icon */}
            <div className="w-20 h-20 rounded-full bg-emerald-500/20 flex items-center justify-center mx-auto mb-6">
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ type: 'spring', delay: 0.2 }}
              >
                <Check size={40} className="text-emerald-400" />
              </motion.div>
            </div>

            <h2 className="text-xl font-semibold text-white mb-2">
              Your meeting is ready!
            </h2>
            <p className="text-gray-400 mb-6">
              Share this link with others you want in the meeting
            </p>

            {/* Meeting Link */}
            <div className="bg-gray-700/50 rounded-xl p-4 mb-6">
              <div className="flex items-center gap-3">
                <LinkIcon size={18} className="text-gray-400 flex-shrink-0" />
                <input
                  type="text"
                  value={createdMeeting?.joinUrl || ''}
                  readOnly
                  className="flex-1 bg-transparent text-sm text-white font-mono outline-none truncate"
                />
                <button
                  onClick={handleCopyLink}
                  className="p-2 hover:bg-gray-600 rounded-lg transition-colors"
                >
                  {copied ? (
                    <Check size={18} className="text-emerald-400" />
                  ) : (
                    <Copy size={18} className="text-gray-400" />
                  )}
                </button>
              </div>
              {copied && (
                <motion.p
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="text-emerald-400 text-sm mt-2"
                >
                  Copied to clipboard!
                </motion.p>
              )}
            </div>

            {/* Meeting Code */}
            <div className="bg-gray-700/30 rounded-xl p-3 mb-6 inline-block">
              <p className="text-xs text-gray-400 mb-1">Meeting Code</p>
              <p className="text-xl font-mono text-white tracking-wider">
                {createdMeeting?.roomCode}
              </p>
            </div>

            {/* Actions */}
            <div className="flex gap-3">
              <MeetButton
                variant="secondary"
                onClick={handleCopyLink}
                leftIcon={<Copy size={18} />}
                className="flex-1"
              >
                Copy Link
              </MeetButton>
              <MeetButton
                variant="primary"
                onClick={handleJoinNow}
                leftIcon={<Video size={18} />}
                className="flex-1"
              >
                Join Now
              </MeetButton>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </MeetModal>
  );
}
