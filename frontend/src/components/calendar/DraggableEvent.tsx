import { useDraggable } from '@dnd-kit/core';
import { CSS } from '@dnd-kit/utilities';
import dayjs from 'dayjs';
import type { CalendarEvent } from '@/types/calendar';

interface DraggableEventProps {
  event: CalendarEvent;
  onClick: () => void;
  style?: React.CSSProperties;
  children?: React.ReactNode;
}

export default function DraggableEvent({
  event,
  onClick,
  style,
  children,
}: DraggableEventProps) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: event.id,
    data: {
      event,
      type: 'event',
    },
  });

  const dragStyle: React.CSSProperties = {
    ...style,
    transform: CSS.Translate.toString(transform),
    opacity: isDragging ? 0.7 : 1,
    cursor: isDragging ? 'grabbing' : 'grab',
    zIndex: isDragging ? 1000 : style?.zIndex || 10,
  };

  const handleClick = (e: React.MouseEvent) => {
    // Only trigger click if not dragging
    if (!isDragging) {
      onClick();
    }
  };

  return (
    <div
      ref={setNodeRef}
      style={dragStyle}
      {...listeners}
      {...attributes}
      onClick={handleClick}
      className="touch-none"
    >
      {children}
    </div>
  );
}

// Draggable time slot event for week/day view
interface DraggableTimeSlotEventProps {
  event: CalendarEvent;
  onClick: () => void;
  style?: React.CSSProperties;
}

export function DraggableTimeSlotEvent({
  event,
  onClick,
  style,
}: DraggableTimeSlotEventProps) {
  const startTime = dayjs(event.start).format('h:mm A');

  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: event.id,
    data: {
      event,
      type: 'timed-event',
    },
  });

  const dragStyle: React.CSSProperties = {
    position: 'absolute',
    backgroundColor: event.color || '#3b82f6',
    width: 'calc(100% - 4px)',
    left: '2px',
    ...style,
    transform: CSS.Translate.toString(transform),
    opacity: isDragging ? 0.7 : 1,
    cursor: isDragging ? 'grabbing' : 'grab',
    zIndex: isDragging ? 1000 : 10,
  };

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!isDragging) {
      onClick();
    }
  };

  return (
    <div
      ref={setNodeRef}
      style={dragStyle}
      {...listeners}
      {...attributes}
      onClick={handleClick}
      className="rounded-lg p-2 text-left overflow-hidden transition-shadow hover:shadow-lg touch-none select-none"
    >
      <p className="text-xs font-medium text-white truncate">{event.title}</p>
      <p className="text-xs text-white/80">{startTime}</p>
    </div>
  );
}

// Draggable all-day event bar
interface DraggableAllDayEventProps {
  event: CalendarEvent;
  onClick: () => void;
}

export function DraggableAllDayEvent({ event, onClick }: DraggableAllDayEventProps) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: `allday-${event.id}`,
    data: {
      event,
      type: 'all-day-event',
    },
  });

  const dragStyle: React.CSSProperties = {
    backgroundColor: event.color || '#3b82f6',
    transform: CSS.Translate.toString(transform),
    opacity: isDragging ? 0.7 : 1,
    cursor: isDragging ? 'grabbing' : 'grab',
  };

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!isDragging) {
      onClick();
    }
  };

  return (
    <div
      ref={setNodeRef}
      style={dragStyle}
      {...listeners}
      {...attributes}
      onClick={handleClick}
      className="w-full px-2 py-1 rounded text-xs font-medium text-white truncate transition-opacity hover:opacity-80 touch-none select-none"
    >
      {event.title}
    </div>
  );
}
