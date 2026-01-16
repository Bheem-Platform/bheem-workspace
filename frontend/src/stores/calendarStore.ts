import { create } from 'zustand';
import dayjs from 'dayjs';
import * as calendarApi from '@/lib/calendarApi';
import type {
  Calendar,
  CalendarEvent,
  CalendarViewType,
  CreateEventData,
  UpdateEventData,
  EventSource,
} from '@/types/calendar';
import type { Project } from '@/lib/calendarApi';

// Helper to extract error message from API response
function getErrorMessage(error: any, fallback: string): string {
  const detail = error?.response?.data?.detail;
  if (!detail) return fallback;
  if (typeof detail === 'string') return detail;
  if (Array.isArray(detail)) {
    // Pydantic validation errors - extract messages
    return detail.map((e: any) => e.msg || e.message || JSON.stringify(e)).join(', ');
  }
  if (typeof detail === 'object' && detail.message) return detail.message;
  return fallback;
}

interface CalendarState {
  // Data
  calendars: Calendar[];
  events: CalendarEvent[];
  selectedEvent: CalendarEvent | null;
  projects: Project[];  // ERP projects for unified calendar

  // View state
  currentDate: Date;
  viewType: CalendarViewType;
  visibleCalendarIds: string[];
  sourceFilter: EventSource | null;  // Filter: 'personal', 'project', or null for all

  // UI State
  isEventModalOpen: boolean;
  eventFormData: Partial<CreateEventData>;
  isEditMode: boolean;
  selectedDate: Date | null;

  // Loading
  loading: {
    calendars: boolean;
    events: boolean;
    action: boolean;
    projects: boolean;
  };

  // Error
  error: string | null;

  // Actions
  fetchCalendars: () => Promise<void>;
  fetchEvents: (start?: Date, end?: Date) => Promise<void>;
  fetchProjects: () => Promise<void>;  // Fetch ERP projects
  createEvent: (data: CreateEventData) => Promise<boolean>;
  updateEvent: (uid: string, data: UpdateEventData) => Promise<boolean>;
  deleteEvent: (uid: string) => Promise<void>;
  setSourceFilter: (source: EventSource | null) => void;  // Filter by source

  // Navigation
  navigateDate: (direction: 'prev' | 'next' | 'today') => void;
  goToDate: (date: Date) => void;
  setViewType: (view: CalendarViewType) => void;

  // Calendar visibility
  toggleCalendarVisibility: (calendarId: string) => void;

  // Event modal
  openEventModal: (prefill?: Partial<CreateEventData>) => void;
  openEditModal: (event: CalendarEvent) => void;
  closeEventModal: () => void;
  updateEventFormData: (data: Partial<CreateEventData>) => void;

  // Selection
  selectEvent: (event: CalendarEvent | null) => void;
  selectDate: (date: Date | null) => void;

  // Utils
  clearError: () => void;
  reset: () => void;

  // Computed
  getEventsForDate: (date: Date) => CalendarEvent[];
  getEventsForWeek: () => CalendarEvent[];
}

const initialState = {
  calendars: [],
  events: [],
  selectedEvent: null,
  projects: [],  // ERP projects
  currentDate: new Date(),
  viewType: 'week' as CalendarViewType,
  visibleCalendarIds: [],
  sourceFilter: null as EventSource | null,  // Show all sources by default
  isEventModalOpen: false,
  eventFormData: {},
  isEditMode: false,
  selectedDate: null,
  loading: {
    calendars: false,
    events: false,
    action: false,
    projects: false,
  },
  error: null,
};

export const useCalendarStore = create<CalendarState>((set, get) => ({
  ...initialState,

  fetchCalendars: async () => {
    set((state) => ({ loading: { ...state.loading, calendars: true }, error: null }));

    try {
      // Uses mail session credentials automatically - no need to pass them
      const calendars = await calendarApi.getCalendars();

      const mappedCalendars: Calendar[] = (calendars || []).map((c: any) => ({
        id: c.id || c.href,
        name: c.name || 'Calendar',
        description: c.description,
        color: c.color || '#3b82f6',
        isVisible: true,
        isOwner: true,
        canEdit: true,
        isDefault: c.is_default || false,
      }));

      set({
        calendars: mappedCalendars,
        visibleCalendarIds: mappedCalendars.map((c) => c.id),
      });
    } catch (error: any) {
      const errorMsg = getErrorMessage(error, 'Failed to fetch calendars');
      if (errorMsg.includes('credentials required') || errorMsg.includes('login to Mail')) {
        set({ error: 'Please login to Mail first to access your calendar.' });
      } else {
        set({ error: errorMsg });
      }
    } finally {
      set((state) => ({ loading: { ...state.loading, calendars: false } }));
    }
  },

  fetchEvents: async (start?: Date, end?: Date) => {
    const { currentDate, viewType, sourceFilter } = get();

    // Calculate date range based on view
    let rangeStart = start;
    let rangeEnd = end;

    if (!rangeStart || !rangeEnd) {
      const current = dayjs(currentDate);
      if (viewType === 'day') {
        rangeStart = current.startOf('day').toDate();
        rangeEnd = current.endOf('day').toDate();
      } else if (viewType === 'week') {
        rangeStart = current.startOf('week').toDate();
        rangeEnd = current.endOf('week').toDate();
      } else if (viewType === 'month') {
        rangeStart = current.startOf('month').startOf('week').toDate();
        rangeEnd = current.endOf('month').endOf('week').toDate();
      } else {
        rangeStart = current.startOf('month').toDate();
        rangeEnd = current.add(3, 'month').endOf('month').toDate();
      }
    }

    set((state) => ({ loading: { ...state.loading, events: true }, error: null }));

    try {
      // Unified calendar - fetches from both Nextcloud and ERP
      const events = await calendarApi.getEvents(
        rangeStart.toISOString(),
        rangeEnd.toISOString(),
        undefined,
        sourceFilter  // Filter by source if set
      );

      const mappedEvents: CalendarEvent[] = (events || []).map((e: any) => ({
        id: e.id || e.uid,
        uid: e.uid || e.id,
        title: e.title || e.summary || 'Untitled',
        description: e.description || '',
        location: e.location || e.conference_url || '',
        start: e.start,
        end: e.end || e.start,
        meetingLink: e.conference_url || e.location || '',
        allDay: e.all_day || false,
        calendarId: e.calendar_id || 'personal',
        color: e.source_color || e.color || '#3b82f6',  // Use source color if available
        status: e.status || 'confirmed',
        visibility: e.visibility || 'public',
        attendees: e.attendees || [],
        reminders: e.reminders || [],
        organizer: e.organizer,
        created: e.created || new Date().toISOString(),
        updated: e.updated || new Date().toISOString(),
        // Recurring event properties
        recurrence: e.recurrence_parsed ? {
          frequency: e.recurrence_parsed.freq?.toLowerCase(),
          interval: e.recurrence_parsed.interval,
          byDay: e.recurrence_parsed.by_day,
          byMonthDay: e.recurrence_parsed.by_month_day,
          byMonth: e.recurrence_parsed.by_month,
          count: e.recurrence_parsed.count,
          until: e.recurrence_parsed.until,
        } : undefined,
        recurringEventId: e.master_event_id,
        // Unified calendar fields
        eventSource: e.event_source,
        sourceColor: e.source_color,
        sourceLabel: e.source_label,
        projectId: e.project_id,
        projectName: e.project_name,
        taskId: e.task_id,
        eventType: e.event_type,
      }));

      set({ events: mappedEvents });
    } catch (error: any) {
      const errorMsg = getErrorMessage(error, 'Failed to fetch events');
      if (errorMsg.includes('credentials required') || errorMsg.includes('login to Mail')) {
        set({ error: 'Please login to Mail first to access your calendar.' });
      } else {
        set({ error: errorMsg });
      }
    } finally {
      set((state) => ({ loading: { ...state.loading, events: false } }));
    }
  },

  fetchProjects: async () => {
    set((state) => ({ loading: { ...state.loading, projects: true } }));

    try {
      const projects = await calendarApi.getProjects();
      set({ projects });
    } catch (error: any) {
      console.warn('Failed to fetch ERP projects:', error);
      set({ projects: [] });
    } finally {
      set((state) => ({ loading: { ...state.loading, projects: false } }));
    }
  },

  setSourceFilter: (source: EventSource | null) => {
    set({ sourceFilter: source });
    get().fetchEvents();
  },

  createEvent: async (data: CreateEventData) => {
    set((state) => ({ loading: { ...state.loading, action: true }, error: null }));

    try {
      // Uses mail session credentials automatically
      await calendarApi.createEvent(data);

      // Refresh events
      await get().fetchEvents();
      set({ isEventModalOpen: false, eventFormData: {} });
      return true;
    } catch (error: any) {
      set({ error: getErrorMessage(error, 'Failed to create event') });
      return false;
    } finally {
      set((state) => ({ loading: { ...state.loading, action: false } }));
    }
  },

  updateEvent: async (uid: string, data: UpdateEventData) => {
    set((state) => ({ loading: { ...state.loading, action: true }, error: null }));

    try {
      // Find the event to get its source
      const { events } = get();
      const event = events.find((e) => e.uid === uid);
      const eventSource = event?.eventSource as calendarApi.EventSource | undefined;

      // Update in appropriate backend based on source
      await calendarApi.updateEvent(uid, data, eventSource);

      await get().fetchEvents();
      set({ isEventModalOpen: false, eventFormData: {}, isEditMode: false });
      return true;
    } catch (error: any) {
      set({ error: getErrorMessage(error, 'Failed to update event') });
      return false;
    } finally {
      set((state) => ({ loading: { ...state.loading, action: false } }));
    }
  },

  deleteEvent: async (uid: string) => {
    set((state) => ({ loading: { ...state.loading, action: true } }));

    try {
      // Find the event to get its source
      const { events } = get();
      const event = events.find((e) => e.uid === uid);
      const eventSource = event?.eventSource as calendarApi.EventSource | undefined;

      // Delete from appropriate backend based on source
      await calendarApi.deleteEvent(uid, eventSource);

      set((state) => ({
        events: state.events.filter((e) => e.uid !== uid),
        selectedEvent: state.selectedEvent?.uid === uid ? null : state.selectedEvent,
      }));
    } catch (error: any) {
      set({ error: getErrorMessage(error, 'Failed to delete event') });
    } finally {
      set((state) => ({ loading: { ...state.loading, action: false } }));
    }
  },

  navigateDate: (direction) => {
    const { currentDate, viewType } = get();
    const current = dayjs(currentDate);

    let newDate: Date;
    if (direction === 'today') {
      newDate = new Date();
    } else {
      const amount = direction === 'next' ? 1 : -1;
      if (viewType === 'day') {
        newDate = current.add(amount, 'day').toDate();
      } else if (viewType === 'week') {
        newDate = current.add(amount, 'week').toDate();
      } else {
        newDate = current.add(amount, 'month').toDate();
      }
    }

    set({ currentDate: newDate });
    get().fetchEvents();
  },

  goToDate: (date: Date) => {
    set({ currentDate: date });
    get().fetchEvents();
  },

  setViewType: (view: CalendarViewType) => {
    set({ viewType: view });
    get().fetchEvents();
  },

  toggleCalendarVisibility: (calendarId: string) => {
    set((state) => ({
      visibleCalendarIds: state.visibleCalendarIds.includes(calendarId)
        ? state.visibleCalendarIds.filter((id) => id !== calendarId)
        : [...state.visibleCalendarIds, calendarId],
    }));
  },

  openEventModal: (prefill?: Partial<CreateEventData>) => {
    const { selectedDate } = get();
    const defaultStart = selectedDate || new Date();
    const defaultEnd = dayjs(defaultStart).add(1, 'hour').toDate();

    set({
      isEventModalOpen: true,
      isEditMode: false,
      eventFormData: {
        start: defaultStart.toISOString(),
        end: defaultEnd.toISOString(),
        ...prefill,
      },
    });
  },

  openEditModal: (event: CalendarEvent) => {
    set({
      isEventModalOpen: true,
      isEditMode: true,
      selectedEvent: event,
      eventFormData: {
        title: event.title,
        description: event.description,
        location: event.location,
        start: event.start,
        end: event.end,
        allDay: event.allDay,
        color: event.color,
        calendarId: event.calendarId,
        recurrence: event.recurrence,
        reminders: event.reminders,
      },
    });
  },

  closeEventModal: () => {
    set({
      isEventModalOpen: false,
      eventFormData: {},
      isEditMode: false,
    });
  },

  updateEventFormData: (data: Partial<CreateEventData>) => {
    set((state) => ({
      eventFormData: { ...state.eventFormData, ...data },
    }));
  },

  selectEvent: (event: CalendarEvent | null) => {
    set({ selectedEvent: event });
  },

  selectDate: (date: Date | null) => {
    set({ selectedDate: date });
  },

  clearError: () => {
    set({ error: null });
  },

  reset: () => {
    set(initialState);
  },

  getEventsForDate: (date: Date) => {
    const { events, visibleCalendarIds } = get();
    return events.filter((event) => {
      // If no calendars are loaded yet, show all events (especially Bheem Meet)
      // Also always show bheem_meet events
      const isVisible = visibleCalendarIds.length === 0 ||
                        visibleCalendarIds.includes(event.calendarId) ||
                        event.eventSource === 'bheem_meet';
      if (!isVisible) return false;
      return calendarApi.isEventOnDate(event, date);
    });
  },

  getEventsForWeek: () => {
    const { events, currentDate, visibleCalendarIds } = get();
    const weekStart = dayjs(currentDate).startOf('week');
    const weekEnd = dayjs(currentDate).endOf('week');

    return events.filter((event) => {
      // If no calendars are loaded yet, show all events (especially Bheem Meet)
      // Also always show bheem_meet events
      const isVisible = visibleCalendarIds.length === 0 ||
                        visibleCalendarIds.includes(event.calendarId) ||
                        event.eventSource === 'bheem_meet';
      if (!isVisible) return false;
      const eventStart = dayjs(event.start);
      const eventEnd = dayjs(event.end);
      return eventStart.isBefore(weekEnd) && eventEnd.isAfter(weekStart);
    });
  },
}));
