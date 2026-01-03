import { useMemo } from 'react';
import dayjs from 'dayjs';
import { useCalendarStore } from '@/stores/calendarStore';
import { TimeSlotEvent, AllDayEvent } from './EventCard';
import type { CalendarEvent } from '@/types/calendar';

const HOURS = Array.from({ length: 24 }, (_, i) => i);
const HOUR_HEIGHT = 60; // pixels per hour

interface WeekViewProps {
  onEventClick: (event: CalendarEvent) => void;
  onTimeSlotClick: (date: Date) => void;
}

export default function WeekView({ onEventClick, onTimeSlotClick }: WeekViewProps) {
  const { currentDate, events, visibleCalendarIds } = useCalendarStore();

  const weekDays = useMemo(() => {
    const start = dayjs(currentDate).startOf('week');
    return Array.from({ length: 7 }, (_, i) => start.add(i, 'day').toDate());
  }, [currentDate]);

  const today = dayjs().startOf('day');

  // Filter visible events
  const visibleEvents = useMemo(() => {
    return events.filter((e) => visibleCalendarIds.includes(e.calendarId));
  }, [events, visibleCalendarIds]);

  // Separate all-day events from timed events
  const { allDayEvents, timedEvents } = useMemo(() => {
    const allDay: CalendarEvent[] = [];
    const timed: CalendarEvent[] = [];

    visibleEvents.forEach((event) => {
      if (event.allDay) {
        allDay.push(event);
      } else {
        timed.push(event);
      }
    });

    return { allDayEvents: allDay, timedEvents: timed };
  }, [visibleEvents]);

  // Get events for a specific day
  const getEventsForDay = (date: Date, eventList: CalendarEvent[]) => {
    return eventList.filter((event) => {
      const eventStart = dayjs(event.start).startOf('day');
      const eventEnd = dayjs(event.end).startOf('day');
      const checkDate = dayjs(date).startOf('day');
      return checkDate.isSame(eventStart, 'day') ||
             (checkDate.isAfter(eventStart) && checkDate.isBefore(eventEnd)) ||
             checkDate.isSame(eventEnd, 'day');
    });
  };

  // Calculate event position and height
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

  const handleTimeSlotClick = (date: Date, hour: number) => {
    const clickedDate = dayjs(date).hour(hour).minute(0).second(0).toDate();
    onTimeSlotClick(clickedDate);
  };

  return (
    <div className="flex-1 flex flex-col overflow-hidden bg-white">
      {/* Header with day names */}
      <div className="flex border-b border-gray-200 bg-gray-50">
        {/* Time column spacer */}
        <div className="w-16 flex-shrink-0 border-r border-gray-200" />

        {/* Day columns */}
        {weekDays.map((date, i) => {
          const isToday = dayjs(date).isSame(today, 'day');
          return (
            <div
              key={i}
              className="flex-1 min-w-[120px] border-r border-gray-200 last:border-r-0"
            >
              <div className="py-3 text-center">
                <p className="text-xs font-medium text-gray-500 uppercase">
                  {dayjs(date).format('ddd')}
                </p>
                <p
                  className={`
                    text-2xl font-semibold mt-1
                    ${isToday ? 'text-white bg-blue-500 w-10 h-10 rounded-full mx-auto flex items-center justify-center' : 'text-gray-900'}
                  `}
                >
                  {dayjs(date).date()}
                </p>
              </div>
            </div>
          );
        })}
      </div>

      {/* All-day events section */}
      {allDayEvents.length > 0 && (
        <div className="flex border-b border-gray-200">
          <div className="w-16 flex-shrink-0 border-r border-gray-200 py-2 px-2">
            <span className="text-xs text-gray-500">All day</span>
          </div>
          {weekDays.map((date, i) => {
            const dayEvents = getEventsForDay(date, allDayEvents);
            return (
              <div
                key={i}
                className="flex-1 min-w-[120px] border-r border-gray-200 last:border-r-0 p-1 space-y-1"
              >
                {dayEvents.slice(0, 2).map((event) => (
                  <AllDayEvent
                    key={event.id}
                    event={event}
                    onClick={() => onEventClick(event)}
                  />
                ))}
                {dayEvents.length > 2 && (
                  <p className="text-xs text-gray-500 text-center">
                    +{dayEvents.length - 2} more
                  </p>
                )}
              </div>
            );
          })}
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

          {/* Day columns with events */}
          {weekDays.map((date, dayIndex) => {
            const dayEvents = getEventsForDay(date, timedEvents);
            const isToday = dayjs(date).isSame(today, 'day');

            return (
              <div
                key={dayIndex}
                className="flex-1 min-w-[120px] border-r border-gray-200 last:border-r-0 relative"
              >
                {/* Hour slots */}
                {HOURS.map((hour) => (
                  <div
                    key={hour}
                    onClick={() => handleTimeSlotClick(date, hour)}
                    className={`
                      border-b border-gray-100 cursor-pointer
                      ${isToday ? 'bg-blue-50/30' : 'hover:bg-gray-50'}
                    `}
                    style={{ height: HOUR_HEIGHT }}
                  />
                ))}

                {/* Events */}
                {dayEvents.map((event) => {
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
            );
          })}
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
