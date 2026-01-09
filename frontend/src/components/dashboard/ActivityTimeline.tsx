/**
 * ActivityTimeline - Personal activity timeline for user dashboard
 */
import {
  Mail,
  FileText,
  Calendar,
  Video,
  UserPlus,
  Share2,
  Edit3,
  Trash2,
  Check,
  Clock
} from 'lucide-react';

interface Activity {
  id: string;
  type: 'email' | 'document' | 'meeting' | 'calendar' | 'share' | 'edit' | 'delete' | 'user' | 'task';
  title: string;
  description?: string;
  time: string;
  isNew?: boolean;
}

interface ActivityTimelineProps {
  activities: Activity[];
  maxItems?: number;
  showViewAll?: boolean;
  onViewAll?: () => void;
}

const activityConfig = {
  email: { icon: Mail, color: 'bg-blue-100 text-blue-600' },
  document: { icon: FileText, color: 'bg-purple-100 text-purple-600' },
  meeting: { icon: Video, color: 'bg-green-100 text-green-600' },
  calendar: { icon: Calendar, color: 'bg-orange-100 text-orange-600' },
  share: { icon: Share2, color: 'bg-cyan-100 text-cyan-600' },
  edit: { icon: Edit3, color: 'bg-amber-100 text-amber-600' },
  delete: { icon: Trash2, color: 'bg-red-100 text-red-600' },
  user: { icon: UserPlus, color: 'bg-emerald-100 text-emerald-600' },
  task: { icon: Check, color: 'bg-indigo-100 text-indigo-600' },
};

export default function ActivityTimeline({
  activities,
  maxItems = 10,
  showViewAll = true,
  onViewAll,
}: ActivityTimelineProps) {
  const displayActivities = activities.slice(0, maxItems);

  if (activities.length === 0) {
    return (
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Recent Activity</h3>
        <div className="flex flex-col items-center justify-center py-8 text-center">
          <Clock size={40} className="text-gray-300 mb-3" />
          <p className="text-gray-500">No recent activity</p>
          <p className="text-sm text-gray-400 mt-1">Your activity will appear here</p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-gray-900">Recent Activity</h3>
        {showViewAll && activities.length > maxItems && (
          <button
            onClick={onViewAll}
            className="text-sm text-blue-600 hover:text-blue-700 font-medium"
          >
            View all
          </button>
        )}
      </div>

      <div className="space-y-1">
        {displayActivities.map((activity, index) => {
          const config = activityConfig[activity.type] || activityConfig.task;
          const Icon = config.icon;

          return (
            <div
              key={activity.id}
              className={`
                flex items-start gap-3 p-3 rounded-lg transition-colors
                ${activity.isNew ? 'bg-blue-50/50' : 'hover:bg-gray-50'}
              `}
            >
              {/* Icon */}
              <div className={`p-2 rounded-lg ${config.color} flex-shrink-0`}>
                <Icon size={16} />
              </div>

              {/* Content */}
              <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between gap-2">
                  <p className="text-sm font-medium text-gray-900 truncate">
                    {activity.title}
                    {activity.isNew && (
                      <span className="ml-2 inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-700">
                        New
                      </span>
                    )}
                  </p>
                  <span className="text-xs text-gray-400 whitespace-nowrap flex-shrink-0">
                    {activity.time}
                  </span>
                </div>
                {activity.description && (
                  <p className="text-xs text-gray-500 mt-0.5 truncate">
                    {activity.description}
                  </p>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
