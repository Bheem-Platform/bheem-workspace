/**
 * Date/Time Formatting Utilities
 * Uses user's language settings from the settings store
 */
import { useSettingsStore } from '@/stores/settingsStore';

// Get current language settings
export function getLanguageSettings() {
  const state = useSettingsStore.getState();
  return state.settings.language;
}

// Format date according to user's dateFormat setting
export function formatDate(date: Date | string, includeYear = true): string {
  const settings = getLanguageSettings();
  const d = typeof date === 'string' ? new Date(date) : date;

  if (isNaN(d.getTime())) return '';

  const day = d.getDate().toString().padStart(2, '0');
  const month = (d.getMonth() + 1).toString().padStart(2, '0');
  const year = d.getFullYear();

  switch (settings.dateFormat) {
    case 'DD/MM/YYYY':
      return includeYear ? `${day}/${month}/${year}` : `${day}/${month}`;
    case 'YYYY-MM-DD':
      return includeYear ? `${year}-${month}-${day}` : `${month}-${day}`;
    case 'MM/DD/YYYY':
    default:
      return includeYear ? `${month}/${day}/${year}` : `${month}/${day}`;
  }
}

// Format time according to user's timeFormat setting
export function formatTime(date: Date | string): string {
  const settings = getLanguageSettings();
  const d = typeof date === 'string' ? new Date(date) : date;

  if (isNaN(d.getTime())) return '';

  if (settings.timeFormat === '24h') {
    const hours = d.getHours().toString().padStart(2, '0');
    const minutes = d.getMinutes().toString().padStart(2, '0');
    return `${hours}:${minutes}`;
  } else {
    // 12h format
    let hours = d.getHours();
    const minutes = d.getMinutes().toString().padStart(2, '0');
    const ampm = hours >= 12 ? 'PM' : 'AM';
    hours = hours % 12;
    hours = hours ? hours : 12; // 0 should be 12
    return `${hours}:${minutes} ${ampm}`;
  }
}

// Format date and time together
export function formatDateTime(date: Date | string): string {
  return `${formatDate(date)} ${formatTime(date)}`;
}

// Get the first day of the week (0 = Sunday, 1 = Monday)
export function getWeekStartDay(): number {
  const settings = getLanguageSettings();
  return settings.weekStart === 'monday' ? 1 : 0;
}

// Get user's timezone
export function getUserTimezone(): string {
  const settings = getLanguageSettings();
  return settings.timezone || 'UTC';
}

// Convert date to user's timezone
export function toUserTimezone(date: Date | string): Date {
  const d = typeof date === 'string' ? new Date(date) : date;
  const timezone = getUserTimezone();

  try {
    // Create a date string in the user's timezone
    const options: Intl.DateTimeFormatOptions = {
      timeZone: timezone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
    };

    const formatter = new Intl.DateTimeFormat('en-US', options);
    const parts = formatter.formatToParts(d);

    const getPart = (type: string) => parts.find(p => p.type === type)?.value || '0';

    return new Date(
      parseInt(getPart('year')),
      parseInt(getPart('month')) - 1,
      parseInt(getPart('day')),
      parseInt(getPart('hour')),
      parseInt(getPart('minute')),
      parseInt(getPart('second'))
    );
  } catch {
    return d;
  }
}

// Format relative time (e.g., "2 hours ago", "Yesterday")
export function formatRelativeTime(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins} minute${diffMins > 1 ? 's' : ''} ago`;
  if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7) return `${diffDays} days ago`;

  return formatDate(d);
}

// Get day names based on week start setting
export function getDayNames(short = false): string[] {
  const fullNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const shortNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const names = short ? shortNames : fullNames;

  const weekStart = getWeekStartDay();
  if (weekStart === 1) {
    // Monday first
    return [...names.slice(1), names[0]];
  }
  return names;
}

// Get month names
export function getMonthNames(short = false): string[] {
  if (short) {
    return ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  }
  return ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
}

// Format a date for display in calendar header
export function formatCalendarHeader(date: Date): string {
  const months = getMonthNames();
  return `${months[date.getMonth()]} ${date.getFullYear()}`;
}

// React hook to get formatted date/time with auto-update when settings change
export function useFormattedDate(date: Date | string) {
  const language = useSettingsStore((state) => state.settings.language);
  return formatDate(date);
}

export function useFormattedTime(date: Date | string) {
  const language = useSettingsStore((state) => state.settings.language);
  return formatTime(date);
}

export function useFormattedDateTime(date: Date | string) {
  const language = useSettingsStore((state) => state.settings.language);
  return formatDateTime(date);
}
