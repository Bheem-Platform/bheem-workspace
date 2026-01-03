interface LoadingOverlayProps {
  text?: string;
  fullScreen?: boolean;
  transparent?: boolean;
}

export default function LoadingOverlay({
  text = 'Loading...',
  fullScreen = false,
  transparent = false,
}: LoadingOverlayProps) {
  const content = (
    <div className="flex flex-col items-center justify-center gap-4">
      {/* Spinner */}
      <div className="relative">
        <div className="w-12 h-12 border-4 border-gray-200 rounded-full animate-spin border-t-blue-600" />
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="w-6 h-6 bg-gradient-to-br from-blue-500 to-purple-600 rounded-lg flex items-center justify-center">
            <span className="text-white font-bold text-xs">B</span>
          </div>
        </div>
      </div>

      {/* Text */}
      {text && (
        <p className="text-gray-600 font-medium text-sm animate-pulse">
          {text}
        </p>
      )}
    </div>
  );

  if (fullScreen) {
    return (
      <div
        className={`fixed inset-0 z-50 flex items-center justify-center ${
          transparent ? 'bg-white/80 backdrop-blur-sm' : 'bg-white'
        }`}
      >
        {content}
      </div>
    );
  }

  return (
    <div className="flex items-center justify-center p-8">
      {content}
    </div>
  );
}

// Skeleton loader components
export function SkeletonLine({ className = '' }: { className?: string }) {
  return (
    <div
      className={`bg-gray-200 rounded animate-pulse ${className}`}
    />
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
