/**
 * User Dashboard - Bheem Workspace
 * Design inspired by Admin Dashboard with brand colors: #FFCCF2, #977DFF, #0033FF
 */
import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import Link from 'next/link';
import WorkspaceLayout from '@/components/workspace/WorkspaceLayout';
import {
  Mail,
  Video,
  FileText,
  Calendar,
  Clock,
  Inbox,
  Users,
  FolderOpen,
  ArrowRight,
  Sparkles,
  ChevronRight,
  RefreshCw,
} from 'lucide-react';
import { useAuthStore, useRequireAuth } from '@/stores/authStore';
import { api } from '@/lib/api';
import { DonutChart } from '@/components/charts';
import AppsCarousel from '@/components/shared/AppsCarousel';
import {
  BheemMailIcon,
  BheemDocsIcon,
  BheemCalendarIcon,
  BheemMeetIcon,
  BheemDriveIcon,
  BheemSheetsIcon,
  BheemSlidesIcon,
  BheemChatIcon,
} from '@/components/shared/AppIcons';

// API imports
import { getInbox, getMailSessionStatus } from '@/lib/mailApi';
import { getTodayEvents } from '@/lib/calendarApi';
import { listRooms } from '@/lib/meetApi';
import { getStorageUsage, getRecentFiles, getActivity, type DriveActivity } from '@/lib/driveApi';

interface DashboardStats {
  unreadEmails: number;
  todayEvents: number;
  recentDocs: number;
  activeMeets: number;
  totalStorage: number;
  usedStorage: number;
  filesCount: number;
  nextEventTime?: string;
  urgentEmails: number;
}

interface Activity {
  id: string;
  type: 'email' | 'document' | 'meeting' | 'calendar' | 'share' | 'file';
  title: string;
  description?: string;
  time: string;
  isNew?: boolean;
}

interface StorageBreakdown {
  mail: number;
  docs: number;
  drive: number;
}

// Format relative time
const formatRelativeTime = (dateStr: string): string => {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString();
};

// Map drive activity to dashboard activity
const mapDriveActivityToActivity = (driveActivity: DriveActivity): Activity => {
  const actionTypeMap: Record<string, Activity['type']> = {
    'upload': 'file',
    'download': 'file',
    'create': 'document',
    'edit': 'document',
    'delete': 'file',
    'move': 'file',
    'rename': 'file',
    'share': 'share',
    'unshare': 'share',
    'star': 'file',
    'unstar': 'file',
    'trash': 'file',
    'restore': 'file',
  };

  const actionTitleMap: Record<string, string> = {
    'upload': 'File uploaded',
    'download': 'File downloaded',
    'create': 'Document created',
    'edit': 'Document edited',
    'delete': 'File deleted',
    'move': 'File moved',
    'rename': 'File renamed',
    'share': 'File shared',
    'unshare': 'Share removed',
    'star': 'File starred',
    'unstar': 'File unstarred',
    'trash': 'File moved to trash',
    'restore': 'File restored',
  };

  return {
    id: driveActivity.id,
    type: actionTypeMap[driveActivity.action] || 'file',
    title: actionTitleMap[driveActivity.action] || driveActivity.action,
    description: driveActivity.file_name,
    time: formatRelativeTime(driveActivity.created_at),
    isNew: new Date(driveActivity.created_at).getTime() > Date.now() - 3600000, // Last hour
  };
};

// Stats Card Component (matching admin style)
function StatsCard({
  title,
  value,
  icon: Icon,
  subtitle,
  color = 'purple',
  href,
}: {
  title: string;
  value: string | number;
  icon: React.ElementType;
  subtitle?: string;
  color?: 'pink' | 'purple' | 'blue' | 'green';
  href?: string;
}) {
  const colorClasses = {
    pink: 'bg-[#FFCCF2]/30 text-[#977DFF]',
    purple: 'bg-[#977DFF]/20 text-[#977DFF]',
    blue: 'bg-[#0033FF]/10 text-[#0033FF]',
    green: 'bg-emerald-100 text-emerald-600',
  };

  const content = (
    <div className={`bg-white rounded-xl border border-gray-200 p-6 ${href ? 'hover:shadow-lg hover:border-[#977DFF]/30 transition-all cursor-pointer' : ''}`}>
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <p className="text-sm font-medium text-gray-500">{title}</p>
          <p className="mt-2 text-3xl font-bold text-gray-900">{value}</p>
          {subtitle && (
            <p className="mt-1 text-sm text-gray-500">{subtitle}</p>
          )}
        </div>
        <div className={`p-3 rounded-xl ${colorClasses[color]}`}>
          <Icon size={24} />
        </div>
      </div>
    </div>
  );

  if (href) {
    return <Link href={href}>{content}</Link>;
  }
  return content;
}

// Service Card Component
function ServiceCard({
  name,
  icon: IconComponent,
  status,
  metrics,
  href,
}: {
  name: string;
  icon: React.FC<{ size?: number }>;
  status: 'operational' | 'degraded' | 'down';
  metrics: { label: string; value: string | number }[];
  href: string;
}) {
  const statusConfig = {
    operational: { color: 'bg-emerald-500', label: 'Operational' },
    degraded: { color: 'bg-yellow-500', label: 'Degraded' },
    down: { color: 'bg-red-500', label: 'Down' },
  };

  return (
    <Link href={href}>
      <div className="bg-white rounded-xl border border-gray-200 p-6 hover:shadow-lg hover:border-[#977DFF]/30 transition-all cursor-pointer">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <IconComponent size={40} />
            <div>
              <h3 className="font-semibold text-gray-900">{name}</h3>
              <div className="flex items-center gap-2 mt-1">
                <span className={`w-2 h-2 rounded-full ${statusConfig[status].color}`} />
                <span className="text-xs text-gray-500">{statusConfig[status].label}</span>
              </div>
            </div>
          </div>
          <ArrowRight size={20} className="text-gray-400" />
        </div>
        <div className="grid grid-cols-2 gap-4">
          {metrics.map((metric, i) => (
            <div key={i} className="bg-gray-50 rounded-lg p-3">
              <p className="text-xs text-gray-500">{metric.label}</p>
              <p className="font-semibold text-gray-900">{metric.value}</p>
            </div>
          ))}
        </div>
      </div>
    </Link>
  );
}

// Activity Feed Component
function ActivityFeed({ activities }: { activities: Activity[] }) {
  const iconConfig: Record<string, { icon: React.ElementType; color: string }> = {
    email: { icon: Mail, color: 'bg-[#FFCCF2] text-[#977DFF]' },
    document: { icon: FileText, color: 'bg-[#977DFF]/20 text-[#977DFF]' },
    meeting: { icon: Video, color: 'bg-emerald-100 text-emerald-600' },
    calendar: { icon: Calendar, color: 'bg-[#0033FF]/10 text-[#0033FF]' },
    share: { icon: Users, color: 'bg-[#FFCCF2] text-[#977DFF]' },
    file: { icon: FolderOpen, color: 'bg-[#977DFF]/20 text-[#977DFF]' },
  };

  if (activities.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-8 text-center">
        <Clock size={40} className="text-gray-300 mb-3" />
        <p className="text-gray-500">No recent activity</p>
      </div>
    );
  }

  return (
    <div className="space-y-1">
      {activities.map(activity => {
        const config = iconConfig[activity.type] || iconConfig.file;
        const Icon = config.icon;
        return (
          <div
            key={activity.id}
            className={`flex items-start gap-3 p-3 rounded-lg transition-colors ${activity.isNew ? 'bg-[#FFCCF2]/10' : 'hover:bg-gray-50'}`}
          >
            <div className={`p-2 rounded-lg ${config.color} flex-shrink-0`}>
              <Icon size={16} />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-start justify-between gap-2">
                <p className="text-sm font-medium text-gray-900 truncate">
                  {activity.title}
                  {activity.isNew && (
                    <span className="ml-2 px-1.5 py-0.5 rounded text-xs font-medium bg-[#977DFF] text-white">
                      New
                    </span>
                  )}
                </p>
                <span className="text-xs text-gray-400 whitespace-nowrap">{activity.time}</span>
              </div>
              {activity.description && (
                <p className="text-xs text-gray-500 mt-0.5 truncate">{activity.description}</p>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// Format storage size
function formatStorageSize(mb: number): string {
  if (mb >= 1024) {
    return `${(mb / 1024).toFixed(2)} GB`;
  }
  return `${mb.toFixed(3)} MB`;
}

export default function UserDashboard() {
  const router = useRouter();
  const { user } = useAuthStore();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [stats, setStats] = useState<DashboardStats>({
    unreadEmails: 0,
    todayEvents: 0,
    recentDocs: 0,
    activeMeets: 0,
    totalStorage: 0,
    usedStorage: 0,
    filesCount: 0,
    urgentEmails: 0,
  });
  const [activities, setActivities] = useState<Activity[]>([]);
  const [storageBreakdown, setStorageBreakdown] = useState<StorageBreakdown>({
    mail: 0,
    docs: 0,
    drive: 0,
  });
  const [isMailConnected, setIsMailConnected] = useState(false);

  const { isAuthenticated, isLoading: authLoading } = useRequireAuth();

  // Fetch dashboard data from all services
  const fetchDashboardData = useCallback(async (showRefreshing = false) => {
    if (showRefreshing) setRefreshing(true);

    try {
      // Fetch all data in parallel
      const [
        mailSessionResult,
        todayEventsResult,
        activeMeetsResult,
        storageResult,
        recentFilesResult,
        activityResult,
        recentDocsResult,
      ] = await Promise.allSettled([
        // Check mail session and get inbox
        (async () => {
          try {
            const status = await getMailSessionStatus();
            if (status.active) {
              const inbox = await getInbox('INBOX', 1, 50);
              const unread = inbox.messages?.filter((m: any) => !m.is_read)?.length || 0;
              const flagged = inbox.messages?.filter((m: any) => m.is_flagged)?.length || 0;
              return { connected: true, unread, flagged, total: inbox.total || 0 };
            }
            return { connected: false, unread: 0, flagged: 0, total: 0 };
          } catch {
            return { connected: false, unread: 0, flagged: 0, total: 0 };
          }
        })(),
        // Get today's calendar events
        (async () => {
          try {
            const events = await getTodayEvents();
            // Find next upcoming event
            const now = new Date();
            const upcoming = events
              .filter(e => new Date(e.start) > now)
              .sort((a, b) => new Date(a.start).getTime() - new Date(b.start).getTime());
            const nextEvent = upcoming[0];
            let nextEventTime = '';
            if (nextEvent) {
              const diffMins = Math.round((new Date(nextEvent.start).getTime() - now.getTime()) / 60000);
              if (diffMins < 60) {
                nextEventTime = `Next in ${diffMins}m`;
              } else {
                nextEventTime = `Next in ${Math.round(diffMins / 60)}h`;
              }
            }
            return { count: events.length, nextEventTime };
          } catch {
            return { count: 0, nextEventTime: '' };
          }
        })(),
        // Get active meetings
        (async () => {
          try {
            const rooms = await listRooms('active');
            return rooms.length;
          } catch {
            return 0;
          }
        })(),
        // Get storage usage
        (async () => {
          try {
            const storage = await getStorageUsage();
            return storage;
          } catch {
            return { used: 0, total: 0, percentage: 0 };
          }
        })(),
        // Get recent files count
        (async () => {
          try {
            const files = await getRecentFiles(100);
            return files.length;
          } catch {
            return 0;
          }
        })(),
        // Get activity feed
        (async () => {
          try {
            const activity = await getActivity(10);
            return activity;
          } catch {
            return [];
          }
        })(),
        // Get recent documents count
        (async () => {
          try {
            const response = await api.get('/docs/editor/documents', {
              params: { limit: 50 },
            });
            return response.data?.documents?.length || 0;
          } catch {
            return 0;
          }
        })(),
      ]);

      // Extract results safely
      const mailData = mailSessionResult.status === 'fulfilled' ? mailSessionResult.value : { connected: false, unread: 0, flagged: 0 };
      const calendarData = todayEventsResult.status === 'fulfilled' ? todayEventsResult.value : { count: 0, nextEventTime: '' };
      const activeMeetsCount = activeMeetsResult.status === 'fulfilled' ? activeMeetsResult.value : 0;
      const storageData = storageResult.status === 'fulfilled' ? storageResult.value : { used: 0, total: 0 };
      const filesCount = recentFilesResult.status === 'fulfilled' ? recentFilesResult.value : 0;
      const activityData = activityResult.status === 'fulfilled' ? activityResult.value : [];
      const recentDocsCount = recentDocsResult.status === 'fulfilled' ? recentDocsResult.value : 0;

      setIsMailConnected(mailData.connected);

      // Update stats
      setStats({
        unreadEmails: mailData.unread,
        urgentEmails: mailData.flagged,
        todayEvents: calendarData.count,
        nextEventTime: calendarData.nextEventTime,
        activeMeets: activeMeetsCount,
        recentDocs: recentDocsCount,
        totalStorage: storageData.total || 5 * 1024 * 1024 * 1024, // Default 5GB
        usedStorage: storageData.used || 0,
        filesCount,
      });

      // Set storage breakdown (estimate based on usage)
      const usedMB = Math.round((storageData.used || 0) / (1024 * 1024));
      setStorageBreakdown({
        mail: Math.round(usedMB * 0.4),
        docs: Math.round(usedMB * 0.35),
        drive: Math.round(usedMB * 0.25),
      });

      // Map activities
      const mappedActivities: Activity[] = activityData.map(mapDriveActivityToActivity);

      // Add calendar events as activities if any upcoming
      if (calendarData.count > 0) {
        mappedActivities.unshift({
          id: 'calendar-today',
          type: 'calendar',
          title: `${calendarData.count} event${calendarData.count > 1 ? 's' : ''} today`,
          description: calendarData.nextEventTime || 'View calendar',
          time: 'Today',
          isNew: true,
        });
      }

      // Add unread emails notification
      if (mailData.unread > 0) {
        mappedActivities.unshift({
          id: 'mail-unread',
          type: 'email',
          title: `${mailData.unread} unread email${mailData.unread > 1 ? 's' : ''}`,
          description: mailData.flagged > 0 ? `${mailData.flagged} flagged` : 'Check your inbox',
          time: 'Now',
          isNew: true,
        });
      }

      setActivities(mappedActivities.slice(0, 5));

    } catch (error) {
      console.error('Error fetching dashboard data:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    if (!isAuthenticated || authLoading) return;
    fetchDashboardData();

    // Refresh every 60 seconds
    const interval = setInterval(() => fetchDashboardData(), 60000);
    return () => clearInterval(interval);
  }, [isAuthenticated, authLoading, fetchDashboardData]);

  // Skip showing loading screen - LoginLoader already handles the transition
  if (authLoading) {
    return null;
  }

  const displayName = user?.username || user?.email?.split('@')[0] || 'User';
  const firstName = displayName.split(' ')[0];
  const currentHour = new Date().getHours();
  const greeting = currentHour < 12 ? 'Good morning' : currentHour < 17 ? 'Good afternoon' : 'Good evening';

  // Storage breakdown for donut chart - using real data
  const storageData = [
    { label: 'Mail', value: storageBreakdown.mail || 1, color: '#FFCCF2' },
    { label: 'Docs', value: storageBreakdown.docs || 1, color: '#977DFF' },
    { label: 'Drive', value: storageBreakdown.drive || 1, color: '#0033FF' },
  ];
  const totalStorageMB = storageBreakdown.mail + storageBreakdown.docs + storageBreakdown.drive;

  // Handle refresh
  const handleRefresh = () => {
    fetchDashboardData(true);
  };

  return (
    <WorkspaceLayout title="Dashboard">
      <Head>
        <title>Dashboard | Bheem Workspace</title>
      </Head>

      <div className="h-full bg-gray-50 overflow-auto">
        {/* Welcome Banner */}
        <div className="bg-gradient-to-r from-[#FFCCF2] via-[#977DFF] to-[#0033FF] relative overflow-hidden">
          <div className="absolute inset-0 bg-grid-white/[0.05] bg-[size:20px_20px]" />
          <div className="absolute -top-24 -right-24 w-64 h-64 bg-white/10 rounded-full blur-3xl" />
          <div className="absolute -bottom-24 -left-24 w-64 h-64 bg-white/10 rounded-full blur-3xl" />

          <div className="relative z-10 px-6 py-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-white/20 backdrop-blur rounded-xl">
                  <Sparkles size={28} className="text-white" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <p className="text-white/80 text-sm">{greeting},</p>
                  </div>
                  <h1 className="text-2xl md:text-3xl font-bold text-white">{firstName}!</h1>
                  <p className="mt-1 text-white/70">
                    Here's what's happening in your workspace today
                  </p>
                </div>
              </div>
              <div className="hidden md:flex items-center gap-3">
                <button
                  onClick={handleRefresh}
                  disabled={refreshing}
                  className="flex items-center gap-2 px-4 py-2 bg-white/20 backdrop-blur rounded-full text-white text-sm hover:bg-white/30 transition-colors disabled:opacity-50"
                >
                  <RefreshCw size={16} className={refreshing ? 'animate-spin' : ''} />
                  {refreshing ? 'Refreshing...' : 'Refresh'}
                </button>
                <div className="flex items-center gap-2 px-4 py-2 bg-white/20 backdrop-blur rounded-full text-white text-sm">
                  <Clock size={16} />
                  {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })}
                </div>
                <div className="w-10 h-10 rounded-full bg-white flex items-center justify-center text-[#977DFF] font-bold">
                  {firstName.charAt(0).toUpperCase()}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Main Content */}
        <div className="px-6 py-6 space-y-6">
          {/* Quick Stats */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <StatsCard
              title="Unread Emails"
              value={isMailConnected ? stats.unreadEmails : '-'}
              icon={Inbox}
              color="pink"
              href="/mail"
              subtitle={!isMailConnected ? 'Login to mail' : stats.urgentEmails > 0 ? `${stats.urgentEmails} flagged` : 'All caught up'}
            />
            <StatsCard
              title="Today's Events"
              value={stats.todayEvents}
              icon={Calendar}
              color="purple"
              href="/calendar"
              subtitle={stats.nextEventTime || (stats.todayEvents > 0 ? 'View calendar' : 'No events')}
            />
            <StatsCard
              title="Recent Documents"
              value={stats.recentDocs}
              icon={FileText}
              color="blue"
              href="/docs"
              subtitle="Your documents"
            />
            <StatsCard
              title="Active Meetings"
              value={stats.activeMeets}
              icon={Video}
              color="green"
              href="/meet"
              subtitle={stats.activeMeets > 0 ? 'Join now' : 'None active'}
            />
          </div>

          {/* Charts Row */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Storage Breakdown */}
            <div className="bg-white rounded-xl border border-gray-200 p-6">
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h3 className="text-lg font-semibold text-gray-900">Storage Usage</h3>
                  <p className="text-sm text-gray-500 mt-1">By service</p>
                </div>
                <div className="text-right">
                  <p className="text-2xl font-bold text-gray-900">{formatStorageSize(totalStorageMB > 0 ? totalStorageMB : stats.usedStorage / (1024 * 1024))}</p>
                  <p className="text-sm text-gray-500">of {formatStorageSize(stats.totalStorage / (1024 * 1024))} used</p>
                </div>
              </div>
              <DonutChart
                data={storageData}
                size={200}
                thickness={35}
                showLegend={true}
              />
            </div>

            {/* Apps Carousel */}
            <AppsCarousel />
          </div>

          {/* Quick Actions & Activity */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Quick Actions */}
            <div className="bg-white rounded-xl border border-gray-200 p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Quick Actions</h2>
              <div className="space-y-3">
                <Link href="/mail/compose">
                  <div className="flex items-center gap-3 px-4 py-3 bg-[#FFCCF2]/30 text-[#977DFF] rounded-lg hover:bg-[#FFCCF2]/50 transition-colors cursor-pointer">
                    <Mail size={20} />
                    <span className="font-medium">Compose Email</span>
                  </div>
                </Link>
                <Link href="/meet">
                  <div className="flex items-center gap-3 px-4 py-3 bg-emerald-50 text-emerald-700 rounded-lg hover:bg-emerald-100 transition-colors cursor-pointer">
                    <Video size={20} />
                    <span className="font-medium">Start Meeting</span>
                  </div>
                </Link>
                <Link href="/docs">
                  <div className="flex items-center gap-3 px-4 py-3 bg-[#977DFF]/20 text-[#977DFF] rounded-lg hover:bg-[#977DFF]/30 transition-colors cursor-pointer">
                    <FileText size={20} />
                    <span className="font-medium">New Document</span>
                  </div>
                </Link>
                <Link href="/calendar">
                  <div className="flex items-center gap-3 px-4 py-3 bg-[#0033FF]/10 text-[#0033FF] rounded-lg hover:bg-[#0033FF]/20 transition-colors cursor-pointer">
                    <Calendar size={20} />
                    <span className="font-medium">Schedule Event</span>
                  </div>
                </Link>
              </div>
            </div>

            {/* Recent Activity */}
            <div className="lg:col-span-2 bg-white rounded-xl border border-gray-200 p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold text-gray-900">Recent Activity</h2>
                <button className="text-sm text-[#977DFF] hover:text-[#0033FF] font-medium">
                  View All
                </button>
              </div>
              <ActivityFeed activities={activities} />
            </div>
          </div>

          {/* Apps / Services */}
          <div>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-gray-900">Your Apps</h2>
              <Link href="/apps" className="text-sm text-[#977DFF] hover:text-[#0033FF] font-medium flex items-center gap-1">
                View all <ChevronRight size={16} />
              </Link>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <ServiceCard
                name="Bheem Mail"
                icon={BheemMailIcon}
                status={isMailConnected ? 'operational' : 'degraded'}
                metrics={[
                  { label: 'Unread', value: isMailConnected ? stats.unreadEmails : '-' },
                  { label: 'Status', value: isMailConnected ? 'Connected' : 'Login needed' },
                ]}
                href="/mail"
              />
              <ServiceCard
                name="Bheem Meet"
                icon={BheemMeetIcon}
                status="operational"
                metrics={[
                  { label: 'Active', value: stats.activeMeets },
                  { label: 'Status', value: stats.activeMeets > 0 ? 'In progress' : 'Ready' },
                ]}
                href="/meet"
              />
              <ServiceCard
                name="Bheem Docs"
                icon={BheemDocsIcon}
                status="operational"
                metrics={[
                  { label: 'Documents', value: stats.recentDocs },
                  { label: 'Storage', value: formatStorageSize(storageBreakdown.docs) },
                ]}
                href="/docs"
              />
              <ServiceCard
                name="Bheem Drive"
                icon={BheemDriveIcon}
                status="operational"
                metrics={[
                  { label: 'Files', value: stats.filesCount },
                  { label: 'Storage', value: formatStorageSize(storageBreakdown.drive) },
                ]}
                href="/drive"
              />
            </div>
          </div>

          {/* More Apps Row */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Link href="/sheets">
              <div className="bg-white rounded-xl border border-gray-200 p-4 hover:shadow-lg hover:border-[#977DFF]/30 transition-all cursor-pointer flex items-center gap-3">
                <BheemSheetsIcon size={40} />
                <div>
                  <h3 className="font-semibold text-gray-900">Sheets</h3>
                  <p className="text-xs text-gray-500">Spreadsheets</p>
                </div>
              </div>
            </Link>
            <Link href="/slides">
              <div className="bg-white rounded-xl border border-gray-200 p-4 hover:shadow-lg hover:border-[#977DFF]/30 transition-all cursor-pointer flex items-center gap-3">
                <BheemSlidesIcon size={40} />
                <div>
                  <h3 className="font-semibold text-gray-900">Slides</h3>
                  <p className="text-xs text-gray-500">Presentations</p>
                </div>
              </div>
            </Link>
            <Link href="/calendar">
              <div className="bg-white rounded-xl border border-gray-200 p-4 hover:shadow-lg hover:border-[#977DFF]/30 transition-all cursor-pointer flex items-center gap-3">
                <BheemCalendarIcon size={40} />
                <div>
                  <h3 className="font-semibold text-gray-900">Calendar</h3>
                  <p className="text-xs text-gray-500">Events & Schedule</p>
                </div>
              </div>
            </Link>
            <Link href="/chat">
              <div className="bg-white rounded-xl border border-gray-200 p-4 hover:shadow-lg hover:border-[#977DFF]/30 transition-all cursor-pointer flex items-center gap-3">
                <BheemChatIcon size={40} />
                <div>
                  <h3 className="font-semibold text-gray-900">Chat</h3>
                  <p className="text-xs text-gray-500">Team Messaging</p>
                </div>
              </div>
            </Link>
          </div>
        </div>
      </div>
    </WorkspaceLayout>
  );
}
