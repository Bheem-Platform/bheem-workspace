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
import { useCalendarStore } from '@/stores/calendarStore';
import { useCredentialsStore } from '@/stores/credentialsStore';
import { useRequireAuth } from '@/stores/authStore';
import type { CalendarEvent } from '@/types/calendar';

export default function CalendarPage() {
  const { isAuthenticated: isLoggedIn, isLoading: authLoading } = useRequireAuth();
  const { isNextcloudAuthenticated } = useCredentialsStore();

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
  const [showCredentialsPrompt, setShowCredentialsPrompt] = useState(false);

  // Fetch calendars and events on mount
  useEffect(() => {
    if (!authLoading && isLoggedIn) {
      if (!isNextcloudAuthenticated) {
        setShowCredentialsPrompt(true);
      } else {
        fetchCalendars();
        fetchEvents();
      }
    }
  }, [authLoading, isLoggedIn, isNextcloudAuthenticated]);

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

  // Show credentials prompt if not authenticated with Nextcloud
  if (showCredentialsPrompt) {
    return <NextcloudLoginPrompt onSuccess={() => {
      setShowCredentialsPrompt(false);
      fetchCalendars();
      fetchEvents();
    }} />;
  }

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
          <div className="w-64 flex-shrink-0 border-r border-gray-200">
            <CalendarSidebar onCreateEvent={() => openEventModal()} />
          </div>

          {/* Calendar Content */}
          <div className="flex-1 flex flex-col min-w-0">
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

  // Group events by date
  const groupedEvents = events
    .filter((e) => visibleCalendarIds.includes(e.calendarId))
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

// Nextcloud Login Prompt
import { Lock, Cloud } from 'lucide-react';

function NextcloudLoginPrompt({ onSuccess }: { onSuccess: () => void }) {
  const { setNextcloudCredentials } = useCredentialsStore();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      // Store credentials
      setNextcloudCredentials({ username, password });
      onSuccess();
    } catch (err: any) {
      setError('Failed to save credentials');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-gradient-to-br from-blue-500 to-cyan-600">
      <div className="w-full max-w-md mx-4">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-20 h-20 bg-white/20 backdrop-blur-sm rounded-2xl mb-4">
            <Cloud size={40} className="text-white" />
          </div>
          <h1 className="text-3xl font-bold text-white">Bheem Calendar</h1>
          <p className="text-white/80 mt-2">Connect your Nextcloud account</p>
        </div>

        {/* Login Form */}
        <div className="bg-white rounded-2xl shadow-2xl p-8">
          <form onSubmit={handleSubmit} className="space-y-5">
            {error && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
                {error}
              </div>
            )}

            <div>
              <label htmlFor="username" className="block text-sm font-medium text-gray-700 mb-1">
                Username
              </label>
              <input
                id="username"
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="Your Nextcloud username"
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                required
              />
            </div>

            <div>
              <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-1">
                Password
              </label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                <input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Your Nextcloud password"
                  className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  required
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 px-4 bg-gradient-to-r from-blue-500 to-cyan-500 text-white font-medium rounded-lg hover:from-blue-600 hover:to-cyan-600 disabled:opacity-50 transition-all"
            >
              {loading ? 'Connecting...' : 'Connect Calendar'}
            </button>
          </form>

          <p className="mt-6 text-center text-sm text-gray-500">
            Your credentials are stored securely in your browser.
          </p>
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
