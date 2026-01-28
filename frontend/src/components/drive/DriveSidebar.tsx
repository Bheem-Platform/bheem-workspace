/**
 * Bheem Drive - Google Drive-like Sidebar
 * Navigation: Home, Activity, Workspace, My Drive, Shared Drives, Recent, Starred, Shared with me, Spam, Trash, Storage
 */
import { useState, useEffect } from 'react';
import {
  Home,
  Activity,
  Building2,
  HardDrive,
  Users,
  Clock,
  Star,
  UserPlus,
  AlertTriangle,
  Trash2,
  Cloud,
  Plus,
  FolderPlus,
  FileUp,
  FolderUp,
  ChevronDown,
  ChevronRight,
  FileText,
  Image,
  Film,
  Music,
  Archive,
  FileSpreadsheet,
  Presentation,
} from 'lucide-react';
import { useDriveStore } from '@/stores/driveStore';
import { formatFileSize } from '@/lib/driveApi';

interface SharedDrive {
  id: string;
  name: string;
}

interface DriveSidebarProps {
  onNewFolder: () => void;
  onUpload: () => void;
}

type ActiveSection =
  | 'home'
  | 'activity'
  | 'workspace'
  | 'my-drive'
  | 'shared-drives'
  | 'recent'
  | 'starred'
  | 'shared-with-me'
  | 'spam'
  | 'trash';

export default function DriveSidebar({ onNewFolder, onUpload }: DriveSidebarProps) {
  const {
    activeFilter,
    setActiveFilter,
    fetchFiles,
    fetchRecentFiles,
    fetchStarredFiles,
    fetchTrashFiles,
    fetchHomeFiles,
    fetchWorkspaceFiles,
    fetchSharedWithMe,
    fetchSpamFiles,
    navigateToFolder,
    storageUsed,
    storageTotal,
  } = useDriveStore();

  const [showNewMenu, setShowNewMenu] = useState(false);
  const [sharedDrivesExpanded, setSharedDrivesExpanded] = useState(true);
  const [sharedDrives, setSharedDrives] = useState<SharedDrive[]>([]);
  const [activeSection, setActiveSection] = useState<ActiveSection>('my-drive');

  // Calculate storage percentage
  const storagePercentage = storageTotal > 0 ? (storageUsed / storageTotal) * 100 : 0;

  const handleNavigation = (section: ActiveSection) => {
    setActiveSection(section);

    switch (section) {
      case 'home':
        fetchHomeFiles();
        break;
      case 'activity':
        setActiveFilter('activity');
        break;
      case 'workspace':
        fetchWorkspaceFiles();
        break;
      case 'my-drive':
        setActiveFilter('all');
        navigateToFolder(null);
        break;
      case 'recent':
        fetchRecentFiles();
        break;
      case 'starred':
        fetchStarredFiles();
        break;
      case 'shared-with-me':
        fetchSharedWithMe();
        break;
      case 'spam':
        fetchSpamFiles();
        break;
      case 'trash':
        fetchTrashFiles();
        break;
    }
  };

  const navItems = [
    { id: 'home' as ActiveSection, icon: Home, label: 'Home' },
    { id: 'activity' as ActiveSection, icon: Activity, label: 'Activity' },
  ];

  const mainNavItems = [
    { id: 'workspace' as ActiveSection, icon: Building2, label: 'Workspace' },
    { id: 'my-drive' as ActiveSection, icon: HardDrive, label: 'My Drive' },
  ];

  const secondaryNavItems = [
    { id: 'recent' as ActiveSection, icon: Clock, label: 'Recent' },
    { id: 'starred' as ActiveSection, icon: Star, label: 'Starred' },
    { id: 'shared-with-me' as ActiveSection, icon: UserPlus, label: 'Shared with me' },
    { id: 'spam' as ActiveSection, icon: AlertTriangle, label: 'Spam' },
    { id: 'trash' as ActiveSection, icon: Trash2, label: 'Trash' },
  ];

  return (
    <aside className="w-64 h-full bg-white border-r border-gray-200 flex flex-col overflow-hidden">
      {/* New Button */}
      <div className="p-4">
        <div className="relative">
          <button
            onClick={() => setShowNewMenu(!showNewMenu)}
            className="w-full flex items-center gap-3 px-6 py-3 bg-white border-2 border-gray-200 rounded-2xl hover:bg-[#FFCCF2]/10 hover:border-[#977DFF] hover:shadow-md transition-all group"
          >
            <Plus size={20} className="text-gray-600 group-hover:text-[#977DFF]" />
            <span className="font-medium text-gray-700 group-hover:text-gray-900">New</span>
          </button>

          {showNewMenu && (
            <>
              <div className="fixed inset-0 z-10" onClick={() => setShowNewMenu(false)} />
              <div className="absolute left-0 top-full mt-2 w-56 bg-white rounded-xl shadow-lg border border-gray-200 py-2 z-20">
                <button
                  onClick={() => {
                    onNewFolder();
                    setShowNewMenu(false);
                  }}
                  className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-gray-50 text-left"
                >
                  <FolderPlus size={20} className="text-gray-500" />
                  <span>New folder</span>
                </button>
                <hr className="my-2" />
                <button
                  onClick={() => {
                    onUpload();
                    setShowNewMenu(false);
                  }}
                  className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-gray-50 text-left"
                >
                  <FileUp size={20} className="text-gray-500" />
                  <span>File upload</span>
                </button>
                <button
                  onClick={() => {
                    onUpload();
                    setShowNewMenu(false);
                  }}
                  className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-gray-50 text-left"
                >
                  <FolderUp size={20} className="text-gray-500" />
                  <span>Folder upload</span>
                </button>
                <hr className="my-2" />
                <button className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-gray-50 text-left">
                  <FileText size={20} className="text-blue-500" />
                  <span>Bheem Docs</span>
                </button>
                <button className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-gray-50 text-left">
                  <FileSpreadsheet size={20} className="text-green-500" />
                  <span>Bheem Sheets</span>
                </button>
                <button className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-gray-50 text-left">
                  <Presentation size={20} className="text-yellow-500" />
                  <span>Bheem Slides</span>
                </button>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Navigation */}
      <div className="flex-1 overflow-y-auto px-2 pb-4">
        {/* Top Nav: Home, Activity */}
        <nav className="space-y-0.5 mb-4">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeSection === item.id;
            return (
              <button
                key={item.id}
                onClick={() => handleNavigation(item.id)}
                className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-full text-left transition-colors ${
                  isActive
                    ? 'bg-[#FFCCF2]/30 text-[#0033FF] font-medium'
                    : 'text-gray-700 hover:bg-[#FFCCF2]/10'
                }`}
              >
                <Icon size={20} className={isActive ? 'text-[#977DFF]' : ''} />
                <span>{item.label}</span>
              </button>
            );
          })}
        </nav>

        {/* Divider */}
        <div className="mx-2 mb-4 border-t border-gray-200" />

        {/* Main Nav: Workspace, My Drive */}
        <nav className="space-y-0.5 mb-2">
          {mainNavItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeSection === item.id;
            return (
              <button
                key={item.id}
                onClick={() => handleNavigation(item.id)}
                className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-full text-left transition-colors ${
                  isActive
                    ? 'bg-[#FFCCF2]/30 text-[#0033FF] font-medium'
                    : 'text-gray-700 hover:bg-[#FFCCF2]/10'
                }`}
              >
                <Icon size={20} className={isActive ? 'text-[#977DFF]' : ''} />
                <span>{item.label}</span>
              </button>
            );
          })}
        </nav>

        {/* Shared Drives Section */}
        <div className="mb-2">
          <button
            onClick={() => setSharedDrivesExpanded(!sharedDrivesExpanded)}
            className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-full text-left transition-colors ${
              activeSection === 'shared-drives'
                ? 'bg-[#FFCCF2]/30 text-[#0033FF] font-medium'
                : 'text-gray-700 hover:bg-[#FFCCF2]/10'
            }`}
          >
            {sharedDrivesExpanded ? <ChevronDown size={20} /> : <ChevronRight size={20} />}
            <Users size={20} />
            <span>Shared Drives</span>
          </button>

          {sharedDrivesExpanded && (
            <div className="ml-6 mt-1 space-y-1">
              {sharedDrives.length > 0 ? (
                sharedDrives.map((drive) => (
                  <button
                    key={drive.id}
                    className="w-full flex items-center gap-2 px-4 py-2 rounded-full text-left text-gray-600 hover:bg-gray-100 text-sm"
                  >
                    <HardDrive size={16} />
                    <span className="truncate">{drive.name}</span>
                  </button>
                ))
              ) : (
                <p className="px-4 py-2 text-sm text-gray-400">No shared drives</p>
              )}
            </div>
          )}
        </div>

        {/* Divider */}
        <div className="mx-2 my-4 border-t border-gray-200" />

        {/* Secondary Nav */}
        <nav className="space-y-0.5">
          {secondaryNavItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeSection === item.id;
            return (
              <button
                key={item.id}
                onClick={() => handleNavigation(item.id)}
                className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-full text-left transition-colors ${
                  isActive
                    ? 'bg-[#FFCCF2]/30 text-[#0033FF] font-medium'
                    : 'text-gray-700 hover:bg-[#FFCCF2]/10'
                }`}
              >
                <Icon size={20} className={isActive ? 'text-[#977DFF]' : ''} />
                <span>{item.label}</span>
              </button>
            );
          })}
        </nav>
      </div>

      {/* Storage Section */}
      <div className="p-4 border-t border-gray-200 bg-gray-50">
        <div className="flex items-center gap-2 mb-2">
          <Cloud size={18} className="text-gray-400" />
          <span className="text-sm font-medium text-gray-700">Storage</span>
        </div>
        <div className="w-full bg-gray-200 rounded-full h-2 mb-2">
          <div
            className={`h-2 rounded-full transition-all ${
              storagePercentage > 90
                ? 'bg-red-500'
                : storagePercentage > 70
                ? 'bg-yellow-500'
                : 'bg-gradient-to-r from-[#FFCCF2] via-[#977DFF] to-[#0033FF]'
            }`}
            style={{ width: `${Math.min(storagePercentage, 100)}%` }}
          />
        </div>
        <p className="text-xs text-gray-500">
          {formatFileSize(storageUsed)} of {formatFileSize(storageTotal)} used
        </p>
        <button className="mt-3 w-full text-sm text-[#977DFF] hover:text-[#0033FF] font-medium text-left">
          Buy storage
        </button>
      </div>
    </aside>
  );
}
