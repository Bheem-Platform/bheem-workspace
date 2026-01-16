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
  Share2,
  Download,
  Mail,
  MessageCircle,
  FileText,
} from 'lucide-react';
import { MeetModal, MeetModalActions, MeetButton, MeetInput } from './ui';
import { useMeetStore } from '@/stores/meetStore';
import type { CreateMeetingData } from '@/types/meet';

interface NewMeetingModalProps {
  isOpen: boolean;
  onClose: () => void;
}

type Step = 'create' | 'success';

// Generate ICS calendar file content
const generateICSFile = (meeting: {
  title: string;
  description?: string;
  scheduledStart?: string;
  duration: number;
  joinUrl: string;
  roomCode: string;
}): string => {
  const now = new Date();
  const startDate = meeting.scheduledStart ? new Date(meeting.scheduledStart) : now;
  const endDate = new Date(startDate.getTime() + meeting.duration * 60000);

  const formatDate = (date: Date) => {
    return date.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
  };

  const uid = `${meeting.roomCode}@bheem.cloud`;
  const description = `${meeting.description || ''}\n\nJoin the meeting: ${meeting.joinUrl}\nMeeting Code: ${meeting.roomCode}`.trim();

  return `BEGIN:VCALENDAR
VERSION:2.0
PRODID:-//Bheem//Bheem Meet//EN
CALSCALE:GREGORIAN
METHOD:PUBLISH
BEGIN:VEVENT
UID:${uid}
DTSTAMP:${formatDate(now)}
DTSTART:${formatDate(startDate)}
DTEND:${formatDate(endDate)}
SUMMARY:${meeting.title}
DESCRIPTION:${description.replace(/\n/g, '\\n')}
URL:${meeting.joinUrl}
STATUS:CONFIRMED
SEQUENCE:0
END:VEVENT
END:VCALENDAR`;
};

// Format meeting details for sharing
const formatMeetingDetails = (meeting: {
  title: string;
  scheduledStart?: string;
  duration: number;
  joinUrl: string;
  roomCode: string;
}): string => {
  const lines = [`📹 Meeting: ${meeting.title}`];

  if (meeting.scheduledStart) {
    const date = new Date(meeting.scheduledStart);
    lines.push(`📅 When: ${date.toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    })}`);
  } else {
    lines.push(`📅 When: Starting now`);
  }

  const hours = Math.floor(meeting.duration / 60);
  const mins = meeting.duration % 60;
  const durationStr = hours > 0
    ? (mins > 0 ? `${hours} hour${hours > 1 ? 's' : ''} ${mins} min` : `${hours} hour${hours > 1 ? 's' : ''}`)
    : `${mins} minutes`;
  lines.push(`⏱️ Duration: ${durationStr}`);

  lines.push(`🔗 Join: ${meeting.joinUrl}`);
  lines.push(`📝 Meeting Code: ${meeting.roomCode}`);
  lines.push('');
  lines.push('Click the link or enter the code to join!');

  return lines.join('\n');
};

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
  const [participants, setParticipants] = useState('');
  const [sendInvites, setSendInvites] = useState(true);

  const [createdMeeting, setCreatedMeeting] = useState<{
    roomCode: string;
    joinUrl: string;
    title: string;
    scheduledStart?: string;
    duration: number;
  } | null>(null);
  const [copied, setCopied] = useState(false);
  const [copiedDetails, setCopiedDetails] = useState(false);
  const [showShareOptions, setShowShareOptions] = useState(false);

  const handleCreate = async () => {
    const meetingTitle = title || `Meeting ${new Date().toLocaleDateString()}`;
    const scheduledStart = mode === 'schedule' && scheduledDate && scheduledTime
      ? new Date(`${scheduledDate}T${scheduledTime}`).toISOString()
      : undefined;

    const data: CreateMeetingData = {
      title: meetingTitle,
      description: description || undefined,
      durationMinutes: duration,
      settings: {
        waitingRoom: waitingRoom,
      },
      sendInvites: sendInvites && participants.trim().length > 0,
    };

    if (scheduledStart) {
      data.scheduledStart = scheduledStart;
    }

    if (participants.trim()) {
      data.participants = participants.split(',').map((p) => p.trim()).filter(Boolean);
    }

    const result = await createMeeting(data);
    if (result) {
      setCreatedMeeting({
        ...result,
        title: meetingTitle,
        scheduledStart,
        duration,
      });
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

  const handleCopyDetails = async () => {
    if (createdMeeting) {
      const details = formatMeetingDetails(createdMeeting);
      await navigator.clipboard.writeText(details);
      setCopiedDetails(true);
      setTimeout(() => setCopiedDetails(false), 2000);
    }
  };

  const handleNativeShare = async () => {
    if (createdMeeting && navigator.share) {
      try {
        await navigator.share({
          title: createdMeeting.title,
          text: formatMeetingDetails(createdMeeting),
          url: createdMeeting.joinUrl,
        });
      } catch (err) {
        // User cancelled or share failed - fallback to copy
        handleCopyDetails();
      }
    } else {
      // Fallback for browsers without Web Share API
      handleCopyDetails();
    }
  };

  const handleDownloadCalendar = () => {
    if (createdMeeting) {
      const icsContent = generateICSFile({
        ...createdMeeting,
        description,
      });
      const blob = new Blob([icsContent], { type: 'text/calendar;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${createdMeeting.title.replace(/[^a-zA-Z0-9]/g, '_')}.ics`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    }
  };

  const handleShareViaEmail = () => {
    if (createdMeeting) {
      const subject = encodeURIComponent(`Join my meeting: ${createdMeeting.title}`);
      const body = encodeURIComponent(formatMeetingDetails(createdMeeting));
      window.open(`mailto:?subject=${subject}&body=${body}`);
    }
  };

  const handleShareViaWhatsApp = () => {
    if (createdMeeting) {
      const text = encodeURIComponent(formatMeetingDetails(createdMeeting));
      window.open(`https://wa.me/?text=${text}`);
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
    setParticipants('');
    setCopied(false);
    setCopiedDetails(false);
    setShowShareOptions(false);
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

            {/* Participants Input */}
            <div className="space-y-2">
              <label className="block text-sm font-medium text-gray-300">
                <Users size={16} className="inline mr-2" />
                Invite participants (optional)
              </label>
              <input
                type="text"
                value={participants}
                onChange={(e) => setParticipants(e.target.value)}
                placeholder="email@example.com, another@example.com"
                className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-xl text-white placeholder-gray-500 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none"
              />
              <p className="text-xs text-gray-500">
                Separate multiple emails with commas
              </p>
            </div>

            {/* Send Invites Toggle (shown when participants added) */}
            {participants.trim() && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                className="flex items-center gap-3"
              >
                <input
                  type="checkbox"
                  id="sendInvites"
                  checked={sendInvites}
                  onChange={(e) => setSendInvites(e.target.checked)}
                  className="w-4 h-4 text-emerald-500 border-gray-600 rounded focus:ring-emerald-500 bg-gray-700"
                />
                <label htmlFor="sendInvites" className="text-sm text-gray-300">
                  Send email invitations to participants
                </label>
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
            <div className="bg-gray-700/50 rounded-xl p-4 mb-4">
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
                  title="Copy link"
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
                  Link copied!
                </motion.p>
              )}
            </div>

            {/* Meeting Code */}
            <div className="bg-gray-700/30 rounded-xl p-3 mb-4 inline-block">
              <p className="text-xs text-gray-400 mb-1">Meeting Code</p>
              <p className="text-xl font-mono text-white tracking-wider">
                {createdMeeting?.roomCode}
              </p>
            </div>

            {/* Share Options */}
            <div className="mb-6">
              <button
                onClick={() => setShowShareOptions(!showShareOptions)}
                className="text-sm text-emerald-400 hover:text-emerald-300 flex items-center gap-1 mx-auto"
              >
                <Share2 size={16} />
                More sharing options
                <ChevronRight
                  size={16}
                  className={`transform transition-transform ${showShareOptions ? 'rotate-90' : ''}`}
                />
              </button>

              <AnimatePresence>
                {showShareOptions && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    className="mt-4 space-y-3"
                  >
                    {/* Share with Details */}
                    <button
                      onClick={handleCopyDetails}
                      className="w-full flex items-center gap-3 p-3 bg-gray-700/30 hover:bg-gray-700/50 rounded-xl transition-colors text-left"
                    >
                      <div className="w-10 h-10 rounded-lg bg-purple-500/20 flex items-center justify-center">
                        <FileText size={20} className="text-purple-400" />
                      </div>
                      <div className="flex-1">
                        <p className="text-sm font-medium text-white">Copy with Details</p>
                        <p className="text-xs text-gray-400">Copy formatted meeting info</p>
                      </div>
                      {copiedDetails ? (
                        <Check size={18} className="text-emerald-400" />
                      ) : (
                        <Copy size={18} className="text-gray-400" />
                      )}
                    </button>

                    {/* Native Share (Mobile) */}
                    {'share' in navigator && (
                      <button
                        onClick={handleNativeShare}
                        className="w-full flex items-center gap-3 p-3 bg-gray-700/30 hover:bg-gray-700/50 rounded-xl transition-colors text-left"
                      >
                        <div className="w-10 h-10 rounded-lg bg-blue-500/20 flex items-center justify-center">
                          <Share2 size={20} className="text-blue-400" />
                        </div>
                        <div className="flex-1">
                          <p className="text-sm font-medium text-white">Share</p>
                          <p className="text-xs text-gray-400">Share via your device</p>
                        </div>
                        <ChevronRight size={18} className="text-gray-400" />
                      </button>
                    )}

                    {/* Download Calendar */}
                    <button
                      onClick={handleDownloadCalendar}
                      className="w-full flex items-center gap-3 p-3 bg-gray-700/30 hover:bg-gray-700/50 rounded-xl transition-colors text-left"
                    >
                      <div className="w-10 h-10 rounded-lg bg-orange-500/20 flex items-center justify-center">
                        <Download size={20} className="text-orange-400" />
                      </div>
                      <div className="flex-1">
                        <p className="text-sm font-medium text-white">Add to Calendar</p>
                        <p className="text-xs text-gray-400">Download .ics file</p>
                      </div>
                      <Calendar size={18} className="text-gray-400" />
                    </button>

                    {/* Share via Email */}
                    <button
                      onClick={handleShareViaEmail}
                      className="w-full flex items-center gap-3 p-3 bg-gray-700/30 hover:bg-gray-700/50 rounded-xl transition-colors text-left"
                    >
                      <div className="w-10 h-10 rounded-lg bg-red-500/20 flex items-center justify-center">
                        <Mail size={20} className="text-red-400" />
                      </div>
                      <div className="flex-1">
                        <p className="text-sm font-medium text-white">Share via Email</p>
                        <p className="text-xs text-gray-400">Open in email client</p>
                      </div>
                      <ChevronRight size={18} className="text-gray-400" />
                    </button>

                    {/* Share via WhatsApp */}
                    <button
                      onClick={handleShareViaWhatsApp}
                      className="w-full flex items-center gap-3 p-3 bg-gray-700/30 hover:bg-gray-700/50 rounded-xl transition-colors text-left"
                    >
                      <div className="w-10 h-10 rounded-lg bg-green-500/20 flex items-center justify-center">
                        <MessageCircle size={20} className="text-green-400" />
                      </div>
                      <div className="flex-1">
                        <p className="text-sm font-medium text-white">Share via WhatsApp</p>
                        <p className="text-xs text-gray-400">Send to WhatsApp</p>
                      </div>
                      <ChevronRight size={18} className="text-gray-400" />
                    </button>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* Main Actions */}
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
