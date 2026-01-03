import { forwardRef, ReactNode } from 'react';
import { motion, type HTMLMotionProps } from 'framer-motion';
import MeetTooltip from './ui/MeetTooltip';

interface ControlButtonProps {
  icon: ReactNode;
  label?: string;
  shortcut?: string;
  isActive?: boolean;
  isDestructive?: boolean;
  variant?: 'default' | 'primary' | 'danger';
  size?: 'sm' | 'md' | 'lg';
  showLabel?: boolean;
  disabled?: boolean;
  className?: string;
  onClick?: () => void;
}

const ControlButton = forwardRef<HTMLButtonElement, ControlButtonProps>(
  (
    {
      icon,
      label,
      shortcut,
      isActive = false,
      isDestructive = false,
      variant = 'default',
      size = 'md',
      showLabel = false,
      disabled,
      className = '',
      onClick,
    },
    ref
  ) => {
    const sizeStyles = {
      sm: 'p-2.5',
      md: 'p-3.5',
      lg: 'p-4',
    };

    const iconSizes = {
      sm: 18,
      md: 20,
      lg: 24,
    };

    const getVariantStyles = () => {
      if (disabled) {
        return 'bg-gray-700/50 text-gray-500 cursor-not-allowed';
      }

      if (variant === 'danger' || isDestructive) {
        return 'bg-red-500 text-white hover:bg-red-600 shadow-lg shadow-red-500/20';
      }

      if (variant === 'primary') {
        return 'bg-emerald-500 text-white hover:bg-emerald-600';
      }

      if (isActive) {
        return 'bg-emerald-500/20 text-emerald-400 ring-1 ring-emerald-500/50 hover:bg-emerald-500/30';
      }

      return 'bg-gray-700/80 text-white hover:bg-gray-600/90';
    };

    const button = (
      <motion.button
        ref={ref}
        whileHover={{ scale: disabled ? 1 : 1.05 }}
        whileTap={{ scale: disabled ? 1 : 0.95 }}
        disabled={disabled}
        onClick={onClick}
        className={`
          ${sizeStyles[size]}
          ${getVariantStyles()}
          rounded-full
          backdrop-blur-sm
          transition-all duration-150
          focus:outline-none focus-visible:ring-2 focus-visible:ring-white/50
          flex items-center justify-center gap-2
          ${className}
        `}
      >
        {icon}
        {showLabel && label && (
          <span className="text-sm font-medium">{label}</span>
        )}
      </motion.button>
    );

    if (label && !showLabel) {
      return (
        <MeetTooltip content={label} shortcut={shortcut}>
          {button}
        </MeetTooltip>
      );
    }

    return button;
  }
);

ControlButton.displayName = 'ControlButton';

export default ControlButton;
