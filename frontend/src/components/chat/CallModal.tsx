/**
 * CallModal - Video/Audio call interface using LiveKit
 */

'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  LiveKitRoom,
  VideoConference,
  GridLayout,
  ParticipantTile,
  useTracks,
  RoomAudioRenderer,
  ControlBar,
  useRoomContext,
  useParticipants,
} from '@livekit/components-react';
import '@livekit/components-styles';
import { Track, Room, ConnectionState } from 'livekit-client';
import {
  Phone,
  PhoneOff,
  Video,
  VideoOff,
  Mic,
  MicOff,
  X,
  Loader2,
  User,
  Clock,
} from 'lucide-react';
import type { CallLog } from '@/stores/chatStore';

interface CallModalProps {
  isOpen: boolean;
  call: CallLog | null;
  token: string | null;
  wsUrl: string | null;
  callType: 'audio' | 'video';
  participantName: string;
  otherParticipantName: string;
  onEndCall: () => void;
  onClose: () => void;
}

export default function CallModal({
  isOpen,
  call,
  token,
  wsUrl,
  callType,
  participantName,
  otherParticipantName,
  onEndCall,
  onClose,
}: CallModalProps) {
  const [callDuration, setCallDuration] = useState(0);
  const [isConnected, setIsConnected] = useState(false);
  const [connectionError, setConnectionError] = useState<string | null>(null);
  const [hasAudioDevice, setHasAudioDevice] = useState<boolean | null>(null);
  const [hasVideoDevice, setHasVideoDevice] = useState<boolean | null>(null);

  // Check for available media devices
  useEffect(() => {
    async function checkDevices() {
      try {
        const devices = await navigator.mediaDevices.enumerateDevices();
        const audioInputs = devices.filter(d => d.kind === 'audioinput');
        const videoInputs = devices.filter(d => d.kind === 'videoinput');
        setHasAudioDevice(audioInputs.length > 0);
        setHasVideoDevice(videoInputs.length > 0);

        // If no audio device for a call, show error
        if (audioInputs.length === 0) {
          setConnectionError('No microphone found. Please connect a microphone and try again.');
        }
      } catch (err) {
        console.error('[CallModal] Error checking devices:', err);
        // If we can't enumerate, try to proceed anyway
        setHasAudioDevice(true);
        setHasVideoDevice(true);
      }
    }

    if (isOpen) {
      checkDevices();
    }
  }, [isOpen]);

  // Timer for call duration
  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (isConnected && call?.status === 'ongoing') {
      interval = setInterval(() => {
        setCallDuration((d) => d + 1);
      }, 1000);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isConnected, call?.status]);

  // Reset duration when call starts
  useEffect(() => {
    if (call?.status === 'ongoing') {
      setCallDuration(0);
    }
  }, [call?.status]);

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const handleDisconnected = useCallback(() => {
    setIsConnected(false);
  }, []);

  const handleConnected = useCallback(() => {
    setIsConnected(true);
    setConnectionError(null);
  }, []);

  const handleError = useCallback((error: Error) => {
    console.error('[CallModal] Connection error:', error);
    setConnectionError(error.message);
  }, []);

  if (!isOpen) return null;

  // Show loading state while waiting for token or device check
  if (!token || !wsUrl || hasAudioDevice === null) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90">
        <div className="text-center text-white">
          <Loader2 size={48} className="animate-spin mx-auto mb-4" />
          <p className="text-lg">{hasAudioDevice === null ? 'Checking devices...' : 'Connecting call...'}</p>
        </div>
      </div>
    );
  }

  // Show error state
  if (connectionError) {
    const isDeviceError = connectionError.toLowerCase().includes('device') ||
                          connectionError.toLowerCase().includes('microphone') ||
                          connectionError.toLowerCase().includes('not found');
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90">
        <div className="text-center text-white max-w-md p-6">
          <div className={`w-16 h-16 ${isDeviceError ? 'bg-[#977DFF]' : 'bg-red-500'} rounded-full flex items-center justify-center mx-auto mb-4`}>
            {isDeviceError ? <MicOff size={32} /> : <PhoneOff size={32} />}
          </div>
          <h3 className="text-xl font-semibold mb-2">
            {isDeviceError ? 'Microphone Required' : 'Connection Failed'}
          </h3>
          <p className="text-gray-400 mb-4">{connectionError}</p>
          {isDeviceError && (
            <div className="text-sm text-gray-500 mb-6 text-left bg-gray-800 p-4 rounded-lg">
              <p className="font-medium text-gray-300 mb-2">To make calls, please:</p>
              <ul className="list-disc list-inside space-y-1">
                <li>Connect a microphone to your device</li>
                <li>Allow browser access to microphone when prompted</li>
                <li>Check your browser's site permissions</li>
              </ul>
            </div>
          )}
          <button
            onClick={onClose}
            className="px-6 py-2 bg-white text-black rounded-lg font-medium hover:bg-gray-200"
          >
            Close
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 bg-gray-900">
      <LiveKitRoom
        serverUrl={wsUrl}
        token={token}
        connect={true}
        video={callType === 'video' && hasVideoDevice === true}
        audio={hasAudioDevice === true}
        onConnected={handleConnected}
        onDisconnected={handleDisconnected}
        onError={handleError}
        data-lk-theme="default"
        style={{ height: '100%' }}
      >
        <CallContent
          callType={callType}
          callDuration={callDuration}
          formatDuration={formatDuration}
          isConnected={isConnected}
          otherParticipantName={otherParticipantName}
          callStatus={call?.status || 'ringing'}
          onEndCall={onEndCall}
          onClose={onClose}
        />
        <RoomAudioRenderer />
      </LiveKitRoom>
    </div>
  );
}

interface CallContentProps {
  callType: 'audio' | 'video';
  callDuration: number;
  formatDuration: (seconds: number) => string;
  isConnected: boolean;
  otherParticipantName: string;
  callStatus: string;
  onEndCall: () => void;
  onClose: () => void;
}

function CallContent({
  callType,
  callDuration,
  formatDuration,
  isConnected,
  otherParticipantName,
  callStatus,
  onEndCall,
  onClose,
}: CallContentProps) {
  const room = useRoomContext();
  const participants = useParticipants();
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoOff, setIsVideoOff] = useState(callType === 'audio');

  const tracks = useTracks(
    [
      { source: Track.Source.Camera, withPlaceholder: true },
      { source: Track.Source.ScreenShare, withPlaceholder: false },
    ],
    { onlySubscribed: false }
  );

  const toggleMute = useCallback(async () => {
    await room.localParticipant.setMicrophoneEnabled(isMuted);
    setIsMuted(!isMuted);
  }, [room, isMuted]);

  const toggleVideo = useCallback(async () => {
    await room.localParticipant.setCameraEnabled(isVideoOff);
    setIsVideoOff(!isVideoOff);
  }, [room, isVideoOff]);

  const handleEndCall = useCallback(() => {
    room.disconnect();
    onEndCall();
  }, [room, onEndCall]);

  // Check if we're still waiting for the other participant
  const remoteParticipants = participants.filter(p => !p.isLocal);
  const isWaiting = callStatus === 'ringing' || remoteParticipants.length === 0;

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 bg-gray-800/50">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-gradient-to-br from-[#977DFF] to-[#0033FF] rounded-full flex items-center justify-center">
            {callType === 'video' ? <Video size={20} className="text-white" /> : <Phone size={20} className="text-white" />}
          </div>
          <div>
            <h3 className="text-white font-medium">{otherParticipantName}</h3>
            <div className="flex items-center gap-2 text-sm">
              {isWaiting ? (
                <span className="text-yellow-400">Calling...</span>
              ) : (
                <>
                  <span className="text-green-400">Connected</span>
                  <span className="text-gray-400 flex items-center gap-1">
                    <Clock size={14} />
                    {formatDuration(callDuration)}
                  </span>
                </>
              )}
            </div>
          </div>
        </div>
        <button
          onClick={onClose}
          className="p-2 text-gray-400 hover:text-white hover:bg-gray-700 rounded-lg"
        >
          <X size={20} />
        </button>
      </div>

      {/* Main content */}
      <div className="flex-1 relative">
        {callType === 'video' ? (
          // Video call layout
          <GridLayout tracks={tracks} style={{ height: '100%' }}>
            <ParticipantTile />
          </GridLayout>
        ) : (
          // Audio call layout
          <div className="h-full flex items-center justify-center">
            <div className="text-center">
              <div className="w-32 h-32 bg-gray-700 rounded-full flex items-center justify-center mx-auto mb-6">
                <User size={64} className="text-gray-400" />
              </div>
              <h2 className="text-2xl font-semibold text-white mb-2">
                {otherParticipantName}
              </h2>
              {isWaiting ? (
                <div className="flex items-center justify-center gap-2 text-yellow-400">
                  <Loader2 size={20} className="animate-spin" />
                  <span>Calling...</span>
                </div>
              ) : (
                <div className="flex items-center justify-center gap-2 text-green-400">
                  <Clock size={20} />
                  <span className="text-2xl font-mono">{formatDuration(callDuration)}</span>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Controls */}
      <div className="px-4 py-6 bg-gray-800/50">
        <div className="flex items-center justify-center gap-4">
          {/* Mute button */}
          <button
            onClick={toggleMute}
            className={`p-4 rounded-full transition-colors ${
              isMuted
                ? 'bg-red-500 text-white'
                : 'bg-gray-700 text-white hover:bg-gray-600'
            }`}
            title={isMuted ? 'Unmute' : 'Mute'}
          >
            {isMuted ? <MicOff size={24} /> : <Mic size={24} />}
          </button>

          {/* Video toggle (only for video calls) */}
          {callType === 'video' && (
            <button
              onClick={toggleVideo}
              className={`p-4 rounded-full transition-colors ${
                isVideoOff
                  ? 'bg-red-500 text-white'
                  : 'bg-gray-700 text-white hover:bg-gray-600'
              }`}
              title={isVideoOff ? 'Turn on camera' : 'Turn off camera'}
            >
              {isVideoOff ? <VideoOff size={24} /> : <Video size={24} />}
            </button>
          )}

          {/* End call button */}
          <button
            onClick={handleEndCall}
            className="p-4 bg-red-500 text-white rounded-full hover:bg-red-600 transition-colors"
            title="End call"
          >
            <PhoneOff size={24} />
          </button>
        </div>
      </div>
    </div>
  );
}
