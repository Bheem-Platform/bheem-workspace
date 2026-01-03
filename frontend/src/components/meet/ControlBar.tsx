import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Mic,
  MicOff,
  Video,
  VideoOff,
  MonitorUp,
  PhoneOff,
  MessageSquare,
  Users,
  MoreVertical,
  Hand,
  Grid,
  Maximize,
  Copy,
  Info,
  Settings,
  Circle,
  Layout,
  Check,
} from 'lucide-react';
import ControlButton from './ControlButton';
import { MeetTooltip } from './ui';

interface ControlBarProps {
  isMicEnabled: boolean;
  isCameraEnabled: boolean;
  isScreenSharing: boolean;
  isRecording: boolean;
  isHandRaised: boolean;
  isChatOpen: boolean;
  isParticipantsOpen: boolean;
  participantCount: number;
  unreadMessages: number;
  viewMode: 'grid' | 'speaker' | 'spotlight';
  roomCode?: string;
  onToggleMic: () => void;
  onToggleCamera: () => void;
  onToggleScreenShare: () => void;
  onToggleRecording: () => void;
  onToggleHand: () => void;
  onToggleChat: () => void;
  onToggleParticipants: () => void;
  onChangeViewMode: (mode: 'grid' | 'speaker' | 'spotlight') => void;
  onToggleFullscreen: () => void;
  onOpenSettings: () => void;
  onLeave: () => void;
  onEndForAll?: () => void;
}

export default function ControlBar({
  isMicEnabled,
  isCameraEnabled,
  isScreenSharing,
  isRecording,
  isHandRaised,
  isChatOpen,
  isParticipantsOpen,
  participantCount,
  unreadMessages,
  viewMode,
  roomCode,
  onToggleMic,
  onToggleCamera,
  onToggleScreenShare,
  onToggleRecording,
  onToggleHand,
  onToggleChat,
  onToggleParticipants,
  onChangeViewMode,
  onToggleFullscreen,
  onOpenSettings,
  onLeave,
  onEndForAll,
}: ControlBarProps) {
  const [showMoreMenu, setShowMoreMenu] = useState(false);
  const [showLayoutMenu, setShowLayoutMenu] = useState(false);
  const [copied, setCopied] = useState(false);

  const handleCopyCode = async () => {
    if (roomCode) {
      await navigator.clipboard.writeText(`${window.location.origin}/meet/room/${roomCode}`);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <motion.div
      initial={{ y: 100, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      className="absolute bottom-0 left-0 right-0 z-20 meet-safe-area-bottom"
    >
      <div className="px-2 sm:px-4 pb-2 sm:pb-4">
        <div className="max-w-4xl mx-auto">
          <div className="bg-gray-800/90 backdrop-blur-xl border border-gray-700/50 rounded-xl sm:rounded-2xl shadow-2xl px-2 sm:px-4 py-2 sm:py-3">
            <div className="flex items-center justify-between gap-1 sm:gap-2">
              {/* Left: Media controls */}
              <div className="flex items-center gap-1 sm:gap-2">
                <ControlButton
                  icon={isMicEnabled ? <Mic size={18} className="sm:w-5 sm:h-5" /> : <MicOff size={18} className="sm:w-5 sm:h-5" />}
                  label={isMicEnabled ? 'Mute' : 'Unmute'}
                  shortcut="M"
                  isActive={!isMicEnabled}
                  variant={isMicEnabled ? 'default' : 'danger'}
                  onClick={onToggleMic}
                />
                <ControlButton
                  icon={isCameraEnabled ? <Video size={18} className="sm:w-5 sm:h-5" /> : <VideoOff size={18} className="sm:w-5 sm:h-5" />}
                  label={isCameraEnabled ? 'Turn off camera' : 'Turn on camera'}
                  shortcut="V"
                  isActive={!isCameraEnabled}
                  variant={isCameraEnabled ? 'default' : 'danger'}
                  onClick={onToggleCamera}
                />
                {/* Screen share - hide on mobile */}
                <div className="hidden sm:block">
                  <ControlButton
                    icon={<MonitorUp size={20} />}
                    label={isScreenSharing ? 'Stop sharing' : 'Share screen'}
                    shortcut="S"
                    isActive={isScreenSharing}
                    variant={isScreenSharing ? 'primary' : 'default'}
                    onClick={onToggleScreenShare}
                  />
                </div>
              </div>

              {/* Center: Leave button */}
              <ControlButton
                icon={<PhoneOff size={18} className="sm:w-5 sm:h-5" />}
                label="Leave"
                showLabel
                variant="danger"
                size="lg"
                onClick={onLeave}
              />

              {/* Right: Panels and more */}
              <div className="flex items-center gap-1 sm:gap-2">
                {/* Hand raise - hide on mobile, show in more menu */}
                <div className="hidden sm:block">
                  <ControlButton
                    icon={<Hand size={20} />}
                    label={isHandRaised ? 'Lower hand' : 'Raise hand'}
                    isActive={isHandRaised}
                    onClick={onToggleHand}
                  />
                </div>

                {/* Chat */}
                <div className="relative">
                  <ControlButton
                    icon={<MessageSquare size={18} className="sm:w-5 sm:h-5" />}
                    label="Chat"
                    shortcut="C"
                    isActive={isChatOpen}
                    onClick={onToggleChat}
                  />
                  {unreadMessages > 0 && !isChatOpen && (
                    <motion.span
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      className="absolute -top-1 -right-1 w-4 h-4 sm:w-5 sm:h-5 bg-red-500 text-white text-[10px] sm:text-xs font-bold rounded-full flex items-center justify-center"
                    >
                      {unreadMessages > 9 ? '9+' : unreadMessages}
                    </motion.span>
                  )}
                </div>

                {/* Participants */}
                <div className="relative">
                  <ControlButton
                    icon={<Users size={18} className="sm:w-5 sm:h-5" />}
                    label="Participants"
                    shortcut="P"
                    isActive={isParticipantsOpen}
                    onClick={onToggleParticipants}
                  />
                  <span className="absolute -top-1 -right-1 px-1 sm:px-1.5 py-0.5 bg-gray-600 text-white text-[10px] sm:text-xs font-medium rounded-full min-w-[16px] sm:min-w-[20px] text-center">
                    {participantCount}
                  </span>
                </div>

                {/* Layout - hide on mobile */}
                <div className="relative hidden sm:block">
                  <ControlButton
                    icon={<Layout size={20} />}
                    label="Layout"
                    onClick={() => setShowLayoutMenu(!showLayoutMenu)}
                  />

                  <AnimatePresence>
                    {showLayoutMenu && (
                      <>
                        <div className="fixed inset-0 z-10" onClick={() => setShowLayoutMenu(false)} />
                        <motion.div
                          initial={{ opacity: 0, y: 10, scale: 0.95 }}
                          animate={{ opacity: 1, y: 0, scale: 1 }}
                          exit={{ opacity: 0, y: 10, scale: 0.95 }}
                          className="absolute bottom-full right-0 mb-3 bg-gray-800 border border-gray-700 rounded-xl shadow-2xl py-2 min-w-[160px] z-20"
                        >
                          {[
                            { key: 'grid', label: 'Grid', icon: Grid },
                            { key: 'speaker', label: 'Speaker', icon: Users },
                            { key: 'spotlight', label: 'Spotlight', icon: Maximize },
                          ].map(({ key, label, icon: Icon }) => (
                            <button
                              key={key}
                              onClick={() => {
                                onChangeViewMode(key as 'grid' | 'speaker' | 'spotlight');
                                setShowLayoutMenu(false);
                              }}
                              className={`w-full flex items-center justify-between gap-3 px-4 py-2.5 text-sm ${
                                viewMode === key ? 'text-emerald-400' : 'text-white'
                              } hover:bg-gray-700/50`}
                            >
                              <div className="flex items-center gap-3">
                                <Icon size={18} />
                                {label}
                              </div>
                              {viewMode === key && <Check size={16} />}
                            </button>
                          ))}
                        </motion.div>
                      </>
                    )}
                  </AnimatePresence>
                </div>

                {/* More options */}
                <div className="relative">
                  <ControlButton
                    icon={<MoreVertical size={18} className="sm:w-5 sm:h-5" />}
                    label="More"
                    onClick={() => setShowMoreMenu(!showMoreMenu)}
                  />

                  <AnimatePresence>
                    {showMoreMenu && (
                      <>
                        <div className="fixed inset-0 z-10" onClick={() => setShowMoreMenu(false)} />
                        <motion.div
                          initial={{ opacity: 0, y: 10, scale: 0.95 }}
                          animate={{ opacity: 1, y: 0, scale: 1 }}
                          exit={{ opacity: 0, y: 10, scale: 0.95 }}
                          className="absolute bottom-full right-0 mb-3 bg-gray-800 border border-gray-700 rounded-xl shadow-2xl py-2 min-w-[200px] z-20 max-h-[60vh] overflow-y-auto"
                        >
                          {/* Mobile-only options */}
                          <div className="sm:hidden">
                            <button
                              onClick={() => {
                                onToggleScreenShare();
                                setShowMoreMenu(false);
                              }}
                              className={`w-full flex items-center gap-3 px-4 py-2.5 text-sm ${
                                isScreenSharing ? 'text-emerald-400' : 'text-white'
                              } hover:bg-gray-700/50`}
                            >
                              <MonitorUp size={18} />
                              {isScreenSharing ? 'Stop sharing' : 'Share screen'}
                            </button>
                            <button
                              onClick={() => {
                                onToggleHand();
                                setShowMoreMenu(false);
                              }}
                              className={`w-full flex items-center gap-3 px-4 py-2.5 text-sm ${
                                isHandRaised ? 'text-amber-400' : 'text-white'
                              } hover:bg-gray-700/50`}
                            >
                              <Hand size={18} />
                              {isHandRaised ? 'Lower hand' : 'Raise hand'}
                            </button>
                            <div className="border-t border-gray-700 my-1" />
                          </div>

                          <button
                            onClick={() => {
                              handleCopyCode();
                              setShowMoreMenu(false);
                            }}
                            className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-white hover:bg-gray-700/50"
                          >
                            {copied ? <Check size={18} className="text-emerald-400" /> : <Copy size={18} />}
                            {copied ? 'Copied!' : 'Copy meeting link'}
                          </button>
                          <button
                            onClick={() => {
                              onToggleRecording();
                              setShowMoreMenu(false);
                            }}
                            className={`w-full flex items-center gap-3 px-4 py-2.5 text-sm ${
                              isRecording ? 'text-red-400' : 'text-white'
                            } hover:bg-gray-700/50`}
                          >
                            <Circle size={18} className={`${isRecording ? 'fill-red-500 text-red-500 meet-animate-recording' : ''}`} />
                            {isRecording ? 'Stop recording' : 'Start recording'}
                          </button>
                          <button
                            onClick={() => {
                              onToggleFullscreen();
                              setShowMoreMenu(false);
                            }}
                            className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-white hover:bg-gray-700/50"
                          >
                            <Maximize size={18} />
                            Full screen
                          </button>
                          <div className="border-t border-gray-700 my-1" />
                          <button
                            onClick={() => {
                              onOpenSettings();
                              setShowMoreMenu(false);
                            }}
                            className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-white hover:bg-gray-700/50"
                          >
                            <Settings size={18} />
                            Settings
                          </button>
                          <button
                            className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-white hover:bg-gray-700/50"
                          >
                            <Info size={18} />
                            Meeting details
                          </button>
                        </motion.div>
                      </>
                    )}
                  </AnimatePresence>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  );
}
