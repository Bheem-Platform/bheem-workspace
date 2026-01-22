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
import WorkspaceLayout from '@/components/workspace/WorkspaceLayout';
import AppLauncher from '@/components/shared/AppLauncher';
import MeetingCard from '@/components/meet/MeetingCard';
import QuickJoinInput from '@/components/meet/QuickJoinInput';
import NewMeetingModal from '@/components/meet/NewMeetingModal';
import FeaturesCarousel from '@/components/meet/FeaturesCarousel';
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
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 border-2 border-[#977DFF]/30 border-t-[#977DFF] rounded-full animate-spin mx-auto mb-4" />
          <p className="text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  // Custom Meet header with brand colors - Light theme
  const meetHeader = (
    <header className="sticky top-0 z-10 bg-white/80 backdrop-blur-lg border-b border-gray-200 h-16">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 h-full flex items-center justify-between">
        <div className="flex items-center gap-3 sm:gap-4">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#FFCCF2] via-[#977DFF] to-[#0033FF] flex items-center justify-center">
            <Video size={20} className="text-white" />
          </div>
          <div className="hidden sm:block">
            <h1 className="text-xl font-semibold text-gray-900">Bheem Meet</h1>
            <p className="text-sm text-gray-500">Secure video meetings</p>
          </div>
        </div>
        <div className="flex items-center gap-2 sm:gap-4">
          <MeetButton
            variant="primary"
            onClick={openCreateModal}
            leftIcon={<Plus size={18} />}
            className="hidden sm:inline-flex"
          >
            New Meeting
          </MeetButton>
          <MeetButton
            variant="primary"
            onClick={openCreateModal}
            size="icon"
            className="sm:hidden"
          >
            <Plus size={20} />
          </MeetButton>
          <AppLauncher />
          <button className="p-2 rounded-full hover:bg-gray-100 transition-colors hidden sm:flex">
            <Settings size={20} className="text-gray-500" />
          </button>
          <MeetAvatar name={user?.username || user?.email || 'User'} size="md" />
        </div>
      </div>
    </header>
  );

  return (
    <>
      <Head>
        <title>Meet | Bheem</title>
      </Head>

      <WorkspaceLayout
        title="Meet"
        customHeader={meetHeader}
      >
        <div className="min-h-full overflow-auto">

          <main className="max-w-6xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
            {/* Error Banner */}
            {error && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                className="mb-6 px-4 py-3 bg-red-50 border border-red-200 rounded-xl flex items-center justify-between"
              >
                <span className="text-sm text-red-600">{error}</span>
                <button
                  onClick={clearError}
                  className="text-red-600 hover:text-red-700 text-sm font-medium"
                >
                  Dismiss
                </button>
              </motion.div>
            )}

            {/* Hero Section */}
            <motion.section
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="mb-8 sm:mb-12"
            >
              <div className="grid lg:grid-cols-2 gap-6 lg:gap-8 items-center">
                {/* Left: Quick Actions */}
                <div>
                  <h2 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-2 sm:mb-3">
                    Start or join a meeting
                  </h2>
                  <p className="text-gray-600 mb-6 sm:mb-8 text-sm sm:text-base">
                    Connect with your team instantly with secure, high-quality video calls.
                  </p>

                  {/* Action Cards */}
                  <div className="grid grid-cols-2 gap-3 sm:gap-4 mb-6 sm:mb-8">
                    <motion.button
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      onClick={openCreateModal}
                      className="p-4 sm:p-5 bg-gradient-to-br from-[#FFCCF2] via-[#977DFF] to-[#0033FF] rounded-2xl text-left group"
                    >
                      <div className="w-10 h-10 sm:w-12 sm:h-12 bg-white/20 rounded-xl flex items-center justify-center mb-3 sm:mb-4">
                        <Sparkles size={20} className="text-white sm:w-6 sm:h-6" />
                      </div>
                      <h3 className="font-semibold text-white mb-1 text-sm sm:text-base">New Meeting</h3>
                      <p className="text-white/80 text-xs sm:text-sm">Start right now</p>
                      <ChevronRight
                        size={18}
                        className="mt-2 sm:mt-3 text-white/70 group-hover:translate-x-1 transition-transform"
                      />
                    </motion.button>

                    <motion.button
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      onClick={() => {
                        openCreateModal();
                        // TODO: Set mode to schedule
                      }}
                      className="p-4 sm:p-5 bg-white hover:bg-gray-50 border border-gray-200 rounded-2xl text-left group shadow-sm"
                    >
                      <div className="w-10 h-10 sm:w-12 sm:h-12 bg-gray-100 rounded-xl flex items-center justify-center mb-3 sm:mb-4">
                        <Calendar size={20} className="text-gray-600 sm:w-6 sm:h-6" />
                      </div>
                      <h3 className="font-semibold text-gray-900 mb-1 text-sm sm:text-base">Schedule</h3>
                      <p className="text-gray-500 text-xs sm:text-sm">Plan for later</p>
                      <ChevronRight
                        size={18}
                        className="mt-2 sm:mt-3 text-gray-400 group-hover:translate-x-1 transition-transform"
                      />
                    </motion.button>
                  </div>
                </div>

                {/* Right: Join Input */}
                <div className="bg-white border border-gray-200 rounded-2xl sm:rounded-3xl p-5 sm:p-8 shadow-sm">
                  <div className="flex items-center gap-3 mb-4 sm:mb-6">
                    <div className="w-10 h-10 bg-gradient-to-br from-[#FFCCF2]/20 via-[#977DFF]/20 to-[#0033FF]/20 rounded-xl flex items-center justify-center">
                      <Users size={20} className="text-[#977DFF]" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-gray-900 text-sm sm:text-base">Join a Meeting</h3>
                      <p className="text-xs sm:text-sm text-gray-500">Enter code or paste link</p>
                    </div>
                  </div>
                  <QuickJoinInput onJoin={handleJoin} />
                </div>
              </div>
            </motion.section>

            {/* Features Carousel */}
            <FeaturesCarousel />

            {/* Live Meetings */}
            {activeMeetings.length > 0 && (
              <motion.section
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 }}
                className="mb-8 sm:mb-10"
              >
                <div className="flex items-center justify-between mb-3 sm:mb-4">
                  <h2 className="text-base sm:text-lg font-semibold text-gray-900 flex items-center gap-2">
                    <span className="relative flex h-2 w-2">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#977DFF] opacity-75" />
                      <span className="relative inline-flex rounded-full h-2 w-2 bg-[#0033FF]" />
                    </span>
                    Live Now
                  </h2>
                </div>
                <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
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
                className="mb-8 sm:mb-10"
              >
                <div className="flex items-center justify-between mb-3 sm:mb-4">
                  <h2 className="text-base sm:text-lg font-semibold text-gray-900 flex items-center gap-2">
                    <Calendar size={18} className="text-gray-500" />
                    Upcoming
                  </h2>
                  <button className="text-sm text-[#977DFF] hover:text-[#8B6FFF]">
                    View all
                  </button>
                </div>
                <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
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
                className="mb-8 sm:mb-10"
              >
                <div className="flex items-center justify-between mb-3 sm:mb-4">
                  <h2 className="text-base sm:text-lg font-semibold text-gray-900 flex items-center gap-2">
                    <Clock size={18} className="text-gray-500" />
                    Recent
                  </h2>
                </div>
                <div className="bg-white border border-gray-200 rounded-xl sm:rounded-2xl overflow-hidden shadow-sm">
                  {recentMeetings.map((meeting, index) => (
                    <div
                      key={meeting.id}
                      className={`
                        flex items-center justify-between px-4 sm:px-5 py-3 sm:py-4
                        ${index !== recentMeetings.length - 1 ? 'border-b border-gray-200' : ''}
                        hover:bg-gray-50 transition-colors
                      `}
                    >
                      <div className="flex items-center gap-3 sm:gap-4 min-w-0 flex-1">
                        <div className="w-9 h-9 sm:w-10 sm:h-10 bg-gray-100 rounded-xl flex items-center justify-center flex-shrink-0">
                          <Video size={16} className="text-gray-500 sm:w-[18px] sm:h-[18px]" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <h3 className="font-medium text-gray-900 text-sm sm:text-base truncate">{meeting.title || 'Untitled'}</h3>
                          <p className="text-xs sm:text-sm text-gray-500">
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
                        className="flex-shrink-0 ml-2"
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
                className="text-center py-12 sm:py-16 px-4"
              >
                <div className="w-16 h-16 sm:w-20 sm:h-20 bg-gradient-to-br from-[#FFCCF2]/20 via-[#977DFF]/20 to-[#0033FF]/20 rounded-2xl flex items-center justify-center mx-auto mb-4 sm:mb-6">
                  <Video size={28} className="text-[#977DFF] sm:w-9 sm:h-9" />
                </div>
                <h3 className="text-lg sm:text-xl font-semibold text-gray-900 mb-2">No meetings yet</h3>
                <p className="text-gray-600 mb-6 max-w-md mx-auto text-sm sm:text-base">
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
              <div className="flex items-center justify-center py-12 sm:py-16">
                <div className="w-8 h-8 border-2 border-[#977DFF]/30 border-t-[#977DFF] rounded-full animate-spin" />
              </div>
            )}

            {/* Keyboard Shortcuts Hint - Hidden on mobile */}
            <div className="mt-6 sm:mt-8 text-center text-sm text-gray-500 hidden sm:block">
              Press{' '}
              <kbd className="px-2 py-1 bg-white border border-gray-200 rounded text-gray-600 font-mono text-xs shadow-sm">N</kbd>
              {' '}to start a new meeting
            </div>
          </main>

          {/* Create Meeting Modal */}
          <NewMeetingModal isOpen={isCreateModalOpen} onClose={closeCreateModal} />
        </div>
      </WorkspaceLayout>
    </>
  );
}
