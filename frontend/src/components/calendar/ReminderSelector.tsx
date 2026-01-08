import { useState } from 'react';
import { Bell, Plus, X, Mail, Smartphone, MessageCircle } from 'lucide-react';
import type { Reminder } from '@/types/calendar';

interface ReminderSelectorProps {
  reminders: Reminder[];
  onChange: (reminders: Reminder[]) => void;
}

const PRESET_TIMES = [
  { label: 'At time of event', value: 0 },
  { label: '5 minutes before', value: 5 },
  { label: '10 minutes before', value: 10 },
  { label: '15 minutes before', value: 15 },
  { label: '30 minutes before', value: 30 },
  { label: '1 hour before', value: 60 },
  { label: '2 hours before', value: 120 },
  { label: '1 day before', value: 1440 },
  { label: '2 days before', value: 2880 },
  { label: '1 week before', value: 10080 },
];

const REMINDER_TYPES = [
  { value: 'popup', label: 'Notification', icon: Bell },
  { value: 'email', label: 'Email', icon: Mail },
  { value: 'sms', label: 'SMS', icon: Smartphone },
];

export default function ReminderSelector({
  reminders,
  onChange,
}: ReminderSelectorProps) {
  const addReminder = () => {
    onChange([...reminders, { type: 'popup', minutes: 10 }]);
  };

  const removeReminder = (index: number) => {
    onChange(reminders.filter((_, i) => i !== index));
  };

  const updateReminder = (index: number, updates: Partial<Reminder>) => {
    onChange(
      reminders.map((r, i) => (i === index ? { ...r, ...updates } : r))
    );
  };

  const getTypeIcon = (type: string) => {
    const typeConfig = REMINDER_TYPES.find((t) => t.value === type);
    return typeConfig?.icon || Bell;
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <Bell size={18} className="text-gray-400" />
        <span className="text-sm font-medium text-gray-700">Notifications</span>
      </div>

      {reminders.length > 0 && (
        <div className="ml-7 space-y-2">
          {reminders.map((reminder, index) => {
            const TypeIcon = getTypeIcon(reminder.type);
            return (
              <div
                key={index}
                className="flex items-center gap-2 p-2 bg-gray-50 rounded-lg"
              >
                {/* Reminder Type */}
                <div className="relative">
                  <select
                    value={reminder.type}
                    onChange={(e) =>
                      updateReminder(index, {
                        type: e.target.value as Reminder['type'],
                      })
                    }
                    className="appearance-none pl-8 pr-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white"
                  >
                    {REMINDER_TYPES.map((type) => (
                      <option key={type.value} value={type.value}>
                        {type.label}
                      </option>
                    ))}
                  </select>
                  <TypeIcon
                    size={14}
                    className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400"
                  />
                </div>

                {/* Time */}
                <select
                  value={reminder.minutes}
                  onChange={(e) =>
                    updateReminder(index, { minutes: parseInt(e.target.value) })
                  }
                  className="flex-1 px-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white"
                >
                  {PRESET_TIMES.map((time) => (
                    <option key={time.value} value={time.value}>
                      {time.label}
                    </option>
                  ))}
                </select>

                {/* Remove Button */}
                <button
                  type="button"
                  onClick={() => removeReminder(index)}
                  className="p-1 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded transition-colors"
                  title="Remove reminder"
                >
                  <X size={16} />
                </button>
              </div>
            );
          })}
        </div>
      )}

      {/* Add Reminder Button */}
      <button
        type="button"
        onClick={addReminder}
        className="ml-7 flex items-center gap-1.5 text-sm text-blue-500 hover:text-blue-600 transition-colors"
      >
        <Plus size={16} />
        <span>Add notification</span>
      </button>

      {reminders.length === 0 && (
        <p className="ml-7 text-xs text-gray-500">
          No reminders set. Click "Add notification" to get reminded.
        </p>
      )}
    </div>
  );
}

// Utility function to format reminder for display
export function formatReminder(reminder: Reminder): string {
  const typeLabels: Record<string, string> = {
    popup: 'Notification',
    email: 'Email',
    sms: 'SMS',
  };

  const timeLabel = PRESET_TIMES.find((t) => t.value === reminder.minutes)?.label;

  return `${typeLabels[reminder.type] || reminder.type} - ${timeLabel || `${reminder.minutes} min before`}`;
}
