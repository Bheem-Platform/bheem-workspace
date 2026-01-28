import { Plus, Check, User, Briefcase, Globe } from 'lucide-react';
import { useCalendarStore } from '@/stores/calendarStore';
import MiniCalendar from './MiniCalendar';
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

  const handleDateSelect = (date: Date) => {
    selectDate(date);
    goToDate(date);
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
