import { useMemo } from 'react';
import dayjs from 'dayjs';
import { useCalendarStore } from '@/stores/calendarStore';
import EventCard from './EventCard';
import type { CalendarEvent } from '@/types/calendar';

interface MonthViewProps {
  onEventClick: (event: CalendarEvent) => void;
  onDateClick: (date: Date) => void;
}

export default function MonthView({ onEventClick, onDateClick }: MonthViewProps) {
  const { currentDate, events, visibleCalendarIds } = useCalendarStore();

  const today = dayjs().startOf('day');
  const currentMonth = dayjs(currentDate).month();

  // Generate calendar grid
  const weeks = useMemo(() => {
    const start = dayjs(currentDate).startOf('month').startOf('week');
    const end = dayjs(currentDate).endOf('month').endOf('week');

    const result: Date[][] = [];
    let current = start;

    while (current.isBefore(end) || current.isSame(end, 'day')) {
      const week: Date[] = [];
      for (let i = 0; i < 7; i++) {
        week.push(current.toDate());
        current = current.add(1, 'day');
      }
      result.push(week);
    }

    return result;
  }, [currentDate]);

  // Filter visible events - include bheem_meet events even if calendar not selected
  const visibleEvents = useMemo(() => {
    return events.filter((e) =>
      visibleCalendarIds.length === 0 ||
      visibleCalendarIds.includes(e.calendarId) ||
      e.eventSource === 'bheem_meet'
    );
  }, [events, visibleCalendarIds]);

  // Get events for a specific day
  const getEventsForDay = (date: Date) => {
    const dayStart = dayjs(date).startOf('day');
    const dayEnd = dayjs(date).endOf('day');

    return visibleEvents.filter((event) => {
      const eventStart = dayjs(event.start);
      const eventEnd = dayjs(event.end);
      return eventStart.isBefore(dayEnd) && eventEnd.isAfter(dayStart);
    });
  };

  return (
    <div className="flex-1 flex flex-col overflow-hidden bg-white">
      {/* Day headers */}
      <div className="grid grid-cols-7 border-b border-gray-200 bg-gray-50">
        {['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'].map((day) => (
          <div
            key={day}
            className="py-3 text-center text-xs font-medium text-gray-500 uppercase border-r border-gray-200 last:border-r-0"
          >
            {day}
          </div>
        ))}
      </div>

      {/* Calendar grid */}
      <div className="flex-1 overflow-y-auto">
        {weeks.map((week, weekIndex) => (
          <div
            key={weekIndex}
            className="grid grid-cols-7 border-b border-gray-200"
            style={{ minHeight: 120 }}
          >
            {week.map((date, dayIndex) => {
              const isToday = dayjs(date).isSame(today, 'day');
              const isCurrentMonth = dayjs(date).month() === currentMonth;
              const dayEvents = getEventsForDay(date);

              return (
                <div
                  key={dayIndex}
                  onClick={() => onDateClick(date)}
                  className={`
                    border-r border-gray-200 last:border-r-0 p-2 cursor-pointer
                    ${isCurrentMonth ? 'bg-white' : 'bg-gray-50'}
                    hover:bg-gray-50 transition-colors
                  `}
                >
                  {/* Date number */}
                  <div className="flex justify-end mb-1">
                    <span
                      className={`
                        text-sm font-medium
                        ${isToday
                          ? 'bg-blue-500 text-white w-7 h-7 rounded-full flex items-center justify-center'
                          : isCurrentMonth ? 'text-gray-900' : 'text-gray-400'
                        }
                      `}
                    >
                      {dayjs(date).date()}
                    </span>
                  </div>

                  {/* Events */}
                  <div className="space-y-1">
                    {dayEvents.slice(0, 3).map((event) => (
                      <EventCard
                        key={event.id}
                        event={event}
                        onClick={() => onEventClick(event)}
                        compact
                      />
                    ))}
                    {dayEvents.length > 3 && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          // Could open a modal with all events
                        }}
                        className="text-xs text-gray-500 hover:text-gray-700"
                      >
                        +{dayEvents.length - 3} more
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}
