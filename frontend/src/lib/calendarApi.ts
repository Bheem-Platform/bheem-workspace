import { api } from './api';
import type { Calendar, CalendarEvent, CreateEventData, UpdateEventData } from '@/types/calendar';

// Get Nextcloud credentials from store
const getCredentials = () => {
  // These will be passed as params
  return {};
};

// Calendars
export const getCalendars = async (
  ncUser: string,
  ncPass: string
): Promise<Calendar[]> => {
  const response = await api.get('/calendar/calendars', {
    params: { nc_user: ncUser, nc_pass: ncPass },
  });
  // API returns {count, calendars} - extract calendars array
  return response.data?.calendars || response.data || [];
};

// Events
export const getEvents = async (
  ncUser: string,
  ncPass: string,
  start?: string,
  end?: string,
  calendarId?: string
): Promise<CalendarEvent[]> => {
  const response = await api.get('/calendar/events', {
    params: {
      nc_user: ncUser,
      nc_pass: ncPass,
      start,
      end,
      calendar_id: calendarId,
    },
  });
  // API returns {count, events} - extract events array
  return response.data?.events || response.data || [];
};

export const getTodayEvents = async (
  ncUser: string,
  ncPass: string
): Promise<CalendarEvent[]> => {
  const response = await api.get('/calendar/today', {
    params: { nc_user: ncUser, nc_pass: ncPass },
  });
  return response.data?.events || response.data || [];
};

export const getWeekEvents = async (
  ncUser: string,
  ncPass: string
): Promise<CalendarEvent[]> => {
  const response = await api.get('/calendar/week', {
    params: { nc_user: ncUser, nc_pass: ncPass },
  });
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
  ncUser: string,
  ncPass: string,
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
  }, {
    params: { nc_user: ncUser, nc_pass: ncPass },
  });
  return response.data;
};

export const updateEvent = async (
  ncUser: string,
  ncPass: string,
  eventUid: string,
  data: UpdateEventData
): Promise<CalendarEvent> => {
  const response = await api.put(`/calendar/events/${eventUid}`, {
    title: data.title,
    start: data.start,
    end: data.end,
    location: data.location,
    description: data.description,
    all_day: data.allDay,
    recurrence: data.recurrence ? convertRecurrenceToBackend(data.recurrence) : undefined,
  }, {
    params: { nc_user: ncUser, nc_pass: ncPass },
  });
  return response.data;
};

export const deleteEvent = async (
  ncUser: string,
  ncPass: string,
  eventUid: string
): Promise<void> => {
  await api.delete(`/calendar/events/${eventUid}`, {
    params: { nc_user: ncUser, nc_pass: ncPass },
  });
};

// Recurring event instance management
export const updateEventInstance = async (
  ncUser: string,
  ncPass: string,
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
    params: { nc_user: ncUser, nc_pass: ncPass, calendar_id: calendarId },
  });
  return response.data;
};

export const deleteEventInstance = async (
  ncUser: string,
  ncPass: string,
  eventUid: string,
  instanceDate: string,
  calendarId: string = 'personal'
): Promise<{ success: boolean }> => {
  const response = await api.delete(`/calendar/events/${eventUid}/instance/${instanceDate}`, {
    params: { nc_user: ncUser, nc_pass: ncPass, calendar_id: calendarId },
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
  ncUser: string,
  ncPass: string,
  eventUid: string,
  reminderType: string,
  minutesBefore: number,
  calendarId: string = 'personal'
): Promise<ReminderResponse> => {
  const response = await api.post(`/calendar/events/${eventUid}/reminders`, {
    reminder_type: reminderType,
    minutes_before: minutesBefore,
  }, {
    params: { nc_user: ncUser, nc_pass: ncPass, calendar_id: calendarId },
  });
  return response.data;
};

export const getEventReminders = async (
  ncUser: string,
  ncPass: string,
  eventUid: string
): Promise<ReminderResponse[]> => {
  const response = await api.get(`/calendar/events/${eventUid}/reminders`, {
    params: { nc_user: ncUser, nc_pass: ncPass },
  });
  return response.data;
};

export const deleteReminder = async (
  ncUser: string,
  ncPass: string,
  eventUid: string,
  reminderId: string
): Promise<void> => {
  await api.delete(`/calendar/events/${eventUid}/reminders/${reminderId}`, {
    params: { nc_user: ncUser, nc_pass: ncPass },
  });
};

// Search
export interface SearchResult {
  query: string;
  count: number;
  events: CalendarEvent[];
}

export const searchEvents = async (
  ncUser: string,
  ncPass: string,
  query: string,
  start?: string,
  end?: string,
  calendarIds?: string[]
): Promise<SearchResult> => {
  const response = await api.get('/calendar/search', {
    params: {
      nc_user: ncUser,
      nc_pass: ncPass,
      query,
      start,
      end,
      calendar_ids: calendarIds?.join(','),
    },
  });
  return response.data;
};
