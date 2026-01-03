import { useEffect, useState, useCallback } from 'react';
import Head from 'next/head';
import { useRouter } from 'next/router';
import { motion } from 'framer-motion';
import {
  Video,
  Plus,
  Calendar,
  Clock,
  Users,
  Settings,
  ChevronRight,
  Sparkles,
} from 'lucide-react';
import AppSwitcher from '@/components/shared/AppSwitcher';
import MeetingCard from '@/components/meet/MeetingCard';
import QuickJoinInput from '@/components/meet/QuickJoinInput';
import NewMeetingModal from '@/components/meet/NewMeetingModal';
import { MeetButton, MeetAvatar } from '@/components/meet/ui';
import { useMeetStore } from '@/stores/meetStore';
import { useAuthStore, useRequireAuth } from '@/stores/authStore';

export default function MeetPage() {
  const router = useRouter();
  const { isAuthenticated: isLoggedIn, isLoading: authLoading } = useRequireAuth();
  const { user } = useAuthStore();

  const {
    meetings,
    isCreateModalOpen,
    openCreateModal,
    closeCreateModal,
    fetchMeetings,
    fetchConfig,
    endMeeting,
    error,
    clearError,
    loading,
  } = useMeetStore();

  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  // Fetch meetings and config on mount
  useEffect(() => {
    if (!authLoading && isLoggedIn) {
      fetchMeetings();
      fetchConfig();
    }
  }, [authLoading, isLoggedIn]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'n' && !e.metaKey && !e.ctrlKey && !isCreateModalOpen) {
        const activeElement = document.activeElement;
        if (activeElement?.tagName !== 'INPUT' && activeElement?.tagName !== 'TEXTAREA') {
          e.preventDefault();
          openCreateModal();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isCreateModalOpen, openCreateModal]);

  const handleJoin = useCallback((code: string) => {
    router.push(`/meet/room/${code.trim()}`);
  }, [router]);

  const handleJoinFromCard = useCallback((roomCode: string) => {
    router.push(`/meet/room/${roomCode}`);
  }, [router]);

  // Group meetings
  const activeMeetings = meetings.filter(m => m.status === 'active');
  const upcomingMeetings = meetings.filter(m => m.status === 'scheduled');
  const recentMeetings = meetings.filter(m => m.status === 'ended').slice(0, 5);

  // Show loading while checking auth
  if (authLoading) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 border-2 border-emerald-500/30 border-t-emerald-500 rounded-full animate-spin mx-auto mb-4" />
          <p className="text-gray-400">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <>
      <Head>
        <title>Meet | Bheem</title>
      </Head>

      <div className="min-h-screen flex bg-gray-900">
        {/* App Switcher */}
        <AppSwitcher
          activeApp="meet"
          collapsed={sidebarCollapsed}
          onToggleCollapse={() => setSidebarCollapsed(!sidebarCollapsed)}
        />

        {/* Main Content */}
        <div
          className="flex-1 transition-all duration-300 overflow-auto"
          style={{ marginLeft: sidebarCollapsed ? 64 : 240 }}
        >
          {/* Header */}
          <header className="sticky top-0 z-10 bg-gray-900/80 backdrop-blur-lg border-b border-gray-800">
            <div className="max-w-6xl mx-auto px-6 py-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-500 to-emerald-600 flex items-center justify-center">
                    <Video size={20} className="text-white" />
                  </div>
                  <div>
                    <h1 className="text-xl font-semibold text-white">Bheem Meet</h1>
                    <p className="text-sm text-gray-400">Secure video meetings</p>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <MeetButton
                    variant="primary"
                    onClick={openCreateModal}
                    leftIcon={<Plus size={18} />}
                  >
                    New Meeting
                  </MeetButton>
                  <button className="p-2 rounded-full hover:bg-gray-800 transition-colors">
                    <Settings size={20} className="text-gray-400" />
                  </button>
                  <MeetAvatar name={user?.username || user?.email || 'User'} size="md" />
                </div>
              </div>
            </div>
          </header>

          <main className="max-w-6xl mx-auto px-6 py-8">
            {/* Error Banner */}
            {error && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                className="mb-6 px-4 py-3 bg-red-500/10 border border-red-500/30 rounded-xl flex items-center justify-between"
              >
                <span className="text-sm text-red-400">{error}</span>
                <button
                  onClick={clearError}
                  className="text-red-400 hover:text-red-300 text-sm font-medium"
                >
                  Dismiss
                </button>
              </motion.div>
            )}

            {/* Hero Section */}
            <motion.section
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="mb-12"
            >
              <div className="grid md:grid-cols-2 gap-8 items-center">
                {/* Left: Quick Actions */}
                <div>
                  <h2 className="text-3xl font-bold text-white mb-3">
                    Start or join a meeting
                  </h2>
                  <p className="text-gray-400 mb-8">
                    Connect with your team instantly with secure, high-quality video calls.
                  </p>

                  {/* Action Cards */}
                  <div className="grid grid-cols-2 gap-4 mb-8">
                    <motion.button
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      onClick={openCreateModal}
                      className="p-5 bg-gradient-to-br from-emerald-500 to-emerald-600 rounded-2xl text-left group"
                    >
                      <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center mb-4">
                        <Sparkles size={24} className="text-white" />
                      </div>
                      <h3 className="font-semibold text-white mb-1">New Meeting</h3>
                      <p className="text-emerald-100 text-sm">Start right now</p>
                      <ChevronRight
                        size={20}
                        className="mt-3 text-white/70 group-hover:translate-x-1 transition-transform"
                      />
                    </motion.button>

                    <motion.button
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      onClick={() => {
                        openCreateModal();
                        // TODO: Set mode to schedule
                      }}
                      className="p-5 bg-gray-800 hover:bg-gray-750 border border-gray-700 rounded-2xl text-left group"
                    >
                      <div className="w-12 h-12 bg-gray-700 rounded-xl flex items-center justify-center mb-4">
                        <Calendar size={24} className="text-gray-300" />
                      </div>
                      <h3 className="font-semibold text-white mb-1">Schedule</h3>
                      <p className="text-gray-400 text-sm">Plan for later</p>
                      <ChevronRight
                        size={20}
                        className="mt-3 text-gray-500 group-hover:translate-x-1 transition-transform"
                      />
                    </motion.button>
                  </div>
                </div>

                {/* Right: Join Input */}
                <div className="bg-gray-800/50 backdrop-blur-sm border border-gray-700/50 rounded-3xl p-8">
                  <div className="flex items-center gap-3 mb-6">
                    <div className="w-10 h-10 bg-gray-700 rounded-xl flex items-center justify-center">
                      <Users size={20} className="text-gray-400" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-white">Join a Meeting</h3>
                      <p className="text-sm text-gray-400">Enter code or paste link</p>
                    </div>
                  </div>
                  <QuickJoinInput onJoin={handleJoin} />
                </div>
              </div>
            </motion.section>

            {/* Live Meetings */}
            {activeMeetings.length > 0 && (
              <motion.section
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 }}
                className="mb-10"
              >
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-lg font-semibold text-white flex items-center gap-2">
                    <span className="relative flex h-2 w-2">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                      <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
                    </span>
                    Live Now
                  </h2>
                </div>
                <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {activeMeetings.map((meeting) => (
                    <MeetingCard
                      key={meeting.id}
                      meeting={meeting}
                      onJoin={() => handleJoinFromCard(meeting.roomCode)}
                      onEnd={() => endMeeting(meeting.roomCode)}
                    />
                  ))}
                </div>
              </motion.section>
            )}

            {/* Upcoming Meetings */}
            {upcomingMeetings.length > 0 && (
              <motion.section
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 }}
                className="mb-10"
              >
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-lg font-semibold text-white flex items-center gap-2">
                    <Calendar size={18} className="text-gray-400" />
                    Upcoming
                  </h2>
                  <button className="text-sm text-emerald-400 hover:text-emerald-300">
                    View all
                  </button>
                </div>
                <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {upcomingMeetings.map((meeting) => (
                    <MeetingCard
                      key={meeting.id}
                      meeting={meeting}
                      onJoin={() => handleJoinFromCard(meeting.roomCode)}
                      onEnd={() => endMeeting(meeting.roomCode)}
                    />
                  ))}
                </div>
              </motion.section>
            )}

            {/* Recent Meetings */}
            {recentMeetings.length > 0 && (
              <motion.section
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 }}
                className="mb-10"
              >
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-lg font-semibold text-white flex items-center gap-2">
                    <Clock size={18} className="text-gray-400" />
                    Recent
                  </h2>
                </div>
                <div className="bg-gray-800/30 border border-gray-700/50 rounded-2xl overflow-hidden">
                  {recentMeetings.map((meeting, index) => (
                    <div
                      key={meeting.id}
                      className={`
                        flex items-center justify-between px-5 py-4
                        ${index !== recentMeetings.length - 1 ? 'border-b border-gray-700/50' : ''}
                        hover:bg-gray-800/50 transition-colors
                      `}
                    >
                      <div className="flex items-center gap-4">
                        <div className="w-10 h-10 bg-gray-700/50 rounded-xl flex items-center justify-center">
                          <Video size={18} className="text-gray-400" />
                        </div>
                        <div>
                          <h3 className="font-medium text-white">{meeting.title || 'Untitled'}</h3>
                          <p className="text-sm text-gray-500">
                            {meeting.scheduledStart
                              ? new Date(meeting.scheduledStart).toLocaleDateString()
                              : 'No date'}
                          </p>
                        </div>
                      </div>
                      <MeetButton
                        variant="ghost"
                        size="sm"
                        onClick={() => handleJoinFromCard(meeting.roomCode)}
                      >
                        Rejoin
                      </MeetButton>
                    </div>
                  ))}
                </div>
              </motion.section>
            )}

            {/* Empty State */}
            {meetings.length === 0 && !loading.meetings && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="text-center py-16"
              >
                <div className="w-20 h-20 bg-gray-800 rounded-2xl flex items-center justify-center mx-auto mb-6">
                  <Video size={36} className="text-gray-600" />
                </div>
                <h3 className="text-xl font-semibold text-white mb-2">No meetings yet</h3>
                <p className="text-gray-400 mb-6 max-w-md mx-auto">
                  Start a new meeting to connect with your team, or join an existing one using a meeting code.
                </p>
                <MeetButton
                  variant="primary"
                  size="lg"
                  onClick={openCreateModal}
                  leftIcon={<Plus size={20} />}
                >
                  Start Your First Meeting
                </MeetButton>
              </motion.div>
            )}

            {/* Loading State */}
            {loading.meetings && (
              <div className="flex items-center justify-center py-16">
                <div className="w-8 h-8 border-2 border-emerald-500/30 border-t-emerald-500 rounded-full animate-spin" />
              </div>
            )}

            {/* Keyboard Shortcuts Hint */}
            <div className="mt-8 text-center text-sm text-gray-600">
              Press{' '}
              <kbd className="px-2 py-1 bg-gray-800 rounded text-gray-400 font-mono text-xs">N</kbd>
              {' '}to start a new meeting
            </div>
          </main>
        </div>

        {/* Create Meeting Modal */}
        <NewMeetingModal isOpen={isCreateModalOpen} onClose={closeCreateModal} />
      </div>
    </>
  );
}
