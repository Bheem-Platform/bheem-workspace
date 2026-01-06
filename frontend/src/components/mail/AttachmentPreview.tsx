/**
 * Bheem Mail Attachment Preview Modal
 * Rich attachment preview with support for images, PDFs, videos, and code
 */
import { useState, useEffect } from 'react';
import {
  X,
  Download,
  ExternalLink,
  ZoomIn,
  ZoomOut,
  RotateCw,
  ChevronLeft,
  ChevronRight,
  Maximize2,
  Minimize2,
  FileText,
  Image,
  Video,
  Music,
  Code,
  File,
  Play,
  Pause,
} from 'lucide-react';
import * as mailApi from '@/lib/mailApi';
import type { Attachment } from '@/types/mail';

interface AttachmentPreviewProps {
  attachment: Attachment;
  attachments?: Attachment[]; // All attachments for navigation
  messageId: string;
  attachmentIndex?: number;  // Index of the attachment for download URL
  folder?: string; // Current mail folder (INBOX, Sent, etc.)
  onClose: () => void;
}

export default function AttachmentPreview({
  attachment,
  attachments = [],
  messageId,
  attachmentIndex = 0,
  folder = 'INBOX',
  onClose,
}: AttachmentPreviewProps) {
  const [previewInfo, setPreviewInfo] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [zoom, setZoom] = useState(1);
  const [rotation, setRotation] = useState(0);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [blobUrl, setBlobUrl] = useState<string | null>(null);
  const [currentIndex, setCurrentIndex] = useState(
    attachments.findIndex((a) => a.id === attachment.id) >= 0
      ? attachments.findIndex((a) => a.id === attachment.id)
      : attachmentIndex
  );

  const currentAttachment = attachments[currentIndex] || attachment;

  useEffect(() => {
    fetchPreviewInfo();
  }, [currentAttachment.id]);

  // Fetch blob URL for preview with authentication
  useEffect(() => {
    let cancelled = false;

    const fetchBlobUrl = async () => {
      // Clean up previous blob URL
      if (blobUrl) {
        URL.revokeObjectURL(blobUrl);
        setBlobUrl(null);
      }

      if (!previewInfo?.can_preview) return;

      try {
        const { blobUrl: newBlobUrl } = await mailApi.downloadAttachment(
          messageId,
          currentIndex,
          folder
        );
        if (!cancelled) {
          setBlobUrl(newBlobUrl);
        }
      } catch (err) {
        console.error('Failed to fetch attachment blob:', err);
      }
    };

    if (previewInfo) {
      fetchBlobUrl();
    }

    return () => {
      cancelled = true;
    };
  }, [previewInfo, currentIndex, messageId, folder]);

  // Cleanup blob URL on unmount
  useEffect(() => {
    return () => {
      if (blobUrl) {
        URL.revokeObjectURL(blobUrl);
      }
    };
  }, []);

  const fetchPreviewInfo = async () => {
    setLoading(true);
    setError(null);
    try {
      const info = await mailApi.getAttachmentPreviewInfo(
        currentAttachment.filename,
        currentAttachment.contentType,
        currentAttachment.size
      );
      setPreviewInfo(info);
    } catch (err) {
      setError('Failed to load preview information');
    } finally {
      setLoading(false);
    }
  };

  const [downloading, setDownloading] = useState(false);

  const handleDownload = async () => {
    setDownloading(true);
    try {
      await mailApi.downloadAndSaveAttachment(
        messageId,
        currentIndex,
        folder,
        currentAttachment.filename
      );
    } catch (err) {
      console.error('Download failed:', err);
      setError('Failed to download attachment');
    } finally {
      setDownloading(false);
    }
  };

  const handlePrevious = () => {
    if (currentIndex > 0) {
      setCurrentIndex(currentIndex - 1);
      setZoom(1);
      setRotation(0);
    }
  };

  const handleNext = () => {
    if (currentIndex < attachments.length - 1) {
      setCurrentIndex(currentIndex + 1);
      setZoom(1);
      setRotation(0);
    }
  };

  const formatSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const getFileIcon = () => {
    const type = currentAttachment.contentType;
    if (type.startsWith('image/')) return <Image size={48} className="text-blue-500" />;
    if (type.startsWith('video/')) return <Video size={48} className="text-purple-500" />;
    if (type.startsWith('audio/')) return <Music size={48} className="text-pink-500" />;
    if (type.includes('pdf')) return <FileText size={48} className="text-red-500" />;
    if (type.includes('text') || previewInfo?.language) return <Code size={48} className="text-green-500" />;
    return <File size={48} className="text-gray-500" />;
  };

  const renderPreview = () => {
    if (loading) {
      return (
        <div className="flex items-center justify-center h-full">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-500" />
        </div>
      );
    }

    if (error || !previewInfo?.can_preview) {
      return (
        <div className="flex flex-col items-center justify-center h-full text-center p-8">
          {getFileIcon()}
          <h3 className="text-lg font-medium text-gray-900 mt-4">{currentAttachment.filename}</h3>
          <p className="text-sm text-gray-500 mt-1">{formatSize(currentAttachment.size)}</p>
          <p className="text-sm text-gray-400 mt-4">Preview not available for this file type</p>
          <button
            onClick={handleDownload}
            className="flex items-center gap-2 mt-6 px-6 py-2 bg-orange-500 text-white rounded-lg hover:bg-orange-600"
          >
            <Download size={18} />
            Download to view
          </button>
        </div>
      );
    }

    // Image preview
    if (previewInfo.preview_type === 'image') {
      if (!blobUrl) {
        return (
          <div className="flex items-center justify-center h-full">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-500" />
          </div>
        );
      }
      return (
        <div className="flex items-center justify-center h-full overflow-auto p-4">
          <img
            src={blobUrl}
            alt={currentAttachment.filename}
            className="max-w-full max-h-full object-contain transition-transform duration-200"
            style={{
              transform: `scale(${zoom}) rotate(${rotation}deg)`,
            }}
          />
        </div>
      );
    }

    // PDF preview
    if (previewInfo.preview_type === 'pdf') {
      if (!blobUrl) {
        return (
          <div className="flex items-center justify-center h-full">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-500" />
          </div>
        );
      }
      return (
        <iframe
          src={`${blobUrl}#toolbar=0`}
          className="w-full h-full border-0"
          title={currentAttachment.filename}
        />
      );
    }

    // Video preview
    if (previewInfo.preview_type === 'video') {
      if (!blobUrl) {
        return (
          <div className="flex items-center justify-center h-full">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-500" />
          </div>
        );
      }
      return (
        <div className="flex items-center justify-center h-full p-4">
          <video
            src={blobUrl}
            controls
            className="max-w-full max-h-full rounded-lg"
          >
            Your browser does not support video playback.
          </video>
        </div>
      );
    }

    // Audio preview
    if (previewInfo.preview_type === 'audio') {
      if (!blobUrl) {
        return (
          <div className="flex items-center justify-center h-full">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-500" />
          </div>
        );
      }
      return (
        <div className="flex flex-col items-center justify-center h-full p-8">
          <Music size={64} className="text-pink-500 mb-6" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">{currentAttachment.filename}</h3>
          <audio
            src={blobUrl}
            controls
            className="w-full max-w-md mt-4"
          >
            Your browser does not support audio playback.
          </audio>
        </div>
      );
    }

    // Text/Code preview
    if (previewInfo.preview_type === 'text') {
      return (
        <div className="h-full overflow-auto p-4">
          <TextPreview
            messageId={messageId}
            attachmentIndex={currentIndex}
            folder={folder}
            language={previewInfo.language}
          />
        </div>
      );
    }

    // Fallback
    return (
      <div className="flex flex-col items-center justify-center h-full">
        {getFileIcon()}
        <p className="text-gray-500 mt-4">Preview not available</p>
      </div>
    );
  };

  return (
    <div className={`fixed inset-0 z-50 bg-black/90 flex flex-col ${isFullscreen ? '' : 'p-4'}`}>
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 bg-gray-900/50 backdrop-blur">
        <div className="flex items-center gap-4">
          <button
            onClick={onClose}
            className="p-2 text-white/70 hover:text-white hover:bg-white/10 rounded-lg"
          >
            <X size={20} />
          </button>
          <div>
            <h3 className="text-white font-medium truncate max-w-md">
              {currentAttachment.filename}
            </h3>
            <p className="text-sm text-white/50">
              {formatSize(currentAttachment.size)}
              {previewInfo?.language && ` • ${previewInfo.language}`}
              {attachments.length > 1 && ` • ${currentIndex + 1} of ${attachments.length}`}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Image controls */}
          {previewInfo?.preview_type === 'image' && (
            <>
              <button
                onClick={() => setZoom(Math.max(0.5, zoom - 0.25))}
                className="p-2 text-white/70 hover:text-white hover:bg-white/10 rounded-lg"
                title="Zoom out"
              >
                <ZoomOut size={20} />
              </button>
              <span className="text-white/50 text-sm w-12 text-center">
                {Math.round(zoom * 100)}%
              </span>
              <button
                onClick={() => setZoom(Math.min(3, zoom + 0.25))}
                className="p-2 text-white/70 hover:text-white hover:bg-white/10 rounded-lg"
                title="Zoom in"
              >
                <ZoomIn size={20} />
              </button>
              <button
                onClick={() => setRotation((rotation + 90) % 360)}
                className="p-2 text-white/70 hover:text-white hover:bg-white/10 rounded-lg"
                title="Rotate"
              >
                <RotateCw size={20} />
              </button>
              <div className="w-px h-6 bg-white/20 mx-2" />
            </>
          )}

          <button
            onClick={() => setIsFullscreen(!isFullscreen)}
            className="p-2 text-white/70 hover:text-white hover:bg-white/10 rounded-lg"
            title={isFullscreen ? 'Exit fullscreen' : 'Fullscreen'}
          >
            {isFullscreen ? <Minimize2 size={20} /> : <Maximize2 size={20} />}
          </button>
          <button
            onClick={handleDownload}
            className="flex items-center gap-2 px-4 py-2 bg-orange-500 text-white rounded-lg hover:bg-orange-600"
          >
            <Download size={18} />
            <span>Download</span>
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 relative overflow-hidden">
        {renderPreview()}

        {/* Navigation arrows */}
        {attachments.length > 1 && (
          <>
            {currentIndex > 0 && (
              <button
                onClick={handlePrevious}
                className="absolute left-4 top-1/2 -translate-y-1/2 p-3 bg-black/50 text-white rounded-full hover:bg-black/70"
              >
                <ChevronLeft size={24} />
              </button>
            )}
            {currentIndex < attachments.length - 1 && (
              <button
                onClick={handleNext}
                className="absolute right-4 top-1/2 -translate-y-1/2 p-3 bg-black/50 text-white rounded-full hover:bg-black/70"
              >
                <ChevronRight size={24} />
              </button>
            )}
          </>
        )}
      </div>

      {/* Thumbnails for multiple attachments */}
      {attachments.length > 1 && (
        <div className="flex justify-center gap-2 p-4 bg-gray-900/50">
          {attachments.map((att, idx) => (
            <button
              key={att.id}
              onClick={() => {
                setCurrentIndex(idx);
                setZoom(1);
                setRotation(0);
              }}
              className={`w-16 h-16 rounded-lg overflow-hidden border-2 transition-colors ${
                idx === currentIndex
                  ? 'border-orange-500'
                  : 'border-transparent hover:border-white/50'
              }`}
            >
              <div className="w-full h-full bg-gray-800 flex items-center justify-center">
                <FileIcon type={att.contentType} size={24} />
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// Text preview component for code files
function TextPreview({
  messageId,
  attachmentIndex,
  folder = 'INBOX',
  language,
}: {
  messageId: string;
  attachmentIndex: number;
  folder?: string;
  language?: string;
}) {
  const [content, setContent] = useState<string>('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchContent = async () => {
      try {
        // Get auth token for authenticated fetch
        const token = typeof window !== 'undefined' ? localStorage.getItem('auth_token') : null;
        const url = mailApi.getAttachmentDownloadUrl(messageId, attachmentIndex, folder);

        const response = await fetch(url, {
          headers: {
            'Authorization': token ? `Bearer ${token}` : '',
          },
        });

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }

        const text = await response.text();
        setContent(text);
      } catch (error) {
        setContent('Failed to load file content');
      } finally {
        setLoading(false);
      }
    };
    fetchContent();
  }, [messageId, attachmentIndex, folder]);

  if (loading) {
    return <div className="text-white/50">Loading...</div>;
  }

  return (
    <pre className="text-sm text-white/90 font-mono whitespace-pre-wrap bg-gray-900 rounded-lg p-4 overflow-auto">
      <code className={language ? `language-${language}` : ''}>{content}</code>
    </pre>
  );
}

// File icon component
function FileIcon({ type, size = 24 }: { type: string; size?: number }) {
  if (type.startsWith('image/')) return <Image size={size} className="text-blue-400" />;
  if (type.startsWith('video/')) return <Video size={size} className="text-purple-400" />;
  if (type.startsWith('audio/')) return <Music size={size} className="text-pink-400" />;
  if (type.includes('pdf')) return <FileText size={size} className="text-red-400" />;
  if (type.includes('text')) return <Code size={size} className="text-green-400" />;
  return <File size={size} className="text-gray-400" />;
}
