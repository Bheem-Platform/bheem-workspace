import { useState } from 'react';
import {
  X,
  Video,
  Calendar,
  Clock,
  Users,
  Link as LinkIcon,
  Copy,
  Check,
} from 'lucide-react';
import { useMeetStore } from '@/stores/meetStore';
import type { CreateMeetingData } from '@/types/meet';

interface CreateMeetingModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function CreateMeetingModal({ isOpen, onClose }: CreateMeetingModalProps) {
  const { createMeeting, loading } = useMeetStore();

  const [mode, setMode] = useState<'instant' | 'schedule'>('instant');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [scheduledDate, setScheduledDate] = useState('');
  const [scheduledTime, setScheduledTime] = useState('');
  const [duration, setDuration] = useState(60);
  const [participants, setParticipants] = useState('');
  const [sendInvites, setSendInvites] = useState(true);

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
      sendInvites,
    };

    if (mode === 'schedule' && scheduledDate && scheduledTime) {
      data.scheduledStart = new Date(`${scheduledDate}T${scheduledTime}`).toISOString();
    }

    if (participants.trim()) {
      data.participants = participants.split(',').map((p) => p.trim()).filter(Boolean);
    }

    const result = await createMeeting(data);
    if (result) {
      setCreatedMeeting(result);
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
    setCreatedMeeting(null);
    setTitle('');
    setDescription('');
    setScheduledDate('');
    setScheduledTime('');
    setParticipants('');
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/50" onClick={handleClose} />

      {/* Modal */}
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md mx-4 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900">
            {createdMeeting ? 'Meeting Created' : 'New Meeting'}
          </h2>
          <button
            onClick={handleClose}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <X size={20} className="text-gray-500" />
          </button>
        </div>

        {createdMeeting ? (
          /* Success View */
          <div className="p-6">
            <div className="text-center mb-6">
              <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <Check size={32} className="text-green-500" />
              </div>
              <h3 className="text-lg font-semibold text-gray-900">
                Your meeting is ready
              </h3>
              <p className="text-sm text-gray-500 mt-1">
                Share this link with others you want in the meeting
              </p>
            </div>

            <div className="bg-gray-50 rounded-lg p-4 mb-6">
              <div className="flex items-center gap-3">
                <LinkIcon size={18} className="text-gray-400" />
                <input
                  type="text"
                  value={createdMeeting.joinUrl}
                  readOnly
                  className="flex-1 bg-transparent text-sm text-gray-700 outline-none"
                />
                <button
                  onClick={handleCopyLink}
                  className="p-2 hover:bg-gray-200 rounded-lg transition-colors"
                >
                  {copied ? (
                    <Check size={18} className="text-green-500" />
                  ) : (
                    <Copy size={18} className="text-gray-500" />
                  )}
                </button>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={handleCopyLink}
                className="py-3 px-4 border border-gray-300 text-gray-700 font-medium rounded-lg hover:bg-gray-50 transition-colors"
              >
                Copy link
              </button>
              <button
                onClick={handleJoinNow}
                className="py-3 px-4 bg-green-500 text-white font-medium rounded-lg hover:bg-green-600 transition-colors"
              >
                Join now
              </button>
            </div>
          </div>
        ) : (
          /* Create Form */
          <div className="p-6 space-y-5">
            {/* Mode Toggle */}
            <div className="flex bg-gray-100 rounded-lg p-1">
              <button
                onClick={() => setMode('instant')}
                className={`
                  flex-1 py-2 text-sm font-medium rounded-md transition-colors
                  ${mode === 'instant' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-600'}
                `}
              >
                Start now
              </button>
              <button
                onClick={() => setMode('schedule')}
                className={`
                  flex-1 py-2 text-sm font-medium rounded-md transition-colors
                  ${mode === 'schedule' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-600'}
                `}
              >
                Schedule
              </button>
            </div>

            {/* Title */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Meeting title
              </label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Team standup"
                className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 outline-none"
              />
            </div>

            {/* Schedule fields */}
            {mode === 'schedule' && (
              <>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Date
                    </label>
                    <div className="relative">
                      <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                      <input
                        type="date"
                        value={scheduledDate}
                        onChange={(e) => setScheduledDate(e.target.value)}
                        className="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 outline-none"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Time
                    </label>
                    <div className="relative">
                      <Clock className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                      <input
                        type="time"
                        value={scheduledTime}
                        onChange={(e) => setScheduledTime(e.target.value)}
                        className="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 outline-none"
                      />
                    </div>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Duration
                  </label>
                  <select
                    value={duration}
                    onChange={(e) => setDuration(Number(e.target.value))}
                    className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 outline-none"
                  >
                    <option value={15}>15 minutes</option>
                    <option value={30}>30 minutes</option>
                    <option value={45}>45 minutes</option>
                    <option value={60}>1 hour</option>
                    <option value={90}>1.5 hours</option>
                    <option value={120}>2 hours</option>
                  </select>
                </div>
              </>
            )}

            {/* Participants */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                <Users size={16} className="inline mr-1" />
                Invite participants (optional)
              </label>
              <input
                type="text"
                value={participants}
                onChange={(e) => setParticipants(e.target.value)}
                placeholder="email@example.com, another@example.com"
                className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 outline-none"
              />
              <p className="text-xs text-gray-500 mt-1">
                Separate multiple emails with commas
              </p>
            </div>

            {/* Send invites checkbox */}
            {participants.trim() && (
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={sendInvites}
                  onChange={(e) => setSendInvites(e.target.checked)}
                  className="w-4 h-4 text-green-500 border-gray-300 rounded focus:ring-green-500"
                />
                <span className="text-sm text-gray-700">Send email invitations</span>
              </label>
            )}

            {/* Submit */}
            <button
              onClick={handleCreate}
              disabled={loading.creating}
              className="w-full py-3 px-4 bg-green-500 text-white font-medium rounded-lg hover:bg-green-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
            >
              {loading.creating ? (
                <>
                  <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                    <circle
                      className="opacity-25"
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="4"
                      fill="none"
                    />
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                    />
                  </svg>
                  Creating...
                </>
              ) : (
                <>
                  <Video size={20} />
                  {mode === 'instant' ? 'Start meeting' : 'Schedule meeting'}
                </>
              )}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
