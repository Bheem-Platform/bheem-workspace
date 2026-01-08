import { useMemo, useState, useEffect, useCallback } from 'react';
import dayjs from 'dayjs';
import { DndContext, DragEndEvent, DragOverlay, DragStartEvent } from '@dnd-kit/core';
import { useCalendarStore } from '@/stores/calendarStore';
import { DraggableTimeSlotEvent, DraggableAllDayEvent } from './DraggableEvent';
import DroppableTimeSlot, { DroppableDayColumn } from './DroppableTimeSlot';
import type { CalendarEvent } from '@/types/calendar';

const HOURS = Array.from({ length: 24 }, (_, i) => i);
const HOUR_HEIGHT = 60;

interface DayViewProps {
  onEventClick: (event: CalendarEvent) => void;
  onTimeSlotClick: (date: Date) => void;
}

export default function DayView({ onEventClick, onTimeSlotClick }: DayViewProps) {
  const { currentDate, events, visibleCalendarIds, updateEvent } = useCalendarStore();
  const [activeEvent, setActiveEvent] = useState<CalendarEvent | null>(null);

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

  const handleTimeSlotClick = (hour: number) => {
    const clickedDate = dayjs(currentDate).hour(hour).minute(0).second(0).toDate();
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
            <DroppableDayColumn
              id={`allday-${dayjs(currentDate).format('YYYY-MM-DD')}`}
              date={currentDate}
              className="flex-1 p-1 space-y-1"
            >
              {allDayEvents.map((event) => (
                <DraggableAllDayEvent
                  key={event.id}
                  event={event}
                  onClick={() => onEventClick(event)}
                />
              ))}
            </DroppableDayColumn>
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
                <DroppableTimeSlot
                  key={hour}
                  id={`slot-${dayjs(currentDate).format('YYYY-MM-DD')}-${hour}`}
                  date={currentDate}
                  hour={hour}
                  isToday={isToday}
                  height={HOUR_HEIGHT}
                  onClick={() => handleTimeSlotClick(hour)}
                />
              ))}

              {/* Events with overlap handling */}
              {getEventsWithOverlap(timedEvents).map(({ event, width, left }) => {
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
              width: 200,
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
