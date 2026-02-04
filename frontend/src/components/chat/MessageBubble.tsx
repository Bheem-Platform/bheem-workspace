/**
 * Single message bubble component
 */

import { useState, useEffect } from 'react';
import dynamic from 'next/dynamic';
import { Check, CheckCheck, MoreVertical, Pencil, Trash2, Reply, Smile, Download, ExternalLink, FileText, Play, Forward } from 'lucide-react';
import type { Message, Attachment } from '@/stores/chatStore';

// Dynamic import for PDF components (client-side only)
const PDFDocument = dynamic(
  () => import('react-pdf').then((mod) => {
    // Set up PDF.js worker - use local file to avoid CORS issues
    mod.pdfjs.GlobalWorkerOptions.workerSrc = '/pdf/pdf.worker.min.mjs';
    return mod.Document;
  }),
  { ssr: false }
);

const PDFPage = dynamic(
  () => import('react-pdf').then((mod) => mod.Page),
  { ssr: false }
);

interface MessageBubbleProps {
  message: Message;
  isOwnMessage: boolean;
  showSender: boolean;
  isGroupChat?: boolean;  // To show "Read by X" link
  totalParticipants?: number;  // Total participants excluding sender
  onEdit?: () => void;
  onDelete?: () => void;
  onReply?: () => void;
  onForward?: () => void;
  onReaction?: (emoji: string) => void;
  onImageClick?: (url: string) => void;
  onShowReadReceipts?: (messageId: string) => void;  // Open read receipts modal
}

// Common emoji reactions
const QUICK_REACTIONS = ['👍', '❤️', '😂', '😮', '😢', '🎉'];

export default function MessageBubble({
  message,
  isOwnMessage,
  showSender,
  isGroupChat = false,
  totalParticipants = 0,
  onEdit,
  onDelete,
  onReply,
  onForward,
  onReaction,
  onImageClick,
  onShowReadReceipts,
}: MessageBubbleProps) {
  const [showActions, setShowActions] = useState(false);
  const [showReactions, setShowReactions] = useState(false);

  const formatTime = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  // Handle deleted messages
  if (message.is_deleted) {
    return (
      <div className={`flex ${isOwnMessage ? 'justify-end' : 'justify-start'} px-4 py-1`}>
        <div className="px-4 py-2 rounded-2xl bg-gray-100 text-gray-400 italic text-sm">
          This message was deleted
        </div>
      </div>
    );
  }

  // System message
  if (message.message_type === 'system') {
    return (
      <div className="flex justify-center px-4 py-2">
        <div className="px-3 py-1 rounded-full bg-gray-100 text-gray-500 text-xs">
          {message.content}
        </div>
      </div>
    );
  }

  // Call message
  if (message.message_type === 'call') {
    return (
      <div className={`flex ${isOwnMessage ? 'justify-end' : 'justify-start'} px-4 py-1`}>
        <div className="flex items-center gap-2 px-4 py-2 rounded-2xl bg-gray-100 text-gray-600 text-sm">
          <span>📞</span>
          <span>{message.content || 'Audio call'}</span>
        </div>
      </div>
    );
  }

  // Render reactions
  const renderReactions = () => {
    const reactions = message.reactions || {};
    const entries = Object.entries(reactions).filter(([_, users]) => users.length > 0);

    if (entries.length === 0) return null;

    return (
      <div className="flex flex-wrap gap-1 mt-1">
        {entries.map(([emoji, users]) => (
          <button
            key={emoji}
            onClick={() => onReaction?.(emoji)}
            className={`
              inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs
              ${users.some((u) => isOwnMessage) ? 'bg-gradient-to-r from-[#FFCCF2] via-[#977DFF]/20 to-[#0033FF]/10' : 'bg-gray-100'}
              hover:bg-gray-200 transition-colors
            `}
          >
            <span>{emoji}</span>
            <span className="text-gray-600">{users.length}</span>
          </button>
        ))}
      </div>
    );
  };

  // Render attachments
  const renderAttachments = () => {
    if (!message.attachments || message.attachments.length === 0) return null;

    return (
      <div className="space-y-2 mb-1">
        {message.attachments.map((attachment) => (
          <AttachmentItem
            key={attachment.id}
            attachment={attachment}
            onImageClick={onImageClick}
            isOwnMessage={isOwnMessage}
          />
        ))}
      </div>
    );
  };

  return (
    <div
      className={`group flex ${isOwnMessage ? 'justify-end' : 'justify-start'} px-4 py-1`}
      onMouseEnter={() => setShowActions(true)}
      onMouseLeave={() => {
        setShowActions(false);
        setShowReactions(false);
      }}
    >
      <div className={`relative max-w-[70%] ${isOwnMessage ? 'order-2' : 'order-1'}`}>
        {/* Sender name for group chats */}
        {showSender && !isOwnMessage && (
          <div className="text-xs font-medium text-gray-600 mb-1 ml-1">
            {message.sender_name}
            {message.is_external_sender && (
              <ExternalLink size={10} className="inline ml-1 text-gray-400" />
            )}
          </div>
        )}

        {/* Message content */}
        <div
          className={`
            px-4 py-2 rounded-2xl
            ${isOwnMessage
              ? 'bg-gradient-to-r from-[#977DFF] to-[#0033FF] text-white rounded-br-md'
              : 'bg-white text-black border border-gray-200 rounded-bl-md shadow-sm'
            }
          `}
        >
          {/* Attachments */}
          {renderAttachments()}

          {/* Text content */}
          {message.content && (
            <p className="text-sm whitespace-pre-wrap break-words">{message.content}</p>
          )}

          {/* Time and status */}
          <div className={`flex items-center justify-end gap-1 mt-1 ${isOwnMessage ? 'text-white/70' : 'text-gray-400'}`}>
            {message.is_edited && <span className="text-xs">edited</span>}
            <span className="text-xs">{formatTime(message.created_at)}</span>
            {isOwnMessage && (
              <span className="ml-1 flex items-center">
                {message.read_by.length > 0 ? (
                  // Blue double check - read by at least one person
                  <CheckCheck size={14} className="text-[#0033FF]" />
                ) : message.delivered_to.length > 0 ? (
                  // Gray double check - delivered but not read
                  <CheckCheck size={14} className={isOwnMessage ? 'text-white/60' : 'text-gray-400'} />
                ) : (
                  // Single check - sent but not delivered
                  <Check size={14} className={isOwnMessage ? 'text-white/60' : 'text-gray-400'} />
                )}
              </span>
            )}
          </div>

          {/* Read by indicator for group chats (only for own messages) */}
          {isOwnMessage && isGroupChat && message.read_by.length > 0 && (
            <button
              onClick={() => onShowReadReceipts?.(message.id)}
              className="text-xs text-right w-full mt-0.5 text-white/80 hover:text-white hover:underline transition-colors"
            >
              Read by {message.read_by.length}{totalParticipants > 0 ? ` of ${totalParticipants}` : ''}
            </button>
          )}
        </div>

        {/* Reactions */}
        {renderReactions()}

        {/* Action buttons */}
        {showActions && (
          <div
            className={`
              absolute top-0 flex items-center gap-1 bg-white rounded-lg shadow-lg border border-gray-200 p-1
              ${isOwnMessage ? 'right-full mr-2' : 'left-full ml-2'}
            `}
          >
            <button
              onClick={() => setShowReactions(!showReactions)}
              className="p-1.5 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded"
              title="React"
            >
              <Smile size={16} />
            </button>
            <button
              onClick={onReply}
              className="p-1.5 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded"
              title="Reply"
            >
              <Reply size={16} />
            </button>
            <button
              onClick={onForward}
              className="p-1.5 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded"
              title="Forward"
            >
              <Forward size={16} />
            </button>
            {isOwnMessage && (
              <>
                <button
                  onClick={onEdit}
                  className="p-1.5 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded"
                  title="Edit"
                >
                  <Pencil size={16} />
                </button>
                <button
                  onClick={onDelete}
                  className="p-1.5 text-red-500 hover:text-red-700 hover:bg-red-50 rounded"
                  title="Delete"
                >
                  <Trash2 size={16} />
                </button>
              </>
            )}
          </div>
        )}

        {/* Quick reactions popup */}
        {showReactions && (
          <div
            className={`
              absolute top-8 flex items-center gap-1 bg-white rounded-full shadow-lg border border-gray-200 p-1
              ${isOwnMessage ? 'right-0' : 'left-0'}
            `}
          >
            {QUICK_REACTIONS.map((emoji) => (
              <button
                key={emoji}
                onClick={() => {
                  onReaction?.(emoji);
                  setShowReactions(false);
                }}
                className="p-1.5 hover:bg-gray-100 rounded-full transition-transform hover:scale-125"
              >
                {emoji}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// Get file type info for styling
function getFileTypeInfo(fileName: string, fileType?: string) {
  const extension = fileName.split('.').pop()?.toLowerCase() || '';

  if (fileType === 'application/pdf' || extension === 'pdf') {
    return { icon: '📄', color: 'bg-red-500', label: 'PDF', textColor: 'text-red-600' };
  }
  if (fileType?.includes('word') || ['doc', 'docx'].includes(extension)) {
    return { icon: '📝', color: 'bg-blue-500', label: 'DOC', textColor: 'text-blue-600' };
  }
  if (fileType?.includes('excel') || fileType?.includes('spreadsheet') || ['xls', 'xlsx', 'csv'].includes(extension)) {
    return { icon: '📊', color: 'bg-green-500', label: 'XLS', textColor: 'text-green-600' };
  }
  if (fileType?.includes('powerpoint') || fileType?.includes('presentation') || ['ppt', 'pptx'].includes(extension)) {
    return { icon: '📽️', color: 'bg-[#977DFF]', label: 'PPT', textColor: 'text-[#977DFF]' };
  }
  if (fileType?.includes('text') || extension === 'txt') {
    return { icon: '📃', color: 'bg-gray-500', label: 'TXT', textColor: 'text-gray-600' };
  }
  if (fileType?.startsWith('audio/')) {
    return { icon: '🎵', color: 'bg-pink-500', label: 'AUDIO', textColor: 'text-pink-600' };
  }
  if (['zip', 'rar', '7z', 'tar', 'gz'].includes(extension)) {
    return { icon: '📦', color: 'bg-yellow-500', label: 'ZIP', textColor: 'text-yellow-600' };
  }
  return { icon: '📎', color: 'bg-gray-400', label: extension.toUpperCase() || 'FILE', textColor: 'text-gray-600' };
}

// PDF Preview Component
function PDFPreview({ url, fileName }: { url: string; fileName: string }) {
  const [numPages, setNumPages] = useState<number>(0);
  const [error, setError] = useState(false);
  const [isClient, setIsClient] = useState(false);

  useEffect(() => {
    setIsClient(true);
  }, []);

  if (!isClient) {
    return (
      <div className="w-48 h-64 flex items-center justify-center bg-gray-100 rounded-lg">
        <div className="animate-pulse text-gray-400">Loading...</div>
      </div>
    );
  }

  if (error) {
    return null; // Fall back to default preview
  }

  return (
    <div className="bg-gray-100 rounded-lg overflow-hidden">
      <PDFDocument
        file={url}
        onLoadSuccess={({ numPages }: { numPages: number }) => setNumPages(numPages)}
        onLoadError={() => setError(true)}
        loading={
          <div className="w-48 h-64 flex items-center justify-center bg-gray-100">
            <div className="animate-pulse text-gray-400">Loading PDF...</div>
          </div>
        }
      >
        <PDFPage
          pageNumber={1}
          width={200}
          renderTextLayer={false}
          renderAnnotationLayer={false}
        />
      </PDFDocument>
      {numPages > 0 && (
        <div className="bg-gray-800 text-white text-xs px-2 py-1 text-center">
          {numPages} page{numPages > 1 ? 's' : ''} • {fileName}
        </div>
      )}
    </div>
  );
}

// Attachment item component with content preview
function AttachmentItem({
  attachment,
  onImageClick,
  isOwnMessage = false,
}: {
  attachment: Attachment;
  onImageClick?: (url: string) => void;
  isOwnMessage?: boolean;
}) {
  const isImage = attachment.file_type?.startsWith('image/');
  const isVideo = attachment.file_type?.startsWith('video/');
  const isPDF = attachment.file_type === 'application/pdf' || attachment.file_name.toLowerCase().endsWith('.pdf');
  const isAudio = attachment.file_type?.startsWith('audio/');
  const fileInfo = getFileTypeInfo(attachment.file_name, attachment.file_type);

  const formatFileSize = (bytes?: number) => {
    if (!bytes) return '';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  };

  // Image preview
  if (isImage) {
    return (
      <div
        className="cursor-pointer rounded-lg overflow-hidden"
        onClick={() => onImageClick?.(attachment.file_url)}
      >
        <img
          src={attachment.thumbnail_url || attachment.file_url}
          alt={attachment.file_name}
          className="max-w-full rounded-lg max-h-64 object-cover"
          loading="lazy"
        />
      </div>
    );
  }

  // Video preview with player
  if (isVideo) {
    return (
      <div className="rounded-lg overflow-hidden max-w-xs">
        <video
          src={attachment.file_url}
          controls
          className="max-w-full max-h-64 rounded-lg"
          preload="metadata"
        >
          Your browser does not support video playback.
        </video>
        <div className={`text-xs px-2 py-1 ${isOwnMessage ? 'text-white/70' : 'text-gray-500'}`}>
          {attachment.file_name} • {formatFileSize(attachment.file_size)}
        </div>
      </div>
    );
  }

  // Audio preview with player
  if (isAudio) {
    return (
      <div className={`rounded-lg p-3 ${isOwnMessage ? 'bg-[#977DFF]/30' : 'bg-gray-200'}`}>
        <div className="flex items-center gap-2 mb-2">
          <span className="text-xl">🎵</span>
          <span className={`text-sm font-medium truncate ${isOwnMessage ? 'text-white' : 'text-gray-800'}`}>
            {attachment.file_name}
          </span>
        </div>
        <audio
          src={attachment.file_url}
          controls
          className="w-full max-w-xs h-10"
          preload="metadata"
        >
          Your browser does not support audio playback.
        </audio>
        <div className={`text-xs mt-1 ${isOwnMessage ? 'text-white/70' : 'text-gray-500'}`}>
          {formatFileSize(attachment.file_size)}
        </div>
      </div>
    );
  }

  // PDF preview with first page
  if (isPDF) {
    return (
      <a
        href={attachment.file_url}
        target="_blank"
        rel="noopener noreferrer"
        className="block rounded-lg overflow-hidden hover:opacity-90 transition-opacity"
      >
        <PDFPreview url={attachment.file_url} fileName={attachment.file_name} />
        <div className={`flex items-center gap-2 p-2 ${isOwnMessage ? 'bg-[#977DFF]/30' : 'bg-white'}`}>
          <Download size={16} className={isOwnMessage ? 'text-white' : 'text-gray-500'} />
          <span className={`text-xs ${isOwnMessage ? 'text-white' : 'text-gray-600'}`}>
            Click to download • {formatFileSize(attachment.file_size)}
          </span>
        </div>
      </a>
    );
  }

  // Other documents - enhanced preview card
  return (
    <a
      href={attachment.file_url}
      target="_blank"
      rel="noopener noreferrer"
      className="block rounded-xl overflow-hidden hover:opacity-90 transition-opacity max-w-xs"
    >
      {/* File type header */}
      <div className={`${fileInfo.color} px-4 py-3 flex items-center gap-3`}>
        <span className="text-2xl">{fileInfo.icon}</span>
        <div className="flex-1 min-w-0">
          <p className="text-white font-medium text-sm truncate">{attachment.file_name}</p>
          <p className="text-white/70 text-xs">{fileInfo.label} Document</p>
        </div>
      </div>
      {/* File details */}
      <div className={`px-4 py-3 ${isOwnMessage ? 'bg-[#977DFF]/30' : 'bg-white border border-gray-200'}`}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Download size={16} className={isOwnMessage ? 'text-white' : 'text-gray-500'} />
            <span className={`text-xs ${isOwnMessage ? 'text-white' : 'text-gray-600'}`}>
              Click to download
            </span>
          </div>
          <span className={`text-xs ${isOwnMessage ? 'text-white/70' : 'text-gray-400'}`}>
            {formatFileSize(attachment.file_size)}
          </span>
        </div>
      </div>
    </a>
  );
}
