import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import Link from 'next/link';
import {
  Mail,
  Video,
  FileText,
  Calendar,
  User,
  LogOut,
  Settings,
  ExternalLink,
  Clock,
  CheckCircle,
  AlertCircle,
} from 'lucide-react';
import { useAuthStore, useRequireAuth } from '@/stores/authStore';
import { api } from '@/lib/api';

interface WorkspaceData {
  user: {
    id: string;
    username: string;
    email: string;
    name: string;
    company: string;
    role: string;
    workspace_role: string | null;
    tenant: {
      id: string;
      name: string;
      slug: string;
    } | null;
  };
  workspace: {
    email: {
      enabled: boolean;
      address: string;
      webmail_url: string;
    };
    files: {
      enabled: boolean;
      web_url: string;
    };
    calendar: {
      enabled: boolean;
      web_url: string;
    };
    meetings: {
      enabled: boolean;
      can_create: boolean;
    };
  };
}

const APP_CARDS = [
  {
    id: 'mail',
    name: 'Bheem Mail',
    description: 'Professional email for your workspace',
    icon: Mail,
    color: 'from-blue-500 to-blue-600',
    bgColor: 'bg-blue-50',
    iconColor: 'text-blue-600',
    href: 'https://mail.bheem.cloud',
    external: true,
  },
  {
    id: 'meet',
    name: 'Bheem Meet',
    description: 'HD video meetings with your team',
    icon: Video,
    color: 'from-green-500 to-green-600',
    bgColor: 'bg-green-50',
    iconColor: 'text-green-600',
    href: '/meet',
    external: false,
  },
  {
    id: 'docs',
    name: 'Bheem Docs',
    description: 'Collaborate on documents in real-time',
    icon: FileText,
    color: 'from-purple-500 to-purple-600',
    bgColor: 'bg-purple-50',
    iconColor: 'text-purple-600',
    href: 'https://docs.bheem.cloud',
    external: true,
  },
  {
    id: 'calendar',
    name: 'Bheem Calendar',
    description: 'Schedule and manage your events',
    icon: Calendar,
    color: 'from-orange-500 to-orange-600',
    bgColor: 'bg-orange-50',
    iconColor: 'text-orange-600',
    href: 'https://docs.bheem.cloud/apps/calendar',
    external: true,
  },
];

export default function UserDashboard() {
  const router = useRouter();
  const { user, logout } = useAuthStore();
  const [workspaceData, setWorkspaceData] = useState<WorkspaceData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Require authentication
  const { isAuthenticated, isLoading: authLoading } = useRequireAuth();

  useEffect(() => {
    if (!isAuthenticated || authLoading) return;

    const fetchWorkspace = async () => {
      try {
        const response = await api.get('/user-workspace/me');
        setWorkspaceData(response.data);
      } catch (err: any) {
        console.error('Failed to fetch workspace:', err);
        setError('Failed to load workspace data');
      } finally {
        setLoading(false);
      }
    };

    fetchWorkspace();
  }, [isAuthenticated, authLoading]);

  const handleLogout = () => {
    logout();
    router.push('/login');
  };

  // Show loading while checking auth
  if (authLoading || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading your workspace...</p>
        </div>
      </div>
    );
  }

  const displayName = workspaceData?.user?.name || user?.username || 'User';
  const displayEmail = workspaceData?.user?.email || user?.email || '';
  const tenantName = workspaceData?.user?.tenant?.name || 'Bheem Workspace';

  return (
    <>
      <Head>
        <title>Dashboard | Bheem Workspace</title>
      </Head>

      <div className="min-h-screen bg-gray-50">
        {/* Header */}
        <header className="bg-white border-b border-gray-200">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex justify-between items-center h-16">
              {/* Logo */}
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 bg-gradient-to-br from-blue-600 to-purple-600 rounded-xl flex items-center justify-center">
                  <span className="text-lg font-bold text-white">B</span>
                </div>
                <div>
                  <h1 className="text-lg font-semibold text-gray-900">Bheem Workspace</h1>
                  <p className="text-xs text-gray-500">{tenantName}</p>
                </div>
              </div>

              {/* User Menu */}
              <div className="flex items-center gap-4">
                <div className="text-right hidden sm:block">
                  <p className="text-sm font-medium text-gray-900">{displayName}</p>
                  <p className="text-xs text-gray-500">{displayEmail}</p>
                </div>
                <div className="flex items-center gap-2">
                  <div className="h-10 w-10 bg-gradient-to-br from-blue-500 to-purple-500 rounded-full flex items-center justify-center text-white font-medium">
                    {displayName.charAt(0).toUpperCase()}
                  </div>
                  <button
                    onClick={handleLogout}
                    className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
                    title="Logout"
                  >
                    <LogOut size={20} />
                  </button>
                </div>
              </div>
            </div>
          </div>
        </header>

        {/* Main Content */}
        <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          {/* Welcome Banner */}
          <div className="bg-gradient-to-r from-blue-600 to-purple-600 rounded-2xl p-6 md:p-8 text-white mb-8">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
              <div>
                <h2 className="text-2xl md:text-3xl font-bold">
                  Welcome back, {displayName.split(' ')[0]}!
                </h2>
                <p className="mt-2 text-blue-100">
                  Access all your workspace tools from one place
                </p>
              </div>
              <div className="flex items-center gap-3">
                {workspaceData?.user?.workspace_role && (
                  <span className="px-3 py-1 bg-white/20 rounded-full text-sm font-medium">
                    {workspaceData.user.workspace_role.charAt(0).toUpperCase() +
                     workspaceData.user.workspace_role.slice(1)}
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Error Message */}
          {error && (
            <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg flex items-center gap-3">
              <AlertCircle className="text-red-500" size={20} />
              <p className="text-red-700">{error}</p>
            </div>
          )}

          {/* Quick Access Apps */}
          <div className="mb-8">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Your Apps</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {APP_CARDS.map((app) => {
                const Icon = app.icon;
                return (
                  <a
                    key={app.id}
                    href={app.href}
                    target={app.external ? '_blank' : undefined}
                    rel={app.external ? 'noopener noreferrer' : undefined}
                    className="group bg-white rounded-xl p-6 border border-gray-200 hover:border-gray-300 hover:shadow-lg transition-all duration-200"
                  >
                    <div className="flex items-start justify-between">
                      <div className={`p-3 rounded-xl ${app.bgColor}`}>
                        <Icon className={app.iconColor} size={24} />
                      </div>
                      {app.external && (
                        <ExternalLink size={16} className="text-gray-400 group-hover:text-gray-600" />
                      )}
                    </div>
                    <h4 className="mt-4 font-semibold text-gray-900 group-hover:text-blue-600 transition-colors">
                      {app.name}
                    </h4>
                    <p className="mt-1 text-sm text-gray-500">{app.description}</p>
                  </a>
                );
              })}
            </div>
          </div>

          {/* Account Info */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Workspace Email */}
            <div className="bg-white rounded-xl p-6 border border-gray-200">
              <div className="flex items-center gap-3 mb-4">
                <div className="p-2 bg-blue-50 rounded-lg">
                  <Mail className="text-blue-600" size={20} />
                </div>
                <h3 className="font-semibold text-gray-900">Your Workspace Email</h3>
              </div>
              <div className="space-y-3">
                <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                  <div>
                    <p className="text-sm text-gray-500">Email Address</p>
                    <p className="font-medium text-gray-900">{displayEmail}</p>
                  </div>
                  <CheckCircle className="text-green-500" size={20} />
                </div>
                <a
                  href="https://mail.bheem.cloud"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-center gap-2 w-full py-2.5 px-4 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                >
                  <Mail size={18} />
                  Open Webmail
                  <ExternalLink size={14} />
                </a>
              </div>
            </div>

            {/* Quick Actions */}
            <div className="bg-white rounded-xl p-6 border border-gray-200">
              <div className="flex items-center gap-3 mb-4">
                <div className="p-2 bg-green-50 rounded-lg">
                  <Video className="text-green-600" size={20} />
                </div>
                <h3 className="font-semibold text-gray-900">Quick Actions</h3>
              </div>
              <div className="space-y-3">
                <Link
                  href="/meet"
                  className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
                >
                  <Video className="text-green-600" size={20} />
                  <div className="flex-1">
                    <p className="font-medium text-gray-900">Start a Meeting</p>
                    <p className="text-sm text-gray-500">Create or join a video call</p>
                  </div>
                </Link>
                <a
                  href="https://docs.bheem.cloud"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
                >
                  <FileText className="text-purple-600" size={20} />
                  <div className="flex-1">
                    <p className="font-medium text-gray-900">Create Document</p>
                    <p className="text-sm text-gray-500">Start a new document or spreadsheet</p>
                  </div>
                </a>
                <a
                  href="https://docs.bheem.cloud/apps/calendar"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
                >
                  <Calendar className="text-orange-600" size={20} />
                  <div className="flex-1">
                    <p className="font-medium text-gray-900">View Calendar</p>
                    <p className="text-sm text-gray-500">Check your schedule and events</p>
                  </div>
                </a>
              </div>
            </div>
          </div>

          {/* Workspace Info Footer */}
          {workspaceData?.user?.tenant && (
            <div className="mt-8 text-center text-sm text-gray-500">
              <p>
                You are a member of <span className="font-medium">{workspaceData.user.tenant.name}</span>
              </p>
            </div>
          )}
        </main>

        {/* Footer */}
        <footer className="mt-auto py-6 text-center text-sm text-gray-500">
          <p>Bheem Workspace - Bheemverse Innovation</p>
        </footer>
      </div>
    </>
  );
}
