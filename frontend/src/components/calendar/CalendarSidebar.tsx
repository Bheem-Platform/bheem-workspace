import { Plus, Check } from 'lucide-react';
import { useCalendarStore } from '@/stores/calendarStore';
import MiniCalendar from './MiniCalendar';

interface CalendarSidebarProps {
  onCreateEvent: () => void;
}

export default function CalendarSidebar({ onCreateEvent }: CalendarSidebarProps) {
  const {
    calendars,
    currentDate,
    selectedDate,
    visibleCalendarIds,
    selectDate,
    goToDate,
    toggleCalendarVisibility,
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
          className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-gradient-to-r from-blue-500 to-cyan-500 text-white rounded-xl hover:from-blue-600 hover:to-cyan-600 transition-all shadow-lg shadow-blue-500/25"
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
          className="w-full text-sm text-blue-600 hover:text-blue-700 font-medium"
        >
          Go to Today
        </button>
      </div>
    </div>
  );
}
