/**
 * AppLauncher - Google-like app grid launcher
 * Shows all Bheem apps in a popup grid when clicked
 */
import { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/router';
import {
  LayoutGrid,
  Mail,
  Calendar,
  Video,
  FileText,
  HardDrive,
  MessageSquare,
  LayoutDashboard,
  Sheet,
  Presentation,
  FormInput,
  Film,
  Settings,
  Users,
  Shield
} from 'lucide-react';

interface AppItem {
  id: string;
  name: string;
  icon: React.ReactNode;
  href: string;
  gradient: string;
  description?: string;
}

const mainApps: AppItem[] = [
  {
    id: 'mail',
    name: 'Mail',
    icon: <Mail size={24} />,
    href: '/mail',
    gradient: 'from-red-500 to-orange-500',
    description: 'Email & Communication'
  },
  {
    id: 'calendar',
    name: 'Calendar',
    icon: <Calendar size={24} />,
    href: '/calendar',
    gradient: 'from-blue-500 to-cyan-500',
    description: 'Events & Scheduling'
  },
  {
    id: 'meet',
    name: 'Meet',
    icon: <Video size={24} />,
    href: '/meet',
    gradient: 'from-green-500 to-emerald-500',
    description: 'Video Meetings'
  },
  {
    id: 'docs',
    name: 'Docs',
    icon: <FileText size={24} />,
    href: '/docs',
    gradient: 'from-blue-600 to-blue-400',
    description: 'Documents'
  },
  {
    id: 'sheets',
    name: 'Sheets',
    icon: <Sheet size={24} />,
    href: '/sheets',
    gradient: 'from-green-600 to-green-400',
    description: 'Spreadsheets'
  },
  {
    id: 'slides',
    name: 'Slides',
    icon: <Presentation size={24} />,
    href: '/slides',
    gradient: 'from-yellow-500 to-orange-400',
    description: 'Presentations'
  },
  {
    id: 'forms',
    name: 'Forms',
    icon: <FormInput size={24} />,
    href: '/forms',
    gradient: 'from-purple-500 to-pink-500',
    description: 'Surveys & Forms'
  },
  {
    id: 'drive',
    name: 'Drive',
    icon: <HardDrive size={24} />,
    href: '/drive',
    gradient: 'from-yellow-500 to-amber-500',
    description: 'File Storage'
  },
  {
    id: 'chat',
    name: 'Chat',
    icon: <MessageSquare size={24} />,
    href: '/chat',
    gradient: 'from-emerald-500 to-teal-500',
    description: 'Team Messaging'
  },
  {
    id: 'videos',
    name: 'Videos',
    icon: <Film size={24} />,
    href: '/videos',
    gradient: 'from-red-600 to-pink-500',
    description: 'Video Library'
  },
  {
    id: 'dashboard',
    name: 'Dashboard',
    icon: <LayoutDashboard size={24} />,
    href: '/dashboard',
    gradient: 'from-indigo-500 to-purple-500',
    description: 'Overview'
  },
];

const adminApps: AppItem[] = [
  {
    id: 'admin',
    name: 'Admin',
    icon: <Settings size={24} />,
    href: '/admin',
    gradient: 'from-slate-600 to-slate-400',
    description: 'Workspace Settings'
  },
];

interface AppLauncherProps {
  variant?: 'light' | 'dark';
}

export default function AppLauncher({ variant = 'light' }: AppLauncherProps) {
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const router = useRouter();

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
                      className={`flex flex-col items-center gap-2 p-3 rounded-xl transition-all hover:bg-gray-50 ${
                        isActive ? 'bg-blue-50 ring-1 ring-blue-200' : ''
                      }`}
                    >
                      <div
                        className={`w-12 h-12 rounded-xl bg-gradient-to-br ${app.gradient} flex items-center justify-center text-white shadow-lg`}
                      >
                        {app.icon}
                      </div>
                      <span className={`text-xs font-medium truncate w-full text-center ${
                        isActive ? 'text-blue-600' : 'text-gray-700'
                      }`}>
                        {app.name}
                      </span>
                    </button>
                  );
                })}
              </div>

              {/* Admin Section */}
              <div className="mt-3 pt-3 border-t border-gray-100">
                <p className="text-xs text-gray-500 px-2 mb-2">Administration</p>
                <div className="grid grid-cols-3 gap-1">
                  {adminApps.map((app) => {
                    const isActive = currentPath.startsWith(app.href);
                    return (
                      <button
                        key={app.id}
                        onClick={() => handleAppClick(app.href)}
                        className={`flex flex-col items-center gap-2 p-3 rounded-xl transition-all hover:bg-gray-50 ${
                          isActive ? 'bg-blue-50 ring-1 ring-blue-200' : ''
                        }`}
                      >
                        <div
                          className={`w-12 h-12 rounded-xl bg-gradient-to-br ${app.gradient} flex items-center justify-center text-white shadow-lg`}
                        >
                          {app.icon}
                        </div>
                        <span className={`text-xs font-medium truncate w-full text-center ${
                          isActive ? 'text-blue-600' : 'text-gray-700'
                        }`}>
                          {app.name}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
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
