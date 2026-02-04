/**
 * ReadReceiptsModal - Shows who has delivered to and read a message
 */

'use client';

import { useEffect, useState } from 'react';
import { X, Check, CheckCheck, Clock } from 'lucide-react';
import { useChatStore, type MessageReadReceipts, type ReadReceiptUser } from '@/stores/chatStore';

interface ReadReceiptsModalProps {
  messageId: string;
  isOpen: boolean;
  onClose: () => void;
}

// Format relative time
function formatRelativeTime(dateStr: string | undefined): string {
  if (!dateStr) return '';

  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins} min${diffMins > 1 ? 's' : ''} ago`;
  if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
  if (diffDays < 7) return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`;

  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

export default function ReadReceiptsModal({ messageId, isOpen, onClose }: ReadReceiptsModalProps) {
  const { fetchMessageReadReceipts } = useChatStore();
  const [receipts, setReceipts] = useState<MessageReadReceipts | null>(null);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<'read' | 'delivered'>('read');

  useEffect(() => {
    if (isOpen && messageId) {
      setLoading(true);
      fetchMessageReadReceipts(messageId)
        .then((data) => {
          setReceipts(data);
          setLoading(false);
        })
        .catch(() => {
          setLoading(false);
        });
    }
  }, [isOpen, messageId, fetchMessageReadReceipts]);

  if (!isOpen) return null;

  const renderUserList = (users: ReadReceiptUser[], icon: React.ReactNode, emptyMessage: string) => {
    if (users.length === 0) {
      return (
        <div className="flex flex-col items-center justify-center py-8 text-gray-400">
          {icon}
          <p className="mt-2 text-sm">{emptyMessage}</p>
        </div>
      );
    }

    return (
      <div className="divide-y divide-gray-100">
        {users.map((user) => (
          <div key={user.user_id} className="flex items-center gap-3 py-3 px-4">
            {/* Avatar */}
            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[#FFCCF2] via-[#977DFF]/30 to-[#0033FF]/20 flex items-center justify-center flex-shrink-0">
              {user.user_avatar ? (
                <img
                  src={user.user_avatar}
                  alt={user.user_name}
                  className="w-10 h-10 rounded-full object-cover"
                />
              ) : (
                <span className="bg-gradient-to-r from-[#977DFF] to-[#0033FF] bg-clip-text text-transparent font-medium">
                  {user.user_name?.charAt(0)?.toUpperCase() || '?'}
                </span>
              )}
            </div>

            {/* User info */}
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-gray-900 truncate">
                {user.user_name}
              </p>
              {user.last_read_at && (
                <p className="text-xs text-gray-500">
                  {formatRelativeTime(user.last_read_at)}
                </p>
              )}
            </div>

            {/* Status icon */}
            <div className="flex-shrink-0">
              {activeTab === 'read' ? (
                <CheckCheck size={16} className="text-[#0033FF]" />
              ) : (
                <CheckCheck size={16} className="text-gray-400" />
              )}
            </div>
          </div>
        ))}
      </div>
    );
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative bg-white rounded-xl shadow-xl w-full max-w-md mx-4 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
          <h3 className="text-lg font-semibold text-gray-900">Message Info</h3>
          <button
            onClick={onClose}
            className="p-1 rounded-full hover:bg-gray-100 transition-colors"
          >
            <X size={20} className="text-gray-500" />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-gray-100">
          <button
            onClick={() => setActiveTab('read')}
            className={`flex-1 py-3 text-sm font-medium transition-colors ${
              activeTab === 'read'
                ? 'bg-gradient-to-r from-[#977DFF] to-[#0033FF] bg-clip-text text-transparent border-b-2 border-[#977DFF]'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            <div className="flex items-center justify-center gap-2">
              <CheckCheck size={16} className="text-[#0033FF]" />
              <span>Read by {receipts?.total_read || 0}</span>
            </div>
          </button>
          <button
            onClick={() => setActiveTab('delivered')}
            className={`flex-1 py-3 text-sm font-medium transition-colors ${
              activeTab === 'delivered'
                ? 'bg-gradient-to-r from-[#977DFF] to-[#0033FF] bg-clip-text text-transparent border-b-2 border-[#977DFF]'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            <div className="flex items-center justify-center gap-2">
              <CheckCheck size={16} className="text-gray-400" />
              <span>Delivered to {receipts?.total_delivered || 0}</span>
            </div>
          </button>
        </div>

        {/* Content */}
        <div className="max-h-80 overflow-y-auto">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-2 border-[#FFCCF2] border-t-[#977DFF] border-r-[#0033FF]" />
            </div>
          ) : receipts ? (
            activeTab === 'read' ? (
              renderUserList(
                receipts.read_by,
                <CheckCheck size={32} className="text-gray-300" />,
                'No one has read this message yet'
              )
            ) : (
              renderUserList(
                receipts.delivered_to,
                <Check size={32} className="text-gray-300" />,
                'Message not delivered yet'
              )
            )
          ) : (
            <div className="flex flex-col items-center justify-center py-12 text-gray-400">
              <Clock size={32} />
              <p className="mt-2 text-sm">Unable to load read receipts</p>
            </div>
          )}
        </div>

        {/* Footer with summary */}
        {receipts && (
          <div className="px-4 py-3 border-t border-gray-100 bg-gray-50">
            <p className="text-xs text-gray-500 text-center">
              {receipts.total_read} of {receipts.total_participants} participants have read this message
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
