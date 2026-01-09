/**
 * DonutChart - SVG-based donut/pie chart component
 * No external dependencies, pure Tailwind styling
 */
import { useMemo } from 'react';

interface DonutSegment {
  label: string;
  value: number;
  color: string;
}

interface DonutChartProps {
  data: DonutSegment[];
  size?: number;
  thickness?: number;
  showLegend?: boolean;
  centerLabel?: string;
  centerValue?: string | number;
}

export default function DonutChart({
  data,
  size = 200,
  thickness = 40,
  showLegend = true,
  centerLabel,
  centerValue,
}: DonutChartProps) {
  const { segments, total } = useMemo(() => {
    const totalValue = data.reduce((sum, d) => sum + d.value, 0);

    let currentAngle = -90; // Start from top
    const segs = data.map((d) => {
      const percentage = totalValue > 0 ? (d.value / totalValue) * 100 : 0;
      const angle = (percentage / 100) * 360;
      const startAngle = currentAngle;
      currentAngle += angle;

      return {
        ...d,
        percentage,
        startAngle,
        endAngle: currentAngle,
      };
    });

    return { segments: segs, total: totalValue };
  }, [data]);

  const radius = size / 2;
  const innerRadius = radius - thickness;
  const center = size / 2;

  // Convert angle to SVG arc coordinates
  const polarToCartesian = (angle: number, r: number) => {
    const radians = (angle * Math.PI) / 180;
    return {
      x: center + r * Math.cos(radians),
      y: center + r * Math.sin(radians),
    };
  };

  // Create arc path
  const createArcPath = (startAngle: number, endAngle: number) => {
    const start = polarToCartesian(startAngle, radius - thickness / 2);
    const end = polarToCartesian(endAngle, radius - thickness / 2);
    const largeArc = endAngle - startAngle > 180 ? 1 : 0;

    return `M ${start.x} ${start.y} A ${radius - thickness / 2} ${radius - thickness / 2} 0 ${largeArc} 1 ${end.x} ${end.y}`;
  };

  if (!data || data.length === 0 || total === 0) {
    return (
      <div className="flex items-center justify-center" style={{ width: size, height: size }}>
        <div className="text-gray-400 text-sm">No data</div>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center gap-4">
      <div className="relative" style={{ width: size, height: size }}>
        <svg width={size} height={size} className="transform -rotate-0">
          {/* Background circle */}
          <circle
            cx={center}
            cy={center}
            r={radius - thickness / 2}
            fill="none"
            stroke="#f3f4f6"
            strokeWidth={thickness}
          />

          {/* Segments */}
          {segments.map((seg, i) => {
            if (seg.percentage < 0.5) return null; // Skip very small segments

            return (
              <path
                key={i}
                d={createArcPath(seg.startAngle, seg.endAngle - 0.5)}
                fill="none"
                stroke={seg.color}
                strokeWidth={thickness}
                strokeLinecap="round"
                className="transition-all duration-500 hover:opacity-80"
              >
                <title>{`${seg.label}: ${seg.value} (${seg.percentage.toFixed(1)}%)`}</title>
              </path>
            );
          })}
        </svg>

        {/* Center content */}
        {(centerLabel || centerValue) && (
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            {centerValue && (
              <span className="text-2xl font-bold text-gray-900">{centerValue}</span>
            )}
            {centerLabel && (
              <span className="text-sm text-gray-500">{centerLabel}</span>
            )}
          </div>
        )}
      </div>

      {/* Legend */}
      {showLegend && (
        <div className="flex flex-wrap justify-center gap-4">
          {segments.map((seg, i) => (
            <div key={i} className="flex items-center gap-2">
              <div
                className="w-3 h-3 rounded-full"
                style={{ backgroundColor: seg.color }}
              />
              <span className="text-sm text-gray-600">
                {seg.label}
                <span className="text-gray-400 ml-1">({seg.percentage.toFixed(0)}%)</span>
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
