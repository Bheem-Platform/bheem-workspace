/**
 * Bheem Mail Schedule Send Modal
 * Gmail-style schedule send picker
 */
import { useState } from 'react';
import {
  X,
  Clock,
  Calendar,
  Sun,
  Moon,
  Coffee,
} from 'lucide-react';

interface ScheduleSendModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSchedule: (dateTime: Date) => void;
}

export default function ScheduleSendModal({
  isOpen,
  onClose,
  onSchedule,
}: ScheduleSendModalProps) {
  const [customDate, setCustomDate] = useState('');
  const [customTime, setCustomTime] = useState('09:00');

  if (!isOpen) return null;

  // Calculate quick schedule options
  const now = new Date();
  const tomorrow = new Date(now);
  tomorrow.setDate(tomorrow.getDate() + 1);
  tomorrow.setHours(8, 0, 0, 0);

  const thisAfternoon = new Date(now);
  thisAfternoon.setHours(13, 0, 0, 0);
  const showThisAfternoon = now.getHours() < 13;

  const thisEvening = new Date(now);
  thisEvening.setHours(18, 0, 0, 0);
  const showThisEvening = now.getHours() < 18;

  const nextMonday = new Date(now);
  nextMonday.setDate(now.getDate() + ((1 + 7 - now.getDay()) % 7 || 7));
  nextMonday.setHours(8, 0, 0, 0);

  const formatDate = (date: Date) => {
    return date.toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    });
  };

  const handleCustomSchedule = () => {
    if (!customDate) return;
    const [year, month, day] = customDate.split('-').map(Number);
    const [hours, minutes] = customTime.split(':').map(Number);
    const date = new Date(year, month - 1, day, hours, minutes);
    onSchedule(date);
  };

  const quickOptions = [
    ...(showThisAfternoon
      ? [{ icon: <Sun size={18} />, label: 'Later today', sublabel: '1:00 PM', date: thisAfternoon }]
      : []),
    ...(showThisEvening
      ? [{ icon: <Moon size={18} />, label: 'This evening', sublabel: '6:00 PM', date: thisEvening }]
      : []),
    { icon: <Coffee size={18} />, label: 'Tomorrow morning', sublabel: formatDate(tomorrow), date: tomorrow },
    { icon: <Calendar size={18} />, label: 'Monday morning', sublabel: formatDate(nextMonday), date: nextMonday },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-white rounded-xl shadow-2xl w-[400px]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
          <div className="flex items-center gap-2">
            <Clock className="text-orange-500" size={20} />
            <h2 className="text-lg font-semibold text-gray-900">Schedule send</h2>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg"
          >
            <X size={20} />
          </button>
        </div>

        {/* Quick Options */}
        <div className="p-4 space-y-2">
          {quickOptions.map((option, idx) => (
            <button
              key={idx}
              onClick={() => onSchedule(option.date)}
              className="w-full flex items-center gap-4 px-4 py-3 text-left hover:bg-gray-50 rounded-lg transition-colors"
            >
              <div className="w-10 h-10 bg-orange-100 rounded-lg flex items-center justify-center text-orange-600">
                {option.icon}
              </div>
              <div>
                <p className="font-medium text-gray-900">{option.label}</p>
                <p className="text-sm text-gray-500">{option.sublabel}</p>
              </div>
            </button>
          ))}
        </div>

        {/* Custom Date/Time */}
        <div className="px-4 pb-4">
          <div className="border-t border-gray-200 pt-4">
            <h4 className="text-sm font-medium text-gray-700 mb-3">Pick date & time</h4>
            <div className="flex gap-2">
              <input
                type="date"
                value={customDate}
                onChange={(e) => setCustomDate(e.target.value)}
                min={new Date().toISOString().split('T')[0]}
                className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
              />
              <input
                type="time"
                value={customTime}
                onChange={(e) => setCustomTime(e.target.value)}
                className="w-28 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
              />
            </div>
            <button
              onClick={handleCustomSchedule}
              disabled={!customDate}
              className="w-full mt-3 px-4 py-2 bg-orange-500 text-white rounded-lg hover:bg-orange-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              Schedule
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
