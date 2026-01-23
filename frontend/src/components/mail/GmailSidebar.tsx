/**
 * Gmail-like Mail Sidebar
 * Features: Tabs (Primary, Social, Updates), Labels, Bheem Apps section
 * Updated with brand colors and responsive design
 */
import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
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
  X,
} from 'lucide-react';
import { useMailStore } from '@/stores/mailStore';
import { useCredentialsStore } from '@/stores/credentialsStore';
import { api } from '@/lib/api';

// Brand Colors
const BRAND = {
  pink: '#FFCCF2',
  purple: '#977DFF',
  blue: '#0033FF',
  gradient: 'from-[#FFCCF2] via-[#977DFF] to-[#0033FF]',
};

// Category tabs configuration
const CATEGORY_TABS = [
  { id: 'all', name: 'All Inboxes', icon: Inbox, color: 'text-[#977DFF]' },
  { id: 'primary', name: 'Primary', icon: Inbox, color: 'text-gray-600' },
  { id: 'social', name: 'Social', icon: Users, color: 'text-pink-500' },
  { id: 'updates', name: 'Updates', icon: Bell, color: 'text-[#977DFF]' },
  { id: 'promotions', name: 'Promotions', icon: Tag, color: 'text-emerald-500' },
  { id: 'forums', name: 'Forums', icon: MessageCircle, color: 'text-cyan-500' },
];

// Labels configuration
const SYSTEM_LABELS = [
  { id: 'starred', name: 'Starred', icon: Star, color: 'text-amber-500' },
  { id: 'snoozed', name: 'Snoozed', icon: Clock, color: 'text-[#977DFF]' },
  { id: 'important', name: 'Important', icon: AlertCircle, color: 'text-yellow-500' },
  { id: 'purchase', name: 'Purchase', icon: ShoppingCart, color: 'text-emerald-500' },
  { id: 'sent', name: 'Sent', icon: Send, color: 'text-[#0033FF]' },
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
  isOpen?: boolean;
  onClose?: () => void;
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
  isOpen = true,
  onClose,
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

  // Get mail session status and auto-create function
  const { isMailAuthenticated, isSessionValid, autoCreateMailSession } = useCredentialsStore();
  const hasValidSession = isMailAuthenticated && isSessionValid();
  const [sessionChecked, setSessionChecked] = useState(false);

  // Try to auto-create mail session if not authenticated
  useEffect(() => {
    const tryAutoCreate = async () => {
      if (!hasValidSession && !sessionChecked) {
        setSessionChecked(true);
        await autoCreateMailSession();
      }
    };
    tryAutoCreate();
  }, [hasValidSession, sessionChecked, autoCreateMailSession]);

  // Fetch counts on mount and poll every 30 seconds for real-time updates
  useEffect(() => {
    const fetchCounts = async () => {
      // Only fetch if mail session is active
      if (!hasValidSession) {
        return;
      }
      try {
        const response = await api.get('/mail/counts');
        setCounts(response.data);
      } catch (error) {
        console.error('Failed to fetch mail counts:', error);
      }
    };

    // Initial fetch
    fetchCounts();

    // Poll every 30 seconds for real-time updates
    const interval = setInterval(fetchCounts, 30000);

    return () => clearInterval(interval);
  }, [hasValidSession]);

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
    'purchase': 'INBOX',
  };

  const handleLabelClick = (labelId: string) => {
    console.log('[GmailSidebar] Label clicked:', labelId);

    if (['starred', 'snoozed', 'important'].includes(labelId)) {
      onLabelChange(labelId);
    } else if (labelToFolder[labelId]) {
      const folder = labelToFolder[labelId];
      console.log('[GmailSidebar] Switching to folder:', folder);
      setCurrentFolder(folder);
      onLabelChange(labelId);
    } else if (labelId === 'subscriptions') {
      onLabelChange(labelId);
    }

    // Close sidebar on mobile after selection
    onClose?.();
  };

  const handleCategoryClick = (categoryId: string) => {
    onCategoryChange(categoryId);
    onLabelChange(null);
    onClose?.();
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
      case 'scheduled': return 0;
      default: return 0;
    }
  };

  const sidebarContent = (
    <div className="h-full flex flex-col bg-white">
      {/* Mobile Header */}
      <div className="lg:hidden flex items-center justify-between px-4 py-3 border-b border-gray-200">
        <div className="flex items-center gap-2">
          <div className={`w-8 h-8 bg-gradient-to-br ${BRAND.gradient} rounded-lg flex items-center justify-center`}>
            <Mail size={16} className="text-white" />
          </div>
          <span className="font-semibold text-gray-900">Mail</span>
        </div>
        <button
          onClick={onClose}
          className="p-2 rounded-lg hover:bg-gray-100 transition-colors"
        >
          <X size={20} className="text-gray-500" />
        </button>
      </div>

      {/* Compose Button */}
      <div className="p-3 sm:p-4">
        <motion.button
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          onClick={() => {
            onCompose();
            onClose?.();
          }}
          className={`w-full flex items-center justify-center gap-2 px-4 sm:px-6 py-3 bg-gradient-to-r ${BRAND.gradient} rounded-2xl hover:shadow-lg transition-all group text-white font-medium`}
          style={{ boxShadow: `0 4px 15px ${BRAND.purple}40` }}
        >
          <Plus size={20} />
          <span>Compose</span>
        </motion.button>
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
              <motion.button
                key={tab.id}
                whileHover={{ x: 2 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => handleCategoryClick(tab.id)}
                className={`
                  w-full flex items-center gap-3 px-3 py-2.5 rounded-r-full transition-all
                  ${isActive
                    ? 'bg-gradient-to-r from-[#FFCCF2]/30 via-[#977DFF]/20 to-transparent text-gray-900 font-medium'
                    : 'text-gray-700 hover:bg-gray-100'
                  }
                `}
              >
                <div className="w-6 h-6 flex items-center justify-center">
                  <Icon size={18} className={isActive ? 'text-[#977DFF]' : tab.color} />
                </div>
                <span className="flex-1 text-left text-sm">{tab.name}</span>
                {count > 0 && (
                  <span className={`text-xs font-medium ${isActive ? 'text-[#977DFF]' : 'text-gray-500'}`}>
                    {count}
                  </span>
                )}
              </motion.button>
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
          className="w-full flex items-center gap-2 px-3 py-2 text-xs font-semibold text-gray-500 uppercase tracking-wider hover:bg-gray-50 rounded-lg transition-colors"
        >
          <motion.div animate={{ rotate: labelsExpanded ? 0 : -90 }} transition={{ duration: 0.2 }}>
            <ChevronDown size={14} />
          </motion.div>
          Labels
        </button>

        <AnimatePresence>
          {labelsExpanded && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="space-y-0.5 mt-1 overflow-hidden"
            >
              {SYSTEM_LABELS.map((label) => {
                const Icon = label.icon;
                const isActive = activeLabel === label.id;
                const count = getLabelCount(label.id);

                return (
                  <motion.button
                    key={label.id}
                    whileHover={{ x: 2 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => handleLabelClick(label.id)}
                    className={`
                      w-full flex items-center gap-3 px-3 py-2 rounded-r-full transition-all
                      ${isActive
                        ? 'bg-gradient-to-r from-[#FFCCF2]/30 via-[#977DFF]/20 to-transparent text-gray-900 font-medium'
                        : 'text-gray-600 hover:bg-gray-100'
                      }
                    `}
                  >
                    <Icon size={16} className={isActive ? 'text-[#977DFF]' : label.color} />
                    <span className="flex-1 text-left text-sm">{label.name}</span>
                    {count > 0 && (
                      <span className={`text-xs ${isActive ? 'text-[#977DFF]' : 'text-gray-400'}`}>
                        {count}
                      </span>
                    )}
                  </motion.button>
                );
              })}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Divider */}
        <div className="my-3 mx-2 border-t border-gray-200" />

        {/* Bheem Apps Section */}
        <button
          onClick={() => setAppsExpanded(!appsExpanded)}
          className="w-full flex items-center gap-2 px-3 py-2 text-xs font-semibold text-gray-500 uppercase tracking-wider hover:bg-gray-50 rounded-lg transition-colors"
        >
          <motion.div animate={{ rotate: appsExpanded ? 0 : -90 }} transition={{ duration: 0.2 }}>
            <ChevronDown size={14} />
          </motion.div>
          Bheem Apps
        </button>

        <AnimatePresence>
          {appsExpanded && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="space-y-0.5 mt-1 overflow-hidden"
            >
              {BHEEM_APPS.map((app) => (
                <motion.a
                  key={app.id}
                  href={app.href}
                  whileHover={{ x: 2 }}
                  className="w-full flex items-center gap-3 px-3 py-2 rounded-r-full text-gray-600 hover:bg-gray-100 transition-all"
                >
                  <span className="text-base w-6 text-center">{app.icon}</span>
                  <span className="flex-1 text-left text-sm">{app.name}</span>
                </motion.a>
              ))}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Refresh Button */}
      <div className="p-3 border-t border-gray-200">
        <button
          onClick={() => fetchFolders()}
          disabled={loading.folders}
          className="w-full flex items-center justify-center gap-2 px-3 py-2 text-gray-500 hover:bg-gray-100 rounded-xl transition-colors text-sm"
        >
          <RefreshCw size={14} className={loading.folders ? 'animate-spin' : ''} />
          Refresh
        </button>
      </div>
    </div>
  );

  return (
    <>
      {/* Desktop Sidebar */}
      <div className="hidden lg:block h-full">
        {sidebarContent}
      </div>

      {/* Mobile Sidebar Overlay */}
      <AnimatePresence>
        {isOpen && (
          <>
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={onClose}
              className="lg:hidden fixed inset-0 bg-black/50 z-40"
            />
            {/* Sidebar */}
            <motion.div
              initial={{ x: '-100%' }}
              animate={{ x: 0 }}
              exit={{ x: '-100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 300 }}
              className="lg:hidden fixed inset-y-0 left-0 w-72 z-50 shadow-2xl"
            >
              {sidebarContent}
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
}
