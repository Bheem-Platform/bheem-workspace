import { api } from './api';
import type { Calendar, CalendarEvent, CreateEventData, UpdateEventData } from '@/types/calendar';

/**
 * Unified Calendar API - Combines Personal (Nextcloud) + Project (ERP) events
 *
 * The backend automatically retrieves credentials from your mail session.
 * Just login to Mail with your workspace email/password, and Calendar works!
 *
 * Event Sources:
 * - personal: Personal events stored in Nextcloud CalDAV (blue)
 * - project: Project events from ERP Project Management (green/orange/red)
 */

// Event source types
export type EventSource = 'personal' | 'project' | 'bheem_meet';
export type ERPEventType = 'meeting' | 'task' | 'milestone' | 'reminder';

// Project for dropdown
export interface Project {
  id: string;
  name: string;
  status?: string;
  color?: string;
}

// Calendars
export const getCalendars = async (): Promise<Calendar[]> => {
  const response = await api.get('/calendar/calendars');
  // API returns {count, calendars} - extract calendars array
  return response.data?.calendars || response.data || [];
};

// Get user's ERP projects for event creation
export const getProjects = async (): Promise<Project[]> => {
  try {
    const response = await api.get('/calendar/projects');
    return response.data?.projects || [];
  } catch {
    return [];
  }
};

// Events - Unified view combining personal + project events
export const getEvents = async (
  start?: string,
  end?: string,
  calendarId?: string,
  source?: EventSource | null  // Filter: 'personal', 'project', or null for both
): Promise<CalendarEvent[]> => {
  const response = await api.get('/calendar/events', {
    params: {
      start,
      end,
      calendar_id: calendarId,
      source,  // New: filter by source
    },
  });
  // API returns {count, events, sources, errors} - extract events array
  return response.data?.events || response.data || [];
};

export const getTodayEvents = async (): Promise<CalendarEvent[]> => {
  const response = await api.get('/calendar/today');
  return response.data?.events || response.data || [];
};

export const getWeekEvents = async (): Promise<CalendarEvent[]> => {
  const response = await api.get('/calendar/week');
  return response.data?.events || response.data || [];
};

// Convert frontend RecurrenceRule to backend format
function convertRecurrenceToBackend(recurrence?: CreateEventData['recurrence']) {
  if (!recurrence) return undefined;

  return {
    freq: recurrence.frequency.toUpperCase(),
    interval: recurrence.interval || 1,
    by_day: recurrence.byDay,
    by_month_day: recurrence.byMonthDay,
    by_month: recurrence.byMonth,
    count: recurrence.count,
    until: recurrence.until,
  };
}

export const createEvent = async (
  data: CreateEventData
): Promise<CalendarEvent> => {
  const response = await api.post('/calendar/events', {
    calendar_id: data.calendarId || 'personal',
    title: data.title,
    start: data.start,
    end: data.end,
    location: data.location || '',
    description: data.description || '',
    all_day: data.allDay || false,
    attendees: data.attendees || [],
    send_invites: data.sendInvites ?? true,
    recurrence: convertRecurrenceToBackend(data.recurrence),
    // Unified calendar fields
    event_source: data.eventSource || 'personal',
    project_id: data.projectId,
    task_id: data.taskId,
    event_type: data.eventType || 'meeting',
  });
  return response.data;
};

export const updateEvent = async (
  eventUid: string,
  data: UpdateEventData,
  eventSource?: EventSource
): Promise<CalendarEvent> => {
  const response = await api.put(`/calendar/events/${eventUid}`, {
    title: data.title,
    start: data.start,
    end: data.end,
    location: data.location,
    description: data.description,
    all_day: data.allDay,
    recurrence: data.recurrence ? convertRecurrenceToBackend(data.recurrence) : undefined,
    event_source: eventSource,  // Helps route to correct backend
  });
  return response.data;
};

export const deleteEvent = async (
  eventUid: string,
  eventSource?: EventSource
): Promise<void> => {
  await api.delete(`/calendar/events/${eventUid}`, {
    params: { event_source: eventSource },
  });
};

// Recurring event instance management
export const updateEventInstance = async (
  eventUid: string,
  instanceDate: string,
  data: UpdateEventData,
  calendarId: string = 'personal'
): Promise<{ success: boolean; exception_event_uid: string }> => {
  const response = await api.put(`/calendar/events/${eventUid}/instance/${instanceDate}`, {
    title: data.title,
    start: data.start,
    end: data.end,
    location: data.location,
    description: data.description,
  }, {
    params: { calendar_id: calendarId },
  });
  return response.data;
};

export const deleteEventInstance = async (
  eventUid: string,
  instanceDate: string,
  calendarId: string = 'personal'
): Promise<{ success: boolean }> => {
  const response = await api.delete(`/calendar/events/${eventUid}/instance/${instanceDate}`, {
    params: { calendar_id: calendarId },
  });
  return response.data;
};

// Helper functions
export function formatEventTime(start: string, end: string, allDay: boolean): string {
  if (allDay) return 'All day';

  const startDate = new Date(start);
  const endDate = new Date(end);

  const startTime = startDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  const endTime = endDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  return `${startTime} - ${endTime}`;
}

export function getEventDuration(start: string, end: string): number {
  const startDate = new Date(start);
  const endDate = new Date(end);
  return (endDate.getTime() - startDate.getTime()) / (1000 * 60); // minutes
}

export function isEventOnDate(event: CalendarEvent, date: Date): boolean {
  const eventStart = new Date(event.start);
  const eventEnd = new Date(event.end);

  const dayStart = new Date(date);
  dayStart.setHours(0, 0, 0, 0);

  const dayEnd = new Date(date);
  dayEnd.setHours(23, 59, 59, 999);

  return eventStart <= dayEnd && eventEnd >= dayStart;
}

// Reminders
export interface ReminderResponse {
  id: string;
  event_uid: string;
  reminder_type: string;
  minutes_before: number;
  trigger_time: string;
  status: string;
}

export const addReminder = async (
  eventUid: string,
  reminderType: string,
  minutesBefore: number,
  calendarId: string = 'personal'
): Promise<ReminderResponse> => {
  const response = await api.post(`/calendar/events/${eventUid}/reminders`, {
    reminder_type: reminderType,
    minutes_before: minutesBefore,
  }, {
    params: { calendar_id: calendarId },
  });
  return response.data;
};

export const getEventReminders = async (
  eventUid: string
): Promise<ReminderResponse[]> => {
  const response = await api.get(`/calendar/events/${eventUid}/reminders`);
  return response.data;
};

export const deleteReminder = async (
  eventUid: string,
  reminderId: string
): Promise<void> => {
  await api.delete(`/calendar/events/${eventUid}/reminders/${reminderId}`);
};

// Search
export interface SearchResult {
  query: string;
  count: number;
  events: CalendarEvent[];
}

export const searchEvents = async (
  query: string,
  start?: string,
  end?: string,
  calendarIds?: string[]
): Promise<SearchResult> => {
  const response = await api.get('/calendar/search', {
    params: {
      query,
      start,
      end,
      calendar_ids: calendarIds?.join(','),
    },
  });
  return response.data;
};

// Legacy functions for backward compatibility (deprecated - will be removed)
// These accept credentials but ignore them - backend uses mail session automatically

/** @deprecated Use getCalendars() instead - credentials are now automatic */
export const getCalendarsWithCreds = async (
  _ncUser: string,
  _ncPass: string
): Promise<Calendar[]> => getCalendars();

/** @deprecated Use getEvents() instead - credentials are now automatic */
export const getEventsWithCreds = async (
  _ncUser: string,
  _ncPass: string,
  start?: string,
  end?: string,
  calendarId?: string
): Promise<CalendarEvent[]> => getEvents(start, end, calendarId);

/** @deprecated Use createEvent() instead - credentials are now automatic */
export const createEventWithCreds = async (
  _ncUser: string,
  _ncPass: string,
  data: CreateEventData
): Promise<CalendarEvent> => createEvent(data);

/** @deprecated Use updateEvent() instead - credentials are now automatic */
export const updateEventWithCreds = async (
  _ncUser: string,
  _ncPass: string,
  eventUid: string,
  data: UpdateEventData
): Promise<CalendarEvent> => updateEvent(eventUid, data);

/** @deprecated Use deleteEvent() instead - credentials are now automatic */
export const deleteEventWithCreds = async (
  _ncUser: string,
  _ncPass: string,
  eventUid: string
): Promise<void> => deleteEvent(eventUid);
