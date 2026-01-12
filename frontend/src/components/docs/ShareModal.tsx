import { useState } from 'react';
import { X, Link as LinkIcon, Copy, Check, Calendar, Globe, Lock } from 'lucide-react';
import { useDocsStore } from '@/stores/docsStore';

interface ShareModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function ShareModal({ isOpen, onClose }: ShareModalProps) {
  const { selectedForAction, createShareLink } = useDocsStore();

  const [shareUrl, setShareUrl] = useState<string | null>(null);
  const [expiresDays, setExpiresDays] = useState(7);
  const [isCreating, setIsCreating] = useState(false);
  const [copied, setCopied] = useState(false);

  if (!isOpen || !selectedForAction) return null;

  const handleCreateLink = async () => {
    setIsCreating(true);
    // Use file ID for V2 API (path for legacy)
    const url = await createShareLink(selectedForAction.id, expiresDays);
    if (url) {
      setShareUrl(url);
    }
    setIsCreating(false);
  };

  const handleCopy = async () => {
    if (shareUrl) {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleClose = () => {
    setShareUrl(null);
    setCopied(false);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50" onClick={handleClose} />

      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900">Share</h2>
          <button
            onClick={handleClose}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <X size={20} className="text-gray-500" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6">
          {/* File info */}
          <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg mb-6">
            <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center">
              <LinkIcon size={20} className="text-purple-600" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-medium text-gray-900 truncate">{selectedForAction.name}</p>
              <p className="text-sm text-gray-500">
                {selectedForAction.type === 'folder' ? 'Folder' : 'File'}
              </p>
            </div>
          </div>

          {shareUrl ? (
            /* Share link created */
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Share link
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={shareUrl}
                    readOnly
                    className="flex-1 px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm text-gray-700"
                  />
                  <button
                    onClick={handleCopy}
                    className="p-2 bg-purple-500 text-white rounded-lg hover:bg-purple-600 transition-colors"
                  >
                    {copied ? <Check size={20} /> : <Copy size={20} />}
                  </button>
                </div>
              </div>

              <div className="flex items-center gap-2 text-sm text-gray-500">
                <Globe size={16} />
                <span>Anyone with the link can view</span>
              </div>

              <div className="flex items-center gap-2 text-sm text-gray-500">
                <Calendar size={16} />
                <span>Expires in {expiresDays} days</span>
              </div>
            </div>
          ) : (
            /* Create share link form */
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Link expires in
                </label>
                <select
                  value={expiresDays}
                  onChange={(e) => setExpiresDays(Number(e.target.value))}
                  className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
                >
                  <option value={1}>1 day</option>
                  <option value={7}>7 days</option>
                  <option value={30}>30 days</option>
                  <option value={90}>90 days</option>
                  <option value={365}>1 year</option>
                </select>
              </div>

              <button
                onClick={handleCreateLink}
                disabled={isCreating}
                className="w-full py-3 px-4 bg-purple-500 text-white font-medium rounded-lg hover:bg-purple-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
              >
                {isCreating ? (
                  <>
                    <div className="animate-spin rounded-full h-5 w-5 border-2 border-white border-t-transparent" />
                    <span>Creating link...</span>
                  </>
                ) : (
                  <>
                    <LinkIcon size={20} />
                    <span>Create share link</span>
                  </>
                )}
              </button>

              <p className="text-xs text-gray-500 text-center">
                Anyone with the link will be able to view this {selectedForAction.type}
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
