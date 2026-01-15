/**
 * Bheem Drive - Modal Components
 */
import { useState, useEffect } from 'react';
import { X, Folder, Link, Copy, Check, Globe, Lock, Users } from 'lucide-react';
import { useDriveStore } from '@/stores/driveStore';
import * as driveApi from '@/lib/driveApi';
import type { DriveShare } from '@/lib/driveApi';

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
