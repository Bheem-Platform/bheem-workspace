import { useState, useEffect } from 'react';
import { Plus, Check, User, Briefcase, Globe, Clock, Focus, Target, ChevronDown, ChevronUp, X, Settings } from 'lucide-react';
import { useCalendarStore } from '@/stores/calendarStore';
import MiniCalendar from './MiniCalendar';
import { worldClockApi, focusTimeApi, WorldClockCity, FocusBlock } from '@/lib/calendarEnhancedApi';
import type { EventSource } from '@/types/calendar';

interface CalendarSidebarProps {
  onCreateEvent: () => void;
}

export default function CalendarSidebar({ onCreateEvent }: CalendarSidebarProps) {
  const {
    calendars,
    currentDate,
    selectedDate,
    visibleCalendarIds,
    sourceFilter,
    selectDate,
    goToDate,
    toggleCalendarVisibility,
    setSourceFilter,
  } = useCalendarStore();

  // World Clock state
  const [worldClockCities, setWorldClockCities] = useState<WorldClockCity[]>([]);
  const [showWorldClock, setShowWorldClock] = useState(true);
  const [loadingWorldClock, setLoadingWorldClock] = useState(false);

  // Focus Time state
  const [focusBlocks, setFocusBlocks] = useState<FocusBlock[]>([]);
  const [showFocusTime, setShowFocusTime] = useState(true);
  const [loadingFocusTime, setLoadingFocusTime] = useState(false);

  // Fetch world clock and focus blocks on mount
  useEffect(() => {
    fetchWorldClock();
    fetchFocusBlocks();
  }, []);

  const fetchWorldClock = async () => {
    setLoadingWorldClock(true);
    try {
      const cities = await worldClockApi.getWorldClock();
      setWorldClockCities(cities);
    } catch (error) {
      console.error('Failed to fetch world clock:', error);
      // Set some default cities for demo
      setWorldClockCities([
        { city: 'Local', timezone: Intl.DateTimeFormat().resolvedOptions().timeZone, offset: '', current_time: new Date().toLocaleTimeString(), is_dst: false },
      ]);
    } finally {
      setLoadingWorldClock(false);
    }
  };

  const fetchFocusBlocks = async () => {
    setLoadingFocusTime(true);
    try {
      const blocks = await focusTimeApi.listBlocks();
      setFocusBlocks(blocks);
    } catch (error) {
      console.error('Failed to fetch focus blocks:', error);
    } finally {
      setLoadingFocusTime(false);
    }
  };

  const handleDateSelect = (date: Date) => {
    selectDate(date);
    goToDate(date);
  };

  // Format time for world clock display
  const formatWorldClockTime = (timezone: string) => {
    try {
      return new Date().toLocaleTimeString('en-US', {
        timeZone: timezone,
        hour: '2-digit',
        minute: '2-digit',
        hour12: true
      });
    } catch {
      return '--:--';
    }
  };

  // Get day of week name
  const getDayName = (dayNum: number) => {
    const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    return days[dayNum];
  };

  return (
    <div className="h-full flex flex-col bg-white">
      {/* Create Event Button */}
      <div className="p-4">
        <button
          onClick={onCreateEvent}
          className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-gradient-to-r from-[#FFCCF2] via-[#977DFF] to-[#0033FF] text-white rounded-xl hover:opacity-90 transition-all shadow-lg shadow-[#977DFF]/25"
        >
          <Plus size={20} />
          <span className="font-medium">Create Event</span>
        </button>
      </div>

      {/* Mini Calendar */}
      <div className="border-b border-gray-200">
        <MiniCalendar
          currentDate={currentDate}
          selectedDate={selectedDate}
          onDateSelect={handleDateSelect}
          onMonthChange={goToDate}
        />
      </div>

      {/* Event Sources Filter */}
      <div className="p-4 border-b border-gray-200">
        <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">
          Show Events
        </h3>
        <div className="space-y-1">
          {/* All Sources */}
          <button
            onClick={() => setSourceFilter(null)}
            className={`w-full flex items-center gap-3 px-2 py-2 rounded-lg transition-colors ${
              sourceFilter === null ? 'bg-gray-100' : 'hover:bg-gray-50'
            }`}
          >
            <div className={`w-5 h-5 rounded flex items-center justify-center ${
              sourceFilter === null ? 'bg-gray-700' : 'border-2 border-gray-300'
            }`}>
              {sourceFilter === null && <Check size={12} className="text-white" />}
            </div>
            <Globe size={16} className="text-gray-500" />
            <span className="text-sm text-gray-700">All Events</span>
          </button>

          {/* Personal Events */}
          <button
            onClick={() => setSourceFilter('personal')}
            className={`w-full flex items-center gap-3 px-2 py-2 rounded-lg transition-colors ${
              sourceFilter === 'personal' ? 'bg-[#FFCCF2]/20' : 'hover:bg-gray-50'
            }`}
          >
            <div className={`w-5 h-5 rounded flex items-center justify-center ${
              sourceFilter === 'personal' ? 'bg-[#977DFF]' : 'border-2 border-gray-300'
            }`}>
              {sourceFilter === 'personal' && <Check size={12} className="text-white" />}
            </div>
            <User size={16} className="text-[#977DFF]" />
            <span className="text-sm text-gray-700">Personal</span>
          </button>

          {/* Project Events */}
          <button
            onClick={() => setSourceFilter('project')}
            className={`w-full flex items-center gap-3 px-2 py-2 rounded-lg transition-colors ${
              sourceFilter === 'project' ? 'bg-green-50' : 'hover:bg-gray-50'
            }`}
          >
            <div className={`w-5 h-5 rounded flex items-center justify-center ${
              sourceFilter === 'project' ? 'bg-green-500' : 'border-2 border-gray-300'
            }`}>
              {sourceFilter === 'project' && <Check size={12} className="text-white" />}
            </div>
            <Briefcase size={16} className="text-green-500" />
            <span className="text-sm text-gray-700">Project</span>
          </button>
        </div>
      </div>

      {/* My Calendars */}
      <div className="flex-1 overflow-y-auto p-4">
        <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">
          My Calendars
        </h3>
        <div className="space-y-1">
          {calendars.map((calendar) => {
            const isVisible = visibleCalendarIds.includes(calendar.id);
            return (
              <button
                key={calendar.id}
                onClick={() => toggleCalendarVisibility(calendar.id)}
                className="w-full flex items-center gap-3 px-2 py-2 rounded-lg hover:bg-gray-50 transition-colors"
              >
                <div
                  className={`
                    w-5 h-5 rounded flex items-center justify-center border-2 transition-colors
                    ${isVisible ? 'border-transparent' : 'border-gray-300'}
                  `}
                  style={{
                    backgroundColor: isVisible ? calendar.color : 'transparent',
                  }}
                >
                  {isVisible && <Check size={12} className="text-white" />}
                </div>
                <span className="text-sm text-gray-700 truncate">
                  {calendar.name}
                </span>
              </button>
            );
          })}
        </div>

        {calendars.length === 0 && (
          <p className="text-sm text-gray-500 text-center py-4">
            No calendars found
          </p>
        )}
      </div>

      {/* World Clock Section */}
      <div className="border-t border-gray-200">
        <button
          onClick={() => setShowWorldClock(!showWorldClock)}
          className="w-full flex items-center justify-between px-4 py-3 hover:bg-gray-50"
        >
          <div className="flex items-center gap-2">
            <Globe size={16} className="text-gray-500" />
            <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">World Clock</span>
          </div>
          {showWorldClock ? <ChevronUp size={16} className="text-gray-400" /> : <ChevronDown size={16} className="text-gray-400" />}
        </button>
        {showWorldClock && (
          <div className="px-4 pb-3 space-y-2">
            {loadingWorldClock ? (
              <p className="text-xs text-gray-400">Loading...</p>
            ) : worldClockCities.length > 0 ? (
              worldClockCities.map((city, idx) => (
                <div key={idx} className="flex items-center justify-between py-1.5 px-2 bg-gray-50 rounded-lg">
                  <div>
                    <p className="text-sm font-medium text-gray-700">{city.city}</p>
                    <p className="text-xs text-gray-400">{city.timezone.split('/').pop()?.replace('_', ' ')}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-mono font-medium text-gray-900">
                      {formatWorldClockTime(city.timezone)}
                    </p>
                    <p className="text-xs text-gray-400">{city.offset}</p>
                  </div>
                </div>
              ))
            ) : (
              <div className="text-center py-2">
                <p className="text-xs text-gray-400 mb-2">No cities added</p>
                <button className="text-xs text-[#977DFF] hover:underline">Add cities</button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Focus Time Section */}
      <div className="border-t border-gray-200">
        <button
          onClick={() => setShowFocusTime(!showFocusTime)}
          className="w-full flex items-center justify-between px-4 py-3 hover:bg-gray-50"
        >
          <div className="flex items-center gap-2">
            <Target size={16} className="text-orange-500" />
            <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Focus Time</span>
          </div>
          {showFocusTime ? <ChevronUp size={16} className="text-gray-400" /> : <ChevronDown size={16} className="text-gray-400" />}
        </button>
        {showFocusTime && (
          <div className="px-4 pb-3 space-y-2">
            {loadingFocusTime ? (
              <p className="text-xs text-gray-400">Loading...</p>
            ) : focusBlocks.length > 0 ? (
              <>
                {focusBlocks.slice(0, 3).map((block) => (
                  <div
                    key={block.id}
                    className="flex items-center gap-2 py-1.5 px-2 rounded-lg"
                    style={{ backgroundColor: `${block.color}15` }}
                  >
                    <div
                      className="w-2 h-2 rounded-full"
                      style={{ backgroundColor: block.color }}
                    />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-700 truncate">{block.title}</p>
                      <p className="text-xs text-gray-500">
                        {getDayName(block.day_of_week)} {block.start_time} - {block.end_time}
                      </p>
                    </div>
                  </div>
                ))}
                {focusBlocks.length > 3 && (
                  <p className="text-xs text-gray-400 text-center">+{focusBlocks.length - 3} more blocks</p>
                )}
              </>
            ) : (
              <div className="text-center py-2">
                <p className="text-xs text-gray-400 mb-2">No focus time scheduled</p>
                <button className="text-xs text-orange-500 hover:underline">Schedule focus time</button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Quick Links */}
      <div className="border-t border-gray-200 p-4">
        <button
          onClick={() => goToDate(new Date())}
          className="w-full text-sm text-[#977DFF] hover:text-[#0033FF] font-medium"
        >
          Go to Today
        </button>
      </div>
    </div>
  );
}
