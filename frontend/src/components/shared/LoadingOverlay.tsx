/**
 * Loading Overlay Component - Modern Bheem Branded Design
 * Uses brand colors: #FFCCF2 (pink), #977DFF (purple), #0033FF (blue)
 */
import BheemLoader from './BheemLoader';

interface LoadingOverlayProps {
  text?: string;
  fullScreen?: boolean;
  transparent?: boolean;
  variant?: 'spinner' | 'pulse' | 'dots' | 'orbit';
  size?: 'sm' | 'md' | 'lg' | 'xl';
}

export default function LoadingOverlay({
  text = 'Loading...',
  fullScreen = false,
  transparent = false,
  variant = 'spinner',
  size = 'md',
}: LoadingOverlayProps) {
  return (
    <BheemLoader
      size={size}
      variant={variant}
      text={text}
      showText={!!text}
      fullScreen={fullScreen}
      transparent={transparent}
    />
  );
}

// Skeleton loader components with brand styling
export function SkeletonLine({ className = '' }: { className?: string }) {
  return (
    <div
      className={`relative overflow-hidden bg-gray-200 rounded animate-pulse ${className}`}
    >
      <div
        className="absolute inset-0 -translate-x-full"
        style={{
          background: 'linear-gradient(90deg, transparent, rgba(151, 125, 255, 0.15), transparent)',
          animation: 'shimmer 2s infinite',
        }}
      />
    </div>
  );
}

export function SkeletonCard({ className = '' }: { className?: string }) {
  return (
    <div className={`bg-white rounded-xl border border-gray-100 p-4 ${className}`}>
      <div className="flex items-center gap-3 mb-4">
        <SkeletonLine className="w-10 h-10 rounded-full" />
        <div className="flex-1">
          <SkeletonLine className="h-4 w-1/3 mb-2" />
          <SkeletonLine className="h-3 w-1/2" />
        </div>
      </div>
      <SkeletonLine className="h-4 w-full mb-2" />
      <SkeletonLine className="h-4 w-2/3" />
    </div>
  );
}

export function SkeletonList({ count = 5 }: { count?: number }) {
  return (
    <div className="space-y-3">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="flex items-center gap-3 p-3">
          <SkeletonLine className="w-10 h-10 rounded-lg" />
          <div className="flex-1">
            <SkeletonLine className="h-4 w-1/2 mb-2" />
            <SkeletonLine className="h-3 w-3/4" />
          </div>
        </div>
      ))}
    </div>
  );
}

export function SkeletonTable({ rows = 5, cols = 4 }: { rows?: number; cols?: number }) {
  return (
    <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
      {/* Header */}
      <div className="flex gap-4 p-4 border-b border-gray-100 bg-gray-50">
        {Array.from({ length: cols }).map((_, i) => (
          <SkeletonLine key={i} className="h-4 flex-1" />
        ))}
      </div>

      {/* Rows */}
      {Array.from({ length: rows }).map((_, rowIndex) => (
        <div key={rowIndex} className="flex gap-4 p-4 border-b border-gray-50 last:border-0">
          {Array.from({ length: cols }).map((_, colIndex) => (
            <SkeletonLine
              key={colIndex}
              className={`h-4 flex-1 ${colIndex === 0 ? 'w-1/4' : ''}`}
            />
          ))}
        </div>
      ))}
    </div>
  );
}
