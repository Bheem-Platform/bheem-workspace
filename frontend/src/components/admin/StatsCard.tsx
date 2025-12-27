import { LucideIcon } from 'lucide-react';
import Link from 'next/link';

interface StatsCardProps {
  title: string;
  value: string | number;
  icon: LucideIcon;
  subtitle?: string;
  trend?: {
    value: number;
    direction: 'up' | 'down';
  };
  color?: 'blue' | 'green' | 'purple' | 'orange' | 'red' | 'gray';
  href?: string;
}

const colorClasses = {
  blue: 'bg-blue-100 text-blue-600',
  green: 'bg-green-100 text-green-600',
  purple: 'bg-purple-100 text-purple-600',
  orange: 'bg-orange-100 text-orange-600',
  red: 'bg-red-100 text-red-600',
  gray: 'bg-gray-100 text-gray-600',
};

export default function StatsCard({
  title,
  value,
  icon: Icon,
  subtitle,
  trend,
  color = 'blue',
  href,
}: StatsCardProps) {
  const content = (
    <div className={`bg-white rounded-xl border border-gray-200 p-6 ${href ? 'hover:shadow-md transition-shadow cursor-pointer' : ''}`}>
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <p className="text-sm font-medium text-gray-500">{title}</p>
          <p className="mt-2 text-3xl font-bold text-gray-900">{value}</p>
          {subtitle && (
            <p className="mt-1 text-sm text-gray-500">{subtitle}</p>
          )}
          {trend && (
            <p className={`mt-2 text-sm font-medium ${
              trend.direction === 'up' ? 'text-green-600' : 'text-red-600'
            }`}>
              {trend.direction === 'up' ? '↑' : '↓'} {Math.abs(trend.value)}%
              <span className="text-gray-500 font-normal ml-1">vs last month</span>
            </p>
          )}
        </div>
        <div className={`p-3 rounded-xl ${colorClasses[color]}`}>
          <Icon size={24} />
        </div>
      </div>
    </div>
  );

  if (href) {
    return <Link href={href}>{content}</Link>;
  }

  return content;
}
