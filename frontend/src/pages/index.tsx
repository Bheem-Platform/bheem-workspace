import { useEffect, useState } from 'react';
import Layout from '@/components/Layout';
import {
  Video,
  FileText,
  Mail,
  Users,
  Calendar,
  TrendingUp,
  Clock,
  Plus,
  ArrowRight,
} from 'lucide-react';
import Link from 'next/link';

interface DashboardStats {
  meetings_today: number;
  meetings_this_week: number;
  total_meetings: number;
  active_meetings: number;
  total_documents: number;
  storage_used_mb: number;
  storage_limit_mb: number;
  mailboxes_count: number;
  total_users: number;
}

interface Activity {
  id: string;
  type: string;
  action: string;
  title: string;
  user_name: string;
  timestamp: string;
}

interface UpcomingMeeting {
  id: string;
  title: string;
  room_name: string;
  scheduled_start: string;
  host_name: string;
}

export default function Dashboard() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [upcomingMeetings, setUpcomingMeetings] = useState<UpcomingMeeting[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Mock data for now - would fetch from API
    setStats({
      meetings_today: 3,
      meetings_this_week: 12,
      total_meetings: 156,
      active_meetings: 1,
      total_documents: 234,
      storage_used_mb: 2560,
      storage_limit_mb: 10240,
      mailboxes_count: 8,
      total_users: 12,
    });

    setActivities([
      { id: '1', type: 'meeting', action: 'created', title: 'Weekly Standup', user_name: 'John Doe', timestamp: new Date().toISOString() },
      { id: '2', type: 'document', action: 'edited', title: 'Project Proposal.docx', user_name: 'Jane Smith', timestamp: new Date(Date.now() - 3600000).toISOString() },
      { id: '3', type: 'recording', action: 'started', title: 'Client Meeting Recording', user_name: 'John Doe', timestamp: new Date(Date.now() - 7200000).toISOString() },
    ]);

    setUpcomingMeetings([
      { id: '1', title: 'Team Sync', room_name: 'team-sync', scheduled_start: new Date(Date.now() + 3600000).toISOString(), host_name: 'John Doe' },
      { id: '2', title: 'Client Review', room_name: 'client-review', scheduled_start: new Date(Date.now() + 7200000).toISOString(), host_name: 'Jane Smith' },
    ]);

    setLoading(false);
  }, []);

  const statCards = [
    { label: 'Active Meetings', value: stats?.active_meetings || 0, icon: Video, color: 'bg-green-500', href: '/meet' },
    { label: 'Meetings Today', value: stats?.meetings_today || 0, icon: Calendar, color: 'bg-blue-500', href: '/meet' },
    { label: 'Total Documents', value: stats?.total_documents || 0, icon: FileText, color: 'bg-purple-500', href: '/docs' },
    { label: 'Team Members', value: stats?.total_users || 0, icon: Users, color: 'bg-orange-500', href: '/team' },
  ];

  const quickActions = [
    { label: 'Start Meeting', icon: Video, href: '/meet/new', color: 'bg-bheem-primary' },
    { label: 'Upload Document', icon: FileText, href: '/docs?action=upload', color: 'bg-purple-500' },
    { label: 'Schedule Meeting', icon: Calendar, href: '/meet/schedule', color: 'bg-green-500' },
    { label: 'Compose Email', icon: Mail, href: '/mail/compose', color: 'bg-orange-500' },
  ];

  if (loading) {
    return (
      <Layout>
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-bheem-primary"></div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
            <p className="text-gray-500">Welcome back! Here's what's happening today.</p>
          </div>
          <Link
            href="/meet/new"
            className="flex items-center space-x-2 px-4 py-2 bg-bheem-primary text-white rounded-lg hover:bg-bheem-secondary transition-colors"
          >
            <Plus size={20} />
            <span>New Meeting</span>
          </Link>
        </div>

        {/* Quick Actions */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {quickActions.map((action) => (
            <Link
              key={action.label}
              href={action.href}
              className={`${action.color} text-white p-4 rounded-xl hover:opacity-90 transition-opacity`}
            >
              <action.icon size={24} className="mb-2" />
              <span className="font-medium">{action.label}</span>
            </Link>
          ))}
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {statCards.map((stat) => (
            <Link
              key={stat.label}
              href={stat.href}
              className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 hover:shadow-md transition-shadow"
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-500">{stat.label}</p>
                  <p className="text-3xl font-bold text-gray-900 mt-1">{stat.value}</p>
                </div>
                <div className={`${stat.color} p-3 rounded-lg`}>
                  <stat.icon size={24} className="text-white" />
                </div>
              </div>
            </Link>
          ))}
        </div>

        <div className="grid lg:grid-cols-2 gap-6">
          {/* Upcoming Meetings */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-100">
            <div className="flex items-center justify-between p-4 border-b border-gray-100">
              <h2 className="font-semibold text-gray-900">Upcoming Meetings</h2>
              <Link href="/meet" className="text-bheem-primary text-sm hover:underline flex items-center">
                View all <ArrowRight size={16} className="ml-1" />
              </Link>
            </div>
            <div className="p-4 space-y-3">
              {upcomingMeetings.length > 0 ? (
                upcomingMeetings.map((meeting) => (
                  <div
                    key={meeting.id}
                    className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
                  >
                    <div className="flex items-center space-x-3">
                      <div className="w-10 h-10 bg-bheem-primary/10 rounded-lg flex items-center justify-center">
                        <Video size={20} className="text-bheem-primary" />
                      </div>
                      <div>
                        <p className="font-medium text-gray-900">{meeting.title}</p>
                        <p className="text-sm text-gray-500">
                          {new Date(meeting.scheduled_start).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          {' · '}{meeting.host_name}
                        </p>
                      </div>
                    </div>
                    <Link
                      href={`/meet/join/${meeting.room_name}`}
                      className="px-3 py-1.5 bg-bheem-primary text-white text-sm rounded-lg hover:bg-bheem-secondary"
                    >
                      Join
                    </Link>
                  </div>
                ))
              ) : (
                <p className="text-gray-500 text-center py-8">No upcoming meetings</p>
              )}
            </div>
          </div>

          {/* Recent Activity */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-100">
            <div className="flex items-center justify-between p-4 border-b border-gray-100">
              <h2 className="font-semibold text-gray-900">Recent Activity</h2>
              <Link href="/activity" className="text-bheem-primary text-sm hover:underline flex items-center">
                View all <ArrowRight size={16} className="ml-1" />
              </Link>
            </div>
            <div className="p-4 space-y-3">
              {activities.map((activity) => (
                <div key={activity.id} className="flex items-start space-x-3">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                    activity.type === 'meeting' ? 'bg-blue-100' :
                    activity.type === 'document' ? 'bg-purple-100' : 'bg-green-100'
                  }`}>
                    {activity.type === 'meeting' ? <Video size={16} className="text-blue-600" /> :
                     activity.type === 'document' ? <FileText size={16} className="text-purple-600" /> :
                     <TrendingUp size={16} className="text-green-600" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-gray-900">
                      <span className="font-medium">{activity.user_name}</span>
                      {' '}{activity.action}{' '}
                      <span className="font-medium">{activity.title}</span>
                    </p>
                    <p className="text-xs text-gray-500 flex items-center mt-0.5">
                      <Clock size={12} className="mr-1" />
                      {new Date(activity.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Storage Usage */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-gray-900">Storage Usage</h2>
            <span className="text-sm text-gray-500">
              {((stats?.storage_used_mb || 0) / 1024).toFixed(1)} GB / {((stats?.storage_limit_mb || 0) / 1024).toFixed(0)} GB
            </span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-3">
            <div
              className="bg-bheem-primary h-3 rounded-full transition-all"
              style={{ width: `${((stats?.storage_used_mb || 0) / (stats?.storage_limit_mb || 1)) * 100}%` }}
            />
          </div>
          <p className="text-sm text-gray-500 mt-2">
            {(100 - ((stats?.storage_used_mb || 0) / (stats?.storage_limit_mb || 1)) * 100).toFixed(0)}% remaining
          </p>
        </div>
      </div>
    </Layout>
  );
}
