/**
 * User Dashboard - Comprehensive workspace analytics and quick access
 */
import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import Link from 'next/link';
import {
  Mail,
  Video,
  FileText,
  Calendar,
  TrendingUp,
  Clock,
  ChevronRight,
  Inbox,
  Users,
  FolderOpen,
} from 'lucide-react';
import { useAuthStore, useRequireAuth } from '@/stores/authStore';
import { api } from '@/lib/api';
import { KPICard, QuickAccessCard, ActivityTimeline } from '@/components/dashboard';
import { LineChart } from '@/components/charts';
import { WorkspaceLayout } from '@/components/workspace';

interface WorkspaceData {
  user: {
    id: string;
    username: string;
    email: string;
    name: string;
    company: string;
    role: string;
    workspace_role: string | null;
    tenant: {
      id: string;
      name: string;
      slug: string;
    } | null;
  };
  workspace: {
    email: {
      enabled: boolean;
      address: string;
      webmail_url: string;
    };
    files: {
      enabled: boolean;
      web_url: string;
    };
    calendar: {
      enabled: boolean;
      web_url: string;
    };
    meetings: {
      enabled: boolean;
      can_create: boolean;
    };
  };
}

interface DashboardStats {
  unreadEmails: number;
  todayEvents: number;
  recentDocs: number;
  activeMeets: number;
}

interface Activity {
  id: string;
  type: 'email' | 'document' | 'meeting' | 'calendar' | 'share' | 'edit' | 'delete' | 'user' | 'task';
  title: string;
  description?: string;
  time: string;
  isNew?: boolean;
}

const APP_CARDS = [
  {
    id: 'mail',
    name: 'Bheem Mail',
    description: 'Professional email',
    icon: Mail,
    color: 'blue' as const,
    href: '/mail',
    badgeKey: 'unreadEmails',
  },
  {
    id: 'docs',
    name: 'Bheem Docs',
    description: 'Documents & files',
    icon: FileText,
    color: 'purple' as const,
    href: '/docs',
    badgeKey: 'recentDocs',
  },
  {
    id: 'calendar',
    name: 'Bheem Calendar',
    description: 'Schedule & events',
    icon: Calendar,
    color: 'orange' as const,
    href: '/calendar',
    badgeKey: 'todayEvents',
  },
  {
    id: 'meet',
    name: 'Bheem Meet',
    description: 'Video meetings',
    icon: Video,
    color: 'green' as const,
    href: '/meet',
    badgeKey: 'activeMeets',
  },
];

// Mock activity data
const generateMockActivities = (): Activity[] => {
  return [
    {
      id: '1',
      type: 'email',
      title: 'New email from team',
      description: 'Project update discussion',
      time: '5m ago',
      isNew: true,
    },
    {
      id: '2',
      type: 'calendar',
      title: 'Meeting in 30 minutes',
      description: 'Team standup call',
      time: '30m',
      isNew: true,
    },
    {
      id: '3',
      type: 'document',
      title: 'Document shared with you',
      description: 'Q4 Report.docx',
      time: '1h ago',
    },
    {
      id: '4',
      type: 'meeting',
      title: 'Call recording available',
      description: 'Client meeting (45 min)',
      time: '2h ago',
    },
    {
      id: '5',
      type: 'share',
      title: 'Folder shared with you',
      description: 'Marketing Assets',
      time: '3h ago',
    },
  ];
};

// Mock chart data for weekly activity
const generateWeeklyActivity = () => {
  const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  return days.map((day, i) => ({
    label: day,
    value: Math.floor(Math.random() * 50) + 10 + (i < 5 ? 20 : 0),
  }));
};

export default function UserDashboard() {
  const router = useRouter();
  const { user } = useAuthStore();
  const [workspaceData, setWorkspaceData] = useState<WorkspaceData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [stats, setStats] = useState<DashboardStats>({
    unreadEmails: 0,
    todayEvents: 0,
    recentDocs: 0,
    activeMeets: 0,
  });
  const [activities] = useState<Activity[]>(generateMockActivities());
  const [weeklyData] = useState(generateWeeklyActivity());

  const { isAuthenticated, isLoading: authLoading } = useRequireAuth();

  useEffect(() => {
    if (!isAuthenticated || authLoading) return;

    const fetchWorkspace = async () => {
      try {
        const response = await api.get('/user-workspace/me');
        setWorkspaceData(response.data);

        // Try to fetch dashboard stats
        try {
          const statsRes = await api.get('/user-workspace/dashboard-stats');
          setStats(statsRes.data);
        } catch {
          // Use mock stats if endpoint not available
          setStats({
            unreadEmails: 12,
            todayEvents: 3,
            recentDocs: 8,
            activeMeets: 0,
          });
        }
      } catch (err: any) {
        console.error('Failed to fetch workspace:', err);
        setError('Failed to load workspace data');
      } finally {
        setLoading(false);
      }
    };

    fetchWorkspace();
  }, [isAuthenticated, authLoading]);

  if (authLoading || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading your workspace...</p>
        </div>
      </div>
    );
  }

  const displayName = workspaceData?.user?.name || user?.username || 'User';
  const firstName = displayName.split(' ')[0];
  const currentHour = new Date().getHours();
  const greeting = currentHour < 12 ? 'Good morning' : currentHour < 17 ? 'Good afternoon' : 'Good evening';

  return (
    <>
      <Head>
        <title>Dashboard | Bheem Workspace</title>
      </Head>

      <WorkspaceLayout title="Dashboard">
        <div className="max-w-7xl mx-auto space-y-6">
          {/* Welcome Banner */}
          <div className="bg-gradient-to-r from-blue-600 via-blue-700 to-purple-700 rounded-2xl p-6 md:p-8 text-white relative overflow-hidden">
            <div className="absolute inset-0 bg-grid-white/[0.05] bg-[size:20px_20px]" />
            <div className="relative z-10">
              <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                <div>
                  <p className="text-blue-200 text-sm font-medium">{greeting},</p>
                  <h2 className="text-2xl md:text-3xl font-bold mt-1">{firstName}!</h2>
                  <p className="mt-2 text-blue-100 max-w-md">
                    Here's what's happening in your workspace today
                  </p>
                </div>
                <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
                  {workspaceData?.user?.workspace_role && (
                    <span className="px-4 py-1.5 bg-white/20 backdrop-blur rounded-full text-sm font-medium">
                      {workspaceData.user.workspace_role.charAt(0).toUpperCase() +
                       workspaceData.user.workspace_role.slice(1)}
                    </span>
                  )}
                  <div className="flex items-center gap-2 text-sm text-blue-100">
                    <Clock size={16} />
                    {new Date().toLocaleDateString('en-US', {
                      weekday: 'long',
                      month: 'long',
                      day: 'numeric'
                    })}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Error Message */}
          {error && (
            <div className="p-4 bg-red-50 border border-red-200 rounded-lg flex items-center gap-3">
              <span className="text-red-500">!</span>
              <p className="text-red-700">{error}</p>
            </div>
          )}

          {/* KPI Stats Row */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <KPICard
              title="Unread Emails"
              value={stats.unreadEmails}
              icon={Inbox}
              color="blue"
              trend={stats.unreadEmails > 5 ? { value: 15, direction: 'up' } : undefined}
              href="/mail"
            />
            <KPICard
              title="Today's Events"
              value={stats.todayEvents}
              icon={Calendar}
              color="orange"
              subtitle={stats.todayEvents > 0 ? 'Next in 30 min' : 'No events'}
              href="/calendar"
            />
            <KPICard
              title="Recent Documents"
              value={stats.recentDocs}
              icon={FolderOpen}
              color="purple"
              subtitle="Last 7 days"
              href="/docs"
            />
            <KPICard
              title="Active Meetings"
              value={stats.activeMeets}
              icon={Users}
              color="green"
              subtitle={stats.activeMeets > 0 ? 'Join now' : 'None active'}
              href="/meet"
            />
          </div>

          {/* Quick Access Apps */}
          <div>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900">Quick Access</h3>
              <Link
                href="/apps"
                className="text-sm text-blue-600 hover:text-blue-700 font-medium flex items-center gap-1"
              >
                All apps <ChevronRight size={16} />
              </Link>
            </div>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              {APP_CARDS.map((app) => (
                <QuickAccessCard
                  key={app.id}
                  name={app.name}
                  description={app.description}
                  icon={app.icon}
                  href={app.href}
                  color={app.color}
                  badge={stats[app.badgeKey as keyof DashboardStats] || undefined}
                />
              ))}
            </div>
          </div>

          {/* Charts and Activity Row */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Weekly Activity Chart */}
            <div className="bg-white rounded-xl border border-gray-200 p-6">
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h3 className="text-lg font-semibold text-gray-900">Weekly Activity</h3>
                  <p className="text-sm text-gray-500 mt-1">Your workspace engagement</p>
                </div>
                <div className="flex items-center gap-2 text-sm text-green-600 bg-green-50 px-3 py-1 rounded-full">
                  <TrendingUp size={14} />
                  <span className="font-medium">+12%</span>
                </div>
              </div>
              <LineChart
                data={weeklyData}
                height={200}
                color="blue"
                showArea={true}
                showDots={true}
                showGrid={true}
              />
            </div>

            {/* Recent Activity Timeline */}
            <ActivityTimeline
              activities={activities}
              maxItems={5}
              showViewAll={true}
              onViewAll={() => router.push('/activity')}
            />
          </div>

          {/* Quick Actions */}
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Quick Actions</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <Link
                href="/mail/compose"
                className="flex items-center gap-3 p-4 bg-blue-50 rounded-xl hover:bg-blue-100 transition-colors group"
              >
                <div className="p-2 bg-blue-100 rounded-lg group-hover:bg-blue-200 transition-colors">
                  <Mail className="text-blue-600" size={20} />
                </div>
                <div>
                  <p className="font-medium text-gray-900">Compose Email</p>
                  <p className="text-sm text-gray-500">Send a new message</p>
                </div>
              </Link>

              <Link
                href="/meet/new"
                className="flex items-center gap-3 p-4 bg-green-50 rounded-xl hover:bg-green-100 transition-colors group"
              >
                <div className="p-2 bg-green-100 rounded-lg group-hover:bg-green-200 transition-colors">
                  <Video className="text-green-600" size={20} />
                </div>
                <div>
                  <p className="font-medium text-gray-900">Start Meeting</p>
                  <p className="text-sm text-gray-500">Create video call</p>
                </div>
              </Link>

              <Link
                href="/docs/new"
                className="flex items-center gap-3 p-4 bg-purple-50 rounded-xl hover:bg-purple-100 transition-colors group"
              >
                <div className="p-2 bg-purple-100 rounded-lg group-hover:bg-purple-200 transition-colors">
                  <FileText className="text-purple-600" size={20} />
                </div>
                <div>
                  <p className="font-medium text-gray-900">New Document</p>
                  <p className="text-sm text-gray-500">Create or upload</p>
                </div>
              </Link>

              <Link
                href="/calendar/new"
                className="flex items-center gap-3 p-4 bg-orange-50 rounded-xl hover:bg-orange-100 transition-colors group"
              >
                <div className="p-2 bg-orange-100 rounded-lg group-hover:bg-orange-200 transition-colors">
                  <Calendar className="text-orange-600" size={20} />
                </div>
                <div>
                  <p className="font-medium text-gray-900">Schedule Event</p>
                  <p className="text-sm text-gray-500">Add to calendar</p>
                </div>
              </Link>
            </div>
          </div>
        </div>
      </WorkspaceLayout>
    </>
  );
}
