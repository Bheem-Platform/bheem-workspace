import { useState, useRef, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Mic, MicOff, Pin, MoreVertical, Video, VideoOff, Hand } from 'lucide-react';
import { MeetAvatar } from './ui';

interface ParticipantVideoProps {
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
  onPin?: () => void;
  onMute?: () => void;
  onRemove?: () => void;
  size?: 'small' | 'medium' | 'large' | 'spotlight';
}

export default function ParticipantVideo({
  name,
  identity,
  isLocal = false,
  isSpeaking = false,
  isMuted = false,
  isVideoOff = true,
  isPinned = false,
  isHandRaised = false,
  videoTrack,
  audioTrack,
  onPin,
  onMute,
  onRemove,
  size = 'medium',
}: ParticipantVideoProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [showMenu, setShowMenu] = useState(false);
  const [isHovered, setIsHovered] = useState(false);

  useEffect(() => {
    if (videoRef.current && videoTrack) {
      const stream = new MediaStream([videoTrack]);
      videoRef.current.srcObject = stream;
    }
  }, [videoTrack]);

  const sizeStyles = {
    small: 'min-w-[160px] aspect-video',
    medium: 'min-w-[280px] aspect-video',
    large: 'min-w-[400px] aspect-video',
    spotlight: 'w-full h-full',
  };

  const avatarSizes = {
    small: 'md' as const,
    medium: 'lg' as const,
    large: 'xl' as const,
    spotlight: 'xl' as const,
  };

  return (
    <motion.div
      layout
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.9 }}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      className={`
        relative rounded-2xl overflow-hidden bg-gray-800
        ${sizeStyles[size]}
        ${isSpeaking ? 'ring-2 ring-emerald-400 shadow-lg shadow-emerald-500/20' : 'ring-1 ring-gray-700'}
        transition-all duration-200
      `}
    >
      {/* Video or Avatar */}
      {videoTrack && !isVideoOff ? (
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted={isLocal}
          className={`w-full h-full object-cover ${isLocal ? 'scale-x-[-1]' : ''}`}
        />
      ) : (
        <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-gray-800 to-gray-900">
          <MeetAvatar name={name} size={avatarSizes[size]} status={isSpeaking ? 'speaking' : undefined} />
        </div>
      )}

      {/* Speaking animation overlay */}
      {isSpeaking && (
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute inset-0 rounded-2xl ring-2 ring-emerald-400/50 animate-pulse" />
        </div>
      )}

      {/* Top indicators */}
      <div className="absolute top-3 left-3 right-3 flex items-start justify-between">
        {/* Pinned indicator */}
        {isPinned && (
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            className="p-1.5 bg-emerald-500/90 rounded-lg"
          >
            <Pin size={14} className="text-white" />
          </motion.div>
        )}

        {/* Hand raised */}
        {isHandRaised && (
          <motion.div
            initial={{ scale: 0, y: -10 }}
            animate={{ scale: 1, y: 0 }}
            className="p-2 bg-amber-500/90 rounded-lg"
          >
            <Hand size={16} className="text-white" />
          </motion.div>
        )}
      </div>

      {/* Bottom info bar */}
      <div className="absolute bottom-0 left-0 right-0 p-3">
        <div className="flex items-center justify-between">
          {/* Name and mic status */}
          <div className="flex items-center gap-2 bg-black/60 backdrop-blur-sm rounded-lg px-3 py-1.5">
            {isMuted ? (
              <MicOff size={14} className="text-red-400" />
            ) : (
              <Mic size={14} className={isSpeaking ? 'text-emerald-400' : 'text-gray-400'} />
            )}
            <span className="text-white text-sm font-medium truncate max-w-[150px]">
              {name}{isLocal && ' (You)'}
            </span>
          </div>

          {/* Hover actions */}
          {isHovered && !isLocal && (
            <motion.div
              initial={{ opacity: 0, x: 10 }}
              animate={{ opacity: 1, x: 0 }}
              className="flex items-center gap-1"
            >
              {onPin && (
                <button
                  onClick={onPin}
                  className={`p-2 rounded-lg backdrop-blur-sm transition-colors ${
                    isPinned ? 'bg-emerald-500/80 text-white' : 'bg-black/60 text-gray-300 hover:text-white'
                  }`}
                >
                  <Pin size={16} />
                </button>
              )}
              {onMute && (
                <button
                  onClick={onMute}
                  className="p-2 rounded-lg bg-black/60 backdrop-blur-sm text-gray-300 hover:text-white transition-colors"
                >
                  {isMuted ? <MicOff size={16} /> : <Mic size={16} />}
                </button>
              )}
              <div className="relative">
                <button
                  onClick={() => setShowMenu(!showMenu)}
                  className="p-2 rounded-lg bg-black/60 backdrop-blur-sm text-gray-300 hover:text-white transition-colors"
                >
                  <MoreVertical size={16} />
                </button>
                {showMenu && (
                  <>
                    <div className="fixed inset-0 z-10" onClick={() => setShowMenu(false)} />
                    <motion.div
                      initial={{ opacity: 0, scale: 0.95 }}
                      animate={{ opacity: 1, scale: 1 }}
                      className="absolute bottom-full right-0 mb-2 bg-gray-800 border border-gray-700 rounded-xl shadow-xl py-1 min-w-[140px] z-20"
                    >
                      <button
                        onClick={() => {
                          onPin?.();
                          setShowMenu(false);
                        }}
                        className="w-full flex items-center gap-2 px-4 py-2 text-sm text-gray-300 hover:bg-gray-700/50"
                      >
                        <Pin size={16} />
                        {isPinned ? 'Unpin' : 'Pin'}
                      </button>
                      {onRemove && (
                        <button
                          onClick={() => {
                            onRemove();
                            setShowMenu(false);
                          }}
                          className="w-full flex items-center gap-2 px-4 py-2 text-sm text-red-400 hover:bg-red-500/10"
                        >
                          Remove
                        </button>
                      )}
                    </motion.div>
                  </>
                )}
              </div>
            </motion.div>
          )}
        </div>
      </div>
    </motion.div>
  );
}
