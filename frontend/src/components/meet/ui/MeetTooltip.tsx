import { ReactNode, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

interface MeetTooltipProps {
  content: ReactNode;
  shortcut?: string;
  children: ReactNode;
  position?: 'top' | 'bottom' | 'left' | 'right';
  delay?: number;
}

const positionStyles = {
  top: {
    placement: 'bottom-full left-1/2 -translate-x-1/2 mb-2',
    origin: 'origin-bottom',
  },
  bottom: {
    placement: 'top-full left-1/2 -translate-x-1/2 mt-2',
    origin: 'origin-top',
  },
  left: {
    placement: 'right-full top-1/2 -translate-y-1/2 mr-2',
    origin: 'origin-right',
  },
  right: {
    placement: 'left-full top-1/2 -translate-y-1/2 ml-2',
    origin: 'origin-left',
  },
};

export default function MeetTooltip({
  content,
  shortcut,
  children,
  position = 'top',
  delay = 300,
}: MeetTooltipProps) {
  const [isVisible, setIsVisible] = useState(false);
  const [timeoutId, setTimeoutId] = useState<NodeJS.Timeout | null>(null);

  const handleMouseEnter = () => {
    const id = setTimeout(() => setIsVisible(true), delay);
    setTimeoutId(id);
  };

  const handleMouseLeave = () => {
    if (timeoutId) {
      clearTimeout(timeoutId);
      setTimeoutId(null);
    }
    setIsVisible(false);
  };

  const { placement, origin } = positionStyles[position];

  return (
    <div
      className="relative inline-block"
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      onFocus={handleMouseEnter}
      onBlur={handleMouseLeave}
    >
      {children}
      <AnimatePresence>
        {isVisible && (
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            transition={{ duration: 0.15 }}
            className={`
              absolute ${placement}
              z-50 pointer-events-none
              ${origin}
            `}
          >
            <div className="px-3 py-1.5 bg-gray-900 text-white text-xs font-medium rounded-lg shadow-lg whitespace-nowrap flex items-center gap-2">
              {content}
              {shortcut && (
                <kbd className="px-1.5 py-0.5 bg-gray-700 rounded text-[10px] font-mono">
                  {shortcut}
                </kbd>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
