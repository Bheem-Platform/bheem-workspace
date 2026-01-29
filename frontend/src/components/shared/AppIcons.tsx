/**
 * Modern App Icons for Bheem Platform
 * Clean, minimal design with Bheem brand colors
 * Using gradient: #FFCCF2 → #977DFF → #0033FF
 */
import React from 'react';

// Bheem Brand Colors (CT1 only)
export const BHEEM_COLORS = {
  pink: '#FFCCF2',
  purple: '#977DFF',
  blue: '#0033FF',
};

interface IconProps {
  size?: number;
  className?: string;
}

// Modern Mail Icon - Clean envelope design
export function BheemMailIcon({ size = 48, className = '' }: IconProps) {
  const id = `mail-${Math.random().toString(36).substr(2, 9)}`;
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" fill="none" className={className}>
      <defs>
        <linearGradient id={`${id}-bg`} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor={BHEEM_COLORS.pink} />
          <stop offset="50%" stopColor={BHEEM_COLORS.purple} />
          <stop offset="100%" stopColor={BHEEM_COLORS.blue} />
        </linearGradient>
      </defs>
      <rect x="4" y="4" width="40" height="40" rx="12" fill={`url(#${id}-bg)`} />
      <path d="M12 16 L24 26 L36 16" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" fill="none" />
      <rect x="12" y="16" width="24" height="18" rx="2" stroke="white" strokeWidth="2.5" fill="none" />
    </svg>
  );
}

// Modern Calendar Icon
export function BheemCalendarIcon({ size = 48, className = '' }: IconProps) {
  const id = `cal-${Math.random().toString(36).substr(2, 9)}`;
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" fill="none" className={className}>
      <defs>
        <linearGradient id={`${id}-bg`} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor={BHEEM_COLORS.pink} />
          <stop offset="50%" stopColor={BHEEM_COLORS.purple} />
          <stop offset="100%" stopColor={BHEEM_COLORS.blue} />
        </linearGradient>
      </defs>
      <rect x="4" y="4" width="40" height="40" rx="12" fill={`url(#${id}-bg)`} />
      <rect x="12" y="14" width="24" height="6" rx="1" fill="white" />
      <rect x="17" y="10" width="3" height="6" rx="1.5" fill="white" />
      <rect x="28" y="10" width="3" height="6" rx="1.5" fill="white" />
      <rect x="12" y="20" width="24" height="16" rx="1" fill="white" opacity="0.9" />
      <text x="24" y="33" textAnchor="middle" fill={BHEEM_COLORS.purple} fontSize="12" fontWeight="700" fontFamily="system-ui">17</text>
    </svg>
  );
}

// Modern Meet Icon - Video camera
export function BheemMeetIcon({ size = 48, className = '' }: IconProps) {
  const id = `meet-${Math.random().toString(36).substr(2, 9)}`;
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" fill="none" className={className}>
      <defs>
        <linearGradient id={`${id}-bg`} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor={BHEEM_COLORS.pink} />
          <stop offset="50%" stopColor={BHEEM_COLORS.purple} />
          <stop offset="100%" stopColor={BHEEM_COLORS.blue} />
        </linearGradient>
      </defs>
      <rect x="4" y="4" width="40" height="40" rx="12" fill={`url(#${id}-bg)`} />
      <rect x="10" y="16" width="20" height="16" rx="3" fill="white" />
      <path d="M30 20 L38 15 L38 33 L30 28 Z" fill="white" />
    </svg>
  );
}

// Modern Docs Icon
export function BheemDocsIcon({ size = 48, className = '' }: IconProps) {
  const id = `docs-${Math.random().toString(36).substr(2, 9)}`;
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" fill="none" className={className}>
      <defs>
        <linearGradient id={`${id}-bg`} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor={BHEEM_COLORS.pink} />
          <stop offset="50%" stopColor={BHEEM_COLORS.purple} />
          <stop offset="100%" stopColor={BHEEM_COLORS.blue} />
        </linearGradient>
      </defs>
      <rect x="4" y="4" width="40" height="40" rx="12" fill={`url(#${id}-bg)`} />
      <rect x="14" y="10" width="20" height="28" rx="2" fill="white" />
      <rect x="18" y="16" width="12" height="2" rx="1" fill={BHEEM_COLORS.purple} />
      <rect x="18" y="22" width="10" height="2" rx="1" fill={BHEEM_COLORS.purple} opacity="0.6" />
      <rect x="18" y="28" width="8" height="2" rx="1" fill={BHEEM_COLORS.purple} opacity="0.4" />
    </svg>
  );
}

// Modern Drive Icon - Triangle style
export function BheemDriveIcon({ size = 48, className = '' }: IconProps) {
  const id = `drive-${Math.random().toString(36).substr(2, 9)}`;
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" fill="none" className={className}>
      <defs>
        <linearGradient id={`${id}-bg`} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor={BHEEM_COLORS.pink} />
          <stop offset="50%" stopColor={BHEEM_COLORS.purple} />
          <stop offset="100%" stopColor={BHEEM_COLORS.blue} />
        </linearGradient>
      </defs>
      <rect x="4" y="4" width="40" height="40" rx="12" fill={`url(#${id}-bg)`} />
      <path d="M24 12 L34 30 L14 30 Z" fill="white" />
      <path d="M19 22 L29 22 L34 30 L14 30 Z" fill="white" opacity="0.7" />
    </svg>
  );
}

// Modern Sheets Icon
export function BheemSheetsIcon({ size = 48, className = '' }: IconProps) {
  const id = `sheets-${Math.random().toString(36).substr(2, 9)}`;
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" fill="none" className={className}>
      <defs>
        <linearGradient id={`${id}-bg`} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor={BHEEM_COLORS.pink} />
          <stop offset="50%" stopColor={BHEEM_COLORS.purple} />
          <stop offset="100%" stopColor={BHEEM_COLORS.blue} />
        </linearGradient>
      </defs>
      <rect x="4" y="4" width="40" height="40" rx="12" fill={`url(#${id}-bg)`} />
      <rect x="12" y="12" width="24" height="24" rx="2" fill="white" />
      <line x1="12" y1="20" x2="36" y2="20" stroke={BHEEM_COLORS.purple} strokeWidth="1.5" opacity="0.5" />
      <line x1="12" y1="28" x2="36" y2="28" stroke={BHEEM_COLORS.purple} strokeWidth="1.5" opacity="0.5" />
      <line x1="24" y1="12" x2="24" y2="36" stroke={BHEEM_COLORS.purple} strokeWidth="1.5" opacity="0.5" />
      <rect x="25" y="21" width="10" height="6" fill={BHEEM_COLORS.pink} opacity="0.6" />
    </svg>
  );
}

// Modern Slides Icon
export function BheemSlidesIcon({ size = 48, className = '' }: IconProps) {
  const id = `slides-${Math.random().toString(36).substr(2, 9)}`;
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" fill="none" className={className}>
      <defs>
        <linearGradient id={`${id}-bg`} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor={BHEEM_COLORS.pink} />
          <stop offset="50%" stopColor={BHEEM_COLORS.purple} />
          <stop offset="100%" stopColor={BHEEM_COLORS.blue} />
        </linearGradient>
      </defs>
      <rect x="4" y="4" width="40" height="40" rx="12" fill={`url(#${id}-bg)`} />
      <rect x="10" y="12" width="28" height="18" rx="2" fill="white" />
      <path d="M21 17 L29 21 L21 25 Z" fill={BHEEM_COLORS.purple} />
      <circle cx="20" cy="36" r="2" fill="white" />
      <circle cx="28" cy="36" r="2" fill="white" opacity="0.5" />
    </svg>
  );
}

// Modern Forms Icon
export function BheemFormsIcon({ size = 48, className = '' }: IconProps) {
  const id = `forms-${Math.random().toString(36).substr(2, 9)}`;
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" fill="none" className={className}>
      <defs>
        <linearGradient id={`${id}-bg`} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor={BHEEM_COLORS.pink} />
          <stop offset="50%" stopColor={BHEEM_COLORS.purple} />
          <stop offset="100%" stopColor={BHEEM_COLORS.blue} />
        </linearGradient>
      </defs>
      <rect x="4" y="4" width="40" height="40" rx="12" fill={`url(#${id}-bg)`} />
      <rect x="12" y="10" width="24" height="28" rx="2" fill="white" />
      <rect x="16" y="16" width="4" height="4" rx="1" stroke={BHEEM_COLORS.purple} strokeWidth="1.5" fill="none" />
      <path d="M17 18 L18.5 19.5 L21 16" stroke={BHEEM_COLORS.blue} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      <rect x="24" y="17" width="8" height="2" rx="1" fill={BHEEM_COLORS.purple} opacity="0.5" />
      <rect x="16" y="24" width="4" height="4" rx="1" stroke={BHEEM_COLORS.purple} strokeWidth="1.5" fill="none" />
      <rect x="24" y="25" width="8" height="2" rx="1" fill={BHEEM_COLORS.purple} opacity="0.5" />
      <rect x="16" y="32" width="4" height="4" rx="1" stroke={BHEEM_COLORS.purple} strokeWidth="1.5" fill="none" />
      <rect x="24" y="33" width="8" height="2" rx="1" fill={BHEEM_COLORS.purple} opacity="0.5" />
    </svg>
  );
}

// Modern Chat Icon
export function BheemChatIcon({ size = 48, className = '' }: IconProps) {
  const id = `chat-${Math.random().toString(36).substr(2, 9)}`;
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" fill="none" className={className}>
      <defs>
        <linearGradient id={`${id}-bg`} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor={BHEEM_COLORS.pink} />
          <stop offset="50%" stopColor={BHEEM_COLORS.purple} />
          <stop offset="100%" stopColor={BHEEM_COLORS.blue} />
        </linearGradient>
      </defs>
      <rect x="4" y="4" width="40" height="40" rx="12" fill={`url(#${id}-bg)`} />
      <path d="M12 14 L36 14 C37.1 14 38 14.9 38 16 L38 28 C38 29.1 37.1 30 36 30 L18 30 L12 36 L12 30 L12 16 C12 14.9 12.9 14 14 14 Z" fill="white" />
      <circle cx="19" cy="22" r="2" fill={BHEEM_COLORS.purple} />
      <circle cx="25" cy="22" r="2" fill={BHEEM_COLORS.purple} opacity="0.7" />
      <circle cx="31" cy="22" r="2" fill={BHEEM_COLORS.purple} opacity="0.4" />
    </svg>
  );
}

// Modern Videos Icon
export function BheemVideosIcon({ size = 48, className = '' }: IconProps) {
  const id = `videos-${Math.random().toString(36).substr(2, 9)}`;
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" fill="none" className={className}>
      <defs>
        <linearGradient id={`${id}-bg`} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor={BHEEM_COLORS.pink} />
          <stop offset="50%" stopColor={BHEEM_COLORS.purple} />
          <stop offset="100%" stopColor={BHEEM_COLORS.blue} />
        </linearGradient>
      </defs>
      <rect x="4" y="4" width="40" height="40" rx="12" fill={`url(#${id}-bg)`} />
      <circle cx="24" cy="24" r="12" fill="white" />
      <path d="M21 18 L31 24 L21 30 Z" fill={BHEEM_COLORS.purple} />
    </svg>
  );
}

// Modern Notes Icon - Sticky note
export function BheemNotesIcon({ size = 48, className = '' }: IconProps) {
  const id = `notes-${Math.random().toString(36).substr(2, 9)}`;
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" fill="none" className={className}>
      <defs>
        <linearGradient id={`${id}-bg`} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor={BHEEM_COLORS.pink} />
          <stop offset="50%" stopColor={BHEEM_COLORS.purple} />
          <stop offset="100%" stopColor={BHEEM_COLORS.blue} />
        </linearGradient>
      </defs>
      <rect x="4" y="4" width="40" height="40" rx="12" fill={`url(#${id}-bg)`} />
      <path d="M12 12 L30 12 L36 18 L36 36 L12 36 Z" fill="white" />
      <path d="M30 12 L30 18 L36 18" fill="white" stroke={BHEEM_COLORS.purple} strokeWidth="1" />
      <rect x="16" y="22" width="16" height="2" rx="1" fill={BHEEM_COLORS.purple} opacity="0.6" />
      <rect x="16" y="27" width="12" height="2" rx="1" fill={BHEEM_COLORS.purple} opacity="0.4" />
    </svg>
  );
}

// Modern Sites Icon - Globe/Website
export function BheemSitesIcon({ size = 48, className = '' }: IconProps) {
  const id = `sites-${Math.random().toString(36).substr(2, 9)}`;
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" fill="none" className={className}>
      <defs>
        <linearGradient id={`${id}-bg`} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor={BHEEM_COLORS.pink} />
          <stop offset="50%" stopColor={BHEEM_COLORS.purple} />
          <stop offset="100%" stopColor={BHEEM_COLORS.blue} />
        </linearGradient>
      </defs>
      <rect x="4" y="4" width="40" height="40" rx="12" fill={`url(#${id}-bg)`} />
      <circle cx="24" cy="24" r="12" stroke="white" strokeWidth="2.5" fill="none" />
      <ellipse cx="24" cy="24" rx="5" ry="12" stroke="white" strokeWidth="2" fill="none" />
      <line x1="12" y1="24" x2="36" y2="24" stroke="white" strokeWidth="2" />
    </svg>
  );
}

// Modern Dashboard Icon - 4 squares with gradient colors
export function BheemDashboardIcon({ size = 48, className = '' }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" fill="none" className={className}>
      <rect x="4" y="4" width="18" height="18" rx="6" fill={BHEEM_COLORS.pink} />
      <rect x="26" y="4" width="18" height="18" rx="6" fill={BHEEM_COLORS.purple} />
      <rect x="4" y="26" width="18" height="18" rx="6" fill={BHEEM_COLORS.purple} />
      <rect x="26" y="26" width="18" height="18" rx="6" fill={BHEEM_COLORS.blue} />
    </svg>
  );
}

// Modern Admin Icon - Gear
export function BheemAdminIcon({ size = 48, className = '' }: IconProps) {
  const id = `admin-${Math.random().toString(36).substr(2, 9)}`;
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" fill="none" className={className}>
      <defs>
        <linearGradient id={`${id}-bg`} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor={BHEEM_COLORS.pink} />
          <stop offset="50%" stopColor={BHEEM_COLORS.purple} />
          <stop offset="100%" stopColor={BHEEM_COLORS.blue} />
        </linearGradient>
      </defs>
      <rect x="4" y="4" width="40" height="40" rx="12" fill={`url(#${id}-bg)`} />
      <circle cx="24" cy="24" r="6" stroke="white" strokeWidth="2.5" fill="none" />
      <circle cx="24" cy="24" r="2" fill="white" />
      <rect x="22" y="10" width="4" height="6" rx="1" fill="white" />
      <rect x="22" y="32" width="4" height="6" rx="1" fill="white" />
      <rect x="10" y="22" width="6" height="4" rx="1" fill="white" />
      <rect x="32" y="22" width="6" height="4" rx="1" fill="white" />
      <rect x="12" y="12" width="4" height="6" rx="1" fill="white" transform="rotate(-45 14 15)" />
      <rect x="32" y="12" width="4" height="6" rx="1" fill="white" transform="rotate(45 34 15)" />
      <rect x="12" y="30" width="4" height="6" rx="1" fill="white" transform="rotate(45 14 33)" />
      <rect x="32" y="30" width="4" height="6" rx="1" fill="white" transform="rotate(-45 34 33)" />
    </svg>
  );
}

// Export all icons as a map
export const BheemAppIcons = {
  mail: BheemMailIcon,
  calendar: BheemCalendarIcon,
  meet: BheemMeetIcon,
  docs: BheemDocsIcon,
  drive: BheemDriveIcon,
  sheets: BheemSheetsIcon,
  slides: BheemSlidesIcon,
  forms: BheemFormsIcon,
  chat: BheemChatIcon,
  videos: BheemVideosIcon,
  dashboard: BheemDashboardIcon,
  admin: BheemAdminIcon,
};

export type BheemAppIconType = keyof typeof BheemAppIcons;
