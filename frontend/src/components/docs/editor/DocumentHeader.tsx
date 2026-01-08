/**
 * Bheem Docs - Document Header
 * Top bar with document title, menu, and actions
 */
import { useState, useRef, useEffect } from 'react';
import {
  FileText,
  Star,
  StarOff,
  Share2,
  MoreVertical,
  Download,
  History,
  MessageSquare,
  Sparkles,
  Search,
  Users,
  ChevronDown,
  Folder,
  Copy,
  Trash2,
  Move,
  Info,
  Lock,
  Globe,
  Check,
  Cloud,
  CloudOff,
} from 'lucide-react';
import ExportMenu from './ExportMenu';

interface DocumentHeaderProps {
  documentId: string;
  title: string;
  isFavorite: boolean;
  isShared: boolean;
  lastSaved?: Date;
  isSaving: boolean;
  isOnline: boolean;
  onTitleChange: (title: string) => void;
  onToggleFavorite: () => void;
  onShare: () => void;
  onToggleComments: () => void;
  onToggleHistory: () => void;
  onToggleAI: () => void;
  onToggleFind: () => void;
  onMoveToFolder: () => void;
  onDuplicate: () => void;
  onDelete: () => void;
  collaboratorCount?: number;
}

export default function DocumentHeader({
  documentId,
  title,
  isFavorite,
  isShared,
  lastSaved,
  isSaving,
  isOnline,
  onTitleChange,
  onToggleFavorite,
  onShare,
  onToggleComments,
  onToggleHistory,
  onToggleAI,
  onToggleFind,
  onMoveToFolder,
  onDuplicate,
  onDelete,
}: DocumentHeaderProps) {
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [editTitle, setEditTitle] = useState(title);
  const [showMoreMenu, setShowMoreMenu] = useState(false);
  const [showExportMenu, setShowExportMenu] = useState(false);
  const titleInputRef = useRef<HTMLInputElement>(null);
  const moreMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isEditingTitle && titleInputRef.current) {
      titleInputRef.current.focus();
      titleInputRef.current.select();
    }
  }, [isEditingTitle]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (moreMenuRef.current && !moreMenuRef.current.contains(e.target as Node)) {
        setShowMoreMenu(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleTitleSubmit = () => {
    if (editTitle.trim() && editTitle !== title) {
      onTitleChange(editTitle.trim());
    } else {
      setEditTitle(title);
    }
    setIsEditingTitle(false);
  };

  const handleTitleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleTitleSubmit();
    } else if (e.key === 'Escape') {
      setEditTitle(title);
      setIsEditingTitle(false);
    }
  };

  return (
    <div className="flex items-center justify-between px-4 py-2 bg-white border-b">
      {/* Left side - Logo and title */}
      <div className="flex items-center gap-4">
        {/* Document icon */}
        <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-blue-600 rounded-lg flex items-center justify-center">
          <FileText size={22} className="text-white" />
        </div>

        {/* Title and status */}
        <div>
          {isEditingTitle ? (
            <input
              ref={titleInputRef}
              type="text"
              value={editTitle}
              onChange={(e) => setEditTitle(e.target.value)}
              onBlur={handleTitleSubmit}
              onKeyDown={handleTitleKeyDown}
              className="text-lg font-semibold bg-transparent border-b-2 border-blue-500 focus:outline-none px-1 -ml-1"
            />
          ) : (
            <button
              onClick={() => setIsEditingTitle(true)}
              className="text-lg font-semibold text-gray-900 hover:bg-gray-100 px-1 -ml-1 rounded"
            >
              {title || 'Untitled Document'}
            </button>
          )}

          {/* Status indicators */}
          <div className="flex items-center gap-3 text-xs text-gray-500 mt-0.5">
            {/* Save status */}
            <span className="flex items-center gap-1">
              {isSaving ? (
                <>
                  <div className="w-2 h-2 rounded-full bg-yellow-500 animate-pulse" />
                  Saving...
                </>
              ) : lastSaved ? (
                <>
                  <Check size={12} className="text-green-500" />
                  Saved {lastSaved.toLocaleTimeString()}
                </>
              ) : null}
            </span>

            {/* Connection status */}
            <span className="flex items-center gap-1">
              {isOnline ? (
                <>
                  <Cloud size={12} className="text-green-500" />
                  Online
                </>
              ) : (
                <>
                  <CloudOff size={12} className="text-gray-400" />
                  Offline
                </>
              )}
            </span>

            {/* Share status */}
            {isShared && (
              <span className="flex items-center gap-1">
                <Globe size={12} className="text-blue-500" />
                Shared
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Right side - Actions */}
      <div className="flex items-center gap-1">
        {/* Favorite */}
        <button
          onClick={onToggleFavorite}
          className="p-2 hover:bg-gray-100 rounded-lg"
          title={isFavorite ? 'Remove from favorites' : 'Add to favorites'}
        >
          {isFavorite ? (
            <Star size={20} className="text-yellow-500 fill-yellow-500" />
          ) : (
            <StarOff size={20} className="text-gray-400" />
          )}
        </button>

        {/* Find */}
        <button
          onClick={onToggleFind}
          className="p-2 hover:bg-gray-100 rounded-lg"
          title="Find (Ctrl+F)"
        >
          <Search size={20} className="text-gray-600" />
        </button>

        {/* AI Assistant */}
        <button
          onClick={onToggleAI}
          className="p-2 hover:bg-gray-100 rounded-lg"
          title="AI Assistant"
        >
          <Sparkles size={20} className="text-purple-500" />
        </button>

        {/* Comments */}
        <button
          onClick={onToggleComments}
          className="p-2 hover:bg-gray-100 rounded-lg"
          title="Comments"
        >
          <MessageSquare size={20} className="text-gray-600" />
        </button>

        {/* History */}
        <button
          onClick={onToggleHistory}
          className="p-2 hover:bg-gray-100 rounded-lg"
          title="Version history"
        >
          <History size={20} className="text-gray-600" />
        </button>

        {/* Divider */}
        <div className="w-px h-6 bg-gray-200 mx-2" />

        {/* Export */}
        <div className="relative">
          <button
            onClick={() => setShowExportMenu(!showExportMenu)}
            className="p-2 hover:bg-gray-100 rounded-lg"
            title="Export"
          >
            <Download size={20} className="text-gray-600" />
          </button>
          {showExportMenu && (
            <ExportMenu
              documentId={documentId}
              documentTitle={title}
              onClose={() => setShowExportMenu(false)}
            />
          )}
        </div>

        {/* Share */}
        <button
          onClick={onShare}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
        >
          <Share2 size={18} />
          Share
        </button>

        {/* More menu */}
        <div ref={moreMenuRef} className="relative">
          <button
            onClick={() => setShowMoreMenu(!showMoreMenu)}
            className="p-2 hover:bg-gray-100 rounded-lg"
          >
            <MoreVertical size={20} className="text-gray-600" />
          </button>

          {showMoreMenu && (
            <div className="absolute right-0 top-full mt-2 bg-white border rounded-xl shadow-xl w-56 py-2 z-50">
              <button
                onClick={() => { onMoveToFolder(); setShowMoreMenu(false); }}
                className="w-full px-4 py-2 flex items-center gap-3 hover:bg-gray-50 text-sm text-gray-700"
              >
                <Move size={16} />
                Move to folder
              </button>
              <button
                onClick={() => { onDuplicate(); setShowMoreMenu(false); }}
                className="w-full px-4 py-2 flex items-center gap-3 hover:bg-gray-50 text-sm text-gray-700"
              >
                <Copy size={16} />
                Make a copy
              </button>
              <div className="border-t my-2" />
              <button
                onClick={() => { onDelete(); setShowMoreMenu(false); }}
                className="w-full px-4 py-2 flex items-center gap-3 hover:bg-red-50 text-sm text-red-600"
              >
                <Trash2 size={16} />
                Delete
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
