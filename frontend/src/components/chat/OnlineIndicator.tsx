/**
 * Online status indicator dot
 */

interface OnlineIndicatorProps {
  isOnline: boolean;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

export default function OnlineIndicator({ isOnline, size = 'md', className = '' }: OnlineIndicatorProps) {
  const sizeClasses = {
    sm: 'w-2 h-2',
    md: 'w-3 h-3',
    lg: 'w-4 h-4',
  };

  return (
    <span
      className={`
        inline-block rounded-full border-2 border-white
        ${sizeClasses[size]}
        ${isOnline ? 'bg-green-500' : 'bg-gray-400'}
        ${className}
      `}
      title={isOnline ? 'Online' : 'Offline'}
    />
  );
}
