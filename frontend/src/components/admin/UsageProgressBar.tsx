interface UsageProgressBarProps {
  used: number;
  quota: number;
  unit?: 'MB' | 'GB' | 'hours' | 'users';
  showPercent?: boolean;
  showValues?: boolean;
  warningThreshold?: number;
  criticalThreshold?: number;
  label?: string;
}

export default function UsageProgressBar({
  used,
  quota,
  unit = 'MB',
  showPercent = true,
  showValues = true,
  warningThreshold = 75,
  criticalThreshold = 90,
  label,
}: UsageProgressBarProps) {
  const percent = quota > 0 ? Math.min((used / quota) * 100, 100) : 0;

  const getBarColor = () => {
    if (percent >= criticalThreshold) return 'bg-red-500';
    if (percent >= warningThreshold) return 'bg-orange-500';
    return 'bg-blue-500';
  };

  const formatValue = (value: number) => {
    if (unit === 'GB' || (unit === 'MB' && value >= 1024)) {
      return `${(value / 1024).toFixed(1)} GB`;
    }
    if (unit === 'hours') {
      return `${value.toFixed(1)} hrs`;
    }
    if (unit === 'users') {
      return `${Math.round(value)}`;
    }
    return `${value.toFixed(1)} MB`;
  };

  return (
    <div className="space-y-2">
      {(label || showPercent) && (
        <div className="flex items-center justify-between text-sm">
          {label && <span className="text-gray-600">{label}</span>}
          {showPercent && (
            <span className={`font-medium ${
              percent >= criticalThreshold ? 'text-red-600' :
              percent >= warningThreshold ? 'text-orange-600' : 'text-gray-900'
            }`}>
              {percent.toFixed(1)}%
            </span>
          )}
        </div>
      )}
      <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-300 ${getBarColor()}`}
          style={{ width: `${percent}%` }}
        />
      </div>
      {showValues && (
        <div className="flex items-center justify-between text-xs text-gray-500">
          <span>{formatValue(used)} used</span>
          <span>{formatValue(quota)} total</span>
        </div>
      )}
    </div>
  );
}
