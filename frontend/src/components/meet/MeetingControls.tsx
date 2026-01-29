'use client';

import { useState, useEffect } from 'react';
import { useMeetStore } from '@/stores/meetStore';
import RecordingIndicator from './RecordingIndicator';

interface MeetingControlsProps {
  onLeave: () => void;
  roomCode?: string;
}

export default function MeetingControls({ onLeave, roomCode }: MeetingControlsProps) {
  const {
    isMicEnabled,
    isCameraEnabled,
    isScreenSharing,
    recordingSession,
    isChatPanelOpen,
    isParticipantsPanelOpen,
    isWaitingRoomPanelOpen,
    isHost,
    waitingParticipants,
    toggleMic,
    toggleCamera,
    toggleScreenShare,
    startRecording,
    stopRecording,
    toggleChatPanel,
    toggleParticipantsPanel,
    toggleWaitingRoomPanel,
    openRecordingsModal,
    fetchWaitingParticipants,
    participants,
    chatMessages,
    loading,
  } = useMeetStore();

  const [showMoreMenu, setShowMoreMenu] = useState(false);
  const [copied, setCopied] = useState(false);
  const [showRecordingOptions, setShowRecordingOptions] = useState(false);
  const [recordingLayout, setRecordingLayout] = useState<'grid' | 'speaker'>('grid');
  const [recordingResolution, setRecordingResolution] = useState<'720p' | '1080p' | '1440p'>('1080p');

  // Fetch waiting participants periodically if host
  useEffect(() => {
    if (isHost && roomCode) {
      fetchWaitingParticipants();
      const interval = setInterval(fetchWaitingParticipants, 10000);
      return () => clearInterval(interval);
    }
    return undefined;
  }, [isHost, roomCode, fetchWaitingParticipants]);

  const copyMeetingLink = async () => {
    if (roomCode) {
      const link = `${window.location.origin}/meet/room/${roomCode}`;
      await navigator.clipboard.writeText(link);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleToggleRecording = async () => {
    if (recordingSession.isRecording) {
      await stopRecording();
    } else {
      await startRecording({ layout: recordingLayout, resolution: recordingResolution });
    }
    setShowMoreMenu(false);
  };

  const handleFullscreen = () => {
    if (document.fullscreenElement) {
      document.exitFullscreen();
    } else {
      document.documentElement.requestFullscreen();
    }
    setShowMoreMenu(false);
  };

  const unreadMessages = chatMessages.filter((m: any) => !m.read).length;
  const waitingCount = waitingParticipants.length;

  return (
    <div className="h-20 bg-gray-900 border-t border-gray-800 flex items-center justify-between px-6">
      {/* Left - Meeting Info & Recording Indicator */}
      <div className="flex items-center gap-4">
        <div className="text-white">
          <p className="text-sm font-medium">
            {new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </p>
          {roomCode && <p className="text-xs text-gray-400">{roomCode}</p>}
        </div>

        {/* Recording indicator */}
        <RecordingIndicator />

        {roomCode && (
          <button
            onClick={copyMeetingLink}
            className="flex items-center gap-2 px-3 py-1.5 bg-gray-800 hover:bg-gray-700 rounded-lg text-sm text-gray-300 transition-colors"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
            </svg>
            <span>{copied ? 'Copied!' : 'Copy link'}</span>
          </button>
        )}
      </div>

      {/* Center - Main Controls */}
      <div className="flex items-center gap-3">
        {/* Mic */}
        <button
          onClick={toggleMic}
          className={`p-4 rounded-full transition-colors ${
            isMicEnabled
              ? 'bg-gray-700 hover:bg-gray-600 text-white'
              : 'bg-red-500 hover:bg-red-600 text-white'
          }`}
          title={isMicEnabled ? 'Turn off microphone' : 'Turn on microphone'}
        >
          {isMicEnabled ? (
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
            </svg>
          ) : (
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" clipRule="evenodd" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2" />
            </svg>
          )}
        </button>

        {/* Camera */}
        <button
          onClick={toggleCamera}
          className={`p-4 rounded-full transition-colors ${
            isCameraEnabled
              ? 'bg-gray-700 hover:bg-gray-600 text-white'
              : 'bg-red-500 hover:bg-red-600 text-white'
          }`}
          title={isCameraEnabled ? 'Turn off camera' : 'Turn on camera'}
        >
          {isCameraEnabled ? (
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
            </svg>
          ) : (
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
            </svg>
          )}
        </button>

        {/* Screen Share */}
        <button
          onClick={toggleScreenShare}
          className={`p-4 rounded-full transition-colors ${
            isScreenSharing
              ? 'bg-green-500 hover:bg-green-600 text-white'
              : 'bg-gray-700 hover:bg-gray-600 text-white'
          }`}
          title={isScreenSharing ? 'Stop sharing' : 'Share screen'}
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
          </svg>
        </button>

        {/* Recording (Host only) */}
        {isHost && (
          <div className="relative">
            <button
              onClick={handleToggleRecording}
              disabled={loading.recording}
              className={`p-4 rounded-full transition-colors ${
                recordingSession.isRecording
                  ? 'bg-red-500 hover:bg-red-600 text-white'
                  : 'bg-gray-700 hover:bg-gray-600 text-white'
              } disabled:opacity-50`}
              title={recordingSession.isRecording ? 'Stop recording' : 'Start recording'}
            >
              {loading.recording ? (
                <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
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
            </button>
          </div>
        )}

        {/* More Options */}
        <div className="relative">
          <button
            onClick={() => setShowMoreMenu(!showMoreMenu)}
            className="p-4 rounded-full bg-gray-700 hover:bg-gray-600 text-white transition-colors"
            title="More options"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z" />
            </svg>
          </button>

          {showMoreMenu && (
            <div className="absolute bottom-full mb-2 right-0 bg-gray-800 rounded-lg shadow-xl border border-gray-700 py-2 min-w-[200px] z-50">
              {/* View Recordings */}
              <button
                onClick={() => {
                  openRecordingsModal();
                  setShowMoreMenu(false);
                }}
                className="w-full flex items-center gap-3 px-4 py-2 text-sm text-gray-300 hover:bg-gray-700"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                </svg>
                <span>View Recordings</span>
              </button>

              <div className="border-t border-gray-700 my-1" />

              {/* Fullscreen */}
              <button
                onClick={handleFullscreen}
                className="w-full flex items-center gap-3 px-4 py-2 text-sm text-gray-300 hover:bg-gray-700"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" />
                </svg>
                <span>Full Screen</span>
              </button>

              {/* Settings */}
              <button
                onClick={() => setShowMoreMenu(false)}
                className="w-full flex items-center gap-3 px-4 py-2 text-sm text-gray-300 hover:bg-gray-700"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
                <span>Settings</span>
              </button>
            </div>
          )}
        </div>

        {/* Leave */}
        <button
          onClick={onLeave}
          className="px-6 py-3 rounded-full bg-red-500 hover:bg-red-600 text-white font-medium transition-colors flex items-center gap-2"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 8l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2M5 3a2 2 0 00-2 2v1c0 8.284 6.716 15 15 15h1a2 2 0 002-2v-3.28a1 1 0 00-.684-.948l-4.493-1.498a1 1 0 00-1.21.502l-1.13 2.257a11.042 11.042 0 01-5.516-5.517l2.257-1.128a1 1 0 00.502-1.21L9.228 3.683A1 1 0 008.279 3H5z" />
          </svg>
          <span>Leave</span>
        </button>
      </div>

      {/* Right - Side Panels */}
      <div className="flex items-center gap-2">
        {/* Waiting Room (Host only) */}
        {isHost && (
          <button
            onClick={toggleWaitingRoomPanel}
            className={`relative p-3 rounded-full transition-colors ${
              isWaitingRoomPanelOpen
                ? 'bg-orange-500 text-white'
                : 'bg-gray-700 hover:bg-gray-600 text-white'
            }`}
            title="Waiting Room"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            {waitingCount > 0 && (
              <span className="absolute -top-1 -right-1 w-5 h-5 bg-orange-600 text-white text-xs rounded-full flex items-center justify-center animate-pulse">
                {waitingCount}
              </span>
            )}
          </button>
        )}

        {/* Participants */}
        <button
          onClick={toggleParticipantsPanel}
          className={`relative p-3 rounded-full transition-colors ${
            isParticipantsPanelOpen
              ? 'bg-blue-500 text-white'
              : 'bg-gray-700 hover:bg-gray-600 text-white'
          }`}
          title="Participants"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
          </svg>
          {participants.length > 0 && (
            <span className="absolute -top-1 -right-1 w-5 h-5 bg-gray-600 text-white text-xs rounded-full flex items-center justify-center">
              {participants.length}
            </span>
          )}
        </button>

        {/* Chat */}
        <button
          onClick={toggleChatPanel}
          className={`relative p-3 rounded-full transition-colors ${
            isChatPanelOpen
              ? 'bg-blue-500 text-white'
              : 'bg-gray-700 hover:bg-gray-600 text-white'
          }`}
          title="Chat"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
          </svg>
          {unreadMessages > 0 && (
            <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white text-xs rounded-full flex items-center justify-center">
              {unreadMessages}
            </span>
          )}
        </button>
      </div>
    </div>
  );
}
