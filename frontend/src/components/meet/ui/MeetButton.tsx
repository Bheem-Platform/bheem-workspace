import { forwardRef, ButtonHTMLAttributes, ReactNode } from 'react';
import { motion, HTMLMotionProps } from 'framer-motion';

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'control';
type ButtonSize = 'sm' | 'md' | 'lg' | 'icon';

interface MeetButtonProps extends Omit<HTMLMotionProps<'button'>, 'children'> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  isActive?: boolean;
  isLoading?: boolean;
  leftIcon?: ReactNode;
  rightIcon?: ReactNode;
  children?: ReactNode;
}

const variantStyles: Record<ButtonVariant, string> = {
  primary: `
    bg-emerald-500 text-white
    hover:bg-emerald-600
    active:bg-emerald-700
    disabled:bg-emerald-500/50
  `,
  secondary: `
    bg-gray-700 text-white
    hover:bg-gray-600
    active:bg-gray-500
    disabled:bg-gray-700/50
  `,
  ghost: `
    bg-transparent text-gray-300
    hover:bg-gray-700/50 hover:text-white
    active:bg-gray-600/50
  `,
  danger: `
    bg-red-500 text-white
    hover:bg-red-600
    active:bg-red-700
    disabled:bg-red-500/50
  `,
  control: `
    bg-gray-700/80 text-white
    hover:bg-gray-600/90
    active:bg-gray-500/90
    backdrop-blur-md
  `,
};

const activeVariantStyles: Record<ButtonVariant, string> = {
  primary: 'ring-2 ring-emerald-400/50',
  secondary: 'bg-gray-600',
  ghost: 'bg-gray-700/50 text-white',
  danger: 'ring-2 ring-red-400/50',
  control: 'bg-emerald-500/20 text-emerald-400 ring-1 ring-emerald-500/50',
};

const sizeStyles: Record<ButtonSize, string> = {
  sm: 'px-3 py-1.5 text-sm gap-1.5',
  md: 'px-4 py-2 text-sm gap-2',
  lg: 'px-6 py-3 text-base gap-2',
  icon: 'p-3',
};

const MeetButton = forwardRef<HTMLButtonElement, MeetButtonProps>(
  (
    {
      variant = 'primary',
      size = 'md',
      isActive = false,
      isLoading = false,
      leftIcon,
      rightIcon,
      children,
      className = '',
      disabled,
      ...props
    },
    ref
  ) => {
    const baseStyles = `
      inline-flex items-center justify-center
      font-medium rounded-full
      transition-colors duration-150
      focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2 focus-visible:ring-offset-gray-900
      disabled:cursor-not-allowed disabled:opacity-50
    `;

    return (
      <motion.button
        ref={ref}
        whileHover={{ scale: disabled ? 1 : 1.02 }}
        whileTap={{ scale: disabled ? 1 : 0.98 }}
        className={`
          ${baseStyles}
          ${variantStyles[variant]}
          ${isActive ? activeVariantStyles[variant] : ''}
          ${sizeStyles[size]}
          ${className}
        `}
        disabled={disabled || isLoading}
        {...props}
      >
        {isLoading ? (
          <svg
            className="animate-spin h-4 w-4"
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
          >
            <circle
              className="opacity-25"
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              strokeWidth="4"
            />
            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
            />
          </svg>
        ) : (
          <>
            {leftIcon && <span className="flex-shrink-0">{leftIcon}</span>}
            {children}
            {rightIcon && <span className="flex-shrink-0">{rightIcon}</span>}
          </>
        )}
      </motion.button>
    );
  }
);

MeetButton.displayName = 'MeetButton';

export default MeetButton;
