import { useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import ParticipantVideo from './ParticipantVideo';

interface Participant {
  id: string;
  name: string;
  identity?: string;
  isLocal?: boolean;
  isSpeaking?: boolean;
  isMuted?: boolean;
  isVideoOff?: boolean;
  isPinned?: boolean;
  isHandRaised?: boolean;
  videoTrack?: MediaStreamTrack | null;
  audioTrack?: MediaStreamTrack | null;
}

interface VideoGridProps {
  participants: Participant[];
  pinnedParticipantId?: string | null;
  activeSpeakerId?: string | null;
  viewMode?: 'grid' | 'speaker' | 'spotlight';
  onPinParticipant?: (id: string) => void;
  onMuteParticipant?: (id: string) => void;
  onRemoveParticipant?: (id: string) => void;
}

export default function VideoGrid({
  participants,
  pinnedParticipantId,
  activeSpeakerId,
  viewMode = 'grid',
  onPinParticipant,
  onMuteParticipant,
  onRemoveParticipant,
}: VideoGridProps) {
  // Calculate grid layout based on participant count
  const gridConfig = useMemo(() => {
    const count = participants.length;
    if (count <= 1) return { cols: 1, rows: 1 };
    if (count <= 2) return { cols: 2, rows: 1 };
    if (count <= 4) return { cols: 2, rows: 2 };
    if (count <= 6) return { cols: 3, rows: 2 };
    if (count <= 9) return { cols: 3, rows: 3 };
    if (count <= 12) return { cols: 4, rows: 3 };
    if (count <= 16) return { cols: 4, rows: 4 };
    return { cols: 5, rows: Math.ceil(count / 5) };
  }, [participants.length]);

  // Sort participants: pinned first, then speaking, then others
  const sortedParticipants = useMemo(() => {
    return [...participants].sort((a, b) => {
      if (a.id === pinnedParticipantId) return -1;
      if (b.id === pinnedParticipantId) return 1;
      if (a.id === activeSpeakerId) return -1;
      if (b.id === activeSpeakerId) return 1;
      if (a.isLocal) return 1; // Local user at the end
      if (b.isLocal) return -1;
      return 0;
    });
  }, [participants, pinnedParticipantId, activeSpeakerId]);

  // Speaker view: one large, others small
  if (viewMode === 'speaker' && participants.length > 1) {
    const speaker = sortedParticipants[0];
    const others = sortedParticipants.slice(1);

    return (
      <div className="h-full flex flex-col p-4 gap-4">
        {/* Main speaker */}
        <div className="flex-1 flex items-center justify-center">
          <ParticipantVideo
            key={speaker.id}
            name={speaker.name}
            identity={speaker.identity}
            isLocal={speaker.isLocal}
            isSpeaking={speaker.id === activeSpeakerId}
            isMuted={speaker.isMuted}
            isVideoOff={speaker.isVideoOff}
            isPinned={speaker.id === pinnedParticipantId}
            isHandRaised={speaker.isHandRaised}
            videoTrack={speaker.videoTrack}
            audioTrack={speaker.audioTrack}
            onPin={() => onPinParticipant?.(speaker.id)}
            onMute={() => onMuteParticipant?.(speaker.id)}
            onRemove={() => onRemoveParticipant?.(speaker.id)}
            size="spotlight"
          />
        </div>

        {/* Filmstrip */}
        <div className="h-32 flex gap-3 overflow-x-auto pb-2 scrollbar-thin">
          <AnimatePresence mode="popLayout">
            {others.map((participant) => (
              <ParticipantVideo
                key={participant.id}
                name={participant.name}
                identity={participant.identity}
                isLocal={participant.isLocal}
                isSpeaking={participant.id === activeSpeakerId}
                isMuted={participant.isMuted}
                isVideoOff={participant.isVideoOff}
                isPinned={participant.id === pinnedParticipantId}
                isHandRaised={participant.isHandRaised}
                videoTrack={participant.videoTrack}
                audioTrack={participant.audioTrack}
                onPin={() => onPinParticipant?.(participant.id)}
                onMute={() => onMuteParticipant?.(participant.id)}
                onRemove={() => onRemoveParticipant?.(participant.id)}
                size="small"
              />
            ))}
          </AnimatePresence>
        </div>
      </div>
    );
  }

  // Spotlight view: only pinned or active speaker
  if (viewMode === 'spotlight' && pinnedParticipantId) {
    const spotlightParticipant = participants.find(p => p.id === pinnedParticipantId);
    if (spotlightParticipant) {
      return (
        <div className="h-full flex items-center justify-center p-4">
          <ParticipantVideo
            key={spotlightParticipant.id}
            name={spotlightParticipant.name}
            identity={spotlightParticipant.identity}
            isLocal={spotlightParticipant.isLocal}
            isSpeaking={spotlightParticipant.id === activeSpeakerId}
            isMuted={spotlightParticipant.isMuted}
            isVideoOff={spotlightParticipant.isVideoOff}
            isPinned={true}
            isHandRaised={spotlightParticipant.isHandRaised}
            videoTrack={spotlightParticipant.videoTrack}
            audioTrack={spotlightParticipant.audioTrack}
            onPin={() => onPinParticipant?.(spotlightParticipant.id)}
            onMute={() => onMuteParticipant?.(spotlightParticipant.id)}
            onRemove={() => onRemoveParticipant?.(spotlightParticipant.id)}
            size="spotlight"
          />
        </div>
      );
    }
  }

  // Default grid view
  return (
    <div className="h-full p-4 flex items-center justify-center">
      <div
        className="grid gap-3 w-full h-full max-w-full max-h-full"
        style={{
          gridTemplateColumns: `repeat(${gridConfig.cols}, minmax(200px, 1fr))`,
          gridTemplateRows: `repeat(${gridConfig.rows}, minmax(150px, 1fr))`,
        }}
      >
        <AnimatePresence mode="popLayout">
          {sortedParticipants.map((participant) => (
            <ParticipantVideo
              key={participant.id}
              name={participant.name}
              identity={participant.identity}
              isLocal={participant.isLocal}
              isSpeaking={participant.id === activeSpeakerId}
              isMuted={participant.isMuted}
              isVideoOff={participant.isVideoOff}
              isPinned={participant.id === pinnedParticipantId}
              isHandRaised={participant.isHandRaised}
              videoTrack={participant.videoTrack}
              audioTrack={participant.audioTrack}
              onPin={() => onPinParticipant?.(participant.id)}
              onMute={() => onMuteParticipant?.(participant.id)}
              onRemove={() => onRemoveParticipant?.(participant.id)}
              size="medium"
            />
          ))}
        </AnimatePresence>
      </div>
    </div>
  );
}
