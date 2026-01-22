/**
 * AppSwitcherBar - Modern slim sidebar for Mail, Docs, etc.
 * Matches the unified WorkspaceLayout design
 * Brand gradient: #FFCCF2 → #977DFF → #0033FF
 */
import { useState } from 'react';
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
  type LucideIcon,
} from 'lucide-react';
import {
  BheemMailIcon,
  BheemCalendarIcon,
  BheemMeetIcon,
  BheemDocsIcon,
  BheemDriveIcon,
  BheemChatIcon,
  BheemDashboardIcon,
} from './AppIcons';

export type AppId = 'dashboard' | 'mail' | 'calendar' | 'meet' | 'docs' | 'drive' | 'chat';

interface AppItem {
  id: AppId;
  name: string;
  icon: LucideIcon;
  bheemIcon: React.ComponentType<{ size?: number; className?: string }>;
  href: string;
}

const apps: AppItem[] = [
  { id: 'dashboard', name: 'Dashboard', icon: Home, bheemIcon: BheemDashboardIcon, href: '/dashboard' },
  { id: 'mail', name: 'Mail', icon: Mail, bheemIcon: BheemMailIcon, href: '/mail' },
  { id: 'docs', name: 'Docs', icon: FileText, bheemIcon: BheemDocsIcon, href: '/docs' },
  { id: 'calendar', name: 'Calendar', icon: Calendar, bheemIcon: BheemCalendarIcon, href: '/calendar' },
  { id: 'meet', name: 'Meet', icon: Video, bheemIcon: BheemMeetIcon, href: '/meet' },
  { id: 'drive', name: 'Drive', icon: HardDrive, bheemIcon: BheemDriveIcon, href: '/drive' },
  { id: 'chat', name: 'Chat', icon: MessageSquare, bheemIcon: BheemChatIcon, href: '/chat' },
];

interface AppSwitcherBarProps {
  activeApp?: AppId;
}

export default function AppSwitcherBar({ activeApp }: AppSwitcherBarProps) {
  const router = useRouter();
  const currentApp = activeApp || detectActiveApp(router.pathname);
  const [hoveredApp, setHoveredApp] = useState<string | null>(null);

  return (
    <div className="fixed left-0 top-0 bottom-0 w-[72px] bg-white border-r border-gray-200 flex flex-col items-center py-3 z-50">
      {/* Logo */}
      <Link
        href="/dashboard"
        className="w-11 h-11 rounded-xl bg-gradient-to-br from-[#FFCCF2] via-[#977DFF] to-[#0033FF] flex items-center justify-center shadow-lg mb-4"
      >
        <span className="text-white font-bold text-lg">B</span>
      </Link>

      {/* App buttons */}
      <nav className="flex-1 flex flex-col items-center gap-1 overflow-y-auto py-2">
        {apps.map((app) => {
          const LucideIcon = app.icon;
          const BheemIcon = app.bheemIcon;
          const isActive = currentApp === app.id;
          const isHovered = hoveredApp === app.id;

          return (
            <div key={app.id} className="relative">
              <Link
                href={app.href}
                onMouseEnter={() => setHoveredApp(app.id)}
                onMouseLeave={() => setHoveredApp(null)}
                className={`
                  w-12 h-12 rounded-xl flex items-center justify-center transition-all duration-200
                  ${isActive
                    ? 'bg-gradient-to-r from-[#FFCCF2]/30 via-[#977DFF]/20 to-[#0033FF]/10'
                    : 'hover:bg-gray-100'
                  }
                `}
              >
                <div className={`transition-transform duration-200 ${isActive || isHovered ? 'scale-110' : ''}`}>
                  {isActive ? (
                    <BheemIcon size={32} />
                  ) : (
                    <div className={`
                      w-9 h-9 rounded-lg flex items-center justify-center
                      ${isHovered ? 'bg-gray-200' : 'bg-gray-100'}
                      transition-colors
                    `}>
                      <LucideIcon size={20} className="text-gray-600" />
                    </div>
                  )}
                </div>
              </Link>

              {/* Tooltip */}
              {isHovered && (
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
      </nav>

      {/* Settings at bottom */}
      <div className="mt-auto pt-2 border-t border-gray-100">
        <Link
          href="/settings"
          onMouseEnter={() => setHoveredApp('settings')}
          onMouseLeave={() => setHoveredApp(null)}
          className="relative w-12 h-12 rounded-xl flex items-center justify-center text-gray-500 hover:text-gray-700 hover:bg-gray-100 transition-colors"
        >
          <Settings size={22} />
          {hoveredApp === 'settings' && (
            <div className="absolute left-full top-1/2 -translate-y-1/2 ml-3 z-50 pointer-events-none">
              <div className="bg-gray-900 text-white px-3 py-1.5 rounded-lg text-sm font-medium whitespace-nowrap shadow-xl">
                Settings
              </div>
              <div className="absolute right-full top-1/2 -translate-y-1/2 border-4 border-transparent border-r-gray-900" />
            </div>
          )}
        </Link>
      </div>
    </div>
  );
}

function detectActiveApp(pathname: string): AppId {
  if (pathname.startsWith('/mail')) return 'mail';
  if (pathname.startsWith('/calendar')) return 'calendar';
  if (pathname.startsWith('/meet')) return 'meet';
  if (pathname.startsWith('/docs') || pathname.startsWith('/sheets') || pathname.startsWith('/slides')) return 'docs';
  if (pathname.startsWith('/drive')) return 'drive';
  if (pathname.startsWith('/chat')) return 'chat';
  return 'dashboard';
}
