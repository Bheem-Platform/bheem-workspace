import { useState, useEffect, useMemo } from 'react';
import {
  Search,
  ChevronDown,
  RefreshCw,
  Archive,
  Trash2,
  Mail,
  MailOpen,
  MoreHorizontal,
  CheckSquare,
  Square,
  Inbox,
  Users,
  Bell,
  Tag,
  Star,
  Clock,
  AlertCircle,
} from 'lucide-react';
import { useMailStore } from '@/stores/mailStore';
import MailListItem from './MailListItem';
import { SkeletonList } from '@/components/shared/LoadingOverlay';
import EmptyState from '@/components/shared/EmptyState';
import type { Email } from '@/types/mail';
import { api } from '@/lib/api';

interface MailListProps {
  onSelectEmail: (email: Email) => void;
  selectedEmailId?: string;
  activeCategory?: string;
  activeLabel?: string | null;
}

// Category display config
const CATEGORY_CONFIG: Record<string, { title: string; icon: any; color: string }> = {
  all: { title: 'All Inboxes', icon: Inbox, color: 'text-blue-600' },
  primary: { title: 'Primary', icon: Inbox, color: 'text-gray-700' },
  social: { title: 'Social', icon: Users, color: 'text-pink-600' },
  updates: { title: 'Updates', icon: Bell, color: 'text-purple-600' },
  promotions: { title: 'Promotions', icon: Tag, color: 'text-green-600' },
  forums: { title: 'Forums', icon: Mail, color: 'text-cyan-600' },
};

// Label display config
const LABEL_CONFIG: Record<string, { title: string; icon: any; color: string; isFolder?: boolean }> = {
  starred: { title: 'Starred', icon: Star, color: 'text-amber-500' },
  snoozed: { title: 'Snoozed', icon: Clock, color: 'text-orange-500' },
  important: { title: 'Important', icon: AlertCircle, color: 'text-yellow-600' },
  purchase: { title: 'Purchase', icon: Tag, color: 'text-emerald-600', isFolder: true },
  sent: { title: 'Sent', icon: Mail, color: 'text-blue-500', isFolder: true },
  scheduled: { title: 'Scheduled', icon: Clock, color: 'text-indigo-500', isFolder: true },
  outbox: { title: 'Outbox', icon: Mail, color: 'text-cyan-500', isFolder: true },
  drafts: { title: 'Drafts', icon: Mail, color: 'text-gray-500', isFolder: true },
  'all-mail': { title: 'All Mail', icon: Inbox, color: 'text-gray-600', isFolder: true },
  spam: { title: 'Spam', icon: AlertCircle, color: 'text-yellow-500', isFolder: true },
  bin: { title: 'Bin', icon: Trash2, color: 'text-red-500', isFolder: true },
  subscriptions: { title: 'Manage Subscriptions', icon: Bell, color: 'text-gray-500' },
};

export default function MailList({
  onSelectEmail,
  selectedEmailId,
  activeCategory = 'all',
  activeLabel = null
}: MailListProps) {
  const {
    emails,
    currentFolder,
    loading,
    searchQuery,
    setSearchQuery,
    selectedEmails,
    toggleEmailSelection,
    selectMultipleEmails,
    clearSelection,
    fetchEmails,
    deleteEmail,
    moveEmail,
    markAsRead,
    toggleStar,
    pagination,
  } = useMailStore();

  const [showBulkActions, setShowBulkActions] = useState(false);
  const [categoryMessageIds, setCategoryMessageIds] = useState<string[]>([]);
  const [labelMessageIds, setLabelMessageIds] = useState<string[]>([]);
  const [loadingCategory, setLoadingCategory] = useState(false);

  // Fetch category/label message IDs when they change
  useEffect(() => {
    const fetchCategoryEmails = async () => {
      if (activeCategory && activeCategory !== 'all') {
        setLoadingCategory(true);
        try {
          const response = await api.get(`/mail/categories/${activeCategory}`);
          setCategoryMessageIds(response.data.message_ids || []);
        } catch (error) {
          console.error('Failed to fetch category emails:', error);
          setCategoryMessageIds([]);
        } finally {
          setLoadingCategory(false);
        }
      } else {
        setCategoryMessageIds([]);
      }
    };

    const fetchLabelEmails = async () => {
      if (activeLabel) {
        // Check if this is a folder-based label (don't fetch from API)
        const labelConfig = LABEL_CONFIG[activeLabel];
        if (labelConfig?.isFolder) {
          // Folder-based labels - emails come from the folder, no API filtering needed
          setLabelMessageIds([]);
          setLoadingCategory(false);
          return;
        }

        setLoadingCategory(true);
        try {
          let response;
          if (activeLabel === 'starred') {
            response = await api.get('/mail/starred');
            setLabelMessageIds(response.data.message_ids || []);
          } else if (activeLabel === 'important') {
            response = await api.get('/mail/important');
            setLabelMessageIds(response.data.message_ids || []);
          } else if (activeLabel === 'snoozed') {
            response = await api.get('/mail/snoozed');
            setLabelMessageIds((response.data.snoozed || []).map((s: any) => s.message_id));
          } else {
            setLabelMessageIds([]);
          }
        } catch (error) {
          console.error('Failed to fetch label emails:', error);
          setLabelMessageIds([]);
        } finally {
          setLoadingCategory(false);
        }
      } else {
        setLabelMessageIds([]);
      }
    };

    if (activeLabel) {
      // When label is active, clear category IDs and fetch label emails
      setCategoryMessageIds([]);
      fetchLabelEmails();
    } else {
      // When no label, clear label IDs and fetch category emails
      setLabelMessageIds([]);
      fetchCategoryEmails();
    }
  }, [activeCategory, activeLabel]);

  // Filter emails by category/label and search query
  // Priority: Label (API-based only) > Category > All
  const filteredEmails = useMemo(() => {
    let result = emails;

    // Check if active label is folder-based (no filtering needed - emails come from folder)
    const isLabelFolderBased = activeLabel && LABEL_CONFIG[activeLabel]?.isFolder;

    // If label is active and NOT folder-based, filter by label message IDs
    if (activeLabel && !isLabelFolderBased && labelMessageIds.length > 0) {
      result = result.filter(e => labelMessageIds.includes(e.id));
    }
    // If no active label (or folder-based label), filter by category (if not 'all')
    else if (!activeLabel && activeCategory && activeCategory !== 'all' && categoryMessageIds.length > 0) {
      result = result.filter(e => categoryMessageIds.includes(e.id));
    }
    // For folder-based labels, show all emails from the current folder (no filtering)

    // Filter by search query
    if (searchQuery) {
      result = result.filter(
        (e) =>
          e.subject.toLowerCase().includes(searchQuery.toLowerCase()) ||
          e.from.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
          e.from.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
          e.body?.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }

    return result;
  }, [emails, activeCategory, activeLabel, categoryMessageIds, labelMessageIds, searchQuery]);


  const handleSelectAll = () => {
    if (selectedEmails.length === filteredEmails.length) {
      clearSelection();
    } else {
      selectMultipleEmails(filteredEmails.map((e) => e.id));
    }
  };

  const handleBulkDelete = async () => {
    for (const id of selectedEmails) {
      await deleteEmail(id);
    }
    clearSelection();
  };

  const handleBulkArchive = async () => {
    for (const id of selectedEmails) {
      await moveEmail(id, 'Archive');
    }
    clearSelection();
  };

  const handleBulkMarkRead = async (read: boolean) => {
    for (const id of selectedEmails) {
      await markAsRead(id, read);
    }
    clearSelection();
  };

  // Get title and icon based on active category or label
  const getViewConfig = () => {
    if (activeLabel && LABEL_CONFIG[activeLabel]) {
      return LABEL_CONFIG[activeLabel];
    }
    if (activeCategory && CATEGORY_CONFIG[activeCategory]) {
      return CATEGORY_CONFIG[activeCategory];
    }
    // Fallback to folder titles
    const titles: Record<string, string> = {
      INBOX: 'Inbox',
      Sent: 'Sent',
      Drafts: 'Drafts',
      Spam: 'Spam',
      Trash: 'Trash',
      Archive: 'Archive',
    };
    return {
      title: titles[currentFolder] || currentFolder,
      icon: Mail,
      color: 'text-gray-600'
    };
  };

  const viewConfig = getViewConfig();
  const ViewIcon = viewConfig.icon;

  return (
    <div className="h-full flex flex-col bg-white">
      {/* Header */}
      <div className="flex-shrink-0 px-4 py-3 border-b border-gray-200">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <ViewIcon size={20} className={viewConfig.color} />
            <h2 className="text-lg font-semibold text-gray-900">
              {viewConfig.title}
            </h2>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-sm text-gray-500">
              {pagination.total} emails
            </span>
            <button
              onClick={() => fetchEmails()}
              disabled={loading.emails}
              className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg"
            >
              <RefreshCw size={18} className={loading.emails ? 'animate-spin' : ''} />
            </button>
          </div>
        </div>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
          <input
            type="text"
            placeholder="Search emails..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-gray-100 border-0 rounded-lg text-sm focus:ring-2 focus:ring-orange-500 focus:bg-white transition-colors"
          />
        </div>
      </div>

      {/* Bulk Actions Bar */}
      {selectedEmails.length > 0 && (
        <div className="flex-shrink-0 flex items-center gap-2 px-4 py-2 bg-orange-50 border-b border-orange-100">
          <button
            onClick={handleSelectAll}
            className="p-1.5 text-orange-600 hover:bg-orange-100 rounded"
          >
            {selectedEmails.length === filteredEmails.length ? (
              <CheckSquare size={18} />
            ) : (
              <Square size={18} />
            )}
          </button>
          <span className="text-sm font-medium text-orange-700">
            {selectedEmails.length} selected
          </span>
          <div className="flex-1" />
          <button
            onClick={() => handleBulkMarkRead(true)}
            className="p-1.5 text-gray-600 hover:bg-orange-100 rounded"
            title="Mark as read"
          >
            <MailOpen size={18} />
          </button>
          <button
            onClick={() => handleBulkMarkRead(false)}
            className="p-1.5 text-gray-600 hover:bg-orange-100 rounded"
            title="Mark as unread"
          >
            <Mail size={18} />
          </button>
          <button
            onClick={handleBulkArchive}
            className="p-1.5 text-gray-600 hover:bg-orange-100 rounded"
            title="Archive"
          >
            <Archive size={18} />
          </button>
          <button
            onClick={handleBulkDelete}
            className="p-1.5 text-red-600 hover:bg-red-100 rounded"
            title="Delete"
          >
            <Trash2 size={18} />
          </button>
          <button
            onClick={clearSelection}
            className="px-3 py-1 text-sm text-orange-600 hover:bg-orange-100 rounded"
          >
            Cancel
          </button>
        </div>
      )}

      {/* Email List */}
      <div className="flex-1 overflow-y-auto mail-scrollbar">
        {(loading.emails || loadingCategory) ? (
          <div className="p-4">
            <SkeletonList count={8} />
          </div>
        ) : filteredEmails.length === 0 ? (
          <EmptyState
            icon={ViewIcon}
            title={searchQuery ? 'No emails found' : 'No emails'}
            description={
              searchQuery
                ? `No emails match "${searchQuery}"`
                : `Your ${viewConfig.title.toLowerCase()} is empty`
            }
            action={
              searchQuery
                ? { label: 'Clear search', onClick: () => setSearchQuery('') }
                : undefined
            }
          />
        ) : (
          <div>
            {filteredEmails.map((email) => (
              <MailListItem
                key={email.id}
                email={email}
                isSelected={selectedEmailId === email.id}
                isChecked={selectedEmails.includes(email.id)}
                onSelect={() => onSelectEmail(email)}
                onToggleCheck={() => toggleEmailSelection(email.id)}
                onToggleStar={() => toggleStar(email.id)}
              />
            ))}

            {/* Load More */}
            {pagination.hasMore && (
              <div className="p-4 text-center">
                <button
                  onClick={() => fetchEmails(currentFolder, pagination.page + 1)}
                  disabled={loading.emails}
                  className="px-4 py-2 text-sm text-orange-600 hover:bg-orange-50 rounded-lg"
                >
                  {loading.emails ? 'Loading...' : 'Load more'}
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
