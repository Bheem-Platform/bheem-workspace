/**
 * ServiceCard - Service status card with health indicator and metrics
 */
import { LucideIcon, CheckCircle2, AlertCircle, XCircle, ArrowRight } from 'lucide-react';
import Link from 'next/link';

interface ServiceMetric {
  label: string;
  value: string | number;
}

interface ServiceCardProps {
  name: string;
  icon: LucideIcon;
  status: 'operational' | 'degraded' | 'outage';
  metrics: ServiceMetric[];
  actionLabel?: string;
  actionHref?: string;
  color?: 'blue' | 'green' | 'purple' | 'orange';
}

const statusConfig = {
  operational: {
    icon: CheckCircle2,
    text: 'Operational',
    color: 'text-green-600',
    bg: 'bg-green-50',
    dot: 'bg-green-500',
  },
  degraded: {
    icon: AlertCircle,
    text: 'Degraded',
    color: 'text-yellow-600',
    bg: 'bg-yellow-50',
    dot: 'bg-yellow-500',
  },
  outage: {
    icon: XCircle,
    text: 'Outage',
    color: 'text-red-600',
    bg: 'bg-red-50',
    dot: 'bg-red-500',
  },
};

const colorClasses = {
  blue: {
    iconBg: 'bg-blue-100',
    icon: 'text-blue-600',
  },
  green: {
    iconBg: 'bg-green-100',
    icon: 'text-green-600',
  },
  purple: {
    iconBg: 'bg-purple-100',
    icon: 'text-purple-600',
  },
  orange: {
    iconBg: 'bg-orange-100',
    icon: 'text-orange-600',
  },
};

export default function ServiceCard({
  name,
  icon: Icon,
  status,
  metrics,
  actionLabel,
  actionHref,
  color = 'blue',
}: ServiceCardProps) {
  const statusInfo = statusConfig[status];
  const colors = colorClasses[color];
  const StatusIcon = statusInfo.icon;

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-6 hover:shadow-md transition-shadow">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className={`p-2.5 rounded-xl ${colors.iconBg}`}>
            <Icon size={20} className={colors.icon} />
          </div>
          <h3 className="text-lg font-semibold text-gray-900">{name}</h3>
        </div>

        {/* Status indicator */}
        <div className={`flex items-center gap-2 px-3 py-1 rounded-full ${statusInfo.bg}`}>
          <div className={`w-2 h-2 rounded-full ${statusInfo.dot} animate-pulse`} />
          <span className={`text-xs font-medium ${statusInfo.color}`}>
            {statusInfo.text}
          </span>
        </div>
      </div>

      {/* Metrics */}
      <div className="grid grid-cols-2 gap-4 mb-4">
        {metrics.slice(0, 4).map((metric, i) => (
          <div key={i}>
            <p className="text-xs text-gray-500 uppercase tracking-wide">{metric.label}</p>
            <p className="text-lg font-semibold text-gray-900 mt-0.5">{metric.value}</p>
          </div>
        ))}
      </div>

      {/* Action */}
      {actionLabel && actionHref && (
        <Link
          href={actionHref}
          className="flex items-center justify-center gap-2 w-full py-2 text-sm font-medium text-gray-600 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
        >
          {actionLabel}
          <ArrowRight size={14} />
        </Link>
      )}
    </div>
  );
}
