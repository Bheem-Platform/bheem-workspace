/**
 * Snooze Menu Component
 * Gmail-like snooze options for emails
 */
import { useState, useEffect } from 'react';
import { Clock, Calendar, Sun, ChevronRight } from 'lucide-react';
import { snoozeApi } from '@/lib/mailGmailApi';

interface SnoozeOption {
  id: string;
  label: string;
  time: string;
  icon: React.ReactNode;
}

interface SnoozeMenuProps {
  messageId: string;
  onSnooze: (snoozeUntil: string) => void;
  onClose: () => void;
}

export default function SnoozeMenu({ messageId, onSnooze, onClose }: SnoozeMenuProps) {
  const [options, setOptions] = useState<SnoozeOption[]>([]);
  const [customDate, setCustomDate] = useState('');
  const [customTime, setCustomTime] = useState('09:00');
  const [showCustomPicker, setShowCustomPicker] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const loadOptions = async () => {
      try {
        const response = await snoozeApi.getOptions();
        const optionsList: SnoozeOption[] = [
          {
            id: 'later_today',
            label: response.labels.later_today || 'Later Today',
            time: formatTime(response.options.later_today),
            icon: <Sun size={18} className="text-yellow-500" />
          },
          {
            id: 'tomorrow',
            label: response.labels.tomorrow || 'Tomorrow',
            time: formatTime(response.options.tomorrow),
            icon: <Calendar size={18} className="text-blue-500" />
          },
          {
            id: 'tomorrow_morning',
            label: response.labels.tomorrow_morning || 'Tomorrow Morning',
            time: formatTime(response.options.tomorrow_morning),
            icon: <Sun size={18} className="text-orange-500" />
          },
          {
            id: 'next_week',
            label: response.labels.next_week || 'Next Week',
            time: formatTime(response.options.next_week),
            icon: <Calendar size={18} className="text-purple-500" />
          },
          {
            id: 'next_weekend',
            label: response.labels.next_weekend || 'Next Weekend',
            time: formatTime(response.options.next_weekend),
            icon: <Calendar size={18} className="text-green-500" />
          }
        ];
        setOptions(optionsList);
      } catch (error) {
        console.error('Failed to load snooze options:', error);
      }
    };
    loadOptions();
  }, []);

  const formatTime = (isoString: string): string => {
    const date = new Date(isoString);
    return date.toLocaleString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    });
  };

  const handleSnooze = async (optionId: string) => {
    setLoading(true);
    try {
      const result = await snoozeApi.snooze(messageId, { snooze_option: optionId });
      onSnooze(result.snooze_until);
      onClose();
    } catch (error) {
      console.error('Failed to snooze email:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCustomSnooze = async () => {
    if (!customDate) return;

    setLoading(true);
    try {
      const snoozeUntil = new Date(`${customDate}T${customTime}`).toISOString();
      const result = await snoozeApi.snooze(messageId, { snooze_until: snoozeUntil });
      onSnooze(result.snooze_until);
      onClose();
    } catch (error) {
      console.error('Failed to snooze email:', error);
    } finally {
      setLoading(false);
    }
  };

  // Get minimum date (today)
  const today = new Date().toISOString().split('T')[0];

  return (
    <div className="bg-white rounded-xl shadow-xl border border-gray-200 w-72 overflow-hidden">
      <div className="px-4 py-3 border-b border-gray-100 flex items-center gap-2">
        <Clock size={18} className="text-orange-500" />
        <span className="font-medium text-gray-800">Snooze until...</span>
      </div>

      <div className="py-2">
        {options.map((option) => (
          <button
            key={option.id}
            onClick={() => handleSnooze(option.id)}
            disabled={loading}
            className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-gray-50 transition-colors disabled:opacity-50"
          >
            {option.icon}
            <div className="flex-1 text-left">
              <div className="text-sm font-medium text-gray-700">{option.label}</div>
              <div className="text-xs text-gray-400">{option.time}</div>
            </div>
          </button>
        ))}

        <div className="border-t border-gray-100 my-2" />

        {/* Custom Date/Time Picker */}
        <button
          onClick={() => setShowCustomPicker(!showCustomPicker)}
          className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-gray-50 transition-colors"
        >
          <Calendar size={18} className="text-gray-500" />
          <span className="flex-1 text-left text-sm font-medium text-gray-700">
            Pick date & time
          </span>
          <ChevronRight
            size={16}
            className={`text-gray-400 transition-transform ${showCustomPicker ? 'rotate-90' : ''}`}
          />
        </button>

        {showCustomPicker && (
          <div className="px-4 py-3 space-y-3 bg-gray-50 border-t border-gray-100">
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Date</label>
              <input
                type="date"
                min={today}
                value={customDate}
                onChange={(e) => setCustomDate(e.target.value)}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Time</label>
              <input
                type="time"
                value={customTime}
                onChange={(e) => setCustomTime(e.target.value)}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
              />
            </div>
            <button
              onClick={handleCustomSnooze}
              disabled={!customDate || loading}
              className="w-full px-4 py-2 bg-orange-500 text-white font-medium rounded-lg hover:bg-orange-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-sm"
            >
              {loading ? 'Snoozing...' : 'Snooze'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
