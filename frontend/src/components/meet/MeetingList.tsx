import {
  Video,
  Calendar,
  Clock,
  Users,
  Copy,
  ExternalLink,
  MoreVertical,
  Trash2,
} from 'lucide-react';
import { useState } from 'react';
import { useMeetStore } from '@/stores/meetStore';
import { formatMeetingTime } from '@/lib/meetApi';
import type { Meeting } from '@/types/meet';

interface MeetingListProps {
  onJoin: (roomCode: string) => void;
}

export default function MeetingList({ onJoin }: MeetingListProps) {
  const { meetings, loading, endMeeting } = useMeetStore();

  if (loading.meetings) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-500" />
      </div>
    );
  }

  if (meetings.length === 0) {
    return (
      <div className="text-center py-12">
        <Video size={48} className="mx-auto text-gray-300 mb-4" />
        <h3 className="text-lg font-medium text-gray-900 mb-2">No meetings yet</h3>
        <p className="text-gray-500">
          Create a new meeting or join one using a meeting code
        </p>
      </div>
    );
  }

  // Group meetings by status
  const activeMeetings = meetings.filter((m) => m.status === 'active' || m.status === 'scheduled');
  const pastMeetings = meetings.filter((m) => m.status === 'ended');

  return (
    <div className="space-y-6">
      {activeMeetings.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-3">
            Upcoming & Active
          </h3>
          <div className="space-y-3">
            {activeMeetings.map((meeting) => (
              <MeetingCard
                key={meeting.id}
                meeting={meeting}
                onJoin={() => onJoin(meeting.roomCode)}
                onEnd={() => endMeeting(meeting.roomCode)}
              />
            ))}
          </div>
        </div>
      )}

      {pastMeetings.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-3">
            Past Meetings
          </h3>
          <div className="space-y-3">
            {pastMeetings.map((meeting) => (
              <MeetingCard
                key={meeting.id}
                meeting={meeting}
                onJoin={() => onJoin(meeting.roomCode)}
                isPast
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

interface MeetingCardProps {
  meeting: Meeting;
  onJoin: () => void;
  onEnd?: () => void;
  isPast?: boolean;
}

function MeetingCard({ meeting, onJoin, onEnd, isPast }: MeetingCardProps) {
  const [showMenu, setShowMenu] = useState(false);
  const [copied, setCopied] = useState(false);

  const copyLink = async () => {
    if (meeting.joinUrl) {
      await navigator.clipboard.writeText(meeting.joinUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div className="bg-white border border-gray-200 rounded-xl p-4 hover:shadow-md transition-shadow">
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <h4 className="font-medium text-gray-900 truncate">{meeting.title}</h4>
            {meeting.status === 'active' && (
              <span className="px-2 py-0.5 bg-green-100 text-green-700 text-xs font-medium rounded-full">
                Live
              </span>
            )}
          </div>

          <div className="flex items-center gap-4 text-sm text-gray-500">
            {meeting.scheduledStart && (
              <div className="flex items-center gap-1">
                <Calendar size={14} />
                <span>{formatMeetingTime(meeting.scheduledStart)}</span>
              </div>
            )}
            <div className="flex items-center gap-1">
              <Clock size={14} />
              <span>{meeting.roomCode}</span>
            </div>
            {meeting.participantsCount > 0 && (
              <div className="flex items-center gap-1">
                <Users size={14} />
                <span>{meeting.participantsCount}</span>
              </div>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2">
          {!isPast && (
            <button
              onClick={onJoin}
              className="px-4 py-2 bg-green-500 text-white text-sm font-medium rounded-lg hover:bg-green-600 transition-colors"
            >
              Join
            </button>
          )}

          <div className="relative">
            <button
              onClick={() => setShowMenu(!showMenu)}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <MoreVertical size={18} className="text-gray-500" />
            </button>

            {showMenu && (
              <div className="absolute right-0 top-full mt-1 bg-white rounded-lg shadow-lg border border-gray-200 py-1 min-w-[160px] z-10">
                <button
                  onClick={() => {
                    copyLink();
                    setShowMenu(false);
                  }}
                  className="w-full flex items-center gap-2 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
                >
                  <Copy size={16} />
                  <span>{copied ? 'Copied!' : 'Copy link'}</span>
                </button>
                <a
                  href={meeting.joinUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full flex items-center gap-2 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
                >
                  <ExternalLink size={16} />
                  <span>Open in new tab</span>
                </a>
                {onEnd && !isPast && (
                  <button
                    onClick={() => {
                      onEnd();
                      setShowMenu(false);
                    }}
                    className="w-full flex items-center gap-2 px-4 py-2 text-sm text-red-600 hover:bg-red-50"
                  >
                    <Trash2 size={16} />
                    <span>End meeting</span>
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
