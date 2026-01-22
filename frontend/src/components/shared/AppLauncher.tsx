/**
 * AppLauncher - Google-like app grid launcher
 * Shows all Bheem apps in a popup grid when clicked
 * Uses Bheem brand colors with light gradients
 */
import { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/router';
import { LayoutGrid } from 'lucide-react';
import {
  BheemMailIcon,
  BheemCalendarIcon,
  BheemMeetIcon,
  BheemDocsIcon,
  BheemDriveIcon,
  BheemSheetsIcon,
  BheemSlidesIcon,
  BheemFormsIcon,
  BheemChatIcon,
  BheemVideosIcon,
  BheemDashboardIcon,
  BheemAdminIcon,
} from './AppIcons';
import { useAuthStore } from '@/stores/authStore';

interface AppItem {
  id: string;
  name: string;
  icon: React.ReactNode;
  href: string;
  description?: string;
}

const mainApps: AppItem[] = [
  {
    id: 'mail',
    name: 'Mail',
    icon: <BheemMailIcon size={40} />,
    href: '/mail',
    description: 'Email & Communication'
  },
  {
    id: 'calendar',
    name: 'Calendar',
    icon: <BheemCalendarIcon size={40} />,
    href: '/calendar',
    description: 'Events & Scheduling'
  },
  {
    id: 'meet',
    name: 'Meet',
    icon: <BheemMeetIcon size={40} />,
    href: '/meet',
    description: 'Video Meetings'
  },
  {
    id: 'docs',
    name: 'Docs',
    icon: <BheemDocsIcon size={40} />,
    href: '/docs',
    description: 'Documents'
  },
  {
    id: 'sheets',
    name: 'Sheets',
    icon: <BheemSheetsIcon size={40} />,
    href: '/sheets',
    description: 'Spreadsheets'
  },
  {
    id: 'slides',
    name: 'Slides',
    icon: <BheemSlidesIcon size={40} />,
    href: '/slides',
    description: 'Presentations'
  },
  {
    id: 'forms',
    name: 'Forms',
    icon: <BheemFormsIcon size={40} />,
    href: '/forms',
    description: 'Surveys & Forms'
  },
  {
    id: 'drive',
    name: 'Drive',
    icon: <BheemDriveIcon size={40} />,
    href: '/drive',
    description: 'File Storage'
  },
  {
    id: 'chat',
    name: 'Chat',
    icon: <BheemChatIcon size={40} />,
    href: '/chat',
    description: 'Team Messaging'
  },
  {
    id: 'videos',
    name: 'Videos',
    icon: <BheemVideosIcon size={40} />,
    href: '/videos',
    description: 'Video Library'
  },
  {
    id: 'dashboard',
    name: 'Dashboard',
    icon: <BheemDashboardIcon size={40} />,
    href: '/dashboard',
    description: 'Overview'
  },
];

// Admin apps - shown based on user role
const getAdminApps = (userRole: string | undefined): AppItem[] => {
  const apps: AppItem[] = [];

  // Super Admin sees Super Admin option
  if (userRole === 'SuperAdmin') {
    apps.push({
      id: 'super-admin',
      name: 'Super Admin',
      icon: <BheemAdminIcon size={40} />,
      href: '/super-admin',
      description: 'Platform Settings'
    });
  }

  // Tenant Admin (or any Admin role) sees Admin option
  if (userRole === 'Admin' || userRole === 'TenantAdmin' || userRole?.includes('Admin')) {
    // Don't show regular Admin for SuperAdmin - they have their own panel
    if (userRole !== 'SuperAdmin') {
      apps.push({
        id: 'admin',
        name: 'Admin',
        icon: <BheemAdminIcon size={40} />,
        href: '/admin',
        description: 'Workspace Settings'
      });
    }
  }

  return apps;
};

interface AppLauncherProps {
  variant?: 'light' | 'dark';
}

export default function AppLauncher({ variant = 'light' }: AppLauncherProps) {
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const router = useRouter();
  const user = useAuthStore((state) => state.user);

  // Get admin apps based on user role
  const adminApps = getAdminApps(user?.role);

  // Close menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        menuRef.current &&
        buttonRef.current &&
        !menuRef.current.contains(event.target as Node) &&
        !buttonRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Close on escape
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setIsOpen(false);
    };
    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, []);

  const handleAppClick = (href: string) => {
    setIsOpen(false);
    router.push(href);
  };

  const currentPath = router.pathname;

  return (
    <div className="relative">
      {/* Launcher Button */}
      <button
        ref={buttonRef}
        onClick={() => setIsOpen(!isOpen)}
        className={`p-2 rounded-full transition-colors ${
          variant === 'dark'
            ? 'hover:bg-white/10 text-white/80 hover:text-white'
            : 'hover:bg-gray-100 text-gray-600 hover:text-gray-900'
        }`}
        title="Bheem Apps"
      >
        <LayoutGrid size={22} />
      </button>

      {/* Dropdown Menu */}
      {isOpen && (
        <>
          {/* Backdrop for mobile */}
          <div
            className="fixed inset-0 z-40 bg-black/20 md:hidden"
            onClick={() => setIsOpen(false)}
          />

          {/* Menu */}
          <div
            ref={menuRef}
            className="absolute right-0 mt-2 w-[340px] bg-white rounded-2xl shadow-2xl border border-gray-200 z-50 overflow-hidden"
            style={{
              animation: 'fadeIn 0.15s ease-out',
            }}
          >
            {/* Header */}
            <div className="px-4 py-3 border-b border-gray-100">
              <h3 className="text-sm font-semibold text-gray-700">Bheem Apps</h3>
            </div>

            {/* Apps Grid */}
            <div className="p-3 max-h-[400px] overflow-y-auto">
              <div className="grid grid-cols-3 gap-1">
                {mainApps.map((app) => {
                  const isActive = currentPath.startsWith(app.href);
                  return (
                    <button
                      key={app.id}
                      onClick={() => handleAppClick(app.href)}
                      className={`flex flex-col items-center gap-2 p-3 rounded-xl transition-all hover:bg-gray-50 hover:scale-105 ${
                        isActive ? 'bg-purple-50 ring-1 ring-purple-200' : ''
                      }`}
                    >
                      <div className="w-12 h-12 flex items-center justify-center">
                        {app.icon}
                      </div>
                      <span className={`text-xs font-medium truncate w-full text-center ${
                        isActive ? 'text-purple-600' : 'text-gray-700'
                      }`}>
                        {app.name}
                      </span>
                    </button>
                  );
                })}
              </div>

              {/* Admin Section - Only show for admins */}
              {adminApps.length > 0 && (
                <div className="mt-3 pt-3 border-t border-gray-100">
                  <p className="text-xs text-gray-500 px-2 mb-2">Administration</p>
                  <div className="grid grid-cols-3 gap-1">
                    {adminApps.map((app) => {
                      const isActive = currentPath.startsWith(app.href);
                      return (
                        <button
                          key={app.id}
                          onClick={() => handleAppClick(app.href)}
                          className={`flex flex-col items-center gap-2 p-3 rounded-xl transition-all hover:bg-gray-50 hover:scale-105 ${
                            isActive ? 'bg-purple-50 ring-1 ring-purple-200' : ''
                          }`}
                        >
                          <div className="w-12 h-12 flex items-center justify-center">
                            {app.icon}
                          </div>
                          <span className={`text-xs font-medium truncate w-full text-center ${
                            isActive ? 'text-purple-600' : 'text-gray-700'
                          }`}>
                            {app.name}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="px-4 py-3 bg-gray-50 border-t border-gray-100">
              <button
                onClick={() => handleAppClick('/dashboard')}
                className="w-full text-center text-sm text-blue-600 hover:text-blue-700 font-medium"
              >
                Go to Dashboard
              </button>
            </div>
          </div>
        </>
      )}

      <style jsx>{`
        @keyframes fadeIn {
          from {
            opacity: 0;
            transform: translateY(-8px) scale(0.96);
          }
          to {
            opacity: 1;
            transform: translateY(0) scale(1);
          }
        }
      `}</style>
    </div>
  );
}
