import { useMemo } from 'react';
import dayjs from 'dayjs';
import { ChevronLeft, ChevronRight } from 'lucide-react';

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
  const weeks = useMemo(() => {
    const start = dayjs(currentDate).startOf('month').startOf('week');
    const end = dayjs(currentDate).endOf('month').endOf('week');

    const result: Date[][] = [];
    let current = start;

    while (current.isBefore(end)) {
      const week: Date[] = [];
      for (let i = 0; i < 7; i++) {
        week.push(current.toDate());
        current = current.add(1, 'day');
      }
      result.push(week);
    }

    return result;
  }, [currentDate]);

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
        {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((day, i) => (
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
                ${selected ? 'bg-blue-500 text-white' : ''}
                ${todayDate && !selected ? 'bg-blue-100 text-blue-600 font-semibold' : ''}
                ${!selected && inMonth ? 'hover:bg-gray-100' : ''}
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
