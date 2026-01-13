/**
 * Bheem Workspace - Team Chat (Mattermost Integration)
 * Embedded team chat interface
 */
import { useEffect, useState, useRef } from 'react';
import { useRouter } from 'next/router';
import {
  MessageCircle,
  Users,
  Hash,
  Plus,
  Search,
  Settings,
  Bell,
  BellOff,
  ExternalLink,
  AlertCircle,
  RefreshCw,
  Loader2,
} from 'lucide-react';
import { useAuthStore, useRequireAuth } from '@/stores/authStore';
import { api } from '@/lib/api';
import WorkspaceLayout from '@/components/workspace/WorkspaceLayout';

interface ChatConfig {
  enabled: boolean;
  url: string;
  websocket_url: string;
}

interface Team {
  id: string;
  name: string;
  display_name: string;
}

interface Channel {
  id: string;
  name: string;
  display_name: string;
  type: string;
  header: string;
  purpose: string;
}

export default function ChatPage() {
  const router = useRouter();
  const { user } = useAuthStore();
  const { isAuthenticated, isLoading } = useRequireAuth();
  const iframeRef = useRef<HTMLIFrameElement>(null);

  const [config, setConfig] = useState<ChatConfig | null>(null);
  const [chatToken, setChatToken] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>('');
  const [iframeLoaded, setIframeLoaded] = useState(false);

  // Sidebar state
  const [teams, setTeams] = useState<Team[]>([]);
  const [channels, setChannels] = useState<Channel[]>([]);
  const [selectedTeam, setSelectedTeam] = useState<string>('');
  const [showSidebar, setShowSidebar] = useState(true);

  useEffect(() => {
    if (!isAuthenticated || isLoading) return;
    fetchChatConfig();
  }, [isAuthenticated, isLoading]);

  const fetchChatConfig = async () => {
    try {
      const res = await api.get('/team-chat/config');
      setConfig(res.data);

      if (res.data.enabled) {
        await fetchChatToken();
        await fetchTeams();
      }
    } catch (err: any) {
      console.error('Failed to fetch chat config:', err);
      setError('Failed to load chat configuration');
    } finally {
      setLoading(false);
    }
  };

  const fetchChatToken = async () => {
    try {
      const res = await api.post('/team-chat/login-token');
      setChatToken(res.data.token);
    } catch (err) {
      console.error('Failed to get chat token:', err);
    }
  };

  const fetchTeams = async () => {
    try {
      const res = await api.get('/team-chat/teams');
      setTeams(res.data.teams || []);
      if (res.data.teams?.length > 0) {
        setSelectedTeam(res.data.teams[0].id);
        fetchChannels(res.data.teams[0].id);
      }
    } catch (err) {
      console.error('Failed to fetch teams:', err);
    }
  };

  const fetchChannels = async (teamId: string) => {
    try {
      const res = await api.get(`/team-chat/teams/${teamId}/channels`);
      setChannels(res.data.channels || []);
    } catch (err) {
      console.error('Failed to fetch channels:', err);
    }
  };

  const handleTeamChange = (teamId: string) => {
    setSelectedTeam(teamId);
    fetchChannels(teamId);
  };

  const openInNewTab = () => {
    if (config?.url) {
      window.open(config.url, '_blank');
    }
  };

  if (isLoading || loading) {
    return (
      <WorkspaceLayout title="Chat">
        <div className="flex items-center justify-center h-[calc(100vh-10rem)]">
          <div className="text-center">
            <Loader2 size={40} className="animate-spin text-blue-600 mx-auto mb-4" />
            <p className="text-gray-600">Loading Team Chat...</p>
          </div>
        </div>
      </WorkspaceLayout>
    );
  }

  if (!config?.enabled) {
    return (
      <WorkspaceLayout title="Chat">
        <div className="flex items-center justify-center h-[calc(100vh-10rem)]">
          <div className="bg-white rounded-xl shadow-lg p-8 max-w-md text-center">
            <div className="w-16 h-16 bg-gray-100 rounded-xl flex items-center justify-center mx-auto mb-4">
              <MessageCircle size={32} className="text-gray-400" />
            </div>
            <h1 className="text-xl font-bold text-gray-900 mb-2">Team Chat Not Enabled</h1>
            <p className="text-gray-600 mb-6">
              Team chat is not configured for your workspace. Please contact your administrator to enable it.
            </p>
            <button
              onClick={() => router.push('/dashboard')}
              className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              Go to Dashboard
            </button>
          </div>
        </div>
      </WorkspaceLayout>
    );
  }

  if (error) {
    return (
      <WorkspaceLayout title="Chat">
        <div className="flex items-center justify-center h-[calc(100vh-10rem)]">
          <div className="bg-white rounded-xl shadow-lg p-8 max-w-md text-center">
            <div className="w-16 h-16 bg-red-100 rounded-xl flex items-center justify-center mx-auto mb-4">
              <AlertCircle size={32} className="text-red-600" />
            </div>
            <h1 className="text-xl font-bold text-gray-900 mb-2">Connection Error</h1>
            <p className="text-gray-600 mb-6">{error}</p>
            <button
              onClick={fetchChatConfig}
              className="inline-flex items-center gap-2 px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              <RefreshCw size={20} />
              Try Again
            </button>
          </div>
        </div>
      </WorkspaceLayout>
    );
  }

  // Build the Mattermost embed URL with SSO token
  const chatUrl = chatToken
    ? `${config.url}/login/token?token=${chatToken}&redirect_to=/`
    : config.url;

  return (
    <WorkspaceLayout title="Chat">
      <div className="h-[calc(100vh-8rem)] flex bg-gray-900 rounded-xl overflow-hidden -m-4 lg:-m-6">
        {/* Sidebar */}
        {showSidebar && (
          <div className="w-64 bg-gray-800 flex flex-col">
            {/* Header */}
            <div className="p-4 border-b border-gray-700">
              <div className="flex items-center justify-between">
                <h1 className="text-lg font-bold text-white flex items-center gap-2">
                  <MessageCircle size={20} />
                  Team Chat
                </h1>
                <button
                  onClick={openInNewTab}
                  className="p-1 text-gray-400 hover:text-white transition-colors"
                  title="Open in new tab"
                >
                  <ExternalLink size={18} />
                </button>
              </div>
            </div>

            {/* Team Selector */}
            {teams.length > 0 && (
              <div className="p-3 border-b border-gray-700">
                <select
                  value={selectedTeam}
                  onChange={(e) => handleTeamChange(e.target.value)}
                  className="w-full px-3 py-2 bg-gray-700 text-white rounded-lg border-none focus:ring-2 focus:ring-blue-500"
                >
                  {teams.map(team => (
                    <option key={team.id} value={team.id}>
                      {team.display_name}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* Channels */}
            <div className="flex-1 overflow-y-auto py-2">
              <div className="px-3 py-2 flex items-center justify-between">
                <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
                  Channels
                </span>
                <button className="p-1 text-gray-400 hover:text-white transition-colors">
                  <Plus size={16} />
                </button>
              </div>
              {channels
                .filter(c => c.type === 'O' || c.type === 'P')
                .map(channel => (
                  <button
                    key={channel.id}
                    className="w-full px-3 py-2 text-left text-gray-300 hover:bg-gray-700 hover:text-white transition-colors flex items-center gap-2"
                  >
                    <Hash size={16} className="text-gray-500" />
                    <span className="truncate">{channel.display_name}</span>
                  </button>
                ))}

              <div className="px-3 py-2 flex items-center justify-between mt-4">
                <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
                  Direct Messages
                </span>
                <button className="p-1 text-gray-400 hover:text-white transition-colors">
                  <Plus size={16} />
                </button>
              </div>
              {channels
                .filter(c => c.type === 'D')
                .map(channel => (
                  <button
                    key={channel.id}
                    className="w-full px-3 py-2 text-left text-gray-300 hover:bg-gray-700 hover:text-white transition-colors flex items-center gap-2"
                  >
                    <div className="w-2 h-2 bg-green-500 rounded-full" />
                    <span className="truncate">{channel.display_name}</span>
                  </button>
                ))}
            </div>

            {/* User Info */}
            <div className="p-4 border-t border-gray-700">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-blue-600 rounded-full flex items-center justify-center text-white font-medium">
                  {user?.username?.charAt(0) || 'U'}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-white font-medium truncate">
                    {user?.username}
                  </p>
                  <p className="text-gray-400 text-sm truncate">{user?.email}</p>
                </div>
                <button className="p-2 text-gray-400 hover:text-white transition-colors">
                  <Settings size={18} />
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Toggle Sidebar Button */}
        <button
          onClick={() => setShowSidebar(!showSidebar)}
          className={`absolute top-1/2 -translate-y-1/2 z-10 p-2 bg-gray-700 text-white rounded-r-lg hover:bg-gray-600 transition-colors ${showSidebar ? 'left-64' : 'left-0'}`}
        >
          <Users size={16} />
        </button>

        {/* Chat Iframe */}
        <div className="flex-1 relative">
          {!iframeLoaded && (
            <div className="absolute inset-0 flex items-center justify-center bg-gray-900">
              <div className="text-center">
                <Loader2 size={40} className="animate-spin text-blue-600 mx-auto mb-4" />
                <p className="text-gray-400">Connecting to chat...</p>
              </div>
            </div>
          )}
          <iframe
            ref={iframeRef}
            src={chatUrl}
            className="w-full h-full border-none"
            onLoad={() => setIframeLoaded(true)}
            allow="microphone; camera; notifications"
          />
        </div>
      </div>
    </WorkspaceLayout>
  );
}
