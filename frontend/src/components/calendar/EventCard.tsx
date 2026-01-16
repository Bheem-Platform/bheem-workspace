import dayjs from 'dayjs';
import { MapPin, Users, User, Briefcase, Target, Flag, Video, ExternalLink } from 'lucide-react';
import type { CalendarEvent } from '@/types/calendar';

interface EventCardProps {
  event: CalendarEvent;
  onClick: () => void;
  compact?: boolean;
}

// Get color based on event source and type
function getEventColor(event: CalendarEvent): string {
  // Use sourceColor if available (from backend)
  if (event.sourceColor) return event.sourceColor;

  // Fallback to event.color or source-based color
  if (event.eventSource === 'project') {
    switch (event.eventType) {
      case 'milestone': return '#ef4444'; // Red
      case 'task': return '#f97316'; // Orange
      default: return '#22c55e'; // Green for meetings
    }
  }

  return event.color || '#3b82f6'; // Blue for personal
}

// Get icon based on event source and type
function getEventIcon(event: CalendarEvent) {
  if (event.eventSource === 'bheem_meet') {
    return Video;
  }
  if (event.eventSource === 'project') {
    switch (event.eventType) {
      case 'milestone': return Flag;
      case 'task': return Target;
      default: return Briefcase;
    }
  }
  return User;
}

export default function EventCard({ event, onClick, compact = false }: EventCardProps) {
  const startTime = dayjs(event.start).format('h:mm A');
  const endTime = dayjs(event.end).format('h:mm A');
  const eventColor = getEventColor(event);
  const EventIcon = getEventIcon(event);

  if (compact) {
    return (
      <button
        onClick={(e) => {
          e.stopPropagation();
          onClick();
        }}
        className="w-full text-left px-2 py-1 rounded text-xs font-medium truncate transition-opacity hover:opacity-80 flex items-center gap-1"
        style={{
          backgroundColor: eventColor,
          color: '#ffffff',
        }}
      >
        <EventIcon size={10} />
        {event.title}
      </button>
    );
  }

  return (
    <button
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      className="w-full text-left p-2 rounded-lg transition-all hover:shadow-md group"
      style={{
        backgroundColor: `${eventColor}15`,
        borderLeft: `3px solid ${eventColor}`,
      }}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1">
            <EventIcon size={12} style={{ color: eventColor }} />
            <p
              className="text-sm font-medium truncate"
              style={{ color: eventColor }}
            >
              {event.title}
            </p>
          </div>
          <p className="text-xs text-gray-500 mt-0.5">
            {event.allDay ? 'All day' : `${startTime} - ${endTime}`}
          </p>
          {/* Show project name for project events */}
          {event.eventSource === 'project' && event.projectName && (
            <p className="text-xs text-gray-400 mt-0.5 truncate">
              {event.projectName}
            </p>
          )}
        </div>
      </div>

      {/* Bheem Meet - Show join button */}
      {event.eventSource === 'bheem_meet' && (event.location || event.meetingLink) && (
        <div className="mt-2">
          <a
            href={event.location || event.meetingLink}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => e.stopPropagation()}
            className="inline-flex items-center gap-1 px-2 py-1 bg-emerald-500 text-white text-xs font-medium rounded hover:bg-emerald-600 transition-colors"
          >
            <Video size={12} />
            Join Meeting
            <ExternalLink size={10} />
          </a>
        </div>
      )}

      {/* Location and attendees for non-meet events */}
      {event.eventSource !== 'bheem_meet' && (event.location || (event.attendees && event.attendees.length > 0)) && (
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
  const eventColor = getEventColor(event);
  const EventIcon = getEventIcon(event);

  return (
    <button
      onClick={onClick}
      className="absolute rounded-lg p-2 text-left overflow-hidden transition-all hover:shadow-lg hover:z-20 z-10"
      style={{
        backgroundColor: eventColor,
        // Default width/left if not provided in style
        width: 'calc(100% - 4px)',
        left: '2px',
        ...style,
      }}
    >
      <div className="flex items-center gap-1">
        <EventIcon size={10} className="text-white/80 flex-shrink-0" />
        <p className="text-xs font-medium text-white truncate">{event.title}</p>
      </div>
      <p className="text-xs text-white/80">{startTime}</p>
      {event.eventSource === 'project' && event.projectName && (
        <p className="text-xs text-white/60 truncate">{event.projectName}</p>
      )}
    </button>
  );
}

// All-day event bar
interface AllDayEventProps {
  event: CalendarEvent;
  onClick: () => void;
}

export function AllDayEvent({ event, onClick }: AllDayEventProps) {
  const eventColor = getEventColor(event);
  const EventIcon = getEventIcon(event);

  return (
    <button
      onClick={onClick}
      className="w-full px-2 py-1 rounded text-xs font-medium text-white truncate transition-opacity hover:opacity-80 flex items-center gap-1"
      style={{
        backgroundColor: eventColor,
      }}
    >
      <EventIcon size={10} className="flex-shrink-0" />
      {event.title}
    </button>
  );
}
