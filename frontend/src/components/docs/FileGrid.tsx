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
  Download,
  Share2,
  Pencil,
  Trash2,
  Copy,
  Move,
} from 'lucide-react';
import { useState } from 'react';
import { useDocsStore } from '@/stores/docsStore';
import { formatFileSize, getFileIcon } from '@/lib/docsApi';
import type { FileItem } from '@/types/docs';

interface FileGridProps {
  onFileOpen: (file: FileItem) => void;
}

export default function FileGrid({ onFileOpen }: FileGridProps) {
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
  } = useDocsStore();

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
            <tr className="bg-gray-50 border-b border-gray-200">
              <th className="w-8 px-4 py-3">
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
                  className="w-4 h-4 text-purple-500 border-gray-300 rounded focus:ring-purple-500"
                />
              </th>
              <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">
                Name
              </th>
              <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider w-32">
                Size
              </th>
              <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider w-40">
                Modified
              </th>
              <th className="w-16 px-4 py-3"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {files.map((file) => (
              <FileListItem
                key={file.id}
                file={file}
                isSelected={selectedFiles.includes(file.id)}
                onSelect={() => toggleFileSelection(file.id)}
                onClick={() => {
                  if (file.type === 'folder') {
                    navigateTo(file.path);
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
      </div>
    );
  }

  // Grid view
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
      {files.map((file) => (
        <FileGridItem
          key={file.id}
          file={file}
          isSelected={selectedFiles.includes(file.id)}
          onSelect={() => toggleFileSelection(file.id)}
          onClick={() => {
            if (file.type === 'folder') {
              navigateTo(file.path);
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

  return (
    <tr
      className={`
        group cursor-pointer transition-colors
        ${isSelected ? 'bg-purple-50' : 'hover:bg-gray-50'}
      `}
      onClick={onClick}
    >
      <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
        <input
          type="checkbox"
          checked={isSelected}
          onChange={onSelect}
          className="w-4 h-4 text-purple-500 border-gray-300 rounded focus:ring-purple-500"
        />
      </td>
      <td className="px-4 py-3">
        <div className="flex items-center gap-3">
          <FileIcon type={iconType} size={32} />
          <span className="text-sm font-medium text-gray-900 truncate">{file.name}</span>
        </div>
      </td>
      <td className="px-4 py-3 text-sm text-gray-500">
        {file.type === 'folder' ? '-' : formatFileSize(file.size || 0)}
      </td>
      <td className="px-4 py-3 text-sm text-gray-500">
        {file.modified ? new Date(file.modified).toLocaleDateString() : '-'}
      </td>
      <td className="px-4 py-3 relative" onClick={(e) => e.stopPropagation()}>
        <button
          onClick={() => setShowMenu(!showMenu)}
          className="p-1 hover:bg-gray-100 rounded opacity-0 group-hover:opacity-100 transition-opacity"
        >
          <MoreVertical size={16} className="text-gray-500" />
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
      <div className="absolute right-0 top-full mt-1 bg-white rounded-lg shadow-xl border border-gray-200 py-1 min-w-[160px] z-50">
        {file.type === 'file' && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onDownload();
              onClose();
            }}
            className="w-full flex items-center gap-2 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
          >
            <Download size={16} />
            <span>Download</span>
          </button>
        )}
        <button
          onClick={(e) => {
            e.stopPropagation();
            onShare();
            onClose();
          }}
          className="w-full flex items-center gap-2 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
        >
          <Share2 size={16} />
          <span>Share</span>
        </button>
        <button
          onClick={(e) => {
            e.stopPropagation();
            onRename();
            onClose();
          }}
          className="w-full flex items-center gap-2 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
        >
          <Pencil size={16} />
          <span>Rename</span>
        </button>
        <hr className="my-1 border-gray-100" />
        <button
          onClick={(e) => {
            e.stopPropagation();
            onDelete();
            onClose();
          }}
          className="w-full flex items-center gap-2 px-4 py-2 text-sm text-red-600 hover:bg-red-50"
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
      return <Folder {...iconProps} className="text-yellow-500" fill="#fbbf24" />;
    case 'image':
      return <Image {...iconProps} className="text-pink-500" />;
    case 'video':
      return <Film {...iconProps} className="text-red-500" />;
    case 'audio':
      return <Music {...iconProps} className="text-green-500" />;
    case 'pdf':
      return <FileText {...iconProps} className="text-red-600" />;
    case 'doc':
      return <FileText {...iconProps} className="text-blue-600" />;
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
