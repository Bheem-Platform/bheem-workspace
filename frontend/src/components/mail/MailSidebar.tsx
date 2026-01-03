import {
  Inbox,
  Send,
  FileText,
  AlertTriangle,
  Trash2,
  Archive,
  Star,
  Tag,
  Plus,
  Folder,
  RefreshCw,
  type LucideIcon,
} from 'lucide-react';
import { useMailStore } from '@/stores/mailStore';
import type { MailFolder } from '@/types/mail';

const FOLDER_ICONS: Record<string, LucideIcon> = {
  inbox: Inbox,
  sent: Send,
  drafts: FileText,
  spam: AlertTriangle,
  trash: Trash2,
  archive: Archive,
  starred: Star,
  custom: Folder,
};

const FOLDER_COLORS: Record<string, string> = {
  inbox: 'text-blue-600 bg-blue-50',
  sent: 'text-green-600 bg-green-50',
  drafts: 'text-orange-600 bg-orange-50',
  spam: 'text-yellow-600 bg-yellow-50',
  trash: 'text-red-600 bg-red-50',
  archive: 'text-purple-600 bg-purple-50',
  starred: 'text-amber-500 bg-amber-50',
  custom: 'text-gray-600 bg-gray-50',
};

interface MailSidebarProps {
  onCompose: () => void;
}

export default function MailSidebar({ onCompose }: MailSidebarProps) {
  const {
    folders,
    currentFolder,
    setCurrentFolder,
    fetchFolders,
    loading,
  } = useMailStore();

  // Default folders if none loaded
  const displayFolders: MailFolder[] = folders.length > 0 ? folders : [
    { id: 'INBOX', name: 'Inbox', path: 'INBOX', type: 'inbox', unreadCount: 0, totalCount: 0, isSystem: true },
    { id: 'Sent', name: 'Sent', path: 'Sent', type: 'sent', unreadCount: 0, totalCount: 0, isSystem: true },
    { id: 'Drafts', name: 'Drafts', path: 'Drafts', type: 'drafts', unreadCount: 0, totalCount: 0, isSystem: true },
    { id: 'Spam', name: 'Spam', path: 'Spam', type: 'spam', unreadCount: 0, totalCount: 0, isSystem: true },
    { id: 'Trash', name: 'Trash', path: 'Trash', type: 'trash', unreadCount: 0, totalCount: 0, isSystem: true },
  ];

  const systemFolders = displayFolders.filter((f) => f.isSystem);
  const customFolders = displayFolders.filter((f) => !f.isSystem);

  return (
    <div className="h-full flex flex-col">
      {/* Compose Button */}
      <div className="p-4">
        <button
          onClick={onCompose}
          className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-gradient-to-r from-orange-500 to-red-500 text-white font-medium rounded-xl hover:from-orange-600 hover:to-red-600 transition-all shadow-lg shadow-orange-500/25"
        >
          <Plus size={20} />
          <span>Compose</span>
        </button>
      </div>

      {/* Folders List */}
      <nav className="flex-1 overflow-y-auto px-2">
        {/* System Folders */}
        <div className="space-y-1">
          {systemFolders.map((folder) => {
            const Icon = FOLDER_ICONS[folder.type] || Folder;
            const isActive = currentFolder === folder.id || currentFolder === folder.path;
            const colorClass = FOLDER_COLORS[folder.type] || FOLDER_COLORS.custom;

            return (
              <button
                key={folder.id}
                onClick={() => setCurrentFolder(folder.path || folder.id)}
                className={`
                  w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all
                  ${isActive
                    ? 'bg-orange-50 text-orange-700'
                    : 'text-gray-700 hover:bg-gray-50'
                  }
                `}
              >
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                  isActive ? 'bg-orange-100' : colorClass.split(' ')[1]
                }`}>
                  <Icon size={18} className={isActive ? 'text-orange-600' : colorClass.split(' ')[0]} />
                </div>
                <span className="flex-1 text-left font-medium text-sm">
                  {folder.name}
                </span>
                {folder.unreadCount > 0 && (
                  <span className={`
                    px-2 py-0.5 text-xs font-semibold rounded-full
                    ${isActive ? 'bg-orange-200 text-orange-800' : 'bg-gray-200 text-gray-700'}
                  `}>
                    {folder.unreadCount}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* Divider */}
        {customFolders.length > 0 && (
          <div className="my-4 border-t border-gray-200" />
        )}

        {/* Custom Folders */}
        {customFolders.length > 0 && (
          <div className="space-y-1">
            <div className="px-3 py-2 text-xs font-semibold text-gray-500 uppercase tracking-wider">
              Labels
            </div>
            {customFolders.map((folder) => {
              const isActive = currentFolder === folder.id || currentFolder === folder.path;

              return (
                <button
                  key={folder.id}
                  onClick={() => setCurrentFolder(folder.path || folder.id)}
                  className={`
                    w-full flex items-center gap-3 px-3 py-2 rounded-lg transition-all
                    ${isActive
                      ? 'bg-orange-50 text-orange-700'
                      : 'text-gray-600 hover:bg-gray-50'
                    }
                  `}
                >
                  <Tag size={16} className={folder.color || 'text-gray-400'} />
                  <span className="flex-1 text-left text-sm">
                    {folder.name}
                  </span>
                  {folder.unreadCount > 0 && (
                    <span className="px-2 py-0.5 text-xs font-medium bg-gray-100 text-gray-600 rounded-full">
                      {folder.unreadCount}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        )}
      </nav>

      {/* Refresh Button */}
      <div className="p-4 border-t border-gray-200">
        <button
          onClick={() => fetchFolders()}
          disabled={loading.folders}
          className="w-full flex items-center justify-center gap-2 px-3 py-2 text-gray-600 hover:bg-gray-50 rounded-lg transition-colors"
        >
          <RefreshCw size={16} className={loading.folders ? 'animate-spin' : ''} />
          <span className="text-sm">Refresh</span>
        </button>
      </div>
    </div>
  );
}
