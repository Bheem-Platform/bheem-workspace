import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/router';
import {
  Home,
  Mail,
  Calendar,
  Video,
  FileText,
  Settings,
  LogOut,
  ChevronRight,
  type LucideIcon,
} from 'lucide-react';
import { useAuthStore } from '@/stores/authStore';

export type AppId = 'dashboard' | 'mail' | 'calendar' | 'meet' | 'docs';

interface AppItem {
  id: AppId;
  name: string;
  icon: LucideIcon;
  href: string;
  gradient: string;
  description: string;
}

const apps: AppItem[] = [
  {
    id: 'dashboard',
    name: 'Dashboard',
    icon: Home,
    href: '/dashboard',
    gradient: 'from-blue-500 to-purple-600',
    description: 'Overview & quick access',
  },
  {
    id: 'mail',
    name: 'Mail',
    icon: Mail,
    href: '/mail',
    gradient: 'from-orange-500 to-red-500',
    description: 'Email & messaging',
  },
  {
    id: 'calendar',
    name: 'Calendar',
    icon: Calendar,
    href: '/calendar',
    gradient: 'from-blue-500 to-cyan-500',
    description: 'Events & scheduling',
  },
  {
    id: 'meet',
    name: 'Meet',
    icon: Video,
    href: '/meet',
    gradient: 'from-green-500 to-emerald-500',
    description: 'Video conferencing',
  },
  {
    id: 'docs',
    name: 'Docs',
    icon: FileText,
    href: '/docs',
    gradient: 'from-purple-500 to-pink-500',
    description: 'Files & documents',
  },
];

interface AppSwitcherProps {
  activeApp?: AppId;
  collapsed?: boolean;
  onToggleCollapse?: () => void;
}

export default function AppSwitcher({
  activeApp,
  collapsed = false,
  onToggleCollapse,
}: AppSwitcherProps) {
  const router = useRouter();
  const { logout } = useAuthStore();
  const [hoveredApp, setHoveredApp] = useState<string | null>(null);

  // Auto-detect active app from route if not provided
  const currentApp = activeApp || detectActiveApp(router.pathname);

  const handleLogout = async () => {
    await logout();
    router.push('/login');
  };

  return (
    <div
      className={`fixed left-0 top-0 bottom-0 z-40 flex flex-col bg-slate-900 transition-all duration-300 ${
        collapsed ? 'w-16' : 'w-60'
      }`}
    >
      {/* Logo */}
      <div className="flex items-center h-16 px-4 border-b border-slate-800">
        <Link href="/dashboard" className="flex items-center gap-3">
          <div className="w-9 h-9 bg-gradient-to-br from-blue-500 to-purple-600 rounded-xl flex items-center justify-center flex-shrink-0">
            <span className="text-white font-bold text-lg">B</span>
          </div>
          {!collapsed && (
            <span className="text-white font-semibold text-lg">Bheem</span>
          )}
        </Link>
      </div>

      {/* Apps Navigation */}
      <nav className="flex-1 py-4 px-2 overflow-y-auto">
        <div className="space-y-1">
          {apps.map((app) => {
            const Icon = app.icon;
            const isActive = currentApp === app.id;
            const isHovered = hoveredApp === app.id;

            return (
              <div key={app.id} className="relative">
                <Link
                  href={app.href}
                  onMouseEnter={() => setHoveredApp(app.id)}
                  onMouseLeave={() => setHoveredApp(null)}
                  className={`
                    flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-200
                    ${
                      isActive
                        ? `bg-gradient-to-r ${app.gradient} text-white shadow-lg`
                        : 'text-slate-400 hover:text-white hover:bg-slate-800'
                    }
                  `}
                >
                  <div
                    className={`
                      w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0
                      ${
                        isActive
                          ? 'bg-white/20'
                          : 'bg-slate-800 group-hover:bg-slate-700'
                      }
                    `}
                  >
                    <Icon size={20} />
                  </div>
                  {!collapsed && (
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-sm">{app.name}</div>
                      <div
                        className={`text-xs truncate ${
                          isActive ? 'text-white/70' : 'text-slate-500'
                        }`}
                      >
                        {app.description}
                      </div>
                    </div>
                  )}
                </Link>

                {/* Tooltip for collapsed mode */}
                {collapsed && isHovered && (
                  <div className="absolute left-full top-1/2 -translate-y-1/2 ml-2 z-50">
                    <div className="bg-slate-800 text-white px-3 py-2 rounded-lg shadow-xl whitespace-nowrap">
                      <div className="font-medium text-sm">{app.name}</div>
                      <div className="text-xs text-slate-400">
                        {app.description}
                      </div>
                    </div>
                    <div className="absolute right-full top-1/2 -translate-y-1/2 border-8 border-transparent border-r-slate-800" />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </nav>

      {/* Bottom Actions */}
      <div className="p-2 border-t border-slate-800">
        {/* Collapse Toggle */}
        {onToggleCollapse && (
          <button
            onClick={onToggleCollapse}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <div className="w-9 h-9 rounded-lg bg-slate-800 flex items-center justify-center">
              <ChevronRight
                size={20}
                className={`transition-transform ${collapsed ? '' : 'rotate-180'}`}
              />
            </div>
            {!collapsed && <span className="text-sm">Collapse</span>}
          </button>
        )}

        {/* Settings */}
        <Link
          href="/settings"
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
        >
          <div className="w-9 h-9 rounded-lg bg-slate-800 flex items-center justify-center">
            <Settings size={20} />
          </div>
          {!collapsed && <span className="text-sm">Settings</span>}
        </Link>

        {/* Logout */}
        <button
          onClick={handleLogout}
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-slate-400 hover:text-red-400 hover:bg-slate-800 transition-colors"
        >
          <div className="w-9 h-9 rounded-lg bg-slate-800 flex items-center justify-center">
            <LogOut size={20} />
          </div>
          {!collapsed && <span className="text-sm">Logout</span>}
        </button>
      </div>
    </div>
  );
}

// Helper function to detect active app from route
function detectActiveApp(pathname: string): AppId {
  if (pathname.startsWith('/mail')) return 'mail';
  if (pathname.startsWith('/calendar')) return 'calendar';
  if (pathname.startsWith('/meet')) return 'meet';
  if (pathname.startsWith('/docs')) return 'docs';
  return 'dashboard';
}

// Compact version for mobile/tablet
export function AppSwitcherCompact({ activeApp }: { activeApp?: AppId }) {
  const router = useRouter();
  const currentApp = activeApp || detectActiveApp(router.pathname);

  return (
    <div className="fixed bottom-0 left-0 right-0 z-40 bg-slate-900 border-t border-slate-800 safe-area-pb">
      <nav className="flex items-center justify-around py-2">
        {apps.slice(0, 5).map((app) => {
          const Icon = app.icon;
          const isActive = currentApp === app.id;

          return (
            <Link
              key={app.id}
              href={app.href}
              className={`flex flex-col items-center gap-1 px-3 py-2 rounded-xl transition-colors ${
                isActive ? 'text-white' : 'text-slate-500'
              }`}
            >
              <div
                className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                  isActive
                    ? `bg-gradient-to-r ${app.gradient}`
                    : 'bg-slate-800'
                }`}
              >
                <Icon size={20} />
              </div>
              <span className="text-xs font-medium">{app.name}</span>
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
