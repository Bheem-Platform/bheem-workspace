/**
 * Bheem Docs - Version History Panel
 * View and restore document versions
 */
import { useState } from 'react';
import { History, X, RotateCcw, Eye, Clock, User, ChevronRight, Check } from 'lucide-react';
import { format, formatDistanceToNow } from 'date-fns';

interface Version {
  id: string;
  version_number: number;
  title: string;
  content?: any;
  user?: {
    id: string;
    name: string;
    avatar?: string;
  };
  created_at: string;
  size_bytes?: number;
  is_auto_save?: boolean;
  is_current?: boolean;
}

interface VersionHistoryProps {
  versions: Version[];
  currentVersionId: string;
  onPreview: (version: Version) => void;
  onRestore: (version: Version) => void;
  onClose: () => void;
  isLoading?: boolean;
}

export default function VersionHistory({
  versions,
  currentVersionId,
  onPreview,
  onRestore,
  onClose,
  isLoading = false,
}: VersionHistoryProps) {
  const [selectedVersion, setSelectedVersion] = useState<string | null>(null);
  const [showConfirmRestore, setShowConfirmRestore] = useState(false);

  const handleRestore = (version: Version) => {
    setSelectedVersion(version.id);
    setShowConfirmRestore(true);
  };

  const confirmRestore = () => {
    const version = versions.find((v) => v.id === selectedVersion);
    if (version) {
      onRestore(version);
    }
    setShowConfirmRestore(false);
  };

  // Group versions by date
  const groupedVersions = versions.reduce((groups, version) => {
    const date = format(new Date(version.created_at), 'MMMM d, yyyy');
    if (!groups[date]) {
      groups[date] = [];
    }
    groups[date].push(version);
    return groups;
  }, {} as Record<string, Version[]>);

  const formatSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  return (
    <div className="w-80 bg-white border-l flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b">
        <div className="flex items-center gap-2">
          <History size={20} className="text-purple-600" />
          <h2 className="font-semibold">Version History</h2>
        </div>
        <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded">
          <X size={18} />
        </button>
      </div>

      {/* Info banner */}
      <div className="px-4 py-3 bg-purple-50 border-b">
        <p className="text-xs text-purple-700">
          Click on a version to preview it. You can restore any previous version.
        </p>
      </div>

      {/* Version list */}
      <div className="flex-1 overflow-y-auto">
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600" />
          </div>
        ) : versions.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-gray-400">
            <History size={48} strokeWidth={1} />
            <p className="mt-2 text-sm">No version history</p>
            <p className="text-xs">Changes are saved automatically</p>
          </div>
        ) : (
          Object.entries(groupedVersions).map(([date, dateVersions]) => (
            <div key={date}>
              {/* Date header */}
              <div className="sticky top-0 px-4 py-2 bg-gray-50 border-b">
                <p className="text-xs font-medium text-gray-500">{date}</p>
              </div>

              {/* Versions for this date */}
              {dateVersions.map((version) => (
                <div
                  key={version.id}
                  className={`border-b hover:bg-gray-50 ${
                    version.is_current ? 'bg-green-50' : ''
                  }`}
                >
                  <button
                    onClick={() => onPreview(version)}
                    className="w-full px-4 py-3 text-left"
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex items-start gap-3">
                        {/* User avatar */}
                        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center text-white text-xs font-medium flex-shrink-0 mt-0.5">
                          {version.user?.avatar ? (
                            <img
                              src={version.user.avatar}
                              alt=""
                              className="w-full h-full rounded-full"
                            />
                          ) : (
                            (version.user?.name || 'U').charAt(0).toUpperCase()
                          )}
                        </div>

                        <div>
                          <div className="flex items-center gap-2">
                            <p className="text-sm font-medium text-gray-900">
                              {version.title || `Version ${version.version_number}`}
                            </p>
                            {version.is_current && (
                              <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full flex items-center gap-1">
                                <Check size={10} />
                                Current
                              </span>
                            )}
                            {version.is_auto_save && (
                              <span className="text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full">
                                Auto-saved
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-gray-500 mt-0.5">
                            {version.user?.name || 'Unknown user'}
                          </p>
                          <div className="flex items-center gap-3 mt-1 text-xs text-gray-400">
                            <span className="flex items-center gap-1">
                              <Clock size={10} />
                              {format(new Date(version.created_at), 'h:mm a')}
                            </span>
                            <span>{formatSize(version.size_bytes || 0)}</span>
                          </div>
                        </div>
                      </div>

                      <ChevronRight size={16} className="text-gray-400 mt-2" />
                    </div>
                  </button>

                  {/* Actions */}
                  {!version.is_current && (
                    <div className="px-4 pb-3 flex gap-2">
                      <button
                        onClick={() => onPreview(version)}
                        className="flex-1 flex items-center justify-center gap-1 px-3 py-1.5 text-xs text-gray-600 bg-gray-100 hover:bg-gray-200 rounded"
                      >
                        <Eye size={12} />
                        Preview
                      </button>
                      <button
                        onClick={() => handleRestore(version)}
                        className="flex-1 flex items-center justify-center gap-1 px-3 py-1.5 text-xs text-purple-600 bg-purple-100 hover:bg-purple-200 rounded"
                      >
                        <RotateCcw size={12} />
                        Restore
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          ))
        )}
      </div>

      {/* Restore confirmation modal */}
      {showConfirmRestore && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-sm mx-4">
            <div className="p-6">
              <div className="w-12 h-12 bg-purple-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <RotateCcw size={24} className="text-purple-600" />
              </div>
              <h3 className="text-lg font-semibold text-center mb-2">Restore this version?</h3>
              <p className="text-sm text-gray-500 text-center">
                This will replace the current document with the selected version. A backup of the
                current version will be saved.
              </p>
            </div>
            <div className="flex border-t">
              <button
                onClick={() => setShowConfirmRestore(false)}
                className="flex-1 py-3 text-gray-600 hover:bg-gray-50 rounded-bl-xl"
              >
                Cancel
              </button>
              <button
                onClick={confirmRestore}
                className="flex-1 py-3 text-purple-600 font-medium hover:bg-purple-50 rounded-br-xl border-l"
              >
                Restore
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
