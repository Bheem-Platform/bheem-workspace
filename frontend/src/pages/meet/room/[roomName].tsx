import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import {
  LiveKitRoom,
  VideoConference,
  RoomAudioRenderer,
  ControlBar,
  useTracks,
  ParticipantTile,
  useRoomContext,
} from '@livekit/components-react';
import '@livekit/components-styles';
import {
  Mic,
  MicOff,
  Video,
  VideoOff,
  PhoneOff,
  ScreenShare,
  MessageSquare,
  Users,
  Settings,
  MoreVertical,
  Copy,
  Disc,
  StopCircle,
} from 'lucide-react';

interface RoomConfig {
  token: string;
  serverUrl: string;
  roomName: string;
  participantName: string;
}

export default function MeetingRoom() {
  const router = useRouter();
  const { roomName } = router.query;
  const [config, setConfig] = useState<RoomConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isRecording, setIsRecording] = useState(false);

  useEffect(() => {
    if (!roomName) return;

    // Get token from API
    const fetchToken = async () => {
      try {
        // Would call API to get token
        // const response = await api.post('/meet/join', {
        //   room_name: roomName,
        //   user_id: 'user-123',
        //   user_name: 'John Doe',
        //   tenant_id: 'tenant-123'
        // });

        // Mock for now
        setConfig({
          token: 'mock-token',
          serverUrl: process.env.NEXT_PUBLIC_LIVEKIT_URL || 'wss://meet.bheem.cloud',
          roomName: roomName as string,
          participantName: 'John Doe',
        });
        setLoading(false);
      } catch (err) {
        setError('Failed to join meeting');
        setLoading(false);
      }
    };

    fetchToken();
  }, [roomName]);

  const handleDisconnect = () => {
    router.push('/meet');
  };

  const copyMeetingLink = () => {
    navigator.clipboard.writeText(window.location.href);
    // Show toast
  };

  const toggleRecording = () => {
    setIsRecording(!isRecording);
    // Would call API to start/stop recording
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white mx-auto mb-4"></div>
          <p className="text-white">Joining meeting...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <p className="text-red-500 mb-4">{error}</p>
          <button
            onClick={() => router.push('/meet')}
            className="px-4 py-2 bg-white text-gray-900 rounded-lg"
          >
            Back to Meetings
          </button>
        </div>
      </div>
    );
  }

  if (!config) return null;

  return (
    <div className="min-h-screen bg-gray-900">
      {/* Custom Meeting UI wrapping LiveKit */}
      <div className="h-screen flex flex-col">
        {/* Top Bar */}
        <div className="h-14 bg-gray-800 flex items-center justify-between px-4">
          <div className="flex items-center space-x-4">
            <div className="w-8 h-8 bg-bheem-primary rounded-lg flex items-center justify-center">
              <span className="text-white font-bold">B</span>
            </div>
            <div>
              <h1 className="text-white font-medium">{config.roomName}</h1>
              <p className="text-gray-400 text-xs">Bheem Meet</p>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            {isRecording && (
              <span className="flex items-center px-2 py-1 bg-red-500/20 text-red-400 text-xs rounded-full">
                <span className="w-2 h-2 bg-red-500 rounded-full mr-1 animate-pulse" />
                Recording
              </span>
            )}
            <button
              onClick={copyMeetingLink}
              className="p-2 text-gray-400 hover:text-white hover:bg-gray-700 rounded-lg"
              title="Copy link"
            >
              <Copy size={18} />
            </button>
            <button
              onClick={toggleRecording}
              className={`p-2 rounded-lg ${
                isRecording
                  ? 'text-red-400 hover:bg-red-500/20'
                  : 'text-gray-400 hover:text-white hover:bg-gray-700'
              }`}
              title={isRecording ? 'Stop recording' : 'Start recording'}
            >
              {isRecording ? <StopCircle size={18} /> : <Disc size={18} />}
            </button>
            <button className="p-2 text-gray-400 hover:text-white hover:bg-gray-700 rounded-lg">
              <Settings size={18} />
            </button>
          </div>
        </div>

        {/* Video Area - Would use LiveKit components */}
        <div className="flex-1 relative">
          {/* Placeholder for LiveKit VideoConference */}
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="text-center">
              <Video size={64} className="text-gray-600 mx-auto mb-4" />
              <p className="text-gray-400">
                LiveKit video conference will render here
              </p>
              <p className="text-gray-500 text-sm mt-2">
                Connect to: {config.serverUrl}
              </p>
            </div>
          </div>

          {/* Participants Sidebar (would be toggled) */}
          <div className="absolute right-0 top-0 bottom-0 w-72 bg-gray-800 border-l border-gray-700 p-4 hidden">
            <h2 className="text-white font-medium mb-4 flex items-center">
              <Users size={18} className="mr-2" />
              Participants (1)
            </h2>
            <div className="space-y-2">
              <div className="flex items-center space-x-3 p-2 rounded-lg hover:bg-gray-700">
                <div className="w-8 h-8 bg-bheem-primary rounded-full flex items-center justify-center">
                  <span className="text-white text-sm">JD</span>
                </div>
                <div className="flex-1">
                  <p className="text-white text-sm">{config.participantName}</p>
                  <p className="text-gray-400 text-xs">Host</p>
                </div>
                <Mic size={16} className="text-green-400" />
              </div>
            </div>
          </div>

          {/* Chat Sidebar (would be toggled) */}
          <div className="absolute right-0 top-0 bottom-0 w-80 bg-gray-800 border-l border-gray-700 hidden">
            <div className="h-full flex flex-col">
              <div className="p-4 border-b border-gray-700">
                <h2 className="text-white font-medium flex items-center">
                  <MessageSquare size={18} className="mr-2" />
                  Chat
                </h2>
              </div>
              <div className="flex-1 p-4 overflow-y-auto">
                {/* Messages would go here */}
              </div>
              <div className="p-4 border-t border-gray-700">
                <input
                  type="text"
                  placeholder="Type a message..."
                  className="w-full px-3 py-2 bg-gray-700 text-white rounded-lg border border-gray-600 focus:outline-none focus:border-bheem-primary"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Control Bar */}
        <div className="h-20 bg-gray-800 flex items-center justify-center space-x-4">
          <button className="p-4 bg-gray-700 text-white rounded-full hover:bg-gray-600">
            <Mic size={24} />
          </button>
          <button className="p-4 bg-gray-700 text-white rounded-full hover:bg-gray-600">
            <Video size={24} />
          </button>
          <button className="p-4 bg-gray-700 text-white rounded-full hover:bg-gray-600">
            <ScreenShare size={24} />
          </button>
          <button className="p-4 bg-gray-700 text-gray-400 rounded-full hover:bg-gray-600">
            <MessageSquare size={24} />
          </button>
          <button className="p-4 bg-gray-700 text-gray-400 rounded-full hover:bg-gray-600">
            <Users size={24} />
          </button>
          <button
            onClick={handleDisconnect}
            className="p-4 bg-red-500 text-white rounded-full hover:bg-red-600"
          >
            <PhoneOff size={24} />
          </button>
        </div>
      </div>

      {/* Watermark overlay (for anti-piracy) */}
      <div className="fixed inset-0 pointer-events-none flex items-center justify-center opacity-10">
        <div className="text-white text-4xl font-bold transform -rotate-45">
          {config.participantName} • {new Date().toLocaleDateString()}
        </div>
      </div>
    </div>
  );
}
