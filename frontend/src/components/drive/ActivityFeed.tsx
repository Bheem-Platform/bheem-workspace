/**
 * Bheem Drive - Activity Feed Component
 * Shows file activity like uploads, edits, shares, and deletions
 */
import { useState, useEffect } from 'react';
import {
  Upload,
  Edit,
  Share2,
  Trash2,
  FolderPlus,
  Download,
  Star,
  Eye,
  File,
  Folder,
  User,
  Clock,
  RefreshCw,
} from 'lucide-react';
import * as driveApi from '@/lib/driveApi';
import type { DriveActivity } from '@/lib/driveApi';

interface ActivityFeedProps {
  onFileClick?: (fileId: string) => void;
}

export default function ActivityFeed({ onFileClick }: ActivityFeedProps) {
  const [activities, setActivities] = useState<DriveActivity[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchActivity();
  }, []);

  const fetchActivity = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await driveApi.getActivity(50);
      setActivities(data);
    } catch (err: any) {
      setError(err.message || 'Failed to load activity');
    }
    setLoading(false);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-12">
        <p className="text-red-500 mb-4">{error}</p>
        <button
          onClick={fetchActivity}
          className="flex items-center gap-2 mx-auto px-4 py-2 text-blue-600 hover:bg-blue-50 rounded-lg"
        >
          <RefreshCw size={16} />
          Try again
        </button>
      </div>
    );
  }

  if (activities.length === 0) {
    return (
      <div className="text-center py-12">
        <Clock size={48} className="mx-auto text-gray-300 mb-4" />
        <p className="text-gray-500">No recent activity</p>
        <p className="text-sm text-gray-400 mt-1">
          Your file activity will appear here
        </p>
      </div>
    );
  }

  // Group activities by date
  const groupedActivities = activities.reduce((groups, activity) => {
    const date = new Date(activity.created_at).toLocaleDateString('en-US', {
      month: 'long',
      day: 'numeric',
      year: 'numeric',
    });
    if (!groups[date]) {
      groups[date] = [];
    }
    groups[date].push(activity);
    return groups;
  }, {} as Record<string, DriveActivity[]>);

  return (
    <div className="space-y-6">
      {/* Refresh button */}
      <div className="flex justify-end">
        <button
          onClick={fetchActivity}
          className="flex items-center gap-2 px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-100 rounded-lg"
        >
          <RefreshCw size={14} />
          Refresh
        </button>
      </div>

      {/* Activity timeline */}
      {Object.entries(groupedActivities).map(([date, dayActivities]) => (
        <div key={date} className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="px-4 py-3 bg-gray-50 border-b border-gray-200">
            <h3 className="text-sm font-medium text-gray-700">{date}</h3>
          </div>
          <div className="divide-y divide-gray-100">
            {dayActivities.map((activity) => (
              <ActivityItem
                key={activity.id}
                activity={activity}
                onClick={() => onFileClick?.(activity.file_id)}
              />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function ActivityItem({ activity, onClick }: { activity: DriveActivity; onClick?: () => void }) {
  const ActionIcon = getActionIcon(activity.action);
  const actionColor = getActionColor(activity.action);
  const actionText = getActionText(activity.action);

  const time = new Date(activity.created_at).toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
  });

  return (
    <div
      className="flex items-start gap-4 px-4 py-3 hover:bg-gray-50 transition-colors cursor-pointer"
      onClick={onClick}
    >
      {/* Action icon */}
      <div className={`p-2 rounded-lg ${actionColor}`}>
        <ActionIcon size={18} />
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-2">
          <div>
            <p className="text-sm text-gray-900">
              <span className="font-medium">{activity.actor_name || 'You'}</span>{' '}
              {actionText}{' '}
              <span className="font-medium text-blue-600 hover:underline">
                {activity.file_name}
              </span>
            </p>
            {activity.details && Object.keys(activity.details).length > 0 && (
              <p className="text-xs text-gray-500 mt-0.5">
                {formatDetails(activity.details)}
              </p>
            )}
          </div>
          <span className="text-xs text-gray-400 whitespace-nowrap">{time}</span>
        </div>
      </div>
    </div>
  );
}

function getActionIcon(action: string) {
  switch (action.toLowerCase()) {
    case 'upload':
    case 'uploaded':
      return Upload;
    case 'edit':
    case 'edited':
    case 'modified':
      return Edit;
    case 'share':
    case 'shared':
      return Share2;
    case 'delete':
    case 'deleted':
    case 'trash':
    case 'trashed':
      return Trash2;
    case 'create':
    case 'created':
    case 'create_folder':
      return FolderPlus;
    case 'download':
    case 'downloaded':
      return Download;
    case 'star':
    case 'starred':
    case 'unstar':
    case 'unstarred':
      return Star;
    case 'view':
    case 'viewed':
    case 'preview':
      return Eye;
    default:
      return File;
  }
}

function getActionColor(action: string) {
  switch (action.toLowerCase()) {
    case 'upload':
    case 'uploaded':
      return 'bg-green-100 text-green-600';
    case 'edit':
    case 'edited':
    case 'modified':
      return 'bg-blue-100 text-blue-600';
    case 'share':
    case 'shared':
      return 'bg-purple-100 text-purple-600';
    case 'delete':
    case 'deleted':
    case 'trash':
    case 'trashed':
      return 'bg-red-100 text-red-600';
    case 'create':
    case 'created':
    case 'create_folder':
      return 'bg-amber-100 text-amber-600';
    case 'download':
    case 'downloaded':
      return 'bg-cyan-100 text-cyan-600';
    case 'star':
    case 'starred':
      return 'bg-yellow-100 text-yellow-600';
    case 'view':
    case 'viewed':
    case 'preview':
      return 'bg-gray-100 text-gray-600';
    default:
      return 'bg-gray-100 text-gray-600';
  }
}

function getActionText(action: string) {
  switch (action.toLowerCase()) {
    case 'upload':
    case 'uploaded':
      return 'uploaded';
    case 'edit':
    case 'edited':
    case 'modified':
      return 'edited';
    case 'share':
    case 'shared':
      return 'shared';
    case 'delete':
    case 'deleted':
      return 'deleted';
    case 'trash':
    case 'trashed':
      return 'moved to trash';
    case 'create':
    case 'created':
      return 'created';
    case 'create_folder':
      return 'created folder';
    case 'download':
    case 'downloaded':
      return 'downloaded';
    case 'star':
    case 'starred':
      return 'starred';
    case 'unstar':
    case 'unstarred':
      return 'removed star from';
    case 'view':
    case 'viewed':
    case 'preview':
      return 'viewed';
    case 'rename':
    case 'renamed':
      return 'renamed';
    case 'move':
    case 'moved':
      return 'moved';
    case 'copy':
    case 'copied':
      return 'copied';
    case 'restore':
    case 'restored':
      return 'restored';
    default:
      return action;
  }
}

function formatDetails(details: Record<string, any>): string {
  const parts: string[] = [];

  if (details.old_name && details.new_name) {
    parts.push(`Renamed from "${details.old_name}" to "${details.new_name}"`);
  }
  if (details.destination) {
    parts.push(`Moved to ${details.destination}`);
  }
  if (details.shared_with) {
    parts.push(`Shared with ${details.shared_with}`);
  }

  return parts.join(' • ');
}
