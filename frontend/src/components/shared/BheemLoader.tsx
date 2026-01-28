/**
 * Bheem Loader - Modern, Trendy Branded Loading Component
 * Uses brand colors: #FFCCF2 (pink), #977DFF (purple), #0033FF (blue)
 */
import React from 'react';

interface BheemLoaderProps {
  size?: 'sm' | 'md' | 'lg' | 'xl';
  variant?: 'spinner' | 'pulse' | 'dots' | 'orbit';
  text?: string;
  showText?: boolean;
  fullScreen?: boolean;
  transparent?: boolean;
  className?: string;
}

// Size configurations
const sizes = {
  sm: { logo: 32, ring: 40, text: 'text-xs' },
  md: { logo: 48, ring: 60, text: 'text-sm' },
  lg: { logo: 64, ring: 80, text: 'text-base' },
  xl: { logo: 80, ring: 100, text: 'text-lg' },
};

// Animated Bheem Logo SVG
function AnimatedBheemLogo({ size = 48 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 48 48"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className="drop-shadow-lg"
    >
      <defs>
        <linearGradient id="bheemLoaderGrad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#FFCCF2">
            <animate
              attributeName="stop-color"
              values="#FFCCF2;#977DFF;#0033FF;#FFCCF2"
              dur="3s"
              repeatCount="indefinite"
            />
          </stop>
          <stop offset="50%" stopColor="#977DFF">
            <animate
              attributeName="stop-color"
              values="#977DFF;#0033FF;#FFCCF2;#977DFF"
              dur="3s"
              repeatCount="indefinite"
            />
          </stop>
          <stop offset="100%" stopColor="#0033FF">
            <animate
              attributeName="stop-color"
              values="#0033FF;#FFCCF2;#977DFF;#0033FF"
              dur="3s"
              repeatCount="indefinite"
            />
          </stop>
        </linearGradient>
        <filter id="glow">
          <feGaussianBlur stdDeviation="2" result="coloredBlur"/>
          <feMerge>
            <feMergeNode in="coloredBlur"/>
            <feMergeNode in="SourceGraphic"/>
          </feMerge>
        </filter>
      </defs>

      {/* Background with gradient */}
      <rect
        x="2"
        y="2"
        width="44"
        height="44"
        rx="12"
        fill="url(#bheemLoaderGrad)"
        filter="url(#glow)"
      >
        <animate
          attributeName="rx"
          values="12;14;12"
          dur="2s"
          repeatCount="indefinite"
        />
      </rect>

      {/* White B letter */}
      <text
        x="24"
        y="34"
        textAnchor="middle"
        fill="white"
        fontSize="28"
        fontWeight="800"
        fontFamily="system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif"
        className="drop-shadow-sm"
      >
        B
      </text>
    </svg>
  );
}

// Spinner variant - rotating gradient ring around logo
function SpinnerLoader({ size = 'md' }: { size?: 'sm' | 'md' | 'lg' | 'xl' }) {
  const config = sizes[size];

  return (
    <div className="relative" style={{ width: config.ring, height: config.ring }}>
      {/* Outer rotating ring */}
      <svg
        className="absolute inset-0 animate-spin"
        style={{ animationDuration: '2s' }}
        viewBox="0 0 100 100"
      >
        <defs>
          <linearGradient id="ringGradient" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#FFCCF2" />
            <stop offset="50%" stopColor="#977DFF" />
            <stop offset="100%" stopColor="#0033FF" />
          </linearGradient>
        </defs>
        <circle
          cx="50"
          cy="50"
          r="45"
          fill="none"
          stroke="url(#ringGradient)"
          strokeWidth="4"
          strokeLinecap="round"
          strokeDasharray="200 80"
        />
      </svg>

      {/* Inner glow ring */}
      <svg
        className="absolute inset-0 animate-spin"
        style={{ animationDuration: '3s', animationDirection: 'reverse' }}
        viewBox="0 0 100 100"
      >
        <circle
          cx="50"
          cy="50"
          r="38"
          fill="none"
          stroke="#977DFF"
          strokeWidth="2"
          strokeLinecap="round"
          strokeDasharray="50 150"
          opacity="0.5"
        />
      </svg>

      {/* Center logo */}
      <div
        className="absolute inset-0 flex items-center justify-center"
        style={{ padding: (config.ring - config.logo) / 2 }}
      >
        <AnimatedBheemLogo size={config.logo * 0.7} />
      </div>
    </div>
  );
}

// Pulse variant - pulsing logo with ripple effect
function PulseLoader({ size = 'md' }: { size?: 'sm' | 'md' | 'lg' | 'xl' }) {
  const config = sizes[size];

  return (
    <div className="relative" style={{ width: config.ring, height: config.ring }}>
      {/* Ripple effects */}
      <div
        className="absolute inset-0 rounded-2xl bg-gradient-to-br from-[#FFCCF2] via-[#977DFF] to-[#0033FF] animate-ping opacity-20"
        style={{ animationDuration: '2s' }}
      />
      <div
        className="absolute inset-2 rounded-xl bg-gradient-to-br from-[#FFCCF2] via-[#977DFF] to-[#0033FF] animate-ping opacity-30"
        style={{ animationDuration: '2s', animationDelay: '0.5s' }}
      />

      {/* Center logo with pulse */}
      <div className="absolute inset-0 flex items-center justify-center animate-pulse">
        <AnimatedBheemLogo size={config.logo * 0.8} />
      </div>
    </div>
  );
}

// Dots variant - animated bouncing dots
function DotsLoader({ size = 'md' }: { size?: 'sm' | 'md' | 'lg' | 'xl' }) {
  const config = sizes[size];
  const dotSize = config.logo / 6;

  return (
    <div className="flex flex-col items-center gap-3">
      <AnimatedBheemLogo size={config.logo * 0.8} />
      <div className="flex gap-1.5">
        {[0, 1, 2].map((i) => (
          <div
            key={i}
            className="rounded-full animate-bounce"
            style={{
              width: dotSize,
              height: dotSize,
              backgroundColor: ['#FFCCF2', '#977DFF', '#0033FF'][i],
              animationDelay: `${i * 0.15}s`,
              animationDuration: '0.6s',
            }}
          />
        ))}
      </div>
    </div>
  );
}

// Orbit variant - orbiting particles around logo
function OrbitLoader({ size = 'md' }: { size?: 'sm' | 'md' | 'lg' | 'xl' }) {
  const config = sizes[size];

  return (
    <div className="relative" style={{ width: config.ring, height: config.ring }}>
      {/* Orbiting particles */}
      <div
        className="absolute inset-0 animate-spin"
        style={{ animationDuration: '3s' }}
      >
        <div
          className="absolute w-3 h-3 rounded-full bg-[#FFCCF2] shadow-lg shadow-[#FFCCF2]/50"
          style={{ top: 0, left: '50%', transform: 'translateX(-50%)' }}
        />
      </div>
      <div
        className="absolute inset-0 animate-spin"
        style={{ animationDuration: '3s', animationDelay: '1s' }}
      >
        <div
          className="absolute w-2.5 h-2.5 rounded-full bg-[#977DFF] shadow-lg shadow-[#977DFF]/50"
          style={{ top: '50%', right: 0, transform: 'translateY(-50%)' }}
        />
      </div>
      <div
        className="absolute inset-0 animate-spin"
        style={{ animationDuration: '3s', animationDelay: '2s' }}
      >
        <div
          className="absolute w-2 h-2 rounded-full bg-[#0033FF] shadow-lg shadow-[#0033FF]/50"
          style={{ bottom: 0, left: '50%', transform: 'translateX(-50%)' }}
        />
      </div>

      {/* Center logo */}
      <div className="absolute inset-0 flex items-center justify-center">
        <AnimatedBheemLogo size={config.logo * 0.6} />
      </div>
    </div>
  );
}

// Main BheemLoader component
export default function BheemLoader({
  size = 'md',
  variant = 'spinner',
  text,
  showText = true,
  fullScreen = false,
  transparent = false,
  className = '',
}: BheemLoaderProps) {
  const config = sizes[size];

  const LoaderVariant = {
    spinner: SpinnerLoader,
    pulse: PulseLoader,
    dots: DotsLoader,
    orbit: OrbitLoader,
  }[variant];

  const content = (
    <div className={`flex flex-col items-center justify-center gap-4 ${className}`}>
      <LoaderVariant size={size} />

      {showText && text && (
        <p className={`${config.text} font-medium text-gray-600 animate-pulse`}>
          {text}
        </p>
      )}
    </div>
  );

  if (fullScreen) {
    return (
      <div
        className={`fixed inset-0 z-50 flex items-center justify-center ${
          transparent
            ? 'bg-white/80 backdrop-blur-sm'
            : 'bg-gradient-to-br from-gray-50 to-white'
        }`}
      >
        {content}
      </div>
    );
  }

  return content;
}

// Page transition loader - for navigation
export function PageLoader({ text = 'Loading...' }: { text?: string }) {
  return (
    <BheemLoader
      size="lg"
      variant="spinner"
      text={text}
      fullScreen
      transparent
    />
  );
}

// Inline loader - for buttons or small areas
export function InlineLoader({ size = 'sm' }: { size?: 'sm' | 'md' }) {
  return (
    <div className="inline-flex items-center gap-2">
      <div className="relative" style={{ width: 20, height: 20 }}>
        <svg
          className="animate-spin"
          viewBox="0 0 24 24"
          fill="none"
        >
          <defs>
            <linearGradient id="inlineGrad" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#FFCCF2" />
              <stop offset="50%" stopColor="#977DFF" />
              <stop offset="100%" stopColor="#0033FF" />
            </linearGradient>
          </defs>
          <circle
            cx="12"
            cy="12"
            r="10"
            stroke="url(#inlineGrad)"
            strokeWidth="3"
            strokeLinecap="round"
            strokeDasharray="50 20"
            fill="none"
          />
        </svg>
      </div>
    </div>
  );
}

// Skeleton with brand colors
export function BheemSkeleton({ className = '' }: { className?: string }) {
  return (
    <div
      className={`relative overflow-hidden bg-gray-100 rounded ${className}`}
    >
      <div
        className="absolute inset-0 -translate-x-full animate-[shimmer_2s_infinite]"
        style={{
          background: 'linear-gradient(90deg, transparent, rgba(151, 125, 255, 0.1), transparent)',
        }}
      />
    </div>
  );
}
