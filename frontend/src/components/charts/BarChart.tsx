/**
 * BarChart - SVG-based bar chart component
 * No external dependencies, pure Tailwind styling
 */
import { useMemo } from 'react';

interface BarData {
  label: string;
  value: number;
  color?: string;
}

interface BarChartProps {
  data: BarData[];
  height?: number;
  showValues?: boolean;
  showLabels?: boolean;
  horizontal?: boolean;
  defaultColor?: string;
}

export default function BarChart({
  data,
  height = 200,
  showValues = true,
  showLabels = true,
  horizontal = false,
  defaultColor = '#3B82F6',
}: BarChartProps) {
  const { bars, maxValue } = useMemo(() => {
    const max = Math.max(...data.map((d) => d.value), 1);
    const barsData = data.map((d) => ({
      ...d,
      percentage: (d.value / max) * 100,
      color: d.color || defaultColor,
    }));
    return { bars: barsData, maxValue: max };
  }, [data, defaultColor]);

  if (!data || data.length === 0) {
    return (
      <div className="flex items-center justify-center h-48 text-gray-400">
        No data available
      </div>
    );
  }

  if (horizontal) {
    return (
      <div className="space-y-3">
        {bars.map((bar, i) => (
          <div key={i} className="flex items-center gap-3">
            {showLabels && (
              <div className="w-24 text-sm text-gray-600 truncate text-right">
                {bar.label}
              </div>
            )}
            <div className="flex-1 h-8 bg-gray-100 rounded-lg overflow-hidden">
              <div
                className="h-full rounded-lg transition-all duration-500 flex items-center justify-end pr-2"
                style={{
                  width: `${bar.percentage}%`,
                  backgroundColor: bar.color,
                  minWidth: showValues ? '40px' : '0',
                }}
              >
                {showValues && (
                  <span className="text-xs font-medium text-white">
                    {bar.value >= 1000 ? `${(bar.value / 1000).toFixed(1)}k` : bar.value}
                  </span>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
    );
  }

  // Vertical bars
  const barWidth = Math.min(60, (400 - 80) / data.length - 10);
  const chartHeight = height - 60;

  return (
    <div className="w-full">
      <svg
        viewBox={`0 0 400 ${height}`}
        className="w-full"
        preserveAspectRatio="xMidYMid meet"
      >
        {/* Y-axis grid lines */}
        {[0, 0.25, 0.5, 0.75, 1].map((ratio) => {
          const y = 20 + chartHeight * (1 - ratio);
          return (
            <g key={ratio}>
              <line
                x1={40}
                y1={y}
                x2={380}
                y2={y}
                stroke="#e5e7eb"
                strokeDasharray="4 4"
              />
              <text
                x={35}
                y={y + 4}
                textAnchor="end"
                fontSize="10"
                fill="#9ca3af"
              >
                {Math.round(maxValue * ratio)}
              </text>
            </g>
          );
        })}

        {/* Bars */}
        {bars.map((bar, i) => {
          const x = 50 + i * ((340 - 50) / (data.length - 1 || 1)) - barWidth / 2;
          const barHeight = (bar.percentage / 100) * chartHeight;
          const y = 20 + chartHeight - barHeight;

          return (
            <g key={i}>
              {/* Bar */}
              <rect
                x={x}
                y={y}
                width={barWidth}
                height={barHeight}
                rx={4}
                fill={bar.color}
                className="transition-all duration-500 hover:opacity-80"
              >
                <title>{`${bar.label}: ${bar.value}`}</title>
              </rect>

              {/* Value label */}
              {showValues && (
                <text
                  x={x + barWidth / 2}
                  y={y - 5}
                  textAnchor="middle"
                  fontSize="10"
                  fontWeight="600"
                  fill="#374151"
                >
                  {bar.value >= 1000 ? `${(bar.value / 1000).toFixed(1)}k` : bar.value}
                </text>
              )}

              {/* X-axis label */}
              {showLabels && (
                <text
                  x={x + barWidth / 2}
                  y={height - 10}
                  textAnchor="middle"
                  fontSize="10"
                  fill="#6b7280"
                >
                  {bar.label.length > 8 ? bar.label.slice(0, 8) + '...' : bar.label}
                </text>
              )}
            </g>
          );
        })}
      </svg>
    </div>
  );
}
