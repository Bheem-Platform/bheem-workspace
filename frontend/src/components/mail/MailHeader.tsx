/**
 * Bheem Mail Header
 * Enhanced with brand colors, responsive design, and glassmorphism
 */
import { useState } from 'react';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
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
  Menu,
  X,
} from 'lucide-react';
import { useAuthStore } from '@/stores/authStore';
import { useMailStore } from '@/stores/mailStore';
import AppLauncher from '@/components/shared/AppLauncher';

// Brand Colors
const BRAND = {
  pink: '#FFCCF2',
  purple: '#977DFF',
  blue: '#0033FF',
  gradient: 'from-[#FFCCF2] via-[#977DFF] to-[#0033FF]',
};

interface MailHeaderProps {
  onSearch?: (query: string) => void;
  onOpenAdvancedSearch?: () => void;
  onOpenSettings?: () => void;
  onOpenSharedMailbox?: () => void;
  onToggleViewMode?: () => void;
  onToggleSidebar?: () => void;
  viewMode?: 'list' | 'threaded';
}

export default function MailHeader({
  onSearch,
  onOpenAdvancedSearch,
  onOpenSettings,
  onOpenSharedMailbox,
  onToggleViewMode,
  onToggleSidebar,
  viewMode = 'list',
}: MailHeaderProps) {
  const { user } = useAuthStore();
  const { searchQuery, setSearchQuery, fetchEmails, loading } = useMailStore();
  const [showNotifications, setShowNotifications] = useState(false);
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [showMobileSearch, setShowMobileSearch] = useState(false);

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
    <>
      <header className="sticky top-0 z-50 bg-white/80 backdrop-blur-lg border-b border-gray-200 h-14 sm:h-16">
        <div className="h-full px-3 sm:px-5 flex items-center justify-between gap-2 sm:gap-4">
          {/* Left side - Menu + Logo */}
          <div className="flex items-center gap-2 sm:gap-3 flex-shrink-0">
            {/* Mobile Menu Toggle */}
            <button
              onClick={onToggleSidebar}
              className="lg:hidden p-2 rounded-lg hover:bg-gray-100 transition-colors"
            >
              <Menu size={20} className="text-gray-600" />
            </button>

            <Link href="/dashboard" className="flex items-center gap-2 sm:gap-3">
              <div className={`w-9 h-9 sm:w-10 sm:h-10 bg-gradient-to-br ${BRAND.gradient} rounded-xl flex items-center justify-center shadow-lg`}>
                <Mail size={18} className="text-white sm:w-5 sm:h-5" />
              </div>
              <div className="hidden sm:block">
                <h1 className="text-lg sm:text-xl font-semibold text-gray-900">Bheem Mail</h1>
              </div>
            </Link>
          </div>

          {/* Center - Search (Desktop) */}
          <div className="hidden md:flex flex-1 max-w-xl mx-4">
            <div className="relative flex items-center gap-2 w-full">
              <div className="relative flex-1">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                <input
                  type="text"
                  placeholder="Search emails... (Shift+Enter for advanced)"
                  value={searchQuery}
                  onChange={handleSearch}
                  onKeyDown={handleKeyDown}
                  className="w-full pl-11 pr-12 py-2.5 bg-gray-100 border border-gray-200 rounded-xl text-gray-900 placeholder-gray-400 text-sm focus:outline-none focus:ring-2 focus:ring-[#977DFF]/50 focus:bg-white focus:border-[#977DFF] transition-all"
                />
                <button
                  onClick={onOpenAdvancedSearch}
                  className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 text-gray-400 hover:text-[#977DFF] rounded-md hover:bg-gray-200 transition-colors"
                  title="Advanced search"
                >
                  <SlidersHorizontal size={16} />
                </button>
              </div>

              {/* Refresh */}
              <button
                onClick={handleRefresh}
                disabled={loading.emails}
                className="p-2.5 bg-gray-100 hover:bg-gray-200 rounded-xl transition-colors"
                title="Refresh"
              >
                <RefreshCw
                  size={18}
                  className={`text-gray-600 ${loading.emails ? 'animate-spin' : ''}`}
                />
              </button>
            </div>
          </div>

          {/* Right side - Actions */}
          <div className="flex items-center gap-1 sm:gap-2">
            {/* Mobile Search Toggle */}
            <button
              onClick={() => setShowMobileSearch(!showMobileSearch)}
              className="md:hidden p-2 rounded-lg hover:bg-gray-100 transition-colors"
            >
              <Search size={20} className="text-gray-600" />
            </button>

            {/* Mobile Refresh */}
            <button
              onClick={handleRefresh}
              disabled={loading.emails}
              className="md:hidden p-2 rounded-lg hover:bg-gray-100 transition-colors"
            >
              <RefreshCw size={18} className={`text-gray-600 ${loading.emails ? 'animate-spin' : ''}`} />
            </button>

            {/* App Launcher */}
            <AppLauncher />

            {/* View Mode Toggle */}
            <button
              onClick={onToggleViewMode}
              className="hidden sm:flex w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-gray-100 hover:bg-gray-200 items-center justify-center transition-colors group"
              title={viewMode === 'list' ? 'Switch to conversation view' : 'Switch to list view'}
            >
              {viewMode === 'list' ? (
                <LayoutList size={18} className="text-gray-600" />
              ) : (
                <MessageSquare size={18} className="text-gray-600" />
              )}
            </button>

            {/* Team Inbox */}
            <button
              onClick={onOpenSharedMailbox}
              className="hidden sm:flex w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-gray-100 hover:bg-gray-200 items-center justify-center transition-colors"
              title="Team Inboxes"
            >
              <Users size={18} className="text-gray-600" />
            </button>

            {/* Help - Desktop only */}
            <button className="hidden lg:flex w-10 h-10 rounded-xl bg-gray-100 hover:bg-gray-200 items-center justify-center transition-colors">
              <HelpCircle size={18} className="text-gray-600" />
            </button>

            {/* Settings */}
            <button
              onClick={onOpenSettings}
              className="hidden sm:flex w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-gray-100 hover:bg-gray-200 items-center justify-center transition-colors"
              title="Mail Settings"
            >
              <Settings size={18} className="text-gray-600" />
            </button>

            {/* Notifications */}
            <div className="relative">
              <button
                onClick={() => setShowNotifications(!showNotifications)}
                className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-gray-100 hover:bg-gray-200 flex items-center justify-center transition-colors relative"
              >
                <Bell size={18} className="text-gray-600" />
                <span className={`absolute top-2 right-2 w-2 h-2 bg-gradient-to-r ${BRAND.gradient} rounded-full`} />
              </button>

              <AnimatePresence>
                {showNotifications && (
                  <>
                    <div className="fixed inset-0 z-40" onClick={() => setShowNotifications(false)} />
                    <motion.div
                      initial={{ opacity: 0, y: 10, scale: 0.95 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: 10, scale: 0.95 }}
                      className="absolute right-0 top-full mt-2 w-72 sm:w-80 bg-white rounded-2xl shadow-2xl border border-gray-200 z-50 overflow-hidden"
                    >
                      <div className="px-4 py-3 border-b border-gray-100">
                        <h3 className="font-semibold text-gray-900">Notifications</h3>
                      </div>
                      <div className="p-4 text-center text-sm text-gray-500">
                        No new notifications
                      </div>
                    </motion.div>
                  </>
                )}
              </AnimatePresence>
            </div>

            {/* User Menu */}
            <div className="relative ml-1 sm:ml-2">
              <button
                onClick={() => setShowUserMenu(!showUserMenu)}
                className={`w-8 h-8 sm:w-9 sm:h-9 rounded-full bg-gradient-to-br ${BRAND.gradient} flex items-center justify-center text-white font-semibold text-xs sm:text-sm cursor-pointer hover:shadow-lg transition-all`}
                style={{ boxShadow: `0 4px 12px ${BRAND.purple}40` }}
              >
                {userInitials}
              </button>

              <AnimatePresence>
                {showUserMenu && (
                  <>
                    <div className="fixed inset-0 z-40" onClick={() => setShowUserMenu(false)} />
                    <motion.div
                      initial={{ opacity: 0, y: 10, scale: 0.95 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: 10, scale: 0.95 }}
                      className="absolute right-0 top-full mt-2 w-56 bg-white rounded-2xl shadow-2xl border border-gray-200 z-50 overflow-hidden"
                    >
                      <div className="px-4 py-3 border-b border-gray-100">
                        <p className="font-medium text-gray-900">{user?.username || 'User'}</p>
                        <p className="text-sm text-gray-500 truncate">{user?.email}</p>
                      </div>
                      <div className="py-1">
                        <button
                          onClick={() => {
                            setShowUserMenu(false);
                            onOpenSettings?.();
                          }}
                          className="w-full text-left px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2"
                        >
                          <Settings size={16} className="text-gray-400" />
                          Mail Settings
                        </button>
                        <Link
                          href="/settings"
                          className="block px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50"
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
                            className="w-full text-left px-4 py-2.5 text-sm text-red-600 hover:bg-red-50"
                          >
                            Sign out
                          </button>
                        </div>
                      </div>
                    </motion.div>
                  </>
                )}
              </AnimatePresence>
            </div>
          </div>
        </div>
      </header>

      {/* Mobile Search Bar */}
      <AnimatePresence>
        {showMobileSearch && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="md:hidden bg-white border-b border-gray-200 overflow-hidden"
          >
            <div className="p-3 flex items-center gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                <input
                  type="text"
                  placeholder="Search emails..."
                  value={searchQuery}
                  onChange={handleSearch}
                  autoFocus
                  className="w-full pl-10 pr-4 py-2.5 bg-gray-100 border border-gray-200 rounded-xl text-gray-900 placeholder-gray-400 text-sm focus:outline-none focus:ring-2 focus:ring-[#977DFF]/50 focus:bg-white focus:border-[#977DFF] transition-all"
                />
              </div>
              <button
                onClick={() => setShowMobileSearch(false)}
                className="p-2 rounded-lg hover:bg-gray-100"
              >
                <X size={20} className="text-gray-500" />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
