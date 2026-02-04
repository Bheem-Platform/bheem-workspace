/**
 * Message input with file upload and voice recording support
 */

import { useState, useRef, useCallback, useEffect } from 'react';
import {
  Send,
  Paperclip,
  X,
  Image as ImageIcon,
  File,
  Smile,
  Camera,
  FileText,
  Video,
  Music,
  FolderOpen,
  Mic,
  Square,
  Trash2,
} from 'lucide-react';

interface ReplyAttachment {
  id: string;
  file_name: string;
  file_type?: string;
  file_size?: number;
  thumbnail_url?: string;
}

interface MessageInputProps {
  onSend: (content: string, files?: File[]) => void;
  onTyping?: (isTyping: boolean) => void;
  disabled?: boolean;
  placeholder?: string;
  replyingTo?: {
    id: string;
    senderName: string;
    content: string;
    attachments?: ReplyAttachment[];
  } | null;
  onCancelReply?: () => void;
}

// Attachment menu options
const ATTACHMENT_OPTIONS = [
  {
    id: 'photos',
    label: 'Photos',
    icon: ImageIcon,
    accept: 'image/*',
    color: 'bg-purple-500',
  },
  {
    id: 'videos',
    label: 'Videos',
    icon: Video,
    accept: 'video/*',
    color: 'bg-pink-500',
  },
  {
    id: 'camera',
    label: 'Camera',
    icon: Camera,
    accept: 'image/*',
    color: 'bg-red-500',
    capture: true,
  },
  {
    id: 'documents',
    label: 'Documents',
    icon: FileText,
    accept: '.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.csv',
    color: 'bg-blue-500',
  },
  {
    id: 'audio',
    label: 'Audio',
    icon: Music,
    accept: 'audio/*',
    color: 'bg-[#977DFF]',
  },
  {
    id: 'files',
    label: 'All Files',
    icon: FolderOpen,
    accept: '*/*',
    color: 'bg-gray-500',
  },
];

export default function MessageInput({
  onSend,
  onTyping,
  disabled = false,
  placeholder = 'Type a message...',
  replyingTo,
  onCancelReply,
}: MessageInputProps) {
  const [message, setMessage] = useState('');
  const [files, setFiles] = useState<File[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [showAttachMenu, setShowAttachMenu] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [currentAccept, setCurrentAccept] = useState<string>('*/*');
  const [useCapture, setUseCapture] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const attachMenuRef = useRef<HTMLDivElement>(null);

  // Audio recording state
  const [isRecording, setIsRecording] = useState(false);
  const [recordingDuration, setRecordingDuration] = useState(0);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const recordingIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 150)}px`;
    }
  }, [message]);

  // Close attach menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (attachMenuRef.current && !attachMenuRef.current.contains(e.target as Node)) {
        setShowAttachMenu(false);
      }
    };

    if (showAttachMenu) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [showAttachMenu]);

  // Handle attachment option click
  const handleAttachOption = (option: typeof ATTACHMENT_OPTIONS[0]) => {
    setCurrentAccept(option.accept);
    setUseCapture(option.capture || false);
    setShowAttachMenu(false);
    // Small delay to ensure state is updated before clicking
    setTimeout(() => {
      fileInputRef.current?.click();
    }, 50);
  };

  // Handle typing indicator
  const handleTyping = useCallback(() => {
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }

    onTyping?.(true);

    typingTimeoutRef.current = setTimeout(() => {
      onTyping?.(false);
    }, 2000);
  }, [onTyping]);

  // Cleanup typing timeout on unmount
  useEffect(() => {
    return () => {
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }
    };
  }, []);

  // Cleanup audio recording on unmount
  useEffect(() => {
    return () => {
      if (recordingIntervalRef.current) {
        clearInterval(recordingIntervalRef.current);
      }
      if (audioUrl) {
        URL.revokeObjectURL(audioUrl);
      }
      if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
        mediaRecorderRef.current.stop();
      }
    };
  }, [audioUrl]);

  // Start audio recording
  const startRecording = useCallback(async () => {
    // Check if browser supports recording
    if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
      alert('Voice recording is not supported in this browser.');
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });

      // Determine the best supported mime type
      const mimeType = typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported('audio/webm')
        ? 'audio/webm'
        : 'audio/mp4';

      const mediaRecorder = new MediaRecorder(stream, { mimeType });

      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          audioChunksRef.current.push(e.data);
        }
      };

      mediaRecorder.onstop = () => {
        const recordedMimeType = typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported('audio/webm')
          ? 'audio/webm'
          : 'audio/mp4';
        const recordedBlob = new Blob(audioChunksRef.current, { type: recordedMimeType });
        setAudioBlob(recordedBlob);
        const url = URL.createObjectURL(recordedBlob);
        setAudioUrl(url);

        // Stop all tracks
        stream.getTracks().forEach(track => track.stop());
      };

      mediaRecorder.start(100); // Collect data every 100ms
      setIsRecording(true);
      setRecordingDuration(0);

      // Start duration timer
      recordingIntervalRef.current = setInterval(() => {
        setRecordingDuration(prev => prev + 1);
      }, 1000);

    } catch (err) {
      console.error('Failed to start recording:', err);
      alert('Could not access microphone. Please check your permissions.');
    }
  }, []);

  // Stop audio recording
  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
      mediaRecorderRef.current.stop();
    }
    setIsRecording(false);
    if (recordingIntervalRef.current) {
      clearInterval(recordingIntervalRef.current);
    }
  }, []);

  // Cancel recording
  const cancelRecording = useCallback(() => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
      mediaRecorderRef.current.stop();
    }
    setIsRecording(false);
    setAudioBlob(null);
    if (audioUrl) {
      URL.revokeObjectURL(audioUrl);
      setAudioUrl(null);
    }
    setRecordingDuration(0);
    if (recordingIntervalRef.current) {
      clearInterval(recordingIntervalRef.current);
    }
  }, [audioUrl]);

  // Send voice message
  const sendVoiceMessage = useCallback(() => {
    if (!audioBlob) return;

    // Create a File from the Blob
    const extension = typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported('audio/webm') ? 'webm' : 'mp4';
    const fileName = `voice_message_${Date.now()}.${extension}`;
    const audioFile = new globalThis.File([audioBlob], fileName, { type: audioBlob.type });

    onSend('', [audioFile]);

    // Cleanup
    setAudioBlob(null);
    if (audioUrl) {
      URL.revokeObjectURL(audioUrl);
      setAudioUrl(null);
    }
    setRecordingDuration(0);
  }, [audioBlob, audioUrl, onSend]);

  // Format recording duration
  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const handleSend = () => {
    if ((!message.trim() && files.length === 0) || disabled) return;

    onSend(message.trim(), files.length > 0 ? files : undefined);
    setMessage('');
    setFiles([]);
    onTyping?.(false);

    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = Array.from(e.target.files || []);
    addFiles(selectedFiles);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const addFiles = (newFiles: File[]) => {
    // Filter by size (max 50MB)
    const validFiles = newFiles.filter((file) => file.size <= 50 * 1024 * 1024);
    setFiles((prev) => [...prev, ...validFiles].slice(0, 10)); // Max 10 files
  };

  const removeFile = (index: number) => {
    setFiles((prev) => prev.filter((_, i) => i !== index));
  };

  // Drag and drop handlers
  const handleDragEnter = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    const droppedFiles = Array.from(e.dataTransfer.files);
    addFiles(droppedFiles);
  };

  return (
    <div
      className={`
        border-t border-gray-200 p-4 bg-white
        ${isDragging ? 'bg-gradient-to-r from-[#FFCCF2]/30 via-[#977DFF]/20 to-[#0033FF]/10 border-[#977DFF]' : ''}
      `}
      onDragEnter={handleDragEnter}
      onDragLeave={handleDragLeave}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
    >
      {/* Reply preview */}
      {replyingTo && (
        <div className="flex items-center gap-2 px-3 py-2 mb-2 bg-gray-100 rounded-lg">
          <div className="w-1 h-10 bg-gradient-to-b from-[#977DFF] to-[#0033FF] rounded-full" />
          <div className="flex-1 min-w-0">
            <p className="text-xs font-medium text-[#977DFF]">
              Replying to {replyingTo.senderName}
            </p>
            {/* Show attachment preview if present */}
            {replyingTo.attachments && replyingTo.attachments.length > 0 ? (
              <div className="flex items-center gap-2 mt-1">
                {replyingTo.attachments[0].file_type?.startsWith('image/') && replyingTo.attachments[0].thumbnail_url ? (
                  <img
                    src={replyingTo.attachments[0].thumbnail_url}
                    alt=""
                    className="w-10 h-10 rounded object-cover"
                  />
                ) : (
                  <div className="w-8 h-8 rounded bg-gray-200 flex items-center justify-center">
                    {replyingTo.attachments[0].file_type?.startsWith('image/') ? (
                      <ImageIcon size={16} className="text-purple-500" />
                    ) : replyingTo.attachments[0].file_type?.startsWith('video/') ? (
                      <Video size={16} className="text-pink-500" />
                    ) : replyingTo.attachments[0].file_type?.startsWith('audio/') ? (
                      <Music size={16} className="text-[#977DFF]" />
                    ) : (
                      <FileText size={16} className="text-blue-500" />
                    )}
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-gray-700 truncate">
                    {replyingTo.attachments[0].file_name}
                  </p>
                  {replyingTo.attachments.length > 1 && (
                    <p className="text-xs text-gray-500">
                      +{replyingTo.attachments.length - 1} more file{replyingTo.attachments.length > 2 ? 's' : ''}
                    </p>
                  )}
                </div>
              </div>
            ) : (
              <p className="text-sm text-gray-600 truncate">{replyingTo.content || 'No message'}</p>
            )}
          </div>
          <button
            onClick={onCancelReply}
            className="p-1 text-gray-400 hover:text-gray-600 rounded"
          >
            <X size={16} />
          </button>
        </div>
      )}

      {/* File previews */}
      {files.length > 0 && (
        <div className="mb-3 p-3 bg-gray-50 rounded-xl border border-gray-200">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-gray-700">
              {files.length} file{files.length > 1 ? 's' : ''} selected
            </span>
            <button
              onClick={() => setFiles([])}
              className="text-xs text-red-500 hover:text-red-600 font-medium"
            >
              Clear all
            </button>
          </div>
          <div className="flex flex-wrap gap-3">
            {files.map((file, index) => (
              <FilePreview
                key={`${file.name}-${index}`}
                file={file}
                onRemove={() => removeFile(index)}
              />
            ))}
          </div>
        </div>
      )}

      {/* Voice message recording preview */}
      {audioUrl && !isRecording && (
        <div className="mb-3 p-3 bg-gradient-to-r from-[#FFCCF2]/30 via-[#977DFF]/20 to-[#0033FF]/10 rounded-xl border border-[#977DFF]/30">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-r from-[#977DFF] to-[#0033FF] rounded-full flex items-center justify-center flex-shrink-0">
              <Mic size={20} className="text-white" />
            </div>
            <div className="flex-1">
              <p className="text-sm font-medium text-gray-800">Voice Message</p>
              <audio src={audioUrl} controls className="w-full h-8 mt-1" />
            </div>
            <div className="flex gap-2">
              <button
                onClick={cancelRecording}
                className="p-2 text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                title="Delete recording"
              >
                <Trash2 size={20} />
              </button>
              <button
                onClick={sendVoiceMessage}
                className="p-2 bg-gradient-to-r from-[#977DFF] to-[#0033FF] text-white hover:from-[#8066EE] hover:to-[#0029CC] rounded-lg transition-colors"
                title="Send voice message"
              >
                <Send size={20} />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Recording indicator */}
      {isRecording && (
        <div className="mb-3 p-4 bg-gradient-to-r from-red-50 via-[#977DFF]/10 to-[#0033FF]/10 rounded-xl border border-red-200">
          <div className="flex items-center gap-4">
            <div className="relative">
              <div className="w-12 h-12 bg-red-500 rounded-full flex items-center justify-center animate-pulse">
                <Mic size={24} className="text-white" />
              </div>
              <span className="absolute -top-1 -right-1 w-4 h-4 bg-red-600 rounded-full animate-ping" />
            </div>
            <div className="flex-1">
              <p className="text-sm font-semibold text-red-600">Recording...</p>
              <p className="text-2xl font-mono font-bold text-gray-800">{formatDuration(recordingDuration)}</p>
            </div>
            <div className="flex gap-2">
              <button
                onClick={cancelRecording}
                className="p-3 text-red-500 hover:bg-red-100 rounded-full transition-colors"
                title="Cancel recording"
              >
                <Trash2 size={24} />
              </button>
              <button
                onClick={stopRecording}
                className="p-3 bg-red-500 text-white hover:bg-red-600 rounded-full transition-colors"
                title="Stop recording"
              >
                <Square size={24} />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Input area */}
      <div className="flex items-end gap-2">
        {/* Attachment button with popup menu */}
        <div className="relative" ref={attachMenuRef}>
          <button
            onClick={() => setShowAttachMenu(!showAttachMenu)}
            disabled={isRecording}
            className={`p-2 rounded-lg transition-colors ${
              showAttachMenu
                ? 'bg-gradient-to-r from-[#FFCCF2] via-[#977DFF]/30 to-[#0033FF]/20 text-[#977DFF]'
                : 'text-gray-500 hover:text-gray-700 hover:bg-gray-100'
            } ${isRecording ? 'opacity-50 cursor-not-allowed' : ''}`}
            title="Attach file"
          >
            <Paperclip size={20} className={showAttachMenu ? 'rotate-45' : ''} style={{ transition: 'transform 0.2s' }} />
          </button>

          {/* Attachment popup menu */}
          {showAttachMenu && (
            <div className="absolute bottom-full left-0 mb-2 bg-white rounded-2xl shadow-xl border border-gray-200 p-3 min-w-[200px] z-50">
              <div className="grid grid-cols-3 gap-3">
                {ATTACHMENT_OPTIONS.map((option) => (
                  <button
                    key={option.id}
                    onClick={() => handleAttachOption(option)}
                    className="flex flex-col items-center gap-2 p-3 rounded-xl hover:bg-gray-50 transition-colors"
                  >
                    <div className={`w-12 h-12 ${option.color} rounded-full flex items-center justify-center`}>
                      <option.icon size={24} className="text-white" />
                    </div>
                    <span className="text-xs text-gray-600 font-medium">{option.label}</span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        <input
          ref={fileInputRef}
          type="file"
          multiple
          className="hidden"
          onChange={handleFileSelect}
          accept={currentAccept}
          capture={useCapture ? 'environment' : undefined}
        />

        {/* Text input */}
        <div className="flex-1 relative">
          <textarea
            ref={textareaRef}
            value={message}
            onChange={(e) => {
              setMessage(e.target.value);
              handleTyping();
            }}
            onKeyDown={handleKeyDown}
            placeholder={isRecording ? 'Recording...' : placeholder}
            disabled={disabled || isRecording}
            rows={1}
            className="w-full px-4 py-2 bg-gray-100 border border-transparent rounded-2xl resize-none focus:outline-none focus:border-[#977DFF] focus:bg-white transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            style={{ maxHeight: '150px' }}
          />
        </div>

        {/* Microphone button - show when no text/files */}
        {!message.trim() && files.length === 0 && !audioUrl && (
          <button
            onClick={isRecording ? stopRecording : startRecording}
            disabled={disabled}
            className={`
              p-2 rounded-lg transition-all
              ${isRecording
                ? 'bg-red-500 text-white hover:bg-red-600 animate-pulse'
                : 'bg-gray-100 text-gray-500 hover:bg-gray-200 hover:text-gray-700'
              }
            `}
            title={isRecording ? 'Stop recording' : 'Record voice message'}
          >
            {isRecording ? <Square size={20} /> : <Mic size={20} />}
          </button>
        )}

        {/* Send button - show when there's content */}
        {(message.trim() || files.length > 0) && (
          <button
            onClick={handleSend}
            disabled={disabled || isRecording}
            className={`
              p-2 rounded-lg transition-all
              ${message.trim() || files.length > 0
                ? 'bg-gradient-to-r from-[#977DFF] to-[#0033FF] text-white hover:from-[#8066EE] hover:to-[#0029CC]'
                : 'bg-gray-100 text-gray-400 cursor-not-allowed'
              }
            `}
            title="Send message"
          >
            <Send size={20} />
          </button>
        )}
      </div>

      {/* Drag overlay */}
      {isDragging && (
        <div className="absolute inset-0 bg-gradient-to-r from-[#FFCCF2]/80 via-[#977DFF]/40 to-[#0033FF]/30 flex items-center justify-center rounded-lg pointer-events-none">
          <div className="text-[#0033FF] font-medium">Drop files here</div>
        </div>
      )}
    </div>
  );
}

// Get file type info for preview
function getFileTypeInfo(file: File) {
  const extension = file.name.split('.').pop()?.toLowerCase() || '';
  const type = file.type;

  // PDF
  if (type === 'application/pdf' || extension === 'pdf') {
    return { icon: '📄', color: 'bg-red-500', label: 'PDF', bgColor: 'bg-red-50' };
  }
  // Word documents
  if (type.includes('word') || ['doc', 'docx'].includes(extension)) {
    return { icon: '📝', color: 'bg-blue-500', label: 'DOC', bgColor: 'bg-blue-50' };
  }
  // Excel
  if (type.includes('excel') || type.includes('spreadsheet') || ['xls', 'xlsx', 'csv'].includes(extension)) {
    return { icon: '📊', color: 'bg-green-500', label: 'XLS', bgColor: 'bg-green-50' };
  }
  // PowerPoint
  if (type.includes('powerpoint') || type.includes('presentation') || ['ppt', 'pptx'].includes(extension)) {
    return { icon: '📽️', color: 'bg-[#977DFF]', label: 'PPT', bgColor: 'bg-[#FFCCF2]/30' };
  }
  // Text files
  if (type.includes('text') || extension === 'txt') {
    return { icon: '📃', color: 'bg-gray-500', label: 'TXT', bgColor: 'bg-gray-50' };
  }
  // Video
  if (type.startsWith('video/')) {
    return { icon: '🎬', color: 'bg-purple-500', label: 'VIDEO', bgColor: 'bg-purple-50' };
  }
  // Audio
  if (type.startsWith('audio/')) {
    return { icon: '🎵', color: 'bg-pink-500', label: 'AUDIO', bgColor: 'bg-pink-50' };
  }
  // Archives
  if (['zip', 'rar', '7z', 'tar', 'gz'].includes(extension)) {
    return { icon: '📦', color: 'bg-yellow-500', label: 'ZIP', bgColor: 'bg-yellow-50' };
  }
  // Default
  return { icon: '📎', color: 'bg-gray-400', label: extension.toUpperCase() || 'FILE', bgColor: 'bg-gray-50' };
}

// File preview component with enhanced document preview
function FilePreview({ file, onRemove }: { file: File; onRemove: () => void }) {
  const isImage = file.type.startsWith('image/');
  const isVideo = file.type.startsWith('video/');
  const [preview, setPreview] = useState<string | null>(null);
  const fileInfo = getFileTypeInfo(file);

  useEffect(() => {
    if (isImage || isVideo) {
      const url = URL.createObjectURL(file);
      setPreview(url);
      return () => URL.revokeObjectURL(url);
    }
  }, [file, isImage, isVideo]);

  const formatSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  };

  // Truncate filename but keep extension visible
  const truncateFileName = (name: string, maxLength: number = 20) => {
    if (name.length <= maxLength) return name;
    const extension = name.split('.').pop() || '';
    const baseName = name.slice(0, name.length - extension.length - 1);
    const truncatedBase = baseName.slice(0, maxLength - extension.length - 4) + '...';
    return `${truncatedBase}.${extension}`;
  };

  return (
    <div className="relative group">
      {/* Image preview */}
      {isImage && preview ? (
        <div className="w-32 h-32 rounded-xl overflow-hidden bg-gray-100 shadow-sm border border-gray-200">
          <img src={preview} alt={file.name} className="w-full h-full object-cover" />
          <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/60 to-transparent p-2">
            <p className="text-white text-xs truncate">{truncateFileName(file.name)}</p>
            <p className="text-white/70 text-xs">{formatSize(file.size)}</p>
          </div>
        </div>
      ) : isVideo && preview ? (
        /* Video preview */
        <div className="w-32 h-32 rounded-xl overflow-hidden bg-gray-900 shadow-sm border border-gray-200 relative">
          <video src={preview} className="w-full h-full object-cover" />
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="w-10 h-10 bg-white/90 rounded-full flex items-center justify-center">
              <div className="w-0 h-0 border-l-[12px] border-l-gray-800 border-y-[8px] border-y-transparent ml-1" />
            </div>
          </div>
          <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/60 to-transparent p-2">
            <p className="text-white text-xs truncate">{truncateFileName(file.name)}</p>
            <p className="text-white/70 text-xs">{formatSize(file.size)}</p>
          </div>
        </div>
      ) : (
        /* Document/File preview */
        <div className={`w-48 rounded-xl overflow-hidden shadow-sm border border-gray-200 ${fileInfo.bgColor}`}>
          {/* File type header */}
          <div className={`${fileInfo.color} px-3 py-2 flex items-center gap-2`}>
            <span className="text-xl">{fileInfo.icon}</span>
            <span className="text-white text-xs font-bold">{fileInfo.label}</span>
          </div>
          {/* File details */}
          <div className="p-3 bg-white">
            <p className="text-sm font-medium text-gray-800 truncate" title={file.name}>
              {truncateFileName(file.name, 25)}
            </p>
            <div className="flex items-center justify-between mt-1">
              <p className="text-xs text-gray-500">{formatSize(file.size)}</p>
              <p className="text-xs text-gray-400">{file.type.split('/')[1] || 'file'}</p>
            </div>
          </div>
        </div>
      )}

      {/* Remove button */}
      <button
        onClick={onRemove}
        className="absolute -top-2 -right-2 w-6 h-6 bg-red-500 text-white rounded-full flex items-center justify-center shadow-md opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-600"
      >
        <X size={14} />
      </button>
    </div>
  );
}
