/**
 * KPICard - Key Performance Indicator card with trend indicator
 */
import { LucideIcon, TrendingUp, TrendingDown, Minus } from 'lucide-react';
import Link from 'next/link';

interface KPICardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon: LucideIcon;
  color?: 'blue' | 'green' | 'purple' | 'orange' | 'red' | 'gray';
  trend?: {
    value: number;
    direction: 'up' | 'down' | 'stable';
    label?: string;
  };
  href?: string;
  onClick?: () => void;
}

const colorClasses = {
  blue: {
    bg: 'bg-blue-50',
    icon: 'text-blue-600',
    trend: 'text-blue-600',
  },
  green: {
    bg: 'bg-green-50',
    icon: 'text-green-600',
    trend: 'text-green-600',
  },
  purple: {
    bg: 'bg-purple-50',
    icon: 'text-purple-600',
    trend: 'text-purple-600',
  },
  orange: {
    bg: 'bg-orange-50',
    icon: 'text-orange-600',
    trend: 'text-orange-600',
  },
  red: {
    bg: 'bg-red-50',
    icon: 'text-red-600',
    trend: 'text-red-600',
  },
  gray: {
    bg: 'bg-gray-50',
    icon: 'text-gray-600',
    trend: 'text-gray-600',
  },
};

const trendColors = {
  up: 'text-green-600 bg-green-50',
  down: 'text-red-600 bg-red-50',
  stable: 'text-gray-600 bg-gray-50',
};

export default function KPICard({
  title,
  value,
  subtitle,
  icon: Icon,
  color = 'blue',
  trend,
  href,
  onClick,
}: KPICardProps) {
  const colors = colorClasses[color];

  const TrendIcon = trend?.direction === 'up'
    ? TrendingUp
    : trend?.direction === 'down'
    ? TrendingDown
    : Minus;

  const cardContent = (
    <div className="flex items-start justify-between">
      <div className="flex-1">
        <p className="text-sm font-medium text-gray-500">{title}</p>
        <p className="mt-2 text-3xl font-bold text-gray-900">{value}</p>

        {/* Trend or Subtitle */}
        <div className="mt-2 flex items-center gap-2">
          {trend && (
            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${trendColors[trend.direction]}`}>
              <TrendIcon size={12} />
              {trend.value > 0 ? '+' : ''}{trend.value}%
            </span>
          )}
          {(trend?.label || subtitle) && (
            <span className="text-sm text-gray-500">
              {trend?.label || subtitle}
            </span>
          )}
        </div>
      </div>

      {/* Icon */}
      <div className={`p-3 rounded-xl ${colors.bg}`}>
        <Icon size={24} className={colors.icon} />
      </div>
    </div>
  );

  const cardClasses = `
    bg-white rounded-xl border border-gray-200 p-6
    transition-all duration-200
    ${onClick || href ? 'cursor-pointer hover:shadow-md hover:border-gray-300' : ''}
  `;

  if (href) {
    return (
      <Link href={href} className={cardClasses}>
        {cardContent}
      </Link>
    );
  }

  return (
    <div className={cardClasses} onClick={onClick}>
      {cardContent}
    </div>
  );
}
