/**
 * Bheem Drive - File Grid/List View Component
 */
import { useMemo, useState, useEffect, useCallback } from 'react';
import {
  Folder,
  FileText,
  Image,
  Video,
  Music,
  FileSpreadsheet,
  Presentation,
  FileCode,
  Archive,
  File,
  Star,
  MoreVertical,
  Download,
  Share2,
  Pencil,
  Trash2,
  Move,
  Copy,
  RotateCcw,
  Info,
} from 'lucide-react';
import { useDriveStore } from '@/stores/driveStore';
import { formatFileSize, getFileIcon } from '@/lib/driveApi';
import type { DriveFile } from '@/lib/driveApi';

// Right-click context menu state
interface ContextMenuState {
  isOpen: boolean;
  x: number;
  y: number;
  file: DriveFile | null;
}

interface FileGridProps {
  onFileOpen: (file: DriveFile) => void;
}

export default function FileGrid({ onFileOpen }: FileGridProps) {
  const {
    files,
    viewMode,
    selectedFiles,
    searchQuery,
    loading,
    activeFilter,
    toggleSelect,
    toggleStar,
    downloadFile,
    trashFile,
    restoreFile,
    openShareModal,
    openRenameModal,
    openMoveModal,
    openDeleteConfirm,
    navigateToFolder,
  } = useDriveStore();

  // Right-click context menu state
  const [contextMenu, setContextMenu] = useState<ContextMenuState>({
    isOpen: false,
    x: 0,
    y: 0,
    file: null,
  });

  // Close context menu on click outside or scroll
  useEffect(() => {
    const handleClick = () => setContextMenu(prev => ({ ...prev, isOpen: false }));
    const handleScroll = () => setContextMenu(prev => ({ ...prev, isOpen: false }));

    document.addEventListener('click', handleClick);
    document.addEventListener('scroll', handleScroll, true);

    return () => {
      document.removeEventListener('click', handleClick);
      document.removeEventListener('scroll', handleScroll, true);
    };
  }, []);

  const handleContextMenu = useCallback((e: React.MouseEvent, file: DriveFile) => {
    e.preventDefault();
    e.stopPropagation();

    // Position the menu, adjusting if it would go off screen
    const menuWidth = 200;
    const menuHeight = 300;
    let x = e.clientX;
    let y = e.clientY;

    if (x + menuWidth > window.innerWidth) {
      x = window.innerWidth - menuWidth - 10;
    }
    if (y + menuHeight > window.innerHeight) {
      y = window.innerHeight - menuHeight - 10;
    }

    setContextMenu({
      isOpen: true,
      x,
      y,
      file,
    });
  }, []);

  // Drag and drop state
  const [dragOverFolderId, setDragOverFolderId] = useState<string | null>(null);
  const [draggedFile, setDraggedFile] = useState<DriveFile | null>(null);
  const { moveFile } = useDriveStore();

  const handleDragStart = useCallback((e: React.DragEvent, file: DriveFile) => {
    setDraggedFile(file);
    e.dataTransfer.setData('text/plain', file.id);
    e.dataTransfer.effectAllowed = 'move';
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent, folderId: string) => {
    e.preventDefault();
    e.stopPropagation();
    if (draggedFile && draggedFile.id !== folderId) {
      e.dataTransfer.dropEffect = 'move';
      setDragOverFolderId(folderId);
    }
  }, [draggedFile]);

  const handleDragLeave = useCallback(() => {
    setDragOverFolderId(null);
  }, []);

  const handleDrop = useCallback(async (e: React.DragEvent, targetFolder: DriveFile) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOverFolderId(null);

    if (!draggedFile) return;
    if (draggedFile.id === targetFolder.id) return;
    if (targetFolder.file_type !== 'folder') return;

    // Move the file to the target folder
    await moveFile(draggedFile.id, targetFolder.id);
    setDraggedFile(null);
  }, [draggedFile, moveFile]);

  const handleDragEnd = useCallback(() => {
    setDraggedFile(null);
    setDragOverFolderId(null);
  }, []);

  // Filter by search query
  const filteredFiles = useMemo(() => {
    if (!searchQuery) return files;
    const query = searchQuery.toLowerCase();
    return files.filter(f => f.name.toLowerCase().includes(query));
  }, [files, searchQuery]);

  // Separate folders and files
  const folders = filteredFiles.filter(f => f.file_type === 'folder');
  const regularFiles = filteredFiles.filter(f => f.file_type === 'file');

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500" />
      </div>
    );
  }

  if (filteredFiles.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-gray-500">
        <Folder size={64} className="text-gray-300 mb-4" />
        <p className="text-lg font-medium">
          {searchQuery ? 'No files match your search' : 'This folder is empty'}
        </p>
        <p className="text-sm text-gray-400 mt-1">
          {searchQuery ? 'Try a different search term' : 'Drop files here or click Upload'}
        </p>
      </div>
    );
  }

  const handleDoubleClick = (file: DriveFile) => {
    if (file.file_type === 'folder') {
      navigateToFolder(file.id, file.name);
    } else {
      onFileOpen(file);
    }
  };

  if (viewMode === 'list') {
    return (
      <>
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="bg-gray-50 text-left text-sm text-gray-600">
                <th className="w-8 px-4 py-3">
                  <input type="checkbox" className="rounded" />
                </th>
                <th className="px-4 py-3 font-medium">Name</th>
                <th className="px-4 py-3 font-medium w-32">Size</th>
                <th className="px-4 py-3 font-medium w-40">Modified</th>
                <th className="px-4 py-3 font-medium w-20"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {[...folders, ...regularFiles].map(file => (
                <FileListRow
                  key={file.id}
                  file={file}
                  isSelected={selectedFiles.includes(file.id)}
                  onToggleSelect={() => toggleSelect(file.id)}
                  onDoubleClick={() => handleDoubleClick(file)}
                  onContextMenu={(e) => handleContextMenu(e, file)}
                  onStar={() => toggleStar(file.id, file.is_starred)}
                  onDownload={() => downloadFile(file)}
                  onShare={() => openShareModal(file)}
                  onRename={() => openRenameModal(file)}
                  onMove={() => openMoveModal(file)}
                  onTrash={() => activeFilter === 'trash' ? openDeleteConfirm(file) : trashFile(file.id)}
                  onRestore={() => restoreFile(file.id)}
                  isTrash={activeFilter === 'trash'}
                />
              ))}
            </tbody>
          </table>
        </div>

        {/* Global Right-Click Context Menu */}
        <RightClickContextMenu
          contextMenu={contextMenu}
          onClose={() => setContextMenu(prev => ({ ...prev, isOpen: false }))}
          activeFilter={activeFilter}
          onStar={() => contextMenu.file && toggleStar(contextMenu.file.id, contextMenu.file.is_starred)}
          onDownload={() => contextMenu.file && downloadFile(contextMenu.file)}
          onShare={() => contextMenu.file && openShareModal(contextMenu.file)}
          onRename={() => contextMenu.file && openRenameModal(contextMenu.file)}
          onMove={() => contextMenu.file && openMoveModal(contextMenu.file)}
          onTrash={() => contextMenu.file && (activeFilter === 'trash' ? openDeleteConfirm(contextMenu.file) : trashFile(contextMenu.file.id))}
          onRestore={() => contextMenu.file && restoreFile(contextMenu.file.id)}
        />
      </>
    );
  }

  return (
    <>
      <div className="space-y-6">
        {/* Folders */}
        {folders.length > 0 && (
          <div>
            <h3 className="text-sm font-medium text-gray-500 mb-3">Folders</h3>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
              {folders.map(folder => (
                <FileGridItem
                  key={folder.id}
                  file={folder}
                  isSelected={selectedFiles.includes(folder.id)}
                  onToggleSelect={() => toggleSelect(folder.id)}
                  onDoubleClick={() => handleDoubleClick(folder)}
                  onContextMenu={(e) => handleContextMenu(e, folder)}
                  onStar={() => toggleStar(folder.id, folder.is_starred)}
                  onDownload={() => downloadFile(folder)}
                  onShare={() => openShareModal(folder)}
                  onRename={() => openRenameModal(folder)}
                  onMove={() => openMoveModal(folder)}
                  onTrash={() => activeFilter === 'trash' ? openDeleteConfirm(folder) : trashFile(folder.id)}
                  onRestore={() => restoreFile(folder.id)}
                  isTrash={activeFilter === 'trash'}
                  onDragStart={(e) => handleDragStart(e, folder)}
                  onDragOver={(e) => handleDragOver(e, folder.id)}
                  onDrop={(e) => handleDrop(e, folder)}
                  isDragOver={dragOverFolderId === folder.id}
                />
              ))}
            </div>
          </div>
        )}

        {/* Files */}
        {regularFiles.length > 0 && (
          <div>
            <h3 className="text-sm font-medium text-gray-500 mb-3">Files</h3>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
              {regularFiles.map(file => (
                <FileGridItem
                  key={file.id}
                  file={file}
                  isSelected={selectedFiles.includes(file.id)}
                  onToggleSelect={() => toggleSelect(file.id)}
                  onDoubleClick={() => handleDoubleClick(file)}
                  onContextMenu={(e) => handleContextMenu(e, file)}
                  onStar={() => toggleStar(file.id, file.is_starred)}
                  onDownload={() => downloadFile(file)}
                  onShare={() => openShareModal(file)}
                  onRename={() => openRenameModal(file)}
                  onMove={() => openMoveModal(file)}
                  onTrash={() => activeFilter === 'trash' ? openDeleteConfirm(file) : trashFile(file.id)}
                  onRestore={() => restoreFile(file.id)}
                  isTrash={activeFilter === 'trash'}
                  onDragStart={(e) => handleDragStart(e, file)}
                />
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Global Right-Click Context Menu */}
      <RightClickContextMenu
        contextMenu={contextMenu}
        onClose={() => setContextMenu(prev => ({ ...prev, isOpen: false }))}
        activeFilter={activeFilter}
        onStar={() => contextMenu.file && toggleStar(contextMenu.file.id, contextMenu.file.is_starred)}
        onDownload={() => contextMenu.file && downloadFile(contextMenu.file)}
        onShare={() => contextMenu.file && openShareModal(contextMenu.file)}
        onRename={() => contextMenu.file && openRenameModal(contextMenu.file)}
        onMove={() => contextMenu.file && openMoveModal(contextMenu.file)}
        onTrash={() => contextMenu.file && (activeFilter === 'trash' ? openDeleteConfirm(contextMenu.file) : trashFile(contextMenu.file.id))}
        onRestore={() => contextMenu.file && restoreFile(contextMenu.file.id)}
      />
    </>
  );
}

// Grid Item Component
interface FileItemProps {
  file: DriveFile;
  isSelected: boolean;
  onToggleSelect: () => void;
  onDoubleClick: () => void;
  onContextMenu: (e: React.MouseEvent) => void;
  onStar: () => void;
  onDownload: () => void;
  onShare: () => void;
  onRename: () => void;
  onMove: () => void;
  onTrash: () => void;
  onRestore: () => void;
  isTrash: boolean;
  onDragStart?: (e: React.DragEvent, file: DriveFile) => void;
  onDragOver?: (e: React.DragEvent) => void;
  onDrop?: (e: React.DragEvent, targetFolder: DriveFile) => void;
  isDragOver?: boolean;
}

function FileGridItem({
  file,
  isSelected,
  onToggleSelect,
  onDoubleClick,
  onContextMenu,
  onStar,
  onDownload,
  onShare,
  onRename,
  onMove,
  onTrash,
  onRestore,
  isTrash,
  onDragStart,
  onDragOver,
  onDrop,
  isDragOver,
}: FileItemProps) {
  const FileIcon = getIconComponent(file);
  const isFolder = file.file_type === 'folder';

  return (
    <div
      className={`group relative bg-white rounded-xl border-2 transition-all cursor-pointer hover:shadow-md ${
        isSelected ? 'border-blue-500 bg-blue-50' : isDragOver ? 'border-blue-400 bg-blue-50 scale-105' : 'border-gray-200 hover:border-gray-300'
      }`}
      onClick={onToggleSelect}
      onDoubleClick={onDoubleClick}
      onContextMenu={onContextMenu}
      draggable
      onDragStart={(e) => onDragStart?.(e, file)}
      onDragOver={isFolder ? onDragOver : undefined}
      onDragLeave={isFolder ? () => {} : undefined}
      onDrop={isFolder ? (e) => onDrop?.(e, file) : undefined}
    >
      {/* Star indicator */}
      {file.is_starred && (
        <div className="absolute top-2 left-2 z-10">
          <Star size={14} className="fill-yellow-400 text-yellow-400" />
        </div>
      )}

      {/* File preview */}
      <div className="p-4 flex items-center justify-center h-28">
        {file.thumbnail_url ? (
          <img
            src={file.thumbnail_url}
            alt={file.name}
            className="max-h-full max-w-full object-contain rounded"
          />
        ) : (
          <FileIcon
            size={48}
            className={file.file_type === 'folder' ? 'text-blue-500' : 'text-gray-400'}
          />
        )}
      </div>

      {/* File name */}
      <div className="px-3 pb-3">
        <p className="text-sm font-medium text-gray-900 truncate" title={file.name}>
          {file.name}
        </p>
        {file.file_type === 'file' && file.size && (
          <p className="text-xs text-gray-500 mt-0.5">{formatFileSize(file.size)}</p>
        )}
      </div>

      {/* Actions menu */}
      <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
        <FileContextMenu
          file={file}
          onStar={onStar}
          onDownload={onDownload}
          onShare={onShare}
          onRename={onRename}
          onMove={onMove}
          onTrash={onTrash}
          onRestore={onRestore}
          isTrash={isTrash}
        />
      </div>
    </div>
  );
}

// List Row Component
function FileListRow({
  file,
  isSelected,
  onToggleSelect,
  onDoubleClick,
  onContextMenu,
  onStar,
  onDownload,
  onShare,
  onRename,
  onMove,
  onTrash,
  onRestore,
  isTrash,
}: FileItemProps) {
  const FileIcon = getIconComponent(file);
  const modifiedDate = new Date(file.updated_at).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });

  return (
    <tr
      className={`group hover:bg-gray-50 cursor-pointer ${isSelected ? 'bg-blue-50' : ''}`}
      onClick={onToggleSelect}
      onDoubleClick={onDoubleClick}
      onContextMenu={onContextMenu}
    >
      <td className="px-4 py-3">
        <input
          type="checkbox"
          checked={isSelected}
          onChange={onToggleSelect}
          className="rounded"
          onClick={e => e.stopPropagation()}
        />
      </td>
      <td className="px-4 py-3">
        <div className="flex items-center gap-3">
          <FileIcon
            size={24}
            className={file.file_type === 'folder' ? 'text-blue-500' : 'text-gray-400'}
          />
          <span className="text-sm font-medium text-gray-900">{file.name}</span>
          {file.is_starred && (
            <Star size={14} className="fill-yellow-400 text-yellow-400" />
          )}
        </div>
      </td>
      <td className="px-4 py-3 text-sm text-gray-500">
        {file.file_type === 'file' && file.size ? formatFileSize(file.size) : '-'}
      </td>
      <td className="px-4 py-3 text-sm text-gray-500">{modifiedDate}</td>
      <td className="px-4 py-3">
        <div className="opacity-0 group-hover:opacity-100 transition-opacity">
          <FileContextMenu
            file={file}
            onStar={onStar}
            onDownload={onDownload}
            onShare={onShare}
            onRename={onRename}
            onMove={onMove}
            onTrash={onTrash}
            onRestore={onRestore}
            isTrash={isTrash}
          />
        </div>
      </td>
    </tr>
  );
}

// Context Menu Component
function FileContextMenu({
  file,
  onStar,
  onDownload,
  onShare,
  onRename,
  onMove,
  onTrash,
  onRestore,
  isTrash,
}: {
  file: DriveFile;
  onStar: () => void;
  onDownload: () => void;
  onShare: () => void;
  onRename: () => void;
  onMove: () => void;
  onTrash: () => void;
  onRestore: () => void;
  isTrash: boolean;
}) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="relative">
      <button
        onClick={(e) => {
          e.stopPropagation();
          setIsOpen(!isOpen);
        }}
        className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors"
      >
        <MoreVertical size={16} className="text-gray-500" />
      </button>

      {isOpen && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setIsOpen(false)} />
          <div className="absolute right-0 top-8 z-20 w-48 bg-white rounded-lg shadow-lg border border-gray-200 py-1">
            {isTrash ? (
              <>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onRestore();
                    setIsOpen(false);
                  }}
                  className="w-full flex items-center gap-2 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50"
                >
                  <RotateCcw size={16} />
                  Restore
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onTrash();
                    setIsOpen(false);
                  }}
                  className="w-full flex items-center gap-2 px-3 py-2 text-sm text-red-600 hover:bg-red-50"
                >
                  <Trash2 size={16} />
                  Delete permanently
                </button>
              </>
            ) : (
              <>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onStar();
                    setIsOpen(false);
                  }}
                  className="w-full flex items-center gap-2 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50"
                >
                  <Star size={16} className={file.is_starred ? 'fill-yellow-400 text-yellow-400' : ''} />
                  {file.is_starred ? 'Remove star' : 'Add star'}
                </button>
                {file.file_type === 'file' && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onDownload();
                      setIsOpen(false);
                    }}
                    className="w-full flex items-center gap-2 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50"
                  >
                    <Download size={16} />
                    Download
                  </button>
                )}
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onShare();
                    setIsOpen(false);
                  }}
                  className="w-full flex items-center gap-2 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50"
                >
                  <Share2 size={16} />
                  Share
                </button>
                <hr className="my-1" />
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onRename();
                    setIsOpen(false);
                  }}
                  className="w-full flex items-center gap-2 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50"
                >
                  <Pencil size={16} />
                  Rename
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onMove();
                    setIsOpen(false);
                  }}
                  className="w-full flex items-center gap-2 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50"
                >
                  <Move size={16} />
                  Move to
                </button>
                <hr className="my-1" />
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onTrash();
                    setIsOpen(false);
                  }}
                  className="w-full flex items-center gap-2 px-3 py-2 text-sm text-red-600 hover:bg-red-50"
                >
                  <Trash2 size={16} />
                  Move to trash
                </button>
              </>
            )}
          </div>
        </>
      )}
    </div>
  );
}

// Right-Click Context Menu Component
interface RightClickContextMenuProps {
  contextMenu: ContextMenuState;
  onClose: () => void;
  activeFilter: string;
  onStar: () => void;
  onDownload: () => void;
  onShare: () => void;
  onRename: () => void;
  onMove: () => void;
  onTrash: () => void;
  onRestore: () => void;
}

function RightClickContextMenu({
  contextMenu,
  onClose,
  activeFilter,
  onStar,
  onDownload,
  onShare,
  onRename,
  onMove,
  onTrash,
  onRestore,
}: RightClickContextMenuProps) {
  if (!contextMenu.isOpen || !contextMenu.file) return null;

  const file = contextMenu.file;
  const isTrash = activeFilter === 'trash';

  return (
    <div
      className="fixed z-50 w-52 bg-white rounded-lg shadow-xl border border-gray-200 py-1"
      style={{
        left: contextMenu.x,
        top: contextMenu.y,
      }}
      onClick={(e) => e.stopPropagation()}
    >
      {isTrash ? (
        <>
          <button
            onClick={() => {
              onRestore();
              onClose();
            }}
            className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50"
          >
            <RotateCcw size={16} />
            Restore
          </button>
          <hr className="my-1" />
          <button
            onClick={() => {
              onTrash();
              onClose();
            }}
            className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-red-600 hover:bg-red-50"
          >
            <Trash2 size={16} />
            Delete permanently
          </button>
        </>
      ) : (
        <>
          <button
            onClick={() => {
              onStar();
              onClose();
            }}
            className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50"
          >
            <Star size={16} className={file.is_starred ? 'fill-yellow-400 text-yellow-400' : ''} />
            {file.is_starred ? 'Remove star' : 'Add star'}
          </button>
          {file.file_type === 'file' && (
            <button
              onClick={() => {
                onDownload();
                onClose();
              }}
              className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50"
            >
              <Download size={16} />
              Download
            </button>
          )}
          <button
            onClick={() => {
              onShare();
              onClose();
            }}
            className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50"
          >
            <Share2 size={16} />
            Share
          </button>
          <hr className="my-1" />
          <button
            onClick={() => {
              onRename();
              onClose();
            }}
            className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50"
          >
            <Pencil size={16} />
            Rename
          </button>
          <button
            onClick={() => {
              onMove();
              onClose();
            }}
            className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50"
          >
            <Move size={16} />
            Move to
          </button>
          <button
            onClick={() => {
              // Copy functionality could be added here
              onClose();
            }}
            className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50"
          >
            <Copy size={16} />
            Make a copy
          </button>
          <hr className="my-1" />
          <button
            onClick={() => {
              onTrash();
              onClose();
            }}
            className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-red-600 hover:bg-red-50"
          >
            <Trash2 size={16} />
            Move to trash
          </button>
        </>
      )}
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
