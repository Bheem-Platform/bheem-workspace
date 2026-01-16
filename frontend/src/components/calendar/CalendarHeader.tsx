import dayjs from 'dayjs';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useCalendarStore } from '@/stores/calendarStore';
import CalendarSearchBar from './CalendarSearchBar';
import AppLauncher from '@/components/shared/AppLauncher';
import type { CalendarViewType, CalendarEvent } from '@/types/calendar';

interface CalendarHeaderProps {
  onEventClick?: (event: CalendarEvent) => void;
}

export default function CalendarHeader({ onEventClick }: CalendarHeaderProps = {}) {
  const { currentDate, viewType, navigateDate, setViewType } = useCalendarStore();

  const getDateRangeText = () => {
    const current = dayjs(currentDate);

    switch (viewType) {
      case 'day':
        return current.format('MMMM D, YYYY');
      case 'week': {
        const weekStart = current.startOf('week');
        const weekEnd = current.endOf('week');
        if (weekStart.month() === weekEnd.month()) {
          return `${weekStart.format('MMMM D')} - ${weekEnd.format('D, YYYY')}`;
        }
        return `${weekStart.format('MMM D')} - ${weekEnd.format('MMM D, YYYY')}`;
      }
      case 'month':
        return current.format('MMMM YYYY');
      case 'schedule':
        return current.format('MMMM YYYY');
      default:
        return current.format('MMMM YYYY');
    }
  };

  const viewOptions: { value: CalendarViewType; label: string }[] = [
    { value: 'day', label: 'Day' },
    { value: 'week', label: 'Week' },
    { value: 'month', label: 'Month' },
    { value: 'schedule', label: 'Schedule' },
  ];

  return (
    <div className="flex items-center justify-between px-6 py-4 bg-white border-b border-gray-200">
      {/* Navigation */}
      <div className="flex items-center gap-4">
        <button
          onClick={() => navigateDate('today')}
          className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
        >
          Today
        </button>

        <div className="flex items-center gap-1">
          <button
            onClick={() => navigateDate('prev')}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <ChevronLeft size={20} className="text-gray-600" />
          </button>
          <button
            onClick={() => navigateDate('next')}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <ChevronRight size={20} className="text-gray-600" />
          </button>
        </div>

        <h1 className="text-xl font-semibold text-gray-900">
          {getDateRangeText()}
        </h1>
      </div>

      {/* Search and View Toggle */}
      <div className="flex items-center gap-4">
        {/* Search Bar */}
        <CalendarSearchBar onEventClick={onEventClick} />

        {/* View Toggle */}
        <div className="flex items-center bg-gray-100 rounded-lg p-1">
          {viewOptions.map((option) => (
            <button
              key={option.value}
              onClick={() => setViewType(option.value)}
              className={`
                px-4 py-2 text-sm font-medium rounded-md transition-colors
                ${viewType === option.value
                  ? 'bg-white text-gray-900 shadow-sm'
                  : 'text-gray-600 hover:text-gray-900'
                }
              `}
            >
              {option.label}
            </button>
          ))}
        </div>

        {/* App Launcher */}
        <AppLauncher />
      </div>
    </div>
  );
}
