/**
 * Sidebar conversation list with filter tabs (All, Unread, Teams)
 * and collapsible Archived section
 */

import { useState, useEffect } from 'react';
import { Search, Plus, MessageSquare, MessageCircle, Users, Archive, ChevronDown, ChevronRight } from 'lucide-react';
import { useChatStore, type Conversation, type ChatTab } from '@/stores/chatStore';
import ConversationItem from './ConversationItem';

interface ConversationListProps {
  currentUserId: string;
  onNewChat: () => void;
}

export default function ConversationList({ currentUserId, onNewChat }: ConversationListProps) {
  const {
    conversations,
    archivedConversations,
    activeConversation,
    activeTab,
    unreadCounts,
    onlineUsers,
    searchQuery,
    showArchived,
    isLoading,
    setActiveTab,
    setActiveConversation,
    setSearchQuery,
    setShowArchived,
    fetchArchivedConversations,
    unarchiveConversation,
  } = useChatStore();

  // Fetch archived conversations on mount
  useEffect(() => {
    fetchArchivedConversations();
  }, [fetchArchivedConversations]);

  // Filter conversations based on search
  const filteredConversations = conversations.filter((conv) => {
    if (!searchQuery) return true;

    const query = searchQuery.toLowerCase();

    // Search by group name
    if (conv.name?.toLowerCase().includes(query)) return true;

    // Search by participant names
    return conv.participants.some((p) =>
      p.user_name.toLowerCase().includes(query)
    );
  });

  // Filter archived conversations based on search
  const filteredArchivedConversations = archivedConversations.filter((conv) => {
    if (!searchQuery) return true;

    const query = searchQuery.toLowerCase();

    if (conv.name?.toLowerCase().includes(query)) return true;

    return conv.participants.some((p) =>
      p.user_name.toLowerCase().includes(query)
    );
  });

  // Check if other user in direct chat is online
  const isOtherUserOnline = (conv: Conversation) => {
    if (conv.type !== 'direct') return false;
    const other = conv.participants.find((p) => p.user_id !== currentUserId);
    return other?.user_id ? onlineUsers.has(other.user_id) : false;
  };

  // Get unread count for Unread tab badge
  const totalUnreadCount = Object.values(unreadCounts).reduce((sum, count) => sum + count, 0);

  return (
    <div className="flex flex-col h-full bg-white border-r border-gray-200">
      {/* Header */}
      <div className="p-4 border-b border-gray-200">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-gray-900">Messages</h2>
          <button
            onClick={onNewChat}
            className="p-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
            title="New chat"
          >
            <Plus size={20} />
          </button>
        </div>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
          <input
            type="text"
            placeholder="Search conversations..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-gray-100 border border-transparent rounded-lg text-sm focus:outline-none focus:border-[#977DFF] focus:bg-white transition-all"
          />
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="flex border-b border-gray-200">
        <TabButton
          active={activeTab === 'all'}
          onClick={() => setActiveTab('all')}
          icon={<MessageSquare size={18} />}
          label="All"
        />
        <TabButton
          active={activeTab === 'unread'}
          onClick={() => setActiveTab('unread')}
          icon={<MessageCircle size={18} />}
          label="Unread"
          badge={totalUnreadCount > 0 ? totalUnreadCount : undefined}
        />
        <TabButton
          active={activeTab === 'teams'}
          onClick={() => setActiveTab('teams')}
          icon={<Users size={18} />}
          label="Teams"
        />
      </div>

      {/* Conversation List */}
      <div className="flex-1 overflow-y-auto">
        {isLoading ? (
          <div className="flex items-center justify-center h-32">
            <div className="animate-spin rounded-full h-8 w-8 border-2 border-[#FFCCF2] border-t-[#977DFF] border-r-[#0033FF]" />
          </div>
        ) : filteredConversations.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-32 text-gray-500 p-4 text-center">
            <p className="text-sm">
              {searchQuery
                ? 'No conversations found'
                : activeTab === 'all'
                ? 'No conversations yet'
                : activeTab === 'unread'
                ? 'No unread messages'
                : 'No team conversations yet'}
            </p>
            <button
              onClick={onNewChat}
              className="mt-2 bg-gradient-to-r from-[#977DFF] to-[#0033FF] bg-clip-text text-transparent hover:opacity-80 text-sm font-medium"
            >
              Start a new conversation
            </button>
          </div>
        ) : (
          filteredConversations.map((conv) => (
            <ConversationItem
              key={conv.id}
              conversation={conv}
              currentUserId={currentUserId}
              isSelected={activeConversation?.id === conv.id}
              unreadCount={unreadCounts[conv.id] || 0}
              isOnline={isOtherUserOnline(conv)}
              onClick={() => setActiveConversation(conv)}
            />
          ))
        )}

        {/* Archived Section */}
        {activeTab === 'all' && filteredArchivedConversations.length > 0 && (
          <div className="border-t border-gray-200">
            {/* Archived Header */}
            <button
              onClick={() => setShowArchived(!showArchived)}
              className="w-full flex items-center justify-between px-4 py-3 text-sm text-gray-600 hover:bg-gray-50 transition-colors"
            >
              <div className="flex items-center gap-2">
                <Archive size={16} />
                <span>Archived</span>
                <span className="text-xs text-gray-400">({filteredArchivedConversations.length})</span>
              </div>
              {showArchived ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
            </button>

            {/* Archived Conversations */}
            {showArchived && (
              <div className="bg-gray-50">
                {filteredArchivedConversations.map((conv) => (
                  <ConversationItem
                    key={conv.id}
                    conversation={conv}
                    currentUserId={currentUserId}
                    isSelected={activeConversation?.id === conv.id}
                    unreadCount={0}
                    isOnline={false}
                    onClick={() => setActiveConversation(conv)}
                    isArchived
                    onUnarchive={() => unarchiveConversation(conv.id)}
                  />
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// Tab button component
function TabButton({
  active,
  onClick,
  icon,
  label,
  badge,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
  badge?: number;
}) {
  return (
    <button
      onClick={onClick}
      className={`
        flex-1 flex items-center justify-center gap-2 px-4 py-3 text-sm font-medium transition-colors relative
        ${active
          ? 'bg-gradient-to-r from-[#977DFF] to-[#0033FF] bg-clip-text text-transparent border-b-2 border-[#977DFF]'
          : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
        }
      `}
    >
      {icon}
      {label}
      {badge !== undefined && badge > 0 && (
        <span className="absolute top-2 right-2 min-w-[18px] h-[18px] px-1 bg-gradient-to-r from-[#977DFF] to-[#0033FF] text-white text-xs rounded-full flex items-center justify-center">
          {badge > 99 ? '99+' : badge}
        </span>
      )}
    </button>
  );
}
