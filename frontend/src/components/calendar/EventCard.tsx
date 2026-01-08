import dayjs from 'dayjs';
import { MapPin, Users } from 'lucide-react';
import type { CalendarEvent } from '@/types/calendar';

interface EventCardProps {
  event: CalendarEvent;
  onClick: () => void;
  compact?: boolean;
}

export default function EventCard({ event, onClick, compact = false }: EventCardProps) {
  const startTime = dayjs(event.start).format('h:mm A');
  const endTime = dayjs(event.end).format('h:mm A');

  if (compact) {
    return (
      <button
        onClick={onClick}
        className="w-full text-left px-2 py-1 rounded text-xs font-medium truncate transition-opacity hover:opacity-80"
        style={{
          backgroundColor: event.color || '#3b82f6',
          color: '#ffffff',
        }}
      >
        {event.title}
      </button>
    );
  }

  return (
    <button
      onClick={onClick}
      className="w-full text-left p-2 rounded-lg transition-all hover:shadow-md group"
      style={{
        backgroundColor: `${event.color || '#3b82f6'}15`,
        borderLeft: `3px solid ${event.color || '#3b82f6'}`,
      }}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <p
            className="text-sm font-medium truncate"
            style={{ color: event.color || '#3b82f6' }}
          >
            {event.title}
          </p>
          <p className="text-xs text-gray-500 mt-0.5">
            {event.allDay ? 'All day' : `${startTime} - ${endTime}`}
          </p>
        </div>
      </div>

      {(event.location || (event.attendees && event.attendees.length > 0)) && (
        <div className="mt-2 space-y-1">
          {event.location && (
            <div className="flex items-center gap-1 text-xs text-gray-500">
              <MapPin size={10} />
              <span className="truncate">{event.location}</span>
            </div>
          )}
          {event.attendees && event.attendees.length > 0 && (
            <div className="flex items-center gap-1 text-xs text-gray-500">
              <Users size={10} />
              <span>{event.attendees.length} attendees</span>
            </div>
          )}
        </div>
      )}
    </button>
  );
}

// For displaying events in the week view time grid
interface TimeSlotEventProps {
  event: CalendarEvent;
  onClick: () => void;
  style?: React.CSSProperties;
}

export function TimeSlotEvent({ event, onClick, style }: TimeSlotEventProps) {
  const startTime = dayjs(event.start).format('h:mm A');

  return (
    <button
      onClick={onClick}
      className="absolute rounded-lg p-2 text-left overflow-hidden transition-all hover:shadow-lg hover:z-20 z-10"
      style={{
        backgroundColor: event.color || '#3b82f6',
        // Default width/left if not provided in style
        width: 'calc(100% - 4px)',
        left: '2px',
        ...style,
      }}
    >
      <p className="text-xs font-medium text-white truncate">{event.title}</p>
      <p className="text-xs text-white/80">{startTime}</p>
    </button>
  );
}

// All-day event bar
interface AllDayEventProps {
  event: CalendarEvent;
  onClick: () => void;
}

export function AllDayEvent({ event, onClick }: AllDayEventProps) {
  return (
    <button
      onClick={onClick}
      className="w-full px-2 py-1 rounded text-xs font-medium text-white truncate transition-opacity hover:opacity-80"
      style={{
        backgroundColor: event.color || '#3b82f6',
      }}
    >
      {event.title}
    </button>
  );
}
