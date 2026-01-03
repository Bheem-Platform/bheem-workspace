import { ReactNode } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X } from 'lucide-react';

interface MeetPanelProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  children: ReactNode;
  position?: 'left' | 'right';
  width?: number;
  headerActions?: ReactNode;
}

export default function MeetPanel({
  isOpen,
  onClose,
  title,
  subtitle,
  children,
  position = 'right',
  width = 320,
  headerActions,
}: MeetPanelProps) {
  const slideDirection = position === 'right' ? 1 : -1;

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ x: slideDirection * width, opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          exit={{ x: slideDirection * width, opacity: 0 }}
          transition={{ type: 'spring', damping: 25, stiffness: 300 }}
          className={`
            h-full flex flex-col
            bg-gray-800/95 backdrop-blur-md
            border-l border-gray-700
          `}
          style={{ width }}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-700">
            <div>
              <h3 className="text-base font-semibold text-white">{title}</h3>
              {subtitle && (
                <p className="text-xs text-gray-400 mt-0.5">{subtitle}</p>
              )}
            </div>
            <div className="flex items-center gap-2">
              {headerActions}
              <button
                onClick={onClose}
                className="p-1.5 rounded-full text-gray-400 hover:text-white hover:bg-gray-700 transition-colors"
              >
                <X size={18} />
              </button>
            </div>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-hidden">{children}</div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

// Panel Section Component
export function MeetPanelSection({
  title,
  children,
  action,
}: {
  title?: string;
  children: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="px-4 py-3">
      {(title || action) && (
        <div className="flex items-center justify-between mb-2">
          {title && (
            <h4 className="text-xs font-medium text-gray-400 uppercase tracking-wider">
              {title}
            </h4>
          )}
          {action}
        </div>
      )}
      {children}
    </div>
  );
}

// Panel Divider
export function MeetPanelDivider() {
  return <div className="border-t border-gray-700 my-1" />;
}
