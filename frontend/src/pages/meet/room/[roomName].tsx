import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import dynamic from 'next/dynamic';
import { motion, AnimatePresence } from 'framer-motion';
import { GetServerSideProps } from 'next';
import PreJoinScreen from '@/components/meet/PreJoinScreen';
import ChatPanel from '@/components/meet/ChatPanel';
import ParticipantsPanel from '@/components/meet/ParticipantsPanel';
import VideoGrid from '@/components/meet/VideoGrid';
import ControlBar from '@/components/meet/ControlBar';
import EndMeetingModal from '@/components/meet/EndMeetingModal';
import ScreenSharePicker from '@/components/meet/ScreenSharePicker';
import SettingsModal from '@/components/meet/SettingsModal';
import RecordingIndicator from '@/components/meet/RecordingIndicator';
import { useMeetStore } from '@/stores/meetStore';
import { useAuthStore } from '@/stores/authStore';
import type { ChatMessage } from '@/types/meet';

// Server-side props for Open Graph meta tags
interface MeetingRoomProps {
  roomCode: string;
  meetingTitle: string;
  meetingDescription: string;
  ogImageUrl: string;
  baseUrl: string;
}

// Dynamically import LiveKit components to avoid SSR issues
const LiveKitComponents = dynamic(
  () => import('@/components/meet/LiveKitWrapper'),
  {
    ssr: false,
    loading: () => (
      <div className="w-full h-full flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#977DFF] mx-auto mb-2" />
          <p className="text-gray-500 text-sm">Loading video...</p>
        </div>
      </div>
    )
  }
);

export default function MeetingRoom({
  roomCode: serverRoomCode,
  meetingTitle: serverMeetingTitle,
  meetingDescription,
  ogImageUrl,
  baseUrl
}: MeetingRoomProps) {
  const router = useRouter();
  const { roomName } = router.query;

  // Use server-provided values for SEO, fall back to client values
  const pageRoomCode = serverRoomCode || (roomName as string);
  const pageTitle = serverMeetingTitle || 'Bheem Meet';
  const pageDescription = meetingDescription || 'Join video meeting on Bheem Meet - Secure video conferencing for teams';
  const pageUrl = `${baseUrl}/meet/room/${pageRoomCode}`;
  const pageImage = ogImageUrl || `${baseUrl}/images/meet-og-preview.png`;

  const { user, isLoading: isAuthLoading } = useAuthStore();
  const {
    roomToken,
    wsUrl,
    roomCode,
    roomName: meetingName,
    participants: storeParticipants,
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
    toggleScreenShare,
    startRecording,
    stopRecording,
    addChatMessage,
    updateParticipants,
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
  const [messageToSend, setMessageToSend] = useState<{ id: string; content: string } | null>(null);
  const [recordingNotification, setRecordingNotification] = useState<string | null>(null);
  const [isAutoRejoining, setIsAutoRejoining] = useState(false);

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

  // Auto-rejoin on page refresh - check sessionStorage for active meeting session
  useEffect(() => {
    // Wait for auth loading to complete before checking session
    if (isAuthLoading) return;
    if (!roomName || typeof roomName !== 'string') return;

    const sessionKey = `meet_session_${roomName}`;
    const savedSession = sessionStorage.getItem(sessionKey);

    if (savedSession) {
      try {
        const session = JSON.parse(savedSession);
        // Check if session is still valid (not older than 6 hours)
        const sessionAge = Date.now() - session.joinedAt;
        const maxAge = 6 * 60 * 60 * 1000; // 6 hours (matches token TTL)

        if (sessionAge < maxAge) {
          console.log('Auto-rejoining meeting after page refresh');
          setIsAutoRejoining(true);

          // For authenticated users, always use their username
          // Backend uses user.username from token, not the provided name
          const rejoinName = user?.username || session.participantName;
          setParticipantName(rejoinName);

          // Auto-rejoin the meeting
          joinRoom(roomName, rejoinName).then((success) => {
            if (success) {
              setIsPreJoin(false);
              // Update session with new timestamp
              sessionStorage.setItem(sessionKey, JSON.stringify({
                ...session,
                participantName: rejoinName,
                joinedAt: Date.now(),
              }));
            } else {
              // If rejoin fails, clear session and show pre-join
              sessionStorage.removeItem(sessionKey);
            }
            setIsAutoRejoining(false);
          });
        } else {
          // Session expired, clear it
          sessionStorage.removeItem(sessionKey);
        }
      } catch (e) {
        console.error('Failed to parse meeting session:', e);
        sessionStorage.removeItem(sessionKey);
      }
    }
  }, [roomName, user?.username, isAuthLoading]);

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

    // For authenticated users, always use their username from the store
    // Backend ignores the name parameter for authenticated users anyway
    const joinName = user?.username || name;
    setParticipantName(joinName);
    const success = await joinRoom(roomName, joinName);

    if (success) {
      setIsPreJoin(false);
      // Save session to sessionStorage for auto-rejoin on page refresh
      const sessionKey = `meet_session_${roomName}`;
      sessionStorage.setItem(sessionKey, JSON.stringify({
        participantName: joinName,
        joinedAt: Date.now(),
        roomName: roomName,
      }));
    }
  };

  const handleLeave = () => {
    // Clear meeting session from sessionStorage
    if (roomName && typeof roomName === 'string') {
      sessionStorage.removeItem(`meet_session_${roomName}`);
    }
    leaveRoom();
    router.push('/meet');
  };

  const handleEndForAll = () => {
    // Clear meeting session from sessionStorage
    if (roomName && typeof roomName === 'string') {
      sessionStorage.removeItem(`meet_session_${roomName}`);
    }
    // In a real app, this would end the meeting for all participants
    leaveRoom();
    router.push('/meet');
  };

  const handleSendMessage = (content: string) => {
    const messageId = Date.now().toString();
    const message: ChatMessage = {
      id: messageId,
      senderId: 'local',
      senderName: participantName,
      content,
      timestamp: new Date().toISOString(),
      type: 'text',
      isLocal: true,
    };
    addChatMessage(message);
    // Send via LiveKit data channel
    setMessageToSend({ id: messageId, content });
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
    // Toggle screen share via the store - LiveKitWrapper will handle the actual sharing
    toggleScreenShare();
  }, [toggleScreenShare]);

  const handleScreenShare = useCallback((sourceId: string, withAudio: boolean) => {
    // In a real app, this would start screen sharing via LiveKit
    console.log('Start screen share:', sourceId, 'with audio:', withAudio);
  }, []);

  const handleToggleRecording = useCallback(async () => {
    console.log('Toggle recording', recordingSession.isRecording);

    if (recordingSession.isRecording) {
      // Stop recording
      const success = await stopRecording();
      if (success) {
        setRecordingNotification('Recording stopped');
        setTimeout(() => setRecordingNotification(null), 3000);
      } else {
        setRecordingNotification('Failed to stop recording');
        setTimeout(() => setRecordingNotification(null), 3000);
      }
    } else {
      // Start recording
      try {
        const success = await startRecording({ layout: 'grid', resolution: '1080p' });
        if (success) {
          setRecordingNotification('Recording started - All participants will be notified');
          setTimeout(() => setRecordingNotification(null), 5000);
        } else {
          setRecordingNotification('Recording not available - Contact admin');
          setTimeout(() => setRecordingNotification(null), 5000);
        }
      } catch (err: any) {
        const message = err?.message || 'Failed to start recording';
        setRecordingNotification(message);
        setTimeout(() => setRecordingNotification(null), 5000);
      }
    }
  }, [recordingSession.isRecording, startRecording, stopRecording]);

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

  const handleLiveKitError = useCallback(() => {
    console.log('LiveKit failed, falling back to simple UI');
    setLiveKitFailed(true);
  }, []);

  // Memoize LiveKit callbacks to prevent unnecessary re-renders/reconnections
  const handleParticipantsChange = useCallback((lkParticipants: any[]) => {
    // Update both local state and store
    const mapped = lkParticipants.map(p => ({
      id: p.id,
      name: p.name,
      isLocal: p.isLocal ?? false,
      isMuted: p.isMuted ?? false,
      isVideoOff: p.isVideoOff ?? false,
      isHandRaised: p.isHandRaised ?? false,
    }));
    setParticipants(mapped);
    updateParticipants(lkParticipants);
  }, [updateParticipants]);

  const handleChatMessage = useCallback((msg: { senderId: string; senderName: string; content: string }) => {
    const message: ChatMessage = {
      id: Date.now().toString(),
      senderId: msg.senderId,
      senderName: msg.senderName,
      content: msg.content,
      timestamp: new Date().toISOString(),
      type: 'text',
      isLocal: false,
    };
    addChatMessage(message);
  }, [addChatMessage]);

  // Show loading while auth is initializing
  if (isAuthLoading) {
    // Debug: check if auth token exists
    const hasToken = typeof window !== 'undefined' && !!localStorage.getItem('auth_token');
    console.log('Auth loading, hasToken:', hasToken);

    return (
      <>
        <Head>
          <title>{pageTitle} | Bheem Meet</title>
          <meta name="description" content={pageDescription} />
          <meta property="og:type" content="website" />
          <meta property="og:url" content={pageUrl} />
          <meta property="og:title" content={`${pageTitle} | Join Meeting`} />
          <meta property="og:description" content={pageDescription} />
          <meta property="og:image" content={pageImage} />
          <meta property="og:image:width" content="1200" />
          <meta property="og:image:height" content="630" />
          <meta property="og:site_name" content="Bheem Meet" />
          <meta name="twitter:card" content="summary_large_image" />
          <meta name="twitter:title" content={`${pageTitle} | Join Meeting`} />
          <meta name="twitter:description" content={pageDescription} />
          <meta name="twitter:image" content={pageImage} />
        </Head>
        <div className="min-h-screen bg-white flex items-center justify-center">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="text-center"
          >
            <div className="w-16 h-16 border-4 border-[#977DFF]/30 border-t-[#977DFF] rounded-full animate-spin mx-auto mb-6" />
            <p className="text-gray-900 text-lg">Loading...</p>
          </motion.div>
        </div>
      </>
    );
  }

  // Show auto-rejoin loading screen
  if (isAutoRejoining) {
    return (
      <>
        <Head>
          <title>{pageTitle} | Bheem Meet</title>
          <meta name="description" content={pageDescription} />
          <meta property="og:type" content="website" />
          <meta property="og:url" content={pageUrl} />
          <meta property="og:title" content={`${pageTitle} | Join Meeting`} />
          <meta property="og:description" content={pageDescription} />
          <meta property="og:image" content={pageImage} />
          <meta property="og:site_name" content="Bheem Meet" />
          <meta name="twitter:card" content="summary_large_image" />
          <meta name="twitter:image" content={pageImage} />
        </Head>
        <div className="min-h-screen bg-white flex items-center justify-center">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="text-center"
          >
            <div className="w-16 h-16 border-4 border-[#977DFF]/30 border-t-[#977DFF] rounded-full animate-spin mx-auto mb-6" />
            <p className="text-gray-900 text-lg">Reconnecting to meeting...</p>
            <p className="text-gray-500 text-sm mt-2">Please wait while we restore your session</p>
          </motion.div>
        </div>
      </>
    );
  }

  // Show pre-join screen
  if (isPreJoin) {
    // Check for auth token in localStorage as a fallback
    let hasAuthToken = false;
    let tokenUsername: string | null = null;

    if (typeof window !== 'undefined') {
      const token = localStorage.getItem('auth_token');
      if (token) {
        hasAuthToken = true;
        // Try to decode token to get username
        try {
          const base64Url = token.split('.')[1];
          const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
          const payload = JSON.parse(atob(base64));
          tokenUsername = payload.username || payload.name || payload.email?.split('@')[0] || null;
        } catch (e) {
          console.error('Failed to decode token:', e);
        }
      }
    }

    // User is authenticated if they have a user object with a username OR a valid auth token
    const isUserAuthenticated = !!(user && user.username) || (hasAuthToken && !!tokenUsername);
    const displayName = user?.username || tokenUsername || participantName || '';

    // Debug logging
    console.log('PreJoin auth state:', {
      isAuthLoading,
      user,
      username: user?.username,
      hasAuthToken,
      tokenUsername,
      isUserAuthenticated,
      displayName,
    });

    return (
      <>
        <Head>
          <title>{pageTitle} | Join Meeting - Bheem Meet</title>
          <meta name="description" content={pageDescription} />

          {/* Open Graph / Facebook */}
          <meta property="og:type" content="website" />
          <meta property="og:url" content={pageUrl} />
          <meta property="og:title" content={`${pageTitle} | Join Meeting`} />
          <meta property="og:description" content={pageDescription} />
          <meta property="og:image" content={pageImage} />
          <meta property="og:image:width" content="1200" />
          <meta property="og:image:height" content="630" />
          <meta property="og:site_name" content="Bheem Meet" />

          {/* Twitter */}
          <meta name="twitter:card" content="summary_large_image" />
          <meta name="twitter:url" content={pageUrl} />
          <meta name="twitter:title" content={`${pageTitle} | Join Meeting`} />
          <meta name="twitter:description" content={pageDescription} />
          <meta name="twitter:image" content={pageImage} />

          {/* Additional meta */}
          <meta name="theme-color" content="#10B981" />
          <link rel="canonical" href={pageUrl} />
        </Head>
        <PreJoinScreen
          roomCode={roomName as string}
          roomName={meetingName || undefined}
          onJoin={handleJoin}
          userName={displayName}
          isAuthenticated={isUserAuthenticated}
        />
      </>
    );
  }

  // Show error
  if (error) {
    return (
      <>
        <Head>
          <title>{pageTitle} | Bheem Meet</title>
          <meta property="og:title" content={`${pageTitle} | Join Meeting`} />
          <meta property="og:description" content={pageDescription} />
          <meta property="og:image" content={pageImage} />
          <meta property="og:site_name" content="Bheem Meet" />
        </Head>
        <div className="min-h-screen bg-white flex items-center justify-center">
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="text-center max-w-md mx-auto p-8 bg-white rounded-3xl border border-gray-200 shadow-lg"
          >
            <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-6">
              <span className="text-3xl text-red-500">!</span>
            </div>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">
              Unable to join meeting
            </h2>
            <p className="text-gray-600 mb-8">{error}</p>
            <button
              onClick={() => router.push('/meet')}
              className="px-8 py-3 bg-gradient-to-r from-[#977DFF] to-[#0033FF] text-white font-medium rounded-xl hover:from-[#8B6FFF] hover:to-[#0029CC] transition-colors"
            >
              Back to Meetings
            </button>
          </motion.div>
        </div>
      </>
    );
  }

  // Show loading
  if (loading.joining) {
    return (
      <>
        <Head>
          <title>{pageTitle} | Bheem Meet</title>
          <meta property="og:title" content={`${pageTitle} | Join Meeting`} />
          <meta property="og:description" content={pageDescription} />
          <meta property="og:image" content={pageImage} />
          <meta property="og:site_name" content="Bheem Meet" />
        </Head>
        <div className="min-h-screen bg-white flex items-center justify-center">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="text-center"
          >
            <div className="w-16 h-16 border-4 border-[#977DFF]/30 border-t-[#977DFF] rounded-full animate-spin mx-auto mb-6" />
            <p className="text-gray-900 text-lg">Joining meeting...</p>
          </motion.div>
        </div>
      </>
    );
  }

  // LiveKit enabled for real-time video conferencing
  // Connect to LiveKit even without camera/mic - users can still see others
  const LIVEKIT_ENABLED = true;
  const hasDevices = hasCamera || hasMic;
  const useLiveKit = LIVEKIT_ENABLED && roomToken && wsUrl && !liveKitFailed;

  // Main meeting room UI
  return (
    <>
      <Head>
        <title>{meetingName || pageTitle} | Bheem Meet</title>
        <meta name="description" content={pageDescription} />

        {/* Open Graph / Facebook */}
        <meta property="og:type" content="website" />
        <meta property="og:url" content={pageUrl} />
        <meta property="og:title" content={`${meetingName || pageTitle} | Bheem Meet`} />
        <meta property="og:description" content={pageDescription} />
        <meta property="og:image" content={pageImage} />
        <meta property="og:image:width" content="1200" />
        <meta property="og:image:height" content="630" />
        <meta property="og:site_name" content="Bheem Meet" />

        {/* Twitter */}
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:url" content={pageUrl} />
        <meta name="twitter:title" content={`${meetingName || pageTitle} | Bheem Meet`} />
        <meta name="twitter:description" content={pageDescription} />
        <meta name="twitter:image" content={pageImage} />

        {/* Additional meta */}
        <meta name="theme-color" content="#10B981" />
        <link rel="canonical" href={pageUrl} />
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
            {/* Recording Indicator */}
            <RecordingIndicator />
          </div>
          <div className="flex items-center gap-2 text-xs sm:text-sm text-gray-400 flex-shrink-0">
            <span className="flex items-center gap-1.5">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#977DFF] opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-[#0033FF]" />
              </span>
              <span className="hidden sm:inline">{participants.length} participant{participants.length !== 1 ? 's' : ''}</span>
              <span className="sm:hidden">{participants.length}</span>
            </span>
          </div>
        </motion.header>

        {/* Recording notification toast */}
        <AnimatePresence>
          {recordingNotification && (
            <motion.div
              initial={{ opacity: 0, y: -50 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -50 }}
              className="absolute top-16 left-1/2 transform -translate-x-1/2 z-50"
            >
              <div className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-full shadow-lg">
                <div className="w-2 h-2 bg-white rounded-full animate-pulse" />
                <span className="text-sm font-medium">{recordingNotification}</span>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Main content area */}
        <div className="flex-1 flex overflow-hidden relative">
          {/* Video grid / Meeting area */}
          <div className="flex-1 relative">
            {/* Device check */}
            {!devicesChecked ? (
              <div className="w-full h-full flex items-center justify-center">
                <div className="text-center">
                  <div className="w-10 h-10 border-2 border-[#977DFF]/30 border-t-[#977DFF] rounded-full animate-spin mx-auto mb-4" />
                  <p className="text-gray-500 text-sm">Checking devices...</p>
                </div>
              </div>
            ) : useLiveKit ? (
              <LiveKitComponents
                key="livekit-room"
                token={roomToken}
                serverUrl={wsUrl}
                hasCamera={hasCamera}
                hasMic={hasMic}
                isHandRaised={isHandRaised}
                isScreenSharing={isScreenSharing}
                isMicEnabled={isMicEnabled}
                isCameraEnabled={isCameraEnabled}
                messageToSend={messageToSend}
                onLeave={handleLeave}
                onError={handleLiveKitError}
                onParticipantsChange={handleParticipantsChange}
                onChatMessage={handleChatMessage}
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

// Server-side props for Open Graph meta tags (link previews)
export const getServerSideProps: GetServerSideProps<MeetingRoomProps> = async (context) => {
  const { roomName } = context.params || {};
  const roomCode = roomName as string;

  // Base URL for meta tags
  const protocol = context.req.headers['x-forwarded-proto'] || 'https';
  const host = context.req.headers['x-forwarded-host'] || context.req.headers.host || 'workspace.bheem.cloud';
  const baseUrl = `${protocol}://${host}`;

  // Default values
  let meetingTitle = 'Video Meeting';
  let meetingDescription = `Join this Bheem Meet video call. Meeting code: ${roomCode}. Click to join securely from any device.`;

  // Try to fetch meeting info from backend
  // Use internal URL for server-side requests (faster and more reliable)
  const internalBackendUrl = process.env.INTERNAL_API_URL || 'http://localhost:8000/api/v1';
  const publicBackendUrl = process.env.NEXT_PUBLIC_API_URL || `${baseUrl}/api/v1`;

  // Try internal URL first (for same-server deployment), then public URL
  const backendUrls = [internalBackendUrl, publicBackendUrl];

  for (const backendUrl of backendUrls) {
    try {
      const response = await fetch(`${backendUrl}/meet/rooms/${roomCode}/info`, {
        headers: { 'Content-Type': 'application/json' },
        // Short timeout for SSR
        signal: AbortSignal.timeout(3000),
      });

      if (response.ok) {
        const data = await response.json();
        if (data.name) {
          meetingTitle = data.name;
          meetingDescription = `You're invited to join "${data.name}" on Bheem Meet. Meeting code: ${roomCode}. Secure video conferencing for teams.`;
          break; // Successfully got data, stop trying
        }
      }
    } catch (error) {
      // Try next URL or use defaults
      console.log(`Could not fetch from ${backendUrl}:`, error);
    }
  }

  // OG Image - use a dynamic image or static fallback
  const ogImageUrl = `${baseUrl}/api/og/meet?title=${encodeURIComponent(meetingTitle)}&code=${encodeURIComponent(roomCode)}`;

  return {
    props: {
      roomCode,
      meetingTitle,
      meetingDescription,
      ogImageUrl,
      baseUrl,
    },
  };
};
