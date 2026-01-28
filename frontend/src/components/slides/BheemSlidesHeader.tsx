/**
 * Bheem Slides Header Component
 * Custom branded header for the presentation editor
 */
import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import {
  Star,
  StarOff,
  Share2,
  Download,
  History,
  MoreHorizontal,
  Cloud,
  CloudOff,
  Play,
  Undo,
  Redo,
  Printer,
  Presentation,
} from 'lucide-react';

interface BheemSlidesHeaderProps {
  title: string;
  isStarred: boolean;
  isSaving: boolean;
  isSaved: boolean;
  version?: number;
  onTitleChange: (title: string) => void;
  onToggleStar: () => void;
  onShare: () => void;
  onDownload: () => void;
  onShowHistory: () => void;
  onPresent?: () => void;
  onUndo?: () => void;
  onRedo?: () => void;
  onPrint?: () => void;
}

export default function BheemSlidesHeader({
  title,
  isStarred,
  isSaving,
  isSaved,
  version,
  onTitleChange,
  onToggleStar,
  onShare,
  onDownload,
  onShowHistory,
  onPresent,
  onUndo,
  onRedo,
  onPrint,
}: BheemSlidesHeaderProps) {
  const [editingTitle, setEditingTitle] = useState(false);
  const [localTitle, setLocalTitle] = useState(title);
  const [showMoreMenu, setShowMoreMenu] = useState(false);
  const titleInputRef = useRef<HTMLInputElement>(null);
  const titleSaveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const moreMenuRef = useRef<HTMLDivElement>(null);

  // Close menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (moreMenuRef.current && !moreMenuRef.current.contains(event.target as Node)) {
        setShowMoreMenu(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    setLocalTitle(title);
  }, [title]);

  useEffect(() => {
    if (editingTitle && titleInputRef.current) {
      titleInputRef.current.focus();
      titleInputRef.current.select();
    }
  }, [editingTitle]);

  const handleTitleChange = (newTitle: string) => {
    setLocalTitle(newTitle);

    // Debounced save
    if (titleSaveTimeoutRef.current) {
      clearTimeout(titleSaveTimeoutRef.current);
    }
    titleSaveTimeoutRef.current = setTimeout(() => {
      onTitleChange(newTitle);
    }, 1000);
  };

  const handleTitleBlur = () => {
    setEditingTitle(false);
    if (titleSaveTimeoutRef.current) {
      clearTimeout(titleSaveTimeoutRef.current);
    }
    onTitleChange(localTitle);
  };

  return (
    <header className="bg-white border-b border-gray-200 flex-shrink-0 z-20">
      {/* Main Header Row */}
      <div className="flex items-center px-3 py-2 gap-2">
        {/* Logo */}
        <Link href="/slides" className="flex items-center gap-2 hover:opacity-80 transition-opacity">
          <div className="w-10 h-10 bg-gradient-to-br from-[#FFCCF2] via-[#977DFF] to-[#0033FF] rounded-lg flex items-center justify-center shadow-sm">
            <Presentation className="w-6 h-6 text-white" />
          </div>
          <span className="text-lg font-bold bg-gradient-to-r from-[#977DFF] to-[#0033FF] bg-clip-text text-transparent hidden sm:block">
            Bheem Slides
          </span>
        </Link>

        {/* Title and Status Section */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            {editingTitle ? (
              <input
                ref={titleInputRef}
                type="text"
                value={localTitle}
                onChange={(e) => handleTitleChange(e.target.value)}
                onBlur={handleTitleBlur}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    handleTitleBlur();
                  }
                }}
                className="text-lg font-medium text-gray-900 bg-transparent border-b-2 border-[#977DFF] focus:outline-none px-1 py-0.5 min-w-[200px]"
              />
            ) : (
              <button
                onClick={() => setEditingTitle(true)}
                className="text-lg font-medium text-gray-900 hover:bg-gray-100 rounded px-2 py-0.5 truncate max-w-[300px]"
                title="Click to rename"
              >
                {localTitle || 'Untitled presentation'}
              </button>
            )}

            {/* Star Button */}
            <button
              onClick={onToggleStar}
              className="p-1.5 hover:bg-gray-100 rounded-full transition-colors"
              title={isStarred ? 'Remove from starred' : 'Add to starred'}
            >
              {isStarred ? (
                <Star className="w-5 h-5 text-yellow-500 fill-yellow-500" />
              ) : (
                <StarOff className="w-5 h-5 text-gray-400" />
              )}
            </button>
          </div>

          {/* Status Row */}
          <div className="flex items-center gap-3 text-xs text-gray-500 mt-0.5 ml-2">
            {/* Save Status */}
            <div className="flex items-center gap-1">
              {isSaving ? (
                <>
                  <div className="w-3 h-3 border-2 border-[#977DFF] border-t-transparent rounded-full animate-spin" />
                  <span>Saving...</span>
                </>
              ) : isSaved ? (
                <>
                  <Cloud className="w-3 h-3 text-green-500" />
                  <span>All changes saved</span>
                </>
              ) : (
                <>
                  <CloudOff className="w-3 h-3 text-gray-400" />
                  <span>Connecting...</span>
                </>
              )}
            </div>

            {/* Version */}
            {version && version > 1 && (
              <>
                <span className="text-gray-300">|</span>
                <span>Version {version}</span>
              </>
            )}
          </div>
        </div>

        {/* Quick Actions */}
        <div className="flex items-center gap-1">
          {/* Undo/Redo */}
          {onUndo && (
            <button
              onClick={onUndo}
              className="p-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
              title="Undo (Ctrl+Z)"
            >
              <Undo className="w-5 h-5" />
            </button>
          )}
          {onRedo && (
            <button
              onClick={onRedo}
              className="p-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
              title="Redo (Ctrl+Y)"
            >
              <Redo className="w-5 h-5" />
            </button>
          )}

          {/* Print */}
          {onPrint && (
            <button
              onClick={onPrint}
              className="p-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
              title="Print"
            >
              <Printer className="w-5 h-5" />
            </button>
          )}

          <div className="w-px h-6 bg-gray-200 mx-1" />

          {/* Present Button */}
          {onPresent && (
            <button
              onClick={onPresent}
              className="flex items-center gap-2 px-3 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors font-medium text-sm"
              title="Start presentation"
            >
              <Play className="w-4 h-4" />
              Present
            </button>
          )}

          {/* History */}
          <button
            onClick={onShowHistory}
            className="p-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
            title="Version history"
          >
            <History className="w-5 h-5" />
          </button>

          {/* Download */}
          <button
            onClick={onDownload}
            className="p-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
            title="Download"
          >
            <Download className="w-5 h-5" />
          </button>

          {/* Share Button */}
          <button
            onClick={onShare}
            className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-[#977DFF] to-[#0033FF] text-white rounded-full hover:opacity-90 transition-all font-medium text-sm ml-2 shadow-sm"
          >
            <Share2 className="w-4 h-4" />
            Share
          </button>

          {/* More Options */}
          <div className="relative" ref={moreMenuRef}>
            <button
              onClick={() => setShowMoreMenu(!showMoreMenu)}
              className="p-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <MoreHorizontal className="w-5 h-5" />
            </button>

            {showMoreMenu && (
              <div className="absolute right-0 top-full mt-1 w-56 bg-white border border-gray-200 rounded-lg shadow-lg z-50 py-1">
                <button
                  onClick={() => {
                    onDownload();
                    setShowMoreMenu(false);
                  }}
                  className="w-full flex items-center gap-3 px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                >
                  <Download className="w-4 h-4" />
                  Download as PPTX
                </button>
                {onPrint && (
                  <button
                    onClick={() => {
                      onPrint();
                      setShowMoreMenu(false);
                    }}
                    className="w-full flex items-center gap-3 px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                  >
                    <Printer className="w-4 h-4" />
                    Print
                  </button>
                )}
                <div className="border-t border-gray-100 my-1" />
                <button
                  onClick={() => {
                    onShowHistory();
                    setShowMoreMenu(false);
                  }}
                  className="w-full flex items-center gap-3 px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                >
                  <History className="w-4 h-4" />
                  Version history
                </button>
                <button
                  onClick={() => {
                    onShare();
                    setShowMoreMenu(false);
                  }}
                  className="w-full flex items-center gap-3 px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                >
                  <Share2 className="w-4 h-4" />
                  Share
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}
