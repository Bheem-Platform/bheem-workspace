import { useMemo, useState, useEffect, useCallback } from 'react';
import dayjs from 'dayjs';
import { DndContext, DragEndEvent, DragOverlay, DragStartEvent } from '@dnd-kit/core';
import { useCalendarStore } from '@/stores/calendarStore';
import { DraggableTimeSlotEvent, DraggableAllDayEvent } from './DraggableEvent';
import DroppableTimeSlot, { DroppableDayColumn } from './DroppableTimeSlot';
import type { CalendarEvent } from '@/types/calendar';

const HOURS = Array.from({ length: 24 }, (_, i) => i);
const HOUR_HEIGHT = 60; // pixels per hour

interface WeekViewProps {
  onEventClick: (event: CalendarEvent) => void;
  onTimeSlotClick: (date: Date) => void;
}

export default function WeekView({ onEventClick, onTimeSlotClick }: WeekViewProps) {
  const { currentDate, events, visibleCalendarIds, updateEvent } = useCalendarStore();
  const [activeEvent, setActiveEvent] = useState<CalendarEvent | null>(null);

  const weekDays = useMemo(() => {
    const start = dayjs(currentDate).startOf('week');
    return Array.from({ length: 7 }, (_, i) => start.add(i, 'day').toDate());
  }, [currentDate]);

  const today = dayjs().startOf('day');

  // Filter visible events - include bheem_meet events even if calendar not selected
  const visibleEvents = useMemo(() => {
    return events.filter((e) =>
      visibleCalendarIds.length === 0 ||
      visibleCalendarIds.includes(e.calendarId) ||
      e.eventSource === 'bheem_meet'
    );
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

  // Calculate overlapping events and their positions
  const getEventsWithOverlap = (dayEvents: CalendarEvent[]) => {
    if (dayEvents.length === 0) return [];

    // Sort events by start time
    const sortedEvents = [...dayEvents].sort((a, b) =>
      dayjs(a.start).valueOf() - dayjs(b.start).valueOf()
    );

    // Find overlapping groups
    const groups: CalendarEvent[][] = [];
    let currentGroup: CalendarEvent[] = [];
    let currentGroupEnd = dayjs(0);

    sortedEvents.forEach((event) => {
      const eventStart = dayjs(event.start);
      const eventEnd = dayjs(event.end);

      if (currentGroup.length === 0 || eventStart.isBefore(currentGroupEnd)) {
        // Event overlaps with current group
        currentGroup.push(event);
        if (eventEnd.isAfter(currentGroupEnd)) {
          currentGroupEnd = eventEnd;
        }
      } else {
        // Start new group
        if (currentGroup.length > 0) {
          groups.push(currentGroup);
        }
        currentGroup = [event];
        currentGroupEnd = eventEnd;
      }
    });

    if (currentGroup.length > 0) {
      groups.push(currentGroup);
    }

    // Calculate width and left position for each event
    const eventsWithPosition: { event: CalendarEvent; width: number; left: number }[] = [];

    groups.forEach((group) => {
      const groupSize = group.length;
      group.forEach((event, index) => {
        eventsWithPosition.push({
          event,
          width: 100 / groupSize,
          left: (100 / groupSize) * index,
        });
      });
    });

    return eventsWithPosition;
  };

  const handleTimeSlotClick = (date: Date, hour: number) => {
    const clickedDate = dayjs(date).hour(hour).minute(0).second(0).toDate();
    onTimeSlotClick(clickedDate);
  };

  // Drag and drop handlers
  const handleDragStart = useCallback((event: DragStartEvent) => {
    const { active } = event;
    const draggedEvent = active.data.current?.event as CalendarEvent | undefined;
    if (draggedEvent) {
      setActiveEvent(draggedEvent);
    }
  }, []);

  const handleDragEnd = useCallback(async (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveEvent(null);

    if (!over) return;

    const draggedEvent = active.data.current?.event as CalendarEvent | undefined;
    const dropData = over.data.current;

    if (!draggedEvent || !dropData) return;

    // Calculate new times based on drop location
    const eventStart = dayjs(draggedEvent.start);
    const eventEnd = dayjs(draggedEvent.end);
    const duration = eventEnd.diff(eventStart, 'minute');

    let newStart: dayjs.Dayjs;
    let newEnd: dayjs.Dayjs;

    if (dropData.type === 'time-slot') {
      // Dropped on a time slot
      const dropDate = dropData.date as Date;
      const dropHour = dropData.hour as number;
      newStart = dayjs(dropDate).hour(dropHour).minute(0).second(0);
      newEnd = newStart.add(duration, 'minute');
    } else if (dropData.type === 'day-column') {
      // Dropped on a day column (all-day area)
      const dropDate = dropData.date as Date;
      newStart = dayjs(dropDate).hour(eventStart.hour()).minute(eventStart.minute());
      newEnd = newStart.add(duration, 'minute');
    } else {
      return;
    }

    // Only update if the time actually changed
    if (!newStart.isSame(eventStart) || !newEnd.isSame(eventEnd)) {
      await updateEvent(draggedEvent.uid, {
        start: newStart.toISOString(),
        end: newEnd.toISOString(),
      });
    }
  }, [updateEvent]);

  return (
    <DndContext onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
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
                <DroppableDayColumn
                  key={i}
                  id={`allday-${dayjs(date).format('YYYY-MM-DD')}`}
                  date={date}
                  className="flex-1 min-w-[120px] border-r border-gray-200 last:border-r-0 p-1 space-y-1"
                >
                  {dayEvents.slice(0, 2).map((event) => (
                    <DraggableAllDayEvent
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
                </DroppableDayColumn>
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
                    <DroppableTimeSlot
                      key={hour}
                      id={`slot-${dayjs(date).format('YYYY-MM-DD')}-${hour}`}
                      date={date}
                      hour={hour}
                      isToday={isToday}
                      height={HOUR_HEIGHT}
                      onClick={() => handleTimeSlotClick(date, hour)}
                    />
                  ))}

                  {/* Events with overlap handling */}
                  {getEventsWithOverlap(dayEvents).map(({ event, width, left }) => {
                    const { top, height } = getEventStyle(event);
                    return (
                      <DraggableTimeSlotEvent
                        key={event.id}
                        event={event}
                        onClick={() => onEventClick(event)}
                        style={{
                          top,
                          height,
                          minHeight: 20,
                          width: `calc(${width}% - 4px)`,
                          left: `calc(${left}% + 2px)`,
                        }}
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

      {/* Drag overlay for smooth dragging */}
      <DragOverlay>
        {activeEvent ? (
          <div
            className="rounded-lg p-2 text-left overflow-hidden shadow-xl opacity-90"
            style={{
              backgroundColor: activeEvent.color || '#3b82f6',
              width: 150,
            }}
          >
            <p className="text-xs font-medium text-white truncate">{activeEvent.title}</p>
            <p className="text-xs text-white/80">
              {dayjs(activeEvent.start).format('h:mm A')}
            </p>
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}

function CurrentTimeIndicator() {
  const [currentTime, setCurrentTime] = useState(dayjs());

  useEffect(() => {
    // Update every minute
    const interval = setInterval(() => {
      setCurrentTime(dayjs());
    }, 60000);

    return () => clearInterval(interval);
  }, []);

  const minutes = currentTime.hour() * 60 + currentTime.minute();
  const top = (minutes / 60) * HOUR_HEIGHT;

  return (
    <div
      className="absolute left-0 right-0 z-20 pointer-events-none"
      style={{ top }}
    >
      <div className="flex items-center">
        <div className="w-3 h-3 bg-red-500 rounded-full -ml-1.5 shadow-sm" />
        <div className="flex-1 h-0.5 bg-red-500 shadow-sm" />
      </div>
    </div>
  );
}
