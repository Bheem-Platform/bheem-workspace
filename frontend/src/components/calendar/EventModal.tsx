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
} from 'lucide-react';
import { useCalendarStore } from '@/stores/calendarStore';
import { CALENDAR_COLORS } from '@/types/calendar';

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

  // Initialize form with eventFormData
  useEffect(() => {
    if (eventFormData.title !== undefined) setTitle(eventFormData.title || '');
    if (eventFormData.description !== undefined) setDescription(eventFormData.description || '');
    if (eventFormData.location !== undefined) setLocation(eventFormData.location || '');
    if (eventFormData.allDay !== undefined) setAllDay(eventFormData.allDay || false);
    if (eventFormData.color !== undefined) setColor(eventFormData.color || CALENDAR_COLORS[0].value);
    if (eventFormData.calendarId !== undefined) setCalendarId(eventFormData.calendarId || '');

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
            {isEditMode ? 'Edit Event' : 'Create Event'}
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
          {/* Title */}
          <div>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Add title"
              className="w-full text-xl font-medium border-0 border-b-2 border-gray-200 pb-2 focus:border-blue-500 focus:ring-0 outline-none transition-colors"
              autoFocus
            />
          </div>

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
          {isEditMode ? (
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
              Cancel
            </button>
            <button
              onClick={handleSubmit}
              disabled={loading.action || !title.trim()}
              className="px-6 py-2 bg-blue-500 text-white font-medium rounded-lg hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {loading.action ? 'Saving...' : isEditMode ? 'Save' : 'Create'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
