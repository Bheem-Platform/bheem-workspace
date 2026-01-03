// Calendar Types for Bheem Calendar

export interface Attendee {
  email: string;
  name?: string;
  status: 'accepted' | 'declined' | 'tentative' | 'needs-action';
  role: 'required' | 'optional' | 'chair';
  rsvp?: boolean;
}

export interface Reminder {
  type: 'email' | 'popup' | 'sms';
  minutes: number;
}

export interface RecurrenceRule {
  frequency: 'daily' | 'weekly' | 'monthly' | 'yearly';
  interval?: number;
  count?: number;
  until?: string;
  byDay?: string[];
  byMonth?: number[];
  byMonthDay?: number[];
}

export interface CalendarEvent {
  id: string;
  uid: string;
  title: string;
  description?: string;
  location?: string;
  start: string;
  end: string;
  allDay: boolean;
  calendarId: string;
  color: string;
  status: 'confirmed' | 'tentative' | 'cancelled';
  visibility: 'public' | 'private' | 'confidential';
  attendees: Attendee[];
  reminders: Reminder[];
  recurrence?: RecurrenceRule;
  recurringEventId?: string;
  meetingLink?: string;
  organizer?: {
    email: string;
    name?: string;
  };
  created: string;
  updated: string;
}

export interface Calendar {
  id: string;
  name: string;
  description?: string;
  color: string;
  isVisible: boolean;
  isOwner: boolean;
  canEdit: boolean;
  isDefault: boolean;
  timezone?: string;
}

export interface CreateEventData {
  title: string;
  start: string;
  end: string;
  description?: string;
  location?: string;
  calendarId?: string;
  allDay?: boolean;
  color?: string;
  attendees?: string[];
  reminders?: Reminder[];
  recurrence?: RecurrenceRule;
  meetingLink?: string;
  sendInvites?: boolean;
}

export interface UpdateEventData {
  title?: string;
  start?: string;
  end?: string;
  description?: string;
  location?: string;
  allDay?: boolean;
  color?: string;
  attendees?: string[];
  reminders?: Reminder[];
  recurrence?: RecurrenceRule;
  meetingLink?: string;
  sendUpdates?: boolean;
}

export type CalendarViewType = 'day' | 'week' | 'month' | 'schedule';

export interface CalendarState {
  // Data
  calendars: Calendar[];
  events: CalendarEvent[];
  selectedEvent: CalendarEvent | null;

  // View state
  currentDate: Date;
  viewType: CalendarViewType;
  visibleCalendarIds: string[];

  // UI State
  isEventModalOpen: boolean;
  eventFormData: Partial<CreateEventData>;
  isEditMode: boolean;

  // Loading
  loading: {
    calendars: boolean;
    events: boolean;
    action: boolean;
  };

  // Error
  error: string | null;

  // Credentials
  isAuthenticated: boolean;
}

// Time utilities
export interface TimeSlot {
  start: Date;
  end: Date;
  events: CalendarEvent[];
}

export interface DayEvents {
  date: Date;
  allDayEvents: CalendarEvent[];
  timedEvents: CalendarEvent[];
}

// Color palette for calendars/events
export const CALENDAR_COLORS = [
  { id: 'blue', value: '#3b82f6', label: 'Blue' },
  { id: 'green', value: '#10b981', label: 'Green' },
  { id: 'purple', value: '#8b5cf6', label: 'Purple' },
  { id: 'orange', value: '#f59e0b', label: 'Orange' },
  { id: 'red', value: '#ef4444', label: 'Red' },
  { id: 'pink', value: '#ec4899', label: 'Pink' },
  { id: 'teal', value: '#14b8a6', label: 'Teal' },
  { id: 'indigo', value: '#6366f1', label: 'Indigo' },
] as const;
