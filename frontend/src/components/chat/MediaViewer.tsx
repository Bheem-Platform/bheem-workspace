/**
 * MediaViewer - WhatsApp-style full-screen media viewer
 * Features: zoom, download, navigation between media files, close
 */

'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  X,
  Download,
  ChevronLeft,
  ChevronRight,
  ZoomIn,
  ZoomOut,
  RotateCw,
  FileText,
} from 'lucide-react';

export interface MediaItem {
  id: string;
  url: string;
  thumbnailUrl?: string;
  fileName: string;
  fileType: string;
  fileSize?: number;
  senderName?: string;
  timestamp?: string;
}

interface MediaViewerProps {
  media: MediaItem[];
  currentIndex: number;
  isOpen: boolean;
  onClose: () => void;
  onNavigate?: (index: number) => void;
}

export default function MediaViewer({
  media,
  currentIndex,
  isOpen,
  onClose,
  onNavigate,
}: MediaViewerProps) {
  const [zoom, setZoom] = useState(1);
  const [rotation, setRotation] = useState(0);
  const [isLoading, setIsLoading] = useState(true);

  const currentMedia = media[currentIndex];
  const isImage = currentMedia?.fileType?.startsWith('image/');
  const isVideo = currentMedia?.fileType?.startsWith('video/');
  const hasPrev = currentIndex > 0;
  const hasNext = currentIndex < media.length - 1;

  // Reset zoom and rotation when media changes
  useEffect(() => {
    setZoom(1);
    setRotation(0);
    setIsLoading(true);
  }, [currentIndex]);

  // Keyboard navigation
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      switch (e.key) {
        case 'Escape':
          onClose();
          break;
        case 'ArrowLeft':
          if (hasPrev) onNavigate?.(currentIndex - 1);
          break;
        case 'ArrowRight':
          if (hasNext) onNavigate?.(currentIndex + 1);
          break;
        case '+':
        case '=':
          setZoom((z) => Math.min(z + 0.25, 3));
          break;
        case '-':
          setZoom((z) => Math.max(z - 0.25, 0.5));
          break;
        case 'r':
          setRotation((r) => (r + 90) % 360);
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, hasPrev, hasNext, currentIndex, onClose, onNavigate]);

  const handleDownload = useCallback(async () => {
    if (!currentMedia) return;

    try {
      const response = await fetch(currentMedia.url);
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = currentMedia.fileName;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
    } catch (error) {
      // Fallback: open in new tab
      window.open(currentMedia.url, '_blank');
    }
  }, [currentMedia]);

  const formatFileSize = (bytes?: number) => {
    if (!bytes) return '';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  };

  const formatTime = (timestamp?: string) => {
    if (!timestamp) return '';
    const date = new Date(timestamp);
    return date.toLocaleString(undefined, {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  if (!isOpen || !currentMedia) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/95 flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 bg-black/50">
        <div className="flex items-center gap-3 text-white">
          <div className="w-10 h-10 rounded-full bg-gray-600 flex items-center justify-center">
            {currentMedia.senderName ? (
              <span className="text-sm font-medium">
                {currentMedia.senderName.charAt(0).toUpperCase()}
              </span>
            ) : (
              <FileText size={20} />
            )}
          </div>
          <div>
            <p className="font-medium">{currentMedia.senderName || 'Unknown'}</p>
            <p className="text-xs text-gray-400">
              {formatTime(currentMedia.timestamp)}
              {currentMedia.fileSize && ` • ${formatFileSize(currentMedia.fileSize)}`}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Zoom controls (for images only) */}
          {isImage && (
            <>
              <button
                onClick={() => setZoom((z) => Math.max(z - 0.25, 0.5))}
                className="p-2 text-white/70 hover:text-white hover:bg-white/10 rounded-full transition-colors"
                title="Zoom out (-)"
              >
                <ZoomOut size={20} />
              </button>
              <span className="text-white/70 text-sm w-12 text-center">
                {Math.round(zoom * 100)}%
              </span>
              <button
                onClick={() => setZoom((z) => Math.min(z + 0.25, 3))}
                className="p-2 text-white/70 hover:text-white hover:bg-white/10 rounded-full transition-colors"
                title="Zoom in (+)"
              >
                <ZoomIn size={20} />
              </button>
              <button
                onClick={() => setRotation((r) => (r + 90) % 360)}
                className="p-2 text-white/70 hover:text-white hover:bg-white/10 rounded-full transition-colors"
                title="Rotate (R)"
              >
                <RotateCw size={20} />
              </button>
              <div className="w-px h-6 bg-white/20 mx-2" />
            </>
          )}

          {/* Download */}
          <button
            onClick={handleDownload}
            className="p-2 text-white/70 hover:text-white hover:bg-white/10 rounded-full transition-colors"
            title="Download"
          >
            <Download size={20} />
          </button>

          {/* Close */}
          <button
            onClick={onClose}
            className="p-2 text-white/70 hover:text-white hover:bg-white/10 rounded-full transition-colors"
            title="Close (Esc)"
          >
            <X size={24} />
          </button>
        </div>
      </div>

      {/* Media content */}
      <div
        className="flex-1 flex items-center justify-center relative overflow-hidden"
        onClick={onClose}
      >
        {/* Navigation arrows */}
        {hasPrev && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onNavigate?.(currentIndex - 1);
            }}
            className="absolute left-4 z-10 p-3 bg-black/50 text-white rounded-full hover:bg-black/70 transition-colors"
          >
            <ChevronLeft size={28} />
          </button>
        )}

        {hasNext && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onNavigate?.(currentIndex + 1);
            }}
            className="absolute right-4 z-10 p-3 bg-black/50 text-white rounded-full hover:bg-black/70 transition-colors"
          >
            <ChevronRight size={28} />
          </button>
        )}

        {/* Media display */}
        <div
          className="max-w-[90vw] max-h-[85vh] flex items-center justify-center"
          onClick={(e) => e.stopPropagation()}
        >
          {isImage ? (
            <>
              {isLoading && (
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="w-12 h-12 border-4 border-white/20 border-t-white rounded-full animate-spin" />
                </div>
              )}
              <img
                src={currentMedia.url}
                alt={currentMedia.fileName}
                className="max-w-full max-h-[85vh] object-contain transition-transform duration-200"
                style={{
                  transform: `scale(${zoom}) rotate(${rotation}deg)`,
                }}
                onLoad={() => setIsLoading(false)}
                onError={() => setIsLoading(false)}
                draggable={false}
              />
            </>
          ) : isVideo ? (
            <video
              src={currentMedia.url}
              controls
              autoPlay
              className="max-w-full max-h-[85vh]"
            >
              Your browser does not support the video tag.
            </video>
          ) : (
            // Non-media file - show download prompt
            <div className="bg-gray-800 rounded-2xl p-8 text-center">
              <FileText size={64} className="text-gray-400 mx-auto mb-4" />
              <p className="text-white font-medium text-lg mb-2">
                {currentMedia.fileName}
              </p>
              <p className="text-gray-400 mb-6">
                {formatFileSize(currentMedia.fileSize)}
              </p>
              <button
                onClick={handleDownload}
                className="px-6 py-3 bg-gradient-to-r from-[#977DFF] to-[#0033FF] text-white rounded-lg hover:from-[#8066EE] hover:to-[#0029CC] transition-colors flex items-center gap-2 mx-auto"
              >
                <Download size={20} />
                Download File
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Footer - media counter */}
      {media.length > 1 && (
        <div className="py-3 text-center">
          <span className="text-white/70 text-sm">
            {currentIndex + 1} of {media.length}
          </span>

          {/* Thumbnail strip */}
          <div className="flex justify-center gap-2 mt-3 px-4 overflow-x-auto">
            {media.slice(Math.max(0, currentIndex - 3), currentIndex + 4).map((item, idx) => {
              const actualIndex = Math.max(0, currentIndex - 3) + idx;
              const isActive = actualIndex === currentIndex;

              return (
                <button
                  key={item.id}
                  onClick={() => onNavigate?.(actualIndex)}
                  className={`
                    w-12 h-12 rounded-lg overflow-hidden flex-shrink-0 transition-all
                    ${isActive ? 'ring-2 ring-[#977DFF] scale-110' : 'opacity-50 hover:opacity-100'}
                  `}
                >
                  {item.fileType?.startsWith('image/') ? (
                    <img
                      src={item.thumbnailUrl || item.url}
                      alt=""
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full bg-gray-700 flex items-center justify-center">
                      <FileText size={20} className="text-gray-400" />
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
