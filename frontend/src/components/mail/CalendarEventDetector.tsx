/**
 * Bheem Mail Calendar Event Detector
 * Detects calendar events in emails and provides quick add to calendar
 */
import { useState, useEffect } from 'react';
import {
  Calendar,
  Clock,
  MapPin,
  Users,
  Plus,
  Check,
  ChevronDown,
  ChevronUp,
  X,
  ExternalLink,
} from 'lucide-react';
import * as mailApi from '@/lib/mailApi';
import { useCredentialsStore } from '@/stores/credentialsStore';
import type { Email } from '@/types/mail';

interface DetectedEvent {
  title: string;
  start: string;
  end?: string;
  location?: string;
  description?: string;
  attendees?: string[];
  confidence: number;
  date_str?: string;
  time_str?: string;
  source?: string;
  duration_minutes?: number;
}

interface CalendarEventDetectorProps {
  email: Email;
  onAddToCalendar?: (event: DetectedEvent) => void;
}

export default function CalendarEventDetector({
  email,
  onAddToCalendar,
}: CalendarEventDetectorProps) {
  const [events, setEvents] = useState<DetectedEvent[]>([]);
  const [loading, setLoading] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [addedEvents, setAddedEvents] = useState<Set<string>>(new Set());
  const [addingEvent, setAddingEvent] = useState<string | null>(null);
  const { getNextcloudCredentials, isNextcloudAuthenticated } = useCredentialsStore();

  useEffect(() => {
    detectEvents();
  }, [email.id]);

  const detectEvents = async () => {
    setLoading(true);
    try {
      // Try to detect from message ID first
      const result = await mailApi.detectCalendarEvents(email.id);
      if (result.events && result.events.length > 0) {
        setEvents(result.events);
        setExpanded(true);
      } else {
        // Fallback to text detection
        const textResult = await mailApi.detectEventsFromText(
          email.subject,
          email.bodyText || email.body || ''
        );
        if (textResult.events && textResult.events.length > 0) {
          setEvents(textResult.events);
          setExpanded(true);
        }
      }
    } catch (error) {
      // Silently fail - no events detected
      console.debug('No calendar events detected:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleAddToCalendar = async (event: DetectedEvent) => {
    const eventKey = `${event.title}-${event.start}`;
    setAddingEvent(eventKey);

    try {
      // Check if Nextcloud credentials are available
      const credentials = getNextcloudCredentials();
      if (!credentials || !isNextcloudAuthenticated) {
        alert('Please configure your Nextcloud calendar credentials in Settings to add events.');
        return;
      }

      await mailApi.addEventToCalendar(
        {
          title: event.title,
          start: event.start,
          end: event.end,
          location: event.location,
          description: event.description || `From email: ${email.subject}`,
        },
        credentials.username,
        credentials.password
      );

      setAddedEvents((prev) => new Set(prev).add(eventKey));
      onAddToCalendar?.(event);
    } catch (error) {
      console.error('Failed to add event to calendar:', error);
      alert('Failed to add event to calendar');
    } finally {
      setAddingEvent(null);
    }
  };

  const formatDateTime = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleString([], {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getConfidenceColor = (confidence: number) => {
    if (confidence >= 0.8) return 'bg-green-100 text-green-700 border-green-200';
    if (confidence >= 0.6) return 'bg-yellow-100 text-yellow-700 border-yellow-200';
    return 'bg-gray-100 text-gray-600 border-gray-200';
  };

  if (loading) {
    return (
      <div className="flex items-center gap-2 px-4 py-2 bg-blue-50 border border-blue-100 rounded-lg">
        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-500" />
        <span className="text-sm text-blue-700">Checking for calendar events...</span>
      </div>
    );
  }

  if (events.length === 0) {
    return null;
  }

  return (
    <div className="border border-blue-200 rounded-lg bg-blue-50 overflow-hidden">
      {/* Header */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between px-4 py-3 hover:bg-blue-100 transition-colors"
      >
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-blue-500 rounded-lg flex items-center justify-center">
            <Calendar size={16} className="text-white" />
          </div>
          <div className="text-left">
            <p className="font-medium text-blue-900">
              {events.length} event{events.length > 1 ? 's' : ''} detected
            </p>
            <p className="text-sm text-blue-600">
              {events[0].title}
              {events.length > 1 && ` and ${events.length - 1} more`}
            </p>
          </div>
        </div>
        {expanded ? (
          <ChevronUp size={20} className="text-blue-500" />
        ) : (
          <ChevronDown size={20} className="text-blue-500" />
        )}
      </button>

      {/* Event List */}
      {expanded && (
        <div className="border-t border-blue-200 divide-y divide-blue-100">
          {events.map((event, index) => {
            const eventKey = `${event.title}-${event.start}`;
            const isAdded = addedEvents.has(eventKey);
            const isAdding = addingEvent === eventKey;

            return (
              <div key={index} className="px-4 py-3 bg-white">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <h4 className="font-medium text-gray-900 truncate">
                        {event.title}
                      </h4>
                      <span
                        className={`px-2 py-0.5 text-xs rounded-full border ${getConfidenceColor(
                          event.confidence
                        )}`}
                      >
                        {Math.round(event.confidence * 100)}% match
                      </span>
                    </div>

                    <div className="mt-2 space-y-1">
                      <div className="flex items-center gap-2 text-sm text-gray-600">
                        <Clock size={14} className="text-gray-400" />
                        <span>
                          {event.date_str || formatDateTime(event.start)}
                          {event.time_str && ` at ${event.time_str}`}
                        </span>
                      </div>

                      {event.location && (
                        <div className="flex items-center gap-2 text-sm text-gray-600">
                          <MapPin size={14} className="text-gray-400" />
                          <span>{event.location}</span>
                        </div>
                      )}

                      {event.attendees && event.attendees.length > 0 && (
                        <div className="flex items-center gap-2 text-sm text-gray-600">
                          <Users size={14} className="text-gray-400" />
                          <span>{event.attendees.slice(0, 3).join(', ')}</span>
                          {event.attendees.length > 3 && (
                            <span className="text-gray-400">
                              +{event.attendees.length - 3} more
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                  </div>

                  <button
                    onClick={() => handleAddToCalendar(event)}
                    disabled={isAdded || isAdding}
                    className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                      isAdded
                        ? 'bg-green-100 text-green-700 cursor-default'
                        : 'bg-blue-500 text-white hover:bg-blue-600'
                    } disabled:opacity-50`}
                  >
                    {isAdding ? (
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" />
                    ) : isAdded ? (
                      <Check size={16} />
                    ) : (
                      <Plus size={16} />
                    )}
                    {isAdded ? 'Added' : 'Add to Calendar'}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// Compact event chip for email list view
export function EventChip({ event }: { event: DetectedEvent }) {
  return (
    <div className="inline-flex items-center gap-1.5 px-2 py-0.5 bg-blue-100 text-blue-700 rounded-full text-xs">
      <Calendar size={12} />
      <span className="truncate max-w-24">{event.title}</span>
    </div>
  );
}

// ICS attachment handler
interface ICSAttachmentProps {
  attachment: {
    id: string;
    filename: string;
    contentType: string;
    size: number;
    index?: number;  // Attachment index for download URL
  };
  messageId: string;
  attachmentIndex?: number;  // Optional attachment index
}

export function ICSAttachment({ attachment, messageId, attachmentIndex = 0 }: ICSAttachmentProps) {
  const [event, setEvent] = useState<DetectedEvent | null>(null);
  const [loading, setLoading] = useState(false);
  const [added, setAdded] = useState(false);
  const { getNextcloudCredentials, isNextcloudAuthenticated } = useCredentialsStore();

  // Use provided index or fallback to parsing id or default to 0
  const index = attachment.index ?? attachmentIndex ?? (parseInt(attachment.id, 10) || 0);

  useEffect(() => {
    parseICS();
  }, [attachment.id]);

  const parseICS = async () => {
    setLoading(true);
    try {
      // Fetch and parse ICS content
      const response = await fetch(
        mailApi.getAttachmentDownloadUrl(messageId, index)
      );
      const icsContent = await response.text();
      const parsed = await mailApi.parseIcsContent(icsContent);
      if (parsed.events && parsed.events.length > 0) {
        setEvent(parsed.events[0]);
      }
    } catch (error) {
      console.error('Failed to parse ICS:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleAdd = async () => {
    if (!event) return;

    try {
      const credentials = getNextcloudCredentials();
      if (!credentials || !isNextcloudAuthenticated) {
        alert('Please configure your Nextcloud calendar credentials in Settings to add events.');
        return;
      }

      await mailApi.addEventToCalendar(
        {
          title: event.title,
          start: event.start,
          end: event.end,
          location: event.location,
          description: event.description,
        },
        credentials.username,
        credentials.password
      );
      setAdded(true);
    } catch (error) {
      console.error('Failed to add ICS event:', error);
    }
  };

  if (!event && !loading) {
    return null;
  }

  return (
    <div className="flex items-center gap-3 p-3 bg-purple-50 border border-purple-200 rounded-lg">
      <div className="w-10 h-10 bg-purple-500 rounded-lg flex items-center justify-center">
        <Calendar size={20} className="text-white" />
      </div>

      <div className="flex-1 min-w-0">
        {loading ? (
          <p className="text-sm text-purple-700">Loading calendar invite...</p>
        ) : event ? (
          <>
            <p className="font-medium text-purple-900 truncate">{event.title}</p>
            <p className="text-sm text-purple-600">
              {new Date(event.start).toLocaleString()}
            </p>
          </>
        ) : null}
      </div>

      {!loading && event && (
        <button
          onClick={handleAdd}
          disabled={added}
          className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium ${
            added
              ? 'bg-green-100 text-green-700'
              : 'bg-purple-500 text-white hover:bg-purple-600'
          }`}
        >
          {added ? <Check size={16} /> : <Plus size={16} />}
          {added ? 'Added' : 'Add'}
        </button>
      )}
    </div>
  );
}
