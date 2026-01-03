import { ReactNode } from 'react';

interface MeetAvatarProps {
  name?: string;
  src?: string;
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  status?: 'online' | 'speaking' | 'muted';
  className?: string;
}

const sizeStyles = {
  xs: 'w-6 h-6 text-xs',
  sm: 'w-8 h-8 text-sm',
  md: 'w-10 h-10 text-base',
  lg: 'w-14 h-14 text-lg',
  xl: 'w-20 h-20 text-2xl',
};

const statusStyles = {
  online: 'ring-2 ring-emerald-500',
  speaking: 'ring-2 ring-emerald-400 animate-pulse',
  muted: 'ring-2 ring-red-500',
};

// Generate a consistent color based on name
function getAvatarColor(name: string): string {
  const colors = [
    'from-emerald-400 to-emerald-600',
    'from-blue-400 to-blue-600',
    'from-purple-400 to-purple-600',
    'from-pink-400 to-pink-600',
    'from-orange-400 to-orange-600',
    'from-cyan-400 to-cyan-600',
    'from-amber-400 to-amber-600',
    'from-indigo-400 to-indigo-600',
  ];

  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }

  return colors[Math.abs(hash) % colors.length];
}

function getInitials(name: string): string {
  if (!name) return '?';
  const parts = name.trim().split(' ');
  if (parts.length === 1) {
    return parts[0].charAt(0).toUpperCase();
  }
  return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase();
}

export default function MeetAvatar({
  name = 'Unknown',
  src,
  size = 'md',
  status,
  className = '',
}: MeetAvatarProps) {
  const colorGradient = getAvatarColor(name);
  const initials = getInitials(name);

  return (
    <div
      className={`
        relative inline-flex items-center justify-center
        rounded-full overflow-hidden
        ${sizeStyles[size]}
        ${status ? statusStyles[status] : ''}
        ${className}
      `}
    >
      {src ? (
        <img
          src={src}
          alt={name}
          className="w-full h-full object-cover"
        />
      ) : (
        <div
          className={`
            w-full h-full flex items-center justify-center
            bg-gradient-to-br ${colorGradient}
            text-white font-semibold
          `}
        >
          {initials}
        </div>
      )}
    </div>
  );
}

// Avatar Group Component
interface MeetAvatarGroupProps {
  avatars: Array<{ name?: string; src?: string }>;
  max?: number;
  size?: 'xs' | 'sm' | 'md';
}

export function MeetAvatarGroup({
  avatars,
  max = 4,
  size = 'sm',
}: MeetAvatarGroupProps) {
  const visible = avatars.slice(0, max);
  const remaining = avatars.length - max;

  const overlapStyles = {
    xs: '-ml-1.5',
    sm: '-ml-2',
    md: '-ml-3',
  };

  return (
    <div className="flex items-center">
      {visible.map((avatar, index) => (
        <div
          key={index}
          className={`
            ${index > 0 ? overlapStyles[size] : ''}
            ring-2 ring-gray-800 rounded-full
          `}
        >
          <MeetAvatar
            name={avatar.name}
            src={avatar.src}
            size={size}
          />
        </div>
      ))}
      {remaining > 0 && (
        <div
          className={`
            ${overlapStyles[size]}
            ${sizeStyles[size]}
            rounded-full bg-gray-700 ring-2 ring-gray-800
            flex items-center justify-center
            text-gray-300 font-medium
          `}
        >
          +{remaining}
        </div>
      )}
    </div>
  );
}
