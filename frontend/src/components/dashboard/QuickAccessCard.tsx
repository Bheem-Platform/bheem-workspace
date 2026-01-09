/**
 * QuickAccessCard - App quick access card with activity badge
 */
import { LucideIcon, ExternalLink } from 'lucide-react';
import Link from 'next/link';

interface QuickAccessCardProps {
  id?: string;
  name: string;
  description: string;
  icon: LucideIcon;
  href: string;
  external?: boolean;
  disabled?: boolean;
  color?: 'blue' | 'green' | 'purple' | 'orange';
  badge?: number | {
    count: number;
    type?: 'unread' | 'pending' | 'active';
  };
  lastActivity?: string;
}

const colorClasses = {
  blue: {
    bg: 'bg-blue-50',
    iconBg: 'bg-blue-100',
    icon: 'text-blue-600',
    border: 'border-blue-200',
    hoverBorder: 'hover:border-blue-400',
    badge: 'bg-blue-600',
  },
  green: {
    bg: 'bg-green-50',
    iconBg: 'bg-green-100',
    icon: 'text-green-600',
    border: 'border-green-200',
    hoverBorder: 'hover:border-green-400',
    badge: 'bg-green-600',
  },
  purple: {
    bg: 'bg-purple-50',
    iconBg: 'bg-purple-100',
    icon: 'text-purple-600',
    border: 'border-purple-200',
    hoverBorder: 'hover:border-purple-400',
    badge: 'bg-purple-600',
  },
  orange: {
    bg: 'bg-orange-50',
    iconBg: 'bg-orange-100',
    icon: 'text-orange-600',
    border: 'border-orange-200',
    hoverBorder: 'hover:border-orange-400',
    badge: 'bg-orange-600',
  },
};

export default function QuickAccessCard({
  id,
  name,
  description,
  icon: Icon,
  href,
  external = false,
  disabled = false,
  color = 'blue',
  badge,
  lastActivity,
}: QuickAccessCardProps) {
  const colors = colorClasses[color];

  const CardContent = (
    <div
      className={`
        relative bg-white rounded-xl border p-6
        transition-all duration-200
        ${disabled
          ? 'opacity-60 cursor-not-allowed border-gray-200'
          : `${colors.border} ${colors.hoverBorder} cursor-pointer hover:shadow-lg hover:-translate-y-0.5`
        }
      `}
    >
      {/* Badge */}
      {badge && (typeof badge === 'number' ? badge > 0 : badge.count > 0) && (
        <div className={`absolute -top-2 -right-2 ${colors.badge} text-white text-xs font-bold rounded-full min-w-[24px] h-6 flex items-center justify-center px-2`}>
          {typeof badge === 'number'
            ? (badge > 99 ? '99+' : badge)
            : (badge.count > 99 ? '99+' : badge.count)
          }
        </div>
      )}

      {/* Icon */}
      <div className={`w-14 h-14 ${colors.iconBg} rounded-xl flex items-center justify-center mb-4`}>
        <Icon size={28} className={colors.icon} />
      </div>

      {/* Content */}
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
            {name}
            {external && <ExternalLink size={14} className="text-gray-400" />}
          </h3>
          <p className="text-sm text-gray-500 mt-1">{description}</p>
        </div>
      </div>

      {/* Last activity */}
      {lastActivity && (
        <div className="mt-4 pt-4 border-t border-gray-100">
          <p className="text-xs text-gray-400">{lastActivity}</p>
        </div>
      )}

      {/* Disabled overlay */}
      {disabled && (
        <div className="absolute inset-0 bg-white/50 rounded-xl flex items-center justify-center">
          <span className="text-sm text-gray-500 bg-white px-3 py-1 rounded-full border border-gray-200">
            Coming Soon
          </span>
        </div>
      )}
    </div>
  );

  if (disabled) {
    return CardContent;
  }

  if (external) {
    return (
      <a href={href} target="_blank" rel="noopener noreferrer">
        {CardContent}
      </a>
    );
  }

  return (
    <Link href={href}>
      {CardContent}
    </Link>
  );
}
