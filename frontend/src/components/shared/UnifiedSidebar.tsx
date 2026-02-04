/**
 * UnifiedSidebar - Google Workspace-style unified sidebar
 * Consistent across all Bheem apps with brand gradient
 * #FFCCF2 → #977DFF → #0033FF
 */
import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/router';
import {
  Home,
  Mail,
  Calendar,
  Video,
  FileText,
  HardDrive,
  MessageSquare,
  Settings,
  LogOut,
  Menu,
  X,
  ChevronLeft,
  ChevronRight,
  Plus,
  Search,
  Bell,
  User,
  LayoutGrid,
  StickyNote,
  Globe,
  type LucideIcon,
} from 'lucide-react';
import { useAuthStore } from '@/stores/authStore';
import { useChatStore } from '@/stores/chatStore';
import {
  BheemMailIcon,
  BheemCalendarIcon,
  BheemMeetIcon,
  BheemDocsIcon,
  BheemDriveIcon,
  BheemChatIcon,
  BheemDashboardIcon,
  BheemNotesIcon,
  BheemSitesIcon,
} from './AppIcons';

// Brand colors
const BRAND = {
  pink: '#FFCCF2',
  purple: '#977DFF',
  blue: '#0033FF',
};

export type AppId = 'dashboard' | 'mail' | 'calendar' | 'meet' | 'docs' | 'drive' | 'chat' | 'sheets' | 'slides' | 'videos' | 'notes' | 'sites';

interface AppItem {
  id: AppId;
  name: string;
  href: string;
  icon: React.ComponentType<{ size?: number; className?: string }>;
  lucideIcon: LucideIcon;
}

const apps: AppItem[] = [
  { id: 'dashboard', name: 'Dashboard', href: '/dashboard', icon: BheemDashboardIcon, lucideIcon: Home },
  { id: 'mail', name: 'Mail', href: '/mail', icon: BheemMailIcon, lucideIcon: Mail },
  { id: 'calendar', name: 'Calendar', href: '/calendar', icon: BheemCalendarIcon, lucideIcon: Calendar },
  { id: 'meet', name: 'Meet', href: '/meet', icon: BheemMeetIcon, lucideIcon: Video },
  { id: 'docs', name: 'Docs', href: '/docs', icon: BheemDocsIcon, lucideIcon: FileText },
  { id: 'drive', name: 'Drive', href: '/drive', icon: BheemDriveIcon, lucideIcon: HardDrive },
  { id: 'notes', name: 'Notes', href: '/notes', icon: BheemNotesIcon, lucideIcon: StickyNote },
  { id: 'sites', name: 'Sites', href: '/sites', icon: BheemSitesIcon, lucideIcon: Globe },
  { id: 'chat', name: 'Chat', href: '/chat', icon: BheemChatIcon, lucideIcon: MessageSquare },
];

interface UnifiedSidebarProps {
  children?: React.ReactNode;
  activeApp?: AppId;
  showAppContent?: boolean;
}

// Detect active app from pathname
function detectActiveApp(pathname: string): AppId {
  if (pathname.startsWith('/mail')) return 'mail';
  if (pathname.startsWith('/calendar')) return 'calendar';
  if (pathname.startsWith('/meet')) return 'meet';
  if (pathname.startsWith('/docs') || pathname.startsWith('/sheets') || pathname.startsWith('/slides')) return 'docs';
  if (pathname.startsWith('/drive')) return 'drive';
  if (pathname.startsWith('/notes')) return 'notes';
  if (pathname.startsWith('/sites')) return 'sites';
  if (pathname.startsWith('/chat')) return 'chat';
  if (pathname.startsWith('/videos')) return 'videos';
  return 'dashboard';
}

export default function UnifiedSidebar({ children, activeApp, showAppContent = true }: UnifiedSidebarProps) {
  const router = useRouter();
  const { user, logout } = useAuthStore();
  const { totalUnread, fetchUnreadCounts } = useChatStore();
  const [isExpanded, setIsExpanded] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [hoveredApp, setHoveredApp] = useState<string | null>(null);

  const currentApp = activeApp || detectActiveApp(router.pathname);

  // Fetch unread counts on mount and periodically
  useEffect(() => {
    fetchUnreadCounts();
    const interval = setInterval(fetchUnreadCounts, 30000); // Refresh every 30 seconds
    return () => clearInterval(interval);
  }, [fetchUnreadCounts]);

  const handleLogout = async () => {
    await logout();
    window.location.href = '/login';
  };

  return (
    <div className="flex h-screen bg-gray-50">
      {/* Mobile Menu Button */}
      <button
        className="lg:hidden fixed top-4 left-4 z-50 p-2 rounded-xl bg-white shadow-lg border border-gray-200"
        onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
      >
        {isMobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
      </button>

      {/* Mobile Overlay */}
      {isMobileMenuOpen && (
        <div
          className="lg:hidden fixed inset-0 bg-black/30 z-40"
          onClick={() => setIsMobileMenuOpen(false)}
        />
      )}

      {/* Main Sidebar Rail */}
      <aside
        className={`
          fixed lg:relative z-50 h-full
          ${isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
          transition-all duration-300 ease-in-out
          ${isExpanded ? 'w-64' : 'w-[72px]'}
          bg-white border-r border-gray-200 flex flex-col
        `}
      >
        {/* Logo Header */}
        <div className="h-16 flex items-center justify-center border-b border-gray-100 px-3">
          <Link href="/dashboard" className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#FFCCF2] via-[#977DFF] to-[#0033FF] flex items-center justify-center shadow-lg">
              <span className="text-white font-bold text-lg">B</span>
            </div>
            {isExpanded && (
              <span className="font-semibold text-xl bg-gradient-to-r from-[#977DFF] to-[#0033FF] bg-clip-text text-transparent">
                Bheem
              </span>
            )}
          </Link>
        </div>

        {/* App Navigation */}
        <nav className="flex-1 py-4 px-2 overflow-y-auto">
          <div className="space-y-1">
            {apps.map((app) => {
              const isActive = currentApp === app.id;
              const isHovered = hoveredApp === app.id;
              const IconComponent = app.icon;
              const LucideIcon = app.lucideIcon;

              return (
                <div key={app.id} className="relative">
                  <Link
                    href={app.href}
                    onMouseEnter={() => setHoveredApp(app.id)}
                    onMouseLeave={() => setHoveredApp(null)}
                    onClick={() => setIsMobileMenuOpen(false)}
                    className={`
                      flex items-center gap-3 rounded-2xl transition-all duration-200
                      ${isExpanded ? 'px-3 py-2.5' : 'px-2 py-2.5 justify-center'}
                      ${isActive
                        ? 'bg-gradient-to-r from-[#FFCCF2]/20 via-[#977DFF]/20 to-[#0033FF]/20 text-[#0033FF]'
                        : 'text-gray-600 hover:bg-gray-100'
                      }
                    `}
                  >
                    <div
                      className={`
                        relative flex-shrink-0 transition-transform duration-200
                        ${isActive || isHovered ? 'scale-110' : 'scale-100'}
                      `}
                    >
                      {isActive ? (
                        <IconComponent size={isExpanded ? 28 : 32} />
                      ) : (
                        <div className={`
                          ${isExpanded ? 'w-7 h-7' : 'w-8 h-8'}
                          rounded-lg flex items-center justify-center
                          ${isHovered ? 'bg-gray-200' : 'bg-gray-100'}
                        `}>
                          <LucideIcon size={isExpanded ? 18 : 20} />
                        </div>
                      )}
                      {/* Unread badge for chat */}
                      {app.id === 'chat' && totalUnread > 0 && (
                        <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] flex items-center justify-center bg-red-500 text-white text-xs font-bold rounded-full px-1">
                          {totalUnread > 99 ? '99+' : totalUnread}
                        </span>
                      )}
                    </div>
                    {isExpanded && (
                      <span className={`font-medium text-sm ${isActive ? 'text-[#0033FF]' : ''}`}>
                        {app.name}
                      </span>
                    )}
                  </Link>

                  {/* Tooltip for collapsed mode */}
                  {!isExpanded && isHovered && (
                    <div className="absolute left-full top-1/2 -translate-y-1/2 ml-3 z-50 pointer-events-none">
                      <div className="bg-gray-900 text-white px-3 py-1.5 rounded-lg text-sm font-medium whitespace-nowrap shadow-xl">
                        {app.name}
                      </div>
                      <div className="absolute right-full top-1/2 -translate-y-1/2 border-4 border-transparent border-r-gray-900" />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </nav>

        {/* Bottom Section */}
        <div className="p-2 border-t border-gray-100 space-y-1">
          {/* Expand/Collapse Toggle */}
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className={`
              w-full flex items-center gap-3 rounded-xl py-2.5 transition-colors
              text-gray-500 hover:text-gray-700 hover:bg-gray-100
              ${isExpanded ? 'px-3' : 'justify-center px-2'}
            `}
          >
            {isExpanded ? (
              <>
                <ChevronLeft size={20} />
                <span className="text-sm">Collapse</span>
              </>
            ) : (
              <ChevronRight size={20} />
            )}
          </button>

          {/* Settings */}
          <Link
            href="/settings"
            className={`
              w-full flex items-center gap-3 rounded-xl py-2.5 transition-colors
              text-gray-500 hover:text-gray-700 hover:bg-gray-100
              ${isExpanded ? 'px-3' : 'justify-center px-2'}
            `}
          >
            <Settings size={20} />
            {isExpanded && <span className="text-sm">Settings</span>}
          </Link>

          {/* User Profile / Logout */}
          <button
            onClick={handleLogout}
            className={`
              w-full flex items-center gap-3 rounded-xl py-2.5 transition-colors
              text-gray-500 hover:text-red-500 hover:bg-red-50
              ${isExpanded ? 'px-3' : 'justify-center px-2'}
            `}
          >
            <LogOut size={20} />
            {isExpanded && <span className="text-sm">Logout</span>}
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Top Header Bar */}
        <header className="h-16 bg-white border-b border-gray-200 flex items-center justify-between px-4 lg:px-6 flex-shrink-0">
          {/* Left - Page Title / Search */}
          <div className="flex items-center gap-4 ml-12 lg:ml-0">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
              <input
                type="text"
                placeholder="Search..."
                className="w-64 lg:w-96 pl-10 pr-4 py-2 bg-gray-100 border-0 rounded-full text-sm focus:outline-none focus:ring-2 focus:ring-[#977DFF]/50 focus:bg-white transition-all"
              />
            </div>
          </div>

          {/* Right - Actions */}
          <div className="flex items-center gap-2">
            {/* App Launcher */}
            <button className="p-2 rounded-full hover:bg-gray-100 text-gray-600 transition-colors">
              <LayoutGrid size={20} />
            </button>

            {/* Notifications */}
            <button className="p-2 rounded-full hover:bg-gray-100 text-gray-600 transition-colors relative">
              <Bell size={20} />
              <span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full" />
            </button>

            {/* User Avatar */}
            <button className="ml-2 w-9 h-9 rounded-full bg-gradient-to-br from-[#FFCCF2] via-[#977DFF] to-[#0033FF] flex items-center justify-center text-white font-medium text-sm">
              {user?.username?.[0]?.toUpperCase() || user?.email?.[0]?.toUpperCase() || 'U'}
            </button>
          </div>
        </header>

        {/* Page Content */}
        <div className="flex-1 overflow-auto">
          {children}
        </div>
      </main>

      {/* Mobile Bottom Navigation */}
      <nav className="lg:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 z-40 safe-area-pb">
        <div className="flex items-center justify-around py-2">
          {apps.slice(0, 5).map((app) => {
            const isActive = currentApp === app.id;
            const LucideIcon = app.lucideIcon;

            return (
              <Link
                key={app.id}
                href={app.href}
                className="flex flex-col items-center gap-1 px-3 py-1"
              >
                <div
                  className={`
                    relative w-10 h-10 rounded-xl flex items-center justify-center transition-all
                    ${isActive
                      ? 'bg-gradient-to-br from-[#FFCCF2] via-[#977DFF] to-[#0033FF] text-white'
                      : 'text-gray-500'
                    }
                  `}
                >
                  <LucideIcon size={20} />
                  {/* Unread badge for chat on mobile */}
                  {app.id === 'chat' && totalUnread > 0 && (
                    <span className="absolute -top-1 -right-1 min-w-[16px] h-[16px] flex items-center justify-center bg-red-500 text-white text-[10px] font-bold rounded-full px-1">
                      {totalUnread > 99 ? '99+' : totalUnread}
                    </span>
                  )}
                </div>
                <span className={`text-xs ${isActive ? 'text-[#0033FF] font-medium' : 'text-gray-500'}`}>
                  {app.name}
                </span>
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
  );
}

// Wrapper component for pages that need the unified sidebar
export function UnifiedLayout({ children, activeApp }: { children: React.ReactNode; activeApp?: AppId }) {
  return (
    <UnifiedSidebar activeApp={activeApp}>
      {children}
    </UnifiedSidebar>
  );
}
