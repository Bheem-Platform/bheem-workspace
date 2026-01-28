import dayjs from 'dayjs';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useCalendarStore } from '@/stores/calendarStore';
import { useWeekStart } from '@/stores/settingsStore';
import CalendarSearchBar from './CalendarSearchBar';
import AppLauncher from '@/components/shared/AppLauncher';
import { getMonthNames } from '@/lib/dateFormat';
import type { CalendarViewType, CalendarEvent } from '@/types/calendar';

interface CalendarHeaderProps {
  onEventClick?: (event: CalendarEvent) => void;
}

export default function CalendarHeader({ onEventClick }: CalendarHeaderProps = {}) {
  const { currentDate, viewType, navigateDate, setViewType } = useCalendarStore();
  const weekStart = useWeekStart();
  const weekStartDay = weekStart === 'monday' ? 1 : 0;
  const months = getMonthNames();

  const getDateRangeText = () => {
    const current = dayjs(currentDate);
    const monthName = months[current.month()];

    switch (viewType) {
      case 'day':
        return `${monthName} ${current.date()}, ${current.year()}`;
      case 'week': {
        // Adjust week start based on user setting
        let weekStartDate = current.startOf('week');
        if (weekStartDay === 1) {
          // If Monday start, adjust
          const dayOfWeek = current.day();
          weekStartDate = dayOfWeek === 0
            ? current.subtract(6, 'day')
            : current.subtract(dayOfWeek - 1, 'day');
        }
        const weekEndDate = weekStartDate.add(6, 'day');

        if (weekStartDate.month() === weekEndDate.month()) {
          return `${months[weekStartDate.month()]} ${weekStartDate.date()} - ${weekEndDate.date()}, ${weekEndDate.year()}`;
        }
        return `${months[weekStartDate.month()].slice(0, 3)} ${weekStartDate.date()} - ${months[weekEndDate.month()].slice(0, 3)} ${weekEndDate.date()}, ${weekEndDate.year()}`;
      }
      case 'month':
        return `${monthName} ${current.year()}`;
      case 'schedule':
        return `${monthName} ${current.year()}`;
      default:
        return `${monthName} ${current.year()}`;
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
          className="px-4 py-2 text-sm font-medium text-[#0033FF] bg-white border border-[#977DFF] rounded-lg hover:bg-[#FFCCF2]/10 transition-colors"
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
                  ? 'bg-white text-[#0033FF] shadow-sm'
                  : 'text-gray-600 hover:text-[#977DFF]'
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
