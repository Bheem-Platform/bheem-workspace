import {
  Folder,
  File,
  Image,
  FileText,
  Film,
  Music,
  Archive,
  FileSpreadsheet,
  Presentation,
  MoreVertical,
  MoreHorizontal,
  Download,
  Share2,
  UserPlus,
  Link2,
  Pencil,
  Trash2,
  Copy,
  Move,
  ExternalLink,
  Star,
  Info,
} from 'lucide-react';
import { useState, useEffect, useMemo } from 'react';
import { useDocsStore } from '@/stores/docsStore';
import { formatFileSize, getFileIcon } from '@/lib/docsApi';
import type { FileItem } from '@/types/docs';
import Pagination from '@/components/shared/Pagination';

interface FileGridProps {
  onFileOpen: (file: FileItem) => void;
  itemsPerPageDefault?: number;
}

const ITEMS_PER_PAGE_OPTIONS = [10, 20, 50, 100];

export default function FileGrid({ onFileOpen, itemsPerPageDefault = 10 }: FileGridProps) {
  const {
    files,
    selectedFiles,
    viewMode,
    loading,
    toggleFileSelection,
    selectFile,
    navigateTo,
    downloadFile,
    openShareModal,
    openRenameModal,
    openDeleteConfirm,
    currentPath,
  } = useDocsStore();

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(itemsPerPageDefault);

  // Reset page when path changes
  useEffect(() => {
    setCurrentPage(1);
  }, [currentPath]);

  // Pagination calculations
  const totalItems = files.length;
  const totalPages = Math.ceil(totalItems / itemsPerPage);
  const paginatedFiles = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    return files.slice(startIndex, startIndex + itemsPerPage);
  }, [files, currentPage, itemsPerPage]);

  if (loading.files) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-500" />
      </div>
    );
  }

  if (files.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <Folder size={64} className="text-gray-300 mb-4" />
        <h3 className="text-lg font-medium text-gray-900 mb-2">This folder is empty</h3>
        <p className="text-gray-500">Drop files here or click "Upload" to add files</p>
      </div>
    );
  }

  if (viewMode === 'list') {
    return (
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="border-b border-gray-200">
              <th className="w-10 px-3 py-3">
                <input
                  type="checkbox"
                  onChange={(e) => {
                    if (e.target.checked) {
                      useDocsStore.getState().selectAll();
                    } else {
                      useDocsStore.getState().clearSelection();
                    }
                  }}
                  checked={selectedFiles.length === files.length && files.length > 0}
                  className="w-4 h-4 text-[#0033FF] border-gray-300 rounded focus:ring-[#977DFF]"
                />
              </th>
              <th className="text-left px-2 py-3 text-sm font-medium text-gray-700">
                <div className="flex items-center gap-1 cursor-pointer hover:text-gray-900">
                  Name
                  <span className="text-xs text-gray-400">▲</span>
                </div>
              </th>
              <th className="w-28 px-2 py-3"></th>
              <th className="w-24 text-right px-4 py-3 text-sm font-medium text-gray-700">Size</th>
              <th className="w-32 text-right px-4 py-3 text-sm font-medium text-gray-700">Modified</th>
            </tr>
          </thead>
          <tbody>
            {paginatedFiles.map((file) => (
              <FileListItem
                key={file.id}
                file={file}
                isSelected={selectedFiles.includes(file.id)}
                onSelect={() => toggleFileSelection(file.id)}
                onClick={() => {
                  if (file.type === 'folder') {
                    navigateTo(file.path, file.id);
                  } else {
                    onFileOpen(file);
                  }
                }}
                onDownload={() => downloadFile(file)}
                onShare={() => openShareModal(file)}
                onRename={() => openRenameModal(file)}
                onDelete={() => openDeleteConfirm(file)}
              />
            ))}
          </tbody>
        </table>
        {/* Pagination */}
        {totalItems > 0 && (
          <Pagination
            currentPage={currentPage}
            totalPages={totalPages}
            totalItems={totalItems}
            itemsPerPage={itemsPerPage}
            onPageChange={setCurrentPage}
            onItemsPerPageChange={(value) => {
              setItemsPerPage(value);
              setCurrentPage(1);
            }}
          />
        )}
      </div>
    );
  }

  // Grid view
  return (
    <div>
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
        {paginatedFiles.map((file) => (
          <FileGridItem
            key={file.id}
            file={file}
            isSelected={selectedFiles.includes(file.id)}
            onSelect={() => toggleFileSelection(file.id)}
            onClick={() => {
              if (file.type === 'folder') {
                navigateTo(file.path, file.id);
            } else {
              onFileOpen(file);
            }
          }}
          onDownload={() => downloadFile(file)}
          onShare={() => openShareModal(file)}
          onRename={() => openRenameModal(file)}
          onDelete={() => openDeleteConfirm(file)}
        />
      ))}
      </div>
      {/* Grid Pagination */}
      {totalItems > 0 && (
        <div className="mt-6">
          <Pagination
            currentPage={currentPage}
            totalPages={totalPages}
            totalItems={totalItems}
            itemsPerPage={itemsPerPage}
            onPageChange={setCurrentPage}
            onItemsPerPageChange={(value) => {
              setItemsPerPage(value);
              setCurrentPage(1);
            }}
            className="bg-white rounded-xl border border-gray-200"
          />
        </div>
      )}
    </div>
  );
}

interface FileItemProps {
  file: FileItem;
  isSelected: boolean;
  onSelect: () => void;
  onClick: () => void;
  onDownload: () => void;
  onShare: () => void;
  onRename: () => void;
  onDelete: () => void;
}

function FileGridItem({
  file,
  isSelected,
  onSelect,
  onClick,
  onDownload,
  onShare,
  onRename,
  onDelete,
}: FileItemProps) {
  const [showMenu, setShowMenu] = useState(false);
  const iconType = getFileIcon(file.mimeType, file.type);

  return (
    <div
      className={`
        relative group bg-white rounded-xl border p-4 cursor-pointer transition-all
        ${isSelected ? 'border-purple-500 ring-2 ring-purple-500/20' : 'border-gray-200 hover:border-gray-300 hover:shadow-md'}
      `}
      onClick={onClick}
      onContextMenu={(e) => {
        e.preventDefault();
        setShowMenu(true);
      }}
    >
      {/* Checkbox */}
      <div
        className="absolute top-2 left-2 opacity-0 group-hover:opacity-100 transition-opacity"
        onClick={(e) => {
          e.stopPropagation();
          onSelect();
        }}
      >
        <input
          type="checkbox"
          checked={isSelected}
          onChange={() => {}}
          className="w-4 h-4 text-purple-500 border-gray-300 rounded focus:ring-purple-500"
        />
      </div>

      {/* Menu button */}
      <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
        <button
          onClick={(e) => {
            e.stopPropagation();
            setShowMenu(!showMenu);
          }}
          className="p-1 hover:bg-gray-100 rounded"
        >
          <MoreVertical size={16} className="text-gray-500" />
        </button>
      </div>

      {/* Icon */}
      <div className="flex justify-center mb-3">
        <FileIcon type={iconType} size={48} />
      </div>

      {/* Name */}
      <p className="text-sm font-medium text-gray-900 text-center truncate" title={file.name}>
        {file.name}
      </p>

      {/* Size (for files) */}
      {file.type === 'file' && file.size !== undefined && file.size > 0 && (
        <p className="text-xs text-gray-500 text-center mt-1">
          {formatFileSize(file.size)}
        </p>
      )}

      {/* Context Menu */}
      {showMenu && (
        <ContextMenu
          file={file}
          onClose={() => setShowMenu(false)}
          onDownload={onDownload}
          onShare={onShare}
          onRename={onRename}
          onDelete={onDelete}
        />
      )}
    </div>
  );
}

function FileListItem({
  file,
  isSelected,
  onSelect,
  onClick,
  onDownload,
  onShare,
  onRename,
  onDelete,
}: FileItemProps) {
  const [showMenu, setShowMenu] = useState(false);
  const iconType = getFileIcon(file.mimeType, file.type);

  // Check if file is shared
  const isShared = file.isShared || (file as any).is_shared;

  // Format relative time
  const formatRelativeTime = (date: string | Date | undefined) => {
    if (!date) return '-';
    const now = new Date();
    const modified = new Date(date);
    const diffMs = now.getTime() - modified.getTime();
    const diffMins = Math.floor(diffMs / (1000 * 60));
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    const diffWeeks = Math.floor(diffDays / 7);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins} minutes ago`;
    if (diffHours < 24) return `${diffHours} hours ago`;
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 7) return `${diffDays} days ago`;
    if (diffWeeks === 1) return '1 week ago';
    if (diffWeeks < 4) return `${diffWeeks} weeks ago`;
    return modified.toLocaleDateString();
  };

  return (
    <tr
      className={`
        group cursor-pointer transition-colors border-b border-gray-100 last:border-b-0
        ${isSelected ? 'bg-[#977DFF]/10' : 'hover:bg-gray-50'}
      `}
      onClick={onClick}
    >
      {/* Checkbox */}
      <td className="px-3 py-2.5" onClick={(e) => e.stopPropagation()}>
        <input
          type="checkbox"
          checked={isSelected}
          onChange={onSelect}
          className="w-4 h-4 text-[#0033FF] border-gray-300 rounded focus:ring-[#977DFF]"
        />
      </td>

      {/* Name with icon */}
      <td className="px-2 py-2.5">
        <div className="flex items-center gap-3">
          <FileIcon type={iconType} size={28} />
          <span className="text-sm font-medium text-gray-900 truncate">{file.name}</span>
        </div>
      </td>

      {/* Actions: Share badge, Share button, Menu */}
      <td className="px-2 py-2.5" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-end gap-1">
          {/* Shared badge */}
          {isShared && (
            <div className="flex items-center gap-1 text-[#0033FF] text-sm mr-2">
              <span>Shared</span>
              <Link2 size={14} />
            </div>
          )}

          {/* Share button */}
          <button
            onClick={(e) => {
              e.stopPropagation();
              onShare();
            }}
            className="p-1.5 text-gray-400 hover:text-[#0033FF] hover:bg-gray-100 rounded opacity-0 group-hover:opacity-100 transition-all"
            title="Share"
          >
            <UserPlus size={18} />
          </button>

          {/* Three dots menu */}
          <div className="relative">
            <button
              onClick={(e) => {
                e.stopPropagation();
                setShowMenu(!showMenu);
              }}
              className="p-1.5 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded opacity-0 group-hover:opacity-100 transition-all"
              title="Actions"
            >
              <MoreHorizontal size={18} />
            </button>

            {showMenu && (
              <ContextMenu
                file={file}
                onClose={() => setShowMenu(false)}
                onDownload={onDownload}
                onShare={onShare}
                onRename={onRename}
                onDelete={onDelete}
              />
            )}
          </div>
        </div>
      </td>

      {/* Size */}
      <td className="px-4 py-2.5 text-sm text-gray-500 text-right">
        {file.type === 'folder' ? '' : formatFileSize(file.size || 0)}
      </td>

      {/* Modified */}
      <td className="px-4 py-2.5 text-sm text-gray-500 text-right whitespace-nowrap">
        {formatRelativeTime(file.modified)}
      </td>
    </tr>
  );
}

interface ContextMenuProps {
  file: FileItem;
  onClose: () => void;
  onDownload: () => void;
  onShare: () => void;
  onRename: () => void;
  onDelete: () => void;
}

function ContextMenu({ file, onClose, onDownload, onShare, onRename, onDelete }: ContextMenuProps) {
  return (
    <>
      <div className="fixed inset-0 z-40" onClick={onClose} />
      <div className="absolute right-0 top-full mt-1 bg-white rounded-lg shadow-xl border border-gray-200 py-1 min-w-[180px] z-50">
        {/* Open */}
        <button
          onClick={(e) => {
            e.stopPropagation();
            onClose();
          }}
          className="w-full flex items-center gap-3 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
        >
          <ExternalLink size={16} className="text-gray-400" />
          <span>Open</span>
        </button>

        {/* Download (for files) */}
        {file.type === 'file' && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onDownload();
              onClose();
            }}
            className="w-full flex items-center gap-3 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
          >
            <Download size={16} className="text-gray-400" />
            <span>Download</span>
          </button>
        )}

        <hr className="my-1 border-gray-100" />

        {/* Share */}
        <button
          onClick={(e) => {
            e.stopPropagation();
            onShare();
            onClose();
          }}
          className="w-full flex items-center gap-3 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
        >
          <UserPlus size={16} className="text-gray-400" />
          <span>Share</span>
        </button>

        {/* Copy link */}
        <button
          onClick={(e) => {
            e.stopPropagation();
            // Copy link logic
            onClose();
          }}
          className="w-full flex items-center gap-3 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
        >
          <Link2 size={16} className="text-gray-400" />
          <span>Copy link</span>
        </button>

        <hr className="my-1 border-gray-100" />

        {/* Rename */}
        <button
          onClick={(e) => {
            e.stopPropagation();
            onRename();
            onClose();
          }}
          className="w-full flex items-center gap-3 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
        >
          <Pencil size={16} className="text-gray-400" />
          <span>Rename</span>
        </button>

        {/* Move */}
        <button
          onClick={(e) => {
            e.stopPropagation();
            onClose();
          }}
          className="w-full flex items-center gap-3 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
        >
          <Move size={16} className="text-gray-400" />
          <span>Move</span>
        </button>

        {/* Copy */}
        <button
          onClick={(e) => {
            e.stopPropagation();
            onClose();
          }}
          className="w-full flex items-center gap-3 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
        >
          <Copy size={16} className="text-gray-400" />
          <span>Copy</span>
        </button>

        <hr className="my-1 border-gray-100" />

        {/* Details */}
        <button
          onClick={(e) => {
            e.stopPropagation();
            onClose();
          }}
          className="w-full flex items-center gap-3 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
        >
          <Info size={16} className="text-gray-400" />
          <span>Details</span>
        </button>

        <hr className="my-1 border-gray-100" />

        {/* Delete */}
        <button
          onClick={(e) => {
            e.stopPropagation();
            onDelete();
            onClose();
          }}
          className="w-full flex items-center gap-3 px-4 py-2 text-sm text-red-600 hover:bg-red-50"
        >
          <Trash2 size={16} />
          <span>Delete</span>
        </button>
      </div>
    </>
  );
}

interface FileIconProps {
  type: string;
  size: number;
}

function FileIcon({ type, size }: FileIconProps) {
  const iconProps = { size, strokeWidth: 1.5 };

  switch (type) {
    case 'folder':
      // Blue folder like Nextcloud
      return <Folder {...iconProps} className="text-[#0082c9]" fill="#0082c9" />;
    case 'image':
      return <Image {...iconProps} className="text-pink-500" />;
    case 'video':
      return <Film {...iconProps} className="text-red-500" />;
    case 'audio':
      return <Music {...iconProps} className="text-green-500" />;
    case 'pdf':
      return <FileText {...iconProps} className="text-red-600" />;
    case 'doc':
      return <FileText {...iconProps} className="text-[#0033FF]" />;
    case 'spreadsheet':
      return <FileSpreadsheet {...iconProps} className="text-green-600" />;
    case 'presentation':
      return <Presentation {...iconProps} className="text-orange-500" />;
    case 'archive':
      return <Archive {...iconProps} className="text-amber-600" />;
    case 'text':
      return <FileText {...iconProps} className="text-gray-600" />;
    default:
      return <File {...iconProps} className="text-gray-400" />;
  }
}
