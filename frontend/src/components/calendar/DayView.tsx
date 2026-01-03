import { useMemo } from 'react';
import dayjs from 'dayjs';
import { useCalendarStore } from '@/stores/calendarStore';
import { TimeSlotEvent, AllDayEvent } from './EventCard';
import type { CalendarEvent } from '@/types/calendar';

const HOURS = Array.from({ length: 24 }, (_, i) => i);
const HOUR_HEIGHT = 60;

interface DayViewProps {
  onEventClick: (event: CalendarEvent) => void;
  onTimeSlotClick: (date: Date) => void;
}

export default function DayView({ onEventClick, onTimeSlotClick }: DayViewProps) {
  const { currentDate, events, visibleCalendarIds } = useCalendarStore();

  const today = dayjs().startOf('day');
  const isToday = dayjs(currentDate).isSame(today, 'day');

  // Filter visible events for the current day
  const { allDayEvents, timedEvents } = useMemo(() => {
    const dayStart = dayjs(currentDate).startOf('day');
    const dayEnd = dayjs(currentDate).endOf('day');

    const allDay: CalendarEvent[] = [];
    const timed: CalendarEvent[] = [];

    events
      .filter((e) => visibleCalendarIds.includes(e.calendarId))
      .forEach((event) => {
        const eventStart = dayjs(event.start);
        const eventEnd = dayjs(event.end);

        if (eventStart.isBefore(dayEnd) && eventEnd.isAfter(dayStart)) {
          if (event.allDay) {
            allDay.push(event);
          } else {
            timed.push(event);
          }
        }
      });

    return { allDayEvents: allDay, timedEvents: timed };
  }, [currentDate, events, visibleCalendarIds]);

  const getEventStyle = (event: CalendarEvent) => {
    const start = dayjs(event.start);
    const end = dayjs(event.end);

    const startMinutes = start.hour() * 60 + start.minute();
    const endMinutes = end.hour() * 60 + end.minute();
    const durationMinutes = endMinutes - startMinutes;

    const top = (startMinutes / 60) * HOUR_HEIGHT;
    const height = Math.max((durationMinutes / 60) * HOUR_HEIGHT, 20);

    return { top, height };
  };

  const handleTimeSlotClick = (hour: number) => {
    const clickedDate = dayjs(currentDate).hour(hour).minute(0).second(0).toDate();
    onTimeSlotClick(clickedDate);
  };

  return (
    <div className="flex-1 flex flex-col overflow-hidden bg-white">
      {/* Header */}
      <div className="flex border-b border-gray-200 bg-gray-50">
        <div className="w-16 flex-shrink-0 border-r border-gray-200" />
        <div className="flex-1 py-3 text-center">
          <p className="text-xs font-medium text-gray-500 uppercase">
            {dayjs(currentDate).format('dddd')}
          </p>
          <p
            className={`
              text-2xl font-semibold mt-1
              ${isToday ? 'text-white bg-blue-500 w-10 h-10 rounded-full mx-auto flex items-center justify-center' : 'text-gray-900'}
            `}
          >
            {dayjs(currentDate).date()}
          </p>
        </div>
      </div>

      {/* All-day events */}
      {allDayEvents.length > 0 && (
        <div className="flex border-b border-gray-200">
          <div className="w-16 flex-shrink-0 border-r border-gray-200 py-2 px-2">
            <span className="text-xs text-gray-500">All day</span>
          </div>
          <div className="flex-1 p-1 space-y-1">
            {allDayEvents.map((event) => (
              <AllDayEvent
                key={event.id}
                event={event}
                onClick={() => onEventClick(event)}
              />
            ))}
          </div>
        </div>
      )}

      {/* Time grid */}
      <div className="flex-1 overflow-y-auto">
        <div className="flex">
          {/* Time labels */}
          <div className="w-16 flex-shrink-0 border-r border-gray-200">
            {HOURS.map((hour) => (
              <div
                key={hour}
                className="relative"
                style={{ height: HOUR_HEIGHT }}
              >
                <span className="absolute -top-2 right-2 text-xs text-gray-500">
                  {hour === 0 ? '' : dayjs().hour(hour).format('h A')}
                </span>
              </div>
            ))}
          </div>

          {/* Day column */}
          <div className="flex-1 relative">
            {/* Hour slots */}
            {HOURS.map((hour) => (
              <div
                key={hour}
                onClick={() => handleTimeSlotClick(hour)}
                className={`
                  border-b border-gray-100 cursor-pointer
                  ${isToday ? 'bg-blue-50/30' : 'hover:bg-gray-50'}
                `}
                style={{ height: HOUR_HEIGHT }}
              />
            ))}

            {/* Events */}
            {timedEvents.map((event) => {
              const { top, height } = getEventStyle(event);
              return (
                <TimeSlotEvent
                  key={event.id}
                  event={event}
                  onClick={() => onEventClick(event)}
                  style={{ top, height, minHeight: 20 }}
                />
              );
            })}

            {/* Current time indicator */}
            {isToday && <CurrentTimeIndicator />}
          </div>
        </div>
      </div>
    </div>
  );
}

function CurrentTimeIndicator() {
  const now = dayjs();
  const minutes = now.hour() * 60 + now.minute();
  const top = (minutes / 60) * HOUR_HEIGHT;

  return (
    <div
      className="absolute left-0 right-0 z-20 pointer-events-none"
      style={{ top }}
    >
      <div className="flex items-center">
        <div className="w-2 h-2 bg-red-500 rounded-full -ml-1" />
        <div className="flex-1 h-0.5 bg-red-500" />
      </div>
    </div>
  );
}
