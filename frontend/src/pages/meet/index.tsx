import { useEffect, useState } from 'react';
import Layout from '@/components/Layout';
import Link from 'next/link';
import {
  Video,
  Plus,
  Calendar,
  Users,
  Clock,
  MoreVertical,
  Copy,
  Trash2,
  ExternalLink,
} from 'lucide-react';

interface Meeting {
  id: string;
  title: string;
  room_name: string;
  status: string;
  participants_count: number;
  host_name: string;
  created_at: string;
  scheduled_start?: string;
  duration_minutes?: number;
}

export default function MeetPage() {
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<'active' | 'scheduled' | 'past'>('active');

  useEffect(() => {
    // Mock data
    setMeetings([
      {
        id: '1',
        title: 'Team Standup',
        room_name: 'team-standup-abc123',
        status: 'active',
        participants_count: 5,
        host_name: 'John Doe',
        created_at: new Date().toISOString(),
      },
      {
        id: '2',
        title: 'Client Review',
        room_name: 'client-review-xyz789',
        status: 'scheduled',
        participants_count: 0,
        host_name: 'Jane Smith',
        created_at: new Date().toISOString(),
        scheduled_start: new Date(Date.now() + 3600000).toISOString(),
        duration_minutes: 60,
      },
      {
        id: '3',
        title: 'Project Planning',
        room_name: 'project-planning-def456',
        status: 'ended',
        participants_count: 8,
        host_name: 'John Doe',
        created_at: new Date(Date.now() - 86400000).toISOString(),
        duration_minutes: 45,
      },
    ]);
    setLoading(false);
  }, []);

  const filteredMeetings = meetings.filter((m) => {
    if (tab === 'active') return m.status === 'active';
    if (tab === 'scheduled') return m.status === 'scheduled';
    return m.status === 'ended';
  });

  const copyMeetingLink = (roomName: string) => {
    navigator.clipboard.writeText(`${window.location.origin}/meet/join/${roomName}`);
    // Would show toast notification
  };

  return (
    <Layout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Bheem Meet</h1>
            <p className="text-gray-500">Video conferencing for your team</p>
          </div>
          <div className="flex space-x-3">
            <Link
              href="/meet/schedule"
              className="flex items-center space-x-2 px-4 py-2 bg-white border border-gray-200 text-gray-700 rounded-lg hover:bg-gray-50"
            >
              <Calendar size={20} />
              <span>Schedule</span>
            </Link>
            <Link
              href="/meet/new"
              className="flex items-center space-x-2 px-4 py-2 bg-bheem-primary text-white rounded-lg hover:bg-bheem-secondary"
            >
              <Plus size={20} />
              <span>Start Meeting</span>
            </Link>
          </div>
        </div>

        {/* Quick Join */}
        <div className="bg-gradient-to-r from-bheem-primary to-bheem-secondary rounded-xl p-6 text-white">
          <h2 className="text-lg font-semibold mb-2">Join a Meeting</h2>
          <p className="text-blue-100 mb-4">Enter a meeting code or link to join</p>
          <div className="flex space-x-3">
            <input
              type="text"
              placeholder="Enter meeting code"
              className="flex-1 px-4 py-2 bg-white/20 rounded-lg placeholder-blue-200 text-white border border-white/30 focus:outline-none focus:ring-2 focus:ring-white/50"
            />
            <button className="px-6 py-2 bg-white text-bheem-primary font-medium rounded-lg hover:bg-blue-50">
              Join
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div className="border-b border-gray-200">
          <nav className="flex space-x-8">
            {[
              { id: 'active', label: 'Active', count: meetings.filter(m => m.status === 'active').length },
              { id: 'scheduled', label: 'Scheduled', count: meetings.filter(m => m.status === 'scheduled').length },
              { id: 'past', label: 'Past Meetings', count: meetings.filter(m => m.status === 'ended').length },
            ].map((t) => (
              <button
                key={t.id}
                onClick={() => setTab(t.id as any)}
                className={`pb-3 px-1 border-b-2 font-medium text-sm transition-colors ${
                  tab === t.id
                    ? 'border-bheem-primary text-bheem-primary'
                    : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}
              >
                {t.label}
                {t.count > 0 && (
                  <span className={`ml-2 px-2 py-0.5 rounded-full text-xs ${
                    tab === t.id ? 'bg-bheem-primary/10' : 'bg-gray-100'
                  }`}>
                    {t.count}
                  </span>
                )}
              </button>
            ))}
          </nav>
        </div>

        {/* Meetings List */}
        {loading ? (
          <div className="flex items-center justify-center h-64">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-bheem-primary"></div>
          </div>
        ) : filteredMeetings.length > 0 ? (
          <div className="grid gap-4">
            {filteredMeetings.map((meeting) => (
              <div
                key={meeting.id}
                className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 hover:shadow-md transition-shadow"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-4">
                    <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${
                      meeting.status === 'active' ? 'bg-green-100' :
                      meeting.status === 'scheduled' ? 'bg-blue-100' : 'bg-gray-100'
                    }`}>
                      <Video size={24} className={
                        meeting.status === 'active' ? 'text-green-600' :
                        meeting.status === 'scheduled' ? 'text-blue-600' : 'text-gray-600'
                      } />
                    </div>
                    <div>
                      <h3 className="font-semibold text-gray-900">{meeting.title}</h3>
                      <div className="flex items-center space-x-4 text-sm text-gray-500 mt-1">
                        <span className="flex items-center">
                          <Users size={14} className="mr-1" />
                          {meeting.participants_count} participants
                        </span>
                        <span className="flex items-center">
                          <Clock size={14} className="mr-1" />
                          {meeting.scheduled_start
                            ? new Date(meeting.scheduled_start).toLocaleString()
                            : new Date(meeting.created_at).toLocaleString()}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center space-x-2">
                    {meeting.status === 'active' && (
                      <span className="flex items-center px-2 py-1 bg-green-100 text-green-700 text-xs font-medium rounded-full">
                        <span className="w-2 h-2 bg-green-500 rounded-full mr-1 animate-pulse" />
                        Live
                      </span>
                    )}

                    {meeting.status !== 'ended' && (
                      <Link
                        href={`/meet/join/${meeting.room_name}`}
                        className="px-4 py-2 bg-bheem-primary text-white text-sm font-medium rounded-lg hover:bg-bheem-secondary flex items-center"
                      >
                        <ExternalLink size={16} className="mr-1" />
                        {meeting.status === 'active' ? 'Join' : 'Start'}
                      </Link>
                    )}

                    <button
                      onClick={() => copyMeetingLink(meeting.room_name)}
                      className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg"
                      title="Copy link"
                    >
                      <Copy size={18} />
                    </button>

                    <button className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg">
                      <MoreVertical size={18} />
                    </button>
                  </div>
                </div>

                {meeting.status === 'ended' && (
                  <div className="mt-4 pt-4 border-t border-gray-100 flex items-center justify-between">
                    <span className="text-sm text-gray-500">
                      Duration: {meeting.duration_minutes} minutes
                    </span>
                    <Link
                      href={`/recordings?meeting=${meeting.id}`}
                      className="text-sm text-bheem-primary hover:underline"
                    >
                      View Recording →
                    </Link>
                  </div>
                )}
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-12">
            <Video size={48} className="mx-auto text-gray-300 mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">No meetings found</h3>
            <p className="text-gray-500 mb-4">
              {tab === 'active'
                ? 'Start a new meeting or wait for scheduled ones to begin'
                : tab === 'scheduled'
                ? 'Schedule a meeting for later'
                : 'Your past meetings will appear here'}
            </p>
            <Link
              href="/meet/new"
              className="inline-flex items-center space-x-2 px-4 py-2 bg-bheem-primary text-white rounded-lg hover:bg-bheem-secondary"
            >
              <Plus size={20} />
              <span>Start Meeting</span>
            </Link>
          </div>
        )}
      </div>
    </Layout>
  );
}
