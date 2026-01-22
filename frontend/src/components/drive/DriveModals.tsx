/**
 * Bheem Drive - Modal Components
 */
import { useState, useEffect } from 'react';
import { X, Folder, Link, Copy, Check, Globe, Lock, Users, ChevronRight, ChevronDown, FolderOpen, Home, ArrowRight, Download, ZoomIn, ZoomOut, RotateCw, Maximize2, ChevronLeft } from 'lucide-react';
import { useDriveStore } from '@/stores/driveStore';
import * as driveApi from '@/lib/driveApi';
import type { DriveShare, DriveFile } from '@/lib/driveApi';

// Create Folder Modal
export function CreateFolderModal() {
  const { isCreateFolderModalOpen, closeCreateFolderModal, createFolder, loading } = useDriveStore();
  const [folderName, setFolderName] = useState('');

  useEffect(() => {
    if (isCreateFolderModalOpen) {
      setFolderName('');
    }
  }, [isCreateFolderModalOpen]);

  if (!isCreateFolderModalOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (folderName.trim()) {
      await createFolder(folderName.trim());
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50" onClick={closeCreateFolderModal} />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md p-6">
        <button
          onClick={closeCreateFolderModal}
          className="absolute top-4 right-4 p-1 hover:bg-gray-100 rounded-lg"
        >
          <X size={20} className="text-gray-500" />
        </button>

        <div className="flex items-center gap-3 mb-6">
          <div className="p-3 bg-blue-100 rounded-xl">
            <Folder size={24} className="text-blue-600" />
          </div>
          <h2 className="text-xl font-semibold text-gray-900">New Folder</h2>
        </div>

        <form onSubmit={handleSubmit}>
          <input
            type="text"
            value={folderName}
            onChange={(e) => setFolderName(e.target.value)}
            placeholder="Folder name"
            className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            autoFocus
          />

          <div className="flex justify-end gap-3 mt-6">
            <button
              type="button"
              onClick={closeCreateFolderModal}
              className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!folderName.trim() || loading}
              className="px-4 py-2 bg-blue-500 text-white font-medium rounded-lg hover:bg-blue-600 transition-colors disabled:opacity-50"
            >
              {loading ? 'Creating...' : 'Create'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// Rename Modal
export function RenameModal() {
  const { isRenameModalOpen, closeRenameModal, selectedFileForAction, renameFile, loading } = useDriveStore();
  const [newName, setNewName] = useState('');

  useEffect(() => {
    if (isRenameModalOpen && selectedFileForAction) {
      setNewName(selectedFileForAction.name);
    }
  }, [isRenameModalOpen, selectedFileForAction]);

  if (!isRenameModalOpen || !selectedFileForAction) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newName.trim() && newName !== selectedFileForAction.name) {
      await renameFile(selectedFileForAction.id, newName.trim());
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50" onClick={closeRenameModal} />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md p-6">
        <button
          onClick={closeRenameModal}
          className="absolute top-4 right-4 p-1 hover:bg-gray-100 rounded-lg"
        >
          <X size={20} className="text-gray-500" />
        </button>

        <h2 className="text-xl font-semibold text-gray-900 mb-6">Rename</h2>

        <form onSubmit={handleSubmit}>
          <input
            type="text"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="New name"
            className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            autoFocus
          />

          <div className="flex justify-end gap-3 mt-6">
            <button
              type="button"
              onClick={closeRenameModal}
              className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!newName.trim() || newName === selectedFileForAction.name || loading}
              className="px-4 py-2 bg-blue-500 text-white font-medium rounded-lg hover:bg-blue-600 transition-colors disabled:opacity-50"
            >
              {loading ? 'Renaming...' : 'Rename'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// Share Modal
export function ShareModal() {
  const { isShareModalOpen, closeShareModal, selectedFileForAction } = useDriveStore();
  const [shares, setShares] = useState<DriveShare[]>([]);
  const [email, setEmail] = useState('');
  const [permission, setPermission] = useState<'view' | 'comment' | 'edit'>('view');
  const [loading, setLoading] = useState(false);
  const [linkCopied, setLinkCopied] = useState(false);
  const [shareLink, setShareLink] = useState<string | null>(null);

  useEffect(() => {
    if (isShareModalOpen && selectedFileForAction) {
      fetchShares();
    }
  }, [isShareModalOpen, selectedFileForAction]);

  const fetchShares = async () => {
    if (!selectedFileForAction) return;
    try {
      const data = await driveApi.getShares(selectedFileForAction.id);
      setShares(data);

      // Check for existing link share
      const linkShare = data.find(s => s.is_link_share);
      if (linkShare && linkShare.link_token) {
        setShareLink(`${window.location.origin}/drive/shared/${linkShare.link_token}`);
      }
    } catch (err) {
      console.error('Failed to fetch shares:', err);
    }
  };

  const handleShare = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedFileForAction || !email.trim()) return;

    setLoading(true);
    try {
      await driveApi.shareFile(selectedFileForAction.id, {
        user_email: email.trim(),
        permission,
      });
      setEmail('');
      fetchShares();
    } catch (err) {
      console.error('Failed to share:', err);
    }
    setLoading(false);
  };

  const handleCreateLink = async () => {
    if (!selectedFileForAction) return;

    setLoading(true);
    try {
      const share = await driveApi.shareFile(selectedFileForAction.id, {
        permission: 'view',
        is_link_share: true,
      });
      if (share.link_token) {
        setShareLink(`${window.location.origin}/drive/shared/${share.link_token}`);
      }
      fetchShares();
    } catch (err) {
      console.error('Failed to create link:', err);
    }
    setLoading(false);
  };

  const handleCopyLink = () => {
    if (shareLink) {
      navigator.clipboard.writeText(shareLink);
      setLinkCopied(true);
      setTimeout(() => setLinkCopied(false), 2000);
    }
  };

  const handleRemoveShare = async (shareId: string) => {
    if (!selectedFileForAction) return;
    try {
      await driveApi.removeShare(selectedFileForAction.id, shareId);
      fetchShares();
      if (shares.find(s => s.id === shareId)?.is_link_share) {
        setShareLink(null);
      }
    } catch (err) {
      console.error('Failed to remove share:', err);
    }
  };

  if (!isShareModalOpen || !selectedFileForAction) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50" onClick={closeShareModal} />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-lg p-6">
        <button
          onClick={closeShareModal}
          className="absolute top-4 right-4 p-1 hover:bg-gray-100 rounded-lg"
        >
          <X size={20} className="text-gray-500" />
        </button>

        <h2 className="text-xl font-semibold text-gray-900 mb-2">
          Share "{selectedFileForAction.name}"
        </h2>
        <p className="text-sm text-gray-500 mb-6">
          Share this {selectedFileForAction.file_type} with others
        </p>

        {/* Share by email */}
        <form onSubmit={handleShare} className="mb-6">
          <div className="flex gap-2">
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Add people by email"
              className="flex-1 px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
            <select
              value={permission}
              onChange={(e) => setPermission(e.target.value as any)}
              className="px-3 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            >
              <option value="view">Viewer</option>
              <option value="comment">Commenter</option>
              <option value="edit">Editor</option>
            </select>
            <button
              type="submit"
              disabled={!email.trim() || loading}
              className="px-4 py-2.5 bg-blue-500 text-white font-medium rounded-lg hover:bg-blue-600 transition-colors disabled:opacity-50"
            >
              Share
            </button>
          </div>
        </form>

        {/* Link sharing */}
        <div className="p-4 bg-gray-50 rounded-xl mb-6">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Link size={18} className="text-gray-500" />
              <span className="font-medium text-gray-900">Get link</span>
            </div>
            {shareLink ? (
              <span className="flex items-center gap-1 text-sm text-green-600">
                <Globe size={14} />
                Anyone with the link
              </span>
            ) : (
              <span className="flex items-center gap-1 text-sm text-gray-500">
                <Lock size={14} />
                Restricted
              </span>
            )}
          </div>

          {shareLink ? (
            <div className="flex gap-2">
              <input
                type="text"
                value={shareLink}
                readOnly
                className="flex-1 px-3 py-2 bg-white border border-gray-200 rounded-lg text-sm text-gray-600"
              />
              <button
                onClick={handleCopyLink}
                className="flex items-center gap-1 px-3 py-2 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 text-sm"
              >
                {linkCopied ? <Check size={16} className="text-green-500" /> : <Copy size={16} />}
                {linkCopied ? 'Copied!' : 'Copy'}
              </button>
            </div>
          ) : (
            <button
              onClick={handleCreateLink}
              disabled={loading}
              className="w-full py-2 text-sm text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
            >
              Create shareable link
            </button>
          )}
        </div>

        {/* People with access */}
        {shares.filter(s => !s.is_link_share).length > 0 && (
          <div>
            <h3 className="text-sm font-medium text-gray-700 mb-3 flex items-center gap-2">
              <Users size={16} />
              People with access
            </h3>
            <div className="space-y-2">
              {shares.filter(s => !s.is_link_share).map(share => (
                <div key={share.id} className="flex items-center justify-between p-2 hover:bg-gray-50 rounded-lg">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
                      <span className="text-sm font-medium text-blue-600">
                        {share.user_email?.charAt(0).toUpperCase()}
                      </span>
                    </div>
                    <div>
                      <p className="text-sm font-medium text-gray-900">{share.user_email}</p>
                      <p className="text-xs text-gray-500 capitalize">{share.permission}</p>
                    </div>
                  </div>
                  <button
                    onClick={() => handleRemoveShare(share.id)}
                    className="p-1 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded"
                  >
                    <X size={16} />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// Delete Confirm Modal
export function DeleteConfirmModal() {
  const { isDeleteConfirmOpen, closeDeleteConfirm, selectedFileForAction, deleteFiles, activeFilter, loading } = useDriveStore();

  if (!isDeleteConfirmOpen || !selectedFileForAction) return null;

  const isPermanent = activeFilter === 'trash';

  const handleDelete = async () => {
    await deleteFiles([selectedFileForAction.id], isPermanent);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50" onClick={closeDeleteConfirm} />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-2">
          {isPermanent ? 'Delete permanently?' : 'Move to trash?'}
        </h2>
        <p className="text-gray-600 mb-6">
          {isPermanent
            ? `"${selectedFileForAction.name}" will be permanently deleted. This action cannot be undone.`
            : `"${selectedFileForAction.name}" will be moved to trash. You can restore it later.`}
        </p>
        <div className="flex justify-end gap-3">
          <button
            onClick={closeDeleteConfirm}
            className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleDelete}
            disabled={loading}
            className="px-4 py-2 bg-red-500 text-white font-medium rounded-lg hover:bg-red-600 transition-colors disabled:opacity-50"
          >
            {loading ? 'Deleting...' : (isPermanent ? 'Delete forever' : 'Move to trash')}
          </button>
        </div>
      </div>
    </div>
  );
}

// Upload Modal
export function UploadModal({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  const { uploadFiles } = useDriveStore();
  const [isDragging, setIsDragging] = useState(false);

  if (!isOpen) return null;

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);

    const files = Array.from(e.dataTransfer.files);
    if (files.length > 0) {
      await uploadFiles(files);
      onClose();
    }
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files ? Array.from(e.target.files) : [];
    if (files.length > 0) {
      await uploadFiles(files);
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-lg p-6">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-1 hover:bg-gray-100 rounded-lg"
        >
          <X size={20} className="text-gray-500" />
        </button>

        <h2 className="text-xl font-semibold text-gray-900 mb-6">Upload files</h2>

        <div
          onDragOver={(e) => {
            e.preventDefault();
            setIsDragging(true);
          }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={handleDrop}
          className={`border-2 border-dashed rounded-xl p-12 text-center transition-colors ${
            isDragging ? 'border-blue-500 bg-blue-50' : 'border-gray-300'
          }`}
        >
          <Folder size={48} className="mx-auto text-gray-400 mb-4" />
          <p className="text-gray-600 mb-2">Drag and drop files here</p>
          <p className="text-gray-400 text-sm mb-4">or</p>
          <label className="inline-block px-4 py-2 bg-blue-500 text-white font-medium rounded-lg hover:bg-blue-600 transition-colors cursor-pointer">
            Browse files
            <input
              type="file"
              multiple
              onChange={handleFileSelect}
              className="hidden"
            />
          </label>
        </div>
      </div>
    </div>
  );
}

// Folder Tree Item for Move Modal
interface FolderTreeItemProps {
  folder: DriveFile;
  level: number;
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  expandedIds: Set<string>;
  onToggleExpand: (id: string) => void;
  excludeId?: string; // The file being moved - can't move into itself
}

function FolderTreeItem({ folder, level, selectedId, onSelect, expandedIds, onToggleExpand, excludeId }: FolderTreeItemProps) {
  const [subFolders, setSubFolders] = useState<DriveFile[]>([]);
  const [loading, setLoading] = useState(false);
  const isExpanded = expandedIds.has(folder.id);
  const isSelected = selectedId === folder.id;
  const isExcluded = folder.id === excludeId;

  useEffect(() => {
    if (isExpanded && subFolders.length === 0) {
      loadSubFolders();
    }
  }, [isExpanded]);

  const loadSubFolders = async () => {
    setLoading(true);
    try {
      const files = await driveApi.listFiles({ parent_id: folder.id, file_type: 'folder' });
      setSubFolders(files);
    } catch (err) {
      console.error('Failed to load subfolders:', err);
    }
    setLoading(false);
  };

  const handleToggle = (e: React.MouseEvent) => {
    e.stopPropagation();
    onToggleExpand(folder.id);
  };

  if (isExcluded) return null;

  return (
    <div>
      <div
        onClick={() => !isExcluded && onSelect(folder.id)}
        className={`flex items-center gap-2 px-2 py-1.5 rounded-lg cursor-pointer transition-colors ${
          isSelected ? 'bg-blue-100 text-blue-700' : 'hover:bg-gray-100'
        } ${isExcluded ? 'opacity-50 cursor-not-allowed' : ''}`}
        style={{ paddingLeft: `${level * 16 + 8}px` }}
      >
        <button
          onClick={handleToggle}
          className="p-0.5 hover:bg-gray-200 rounded"
        >
          {isExpanded ? (
            <ChevronDown size={16} className="text-gray-500" />
          ) : (
            <ChevronRight size={16} className="text-gray-500" />
          )}
        </button>
        {isExpanded ? (
          <FolderOpen size={18} className="text-amber-500" />
        ) : (
          <Folder size={18} className="text-amber-500" />
        )}
        <span className="text-sm truncate">{folder.name}</span>
      </div>

      {isExpanded && (
        <div>
          {loading ? (
            <div className="text-xs text-gray-400 pl-12 py-1">Loading...</div>
          ) : subFolders.length > 0 ? (
            subFolders.map(subFolder => (
              <FolderTreeItem
                key={subFolder.id}
                folder={subFolder}
                level={level + 1}
                selectedId={selectedId}
                onSelect={onSelect}
                expandedIds={expandedIds}
                onToggleExpand={onToggleExpand}
                excludeId={excludeId}
              />
            ))
          ) : (
            <div className="text-xs text-gray-400 pl-12 py-1">No subfolders</div>
          )}
        </div>
      )}
    </div>
  );
}

// Move Modal
export function MoveModal() {
  const { isMoveModalOpen, closeMoveModal, selectedFileForAction, moveFile, loading } = useDriveStore();
  const [selectedDestination, setSelectedDestination] = useState<string | null>(null);
  const [rootFolders, setRootFolders] = useState<DriveFile[]>([]);
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [loadingFolders, setLoadingFolders] = useState(false);

  useEffect(() => {
    if (isMoveModalOpen) {
      setSelectedDestination(null);
      setExpandedIds(new Set());
      loadRootFolders();
    }
  }, [isMoveModalOpen]);

  const loadRootFolders = async () => {
    setLoadingFolders(true);
    try {
      const files = await driveApi.listFiles({ file_type: 'folder' });
      // Filter to only root folders (no parent_id)
      const rootOnly = files.filter(f => !f.parent_id);
      setRootFolders(rootOnly);
    } catch (err) {
      console.error('Failed to load folders:', err);
    }
    setLoadingFolders(false);
  };

  const handleToggleExpand = (id: string) => {
    setExpandedIds(prev => {
      const newSet = new Set(prev);
      if (newSet.has(id)) {
        newSet.delete(id);
      } else {
        newSet.add(id);
      }
      return newSet;
    });
  };

  const handleMove = async () => {
    if (selectedFileForAction) {
      await moveFile(selectedFileForAction.id, selectedDestination);
    }
  };

  if (!isMoveModalOpen || !selectedFileForAction) return null;

  const isFolder = selectedFileForAction.file_type === 'folder';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50" onClick={closeMoveModal} />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md p-6">
        <button
          onClick={closeMoveModal}
          className="absolute top-4 right-4 p-1 hover:bg-gray-100 rounded-lg"
        >
          <X size={20} className="text-gray-500" />
        </button>

        <div className="flex items-center gap-3 mb-2">
          <div className="p-2.5 bg-blue-100 rounded-xl">
            <ArrowRight size={20} className="text-blue-600" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-gray-900">Move</h2>
            <p className="text-sm text-gray-500 truncate max-w-[280px]">
              {selectedFileForAction.name}
            </p>
          </div>
        </div>

        <p className="text-sm text-gray-600 mb-4">
          Select a destination folder:
        </p>

        {/* Folder Tree */}
        <div className="border border-gray-200 rounded-xl max-h-72 overflow-y-auto mb-4">
          {/* My Drive (root) option */}
          <div
            onClick={() => setSelectedDestination(null)}
            className={`flex items-center gap-2 px-3 py-2.5 cursor-pointer transition-colors border-b border-gray-100 ${
              selectedDestination === null ? 'bg-blue-100 text-blue-700' : 'hover:bg-gray-50'
            }`}
          >
            <Home size={18} className="text-blue-500" />
            <span className="font-medium text-sm">My Drive</span>
          </div>

          {loadingFolders ? (
            <div className="p-4 text-center text-gray-500 text-sm">Loading folders...</div>
          ) : rootFolders.length === 0 ? (
            <div className="p-4 text-center text-gray-400 text-sm">No folders available</div>
          ) : (
            <div className="py-1">
              {rootFolders.map(folder => (
                <FolderTreeItem
                  key={folder.id}
                  folder={folder}
                  level={0}
                  selectedId={selectedDestination}
                  onSelect={setSelectedDestination}
                  expandedIds={expandedIds}
                  onToggleExpand={handleToggleExpand}
                  excludeId={isFolder ? selectedFileForAction.id : undefined}
                />
              ))}
            </div>
          )}
        </div>

        {/* Info text */}
        {selectedDestination === selectedFileForAction.parent_id && (
          <p className="text-sm text-amber-600 mb-4">
            This is the current location
          </p>
        )}

        <div className="flex justify-end gap-3">
          <button
            onClick={closeMoveModal}
            className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleMove}
            disabled={loading || selectedDestination === selectedFileForAction.parent_id}
            className="px-4 py-2 bg-blue-500 text-white font-medium rounded-lg hover:bg-blue-600 transition-colors disabled:opacity-50"
          >
            {loading ? 'Moving...' : 'Move here'}
          </button>
        </div>
      </div>
    </div>
  );
}

// File Preview Modal
interface FilePreviewModalProps {
  file: DriveFile | null;
  isOpen: boolean;
  onClose: () => void;
  onDownload?: () => void;
  files?: DriveFile[]; // For navigation between files
  onNavigate?: (file: DriveFile) => void;
}

export function FilePreviewModal({ file, isOpen, onClose, onDownload, files, onNavigate }: FilePreviewModalProps) {
  const [zoom, setZoom] = useState(1);
  const [rotation, setRotation] = useState(0);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      setZoom(1);
      setRotation(0);
      setLoading(true);
      setError(null);
    }
  }, [isOpen, file?.id]);

  // Keyboard shortcuts
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (isFullscreen) {
          setIsFullscreen(false);
        } else {
          onClose();
        }
      } else if (e.key === '+' || e.key === '=') {
        setZoom(z => Math.min(z + 0.25, 3));
      } else if (e.key === '-') {
        setZoom(z => Math.max(z - 0.25, 0.25));
      } else if (e.key === 'r') {
        setRotation(r => (r + 90) % 360);
      } else if (e.key === 'ArrowLeft' && files && onNavigate) {
        navigatePrev();
      } else if (e.key === 'ArrowRight' && files && onNavigate) {
        navigateNext();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, isFullscreen, files, onNavigate]);

  const navigatePrev = () => {
    if (!files || !file || !onNavigate) return;
    const previewableFiles = files.filter(f => isPreviewable(f));
    const currentIndex = previewableFiles.findIndex(f => f.id === file.id);
    if (currentIndex > 0) {
      onNavigate(previewableFiles[currentIndex - 1]);
    }
  };

  const navigateNext = () => {
    if (!files || !file || !onNavigate) return;
    const previewableFiles = files.filter(f => isPreviewable(f));
    const currentIndex = previewableFiles.findIndex(f => f.id === file.id);
    if (currentIndex < previewableFiles.length - 1) {
      onNavigate(previewableFiles[currentIndex + 1]);
    }
  };

  if (!isOpen || !file) return null;

  const isImage = file.mime_type?.startsWith('image/');
  const isPdf = file.mime_type?.includes('pdf');
  const previewUrl = driveApi.getPreviewUrl(file.id);
  const downloadUrl = driveApi.getDownloadUrl(file.id);

  const hasPrev = files && files.filter(f => isPreviewable(f)).findIndex(f => f.id === file.id) > 0;
  const hasNext = files && files.filter(f => isPreviewable(f)).findIndex(f => f.id === file.id) < files.filter(f => isPreviewable(f)).length - 1;

  return (
    <div className={`fixed inset-0 z-50 ${isFullscreen ? '' : 'p-4'} flex items-center justify-center`}>
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/90" onClick={onClose} />

      {/* Content */}
      <div className={`relative flex flex-col ${isFullscreen ? 'w-full h-full' : 'w-full max-w-6xl h-[90vh]'} bg-gray-900 rounded-lg overflow-hidden`}>
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 bg-gray-800/50 border-b border-gray-700">
          <div className="flex items-center gap-3">
            <h3 className="text-white font-medium truncate max-w-md">{file.name}</h3>
            {file.size && (
              <span className="text-gray-400 text-sm">{driveApi.formatFileSize(file.size)}</span>
            )}
          </div>

          <div className="flex items-center gap-2">
            {/* Zoom controls for images */}
            {isImage && (
              <>
                <button
                  onClick={() => setZoom(z => Math.max(z - 0.25, 0.25))}
                  className="p-2 text-gray-300 hover:text-white hover:bg-gray-700 rounded-lg transition-colors"
                  title="Zoom out"
                >
                  <ZoomOut size={18} />
                </button>
                <span className="text-gray-400 text-sm w-14 text-center">{Math.round(zoom * 100)}%</span>
                <button
                  onClick={() => setZoom(z => Math.min(z + 0.25, 3))}
                  className="p-2 text-gray-300 hover:text-white hover:bg-gray-700 rounded-lg transition-colors"
                  title="Zoom in"
                >
                  <ZoomIn size={18} />
                </button>
                <button
                  onClick={() => setRotation(r => (r + 90) % 360)}
                  className="p-2 text-gray-300 hover:text-white hover:bg-gray-700 rounded-lg transition-colors"
                  title="Rotate"
                >
                  <RotateCw size={18} />
                </button>
                <div className="w-px h-6 bg-gray-600 mx-1" />
              </>
            )}

            {/* Fullscreen toggle */}
            <button
              onClick={() => setIsFullscreen(f => !f)}
              className="p-2 text-gray-300 hover:text-white hover:bg-gray-700 rounded-lg transition-colors"
              title={isFullscreen ? 'Exit fullscreen' : 'Fullscreen'}
            >
              <Maximize2 size={18} />
            </button>

            {/* Download */}
            <button
              onClick={onDownload || (() => window.open(downloadUrl, '_blank'))}
              className="p-2 text-gray-300 hover:text-white hover:bg-gray-700 rounded-lg transition-colors"
              title="Download"
            >
              <Download size={18} />
            </button>

            {/* Close */}
            <button
              onClick={onClose}
              className="p-2 text-gray-300 hover:text-white hover:bg-gray-700 rounded-lg transition-colors"
              title="Close (Esc)"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Preview content */}
        <div className="flex-1 flex items-center justify-center overflow-hidden relative">
          {/* Navigation arrows */}
          {files && onNavigate && (
            <>
              {hasPrev && (
                <button
                  onClick={navigatePrev}
                  className="absolute left-4 z-10 p-3 bg-black/50 hover:bg-black/70 text-white rounded-full transition-colors"
                  title="Previous (←)"
                >
                  <ChevronLeft size={24} />
                </button>
              )}
              {hasNext && (
                <button
                  onClick={navigateNext}
                  className="absolute right-4 z-10 p-3 bg-black/50 hover:bg-black/70 text-white rounded-full transition-colors"
                  title="Next (→)"
                >
                  <ChevronRight size={24} />
                </button>
              )}
            </>
          )}

          {loading && (
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white" />
            </div>
          )}

          {error && (
            <div className="text-center text-red-400">
              <p className="mb-2">Failed to load preview</p>
              <button
                onClick={() => window.open(downloadUrl, '_blank')}
                className="text-blue-400 hover:text-blue-300 underline"
              >
                Download file instead
              </button>
            </div>
          )}

          {isImage && (
            <div className="w-full h-full flex items-center justify-center overflow-auto p-4">
              <img
                src={previewUrl}
                alt={file.name}
                className="max-w-full max-h-full object-contain transition-transform duration-200"
                style={{
                  transform: `scale(${zoom}) rotate(${rotation}deg)`,
                  transformOrigin: 'center center',
                }}
                onLoad={() => setLoading(false)}
                onError={() => {
                  setLoading(false);
                  setError('Failed to load image');
                }}
              />
            </div>
          )}

          {isPdf && (
            <iframe
              src={previewUrl}
              className="w-full h-full border-0"
              title={file.name}
              onLoad={() => setLoading(false)}
              onError={() => {
                setLoading(false);
                setError('Failed to load PDF');
              }}
            />
          )}

          {!isImage && !isPdf && (
            <div className="text-center text-gray-400">
              <p className="mb-4">Preview not available for this file type</p>
              <button
                onClick={() => window.open(downloadUrl, '_blank')}
                className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors"
              >
                Download file
              </button>
            </div>
          )}
        </div>

        {/* Footer with file info */}
        <div className="px-4 py-2 bg-gray-800/50 border-t border-gray-700 text-sm text-gray-400">
          <div className="flex items-center justify-between">
            <span>Type: {file.mime_type || 'Unknown'}</span>
            {files && (
              <span>
                {files.filter(f => isPreviewable(f)).findIndex(f => f.id === file.id) + 1} of {files.filter(f => isPreviewable(f)).length}
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// Helper to check if file is previewable
function isPreviewable(file: DriveFile): boolean {
  if (file.file_type !== 'file') return false;
  const mime = file.mime_type || '';
  return mime.startsWith('image/') || mime.includes('pdf');
}
