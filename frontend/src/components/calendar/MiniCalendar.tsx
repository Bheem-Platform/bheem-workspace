import { useMemo } from 'react';
import dayjs from 'dayjs';
import weekday from 'dayjs/plugin/weekday';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useWeekStart } from '@/stores/settingsStore';

// Extend dayjs with weekday plugin
dayjs.extend(weekday);

interface MiniCalendarProps {
  currentDate: Date;
  selectedDate: Date | null;
  onDateSelect: (date: Date) => void;
  onMonthChange: (date: Date) => void;
}

export default function MiniCalendar({
  currentDate,
  selectedDate,
  onDateSelect,
  onMonthChange,
}: MiniCalendarProps) {
  // Get week start from settings - using selector hook for proper reactivity
  const weekStart = useWeekStart();
  const weekStartDay = weekStart === 'monday' ? 1 : 0;

  // Get day headers based on week start
  const dayHeaders = useMemo(() => {
    const days = weekStart === 'monday'
      ? ['M', 'T', 'W', 'T', 'F', 'S', 'S']
      : ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
    return days;
  }, [weekStart]);

  const weeks = useMemo(() => {
    const monthStart = dayjs(currentDate).startOf('month');
    const monthEnd = dayjs(currentDate).endOf('month');

    // Calculate the start of the calendar grid
    let start = monthStart.day() - weekStartDay;
    if (start < 0) start += 7;
    const calendarStart = monthStart.subtract(start, 'day');

    // Calculate the end of the calendar grid
    let end = 6 - (monthEnd.day() - weekStartDay);
    if (end < 0) end += 7;
    if (end === 7) end = 0;
    const calendarEnd = monthEnd.add(end, 'day');

    const result: Date[][] = [];
    let current = calendarStart;

    while (current.isBefore(calendarEnd) || current.isSame(calendarEnd, 'day')) {
      const week: Date[] = [];
      for (let i = 0; i < 7; i++) {
        week.push(current.toDate());
        current = current.add(1, 'day');
      }
      result.push(week);
    }

    return result;
  }, [currentDate, weekStartDay]);

  const today = dayjs().startOf('day');
  const currentMonth = dayjs(currentDate).month();

  const handlePrevMonth = () => {
    onMonthChange(dayjs(currentDate).subtract(1, 'month').toDate());
  };

  const handleNextMonth = () => {
    onMonthChange(dayjs(currentDate).add(1, 'month').toDate());
  };

  const isSelected = (date: Date) => {
    if (!selectedDate) return false;
    return dayjs(date).isSame(dayjs(selectedDate), 'day');
  };

  const isToday = (date: Date) => {
    return dayjs(date).isSame(today, 'day');
  };

  const isCurrentMonth = (date: Date) => {
    return dayjs(date).month() === currentMonth;
  };

  return (
    <div className="p-3">
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <button
          onClick={handlePrevMonth}
          className="p-1 hover:bg-gray-100 rounded"
        >
          <ChevronLeft size={16} className="text-gray-600" />
        </button>
        <span className="text-sm font-medium text-gray-900">
          {dayjs(currentDate).format('MMMM YYYY')}
        </span>
        <button
          onClick={handleNextMonth}
          className="p-1 hover:bg-gray-100 rounded"
        >
          <ChevronRight size={16} className="text-gray-600" />
        </button>
      </div>

      {/* Day headers */}
      <div className="grid grid-cols-7 gap-1 mb-1">
        {dayHeaders.map((day, i) => (
          <div
            key={i}
            className="text-xs font-medium text-gray-500 text-center py-1"
          >
            {day}
          </div>
        ))}
      </div>

      {/* Calendar grid */}
      <div className="grid grid-cols-7 gap-1">
        {weeks.flat().map((date, i) => {
          const selected = isSelected(date);
          const todayDate = isToday(date);
          const inMonth = isCurrentMonth(date);

          return (
            <button
              key={i}
              onClick={() => onDateSelect(date)}
              className={`
                w-7 h-7 text-xs rounded-full flex items-center justify-center
                transition-colors
                ${!inMonth ? 'text-gray-300' : 'text-gray-700'}
                ${selected ? 'bg-[#977DFF] text-white' : ''}
                ${todayDate && !selected ? 'bg-[#FFCCF2]/30 text-[#0033FF] font-semibold' : ''}
                ${!selected && inMonth ? 'hover:bg-[#FFCCF2]/20' : ''}
              `}
            >
              {dayjs(date).date()}
            </button>
          );
        })}
      </div>
    </div>
  );
}
