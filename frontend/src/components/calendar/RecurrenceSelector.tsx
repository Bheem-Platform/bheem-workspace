import { useState, useMemo } from 'react';
import dayjs from 'dayjs';
import { Repeat, ChevronDown, X } from 'lucide-react';
import type { RecurrenceRule } from '@/types/calendar';

interface RecurrenceSelectorProps {
  value: RecurrenceRule | null;
  onChange: (rule: RecurrenceRule | null) => void;
  eventStart: Date;
}

const WEEKDAYS = [
  { id: 'SU', label: 'S', name: 'Sunday' },
  { id: 'MO', label: 'M', name: 'Monday' },
  { id: 'TU', label: 'T', name: 'Tuesday' },
  { id: 'WE', label: 'W', name: 'Wednesday' },
  { id: 'TH', label: 'T', name: 'Thursday' },
  { id: 'FR', label: 'F', name: 'Friday' },
  { id: 'SA', label: 'S', name: 'Saturday' },
];

export default function RecurrenceSelector({
  value,
  onChange,
  eventStart,
}: RecurrenceSelectorProps) {
  const [showCustom, setShowCustom] = useState(false);

  // Format the day name for display
  const dayName = dayjs(eventStart).format('dddd');
  const monthDay = dayjs(eventStart).format('D');
  const monthName = dayjs(eventStart).format('MMMM');

  // Preset options
  const presets = useMemo(() => [
    { label: 'Does not repeat', value: null },
    { label: 'Daily', value: { frequency: 'daily' as const, interval: 1 } },
    { label: `Weekly on ${dayName}`, value: { frequency: 'weekly' as const, interval: 1, byDay: [dayjs(eventStart).format('dd').toUpperCase()] } },
    { label: `Monthly on day ${monthDay}`, value: { frequency: 'monthly' as const, interval: 1, byMonthDay: [parseInt(monthDay)] } },
    { label: `Yearly on ${monthName} ${monthDay}`, value: { frequency: 'yearly' as const, interval: 1, byMonth: [dayjs(eventStart).month() + 1], byMonthDay: [parseInt(monthDay)] } },
    { label: 'Every weekday (Mon-Fri)', value: { frequency: 'weekly' as const, interval: 1, byDay: ['MO', 'TU', 'WE', 'TH', 'FR'] } },
    { label: 'Custom...', value: 'custom' as const },
  ], [eventStart, dayName, monthDay, monthName]);

  // Get current preset label
  const currentLabel = useMemo(() => {
    if (!value) return 'Does not repeat';

    // Match against presets
    for (const preset of presets) {
      if (preset.value === 'custom') continue;
      if (preset.value === null && value === null) return preset.label;
      if (preset.value && value) {
        const pv = preset.value as RecurrenceRule;
        if (pv.frequency === value.frequency &&
            pv.interval === value.interval &&
            JSON.stringify(pv.byDay) === JSON.stringify(value.byDay) &&
            JSON.stringify(pv.byMonthDay) === JSON.stringify(value.byMonthDay)) {
          return preset.label;
        }
      }
    }

    // Custom description
    return formatRecurrenceLabel(value);
  }, [value, presets]);

  const handlePresetChange = (presetValue: RecurrenceRule | null | 'custom') => {
    if (presetValue === 'custom') {
      setShowCustom(true);
    } else {
      onChange(presetValue);
    }
  };

  return (
    <div className="flex items-center gap-3">
      <Repeat size={18} className="text-gray-400" />
      <div className="relative flex-1">
        <select
          value={JSON.stringify(value)}
          onChange={(e) => {
            const val = e.target.value;
            if (val === '"custom"') {
              setShowCustom(true);
            } else if (val === 'null') {
              onChange(null);
            } else {
              try {
                onChange(JSON.parse(val));
              } catch {
                onChange(null);
              }
            }
          }}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 appearance-none cursor-pointer"
        >
          {presets.map((preset, index) => (
            <option
              key={index}
              value={preset.value === 'custom' ? '"custom"' : JSON.stringify(preset.value)}
            >
              {preset.label}
            </option>
          ))}
        </select>
        <ChevronDown
          size={16}
          className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none"
        />
      </div>

      {showCustom && (
        <RecurrenceCustomDialog
          value={value}
          onChange={onChange}
          onClose={() => setShowCustom(false)}
          eventStart={eventStart}
        />
      )}
    </div>
  );
}

// Helper to format recurrence label
function formatRecurrenceLabel(rule: RecurrenceRule): string {
  if (!rule) return 'Does not repeat';

  const interval = rule.interval || 1;
  let label = 'Every ';

  if (interval > 1) {
    label += `${interval} `;
  }

  switch (rule.frequency) {
    case 'daily':
      label += interval > 1 ? 'days' : 'day';
      break;
    case 'weekly':
      label += interval > 1 ? 'weeks' : 'week';
      if (rule.byDay && rule.byDay.length > 0) {
        label += ` on ${rule.byDay.join(', ')}`;
      }
      break;
    case 'monthly':
      label += interval > 1 ? 'months' : 'month';
      if (rule.byMonthDay && rule.byMonthDay.length > 0) {
        label += ` on day ${rule.byMonthDay.join(', ')}`;
      }
      break;
    case 'yearly':
      label += interval > 1 ? 'years' : 'year';
      break;
  }

  if (rule.count) {
    label += `, ${rule.count} times`;
  } else if (rule.until) {
    label += `, until ${dayjs(rule.until).format('MMM D, YYYY')}`;
  }

  return label;
}

// Custom recurrence dialog
interface RecurrenceCustomDialogProps {
  value: RecurrenceRule | null;
  onChange: (rule: RecurrenceRule | null) => void;
  onClose: () => void;
  eventStart: Date;
}

function RecurrenceCustomDialog({
  value,
  onChange,
  onClose,
  eventStart,
}: RecurrenceCustomDialogProps) {
  const [frequency, setFrequency] = useState<RecurrenceRule['frequency']>(
    value?.frequency || 'weekly'
  );
  const [interval, setInterval] = useState(value?.interval || 1);
  const [byDay, setByDay] = useState<string[]>(
    value?.byDay || [dayjs(eventStart).format('dd').toUpperCase()]
  );
  const [byMonthDay, setByMonthDay] = useState<number[]>(
    value?.byMonthDay || [dayjs(eventStart).date()]
  );
  const [endType, setEndType] = useState<'never' | 'count' | 'until'>(
    value?.count ? 'count' : value?.until ? 'until' : 'never'
  );
  const [count, setCount] = useState(value?.count || 10);
  const [until, setUntil] = useState(
    value?.until || dayjs(eventStart).add(1, 'year').format('YYYY-MM-DD')
  );

  const toggleDay = (day: string) => {
    setByDay((prev) =>
      prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day]
    );
  };

  const handleSave = () => {
    const rule: RecurrenceRule = {
      frequency,
      interval,
    };

    if (frequency === 'weekly' && byDay.length > 0) {
      rule.byDay = byDay;
    }

    if (frequency === 'monthly' && byMonthDay.length > 0) {
      rule.byMonthDay = byMonthDay;
    }

    if (endType === 'count') {
      rule.count = count;
    } else if (endType === 'until') {
      rule.until = until;
    }

    onChange(rule);
    onClose();
  };

  const frequencyLabels: Record<string, string> = {
    daily: interval > 1 ? 'days' : 'day',
    weekly: interval > 1 ? 'weeks' : 'week',
    monthly: interval > 1 ? 'months' : 'month',
    yearly: interval > 1 ? 'years' : 'year',
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />

      {/* Dialog */}
      <div className="relative bg-white rounded-xl shadow-2xl w-full max-w-md mx-4 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900">
            Custom recurrence
          </h3>
          <button
            onClick={onClose}
            className="p-1 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <X size={18} className="text-gray-500" />
          </button>
        </div>

        {/* Content */}
        <div className="p-5 space-y-5">
          {/* Repeat every */}
          <div className="flex items-center gap-3">
            <span className="text-sm text-gray-700">Repeat every</span>
            <input
              type="number"
              min={1}
              max={99}
              value={interval}
              onChange={(e) => setInterval(Math.max(1, parseInt(e.target.value) || 1))}
              className="w-16 px-2 py-1.5 border border-gray-300 rounded-lg text-sm text-center focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
            <select
              value={frequency}
              onChange={(e) => setFrequency(e.target.value as RecurrenceRule['frequency'])}
              className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="daily">{frequencyLabels.daily}</option>
              <option value="weekly">{frequencyLabels.weekly}</option>
              <option value="monthly">{frequencyLabels.monthly}</option>
              <option value="yearly">{frequencyLabels.yearly}</option>
            </select>
          </div>

          {/* Weekly day selector */}
          {frequency === 'weekly' && (
            <div>
              <p className="text-sm text-gray-600 mb-2">Repeat on</p>
              <div className="flex gap-1">
                {WEEKDAYS.map((day) => (
                  <button
                    key={day.id}
                    type="button"
                    onClick={() => toggleDay(day.id)}
                    className={`
                      w-9 h-9 rounded-full text-sm font-medium transition-all
                      ${byDay.includes(day.id)
                        ? 'bg-blue-500 text-white'
                        : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                      }
                    `}
                    title={day.name}
                  >
                    {day.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Monthly day selector */}
          {frequency === 'monthly' && (
            <div>
              <p className="text-sm text-gray-600 mb-2">On day</p>
              <select
                value={byMonthDay[0] || 1}
                onChange={(e) => setByMonthDay([parseInt(e.target.value)])}
                className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                {Array.from({ length: 31 }, (_, i) => i + 1).map((day) => (
                  <option key={day} value={day}>
                    {day}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* End options */}
          <div className="space-y-3">
            <p className="text-sm text-gray-600">Ends</p>
            <div className="space-y-2">
              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="radio"
                  checked={endType === 'never'}
                  onChange={() => setEndType('never')}
                  className="w-4 h-4 text-blue-500 border-gray-300 focus:ring-blue-500"
                />
                <span className="text-sm text-gray-700">Never</span>
              </label>

              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="radio"
                  checked={endType === 'count'}
                  onChange={() => setEndType('count')}
                  className="w-4 h-4 text-blue-500 border-gray-300 focus:ring-blue-500"
                />
                <span className="text-sm text-gray-700">After</span>
                <input
                  type="number"
                  min={1}
                  max={999}
                  value={count}
                  onChange={(e) => setCount(Math.max(1, parseInt(e.target.value) || 1))}
                  disabled={endType !== 'count'}
                  className="w-16 px-2 py-1 border border-gray-300 rounded-lg text-sm text-center focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:opacity-50"
                />
                <span className="text-sm text-gray-700">occurrences</span>
              </label>

              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="radio"
                  checked={endType === 'until'}
                  onChange={() => setEndType('until')}
                  className="w-4 h-4 text-blue-500 border-gray-300 focus:ring-blue-500"
                />
                <span className="text-sm text-gray-700">On</span>
                <input
                  type="date"
                  value={until}
                  onChange={(e) => setUntil(e.target.value)}
                  disabled={endType !== 'until'}
                  className="px-2 py-1 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:opacity-50"
                />
              </label>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 px-5 py-4 border-t border-gray-200 bg-gray-50">
          <button
            onClick={onClose}
            className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg transition-colors text-sm"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            className="px-4 py-2 bg-blue-500 text-white font-medium rounded-lg hover:bg-blue-600 transition-colors text-sm"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
