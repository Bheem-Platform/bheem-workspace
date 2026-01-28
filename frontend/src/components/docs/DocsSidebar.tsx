/**
 * Google Docs-like Sidebar
 * Features: Create New, Document Types (Docs, Sheets, Slides, Videos, Forms), Quick Access, Bheem Apps
 */
import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/router';
import {
  Plus,
  FileText,
  Table,
  Presentation,
  Video,
  ClipboardList,
  Home,
  Clock,
  Star,
  Users,
  Trash2,
  HardDrive,
  Settings,
  ChevronDown,
  ChevronRight,
  FolderOpen,
  Upload,
  FilePlus,
  LayoutTemplate,
} from 'lucide-react';
import * as productivityApi from '@/lib/productivityApi';

// Document Types configuration
const DOC_TYPES = [
  { id: 'home', name: 'Home', icon: Home, href: '/docs', color: 'text-gray-600' },
  { id: 'docs', name: 'Documents', icon: FileText, href: '/docs?type=docs', color: 'text-blue-600' },
  { id: 'sheets', name: 'Spreadsheets', icon: Table, href: '/sheets', color: 'text-green-600' },
  { id: 'slides', name: 'Presentations', icon: Presentation, href: '/slides', color: 'text-yellow-600' },
  { id: 'videos', name: 'Videos', icon: Video, href: '/videos', color: 'text-red-600' },
  { id: 'forms', name: 'Survey Forms', icon: ClipboardList, href: '/forms', color: 'text-purple-600' },
  { id: 'oforms', name: 'Document Forms', icon: FileText, href: '/oforms', color: 'text-violet-600' },
];

// Quick Access items
const QUICK_ACCESS = [
  { id: 'recent', name: 'Recent', icon: Clock, color: 'text-gray-500' },
  { id: 'starred', name: 'Starred', icon: Star, color: 'text-amber-500' },
  { id: 'shared', name: 'Shared with me', icon: Users, color: 'text-blue-500' },
  { id: 'trash', name: 'Trash', icon: Trash2, color: 'text-gray-500' },
];

// Bheem Apps
const BHEEM_APPS = [
  { id: 'drive', name: 'Bheem Drive', icon: '☁️', href: '/drive' },
  { id: 'mail', name: 'Bheem Mail', icon: '✉️', href: '/mail' },
  { id: 'calendar', name: 'Calendar', icon: '📅', href: '/calendar' },
  { id: 'meet', name: 'Bheem Meet', icon: '🎥', href: '/meet' },
];

interface DocsSidebarProps {
  activeType?: string;
  activeQuickAccess?: string;
  onQuickAccessChange?: (id: string) => void;
  onCreateNew?: () => void;
  onUpload?: () => void;
}

export default function DocsSidebar({
  activeType = 'home',
  activeQuickAccess,
  onQuickAccessChange,
  onCreateNew,
  onUpload,
}: DocsSidebarProps) {
  const router = useRouter();
  const [typesExpanded, setTypesExpanded] = useState(true);
  const [quickAccessExpanded, setQuickAccessExpanded] = useState(true);
  const [appsExpanded, setAppsExpanded] = useState(true);
  const [showCreateMenu, setShowCreateMenu] = useState(false);
  const [stats, setStats] = useState<productivityApi.ProductivityStats | null>(null);

  // Detect active type from URL
  const detectActiveType = (): string => {
    const path = router.pathname;
    const query = router.query;

    if (path.startsWith('/sheets')) return 'sheets';
    if (path.startsWith('/slides')) return 'slides';
    if (path.startsWith('/videos')) return 'videos';
    if (path.startsWith('/oforms')) return 'oforms';
    if (path.startsWith('/forms')) return 'forms';
    if (path === '/docs' && query.type === 'docs') return 'docs';
    if (path === '/docs') return 'home';
    if (path.startsWith('/docs')) return 'docs';
    return 'home';
  };

  const currentType = activeType || detectActiveType();

  // Fetch stats
  useEffect(() => {
    const fetchStats = async () => {
      try {
        const data = await productivityApi.getProductivityStats();
        setStats(data);
      } catch (error) {
        console.error('Failed to fetch stats:', error);
      }
    };
    fetchStats();
  }, []);

  const getTypeCount = (typeId: string): number => {
    if (!stats) return 0;
    switch (typeId) {
      case 'docs': return stats.docs;
      case 'sheets': return stats.sheets;
      case 'slides': return stats.slides;
      case 'videos': return stats.videos;
      case 'forms': return stats.forms;
      case 'home': return stats.total;
      default: return 0;
    }
  };

  const handleCreateOption = (option: string) => {
    setShowCreateMenu(false);
    switch (option) {
      case 'doc':
        router.push('/docs/editor/new');
        break;
      case 'sheet':
        router.push('/sheets/new');
        break;
      case 'slide':
        router.push('/slides/new');
        break;
      case 'form':
        router.push('/forms/new');
        break;
      case 'upload':
        onUpload?.();
        break;
      case 'folder':
        // Handled by parent
        break;
    }
  };

  return (
    <div className="h-full flex flex-col bg-white border-r border-gray-200">
      {/* Create New Button */}
      <div className="p-4">
        <div className="relative">
          <button
            onClick={() => setShowCreateMenu(!showCreateMenu)}
            className="w-full flex items-center justify-center gap-2 px-6 py-3 bg-white border-2 border-gray-200 rounded-2xl hover:bg-[#FFCCF2]/10 hover:border-[#977DFF] hover:shadow-md transition-all group"
          >
            <Plus size={20} className="text-gray-600 group-hover:text-[#977DFF]" />
            <span className="font-medium text-gray-700 group-hover:text-gray-900">New</span>
          </button>

          {/* Create Menu Dropdown */}
          {showCreateMenu && (
            <>
              <div
                className="fixed inset-0 z-10"
                onClick={() => setShowCreateMenu(false)}
              />
              <div className="absolute left-0 right-0 mt-2 bg-white rounded-xl shadow-lg border border-gray-200 py-2 z-20">
                <button
                  onClick={() => handleCreateOption('doc')}
                  className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-gray-50 text-left"
                >
                  <FileText size={18} className="text-blue-500" />
                  <div>
                    <p className="font-medium text-gray-900">Document</p>
                    <p className="text-xs text-gray-500">Create a new document</p>
                  </div>
                </button>
                <button
                  onClick={() => handleCreateOption('sheet')}
                  className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-gray-50 text-left"
                >
                  <Table size={18} className="text-green-500" />
                  <div>
                    <p className="font-medium text-gray-900">Spreadsheet</p>
                    <p className="text-xs text-gray-500">Create a new spreadsheet</p>
                  </div>
                </button>
                <button
                  onClick={() => handleCreateOption('slide')}
                  className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-gray-50 text-left"
                >
                  <Presentation size={18} className="text-yellow-500" />
                  <div>
                    <p className="font-medium text-gray-900">Presentation</p>
                    <p className="text-xs text-gray-500">Create a new presentation</p>
                  </div>
                </button>
                <button
                  onClick={() => handleCreateOption('form')}
                  className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-gray-50 text-left"
                >
                  <ClipboardList size={18} className="text-purple-500" />
                  <div>
                    <p className="font-medium text-gray-900">Form</p>
                    <p className="text-xs text-gray-500">Create a new form</p>
                  </div>
                </button>
                <div className="border-t border-gray-100 my-1" />
                <button
                  onClick={() => handleCreateOption('upload')}
                  className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-gray-50 text-left"
                >
                  <Upload size={18} className="text-gray-500" />
                  <div>
                    <p className="font-medium text-gray-900">File upload</p>
                    <p className="text-xs text-gray-500">Upload files from your computer</p>
                  </div>
                </button>
                <button
                  onClick={() => {
                    setShowCreateMenu(false);
                    onCreateNew?.();
                  }}
                  className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-gray-50 text-left"
                >
                  <FolderOpen size={18} className="text-gray-500" />
                  <div>
                    <p className="font-medium text-gray-900">Folder</p>
                    <p className="text-xs text-gray-500">Create a new folder</p>
                  </div>
                </button>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Document Types Section */}
      <div className="px-2">
        <button
          onClick={() => setTypesExpanded(!typesExpanded)}
          className="w-full flex items-center gap-2 px-3 py-2 text-xs font-semibold text-gray-500 uppercase tracking-wider hover:bg-gray-50 rounded-lg"
        >
          {typesExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
          Document Types
        </button>

        {typesExpanded && (
          <div className="space-y-0.5 mt-1">
            {DOC_TYPES.map((type) => {
              const Icon = type.icon;
              const isActive = currentType === type.id && !activeQuickAccess;
              const count = getTypeCount(type.id);

              return (
                <Link
                  key={type.id}
                  href={type.href}
                  className={`
                    w-full flex items-center gap-3 px-3 py-2 rounded-r-full transition-all
                    ${isActive
                      ? 'bg-[#FFCCF2]/30 text-[#0033FF] font-medium'
                      : 'text-gray-700 hover:bg-[#FFCCF2]/10'
                    }
                  `}
                >
                  <Icon size={18} className={isActive ? 'text-[#977DFF]' : type.color} />
                  <span className="flex-1 text-left text-sm">{type.name}</span>
                  {count > 0 && (
                    <span className={`text-xs ${isActive ? 'text-[#0033FF]' : 'text-gray-400'}`}>
                      {count}
                    </span>
                  )}
                </Link>
              );
            })}
          </div>
        )}
      </div>

      {/* Divider */}
      <div className="my-3 mx-4 border-t border-gray-200" />

      {/* Quick Access Section */}
      <div className="flex-1 overflow-y-auto px-2">
        <button
          onClick={() => setQuickAccessExpanded(!quickAccessExpanded)}
          className="w-full flex items-center gap-2 px-3 py-2 text-xs font-semibold text-gray-500 uppercase tracking-wider hover:bg-gray-50 rounded-lg"
        >
          {quickAccessExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
          Quick Access
        </button>

        {quickAccessExpanded && (
          <div className="space-y-0.5 mt-1">
            {QUICK_ACCESS.map((item) => {
              const Icon = item.icon;
              const isActive = activeQuickAccess === item.id;

              return (
                <button
                  key={item.id}
                  onClick={() => onQuickAccessChange?.(item.id)}
                  className={`
                    w-full flex items-center gap-3 px-3 py-2 rounded-r-full transition-all
                    ${isActive
                      ? 'bg-[#FFCCF2]/30 text-[#0033FF] font-medium'
                      : 'text-gray-600 hover:bg-[#FFCCF2]/10'
                    }
                  `}
                >
                  <Icon size={16} className={isActive ? 'text-[#977DFF]' : item.color} />
                  <span className="flex-1 text-left text-sm">{item.name}</span>
                </button>
              );
            })}
          </div>
        )}

        {/* Divider */}
        <div className="my-3 mx-2 border-t border-gray-200" />

        {/* Bheem Apps Section */}
        <button
          onClick={() => setAppsExpanded(!appsExpanded)}
          className="w-full flex items-center gap-2 px-3 py-2 text-xs font-semibold text-gray-500 uppercase tracking-wider hover:bg-gray-50 rounded-lg"
        >
          {appsExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
          Bheem Apps
        </button>

        {appsExpanded && (
          <div className="space-y-0.5 mt-1">
            {BHEEM_APPS.map((app) => (
              <Link
                key={app.id}
                href={app.href}
                className="w-full flex items-center gap-3 px-3 py-2 rounded-r-full text-gray-600 hover:bg-gray-100 transition-all"
              >
                <span className="text-base w-5 text-center">{app.icon}</span>
                <span className="flex-1 text-left text-sm">{app.name}</span>
              </Link>
            ))}
          </div>
        )}

        {/* Settings Link */}
        <div className="mt-3">
          <Link
            href="/docs/settings"
            className="w-full flex items-center gap-3 px-3 py-2 rounded-r-full text-gray-600 hover:bg-gray-100 transition-all"
          >
            <Settings size={16} className="text-gray-500" />
            <span className="flex-1 text-left text-sm">Settings</span>
          </Link>
        </div>
      </div>

      {/* Storage Indicator */}
      <div className="p-4 border-t border-gray-200">
        <div className="flex items-center gap-2 mb-2">
          <HardDrive size={16} className="text-gray-500" />
          <span className="text-sm text-gray-600">Storage</span>
        </div>
        <div className="w-full bg-gray-200 rounded-full h-1.5 mb-1">
          <div className="bg-gradient-to-r from-[#FFCCF2] via-[#977DFF] to-[#0033FF] h-1.5 rounded-full" style={{ width: '25%' }} />
        </div>
        <p className="text-xs text-gray-500">2.5 GB of 15 GB used</p>
        <Link
          href="/drive"
          className="text-xs text-[#977DFF] hover:text-[#0033FF] hover:underline mt-1 inline-block"
        >
          Manage storage
        </Link>
      </div>
    </div>
  );
}
