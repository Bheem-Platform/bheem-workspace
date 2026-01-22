/**
 * Bheem Drive - Home View Component
 * Shows Quick Access, Suggested files, and Priority files
 */
import { useState, useEffect } from 'react';
import {
  Clock,
  Star,
  Users,
  File,
  Folder,
  Image,
  Video,
  FileText,
  FileSpreadsheet,
  Presentation,
  Archive,
  FileCode,
  Music,
  MoreVertical,
  RefreshCw,
} from 'lucide-react';
import * as driveApi from '@/lib/driveApi';
import type { DriveFile } from '@/lib/driveApi';
import { formatFileSize, getFileIcon } from '@/lib/driveApi';
import { useDriveStore } from '@/stores/driveStore';

interface HomeViewProps {
  onFileOpen: (file: DriveFile) => void;
}

export default function HomeView({ onFileOpen }: HomeViewProps) {
  const [recentFiles, setRecentFiles] = useState<DriveFile[]>([]);
  const [starredFiles, setStarredFiles] = useState<DriveFile[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const { navigateToFolder, toggleStar, openShareModal } = useDriveStore();

  useEffect(() => {
    fetchHomeData();
  }, []);

  const fetchHomeData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [recent, starred] = await Promise.all([
        driveApi.getRecentFiles(12),
        driveApi.getStarredFiles(),
      ]);
      setRecentFiles(recent);
      setStarredFiles(starred.slice(0, 6));
    } catch (err: any) {
      setError(err.message || 'Failed to load home data');
    }
    setLoading(false);
  };

  const handleFileClick = (file: DriveFile) => {
    if (file.file_type === 'folder') {
      navigateToFolder(file.id, file.name);
    } else {
      onFileOpen(file);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-12">
        <p className="text-red-500 mb-4">{error}</p>
        <button
          onClick={fetchHomeData}
          className="flex items-center gap-2 mx-auto px-4 py-2 text-blue-600 hover:bg-blue-50 rounded-lg"
        >
          <RefreshCw size={16} />
          Try again
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Quick Access - Starred Files */}
      {starredFiles.length > 0 && (
        <section>
          <div className="flex items-center gap-2 mb-4">
            <Star size={20} className="text-yellow-500" />
            <h2 className="text-lg font-semibold text-gray-900">Starred</h2>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
            {starredFiles.map(file => (
              <QuickAccessCard
                key={file.id}
                file={file}
                onClick={() => handleFileClick(file)}
                onStar={() => toggleStar(file.id, file.is_starred)}
                onShare={() => openShareModal(file)}
              />
            ))}
          </div>
        </section>
      )}

      {/* Recent Files */}
      <section>
        <div className="flex items-center gap-2 mb-4">
          <Clock size={20} className="text-blue-500" />
          <h2 className="text-lg font-semibold text-gray-900">Recent</h2>
        </div>
        {recentFiles.length === 0 ? (
          <div className="bg-white rounded-xl border border-gray-200 p-8 text-center">
            <Clock size={48} className="mx-auto text-gray-300 mb-4" />
            <p className="text-gray-500">No recent files</p>
            <p className="text-sm text-gray-400 mt-1">
              Files you open will appear here
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
            {recentFiles.map(file => (
              <QuickAccessCard
                key={file.id}
                file={file}
                onClick={() => handleFileClick(file)}
                onStar={() => toggleStar(file.id, file.is_starred)}
                onShare={() => openShareModal(file)}
              />
            ))}
          </div>
        )}
      </section>

      {/* Suggested Section */}
      <section>
        <div className="flex items-center gap-2 mb-4">
          <Users size={20} className="text-green-500" />
          <h2 className="text-lg font-semibold text-gray-900">Suggested</h2>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <div className="text-center text-gray-400">
            <Users size={48} className="mx-auto mb-3 text-gray-300" />
            <p className="text-sm">Files suggested based on your activity will appear here</p>
          </div>
        </div>
      </section>
    </div>
  );
}

// Quick Access Card Component
interface QuickAccessCardProps {
  file: DriveFile;
  onClick: () => void;
  onStar?: () => void;
  onShare?: () => void;
}

function QuickAccessCard({ file, onClick, onStar, onShare }: QuickAccessCardProps) {
  const [showMenu, setShowMenu] = useState(false);
  const FileIcon = getIconComponent(file);

  const modifiedDate = new Date(file.updated_at).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
  });

  return (
    <div
      className="group relative bg-white rounded-xl border border-gray-200 hover:border-gray-300 hover:shadow-md transition-all cursor-pointer overflow-hidden"
      onClick={onClick}
    >
      {/* Star indicator */}
      {file.is_starred && (
        <div className="absolute top-2 left-2 z-10">
          <Star size={14} className="fill-yellow-400 text-yellow-400" />
        </div>
      )}

      {/* Thumbnail / Icon */}
      <div className="aspect-[4/3] bg-gray-50 flex items-center justify-center p-4">
        {file.thumbnail_url ? (
          <img
            src={file.thumbnail_url}
            alt={file.name}
            className="max-h-full max-w-full object-contain rounded"
          />
        ) : (
          <FileIcon
            size={40}
            className={file.file_type === 'folder' ? 'text-blue-500' : 'text-gray-400'}
          />
        )}
      </div>

      {/* File info */}
      <div className="p-3 border-t border-gray-100">
        <p className="text-sm font-medium text-gray-900 truncate" title={file.name}>
          {file.name}
        </p>
        <p className="text-xs text-gray-500 mt-0.5">{modifiedDate}</p>
      </div>

      {/* Menu button */}
      <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
        <button
          onClick={(e) => {
            e.stopPropagation();
            setShowMenu(!showMenu);
          }}
          className="p-1.5 bg-white/90 hover:bg-white shadow-sm rounded-lg"
        >
          <MoreVertical size={14} className="text-gray-500" />
        </button>

        {showMenu && (
          <>
            <div
              className="fixed inset-0 z-10"
              onClick={(e) => {
                e.stopPropagation();
                setShowMenu(false);
              }}
            />
            <div className="absolute right-0 top-8 z-20 w-36 bg-white rounded-lg shadow-lg border border-gray-200 py-1">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onStar?.();
                  setShowMenu(false);
                }}
                className="w-full flex items-center gap-2 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50"
              >
                <Star size={14} className={file.is_starred ? 'fill-yellow-400 text-yellow-400' : ''} />
                {file.is_starred ? 'Unstar' : 'Star'}
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onShare?.();
                  setShowMenu(false);
                }}
                className="w-full flex items-center gap-2 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50"
              >
                <Users size={14} />
                Share
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// Helper to get icon component
function getIconComponent(file: DriveFile) {
  if (file.file_type === 'folder') return Folder;

  const iconType = getFileIcon(file);
  switch (iconType) {
    case 'image':
      return Image;
    case 'video':
      return Video;
    case 'audio':
      return Music;
    case 'pdf':
      return FileText;
    case 'doc':
      return FileText;
    case 'sheet':
      return FileSpreadsheet;
    case 'slides':
      return Presentation;
    case 'archive':
      return Archive;
    case 'code':
      return FileCode;
    default:
      return File;
  }
}
