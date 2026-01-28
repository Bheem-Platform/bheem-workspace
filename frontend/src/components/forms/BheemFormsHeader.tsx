/**
 * Bheem Forms Header Component
 * Custom branded header for the document forms editor
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
  Undo,
  Redo,
  Printer,
  FileText,
  Send,
  Eye,
  Edit3,
} from 'lucide-react';

interface BheemFormsHeaderProps {
  title: string;
  isStarred: boolean;
  isSaving: boolean;
  isSaved: boolean;
  version?: number;
  status?: 'draft' | 'published' | 'closed';
  formType?: 'docxf' | 'oform';
  responseCount?: number;
  onTitleChange: (title: string) => void;
  onToggleStar: () => void;
  onShare: () => void;
  onDownload: () => void;
  onShowHistory: () => void;
  onPublish?: () => void;
  onViewResponses?: () => void;
  onPreview?: () => void;
  onUndo?: () => void;
  onRedo?: () => void;
  onPrint?: () => void;
}

export default function BheemFormsHeader({
  title,
  isStarred,
  isSaving,
  isSaved,
  version,
  status = 'draft',
  formType = 'docxf',
  responseCount = 0,
  onTitleChange,
  onToggleStar,
  onShare,
  onDownload,
  onShowHistory,
  onPublish,
  onViewResponses,
  onPreview,
  onUndo,
  onRedo,
  onPrint,
}: BheemFormsHeaderProps) {
  const [editingTitle, setEditingTitle] = useState(false);
  const [localTitle, setLocalTitle] = useState(title);
  const titleInputRef = useRef<HTMLInputElement>(null);
  const titleSaveTimeoutRef = useRef<NodeJS.Timeout | null>(null);

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

  const getStatusBadge = () => {
    switch (status) {
      case 'published':
        return (
          <span className="px-2 py-0.5 bg-green-100 text-green-700 text-xs font-medium rounded-full">
            Published
          </span>
        );
      case 'closed':
        return (
          <span className="px-2 py-0.5 bg-gray-100 text-gray-700 text-xs font-medium rounded-full">
            Closed
          </span>
        );
      default:
        return (
          <span className="px-2 py-0.5 bg-yellow-100 text-yellow-700 text-xs font-medium rounded-full">
            Draft
          </span>
        );
    }
  };

  return (
    <header className="bg-white border-b border-gray-200 flex-shrink-0 z-20">
      {/* Main Header Row */}
      <div className="flex items-center px-3 py-2 gap-2">
        {/* Logo */}
        <Link href="/forms" className="flex items-center gap-2 hover:opacity-80 transition-opacity">
          <div className="w-10 h-10 bg-gradient-to-br from-[#FFCCF2] via-[#977DFF] to-[#0033FF] rounded-lg flex items-center justify-center shadow-sm">
            <FileText className="w-6 h-6 text-white" />
          </div>
          <span className="text-lg font-bold bg-gradient-to-r from-[#977DFF] to-[#0033FF] bg-clip-text text-transparent hidden sm:block">
            Bheem Forms
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
                className="text-lg font-medium text-gray-900 bg-transparent border-b-2 border-purple-500 focus:outline-none px-1 py-0.5 min-w-[200px]"
              />
            ) : (
              <button
                onClick={() => setEditingTitle(true)}
                className="text-lg font-medium text-gray-900 hover:bg-gray-100 rounded px-2 py-0.5 truncate max-w-[300px]"
                title="Click to rename"
              >
                {localTitle || 'Untitled form'}
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

            {/* Status Badge */}
            {getStatusBadge()}

            {/* Form Type Badge */}
            <span className="px-2 py-0.5 bg-purple-100 text-purple-700 text-xs font-medium rounded-full uppercase">
              {formType}
            </span>
          </div>

          {/* Status Row */}
          <div className="flex items-center gap-3 text-xs text-gray-500 mt-0.5 ml-2">
            {/* Save Status */}
            <div className="flex items-center gap-1">
              {isSaving ? (
                <>
                  <div className="w-3 h-3 border-2 border-purple-500 border-t-transparent rounded-full animate-spin" />
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

            {/* Response Count */}
            {responseCount > 0 && (
              <>
                <span className="text-gray-300">|</span>
                <span>{responseCount} response{responseCount !== 1 ? 's' : ''}</span>
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

          {/* Preview */}
          {onPreview && (
            <button
              onClick={onPreview}
              className="p-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
              title="Preview form"
            >
              <Eye className="w-5 h-5" />
            </button>
          )}

          {/* View Responses */}
          {onViewResponses && (
            <button
              onClick={onViewResponses}
              className="flex items-center gap-1 px-3 py-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
              title="View responses"
            >
              <Edit3 className="w-4 h-4" />
              <span className="text-sm">Responses</span>
              {responseCount > 0 && (
                <span className="ml-1 px-1.5 py-0.5 bg-purple-100 text-purple-700 text-xs font-medium rounded-full">
                  {responseCount}
                </span>
              )}
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

          <div className="w-px h-6 bg-gray-200 mx-1" />

          {/* Publish Button (if draft) */}
          {onPublish && status === 'draft' && (
            <button
              onClick={onPublish}
              className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-full hover:bg-green-700 transition-all font-medium text-sm shadow-sm"
            >
              <Send className="w-4 h-4" />
              Publish
            </button>
          )}

          {/* Share Button */}
          <button
            onClick={onShare}
            className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-[#977DFF] to-[#0033FF] text-white rounded-full hover:opacity-90 transition-all font-medium text-sm ml-2 shadow-sm"
          >
            <Share2 className="w-4 h-4" />
            Share
          </button>

          {/* More Options */}
          <button className="p-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors">
            <MoreHorizontal className="w-5 h-5" />
          </button>
        </div>
      </div>
    </header>
  );
}
