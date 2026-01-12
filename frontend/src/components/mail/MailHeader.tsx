/**
 * Bheem Mail Header
 * Enhanced with advanced search, settings, and team inbox access
 */
import { useState } from 'react';
import Link from 'next/link';
import {
  Search,
  Bell,
  Settings,
  Mail,
  HelpCircle,
  SlidersHorizontal,
  Users,
  LayoutList,
  MessageSquare,
  RefreshCw,
} from 'lucide-react';
import { useAuthStore } from '@/stores/authStore';
import { useMailStore } from '@/stores/mailStore';

interface MailHeaderProps {
  onSearch?: (query: string) => void;
  onOpenAdvancedSearch?: () => void;
  onOpenSettings?: () => void;
  onOpenSharedMailbox?: () => void;
  onToggleViewMode?: () => void;
  viewMode?: 'list' | 'threaded';
}

export default function MailHeader({
  onSearch,
  onOpenAdvancedSearch,
  onOpenSettings,
  onOpenSharedMailbox,
  onToggleViewMode,
  viewMode = 'list',
}: MailHeaderProps) {
  const { user } = useAuthStore();
  const { searchQuery, setSearchQuery, fetchEmails, loading } = useMailStore();
  const [showNotifications, setShowNotifications] = useState(false);
  const [showUserMenu, setShowUserMenu] = useState(false);

  const handleSearch = (e: React.ChangeEvent<HTMLInputElement>) => {
    const query = e.target.value;
    setSearchQuery(query);
    onSearch?.(query);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && e.shiftKey && onOpenAdvancedSearch) {
      e.preventDefault();
      onOpenAdvancedSearch();
    }
  };

  const handleRefresh = () => {
    fetchEmails();
  };

  const userInitials = user?.username
    ? user.username.split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2)
    : 'U';

  return (
    <header className="h-14 bg-gradient-to-r from-slate-900 to-slate-800 flex items-center justify-between px-5 fixed top-0 left-0 right-0 z-50">
      {/* Left side - Logo */}
      <div className="flex items-center gap-3 pl-16">
        <Link href="/dashboard" className="flex items-center gap-3">
          <div className="w-9 h-9 bg-gradient-to-br from-orange-500 to-red-500 rounded-lg flex items-center justify-center">
            <Mail size={20} className="text-white" />
          </div>
          <span className="text-white font-semibold text-lg">
            Bheem <span className="text-orange-400">Mail</span>
          </span>
        </Link>
      </div>

      {/* Center - Search */}
      <div className="flex-1 max-w-2xl mx-8">
        <div className="relative flex items-center gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
            <input
              type="text"
              placeholder="Search emails... (Shift+Enter for advanced)"
              value={searchQuery}
              onChange={handleSearch}
              onKeyDown={handleKeyDown}
              className="w-full pl-11 pr-12 py-2.5 bg-white/10 border border-white/10 rounded-lg text-white placeholder-slate-400 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500/50 focus:bg-white/15 transition-all"
            />
            {/* Advanced Search Button */}
            <button
              onClick={onOpenAdvancedSearch}
              className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 text-slate-400 hover:text-white rounded-md hover:bg-white/10 transition-colors"
              title="Advanced search"
            >
              <SlidersHorizontal size={16} />
            </button>
          </div>

          {/* Refresh */}
          <button
            onClick={handleRefresh}
            disabled={loading.emails}
            className="p-2.5 bg-white/10 hover:bg-white/20 rounded-lg transition-colors"
            title="Refresh"
          >
            <RefreshCw
              size={18}
              className={`text-white/80 ${loading.emails ? 'animate-spin' : ''}`}
            />
          </button>
        </div>
      </div>

      {/* Right side - Actions */}
      <div className="flex items-center gap-2">
        {/* View Mode Toggle */}
        <button
          onClick={onToggleViewMode}
          className="w-10 h-10 rounded-lg bg-white/10 hover:bg-white/20 flex items-center justify-center transition-colors group relative"
          title={viewMode === 'list' ? 'Switch to conversation view' : 'Switch to list view'}
        >
          {viewMode === 'list' ? (
            <LayoutList size={20} className="text-white/80" />
          ) : (
            <MessageSquare size={20} className="text-white/80" />
          )}
        </button>

        {/* Team Inbox */}
        <button
          onClick={onOpenSharedMailbox}
          className="w-10 h-10 rounded-lg bg-white/10 hover:bg-white/20 flex items-center justify-center transition-colors"
          title="Team Inboxes"
        >
          <Users size={20} className="text-white/80" />
        </button>

        {/* Help */}
        <button className="w-10 h-10 rounded-lg bg-white/10 hover:bg-white/20 flex items-center justify-center transition-colors">
          <HelpCircle size={20} className="text-white/80" />
        </button>

        {/* Settings */}
        <button
          onClick={onOpenSettings}
          className="w-10 h-10 rounded-lg bg-white/10 hover:bg-white/20 flex items-center justify-center transition-colors"
          title="Mail Settings"
        >
          <Settings size={20} className="text-white/80" />
        </button>

        {/* Notifications */}
        <div className="relative">
          <button
            onClick={() => setShowNotifications(!showNotifications)}
            className="w-10 h-10 rounded-lg bg-white/10 hover:bg-white/20 flex items-center justify-center transition-colors relative"
          >
            <Bell size={20} className="text-white/80" />
            <span className="absolute top-2 right-2 w-2 h-2 bg-orange-500 rounded-full" />
          </button>

          {showNotifications && (
            <>
              <div className="fixed inset-0 z-40" onClick={() => setShowNotifications(false)} />
              <div className="absolute right-0 top-full mt-2 w-80 bg-white rounded-xl shadow-2xl border border-gray-200 z-50 overflow-hidden">
                <div className="px-4 py-3 border-b border-gray-100">
                  <h3 className="font-semibold text-gray-900">Notifications</h3>
                </div>
                <div className="p-4 text-center text-sm text-gray-500">
                  No new notifications
                </div>
              </div>
            </>
          )}
        </div>

        {/* User Menu */}
        <div className="relative ml-2">
          <button
            onClick={() => setShowUserMenu(!showUserMenu)}
            className="w-9 h-9 rounded-full bg-gradient-to-br from-orange-500 to-red-500 flex items-center justify-center text-white font-semibold text-sm cursor-pointer hover:ring-2 hover:ring-orange-400/50 transition-all"
          >
            {userInitials}
          </button>

          {showUserMenu && (
            <>
              <div className="fixed inset-0 z-40" onClick={() => setShowUserMenu(false)} />
              <div className="absolute right-0 top-full mt-2 w-56 bg-white rounded-xl shadow-2xl border border-gray-200 z-50 overflow-hidden">
                <div className="px-4 py-3 border-b border-gray-100">
                  <p className="font-medium text-gray-900">{user?.username || 'User'}</p>
                  <p className="text-sm text-gray-500">{user?.email}</p>
                </div>
                <div className="py-1">
                  <button
                    onClick={() => {
                      setShowUserMenu(false);
                      onOpenSettings?.();
                    }}
                    className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2"
                  >
                    <Settings size={16} />
                    Mail Settings
                  </button>
                  <Link
                    href="/settings"
                    className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
                  >
                    Account Settings
                  </Link>
                  <div className="border-t border-gray-100 mt-1 pt-1">
                    <button
                      onClick={async () => {
                        setShowUserMenu(false);
                        await useAuthStore.getState().logout();
                        window.location.href = '/login';
                      }}
                      className="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50"
                    >
                      Sign out
                    </button>
                  </div>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
