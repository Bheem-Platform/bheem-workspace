import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import dynamic from 'next/dynamic';
import { motion, AnimatePresence } from 'framer-motion';
import PreJoinScreen from '@/components/meet/PreJoinScreen';
import ChatPanel from '@/components/meet/ChatPanel';
import ParticipantsPanel from '@/components/meet/ParticipantsPanel';
import VideoGrid from '@/components/meet/VideoGrid';
import ControlBar from '@/components/meet/ControlBar';
import EndMeetingModal from '@/components/meet/EndMeetingModal';
import ScreenSharePicker from '@/components/meet/ScreenSharePicker';
import SettingsModal from '@/components/meet/SettingsModal';
import { useMeetStore } from '@/stores/meetStore';
import { useAuthStore } from '@/stores/authStore';
import type { ChatMessage } from '@/types/meet';

// Dynamically import LiveKit components to avoid SSR issues
const LiveKitComponents = dynamic(
  () => import('@/components/meet/LiveKitWrapper'),
  {
    ssr: false,
    loading: () => (
      <div className="w-full h-full flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-500 mx-auto mb-2" />
          <p className="text-gray-400 text-sm">Loading video...</p>
        </div>
      </div>
    )
  }
);

export default function MeetingRoom() {
  const router = useRouter();
  const { roomName } = router.query;

  const { user } = useAuthStore();
  const {
    roomToken,
    wsUrl,
    roomCode,
    roomName: meetingName,
    isChatPanelOpen,
    isParticipantsPanelOpen,
    isMicEnabled,
    isCameraEnabled,
    isScreenSharing,
    recordingSession,
    joinRoom,
    leaveRoom,
    getRoomInfo,
    toggleChatPanel,
    toggleParticipantsPanel,
    toggleMic,
    toggleCamera,
    addChatMessage,
    error,
    loading,
    chatMessages,
  } = useMeetStore();

  const [isPreJoin, setIsPreJoin] = useState(true);
  const [participantName, setParticipantName] = useState('');
  const [hasCamera, setHasCamera] = useState(false);
  const [hasMic, setHasMic] = useState(false);
  const [devicesChecked, setDevicesChecked] = useState(false);
  const [liveKitFailed, setLiveKitFailed] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [viewMode, setViewMode] = useState<'grid' | 'speaker' | 'spotlight'>('grid');
  const [isHandRaised, setIsHandRaised] = useState(false);
  const [unreadMessages, setUnreadMessages] = useState(0);
  const [showEndMeetingModal, setShowEndMeetingModal] = useState(false);
  const [showScreenSharePicker, setShowScreenSharePicker] = useState(false);
  const [showSettingsModal, setShowSettingsModal] = useState(false);

  // Mock participants for demo (in real app, this comes from LiveKit)
  const [participants, setParticipants] = useState([
    { id: 'local', name: participantName || 'You', isLocal: true, isMuted: !isMicEnabled, isVideoOff: !isCameraEnabled }
  ]);

  // Check available devices
  useEffect(() => {
    const checkDevices = async () => {
      try {
        if (navigator.mediaDevices && navigator.mediaDevices.enumerateDevices) {
          const devices = await navigator.mediaDevices.enumerateDevices();
          const videoDevices = devices.filter(d => d.kind === 'videoinput');
          const audioDevices = devices.filter(d => d.kind === 'audioinput');

          setHasCamera(videoDevices.length > 0);
          setHasMic(audioDevices.length > 0);
        } else {
          setHasCamera(false);
          setHasMic(false);
        }
      } catch (err) {
        console.error('Failed to enumerate devices:', err);
        setHasCamera(false);
        setHasMic(false);
      } finally {
        setDevicesChecked(true);
      }
    };
    checkDevices();
  }, []);

  // Get room info on mount
  useEffect(() => {
    if (roomName && typeof roomName === 'string') {
      getRoomInfo(roomName);
    }
  }, [roomName]);

  // Set default name from user
  useEffect(() => {
    if (user?.username) {
      setParticipantName(user.username);
    }
  }, [user]);

  // Update local participant
  useEffect(() => {
    setParticipants(prev => prev.map(p =>
      p.isLocal ? { ...p, name: participantName || 'You', isMuted: !isMicEnabled, isVideoOff: !isCameraEnabled } : p
    ));
  }, [participantName, isMicEnabled, isCameraEnabled]);

  // Track unread messages
  useEffect(() => {
    if (!isChatPanelOpen && chatMessages.length > 0) {
      setUnreadMessages(prev => prev + 1);
    }
  }, [chatMessages.length, isChatPanelOpen]);

  // Reset unread when chat opens
  useEffect(() => {
    if (isChatPanelOpen) {
      setUnreadMessages(0);
    }
  }, [isChatPanelOpen]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return;
      }

      switch (e.key.toLowerCase()) {
        case 'm':
          e.preventDefault();
          toggleMic();
          break;
        case 'v':
          e.preventDefault();
          toggleCamera();
          break;
        case 'c':
          e.preventDefault();
          toggleChatPanel();
          break;
        case 'p':
          e.preventDefault();
          toggleParticipantsPanel();
          break;
        case 'f':
          if (!e.ctrlKey && !e.metaKey) {
            e.preventDefault();
            handleToggleFullscreen();
          }
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [toggleMic, toggleCamera, toggleChatPanel, toggleParticipantsPanel]);

  const handleJoin = async (name: string) => {
    if (!roomName || typeof roomName !== 'string') return;

    setParticipantName(name);
    const success = await joinRoom(roomName, name);

    if (success) {
      setIsPreJoin(false);
    }
  };

  const handleLeave = () => {
    leaveRoom();
    router.push('/meet');
  };

  const handleEndForAll = () => {
    // In a real app, this would end the meeting for all participants
    leaveRoom();
    router.push('/meet');
  };

  const handleSendMessage = (content: string) => {
    const message: ChatMessage = {
      id: Date.now().toString(),
      senderId: 'local',
      senderName: participantName,
      content,
      timestamp: new Date().toISOString(),
      type: 'text',
      isLocal: true,
    };
    addChatMessage(message);
  };

  const handleToggleFullscreen = useCallback(() => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen();
      setIsFullscreen(true);
    } else {
      document.exitFullscreen();
      setIsFullscreen(false);
    }
  }, []);

  const handleToggleScreenShare = useCallback(() => {
    if (isScreenSharing) {
      // Stop sharing
      console.log('Stop screen share');
    } else {
      // Open screen share picker
      setShowScreenSharePicker(true);
    }
  }, [isScreenSharing]);

  const handleScreenShare = useCallback((sourceId: string, withAudio: boolean) => {
    // In a real app, this would start screen sharing via LiveKit
    console.log('Start screen share:', sourceId, 'with audio:', withAudio);
  }, []);

  const handleToggleRecording = useCallback(() => {
    // In a real app, this would toggle recording
    console.log('Toggle recording');
  }, []);

  const handleToggleHand = useCallback(() => {
    setIsHandRaised(prev => !prev);
  }, []);

  const handleOpenSettings = useCallback(() => {
    setShowSettingsModal(true);
  }, []);

  const handleSaveSettings = useCallback((settings: any) => {
    console.log('Save settings:', settings);
    // In a real app, this would apply the settings
  }, []);

  const handleLeaveClick = useCallback(() => {
    if (participants.length > 1) {
      setShowEndMeetingModal(true);
    } else {
      handleLeave();
    }
  }, [participants.length]);

  const handleLiveKitError = () => {
    console.log('LiveKit failed, falling back to simple UI');
    setLiveKitFailed(true);
  };

  // Show pre-join screen
  if (isPreJoin) {
    return (
      <>
        <Head>
          <title>Join Meeting | Bheem Meet</title>
        </Head>
        <PreJoinScreen
          roomCode={roomName as string}
          roomName={meetingName || undefined}
          onJoin={handleJoin}
          userName={participantName || user?.username}
        />
      </>
    );
  }

  // Show error
  if (error) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="text-center max-w-md mx-auto p-8 bg-gray-800 rounded-3xl border border-gray-700"
        >
          <div className="w-16 h-16 bg-red-500/20 rounded-full flex items-center justify-center mx-auto mb-6">
            <span className="text-3xl text-red-400">!</span>
          </div>
          <h2 className="text-xl font-semibold text-white mb-3">
            Unable to join meeting
          </h2>
          <p className="text-gray-400 mb-8">{error}</p>
          <button
            onClick={() => router.push('/meet')}
            className="px-8 py-3 bg-emerald-500 text-white font-medium rounded-xl hover:bg-emerald-600 transition-colors"
          >
            Back to Meetings
          </button>
        </motion.div>
      </div>
    );
  }

  // Show loading
  if (loading.joining) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="text-center"
        >
          <div className="w-16 h-16 border-4 border-emerald-500/30 border-t-emerald-500 rounded-full animate-spin mx-auto mb-6" />
          <p className="text-white text-lg">Joining meeting...</p>
        </motion.div>
      </div>
    );
  }

  // LiveKit enabled for real-time video conferencing
  const LIVEKIT_ENABLED = true;
  const hasDevices = hasCamera || hasMic;
  const useLiveKit = LIVEKIT_ENABLED && hasDevices && roomToken && wsUrl && !liveKitFailed;

  // Main meeting room UI
  return (
    <>
      <Head>
        <title>{meetingName || roomName} | Bheem Meet</title>
      </Head>

      <div className="h-screen bg-gray-900 flex flex-col overflow-hidden">
        {/* Header */}
        <motion.header
          initial={{ y: -20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          className="flex-shrink-0 h-12 sm:h-14 bg-gray-900/80 backdrop-blur-lg border-b border-gray-800 flex items-center justify-between px-3 sm:px-4 z-10 meet-safe-area-top"
        >
          <div className="flex items-center gap-2 sm:gap-3 min-w-0">
            <h1 className="text-white font-medium text-sm sm:text-base truncate">{meetingName || 'Meeting'}</h1>
            <span className="text-gray-500 text-xs sm:text-sm font-mono hidden sm:inline">{roomCode || roomName}</span>
          </div>
          <div className="flex items-center gap-2 text-xs sm:text-sm text-gray-400 flex-shrink-0">
            <span className="flex items-center gap-1.5">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
              </span>
              <span className="hidden sm:inline">{participants.length} participant{participants.length !== 1 ? 's' : ''}</span>
              <span className="sm:hidden">{participants.length}</span>
            </span>
          </div>
        </motion.header>

        {/* Main content area */}
        <div className="flex-1 flex overflow-hidden relative">
          {/* Video grid / Meeting area */}
          <div className="flex-1 relative">
            {/* Device check */}
            {!devicesChecked ? (
              <div className="w-full h-full flex items-center justify-center">
                <div className="text-center">
                  <div className="w-10 h-10 border-2 border-emerald-500/30 border-t-emerald-500 rounded-full animate-spin mx-auto mb-4" />
                  <p className="text-gray-400 text-sm">Checking devices...</p>
                </div>
              </div>
            ) : useLiveKit ? (
              <LiveKitComponents
                token={roomToken}
                serverUrl={wsUrl}
                hasCamera={hasCamera}
                hasMic={hasMic}
                onLeave={handleLeave}
                onError={handleLiveKitError}
              />
            ) : (
              <VideoGrid
                participants={participants}
                viewMode={viewMode}
                activeSpeakerId={null}
                pinnedParticipantId={null}
              />
            )}

            {/* LiveKit failed banner */}
            <AnimatePresence>
              {liveKitFailed && hasDevices && (
                <motion.div
                  initial={{ opacity: 0, y: -20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -20 }}
                  className="absolute top-4 left-4 right-4 z-10 bg-amber-500/90 text-amber-900 px-4 py-2 rounded-xl text-sm flex items-center gap-2"
                >
                  <span>Video conferencing unavailable. Using basic meeting mode.</span>
                  <button
                    onClick={() => setLiveKitFailed(false)}
                    className="ml-auto hover:text-amber-700"
                  >
                    &times;
                  </button>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Side panels - responsive: full screen on mobile, side panel on desktop */}
          <AnimatePresence>
            {isChatPanelOpen && (
              <>
                {/* Mobile backdrop */}
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="fixed inset-0 bg-black/50 z-20 sm:hidden"
                  onClick={toggleChatPanel}
                />
                <motion.div
                  initial={{ x: '100%', opacity: 0 }}
                  animate={{ x: 0, opacity: 1 }}
                  exit={{ x: '100%', opacity: 0 }}
                  transition={{ type: 'spring', damping: 25, stiffness: 300 }}
                  className="fixed inset-0 z-30 sm:relative sm:inset-auto sm:w-80 sm:h-full sm:border-l sm:border-gray-800"
                >
                  <ChatPanel
                    onClose={toggleChatPanel}
                    onSendMessage={handleSendMessage}
                  />
                </motion.div>
              </>
            )}
          </AnimatePresence>

          <AnimatePresence>
            {isParticipantsPanelOpen && (
              <>
                {/* Mobile backdrop */}
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="fixed inset-0 bg-black/50 z-20 sm:hidden"
                  onClick={toggleParticipantsPanel}
                />
                <motion.div
                  initial={{ x: '100%', opacity: 0 }}
                  animate={{ x: 0, opacity: 1 }}
                  exit={{ x: '100%', opacity: 0 }}
                  transition={{ type: 'spring', damping: 25, stiffness: 300 }}
                  className="fixed inset-0 z-30 sm:relative sm:inset-auto sm:w-80 sm:h-full sm:border-l sm:border-gray-800"
                >
                  <ParticipantsPanel
                    onClose={toggleParticipantsPanel}
                    roomCode={roomCode || undefined}
                  />
                </motion.div>
              </>
            )}
          </AnimatePresence>
        </div>

        {/* Control bar */}
        <ControlBar
          isMicEnabled={isMicEnabled}
          isCameraEnabled={isCameraEnabled}
          isScreenSharing={isScreenSharing}
          isRecording={recordingSession?.isRecording || false}
          isHandRaised={isHandRaised}
          isChatOpen={isChatPanelOpen}
          isParticipantsOpen={isParticipantsPanelOpen}
          participantCount={participants.length}
          unreadMessages={unreadMessages}
          viewMode={viewMode}
          roomCode={roomCode || roomName as string}
          onToggleMic={toggleMic}
          onToggleCamera={toggleCamera}
          onToggleScreenShare={handleToggleScreenShare}
          onToggleRecording={handleToggleRecording}
          onToggleHand={handleToggleHand}
          onToggleChat={toggleChatPanel}
          onToggleParticipants={toggleParticipantsPanel}
          onChangeViewMode={setViewMode}
          onToggleFullscreen={handleToggleFullscreen}
          onOpenSettings={handleOpenSettings}
          onLeave={handleLeaveClick}
          onEndForAll={handleEndForAll}
        />

        {/* Modals */}
        <EndMeetingModal
          isOpen={showEndMeetingModal}
          onClose={() => setShowEndMeetingModal(false)}
          onLeave={handleLeave}
          onEndForAll={handleEndForAll}
          isHost={true}
          participantCount={participants.length}
        />

        <ScreenSharePicker
          isOpen={showScreenSharePicker}
          onClose={() => setShowScreenSharePicker(false)}
          onShare={handleScreenShare}
        />

        <SettingsModal
          isOpen={showSettingsModal}
          onClose={() => setShowSettingsModal(false)}
          onSave={handleSaveSettings}
        />
      </div>
    </>
  );
}
