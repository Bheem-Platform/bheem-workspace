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
  return response.data;
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
  return response.data;
};

export const getTodayEvents = async (
  ncUser: string,
  ncPass: string
): Promise<CalendarEvent[]> => {
  const response = await api.get('/calendar/today', {
    params: { nc_user: ncUser, nc_pass: ncPass },
  });
  return response.data;
};

export const getWeekEvents = async (
  ncUser: string,
  ncPass: string
): Promise<CalendarEvent[]> => {
  const response = await api.get('/calendar/week', {
    params: { nc_user: ncUser, nc_pass: ncPass },
  });
  return response.data;
};

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
    attendees: data.attendees || [],
    send_invites: data.sendInvites ?? true,
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
  const response = await api.put(`/calendar/events/${eventUid}`, data, {
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
