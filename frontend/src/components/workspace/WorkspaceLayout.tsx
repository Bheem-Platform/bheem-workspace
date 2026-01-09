/**
 * WorkspaceLayout - Main layout with sidebar and navbar for user workspace
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
} from 'lucide-react';
import { useAuthStore } from '@/stores/authStore';

interface WorkspaceLayoutProps {
  children: ReactNode;
  title?: string;
}

const navigation = [
  { name: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
  { name: 'Mail', href: '/mail', icon: Mail },
  { name: 'Docs', href: '/docs', icon: FileText },
  { name: 'Calendar', href: '/calendar', icon: Calendar },
  { name: 'Meet', href: '/meet', icon: Video },
];

const secondaryNav = [
  { name: 'Settings', href: '/settings', icon: Settings },
  { name: 'Help', href: '/help', icon: HelpCircle },
];

export default function WorkspaceLayout({ children, title }: WorkspaceLayoutProps) {
  const router = useRouter();
  const { user, logout } = useAuthStore();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [userMenuOpen, setUserMenuOpen] = useState(false);

  const displayName = user?.username || 'User';
  const displayEmail = user?.email || '';
  const tenantName = 'Bheem Workspace';

  const handleLogout = () => {
    logout();
    router.push('/login');
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      router.push(`/search?q=${encodeURIComponent(searchQuery)}`);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Mobile sidebar overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`fixed top-0 left-0 z-50 h-full w-64 bg-white border-r border-gray-200 transform transition-transform lg:translate-x-0 ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        {/* Logo */}
        <div className="flex items-center justify-between h-16 px-4 border-b border-gray-200 bg-gradient-to-r from-blue-600 to-purple-600">
          <Link href="/dashboard" className="flex items-center space-x-3">
            <div className="w-9 h-9 bg-white/20 rounded-xl flex items-center justify-center">
              <span className="text-white font-bold text-lg">B</span>
            </div>
            <div>
              <span className="font-semibold text-white">Bheem</span>
              <p className="text-xs text-white/70">Workspace</p>
            </div>
          </Link>
          <button
            className="lg:hidden p-2 text-white/80 hover:text-white"
            onClick={() => setSidebarOpen(false)}
          >
            <X size={20} />
          </button>
        </div>

        {/* Tenant Badge */}
        <div className="px-4 py-3 border-b border-gray-100 bg-gray-50">
          <p className="text-xs text-gray-500 uppercase tracking-wider">Workspace</p>
          <p className="text-sm font-medium text-gray-900 truncate">{tenantName}</p>
        </div>

        {/* Main Navigation */}
        <nav className="p-4 space-y-1">
          <p className="px-3 mb-2 text-xs font-semibold text-gray-400 uppercase tracking-wider">
            Apps
          </p>
          {navigation.map((item) => {
            const isActive = router.pathname === item.href ||
              (item.href !== '/dashboard' && router.pathname.startsWith(item.href));
            return (
              <Link
                key={item.name}
                href={item.href}
                className={`flex items-center space-x-3 px-3 py-2.5 rounded-lg transition-colors ${
                  isActive
                    ? 'bg-blue-50 text-blue-700 font-medium'
                    : 'text-gray-700 hover:bg-gray-100'
                }`}
              >
                <item.icon size={20} className={isActive ? 'text-blue-600' : 'text-gray-500'} />
                <span>{item.name}</span>
              </Link>
            );
          })}
        </nav>

        {/* Secondary Navigation */}
        <div className="px-4 pt-4 border-t border-gray-100 mt-4">
          <p className="px-3 mb-2 text-xs font-semibold text-gray-400 uppercase tracking-wider">
            Account
          </p>
          {secondaryNav.map((item) => {
            const isActive = router.pathname.startsWith(item.href);
            return (
              <Link
                key={item.name}
                href={item.href}
                className={`flex items-center space-x-3 px-3 py-2.5 rounded-lg transition-colors ${
                  isActive
                    ? 'bg-gray-100 text-gray-900 font-medium'
                    : 'text-gray-600 hover:bg-gray-100'
                }`}
              >
                <item.icon size={20} className="text-gray-500" />
                <span>{item.name}</span>
              </Link>
            );
          })}

          {/* Admin Link if user has admin access */}
          {user?.role === 'admin' && (
            <Link
              href="/admin"
              className="flex items-center space-x-3 px-3 py-2.5 rounded-lg text-gray-600 hover:bg-gray-100 transition-colors"
            >
              <Shield size={20} className="text-gray-500" />
              <span>Admin Panel</span>
            </Link>
          )}
        </div>

        {/* User Card at Bottom */}
        <div className="absolute bottom-0 left-0 right-0 p-4 border-t border-gray-200 bg-white">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-purple-500 rounded-full flex items-center justify-center text-white font-medium">
              {displayName.charAt(0).toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-gray-900 truncate">{displayName}</p>
              <p className="text-xs text-gray-500 truncate">{displayEmail}</p>
            </div>
            <button
              onClick={handleLogout}
              className="p-2 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100"
              title="Logout"
            >
              <LogOut size={18} />
            </button>
          </div>
        </div>
      </aside>

      {/* Main content area */}
      <div className="lg:pl-64">
        {/* Top Navbar */}
        <header className="sticky top-0 z-30 bg-white border-b border-gray-200">
          <div className="flex items-center justify-between h-16 px-4 lg:px-6">
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
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
                <input
                  type="text"
                  placeholder="Search emails, documents, meetings..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-10 pr-4 py-2.5 bg-gray-100 border-0 rounded-xl text-sm focus:bg-white focus:ring-2 focus:ring-blue-500 transition-all"
                />
              </div>
            </form>

            {/* Right side actions */}
            <div className="flex items-center space-x-2 lg:space-x-3">
              {/* Notifications */}
              <button className="relative p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors">
                <Bell size={20} />
                <span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full" />
              </button>

              {/* User dropdown (desktop) */}
              <div className="hidden lg:block relative">
                <button
                  onClick={() => setUserMenuOpen(!userMenuOpen)}
                  className="flex items-center space-x-2 p-2 hover:bg-gray-100 rounded-lg transition-colors"
                >
                  <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-purple-500 rounded-full flex items-center justify-center text-white text-sm font-medium">
                    {displayName.charAt(0).toUpperCase()}
                  </div>
                  <span className="text-sm font-medium text-gray-700">{displayName.split(' ')[0]}</span>
                  <ChevronDown size={16} className="text-gray-400" />
                </button>

                {/* Dropdown menu */}
                {userMenuOpen && (
                  <>
                    <div className="fixed inset-0 z-10" onClick={() => setUserMenuOpen(false)} />
                    <div className="absolute right-0 mt-2 w-56 bg-white rounded-xl shadow-lg border border-gray-200 py-2 z-20">
                      <div className="px-4 py-2 border-b border-gray-100">
                        <p className="text-sm font-medium text-gray-900">{displayName}</p>
                        <p className="text-xs text-gray-500">{displayEmail}</p>
                      </div>
                      <Link
                        href="/settings/profile"
                        className="flex items-center space-x-2 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
                        onClick={() => setUserMenuOpen(false)}
                      >
                        <User size={16} />
                        <span>Profile</span>
                      </Link>
                      <Link
                        href="/settings"
                        className="flex items-center space-x-2 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
                        onClick={() => setUserMenuOpen(false)}
                      >
                        <Settings size={16} />
                        <span>Settings</span>
                      </Link>
                      {user?.role === 'admin' && (
                        <Link
                          href="/admin"
                          className="flex items-center space-x-2 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
                          onClick={() => setUserMenuOpen(false)}
                        >
                          <Shield size={16} />
                          <span>Admin Panel</span>
                        </Link>
                      )}
                      <div className="border-t border-gray-100 mt-2 pt-2">
                        <button
                          onClick={handleLogout}
                          className="flex items-center space-x-2 px-4 py-2 text-sm text-red-600 hover:bg-red-50 w-full"
                        >
                          <LogOut size={16} />
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

        {/* Page content */}
        <main className="p-4 lg:p-6">{children}</main>
      </div>
    </div>
  );
}
