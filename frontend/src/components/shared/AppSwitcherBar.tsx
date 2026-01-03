import Link from 'next/link';
import { useRouter } from 'next/router';
import {
  Home,
  Mail,
  Calendar,
  Video,
  FileText,
  type LucideIcon,
} from 'lucide-react';

export type AppId = 'dashboard' | 'mail' | 'calendar' | 'meet' | 'docs';

interface AppItem {
  id: AppId;
  name: string;
  icon: LucideIcon;
  href: string;
  gradient: string;
}

const apps: AppItem[] = [
  {
    id: 'dashboard',
    name: 'Dashboard',
    icon: Home,
    href: '/dashboard',
    gradient: 'from-blue-500 to-purple-600',
  },
  {
    id: 'mail',
    name: 'Mail',
    icon: Mail,
    href: '/mail',
    gradient: 'from-orange-500 to-red-500',
  },
  {
    id: 'calendar',
    name: 'Calendar',
    icon: Calendar,
    href: '/calendar',
    gradient: 'from-blue-500 to-cyan-500',
  },
  {
    id: 'meet',
    name: 'Meet',
    icon: Video,
    href: '/meet',
    gradient: 'from-green-500 to-emerald-500',
  },
  {
    id: 'docs',
    name: 'Docs',
    icon: FileText,
    href: '/docs',
    gradient: 'from-purple-500 to-pink-500',
  },
];

interface AppSwitcherBarProps {
  activeApp?: AppId;
}

export default function AppSwitcherBar({ activeApp }: AppSwitcherBarProps) {
  const router = useRouter();
  const currentApp = activeApp || detectActiveApp(router.pathname);

  return (
    <div className="fixed left-0 top-0 bottom-0 w-[60px] bg-slate-900 flex flex-col items-center py-3 gap-2 z-50">
      {/* Home button - separated */}
      <Link
        href="/dashboard"
        className={`w-11 h-11 rounded-xl flex items-center justify-center transition-all group relative ${
          currentApp === 'dashboard'
            ? 'bg-gradient-to-br from-blue-500 to-purple-600 text-white'
            : 'text-slate-400 hover:text-white hover:bg-slate-800'
        }`}
      >
        <Home size={22} />
        <Tooltip>Dashboard</Tooltip>
      </Link>

      <div className="w-8 h-px bg-slate-700 my-1" />

      {/* App buttons */}
      {apps.slice(1).map((app) => {
        const Icon = app.icon;
        const isActive = currentApp === app.id;

        return (
          <Link
            key={app.id}
            href={app.href}
            className={`w-11 h-11 rounded-xl flex items-center justify-center transition-all group relative ${
              isActive
                ? `bg-gradient-to-br ${app.gradient} text-white`
                : 'text-slate-400 hover:text-white hover:bg-slate-800'
            }`}
          >
            <Icon size={22} />
            <Tooltip>{app.name}</Tooltip>
          </Link>
        );
      })}
    </div>
  );
}

function Tooltip({ children }: { children: React.ReactNode }) {
  return (
    <div className="absolute left-full ml-3 px-2 py-1 bg-slate-800 text-white text-sm rounded-md whitespace-nowrap opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity z-50">
      {children}
      <div className="absolute right-full top-1/2 -translate-y-1/2 border-4 border-transparent border-r-slate-800" />
    </div>
  );
}

function detectActiveApp(pathname: string): AppId {
  if (pathname.startsWith('/mail')) return 'mail';
  if (pathname.startsWith('/calendar')) return 'calendar';
  if (pathname.startsWith('/meet')) return 'meet';
  if (pathname.startsWith('/docs')) return 'docs';
  return 'dashboard';
}
