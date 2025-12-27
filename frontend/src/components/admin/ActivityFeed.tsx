import { Activity, User, Globe, Mail, Video, FileText, Settings } from 'lucide-react';
import type { ActivityLog } from '@/types/admin';

interface ActivityFeedProps {
  activities: ActivityLog[];
  loading?: boolean;
  showTenant?: boolean;
}

const actionIcons: Record<string, any> = {
  tenant_created: Activity,
  tenant_updated: Settings,
  user_added: User,
  user_removed: User,
  domain_added: Globe,
  domain_verified: Globe,
  mailbox_created: Mail,
  meeting_started: Video,
  file_uploaded: FileText,
  default: Activity,
};

const actionColors: Record<string, string> = {
  tenant_created: 'bg-green-100 text-green-600',
  tenant_updated: 'bg-blue-100 text-blue-600',
  tenant_deactivated: 'bg-red-100 text-red-600',
  user_added: 'bg-purple-100 text-purple-600',
  user_removed: 'bg-orange-100 text-orange-600',
  domain_added: 'bg-blue-100 text-blue-600',
  domain_verified: 'bg-green-100 text-green-600',
  mailbox_created: 'bg-indigo-100 text-indigo-600',
  developer_created: 'bg-purple-100 text-purple-600',
  default: 'bg-gray-100 text-gray-600',
};

function formatTimeAgo(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const seconds = Math.floor((now.getTime() - date.getTime()) / 1000);

  if (seconds < 60) return 'just now';
  if (seconds < 3600) return `${Math.floor(seconds / 60)} min ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)} hrs ago`;
  if (seconds < 604800) return `${Math.floor(seconds / 86400)} days ago`;
  return date.toLocaleDateString();
}

export default function ActivityFeed({ activities, loading, showTenant }: ActivityFeedProps) {
  if (loading) {
    return (
      <div className="space-y-4">
        {[...Array(5)].map((_, i) => (
          <div key={i} className="flex items-start space-x-3 animate-pulse">
            <div className="w-10 h-10 bg-gray-200 rounded-full" />
            <div className="flex-1 space-y-2">
              <div className="h-4 bg-gray-200 rounded w-3/4" />
              <div className="h-3 bg-gray-200 rounded w-1/4" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (activities.length === 0) {
    return (
      <div className="text-center py-8">
        <Activity className="w-12 h-12 text-gray-300 mx-auto mb-3" />
        <p className="text-gray-500">No recent activity</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {activities.map((activity) => {
        const Icon = actionIcons[activity.action] || actionIcons.default;
        const colorClass = actionColors[activity.action] || actionColors.default;

        return (
          <div key={activity.id} className="flex items-start space-x-3">
            <div className={`p-2 rounded-full ${colorClass}`}>
              <Icon size={16} />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm text-gray-900">
                <span className="font-medium">
                  {activity.action.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())}
                </span>
              </p>
              {activity.description && (
                <p className="text-sm text-gray-500 truncate">{activity.description}</p>
              )}
              <p className="text-xs text-gray-400 mt-1">
                {formatTimeAgo(activity.created_at)}
              </p>
            </div>
          </div>
        );
      })}
    </div>
  );
}
