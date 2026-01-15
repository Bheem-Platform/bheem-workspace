/**
 * Gmail-like Mail Sidebar
 * Features: Tabs (Primary, Social, Updates), Labels, Bheem Apps section
 */
import { useState, useEffect } from 'react';
import {
  Inbox,
  Users,
  Bell,
  Tag,
  Star,
  Clock,
  AlertCircle,
  Send,
  CalendarClock,
  FileText,
  Mail,
  AlertTriangle,
  Trash2,
  Settings,
  Plus,
  ChevronDown,
  ChevronRight,
  RefreshCw,
  ShoppingCart,
  MessageCircle,
} from 'lucide-react';
import { useMailStore } from '@/stores/mailStore';
import { api } from '@/lib/api';

// Category tabs configuration
const CATEGORY_TABS = [
  { id: 'all', name: 'All Inboxes', icon: Inbox, color: 'text-blue-600 bg-blue-50' },
  { id: 'primary', name: 'Primary', icon: Inbox, color: 'text-gray-700 bg-gray-50' },
  { id: 'social', name: 'Social', icon: Users, color: 'text-pink-600 bg-pink-50' },
  { id: 'updates', name: 'Updates', icon: Bell, color: 'text-purple-600 bg-purple-50' },
  { id: 'promotions', name: 'Promotions', icon: Tag, color: 'text-green-600 bg-green-50' },
  { id: 'forums', name: 'Forums', icon: MessageCircle, color: 'text-cyan-600 bg-cyan-50' },
];

// Labels configuration
const SYSTEM_LABELS = [
  { id: 'starred', name: 'Starred', icon: Star, color: 'text-amber-500' },
  { id: 'snoozed', name: 'Snoozed', icon: Clock, color: 'text-orange-500' },
  { id: 'important', name: 'Important', icon: AlertCircle, color: 'text-yellow-600' },
  { id: 'purchase', name: 'Purchase', icon: ShoppingCart, color: 'text-emerald-600' },
  { id: 'sent', name: 'Sent', icon: Send, color: 'text-blue-500' },
  { id: 'scheduled', name: 'Scheduled', icon: CalendarClock, color: 'text-indigo-500' },
  { id: 'outbox', name: 'Outbox', icon: Send, color: 'text-cyan-500' },
  { id: 'drafts', name: 'Drafts', icon: FileText, color: 'text-gray-500' },
  { id: 'all-mail', name: 'All Mail', icon: Mail, color: 'text-gray-600' },
  { id: 'spam', name: 'Spam', icon: AlertTriangle, color: 'text-yellow-500' },
  { id: 'bin', name: 'Bin', icon: Trash2, color: 'text-red-500' },
  { id: 'subscriptions', name: 'Manage Subscriptions', icon: Settings, color: 'text-gray-500' },
];

// Bheem Apps configuration
const BHEEM_APPS = [
  { id: 'meet', name: 'Bheem Meet', icon: '🎥', href: '/meet' },
  { id: 'docs', name: 'Bheem Docs', icon: '📄', href: '/docs' },
  { id: 'chat', name: 'Bheem Chat', icon: '💬', href: '/chat' },
  { id: 'drive', name: 'Bheem Drive', icon: '☁️', href: '/drive' },
  { id: 'calendar', name: 'Calendar', icon: '📅', href: '/calendar' },
];

interface GmailSidebarProps {
  onCompose: () => void;
  activeCategory: string;
  onCategoryChange: (category: string) => void;
  activeLabel: string | null;
  onLabelChange: (label: string | null) => void;
}

interface Counts {
  starred: number;
  important: number;
  snoozed: number;
  categories: {
    primary: number;
    social: number;
    updates: number;
    promotions: number;
    forums: number;
  };
}

export default function GmailSidebar({
  onCompose,
  activeCategory,
  onCategoryChange,
  activeLabel,
  onLabelChange,
}: GmailSidebarProps) {
  const { folders, fetchFolders, loading, currentFolder, setCurrentFolder } = useMailStore();
  const [labelsExpanded, setLabelsExpanded] = useState(true);
  const [appsExpanded, setAppsExpanded] = useState(true);
  const [counts, setCounts] = useState<Counts>({
    starred: 0,
    important: 0,
    snoozed: 0,
    categories: { primary: 0, social: 0, updates: 0, promotions: 0, forums: 0 }
  });

  // Fetch counts on mount
  useEffect(() => {
    const fetchCounts = async () => {
      try {
        const response = await api.get('/mail/counts');
        setCounts(response.data);
      } catch (error) {
        console.error('Failed to fetch mail counts:', error);
      }
    };
    fetchCounts();
  }, []);

  // Get folder count by type
  const getFolderCount = (type: string): number => {
    const folder = folders.find(f =>
      f.type === type ||
      f.path?.toLowerCase() === type.toLowerCase() ||
      f.name.toLowerCase() === type.toLowerCase()
    );
    return folder?.unreadCount || 0;
  };

  // Map label ID to folder path
  const labelToFolder: Record<string, string> = {
    'sent': 'Sent',
    'drafts': 'Drafts',
    'spam': 'Spam',
    'bin': 'Trash',
    'all-mail': 'INBOX',
    'outbox': 'Outbox',
    'scheduled': 'Scheduled',
    'purchase': 'INBOX', // Show inbox but filter by purchase category
  };

  const handleLabelClick = (labelId: string) => {
    console.log('[GmailSidebar] Label clicked:', labelId);

    // Special labels handled via API (starred, snoozed, important)
    if (['starred', 'snoozed', 'important'].includes(labelId)) {
      onLabelChange(labelId);
      // Don't call onCategoryChange here - it will reset the label
    }
    // Folder-based labels (sent, drafts, spam, bin, etc.)
    else if (labelToFolder[labelId]) {
      const folder = labelToFolder[labelId];
      console.log('[GmailSidebar] Switching to folder:', folder);
      setCurrentFolder(folder);
      onLabelChange(labelId); // Set the label so header shows correct title
      // Don't call onCategoryChange - it clears the label we just set
    }
    // Subscriptions - special handling
    else if (labelId === 'subscriptions') {
      onLabelChange(labelId);
    }
  };

  // Get count for each label
  const getLabelCount = (labelId: string): number => {
    switch (labelId) {
      case 'starred': return counts.starred;
      case 'important': return counts.important;
      case 'snoozed': return counts.snoozed;
      case 'sent': return getFolderCount('sent');
      case 'drafts': return getFolderCount('drafts');
      case 'spam': return getFolderCount('spam');
      case 'bin': return getFolderCount('trash');
      case 'scheduled': return 0; // TODO: fetch from scheduled emails
      default: return 0;
    }
  };

  return (
    <div className="h-full flex flex-col bg-white">
      {/* Compose Button */}
      <div className="p-4">
        <button
          onClick={onCompose}
          className="w-full flex items-center justify-center gap-2 px-6 py-3 bg-white border-2 border-gray-200 rounded-2xl hover:bg-gray-50 hover:border-gray-300 hover:shadow-md transition-all group"
        >
          <Plus size={20} className="text-gray-600 group-hover:text-orange-500" />
          <span className="font-medium text-gray-700 group-hover:text-gray-900">Compose</span>
        </button>
      </div>

      {/* Category Tabs */}
      <div className="px-2">
        <div className="space-y-0.5">
          {CATEGORY_TABS.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeCategory === tab.id && !activeLabel;
            const count = tab.id === 'all'
              ? Object.values(counts.categories).reduce((a, b) => a + b, 0)
              : counts.categories[tab.id as keyof typeof counts.categories] || 0;

            return (
              <button
                key={tab.id}
                onClick={() => {
                  onCategoryChange(tab.id);
                  onLabelChange(null);
                }}
                className={`
                  w-full flex items-center gap-3 px-3 py-2 rounded-r-full transition-all
                  ${isActive
                    ? 'bg-orange-100 text-orange-800 font-medium'
                    : 'text-gray-700 hover:bg-gray-100'
                  }
                `}
              >
                <div className={`w-6 h-6 flex items-center justify-center`}>
                  <Icon size={18} className={isActive ? 'text-orange-600' : tab.color.split(' ')[0]} />
                </div>
                <span className="flex-1 text-left text-sm">{tab.name}</span>
                {count > 0 && (
                  <span className={`text-xs font-medium ${isActive ? 'text-orange-700' : 'text-gray-500'}`}>
                    {count}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Divider */}
      <div className="my-3 mx-4 border-t border-gray-200" />

      {/* Labels Section */}
      <div className="flex-1 overflow-y-auto px-2 mail-scrollbar">
        <button
          onClick={() => setLabelsExpanded(!labelsExpanded)}
          className="w-full flex items-center gap-2 px-3 py-2 text-xs font-semibold text-gray-500 uppercase tracking-wider hover:bg-gray-50 rounded-lg"
        >
          {labelsExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
          Labels
        </button>

        {labelsExpanded && (
          <div className="space-y-0.5 mt-1">
            {SYSTEM_LABELS.map((label) => {
              const Icon = label.icon;
              const isActive = activeLabel === label.id;
              const count = getLabelCount(label.id);

              return (
                <button
                  key={label.id}
                  onClick={() => handleLabelClick(label.id)}
                  className={`
                    w-full flex items-center gap-3 px-3 py-2 rounded-r-full transition-all
                    ${isActive
                      ? 'bg-orange-100 text-orange-800 font-medium'
                      : 'text-gray-600 hover:bg-gray-100'
                    }
                  `}
                >
                  <Icon size={16} className={isActive ? 'text-orange-600' : label.color} />
                  <span className="flex-1 text-left text-sm">{label.name}</span>
                  {count > 0 && (
                    <span className={`text-xs ${isActive ? 'text-orange-700' : 'text-gray-400'}`}>
                      {count}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        )}

        {/* Divider */}
        <div className="my-3 mx-2 border-t border-gray-200" />

        {/* Bheem Apps Section */}
        <button
          onClick={() => setAppsExpanded(!appsExpanded)}
          className="w-full flex items-center gap-2 px-3 py-2 text-xs font-semibold text-gray-500 uppercase tracking-wider hover:bg-gray-50 rounded-lg"
        >
          {appsExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
          Bheem Apps
        </button>

        {appsExpanded && (
          <div className="space-y-0.5 mt-1">
            {BHEEM_APPS.map((app) => (
              <a
                key={app.id}
                href={app.href}
                className="w-full flex items-center gap-3 px-3 py-2 rounded-r-full text-gray-600 hover:bg-gray-100 transition-all"
              >
                <span className="text-base w-6 text-center">{app.icon}</span>
                <span className="flex-1 text-left text-sm">{app.name}</span>
              </a>
            ))}
          </div>
        )}
      </div>

      {/* Refresh Button */}
      <div className="p-3 border-t border-gray-200">
        <button
          onClick={() => fetchFolders()}
          disabled={loading.folders}
          className="w-full flex items-center justify-center gap-2 px-3 py-2 text-gray-500 hover:bg-gray-100 rounded-lg transition-colors text-sm"
        >
          <RefreshCw size={14} className={loading.folders ? 'animate-spin' : ''} />
          Refresh
        </button>
      </div>
    </div>
  );
}
