import { useRouter } from 'next/router';
import Link from 'next/link';
import {
  FileText,
  Table,
  Presentation,
  Video,
  ClipboardList,
  Settings,
  HardDrive,
  Home,
  Star,
  Clock,
  type LucideIcon,
} from 'lucide-react';

export type DocTab = 'home' | 'docs' | 'sheets' | 'slides' | 'videos' | 'forms' | 'settings' | 'drive';

interface TabItem {
  id: DocTab;
  label: string;
  icon: LucideIcon;
  href: string;
  color: string;
  bgColor: string;
}

const tabs: TabItem[] = [
  {
    id: 'home',
    label: 'Home',
    icon: Home,
    href: '/docs',
    color: 'text-gray-600',
    bgColor: 'bg-gray-100',
  },
  {
    id: 'docs',
    label: 'Docs',
    icon: FileText,
    href: '/docs?type=docs',
    color: 'text-blue-600',
    bgColor: 'bg-blue-50',
  },
  {
    id: 'sheets',
    label: 'Sheets',
    icon: Table,
    href: '/sheets',
    color: 'text-green-600',
    bgColor: 'bg-green-50',
  },
  {
    id: 'slides',
    label: 'Slides',
    icon: Presentation,
    href: '/slides',
    color: 'text-yellow-600',
    bgColor: 'bg-yellow-50',
  },
  {
    id: 'videos',
    label: 'Videos',
    icon: Video,
    href: '/videos',
    color: 'text-red-600',
    bgColor: 'bg-red-50',
  },
  {
    id: 'forms',
    label: 'Forms',
    icon: ClipboardList,
    href: '/forms',
    color: 'text-purple-600',
    bgColor: 'bg-purple-50',
  },
  {
    id: 'settings',
    label: 'Settings',
    icon: Settings,
    href: '/docs/settings',
    color: 'text-gray-600',
    bgColor: 'bg-gray-100',
  },
  {
    id: 'drive',
    label: 'Drive',
    icon: HardDrive,
    href: '/drive',
    color: 'text-amber-600',
    bgColor: 'bg-amber-50',
  },
];

interface DocsTabBarProps {
  activeTab?: DocTab;
}

export default function DocsTabBar({ activeTab = 'home' }: DocsTabBarProps) {
  const router = useRouter();

  // Detect active tab from path
  const detectActiveTab = (): DocTab => {
    const path = router.pathname;
    const query = router.query;

    if (path === '/docs' && !query.type) return 'home';
    if (path === '/docs' && query.type === 'docs') return 'docs';
    if (path.startsWith('/docs/settings')) return 'settings';
    if (path.startsWith('/docs/editor')) return 'docs';
    if (path.startsWith('/sheets')) return 'sheets';
    if (path.startsWith('/slides')) return 'slides';
    if (path.startsWith('/videos')) return 'videos';
    if (path.startsWith('/forms')) return 'forms';
    if (path.startsWith('/drive')) return 'drive';
    return 'home';
  };

  const currentTab = activeTab || detectActiveTab();

  return (
    <div className="bg-white border-b border-gray-200">
      <div className="max-w-7xl mx-auto px-4">
        <nav className="flex items-center gap-1 overflow-x-auto py-2 -mb-px scrollbar-hide">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = currentTab === tab.id;

            return (
              <Link
                key={tab.id}
                href={tab.href}
                className={`
                  flex items-center gap-2 px-4 py-2.5 rounded-lg font-medium text-sm
                  whitespace-nowrap transition-all duration-200
                  ${isActive
                    ? `${tab.bgColor} ${tab.color} shadow-sm`
                    : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'
                  }
                `}
              >
                <Icon size={18} className={isActive ? tab.color : ''} />
                <span>{tab.label}</span>
              </Link>
            );
          })}
        </nav>
      </div>
    </div>
  );
}

// Quick Filter Pills for Home view
interface QuickFilterProps {
  activeFilter: 'recent' | 'starred' | 'all';
  onFilterChange: (filter: 'recent' | 'starred' | 'all') => void;
}

export function QuickFilters({ activeFilter, onFilterChange }: QuickFilterProps) {
  const filters = [
    { id: 'recent' as const, label: 'Recent', icon: Clock },
    { id: 'starred' as const, label: 'Starred', icon: Star },
    { id: 'all' as const, label: 'All', icon: FileText },
  ];

  return (
    <div className="flex items-center gap-2">
      {filters.map((filter) => {
        const Icon = filter.icon;
        const isActive = activeFilter === filter.id;

        return (
          <button
            key={filter.id}
            onClick={() => onFilterChange(filter.id)}
            className={`
              flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium
              transition-all duration-200
              ${isActive
                ? 'bg-blue-100 text-blue-700'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }
            `}
          >
            <Icon size={14} />
            <span>{filter.label}</span>
          </button>
        );
      })}
    </div>
  );
}

// Document Type Filter Pills
interface TypeFilterProps {
  selectedTypes: string[];
  onTypeToggle: (type: string) => void;
}

export function TypeFilters({ selectedTypes, onTypeToggle }: TypeFilterProps) {
  const types = [
    { id: 'docs', label: 'Docs', icon: FileText, color: 'blue' },
    { id: 'sheets', label: 'Sheets', icon: Table, color: 'green' },
    { id: 'slides', label: 'Slides', icon: Presentation, color: 'yellow' },
    { id: 'videos', label: 'Videos', icon: Video, color: 'red' },
    { id: 'forms', label: 'Forms', icon: ClipboardList, color: 'purple' },
  ];

  const colorMap: Record<string, { active: string; inactive: string }> = {
    blue: { active: 'bg-blue-100 text-blue-700 border-blue-200', inactive: 'border-gray-200' },
    green: { active: 'bg-green-100 text-green-700 border-green-200', inactive: 'border-gray-200' },
    yellow: { active: 'bg-yellow-100 text-yellow-700 border-yellow-200', inactive: 'border-gray-200' },
    red: { active: 'bg-red-100 text-red-700 border-red-200', inactive: 'border-gray-200' },
    purple: { active: 'bg-purple-100 text-purple-700 border-purple-200', inactive: 'border-gray-200' },
  };

  return (
    <div className="flex items-center gap-2 flex-wrap">
      <span className="text-sm text-gray-500 mr-1">Type:</span>
      {types.map((type) => {
        const Icon = type.icon;
        const isSelected = selectedTypes.includes(type.id);
        const colors = colorMap[type.color];

        return (
          <button
            key={type.id}
            onClick={() => onTypeToggle(type.id)}
            className={`
              flex items-center gap-1.5 px-3 py-1 rounded-full text-sm
              border transition-all duration-200
              ${isSelected ? colors.active : `${colors.inactive} text-gray-600 hover:bg-gray-50`}
            `}
          >
            <Icon size={14} />
            <span>{type.label}</span>
          </button>
        );
      })}
    </div>
  );
}
