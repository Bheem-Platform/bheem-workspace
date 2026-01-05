'use client';

import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
  LiveKitRoom,
  GridLayout,
  ParticipantTile,
  RoomAudioRenderer,
  useTracks,
  TrackRefContext,
  useRoomContext,
  useParticipants,
  useDataChannel,
  ControlBar as LKControlBar,
  useTrackRefContext,
} from '@livekit/components-react';
import '@livekit/components-styles';
import { Track, RoomEvent, DataPacket_Kind, RemoteParticipant, LocalParticipant, ParticipantEvent } from 'livekit-client';
import { User, AlertTriangle, Hand } from 'lucide-react';
import type { Participant } from '@/types/meet';

// Custom ParticipantTile with raised hand indicator
function CustomParticipantTile() {
  const trackRef = useTrackRefContext();
  const participant = trackRef?.participant;

  // Parse metadata to check if hand is raised
  let isHandRaised = false;
  try {
    if (participant?.metadata) {
      const metadata = JSON.parse(participant.metadata);
      isHandRaised = metadata.handRaised || false;
    }
  } catch (e) {
    // Ignore parse errors
  }

  return (
    <div className="relative w-full h-full">
      <ParticipantTile />
      {isHandRaised && (
        <div className="absolute top-2 right-2 z-10 animate-bounce">
          <div className="bg-amber-500 rounded-full p-2 shadow-lg">
            <Hand size={24} className="text-white" />
          </div>
        </div>
      )}
    </div>
  );
}

interface LiveKitWrapperProps {
  token: string;
  serverUrl: string;
  hasCamera: boolean;
  hasMic: boolean;
  isHandRaised?: boolean;
  isScreenSharing?: boolean;
  isMicEnabled?: boolean;
  isCameraEnabled?: boolean;
  messageToSend?: { id: string; content: string } | null;
  onLeave: () => void;
  onError?: () => void;
  onParticipantsChange?: (participants: Participant[]) => void;
  onChatMessage?: (message: { senderId: string; senderName: string; content: string }) => void;
  onScreenShareChange?: (isSharing: boolean) => void;
}

// Stage component that shows participants and syncs data
function MeetingStage({
  onParticipantsChange,
  onChatMessage,
  isHandRaised,
  isScreenSharing,
  isMicEnabled,
  isCameraEnabled,
  messageToSend,
  onScreenShareChange,
}: {
  onParticipantsChange?: (participants: Participant[]) => void;
  onChatMessage?: (message: { senderId: string; senderName: string; content: string }) => void;
  isHandRaised?: boolean;
  isScreenSharing?: boolean;
  isMicEnabled?: boolean;
  isCameraEnabled?: boolean;
  messageToSend?: { id: string; content: string } | null;
  onScreenShareChange?: (isSharing: boolean) => void;
}) {
  const room = useRoomContext();
  const lkParticipants = useParticipants();
  const [lastSentMessageId, setLastSentMessageId] = useState<string | null>(null);
  const [currentlyScreenSharing, setCurrentlyScreenSharing] = useState(false);
  const [prevHandRaised, setPrevHandRaised] = useState<boolean | undefined>(undefined);
  const [isRoomConnected, setIsRoomConnected] = useState(false);
  const [metadataVersion, setMetadataVersion] = useState(0); // Force re-render on metadata changes

  // Track room connection state and participant metadata changes
  useEffect(() => {
    if (!room) return;

    const handleConnected = () => setIsRoomConnected(true);
    const handleDisconnected = () => setIsRoomConnected(false);

    // Listen for metadata changes on any participant to trigger re-render
    const handleMetadataChanged = () => {
      setMetadataVersion(v => v + 1);
    };

    room.on(RoomEvent.Connected, handleConnected);
    room.on(RoomEvent.Disconnected, handleDisconnected);
    room.on(RoomEvent.ParticipantMetadataChanged, handleMetadataChanged);
    room.on(RoomEvent.LocalTrackPublished, handleMetadataChanged);

    // Check initial state
    if (room.state === 'connected') {
      setIsRoomConnected(true);
    }

    return () => {
      room.off(RoomEvent.Connected, handleConnected);
      room.off(RoomEvent.Disconnected, handleDisconnected);
      room.off(RoomEvent.ParticipantMetadataChanged, handleMetadataChanged);
      room.off(RoomEvent.LocalTrackPublished, handleMetadataChanged);
    };
  }, [room]);

  // Update local participant metadata when hand raised changes (not on initial mount)
  useEffect(() => {
    if (!room || !room.localParticipant || !isRoomConnected) return;

    // Skip initial mount
    if (prevHandRaised === undefined) {
      setPrevHandRaised(isHandRaised);
      return;
    }
    if (isHandRaised === prevHandRaised) return;

    setPrevHandRaised(isHandRaised);

    const updateMetadata = async () => {
      try {
        const currentMetadata = room.localParticipant.metadata
          ? JSON.parse(room.localParticipant.metadata)
          : {};
        const newMetadata = { ...currentMetadata, handRaised: isHandRaised };
        await room.localParticipant.setMetadata(JSON.stringify(newMetadata));
      } catch (e) {
        console.error('Failed to update metadata:', e);
      }
    };

    updateMetadata();
  }, [room, isHandRaised, prevHandRaised, isRoomConnected]);

  // Send chat message via data channel when messageToSend changes
  useEffect(() => {
    if (!room || !room.localParticipant || !isRoomConnected) return;
    if (!messageToSend || messageToSend.id === lastSentMessageId) return;

    const sendMessage = async () => {
      try {
        const encoder = new TextEncoder();
        const data = encoder.encode(JSON.stringify({
          type: 'chat',
          message: messageToSend.content,
        }));
        await room.localParticipant.publishData(data, { reliable: true });
        setLastSentMessageId(messageToSend.id);
        console.log('Chat message sent via LiveKit:', messageToSend.content);
      } catch (e) {
        console.error('Failed to send chat message:', e);
      }
    };

    sendMessage();
  }, [room, messageToSend, lastSentMessageId, isRoomConnected]);

  // Handle screen sharing toggle - only when connected and user explicitly requests it
  useEffect(() => {
    if (!room || !room.localParticipant || !isRoomConnected) return;
    if (isScreenSharing === currentlyScreenSharing) return;

    const toggleScreenShare = async () => {
      try {
        if (isScreenSharing && !currentlyScreenSharing) {
          // Start screen share
          await room.localParticipant.setScreenShareEnabled(true);
          setCurrentlyScreenSharing(true);
          console.log('Screen share started');
        } else if (!isScreenSharing && currentlyScreenSharing) {
          // Stop screen share
          await room.localParticipant.setScreenShareEnabled(false);
          setCurrentlyScreenSharing(false);
          console.log('Screen share stopped');
        }
      } catch (e) {
        console.error('Failed to toggle screen share:', e);
        // Notify parent of the actual state
        onScreenShareChange?.(currentlyScreenSharing);
      }
    };

    toggleScreenShare();
  }, [room, isScreenSharing, currentlyScreenSharing, onScreenShareChange, isRoomConnected]);

  // Track previous mic/camera state to only toggle on user action, not initial mount
  const [prevMicEnabled, setPrevMicEnabled] = useState<boolean | undefined>(undefined);
  const [prevCameraEnabled, setPrevCameraEnabled] = useState<boolean | undefined>(undefined);

  // Handle mic toggle - only when user explicitly changes it and room is connected
  useEffect(() => {
    if (!room || !room.localParticipant || !isRoomConnected) return;
    // Skip initial mount - only toggle when state actually changes
    if (prevMicEnabled === undefined) {
      setPrevMicEnabled(isMicEnabled);
      return;
    }
    if (isMicEnabled === prevMicEnabled) return;

    setPrevMicEnabled(isMicEnabled);

    const toggleMic = async () => {
      try {
        // Only try to enable if requesting to enable
        if (isMicEnabled) {
          await room.localParticipant.setMicrophoneEnabled(true);
        } else {
          // Disable is always safe
          await room.localParticipant.setMicrophoneEnabled(false);
        }
      } catch (e: any) {
        // Ignore device not found errors - user just doesn't have a mic
        if (e?.name !== 'NotFoundError') {
          console.error('Failed to toggle microphone:', e);
        }
      }
    };

    toggleMic();
  }, [room, isMicEnabled, prevMicEnabled, isRoomConnected]);

  // Handle camera toggle - only when user explicitly changes it and room is connected
  useEffect(() => {
    if (!room || !room.localParticipant || !isRoomConnected) return;
    // Skip initial mount - only toggle when state actually changes
    if (prevCameraEnabled === undefined) {
      setPrevCameraEnabled(isCameraEnabled);
      return;
    }
    if (isCameraEnabled === prevCameraEnabled) return;

    setPrevCameraEnabled(isCameraEnabled);

    const toggleCamera = async () => {
      try {
        // Only try to enable if requesting to enable
        if (isCameraEnabled) {
          await room.localParticipant.setCameraEnabled(true);
        } else {
          // Disable is always safe
          await room.localParticipant.setCameraEnabled(false);
        }
      } catch (e: any) {
        // Ignore device not found errors - user just doesn't have a camera
        if (e?.name !== 'NotFoundError') {
          console.error('Failed to toggle camera:', e);
        }
      }
    };

    toggleCamera();
  }, [room, isCameraEnabled, prevCameraEnabled, isRoomConnected]);

  // Convert LiveKit participants to our Participant type and notify parent
  useEffect(() => {
    if (!room || !onParticipantsChange) return;

    const convertedParticipants: Participant[] = lkParticipants.map((p) => {
      const isLocal = p instanceof LocalParticipant;
      const isMuted = p.isMicrophoneEnabled === false;
      const isVideoOff = p.isCameraEnabled === false;
      let metadata: any = {};
      try {
        metadata = p.metadata ? JSON.parse(p.metadata) : {};
      } catch (e) {
        metadata = {};
      }

      return {
        id: p.identity,
        name: p.name || p.identity || 'Guest',
        isLocal,
        isHost: metadata.isHost || false,
        isModerator: metadata.isModerator || false,
        isMuted,
        isVideoOff,
        isSpeaking: p.isSpeaking || false,
        isHandRaised: metadata.handRaised || false,
        isScreenSharing: p.isScreenShareEnabled || false,
        joinedAt: new Date().toISOString(),
        connectionQuality: 'good',
      };
    });

    onParticipantsChange(convertedParticipants);
  }, [lkParticipants, room, onParticipantsChange, metadataVersion]);

  // Listen for data messages (chat) - only from remote participants
  useEffect(() => {
    if (!room || !onChatMessage) return;

    const handleDataReceived = (payload: Uint8Array, participant?: RemoteParticipant) => {
      // Only process messages from remote participants (not our own)
      // If participant is undefined, it might be our own message echoed back - skip it
      if (!participant) {
        console.log('Skipping data message without participant (likely own message)');
        return;
      }

      try {
        const decoder = new TextDecoder();
        const data = JSON.parse(decoder.decode(payload));

        if (data.type === 'chat') {
          onChatMessage({
            senderId: participant.identity,
            senderName: participant.name || 'Guest',
            content: data.message,
          });
        }
      } catch (e) {
        console.error('Failed to parse data message:', e);
      }
    };

    room.on(RoomEvent.DataReceived, handleDataReceived);
    return () => {
      room.off(RoomEvent.DataReceived, handleDataReceived);
    };
  }, [room, onChatMessage]);

  // Get video tracks
  const tracks = useTracks(
    [
      { source: Track.Source.Camera, withPlaceholder: true },
      { source: Track.Source.ScreenShare, withPlaceholder: false },
    ],
    { onlySubscribed: false }
  );

  return (
    <div className="h-full flex flex-col">
      <div className="flex-1 p-2 sm:p-4">
        {tracks && tracks.length > 0 ? (
          <GridLayout tracks={tracks} style={{ height: '100%' }}>
            <CustomParticipantTile />
          </GridLayout>
        ) : (
          <div className="h-full flex items-center justify-center">
            <div className="text-center">
              <div className="flex flex-wrap justify-center gap-4 mb-6">
                {lkParticipants.map((p) => (
                  <div key={p.identity} className="flex flex-col items-center">
                    <div className="w-20 h-20 rounded-full bg-gradient-to-br from-emerald-400 to-emerald-600 flex items-center justify-center mb-2 shadow-lg">
                      <span className="text-2xl text-white font-bold">
                        {(p.name || p.identity || 'G').charAt(0).toUpperCase()}
                      </span>
                    </div>
                    <span className="text-gray-300 text-sm font-medium">
                      {p.name || p.identity}
                      {p instanceof LocalParticipant && ' (You)'}
                    </span>
                  </div>
                ))}
              </div>
              <p className="text-gray-500 text-sm">
                {lkParticipants.length === 1
                  ? 'Waiting for others to join...'
                  : `${lkParticipants.length} participants in meeting`}
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// Error fallback component
function ErrorFallback({ error, onLeave }: { error: string; onLeave: () => void }) {
  return (
    <div className="h-full flex items-center justify-center">
      <div className="text-center max-w-md p-6">
        <div className="w-16 h-16 bg-yellow-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
          <AlertTriangle size={32} className="text-yellow-400" />
        </div>
        <h2 className="text-xl font-semibold text-white mb-2">
          Connection Issue
        </h2>
        <p className="text-gray-400 mb-4">{error}</p>
        <p className="text-gray-500 text-sm mb-6">
          This might be due to camera/microphone access issues or network problems.
        </p>
        <button
          onClick={onLeave}
          className="px-6 py-2.5 bg-red-500 text-white font-medium rounded-lg hover:bg-red-600 transition-colors"
        >
          Leave Meeting
        </button>
      </div>
    </div>
  );
}

export default function LiveKitWrapper({
  token,
  serverUrl,
  hasCamera,
  hasMic,
  isHandRaised,
  isScreenSharing,
  isMicEnabled,
  isCameraEnabled,
  messageToSend,
  onLeave,
  onError,
  onParticipantsChange,
  onChatMessage,
  onScreenShareChange,
}: LiveKitWrapperProps) {
  const [connectionError, setConnectionError] = useState<string | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [shouldConnect, setShouldConnect] = useState(false);
  const mountedRef = useRef(true);

  // Delay connection to handle React Strict Mode double-mounting
  useEffect(() => {
    mountedRef.current = true;
    const timer = setTimeout(() => {
      if (mountedRef.current) {
        setShouldConnect(true);
      }
    }, 100); // Small delay to let Strict Mode cleanup happen

    return () => {
      mountedRef.current = false;
      clearTimeout(timer);
    };
  }, []);

  // Memoize options to prevent unnecessary reconnections
  const roomOptions = useMemo(() => ({
    adaptiveStream: true,
    dynacast: true,
    publishDefaults: {
      simulcast: false,
    },
    disconnectOnPageLeave: true,
    stopLocalTrackOnUnpublish: true,
  }), []);

  const handleError = useCallback((error: Error) => {
    console.error('LiveKit error:', error);

    // Device not found errors are OK - user can still join and see others
    if (error.name === 'NotFoundError' || error.message.includes('device not found')) {
      console.log('Device not found, but continuing with room connection');
      // Don't set error - just continue without camera/mic
      return;
    } else if (error.message.includes('Permission denied')) {
      console.log('Permission denied, but continuing with room connection');
      // Don't set error - just continue without camera/mic
      return;
    } else if (error.message.includes('Client initiated disconnect')) {
      // This is expected during cleanup/unmount - not a real error
      console.log('Client initiated disconnect - this is normal during cleanup');
      return;
    } else if (error.message.includes('size') || error.message.includes('values') || error.message.includes('undefined')) {
      // Internal LiveKit error - fall back to simple UI
      console.log('LiveKit internal error, triggering fallback');
      onError?.();
      return;
    } else if (error.name === 'ConnectionError') {
      // Connection errors during initial connect - don't trigger fallback immediately
      console.log('Connection error, will retry...');
      return;
    } else {
      setConnectionError(error.message || 'Failed to connect to meeting');
    }

    // For connection errors only, notify parent after a delay
    setTimeout(() => {
      if (!isConnected) {
        onError?.();
      }
    }, 5000);
  }, [onError, isConnected]);

  const handleConnected = useCallback(() => {
    console.log('Connected to LiveKit room');
    setIsConnected(true);
    setConnectionError(null);
  }, []);

  const handleDisconnected = useCallback(() => {
    console.log('Disconnected from LiveKit room');
    // Only call onLeave if we were previously connected
    // This prevents navigation during initial connection failures
    if (isConnected) {
      onLeave();
    }
  }, [isConnected, onLeave]);

  if (connectionError) {
    return <ErrorFallback error={connectionError} onLeave={onLeave} />;
  }

  // Don't render LiveKitRoom until we're ready to connect (handles Strict Mode)
  if (!shouldConnect) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="text-center">
          <div className="w-10 h-10 border-2 border-emerald-500/30 border-t-emerald-500 rounded-full animate-spin mx-auto mb-4" />
          <p className="text-gray-400 text-sm">Connecting to meeting...</p>
        </div>
      </div>
    );
  }

  return (
    <LiveKitRoom
      token={token}
      serverUrl={serverUrl}
      connect={true}
      audio={false}
      video={false}
      onConnected={handleConnected}
      onDisconnected={handleDisconnected}
      onError={handleError}
      options={roomOptions}
    >
      <MeetingStage
        onParticipantsChange={onParticipantsChange}
        onChatMessage={onChatMessage}
        isHandRaised={isHandRaised}
        isScreenSharing={isScreenSharing}
        isMicEnabled={isMicEnabled}
        isCameraEnabled={isCameraEnabled}
        messageToSend={messageToSend}
        onScreenShareChange={onScreenShareChange}
      />
      <RoomAudioRenderer />
    </LiveKitRoom>
  );
}
