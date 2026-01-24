/**
 * User Dashboard - Bheem Workspace
 * Design inspired by Admin Dashboard with brand colors: #FFCCF2, #977DFF, #0033FF
 */
import { useEffect, useState } from 'react';
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

interface DashboardStats {
  unreadEmails: number;
  todayEvents: number;
  recentDocs: number;
  activeMeets: number;
  totalStorage: number;
  filesCount: number;
}

interface Activity {
  id: string;
  type: 'email' | 'document' | 'meeting' | 'calendar' | 'share' | 'file';
  title: string;
  description?: string;
  time: string;
  isNew?: boolean;
}

// Mock activity data
const generateMockActivities = (): Activity[] => [
  { id: '1', type: 'email', title: 'New email from team', description: 'Project update discussion', time: '5m ago', isNew: true },
  { id: '2', type: 'calendar', title: 'Meeting in 30 minutes', description: 'Team standup call', time: '30m', isNew: true },
  { id: '3', type: 'document', title: 'Document shared with you', description: 'Q4 Report.docx', time: '1h ago' },
  { id: '4', type: 'meeting', title: 'Call recording available', description: 'Client meeting (45 min)', time: '2h ago' },
  { id: '5', type: 'share', title: 'Folder shared with you', description: 'Marketing Assets', time: '3h ago' },
];

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
    return `${(mb / 1024).toFixed(1)} GB`;
  }
  return `${mb} MB`;
}

export default function UserDashboard() {
  const router = useRouter();
  const { user } = useAuthStore();
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<DashboardStats>({
    unreadEmails: 12,
    todayEvents: 3,
    recentDocs: 8,
    activeMeets: 1,
    totalStorage: 2456,
    filesCount: 156,
  });
  const [activities] = useState<Activity[]>(generateMockActivities());

  const { isAuthenticated, isLoading: authLoading } = useRequireAuth();

  useEffect(() => {
    if (!isAuthenticated || authLoading) return;

    const fetchData = async () => {
      try {
        const statsRes = await api.get('/user-workspace/dashboard-stats');
        setStats(statsRes.data);
      } catch {
        // Use mock stats
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [isAuthenticated, authLoading]);

  if (authLoading || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-[#FFCCF2] via-[#977DFF] to-[#0033FF]">
        <div className="text-center">
          <div className="w-16 h-16 rounded-full border-4 border-white/30 border-t-white animate-spin mx-auto" />
          <p className="mt-4 text-white font-medium">Loading your workspace...</p>
        </div>
      </div>
    );
  }

  const displayName = user?.username || user?.email?.split('@')[0] || 'User';
  const firstName = displayName.split(' ')[0];
  const currentHour = new Date().getHours();
  const greeting = currentHour < 12 ? 'Good morning' : currentHour < 17 ? 'Good afternoon' : 'Good evening';

  // Storage breakdown for donut chart
  const storageData = [
    { label: 'Mail', value: 1024, color: '#FFCCF2' },
    { label: 'Docs', value: 856, color: '#977DFF' },
    { label: 'Drive', value: 576, color: '#0033FF' },
  ];
  const totalStorage = storageData.reduce((acc, item) => acc + item.value, 0);

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
              value={stats.unreadEmails}
              icon={Inbox}
              color="pink"
              href="/mail"
              subtitle={`${Math.min(stats.unreadEmails, 3)} urgent`}
            />
            <StatsCard
              title="Today's Events"
              value={stats.todayEvents}
              icon={Calendar}
              color="purple"
              href="/calendar"
              subtitle="Next in 30m"
            />
            <StatsCard
              title="Recent Documents"
              value={stats.recentDocs}
              icon={FileText}
              color="blue"
              href="/docs"
              subtitle="Last 7 days"
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
                  <p className="text-2xl font-bold text-gray-900">{formatStorageSize(totalStorage)}</p>
                  <p className="text-sm text-gray-500">Total used</p>
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
                status="operational"
                metrics={[
                  { label: 'Unread', value: stats.unreadEmails },
                  { label: 'Storage', value: '1.0 GB' },
                ]}
                href="/mail"
              />
              <ServiceCard
                name="Bheem Meet"
                icon={BheemMeetIcon}
                status="operational"
                metrics={[
                  { label: 'Meetings', value: stats.activeMeets },
                  { label: 'This Week', value: '5 calls' },
                ]}
                href="/meet"
              />
              <ServiceCard
                name="Bheem Docs"
                icon={BheemDocsIcon}
                status="operational"
                metrics={[
                  { label: 'Documents', value: stats.recentDocs },
                  { label: 'Storage', value: '856 MB' },
                ]}
                href="/docs"
              />
              <ServiceCard
                name="Bheem Drive"
                icon={BheemDriveIcon}
                status="operational"
                metrics={[
                  { label: 'Files', value: stats.filesCount },
                  { label: 'Storage', value: '576 MB' },
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
