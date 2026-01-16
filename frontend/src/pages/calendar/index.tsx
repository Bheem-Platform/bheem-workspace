import { useEffect, useState } from 'react';
import Head from 'next/head';
import { useHotkeys } from 'react-hotkeys-hook';
import AppSwitcher from '@/components/shared/AppSwitcher';
import CalendarSidebar from '@/components/calendar/CalendarSidebar';
import CalendarHeader from '@/components/calendar/CalendarHeader';
import WeekView from '@/components/calendar/WeekView';
import DayView from '@/components/calendar/DayView';
import MonthView from '@/components/calendar/MonthView';
import EventModal from '@/components/calendar/EventModal';
import TasksPanel from '@/components/calendar/TasksPanel';
import BookingPagesPanel from '@/components/calendar/BookingPagesPanel';
import MeetSection from '@/components/calendar/MeetSection';
import { useCalendarStore } from '@/stores/calendarStore';
import { useCredentialsStore } from '@/stores/credentialsStore';
import { useRequireAuth } from '@/stores/authStore';
import type { CalendarEvent } from '@/types/calendar';
import { Calendar as CalendarIcon, CheckSquare, Link2, Video } from 'lucide-react';

type CalendarTab = 'calendar' | 'tasks' | 'booking';

export default function CalendarPage() {
  const { isAuthenticated: isLoggedIn, isLoading: authLoading } = useRequireAuth();
  // Calendar now uses mail session credentials automatically
  const { isMailAuthenticated } = useCredentialsStore();

  const {
    viewType,
    isEventModalOpen,
    loading,
    error,
    fetchCalendars,
    fetchEvents,
    openEventModal,
    openEditModal,
    closeEventModal,
    navigateDate,
    selectDate,
    clearError,
  } = useCalendarStore();

  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [showMailLoginPrompt, setShowMailLoginPrompt] = useState(false);
  const [activeTab, setActiveTab] = useState<CalendarTab>('calendar');
  const [showMeetPanel, setShowMeetPanel] = useState(false);

  // Fetch calendars and events on mount
  // Always fetch events - Bheem Meet events work without mail auth
  // Personal calendar (Nextcloud) requires mail session
  useEffect(() => {
    if (!authLoading && isLoggedIn) {
      // Always fetch events - Bheem Meet events don't require mail auth
      fetchEvents();

      // Fetch calendars if mail is authenticated
      if (isMailAuthenticated) {
        fetchCalendars();
      }
    }
  }, [authLoading, isLoggedIn, isMailAuthenticated]);

  // Keyboard shortcuts
  useHotkeys('c', () => openEventModal(), { enabled: !isEventModalOpen });
  useHotkeys('t', () => navigateDate('today'), { enabled: !isEventModalOpen });
  useHotkeys('left', () => navigateDate('prev'), { enabled: !isEventModalOpen });
  useHotkeys('right', () => navigateDate('next'), { enabled: !isEventModalOpen });
  useHotkeys('escape', () => closeEventModal(), { enabled: isEventModalOpen });

  const handleEventClick = (event: CalendarEvent) => {
    openEditModal(event);
  };

  const handleTimeSlotClick = (date: Date) => {
    selectDate(date);
    openEventModal({
      start: date.toISOString(),
      end: new Date(date.getTime() + 60 * 60 * 1000).toISOString(),
    });
  };

  const handleDateClick = (date: Date) => {
    selectDate(date);
    openEventModal({
      start: date.toISOString(),
      end: new Date(date.getTime() + 60 * 60 * 1000).toISOString(),
    });
  };

  // Show loading while checking auth
  if (authLoading) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500" />
      </div>
    );
  }

  // Note: We no longer block the calendar if mail is not authenticated
  // Bheem Meet events will show; personal calendar just won't be available

  const renderCalendarView = () => {
    switch (viewType) {
      case 'day':
        return (
          <DayView
            onEventClick={handleEventClick}
            onTimeSlotClick={handleTimeSlotClick}
          />
        );
      case 'week':
        return (
          <WeekView
            onEventClick={handleEventClick}
            onTimeSlotClick={handleTimeSlotClick}
          />
        );
      case 'month':
        return (
          <MonthView
            onEventClick={handleEventClick}
            onDateClick={handleDateClick}
          />
        );
      case 'schedule':
        return (
          <ScheduleView
            onEventClick={handleEventClick}
          />
        );
      default:
        return (
          <WeekView
            onEventClick={handleEventClick}
            onTimeSlotClick={handleTimeSlotClick}
          />
        );
    }
  };

  return (
    <>
      <Head>
        <title>Calendar | Bheem</title>
      </Head>

      <div className="h-screen flex bg-gray-100">
        {/* App Switcher */}
        <AppSwitcher
          activeApp="calendar"
          collapsed={sidebarCollapsed}
          onToggleCollapse={() => setSidebarCollapsed(!sidebarCollapsed)}
        />

        {/* Main Content */}
        <div
          className="flex-1 flex transition-all duration-300"
          style={{ marginLeft: sidebarCollapsed ? 64 : 240 }}
        >
          {/* Calendar Sidebar */}
          <div className="w-64 flex-shrink-0 border-r border-gray-200 flex flex-col">
            {/* Meet Button */}
            <div className="p-4 border-b border-gray-200">
              <button
                onClick={() => setShowMeetPanel(!showMeetPanel)}
                className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-white border-2 border-blue-500 text-blue-600 rounded-xl hover:bg-blue-50 transition-all font-medium"
              >
                <Video size={20} />
                <span>Meet</span>
              </button>
            </div>

            {/* Meet Panel or Calendar Sidebar */}
            {showMeetPanel ? (
              <MeetSection onClose={() => setShowMeetPanel(false)} />
            ) : (
              <CalendarSidebar onCreateEvent={() => openEventModal()} />
            )}
          </div>

          {/* Main Content Area */}
          <div className="flex-1 flex flex-col min-w-0">
            {/* Tabs */}
            <div className="bg-white border-b border-gray-200">
              <div className="flex items-center gap-1 px-4 pt-3">
                <button
                  onClick={() => setActiveTab('calendar')}
                  className={`flex items-center gap-2 px-4 py-2 rounded-t-lg font-medium text-sm transition-colors ${
                    activeTab === 'calendar'
                      ? 'bg-blue-50 text-blue-600 border-b-2 border-blue-600'
                      : 'text-gray-600 hover:bg-gray-50'
                  }`}
                >
                  <CalendarIcon size={18} />
                  <span>Calendar</span>
                </button>
                <button
                  onClick={() => setActiveTab('tasks')}
                  className={`flex items-center gap-2 px-4 py-2 rounded-t-lg font-medium text-sm transition-colors ${
                    activeTab === 'tasks'
                      ? 'bg-blue-50 text-blue-600 border-b-2 border-blue-600'
                      : 'text-gray-600 hover:bg-gray-50'
                  }`}
                >
                  <CheckSquare size={18} />
                  <span>Tasks</span>
                </button>
                <button
                  onClick={() => setActiveTab('booking')}
                  className={`flex items-center gap-2 px-4 py-2 rounded-t-lg font-medium text-sm transition-colors ${
                    activeTab === 'booking'
                      ? 'bg-blue-50 text-blue-600 border-b-2 border-blue-600'
                      : 'text-gray-600 hover:bg-gray-50'
                  }`}
                >
                  <Link2 size={18} />
                  <span>Booking Pages</span>
                </button>
              </div>
            </div>

            {/* Tab Content */}
            {activeTab === 'calendar' && (
              <>
                {/* Header */}
                <CalendarHeader />

                {/* Error Banner */}
                {error && (
                  <div className="px-6 py-3 bg-red-50 border-b border-red-200 flex items-center justify-between">
                    <span className="text-sm text-red-700">{error}</span>
                    <button
                      onClick={clearError}
                      className="text-red-500 hover:text-red-700 text-sm font-medium"
                    >
                      Dismiss
                    </button>
                  </div>
                )}

                {/* Loading Overlay */}
                {(loading.calendars || loading.events) && (
                  <div className="px-6 py-2 bg-blue-50 border-b border-blue-200">
                    <span className="text-sm text-blue-700">Loading...</span>
                  </div>
                )}

                {/* Calendar View */}
                {renderCalendarView()}
              </>
            )}

            {activeTab === 'tasks' && (
              <TasksPanel />
            )}

            {activeTab === 'booking' && (
              <BookingPagesPanel />
            )}
          </div>
        </div>

        {/* Event Modal */}
        <EventModal
          isOpen={isEventModalOpen}
          onClose={closeEventModal}
        />
      </div>
    </>
  );
}

// Schedule View Component
function ScheduleView({ onEventClick }: { onEventClick: (event: CalendarEvent) => void }) {
  const { events, visibleCalendarIds, currentDate } = useCalendarStore();
  const dayjs = require('dayjs');

  // Group events by date - include bheem_meet events even if calendar not selected
  const groupedEvents = events
    .filter((e) =>
      visibleCalendarIds.length === 0 ||
      visibleCalendarIds.includes(e.calendarId) ||
      e.eventSource === 'bheem_meet'
    )
    .filter((e) => dayjs(e.start).isAfter(dayjs(currentDate).startOf('day')))
    .sort((a, b) => new Date(a.start).getTime() - new Date(b.start).getTime())
    .reduce((groups: Record<string, CalendarEvent[]>, event) => {
      const date = dayjs(event.start).format('YYYY-MM-DD');
      if (!groups[date]) groups[date] = [];
      groups[date].push(event);
      return groups;
    }, {});

  const dates = Object.keys(groupedEvents).slice(0, 30);

  if (dates.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center bg-white">
        <div className="text-center">
          <p className="text-gray-500">No upcoming events</p>
          <p className="text-sm text-gray-400 mt-1">Click "Create Event" to add one</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto bg-white p-6">
      {dates.map((date) => (
        <div key={date} className="mb-6">
          <h3 className="text-sm font-semibold text-gray-900 mb-3 sticky top-0 bg-white py-2">
            {dayjs(date).format('dddd, MMMM D')}
          </h3>
          <div className="space-y-2 ml-4">
            {groupedEvents[date].map((event) => (
              <button
                key={event.id}
                onClick={() => onEventClick(event)}
                className="w-full text-left p-3 rounded-lg hover:bg-gray-50 transition-colors flex items-start gap-4"
              >
                <div
                  className="w-1 h-12 rounded-full flex-shrink-0"
                  style={{ backgroundColor: event.color || '#3b82f6' }}
                />
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-gray-900 truncate">{event.title}</p>
                  <p className="text-sm text-gray-500">
                    {event.allDay
                      ? 'All day'
                      : `${dayjs(event.start).format('h:mm A')} - ${dayjs(event.end).format('h:mm A')}`
                    }
                  </p>
                  {event.location && (
                    <p className="text-sm text-gray-400 truncate">{event.location}</p>
                  )}
                </div>
              </button>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

// Mail Login Prompt - Calendar uses mail session credentials
import { Mail, ArrowRight } from 'lucide-react';

function MailLoginPrompt({ onSuccess }: { onSuccess: () => void }) {
  const { isMailAuthenticated, checkMailSession } = useCredentialsStore();

  // Check if user is already logged into mail
  useEffect(() => {
    const checkSession = async () => {
      const isValid = await checkMailSession();
      if (isValid) {
        onSuccess();
      }
    };
    checkSession();
  }, []);

  // Poll for mail session changes
  useEffect(() => {
    const interval = setInterval(async () => {
      const isValid = await checkMailSession();
      if (isValid) {
        onSuccess();
      }
    }, 2000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-gradient-to-br from-blue-500 to-cyan-600">
      <div className="w-full max-w-md mx-4">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-20 h-20 bg-white/20 backdrop-blur-sm rounded-2xl mb-4">
            <CalendarIcon size={40} className="text-white" />
          </div>
          <h1 className="text-3xl font-bold text-white">Bheem Calendar</h1>
          <p className="text-white/80 mt-2">Uses your workspace credentials</p>
        </div>

        {/* Info Card */}
        <div className="bg-white rounded-2xl shadow-2xl p-8">
          <div className="text-center space-y-4">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-blue-50 rounded-full mb-2">
              <Mail size={32} className="text-blue-500" />
            </div>

            <h2 className="text-xl font-semibold text-gray-900">
              Login to Mail First
            </h2>

            <p className="text-gray-600">
              Calendar uses your workspace email credentials. Simply login to Bheem Mail with your workspace email and password, then return here.
            </p>

            <div className="bg-blue-50 rounded-lg p-4 text-left">
              <p className="text-sm text-blue-800 font-medium mb-2">How it works:</p>
              <ol className="text-sm text-blue-700 space-y-1 list-decimal list-inside">
                <li>Go to Bheem Mail</li>
                <li>Login with your workspace credentials</li>
                <li>Come back here - Calendar will work automatically!</li>
              </ol>
            </div>

            <a
              href="/mail"
              className="inline-flex items-center justify-center gap-2 w-full py-3 px-4 bg-gradient-to-r from-blue-500 to-cyan-500 text-white font-medium rounded-lg hover:from-blue-600 hover:to-cyan-600 transition-all"
            >
              Go to Mail
              <ArrowRight size={18} />
            </a>

            <p className="text-xs text-gray-400 mt-4">
              This page will automatically redirect once you're logged in.
            </p>
          </div>
        </div>

        <div className="text-center mt-6">
          <a href="/dashboard" className="text-white/80 hover:text-white text-sm underline">
            ← Back to Dashboard
          </a>
        </div>
      </div>
    </div>
  );
}
