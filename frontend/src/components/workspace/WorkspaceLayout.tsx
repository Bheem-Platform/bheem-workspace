/**
 * WorkspaceLayout - Modern Google Workspace-style layout
 * Unified sidebar with brand gradient: #FFCCF2 → #977DFF → #0033FF
 */
import { ReactNode, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/router';
import {
  LayoutDashboard,
  Mail,
  FileText,
  Calendar,
  Video,
  Settings,
  Menu,
  X,
  LogOut,
  Bell,
  Search,
  ChevronDown,
  User,
  HelpCircle,
  Shield,
  MessageCircle,
  HardDrive,
  ChevronLeft,
  ChevronRight,
  LayoutGrid,
  Table,
  Presentation,
  FormInput,
} from 'lucide-react';
import { useAuthStore } from '@/stores/authStore';
import { useSettingsStore, useShowAppNames, useCompactMode, useEnabledApps } from '@/stores/settingsStore';
import {
  BheemMailIcon,
  BheemCalendarIcon,
  BheemMeetIcon,
  BheemDocsIcon,
  BheemDriveIcon,
  BheemChatIcon,
  BheemDashboardIcon,
} from '@/components/shared/AppIcons';

// Brand colors
const BRAND = {
  pink: '#FFCCF2',
  purple: '#977DFF',
  blue: '#0033FF',
};

interface WorkspaceLayoutProps {
  children: ReactNode;
  title?: string;
  /** Optional secondary sidebar (app-specific like GmailSidebar, DocsSidebar) */
  secondarySidebar?: ReactNode;
  /** Width of secondary sidebar in pixels (default: 264) */
  secondarySidebarWidth?: number;
  /** Hide the top header bar */
  hideHeader?: boolean;
  /** Custom header component to replace the default */
  customHeader?: ReactNode;
}

const navigationItems = [
  { name: 'Dashboard', href: '/dashboard', icon: LayoutDashboard, bheemIcon: BheemDashboardIcon, appId: 'dashboard' },
  { name: 'Mail', href: '/mail', icon: Mail, bheemIcon: BheemMailIcon, appId: 'mail' },
  { name: 'Docs', href: '/docs', icon: FileText, bheemIcon: BheemDocsIcon, appId: 'docs' },
  { name: 'Sheets', href: '/sheets', icon: Table, appId: 'sheets' },
  { name: 'Slides', href: '/slides', icon: Presentation, appId: 'slides' },
  { name: 'Calendar', href: '/calendar', icon: Calendar, bheemIcon: BheemCalendarIcon, appId: 'calendar' },
  { name: 'Meet', href: '/meet', icon: Video, bheemIcon: BheemMeetIcon, appId: 'meet' },
  { name: 'Drive', href: '/drive', icon: HardDrive, bheemIcon: BheemDriveIcon, appId: 'drive' },
  { name: 'Chat', href: '/chat', icon: MessageCircle, bheemIcon: BheemChatIcon, appId: 'chat' },
  { name: 'Forms', href: '/oforms', icon: FormInput, appId: 'forms' },
];

export default function WorkspaceLayout({
  children,
  title,
  secondarySidebar,
  secondarySidebarWidth = 264,
  hideHeader = false,
  customHeader,
}: WorkspaceLayoutProps) {
  const router = useRouter();
  const { user, logout } = useAuthStore();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarExpanded, setSidebarExpanded] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [hoveredItem, setHoveredItem] = useState<string | null>(null);

  // Settings from store
  const showAppNames = useShowAppNames();
  const compactMode = useCompactMode();
  const enabledApps = useEnabledApps();

  // Filter navigation based on enabled apps
  const navigation = navigationItems.filter(
    (item) => item.appId === 'dashboard' || enabledApps[item.appId as keyof typeof enabledApps] !== false
  );

  const displayName = user?.username || 'User';
  const displayEmail = user?.email || '';

  const handleLogout = async () => {
    await logout();
    window.location.href = '/login';
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      router.push(`/search?q=${encodeURIComponent(searchQuery)}`);
    }
  };

  const isActive = (href: string) => {
    if (href === '/dashboard') return router.pathname === '/dashboard';
    return router.pathname.startsWith(href);
  };

  return (
    <div className={`min-h-screen bg-gray-50 flex ${compactMode ? 'compact-mode' : ''}`}>
      {/* Mobile sidebar overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/30 z-40 lg:hidden backdrop-blur-sm"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`
          fixed lg:sticky top-0 left-0 z-50 h-screen
          bg-white border-r border-gray-200
          transform transition-all duration-300 ease-in-out
          ${sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
          ${sidebarExpanded ? 'w-64' : 'w-[72px]'}
          flex flex-col
        `}
      >
        {/* Logo Header */}
        <div className="h-16 flex items-center justify-between px-4 border-b border-gray-100">
          <Link href="/dashboard" className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#FFCCF2] via-[#977DFF] to-[#0033FF] flex items-center justify-center shadow-lg flex-shrink-0">
              <span className="text-white font-bold text-lg">B</span>
            </div>
            {sidebarExpanded && (
              <span className="font-bold text-xl bg-gradient-to-r from-[#977DFF] to-[#0033FF] bg-clip-text text-transparent">
                Bheem
              </span>
            )}
          </Link>
          <button
            className="lg:hidden p-2 text-gray-500 hover:text-gray-700 rounded-lg hover:bg-gray-100"
            onClick={() => setSidebarOpen(false)}
          >
            <X size={20} />
          </button>
        </div>

        {/* Main Navigation */}
        <nav className="flex-1 py-4 px-2 overflow-y-auto">
          <div className="space-y-1">
            {navigation.map((item) => {
              const active = isActive(item.href);
              const hovered = hoveredItem === item.name;
              const BheemIcon = item.bheemIcon;
              const LucideIcon = item.icon;

              return (
                <div key={item.name} className="relative">
                  <Link
                    href={item.href}
                    onClick={() => setSidebarOpen(false)}
                    onMouseEnter={() => setHoveredItem(item.name)}
                    onMouseLeave={() => setHoveredItem(null)}
                    className={`
                      flex items-center gap-3 rounded-xl transition-all duration-200
                      ${sidebarExpanded ? 'px-3 py-2.5' : 'px-2 py-2.5 justify-center'}
                      ${active
                        ? 'bg-gradient-to-r from-[#FFCCF2]/30 via-[#977DFF]/20 to-[#0033FF]/10'
                        : 'hover:bg-gray-100'
                      }
                    `}
                  >
                    <div className={`flex-shrink-0 transition-transform duration-200 ${active || hovered ? 'scale-105' : ''}`}>
                      {active && BheemIcon ? (
                        <BheemIcon size={sidebarExpanded ? 28 : 32} />
                      ) : (
                        <div className={`
                          ${sidebarExpanded ? 'w-7 h-7' : 'w-8 h-8'}
                          rounded-lg flex items-center justify-center
                          ${active ? 'bg-gradient-to-br from-[#FFCCF2] via-[#977DFF] to-[#0033FF]' : hovered ? 'bg-gray-200' : 'bg-gray-100'}
                          transition-colors
                        `}>
                          <LucideIcon size={sidebarExpanded ? 16 : 18} className={active ? 'text-white' : 'text-gray-600'} />
                        </div>
                      )}
                    </div>
                    {sidebarExpanded && showAppNames && (
                      <span className={`font-medium text-sm ${active ? 'text-[#0033FF]' : 'text-gray-700'}`}>
                        {item.name}
                      </span>
                    )}
                  </Link>

                  {/* Tooltip for collapsed mode */}
                  {!sidebarExpanded && hovered && (
                    <div className="absolute left-full top-1/2 -translate-y-1/2 ml-3 z-50 pointer-events-none">
                      <div className="bg-gray-900 text-white px-3 py-1.5 rounded-lg text-sm font-medium whitespace-nowrap shadow-xl">
                        {item.name}
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
          {/* Expand/Collapse Toggle - Desktop only */}
          <button
            onClick={() => setSidebarExpanded(!sidebarExpanded)}
            className={`
              hidden lg:flex w-full items-center gap-3 rounded-xl py-2.5 transition-colors
              text-gray-500 hover:text-gray-700 hover:bg-gray-100
              ${sidebarExpanded ? 'px-3' : 'justify-center px-2'}
            `}
          >
            {sidebarExpanded ? (
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
            onMouseEnter={() => setHoveredItem('settings')}
            onMouseLeave={() => setHoveredItem(null)}
            className={`
              relative flex items-center gap-3 rounded-xl py-2.5 transition-colors
              text-gray-500 hover:text-gray-700 hover:bg-gray-100
              ${sidebarExpanded ? 'px-3' : 'justify-center px-2'}
            `}
          >
            <Settings size={20} />
            {sidebarExpanded && <span className="text-sm">Settings</span>}
            {!sidebarExpanded && hoveredItem === 'settings' && (
              <div className="absolute left-full top-1/2 -translate-y-1/2 ml-3 z-50 pointer-events-none">
                <div className="bg-gray-900 text-white px-3 py-1.5 rounded-lg text-sm font-medium whitespace-nowrap shadow-xl">
                  Settings
                </div>
              </div>
            )}
          </Link>

          {/* Admin Link */}
          {user?.role === 'admin' && (
            <Link
              href="/admin"
              onMouseEnter={() => setHoveredItem('admin')}
              onMouseLeave={() => setHoveredItem(null)}
              className={`
                relative flex items-center gap-3 rounded-xl py-2.5 transition-colors
                text-gray-500 hover:text-gray-700 hover:bg-gray-100
                ${sidebarExpanded ? 'px-3' : 'justify-center px-2'}
              `}
            >
              <Shield size={20} />
              {sidebarExpanded && <span className="text-sm">Admin</span>}
              {!sidebarExpanded && hoveredItem === 'admin' && (
                <div className="absolute left-full top-1/2 -translate-y-1/2 ml-3 z-50 pointer-events-none">
                  <div className="bg-gray-900 text-white px-3 py-1.5 rounded-lg text-sm font-medium whitespace-nowrap shadow-xl">
                    Admin Panel
                  </div>
                </div>
              )}
            </Link>
          )}

          {/* User Profile Card */}
          <div className={`
            pt-2 mt-2 border-t border-gray-100
            ${sidebarExpanded ? '' : 'flex justify-center'}
          `}>
            {sidebarExpanded ? (
              <div className="flex items-center gap-3 px-2 py-2">
                <div className="w-9 h-9 rounded-full bg-gradient-to-br from-[#FFCCF2] via-[#977DFF] to-[#0033FF] flex items-center justify-center text-white font-medium text-sm flex-shrink-0">
                  {displayName.charAt(0).toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 truncate">{displayName}</p>
                  <p className="text-xs text-gray-500 truncate">{displayEmail}</p>
                </div>
                <button
                  onClick={handleLogout}
                  className="p-1.5 text-gray-400 hover:text-red-500 rounded-lg hover:bg-red-50 transition-colors"
                  title="Logout"
                >
                  <LogOut size={18} />
                </button>
              </div>
            ) : (
              <button
                onClick={handleLogout}
                onMouseEnter={() => setHoveredItem('logout')}
                onMouseLeave={() => setHoveredItem(null)}
                className="relative p-2 text-gray-400 hover:text-red-500 rounded-lg hover:bg-red-50 transition-colors"
                title="Logout"
              >
                <LogOut size={20} />
                {hoveredItem === 'logout' && (
                  <div className="absolute left-full top-1/2 -translate-y-1/2 ml-3 z-50 pointer-events-none">
                    <div className="bg-gray-900 text-white px-3 py-1.5 rounded-lg text-sm font-medium whitespace-nowrap shadow-xl">
                      Logout
                    </div>
                  </div>
                )}
              </button>
            )}
          </div>
        </div>
      </aside>

      {/* Main content area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Custom Header or Default Top Navbar */}
        {customHeader ? (
          customHeader
        ) : !hideHeader && (
          <header className="sticky top-0 z-30 bg-white border-b border-gray-200 h-16 flex-shrink-0">
            <div className="flex items-center justify-between h-full px-4 lg:px-6">
              {/* Mobile menu button */}
              <button
                className="lg:hidden p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg"
                onClick={() => setSidebarOpen(true)}
              >
                <Menu size={24} />
              </button>

              {/* Page title (mobile) */}
              <h1 className="lg:hidden text-lg font-semibold text-gray-900">
                {title || 'Dashboard'}
              </h1>

              {/* Search bar */}
              <form onSubmit={handleSearch} className="hidden lg:block flex-1 max-w-xl">
                <div className="relative">
                  <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                  <input
                    type="text"
                    placeholder="Search in Bheem..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full pl-11 pr-4 py-2.5 bg-gray-100 border-0 rounded-full text-sm focus:bg-white focus:ring-2 focus:ring-[#977DFF]/50 transition-all"
                  />
                </div>
              </form>

              {/* Right side actions */}
              <div className="flex items-center space-x-2">
                {/* App Launcher */}
                <button className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-full transition-colors">
                  <LayoutGrid size={20} />
                </button>

                {/* Help */}
                <button className="hidden sm:flex p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-full transition-colors">
                  <HelpCircle size={20} />
                </button>

                {/* Notifications */}
                <button className="relative p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-full transition-colors">
                  <Bell size={20} />
                  <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-red-500 rounded-full" />
                </button>

                {/* User dropdown */}
                <div className="relative ml-2">
                  <button
                    onClick={() => setUserMenuOpen(!userMenuOpen)}
                    className="flex items-center gap-2 p-1 hover:bg-gray-100 rounded-full transition-colors"
                  >
                    <div className="w-8 h-8 rounded-full bg-gradient-to-br from-[#FFCCF2] via-[#977DFF] to-[#0033FF] flex items-center justify-center text-white text-sm font-medium">
                      {displayName.charAt(0).toUpperCase()}
                    </div>
                  </button>

                  {/* Dropdown menu */}
                  {userMenuOpen && (
                    <>
                      <div className="fixed inset-0 z-10" onClick={() => setUserMenuOpen(false)} />
                      <div className="absolute right-0 mt-2 w-64 bg-white rounded-2xl shadow-xl border border-gray-200 py-2 z-20 overflow-hidden">
                        <div className="px-4 py-3 border-b border-gray-100 bg-gradient-to-r from-[#FFCCF2]/10 via-[#977DFF]/10 to-[#0033FF]/10">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[#FFCCF2] via-[#977DFF] to-[#0033FF] flex items-center justify-center text-white font-medium">
                              {displayName.charAt(0).toUpperCase()}
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="font-medium text-gray-900 truncate">{displayName}</p>
                              <p className="text-xs text-gray-500 truncate">{displayEmail}</p>
                            </div>
                          </div>
                        </div>
                        <div className="py-1">
                          <Link
                            href="/settings/profile"
                            className="flex items-center gap-3 px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
                            onClick={() => setUserMenuOpen(false)}
                          >
                            <User size={18} className="text-gray-400" />
                            <span>Profile</span>
                          </Link>
                          <Link
                            href="/settings"
                            className="flex items-center gap-3 px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
                            onClick={() => setUserMenuOpen(false)}
                          >
                            <Settings size={18} className="text-gray-400" />
                            <span>Settings</span>
                          </Link>
                          {user?.role === 'admin' && (
                            <Link
                              href="/admin"
                              className="flex items-center gap-3 px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
                              onClick={() => setUserMenuOpen(false)}
                            >
                              <Shield size={18} className="text-gray-400" />
                              <span>Admin Panel</span>
                            </Link>
                          )}
                        </div>
                        <div className="border-t border-gray-100 pt-1">
                          <button
                            onClick={handleLogout}
                            className="flex items-center gap-3 px-4 py-2.5 text-sm text-red-600 hover:bg-red-50 w-full transition-colors"
                          >
                            <LogOut size={18} />
                            <span>Logout</span>
                          </button>
                        </div>
                      </div>
                    </>
                  )}
                </div>
              </div>
            </div>
          </header>
        )}

        {/* Content area with optional secondary sidebar */}
        <div className="flex-1 flex overflow-hidden">
          {/* Secondary Sidebar (app-specific) */}
          {secondarySidebar && (
            <div
              className="flex-shrink-0 bg-white border-r border-gray-200 h-full overflow-y-auto hidden lg:block"
              style={{ width: secondarySidebarWidth, maxWidth: secondarySidebarWidth, minWidth: secondarySidebarWidth }}
            >
              {secondarySidebar}
            </div>
          )}

          {/* Page content */}
          <main className={`flex-1 overflow-auto ${secondarySidebar ? '' : 'p-4 lg:p-6'} pb-20 lg:pb-6`}>
            {children}
          </main>
        </div>
      </div>

      {/* Mobile Bottom Navigation */}
      <nav className="lg:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 z-40 safe-area-pb">
        <div className="flex items-center justify-around py-1">
          {navigation.slice(0, 5).map((item) => {
            const active = isActive(item.href);
            const LucideIcon = item.icon;

            return (
              <Link
                key={item.name}
                href={item.href}
                className="flex flex-col items-center gap-0.5 px-3 py-2"
              >
                <div
                  className={`
                    w-10 h-10 rounded-xl flex items-center justify-center transition-all
                    ${active
                      ? 'bg-gradient-to-br from-[#FFCCF2] via-[#977DFF] to-[#0033FF] text-white'
                      : 'text-gray-500'
                    }
                  `}
                >
                  <LucideIcon size={20} />
                </div>
                <span className={`text-[10px] ${active ? 'text-[#0033FF] font-medium' : 'text-gray-500'}`}>
                  {item.name}
                </span>
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
  );
}

// Export for backwards compatibility
export { WorkspaceLayout };
