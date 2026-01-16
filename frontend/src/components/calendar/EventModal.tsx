import { useState, useEffect } from 'react';
import dayjs from 'dayjs';
import {
  X,
  Calendar,
  Clock,
  MapPin,
  AlignLeft,
  Users,
  Palette,
  Trash2,
  Briefcase,
  User,
  Video,
  ExternalLink,
} from 'lucide-react';
import { useCalendarStore } from '@/stores/calendarStore';
import {
  CALENDAR_COLORS,
  EVENT_SOURCE_COLORS,
  type RecurrenceRule,
  type Reminder,
  type EventSource,
  type ERPEventType,
} from '@/types/calendar';
import RecurrenceSelector from './RecurrenceSelector';
import ReminderSelector from './ReminderSelector';

interface EventModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function EventModal({ isOpen, onClose }: EventModalProps) {
  const {
    isEditMode,
    selectedEvent,
    eventFormData,
    updateEventFormData,
    createEvent,
    updateEvent,
    deleteEvent,
    calendars,
    projects,
    fetchProjects,
    loading,
  } = useCalendarStore();

  const [showColorPicker, setShowColorPicker] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState(false);

  // Local form state
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [location, setLocation] = useState('');
  const [startDate, setStartDate] = useState('');
  const [startTime, setStartTime] = useState('');
  const [endDate, setEndDate] = useState('');
  const [endTime, setEndTime] = useState('');
  const [allDay, setAllDay] = useState(false);
  const [color, setColor] = useState<string>(CALENDAR_COLORS[0].value);
  const [calendarId, setCalendarId] = useState('');
  const [recurrence, setRecurrence] = useState<RecurrenceRule | null>(null);
  const [reminders, setReminders] = useState<Reminder[]>([{ type: 'popup', minutes: 10 }]);

  // Unified calendar fields
  const [eventSource, setEventSource] = useState<EventSource>('personal');
  const [projectId, setProjectId] = useState<string>('');
  const [eventType, setEventType] = useState<ERPEventType>('meeting');

  // Fetch projects when modal opens
  useEffect(() => {
    if (isOpen && projects.length === 0) {
      fetchProjects();
    }
  }, [isOpen, projects.length, fetchProjects]);

  // Initialize form with eventFormData
  useEffect(() => {
    if (eventFormData.title !== undefined) setTitle(eventFormData.title || '');
    if (eventFormData.description !== undefined) setDescription(eventFormData.description || '');
    if (eventFormData.location !== undefined) setLocation(eventFormData.location || '');
    if (eventFormData.allDay !== undefined) setAllDay(eventFormData.allDay || false);
    if (eventFormData.color !== undefined) setColor(eventFormData.color || CALENDAR_COLORS[0].value);
    if (eventFormData.calendarId !== undefined) setCalendarId(eventFormData.calendarId || '');
    if (eventFormData.recurrence !== undefined) setRecurrence(eventFormData.recurrence || null);
    if (eventFormData.reminders !== undefined) setReminders(eventFormData.reminders || [{ type: 'popup', minutes: 10 }]);

    // Unified calendar fields
    if (eventFormData.eventSource !== undefined) setEventSource(eventFormData.eventSource || 'personal');
    if (eventFormData.projectId !== undefined) setProjectId(eventFormData.projectId || '');
    if (eventFormData.eventType !== undefined) setEventType(eventFormData.eventType || 'meeting');

    if (eventFormData.start) {
      const start = dayjs(eventFormData.start);
      setStartDate(start.format('YYYY-MM-DD'));
      setStartTime(start.format('HH:mm'));
    }
    if (eventFormData.end) {
      const end = dayjs(eventFormData.end);
      setEndDate(end.format('YYYY-MM-DD'));
      setEndTime(end.format('HH:mm'));
    }
  }, [eventFormData]);

  // Set event source from selected event in edit mode
  useEffect(() => {
    if (isEditMode && selectedEvent) {
      setEventSource(selectedEvent.eventSource || 'personal');
      setProjectId(selectedEvent.projectId || '');
      setEventType(selectedEvent.eventType || 'meeting');
    }
  }, [isEditMode, selectedEvent]);

  // Set default calendar
  useEffect(() => {
    if (!calendarId && calendars.length > 0) {
      const defaultCal = calendars.find((c) => c.isDefault) || calendars[0];
      setCalendarId(defaultCal.id);
    }
  }, [calendars, calendarId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!title.trim()) {
      return;
    }

    const startDateTime = allDay
      ? dayjs(startDate).startOf('day').toISOString()
      : dayjs(`${startDate} ${startTime}`).toISOString();

    const endDateTime = allDay
      ? dayjs(endDate || startDate).endOf('day').toISOString()
      : dayjs(`${endDate || startDate} ${endTime}`).toISOString();

    const eventData = {
      title: title.trim(),
      description: description.trim(),
      location: location.trim(),
      start: startDateTime,
      end: endDateTime,
      allDay,
      color,
      calendarId: calendarId || undefined,
      recurrence: recurrence || undefined,
      reminders: reminders.length > 0 ? reminders : undefined,
      // Unified calendar fields
      eventSource,
      projectId: eventSource === 'project' ? projectId : undefined,
      eventType: eventSource === 'project' ? eventType : undefined,
    };

    let success = false;
    if (isEditMode && selectedEvent) {
      success = await updateEvent(selectedEvent.uid, eventData);
    } else {
      success = await createEvent(eventData);
    }

    if (success) {
      onClose();
    }
  };

  const handleDelete = async () => {
    if (selectedEvent && deleteConfirm) {
      await deleteEvent(selectedEvent.uid);
      onClose();
    } else {
      setDeleteConfirm(true);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-lg mx-4 max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900">
            {isEditMode
              ? selectedEvent?.eventSource === 'bheem_meet'
                ? 'Meeting Details'
                : 'Edit Event'
              : 'Create Event'}
          </h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <X size={20} className="text-gray-500" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-5">
          {/* Read-only notice for Bheem Meet events */}
          {isEditMode && selectedEvent?.eventSource === 'bheem_meet' && (
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-sm text-amber-800">
              This is a Bheem Meet event. To edit or cancel, please use the Bheem Meet app.
            </div>
          )}

          {/* Title */}
          <div>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Add title"
              className="w-full text-xl font-medium border-0 border-b-2 border-gray-200 pb-2 focus:border-blue-500 focus:ring-0 outline-none transition-colors"
              autoFocus
              readOnly={isEditMode && selectedEvent?.eventSource === 'bheem_meet'}
            />
          </div>

          {/* Event Source Selector - Only show for new events */}
          {!isEditMode && (
            <div className="space-y-3">
              <label className="block text-sm font-medium text-gray-700">Event Type</label>
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => setEventSource('personal')}
                  className={`flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-lg border-2 transition-all ${
                    eventSource === 'personal'
                      ? 'border-blue-500 bg-blue-50 text-blue-700'
                      : 'border-gray-200 hover:border-gray-300 text-gray-600'
                  }`}
                >
                  <User size={18} />
                  <span className="font-medium">Personal</span>
                </button>
                <button
                  type="button"
                  onClick={() => setEventSource('project')}
                  className={`flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-lg border-2 transition-all ${
                    eventSource === 'project'
                      ? 'border-green-500 bg-green-50 text-green-700'
                      : 'border-gray-200 hover:border-gray-300 text-gray-600'
                  }`}
                >
                  <Briefcase size={18} />
                  <span className="font-medium">Project</span>
                </button>
              </div>

              {/* Project Selection - Only show if project source selected */}
              {eventSource === 'project' && (
                <div className="space-y-3 pl-1 pt-2">
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">Project</label>
                    <select
                      value={projectId}
                      onChange={(e) => setProjectId(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-green-500 focus:border-green-500"
                    >
                      <option value="">Select a project...</option>
                      {projects.map((project) => (
                        <option key={project.id} value={project.id}>
                          {project.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs text-gray-500 mb-1">Type</label>
                    <select
                      value={eventType}
                      onChange={(e) => setEventType(e.target.value as ERPEventType)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-green-500 focus:border-green-500"
                    >
                      <option value="meeting">Meeting</option>
                      <option value="task">Task</option>
                      <option value="milestone">Milestone</option>
                      <option value="reminder">Reminder</option>
                    </select>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Show event source badge in edit mode */}
          {isEditMode && selectedEvent?.eventSource && (
            <div className="flex items-center gap-2 flex-wrap">
              <span
                className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium"
                style={{
                  backgroundColor: selectedEvent.eventSource === 'bheem_meet' ? '#d1fae5' :
                                   selectedEvent.eventSource === 'personal' ? '#dbeafe' : '#dcfce7',
                  color: selectedEvent.eventSource === 'bheem_meet' ? '#047857' :
                         selectedEvent.eventSource === 'personal' ? '#1d4ed8' : '#166534',
                }}
              >
                {selectedEvent.eventSource === 'bheem_meet' ? (
                  <><Video size={12} /> Bheem Meet</>
                ) : selectedEvent.eventSource === 'personal' ? (
                  <><User size={12} /> Personal</>
                ) : (
                  <><Briefcase size={12} /> Project{selectedEvent.projectName ? `: ${selectedEvent.projectName}` : ''}</>
                )}
              </span>
            </div>
          )}

          {/* Bheem Meet - Join Meeting Button */}
          {isEditMode && selectedEvent?.eventSource === 'bheem_meet' && (selectedEvent.location || selectedEvent.meetingLink) && (
            <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-emerald-500 rounded-lg flex items-center justify-center">
                    <Video size={20} className="text-white" />
                  </div>
                  <div>
                    <p className="font-medium text-emerald-900">Video Meeting</p>
                    <p className="text-sm text-emerald-600 truncate max-w-[200px]">
                      {selectedEvent.location || selectedEvent.meetingLink}
                    </p>
                  </div>
                </div>
                <a
                  href={selectedEvent.location || selectedEvent.meetingLink}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-500 text-white font-medium rounded-lg hover:bg-emerald-600 transition-colors"
                >
                  <Video size={16} />
                  Join Meeting
                  <ExternalLink size={14} />
                </a>
              </div>
            </div>
          )}

          {/* Date & Time */}
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <Clock size={18} className="text-gray-400" />
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={allDay}
                  onChange={(e) => setAllDay(e.target.checked)}
                  className="w-4 h-4 text-blue-500 border-gray-300 rounded focus:ring-blue-500"
                />
                All day
              </label>
            </div>

            <div className="grid grid-cols-2 gap-3 ml-7">
              <div>
                <label className="block text-xs text-gray-500 mb-1">Start</label>
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
              {!allDay && (
                <div>
                  <label className="block text-xs text-gray-500 mb-1">&nbsp;</label>
                  <input
                    type="time"
                    value={startTime}
                    onChange={(e) => setStartTime(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
              )}
            </div>

            <div className="grid grid-cols-2 gap-3 ml-7">
              <div>
                <label className="block text-xs text-gray-500 mb-1">End</label>
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
              {!allDay && (
                <div>
                  <label className="block text-xs text-gray-500 mb-1">&nbsp;</label>
                  <input
                    type="time"
                    value={endTime}
                    onChange={(e) => setEndTime(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
              )}
            </div>
          </div>

          {/* Recurrence */}
          <RecurrenceSelector
            value={recurrence}
            onChange={setRecurrence}
            eventStart={startDate ? new Date(startDate) : new Date()}
          />

          {/* Reminders */}
          <ReminderSelector
            reminders={reminders}
            onChange={setReminders}
          />

          {/* Location */}
          <div className="flex items-start gap-3">
            <MapPin size={18} className="text-gray-400 mt-2" />
            <input
              type="text"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              placeholder="Add location"
              className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>

          {/* Description */}
          <div className="flex items-start gap-3">
            <AlignLeft size={18} className="text-gray-400 mt-2" />
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Add description"
              rows={3}
              className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-none"
            />
          </div>

          {/* Calendar Selection */}
          {calendars.length > 0 && (
            <div className="flex items-center gap-3">
              <Calendar size={18} className="text-gray-400" />
              <select
                value={calendarId}
                onChange={(e) => setCalendarId(e.target.value)}
                className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                {calendars.map((cal) => (
                  <option key={cal.id} value={cal.id}>
                    {cal.name}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Color */}
          <div className="flex items-center gap-3">
            <Palette size={18} className="text-gray-400" />
            <div className="relative">
              <button
                type="button"
                onClick={() => setShowColorPicker(!showColorPicker)}
                className="flex items-center gap-2 px-3 py-2 border border-gray-300 rounded-lg text-sm hover:bg-gray-50"
              >
                <div
                  className="w-4 h-4 rounded-full"
                  style={{ backgroundColor: color }}
                />
                <span className="text-gray-700">
                  {CALENDAR_COLORS.find((c) => c.value === color)?.label || 'Color'}
                </span>
              </button>

              {showColorPicker && (
                <div className="absolute top-full left-0 mt-2 p-3 bg-white rounded-lg shadow-xl border border-gray-200 z-10">
                  <div className="grid grid-cols-5 gap-2">
                    {CALENDAR_COLORS.map((c) => (
                      <button
                        key={c.value}
                        type="button"
                        onClick={() => {
                          setColor(c.value);
                          setShowColorPicker(false);
                        }}
                        className={`
                          w-8 h-8 rounded-full transition-transform hover:scale-110
                          ${color === c.value ? 'ring-2 ring-offset-2 ring-gray-400' : ''}
                        `}
                        style={{ backgroundColor: c.value }}
                        title={c.label}
                      />
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </form>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-gray-200 bg-gray-50">
          {isEditMode && selectedEvent?.eventSource !== 'bheem_meet' ? (
            <button
              type="button"
              onClick={handleDelete}
              className={`
                flex items-center gap-2 px-4 py-2 rounded-lg transition-colors
                ${deleteConfirm
                  ? 'bg-red-500 text-white hover:bg-red-600'
                  : 'text-red-600 hover:bg-red-50'
                }
              `}
            >
              <Trash2 size={18} />
              <span>{deleteConfirm ? 'Confirm Delete' : 'Delete'}</span>
            </button>
          ) : (
            <div />
          )}

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
            >
              {isEditMode && selectedEvent?.eventSource === 'bheem_meet' ? 'Close' : 'Cancel'}
            </button>
            {/* Hide save button for Bheem Meet events (read-only) */}
            {!(isEditMode && selectedEvent?.eventSource === 'bheem_meet') && (
              <button
                onClick={handleSubmit}
                disabled={loading.action || !title.trim()}
                className="px-6 py-2 bg-blue-500 text-white font-medium rounded-lg hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {loading.action ? 'Saving...' : isEditMode ? 'Save' : 'Create'}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
