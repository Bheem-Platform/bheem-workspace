/**
 * Bheem Drive - File Details Panel (Right Sidebar)
 * Shows detailed information about a selected file
 */
import { useState, useEffect } from 'react';
import {
  X,
  File,
  Folder,
  Image,
  Video,
  Music,
  FileText,
  FileSpreadsheet,
  Presentation,
  Archive,
  FileCode,
  Clock,
  User,
  HardDrive,
  Link,
  Star,
  Eye,
  Download,
  Share2,
  Pencil,
  Trash2,
  Info,
  History,
  Users,
} from 'lucide-react';
import type { DriveFile } from '@/lib/driveApi';
import { formatFileSize, getFileIcon, getShares } from '@/lib/driveApi';
import type { DriveShare } from '@/lib/driveApi';

interface FileDetailsPanelProps {
  file: DriveFile | null;
  isOpen: boolean;
  onClose: () => void;
  onStar?: () => void;
  onShare?: () => void;
  onRename?: () => void;
  onTrash?: () => void;
  onDownload?: () => void;
}

export default function FileDetailsPanel({
  file,
  isOpen,
  onClose,
  onStar,
  onShare,
  onRename,
  onTrash,
  onDownload,
}: FileDetailsPanelProps) {
  const [activeTab, setActiveTab] = useState<'details' | 'activity'>('details');
  const [shares, setShares] = useState<DriveShare[]>([]);
  const [loadingShares, setLoadingShares] = useState(false);

  useEffect(() => {
    if (file && isOpen) {
      fetchShares();
    }
  }, [file?.id, isOpen]);

  const fetchShares = async () => {
    if (!file) return;
    setLoadingShares(true);
    try {
      const data = await getShares(file.id);
      setShares(data);
    } catch (err) {
      console.error('Failed to fetch shares:', err);
    }
    setLoadingShares(false);
  };

  if (!isOpen || !file) return null;

  const FileIcon = getIconComponent(file);
  const createdDate = new Date(file.created_at).toLocaleDateString('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
  const modifiedDate = new Date(file.updated_at).toLocaleDateString('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

  return (
    <div className="w-80 h-full bg-white border-l border-gray-200 flex flex-col overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200">
        <div className="flex items-center gap-2 min-w-0">
          <FileIcon
            size={20}
            className={file.file_type === 'folder' ? 'text-blue-500' : 'text-gray-500'}
          />
          <h3 className="font-medium text-gray-900 truncate">{file.name}</h3>
        </div>
        <button
          onClick={onClose}
          className="p-1 hover:bg-gray-100 rounded-lg transition-colors flex-shrink-0"
        >
          <X size={18} className="text-gray-500" />
        </button>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-gray-200">
        <button
          onClick={() => setActiveTab('details')}
          className={`flex-1 px-4 py-2.5 text-sm font-medium transition-colors ${
            activeTab === 'details'
              ? 'text-blue-600 border-b-2 border-blue-600'
              : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          Details
        </button>
        <button
          onClick={() => setActiveTab('activity')}
          className={`flex-1 px-4 py-2.5 text-sm font-medium transition-colors ${
            activeTab === 'activity'
              ? 'text-blue-600 border-b-2 border-blue-600'
              : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          Activity
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        {activeTab === 'details' ? (
          <div className="p-4 space-y-6">
            {/* Preview thumbnail */}
            {file.file_type === 'file' && (
              <div className="aspect-video bg-gray-100 rounded-xl flex items-center justify-center">
                {file.thumbnail_url ? (
                  <img
                    src={file.thumbnail_url}
                    alt={file.name}
                    className="max-w-full max-h-full object-contain rounded-lg"
                  />
                ) : (
                  <FileIcon size={48} className="text-gray-300" />
                )}
              </div>
            )}

            {/* Quick actions */}
            <div className="flex justify-center gap-2">
              {file.is_starred !== undefined && (
                <button
                  onClick={onStar}
                  className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                  title={file.is_starred ? 'Remove star' : 'Add star'}
                >
                  <Star
                    size={20}
                    className={file.is_starred ? 'fill-yellow-400 text-yellow-400' : 'text-gray-500'}
                  />
                </button>
              )}
              {file.file_type === 'file' && (
                <button
                  onClick={onDownload}
                  className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                  title="Download"
                >
                  <Download size={20} className="text-gray-500" />
                </button>
              )}
              <button
                onClick={onShare}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                title="Share"
              >
                <Share2 size={20} className="text-gray-500" />
              </button>
              <button
                onClick={onRename}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                title="Rename"
              >
                <Pencil size={20} className="text-gray-500" />
              </button>
              <button
                onClick={onTrash}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                title="Move to trash"
              >
                <Trash2 size={20} className="text-gray-500" />
              </button>
            </div>

            {/* File info */}
            <div className="space-y-4">
              <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
                File Information
              </h4>

              {/* Type */}
              <div className="flex items-start gap-3">
                <Info size={16} className="text-gray-400 mt-0.5" />
                <div>
                  <p className="text-sm text-gray-500">Type</p>
                  <p className="text-sm text-gray-900">
                    {file.file_type === 'folder' ? 'Folder' : (file.mime_type || 'Unknown')}
                  </p>
                </div>
              </div>

              {/* Size */}
              {file.file_type === 'file' && file.size !== undefined && (
                <div className="flex items-start gap-3">
                  <HardDrive size={16} className="text-gray-400 mt-0.5" />
                  <div>
                    <p className="text-sm text-gray-500">Size</p>
                    <p className="text-sm text-gray-900">{formatFileSize(file.size)}</p>
                  </div>
                </div>
              )}

              {/* Location */}
              <div className="flex items-start gap-3">
                <Folder size={16} className="text-gray-400 mt-0.5" />
                <div>
                  <p className="text-sm text-gray-500">Location</p>
                  <p className="text-sm text-gray-900">{file.path || 'My Drive'}</p>
                </div>
              </div>

              {/* Owner */}
              <div className="flex items-start gap-3">
                <User size={16} className="text-gray-400 mt-0.5" />
                <div>
                  <p className="text-sm text-gray-500">Owner</p>
                  <p className="text-sm text-gray-900">{file.owner_name || 'Me'}</p>
                </div>
              </div>

              {/* Modified */}
              <div className="flex items-start gap-3">
                <Clock size={16} className="text-gray-400 mt-0.5" />
                <div>
                  <p className="text-sm text-gray-500">Modified</p>
                  <p className="text-sm text-gray-900">{modifiedDate}</p>
                </div>
              </div>

              {/* Created */}
              <div className="flex items-start gap-3">
                <History size={16} className="text-gray-400 mt-0.5" />
                <div>
                  <p className="text-sm text-gray-500">Created</p>
                  <p className="text-sm text-gray-900">{createdDate}</p>
                </div>
              </div>

              {/* Description */}
              {file.description && (
                <div className="flex items-start gap-3">
                  <FileText size={16} className="text-gray-400 mt-0.5" />
                  <div>
                    <p className="text-sm text-gray-500">Description</p>
                    <p className="text-sm text-gray-900">{file.description}</p>
                  </div>
                </div>
              )}
            </div>

            {/* Sharing */}
            <div className="space-y-3">
              <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider flex items-center gap-2">
                <Users size={14} />
                Sharing
              </h4>

              {loadingShares ? (
                <p className="text-sm text-gray-400">Loading...</p>
              ) : shares.length > 0 ? (
                <div className="space-y-2">
                  {shares.filter(s => !s.is_link_share).map(share => (
                    <div key={share.id} className="flex items-center gap-2 p-2 bg-gray-50 rounded-lg">
                      <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
                        <span className="text-xs font-medium text-blue-600">
                          {share.user_email?.charAt(0).toUpperCase()}
                        </span>
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm text-gray-900 truncate">{share.user_email}</p>
                        <p className="text-xs text-gray-500 capitalize">{share.permission}</p>
                      </div>
                    </div>
                  ))}
                  {shares.some(s => s.is_link_share) && (
                    <div className="flex items-center gap-2 p-2 bg-gray-50 rounded-lg">
                      <div className="w-8 h-8 bg-green-100 rounded-full flex items-center justify-center">
                        <Link size={14} className="text-green-600" />
                      </div>
                      <div>
                        <p className="text-sm text-gray-900">Anyone with link</p>
                        <p className="text-xs text-gray-500">Can view</p>
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <p className="text-sm text-gray-400">Not shared</p>
              )}

              <button
                onClick={onShare}
                className="w-full py-2 text-sm text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
              >
                Manage access
              </button>
            </div>
          </div>
        ) : (
          <div className="p-4">
            {/* Activity tab */}
            <div className="text-center text-gray-400 py-8">
              <History size={48} className="mx-auto mb-3 text-gray-300" />
              <p className="text-sm">Activity tracking coming soon</p>
              <p className="text-xs mt-1">View edits, comments, and shares</p>
            </div>
          </div>
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
