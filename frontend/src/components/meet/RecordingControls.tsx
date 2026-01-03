'use client';

import { useState } from 'react';
import { useMeetStore } from '@/stores/meetStore';

interface RecordingControlsProps {
  variant?: 'button' | 'icon';
  size?: 'sm' | 'md' | 'lg';
  showLabel?: boolean;
}

export default function RecordingControls({
  variant = 'button',
  size = 'md',
  showLabel = true,
}: RecordingControlsProps) {
  const {
    recordingSession,
    loading,
    isHost,
    startRecording,
    stopRecording,
    openRecordingsModal,
  } = useMeetStore();

  const [showOptions, setShowOptions] = useState(false);

  const handleRecordingToggle = async () => {
    if (recordingSession.isRecording) {
      await stopRecording();
    } else {
      await startRecording();
    }
  };

  const sizeClasses = {
    sm: 'p-1.5',
    md: 'p-2',
    lg: 'p-3',
  };

  const iconSizes = {
    sm: 'w-4 h-4',
    md: 'w-5 h-5',
    lg: 'w-6 h-6',
  };

  // Only hosts can start/stop recording
  if (!isHost) {
    return null;
  }

  if (variant === 'icon') {
    return (
      <div className="relative">
        <button
          onClick={handleRecordingToggle}
          disabled={loading.recording}
          className={`
            ${sizeClasses[size]}
            rounded-full transition-colors
            ${recordingSession.isRecording
              ? 'bg-red-600 hover:bg-red-700 text-white'
              : 'bg-gray-700 hover:bg-gray-600 text-white'
            }
            disabled:opacity-50 disabled:cursor-not-allowed
          `}
          title={recordingSession.isRecording ? 'Stop Recording' : 'Start Recording'}
        >
          {loading.recording ? (
            <svg className={`${iconSizes[size]} animate-spin`} fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
            </svg>
          ) : recordingSession.isRecording ? (
            <svg className={iconSizes[size]} fill="currentColor" viewBox="0 0 24 24">
              <rect x="6" y="6" width="12" height="12" rx="1" />
            </svg>
          ) : (
            <svg className={iconSizes[size]} fill="currentColor" viewBox="0 0 24 24">
              <circle cx="12" cy="12" r="8" />
            </svg>
          )}
        </button>
      </div>
    );
  }

  return (
    <div className="relative">
      <div className="flex items-center gap-1">
        <button
          onClick={handleRecordingToggle}
          disabled={loading.recording}
          className={`
            flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-colors
            ${recordingSession.isRecording
              ? 'bg-red-600 hover:bg-red-700 text-white'
              : 'bg-gray-700 hover:bg-gray-600 text-white'
            }
            disabled:opacity-50 disabled:cursor-not-allowed
          `}
        >
          {loading.recording ? (
            <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
            </svg>
          ) : recordingSession.isRecording ? (
            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
              <rect x="6" y="6" width="12" height="12" rx="1" />
            </svg>
          ) : (
            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
              <circle cx="12" cy="12" r="8" />
            </svg>
          )}
          {showLabel && (
            <span>
              {loading.recording
                ? 'Processing...'
                : recordingSession.isRecording
                ? 'Stop Recording'
                : 'Start Recording'}
            </span>
          )}
        </button>

        {/* Options dropdown */}
        <button
          onClick={() => setShowOptions(!showOptions)}
          className="p-2 rounded-lg bg-gray-700 hover:bg-gray-600 text-white"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </button>
      </div>

      {/* Options menu */}
      {showOptions && (
        <div className="absolute bottom-full left-0 mb-2 w-48 bg-gray-800 rounded-lg shadow-lg border border-gray-700 py-1 z-50">
          <button
            onClick={() => {
              openRecordingsModal();
              setShowOptions(false);
            }}
            className="w-full px-4 py-2 text-left text-sm text-gray-200 hover:bg-gray-700 flex items-center gap-2"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
            </svg>
            View Recordings
          </button>

          <div className="border-t border-gray-700 my-1" />

          <div className="px-4 py-2">
            <div className="text-xs text-gray-400 mb-2">Recording Quality</div>
            <select
              className="w-full bg-gray-700 text-sm text-white rounded px-2 py-1 border border-gray-600"
              defaultValue="1080p"
            >
              <option value="720p">720p</option>
              <option value="1080p">1080p (Default)</option>
              <option value="1440p">1440p</option>
            </select>
          </div>

          <div className="px-4 py-2">
            <div className="text-xs text-gray-400 mb-2">Layout</div>
            <select
              className="w-full bg-gray-700 text-sm text-white rounded px-2 py-1 border border-gray-600"
              defaultValue="grid"
            >
              <option value="grid">Grid View</option>
              <option value="speaker">Speaker View</option>
              <option value="single-speaker">Active Speaker Only</option>
            </select>
          </div>
        </div>
      )}
    </div>
  );
}
