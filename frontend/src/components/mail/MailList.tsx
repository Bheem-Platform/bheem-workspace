import { useState } from 'react';
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
} from 'lucide-react';
import { useMailStore } from '@/stores/mailStore';
import MailListItem from './MailListItem';
import { SkeletonList } from '@/components/shared/LoadingOverlay';
import EmptyState from '@/components/shared/EmptyState';
import type { Email } from '@/types/mail';

interface MailListProps {
  onSelectEmail: (email: Email) => void;
  selectedEmailId?: string;
}

export default function MailList({ onSelectEmail, selectedEmailId }: MailListProps) {
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

  // Filter emails by search query
  const filteredEmails = searchQuery
    ? emails.filter(
        (e) =>
          e.subject.toLowerCase().includes(searchQuery.toLowerCase()) ||
          e.from.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
          e.from.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
          e.body?.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : emails;

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

  const getFolderTitle = () => {
    const titles: Record<string, string> = {
      INBOX: 'Inbox',
      Sent: 'Sent',
      Drafts: 'Drafts',
      Spam: 'Spam',
      Trash: 'Trash',
      Archive: 'Archive',
    };
    return titles[currentFolder] || currentFolder;
  };

  return (
    <div className="h-full flex flex-col bg-white">
      {/* Header */}
      <div className="flex-shrink-0 px-4 py-3 border-b border-gray-200">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-semibold text-gray-900">
            {getFolderTitle()}
          </h2>
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
        {loading.emails ? (
          <div className="p-4">
            <SkeletonList count={8} />
          </div>
        ) : filteredEmails.length === 0 ? (
          <EmptyState
            icon={Mail}
            title={searchQuery ? 'No emails found' : 'No emails'}
            description={
              searchQuery
                ? `No emails match "${searchQuery}"`
                : `Your ${getFolderTitle().toLowerCase()} is empty`
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
