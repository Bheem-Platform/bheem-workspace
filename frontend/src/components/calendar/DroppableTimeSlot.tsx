import { useDroppable } from '@dnd-kit/core';

interface DroppableTimeSlotProps {
  id: string;
  date: Date;
  hour: number;
  isToday?: boolean;
  height: number;
  onClick: () => void;
  children?: React.ReactNode;
}

export default function DroppableTimeSlot({
  id,
  date,
  hour,
  isToday = false,
  height,
  onClick,
  children,
}: DroppableTimeSlotProps) {
  const { setNodeRef, isOver } = useDroppable({
    id,
    data: {
      date,
      hour,
      type: 'time-slot',
    },
  });

  return (
    <div
      ref={setNodeRef}
      onClick={onClick}
      className={`
        border-b border-gray-100 cursor-pointer transition-colors
        ${isToday ? 'bg-blue-50/30' : 'hover:bg-gray-50'}
        ${isOver ? 'bg-blue-100/50 ring-2 ring-inset ring-blue-300' : ''}
      `}
      style={{ height }}
    >
      {children}
    </div>
  );
}

// Droppable day column for all-day events
interface DroppableDayColumnProps {
  id: string;
  date: Date;
  children?: React.ReactNode;
  className?: string;
}

export function DroppableDayColumn({
  id,
  date,
  children,
  className = '',
}: DroppableDayColumnProps) {
  const { setNodeRef, isOver } = useDroppable({
    id,
    data: {
      date,
      type: 'day-column',
    },
  });

  return (
    <div
      ref={setNodeRef}
      className={`
        ${className}
        ${isOver ? 'bg-blue-100/30' : ''}
      `}
    >
      {children}
    </div>
  );
}

// Droppable zone for month view cells
interface DroppableMonthCellProps {
  id: string;
  date: Date;
  children?: React.ReactNode;
  className?: string;
  onClick?: () => void;
}

export function DroppableMonthCell({
  id,
  date,
  children,
  className = '',
  onClick,
}: DroppableMonthCellProps) {
  const { setNodeRef, isOver } = useDroppable({
    id,
    data: {
      date,
      type: 'month-cell',
    },
  });

  return (
    <div
      ref={setNodeRef}
      onClick={onClick}
      className={`
        ${className}
        transition-colors
        ${isOver ? 'bg-blue-100/50 ring-2 ring-inset ring-blue-200' : ''}
      `}
    >
      {children}
    </div>
  );
}
