/**
 * LineChart - SVG-based line chart component
 * No external dependencies, pure Tailwind styling
 */
import { useMemo } from 'react';

interface DataPoint {
  label: string;
  value: number;
}

interface LineChartProps {
  data: DataPoint[];
  height?: number;
  color?: 'blue' | 'green' | 'purple' | 'orange';
  showArea?: boolean;
  showDots?: boolean;
  showGrid?: boolean;
  showLabels?: boolean;
  
}

const colorClasses = {
  blue: { stroke: '#3B82F6', fill: 'rgba(59, 130, 246, 0.1)' },
  green: { stroke: '#22C55E', fill: 'rgba(34, 197, 94, 0.1)' },
  purple: { stroke: '#A855F7', fill: 'rgba(168, 85, 247, 0.1)' },
  orange: { stroke: '#F97316', fill: 'rgba(249, 115, 22, 0.1)' },
};

export default function LineChart({
  data,
  height = 200,
  color = 'blue',
  showArea = true,
  showDots = true,
  showGrid = true,
  showLabels = true,
}: LineChartProps) {
  const padding = { top: 20, right: 20, bottom: 40, left: 50 };
  const width = 100; // Percentage-based for responsiveness

  const { points, areaPath, linePath, maxValue, minValue } = useMemo(() => {
    if (!data || data.length === 0) {
      return { points: [], areaPath: '', linePath: '', maxValue: 0, minValue: 0 };
    }

    const values = data.map((d) => d.value);
    const max = Math.max(...values);
    const min = Math.min(...values, 0);
    const range = max - min || 1;

    const chartWidth = 100 - ((padding.left + padding.right) / 400) * 100;
    const chartHeight = height - padding.top - padding.bottom;

    const pts = data.map((d, i) => {
      const x = padding.left + (i / (data.length - 1 || 1)) * (400 - padding.left - padding.right);
      const y = padding.top + chartHeight - ((d.value - min) / range) * chartHeight;
      return { x, y, ...d };
    });

    const linePathStr = pts.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');

    const areaPathStr = pts.length > 0
      ? `${linePathStr} L ${pts[pts.length - 1].x} ${padding.top + chartHeight} L ${pts[0].x} ${padding.top + chartHeight} Z`
      : '';

    return {
      points: pts,
      linePath: linePathStr,
      areaPath: areaPathStr,
      maxValue: max,
      minValue: min,
    };
  }, [data, height, padding]);

  if (!data || data.length === 0) {
    return (
      <div className="flex items-center justify-center h-48 text-gray-400">
        No data available
      </div>
    );
  }

  const colors = colorClasses[color];
  const chartHeight = height - padding.top - padding.bottom;

  return (
    <div className="w-full">
      <svg
        viewBox={`0 0 400 ${height}`}
        className="w-full"
        preserveAspectRatio="xMidYMid meet"
      >
        {/* Grid lines */}
        {showGrid && (
          <g className="text-gray-200">
            {[0, 0.25, 0.5, 0.75, 1].map((ratio) => {
              const y = padding.top + chartHeight * (1 - ratio);
              return (
                <line
                  key={ratio}
                  x1={padding.left}
                  y1={y}
                  x2={400 - padding.right}
                  y2={y}
                  stroke="currentColor"
                  strokeDasharray="4 4"
                  opacity={0.5}
                />
              );
            })}
          </g>
        )}

        {/* Y-axis labels */}
        {showLabels && (
          <g className="text-xs fill-gray-500">
            {[0, 0.5, 1].map((ratio) => {
              const y = padding.top + chartHeight * (1 - ratio);
              const value = minValue + (maxValue - minValue) * ratio;
              return (
                <text
                  key={ratio}
                  x={padding.left - 8}
                  y={y + 4}
                  textAnchor="end"
                  fontSize="10"
                >
                  {value >= 1000 ? `${(value / 1000).toFixed(1)}k` : Math.round(value)}
                </text>
              );
            })}
          </g>
        )}

        {/* X-axis labels */}
        {showLabels && (
          <g className="text-xs fill-gray-500">
            {points.filter((_, i) => i % Math.ceil(points.length / 7) === 0 || i === points.length - 1).map((p, i) => (
              <text
                key={i}
                x={p.x}
                y={height - 10}
                textAnchor="middle"
                fontSize="10"
              >
                {p.label}
              </text>
            ))}
          </g>
        )}

        {/* Area fill */}
        {showArea && areaPath && (
          <path
            d={areaPath}
            fill={colors.fill}
            className="transition-all duration-500"
          />
        )}

        {/* Line */}
        {linePath && (
          <path
            d={linePath}
            fill="none"
            stroke={colors.stroke}
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="transition-all duration-500"
          />
        )}

        {/* Dots */}
        {showDots && points.map((p, i) => (
          <g key={i}>
            <circle
              cx={p.x}
              cy={p.y}
              r="4"
              fill="white"
              stroke={colors.stroke}
              strokeWidth="2"
              className="transition-all duration-200 hover:r-6"
            />
            {/* Tooltip on hover */}
            <title>{`${p.label}: ${p.value}`}</title>
          </g>
        ))}
      </svg>
    </div>
  );
}
