import React from 'react';

// Bheem Brand Color Themes
export const BHEEM_COLOR_THEMES = {
  // CT 1: Light Pink, Purple, Blue
  ct1: {
    primary: '#FFCCF2',
    secondary: '#977DFF',
    tertiary: '#0033FF',
  },
  // CT 2: Purple, Blue, Dark Purple
  ct2: {
    primary: '#977DFF',
    secondary: '#0033FF',
    tertiary: '#0600AB',
  },
  // CT 3: Blue, Dark Purple, Deep Blue
  ct3: {
    primary: '#0033FF',
    secondary: '#0600AB',
    tertiary: '#00003D',
  },
  // CT 4: Lavender, Purple
  ct4: {
    primary: '#F2E6EE',
    secondary: '#977DFF',
    tertiary: '#977DFF',
  },
};

// Full color palette
export const BHEEM_COLORS = {
  pink: '#FFCCF2',
  purple: '#977DFF',
  blue: '#0033FF',
  darkBlue: '#0600AB',
  darkPurple: '#0600AB',
  deepBlue: '#00003D',
  lavender: '#F2E6EE',
};

interface BheemLogoProps {
  size?: number;
  theme?: 'ct1' | 'ct2' | 'ct3' | 'ct4' | 'gradient';
  showText?: boolean;
  textClassName?: string;
  className?: string;
}

// Google Apps-style Bheem Logo - Geometric "B" design
export function BheemLogo({
  size = 40,
  theme = 'gradient',
  showText = false,
  textClassName = '',
  className = '',
}: BheemLogoProps) {
  const colors = theme === 'gradient'
    ? { primary: BHEEM_COLORS.pink, secondary: BHEEM_COLORS.purple, tertiary: BHEEM_COLORS.blue }
    : BHEEM_COLOR_THEMES[theme];

  return (
    <div className={`flex items-center gap-3 ${className}`}>
      <svg
        width={size}
        height={size}
        viewBox="0 0 48 48"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="flex-shrink-0"
      >
        <defs>
          {/* Main gradient for background */}
          <linearGradient id={`bheemGrad-${theme}`} x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor={colors.primary} />
            <stop offset="50%" stopColor={colors.secondary} />
            <stop offset="100%" stopColor={colors.tertiary} />
          </linearGradient>

          {/* Gradient for inner elements */}
          <linearGradient id={`bheemInnerGrad-${theme}`} x1="0%" y1="100%" x2="100%" y2="0%">
            <stop offset="0%" stopColor={colors.tertiary} />
            <stop offset="100%" stopColor={colors.secondary} />
          </linearGradient>
        </defs>

        {/* Background rounded square - Google style */}
        <rect x="2" y="2" width="44" height="44" rx="10" fill={`url(#bheemGrad-${theme})`} />

        {/* "B" shape made of geometric parts - Google style */}
        {/* Vertical bar */}
        <rect x="12" y="10" width="6" height="28" rx="2" fill="white" />

        {/* Top bump of B */}
        <path
          d="M18 10 H28 C32.4183 10 36 13.5817 36 18 C36 22.4183 32.4183 26 28 26 H18 V10Z"
          fill="white"
          opacity="0.95"
        />

        {/* Bottom bump of B - slightly larger */}
        <path
          d="M18 24 H30 C35.5228 24 40 28.4772 40 34 C40 35.6569 38.6569 37 37 37 H18 V24Z"
          fill="white"
          opacity="0.9"
        />

        {/* Accent circles - Google style colored dots */}
        <circle cx="27" cy="18" r="3" fill={colors.tertiary} opacity="0.8" />
        <circle cx="29" cy="31" r="3.5" fill={colors.secondary} opacity="0.7" />
      </svg>

      {showText && (
        <span className={`font-bold ${textClassName}`}>Bheem</span>
      )}
    </div>
  );
}

// Compact icon version for smaller spaces (like favicon style)
export function BheemLogoIcon({
  size = 32,
  theme = 'gradient',
  className = '',
}: Omit<BheemLogoProps, 'showText' | 'textClassName'>) {
  const colors = theme === 'gradient'
    ? { primary: BHEEM_COLORS.pink, secondary: BHEEM_COLORS.purple, tertiary: BHEEM_COLORS.blue }
    : BHEEM_COLOR_THEMES[theme];

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 48 48"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
    >
      <defs>
        <linearGradient id={`bheemIconGrad-${theme}`} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor={colors.primary} />
          <stop offset="50%" stopColor={colors.secondary} />
          <stop offset="100%" stopColor={colors.tertiary} />
        </linearGradient>
      </defs>

      {/* Rounded square background */}
      <rect x="2" y="2" width="44" height="44" rx="12" fill={`url(#bheemIconGrad-${theme})`} />

      {/* Stylized B */}
      <path
        d="M14 10 H14 V38 H14 C14 38 14 38 14 38 H28 C33.5228 38 38 33.5228 38 28 C38 24.134 35.5 20.8 32 19.5 C34.2091 18.2 35.5 15.866 35.5 13.5 C35.5 11.567 33.933 10 32 10 H14 Z"
        fill="white"
        opacity="0.95"
      />

      {/* Inner cutouts for B shape */}
      <rect x="20" y="15" width="10" height="6" rx="3" fill={colors.secondary} opacity="0.6" />
      <rect x="20" y="27" width="12" height="6" rx="3" fill={colors.tertiary} opacity="0.5" />
    </svg>
  );
}

// Modern stylized B logo - cleaner Google-like design
export function BheemLogoModern({
  size = 40,
  theme = 'gradient',
  showText = false,
  textClassName = '',
  className = '',
}: BheemLogoProps) {
  const colors = theme === 'gradient'
    ? { primary: BHEEM_COLORS.pink, secondary: BHEEM_COLORS.purple, tertiary: BHEEM_COLORS.blue }
    : BHEEM_COLOR_THEMES[theme];

  return (
    <div className={`flex items-center gap-3 ${className}`}>
      <svg
        width={size}
        height={size}
        viewBox="0 0 48 48"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="flex-shrink-0"
      >
        <defs>
          <linearGradient id={`modernGrad-${theme}`} x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor={colors.primary} />
            <stop offset="50%" stopColor={colors.secondary} />
            <stop offset="100%" stopColor={colors.tertiary} />
          </linearGradient>
        </defs>

        {/* Modern rounded square */}
        <rect x="0" y="0" width="48" height="48" rx="12" fill={`url(#modernGrad-${theme})`} />

        {/* Clean B letter */}
        <text
          x="24"
          y="35"
          textAnchor="middle"
          fill="white"
          fontSize="32"
          fontWeight="800"
          fontFamily="system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif"
        >
          B
        </text>
      </svg>

      {showText && (
        <span className={`font-bold ${textClassName}`}>Bheem</span>
      )}
    </div>
  );
}

// Google Drive-style triangular logo variant
export function BheemLogoDrive({
  size = 40,
  className = '',
}: {
  size?: number;
  className?: string;
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 48 48"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
    >
      {/* Triangle segments like Google Drive */}
      <polygon points="24,4 44,38 4,38" fill={BHEEM_COLORS.blue} />
      <polygon points="14,38 24,20 44,38" fill={BHEEM_COLORS.purple} />
      <polygon points="4,38 14,22 24,38" fill={BHEEM_COLORS.pink} />

      {/* Center B */}
      <circle cx="24" cy="30" r="8" fill="white" opacity="0.95" />
      <text
        x="24"
        y="34"
        textAnchor="middle"
        fill={BHEEM_COLORS.purple}
        fontSize="12"
        fontWeight="800"
        fontFamily="system-ui"
      >
        B
      </text>
    </svg>
  );
}

// 4-color segmented logo - most Google-like
export function BheemLogoSegmented({
  size = 40,
  showText = false,
  textClassName = '',
  className = '',
}: BheemLogoProps) {
  return (
    <div className={`flex items-center gap-3 ${className}`}>
      <svg
        width={size}
        height={size}
        viewBox="0 0 48 48"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="flex-shrink-0"
      >
        {/* 4 colored segments forming the logo */}
        {/* Top-left - Pink */}
        <path
          d="M4 12 C4 7.58172 7.58172 4 12 4 H24 V24 H4 V12Z"
          fill={BHEEM_COLORS.pink}
        />

        {/* Top-right - Purple */}
        <path
          d="M24 4 H36 C40.4183 4 44 7.58172 44 12 V24 H24 V4Z"
          fill={BHEEM_COLORS.purple}
        />

        {/* Bottom-right - Blue */}
        <path
          d="M24 24 H44 V36 C44 40.4183 40.4183 44 36 44 H24 V24Z"
          fill={BHEEM_COLORS.blue}
        />

        {/* Bottom-left - Dark Purple */}
        <path
          d="M4 24 H24 V44 H12 C7.58172 44 4 40.4183 4 36 V24Z"
          fill={BHEEM_COLORS.darkPurple}
        />

        {/* White B in center */}
        <circle cx="24" cy="24" r="12" fill="white" />
        <text
          x="24"
          y="30"
          textAnchor="middle"
          fill={BHEEM_COLORS.purple}
          fontSize="18"
          fontWeight="800"
          fontFamily="system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif"
        >
          B
        </text>
      </svg>

      {showText && (
        <span className={`font-bold ${textClassName}`}>Bheem</span>
      )}
    </div>
  );
}

export default BheemLogo;
