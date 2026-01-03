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
  ControlBar,
} from '@livekit/components-react';
import '@livekit/components-styles';
import { Track, RoomEvent } from 'livekit-client';
import { User, AlertTriangle } from 'lucide-react';

interface LiveKitWrapperProps {
  token: string;
  serverUrl: string;
  hasCamera: boolean;
  hasMic: boolean;
  onLeave: () => void;
  onError?: () => void;
}

// Simple stage that shows participants
function SimpleStage() {
  const room = useRoomContext();
  const [participants, setParticipants] = useState<string[]>([]);

  useEffect(() => {  
    if (!room) return;

    const updateParticipants = () => {
      const names = Array.from(room.remoteParticipants.values()).map(
        (p) => p.identity || p.name || 'Unknown'
      );
      // Add local participant
      if (room.localParticipant) {
        names.unshift(room.localParticipant.identity || 'You');
      }
      setParticipants(names);
    };

    updateParticipants();

    room.on(RoomEvent.ParticipantConnected, updateParticipants);
    room.on(RoomEvent.ParticipantDisconnected, updateParticipants);
    room.on(RoomEvent.Connected, updateParticipants);

    return () => {
      room.off(RoomEvent.ParticipantConnected, updateParticipants);
      room.off(RoomEvent.ParticipantDisconnected, updateParticipants);
      room.off(RoomEvent.Connected, updateParticipants);
    };
  }, [room]);

  // Try to get video tracks
  const tracks = useTracks(
    [
      { source: Track.Source.Camera, withPlaceholder: true },
      { source: Track.Source.ScreenShare, withPlaceholder: false },
    ],
    { onlySubscribed: false }
  );

  return (
    <div className="h-full flex flex-col">
      <div className="flex-1 p-4">
        {tracks && tracks.length > 0 ? (
          <GridLayout tracks={tracks} style={{ height: '100%' }}>
            <ParticipantTile />
          </GridLayout>
        ) : (
          <div className="h-full flex items-center justify-center">
            <div className="text-center">
              <div className="flex flex-wrap justify-center gap-4 mb-6">
                {participants.map((name, i) => (
                  <div key={i} className="flex flex-col items-center">
                    <div className="w-20 h-20 rounded-full bg-gradient-to-br from-green-400 to-green-600 flex items-center justify-center mb-2">
                      <span className="text-2xl text-white font-bold">
                        {name.charAt(0).toUpperCase()}
                      </span>
                    </div>
                    <span className="text-gray-400 text-sm">{name}</span>
                  </div>
                ))}
              </div>
              <p className="text-gray-500 text-sm">
                {participants.length === 1
                  ? 'Waiting for others to join...'
                  : `${participants.length} participants in meeting`}
              </p>
            </div>
          </div>
        )}
      </div>
      <ControlBar variation="minimal" />
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
}: LiveKitWrapperProps) {
  const [connectionError, setConnectionError] = useState<string | null>(null);
  const [isConnected, setIsConnected] = useState(false);

  const handleError = useCallback((error: Error) => {
    console.error('LiveKit error:', error);

    // Check for common errors and call onError to fall back
    if (error.name === 'NotFoundError' || error.message.includes('device not found')) {
      setConnectionError('Camera or microphone not found. Please check your device settings.');
    } else if (error.message.includes('Permission denied')) {
      setConnectionError('Camera/microphone permission denied. Please allow access in your browser.');
    } else if (error.message.includes('size') || error.message.includes('values') || error.message.includes('undefined')) {
      // Internal LiveKit error - fall back to simple UI
      console.log('LiveKit internal error, triggering fallback');
      onError?.();
      return;
    } else {
      setConnectionError(error.message || 'Failed to connect to meeting');
    }

    // For any error, also notify parent after a delay
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
      <SimpleStage />
      <RoomAudioRenderer />
    </LiveKitRoom>
  );
}
