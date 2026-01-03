'use client';

import { useState, useEffect, useCallback } from 'react';
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
} from '@livekit/components-react';
import '@livekit/components-styles';
import { Track, RoomEvent, DataPacket_Kind, RemoteParticipant, LocalParticipant } from 'livekit-client';
import { User, AlertTriangle } from 'lucide-react';
import type { Participant } from '@/types/meet';

interface LiveKitWrapperProps {
  token: string;
  serverUrl: string;
  hasCamera: boolean;
  hasMic: boolean;
  onLeave: () => void;
  onError?: () => void;
  onParticipantsChange?: (participants: Participant[]) => void;
  onChatMessage?: (message: { senderId: string; senderName: string; content: string }) => void;
}

// Stage component that shows participants and syncs data
function MeetingStage({
  onParticipantsChange,
  onChatMessage,
}: {
  onParticipantsChange?: (participants: Participant[]) => void;
  onChatMessage?: (message: { senderId: string; senderName: string; content: string }) => void;
}) {
  const room = useRoomContext();
  const lkParticipants = useParticipants();

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
  }, [lkParticipants, room, onParticipantsChange]);

  // Listen for data messages (chat)
  useEffect(() => {
    if (!room || !onChatMessage) return;

    const handleDataReceived = (payload: Uint8Array, participant?: RemoteParticipant) => {
      try {
        const decoder = new TextDecoder();
        const data = JSON.parse(decoder.decode(payload));

        if (data.type === 'chat') {
          onChatMessage({
            senderId: participant?.identity || 'unknown',
            senderName: participant?.name || 'Guest',
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
            <ParticipantTile />
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
  onLeave,
  onError,
  onParticipantsChange,
  onChatMessage,
}: LiveKitWrapperProps) {
  const [connectionError, setConnectionError] = useState<string | null>(null);
  const [isConnected, setIsConnected] = useState(false);

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
    } else if (error.message.includes('size') || error.message.includes('values') || error.message.includes('undefined')) {
      // Internal LiveKit error - fall back to simple UI
      console.log('LiveKit internal error, triggering fallback');
      onError?.();
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

  if (connectionError) {
    return <ErrorFallback error={connectionError} onLeave={onLeave} />;
  }

  return (
    <LiveKitRoom
      token={token}
      serverUrl={serverUrl}
      connect={true}
      audio={hasMic}
      video={hasCamera}
      onConnected={handleConnected}
      onDisconnected={onLeave}
      onError={handleError}
      options={{
        adaptiveStream: true,
        dynacast: true,
        // Prevent auto-publishing if devices might fail
        publishDefaults: {
          simulcast: hasCamera,
        },
      }}
    >
      <MeetingStage
        onParticipantsChange={onParticipantsChange}
        onChatMessage={onChatMessage}
      />
      <RoomAudioRenderer />
    </LiveKitRoom>
  );
}
