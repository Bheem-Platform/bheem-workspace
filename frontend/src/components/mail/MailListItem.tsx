import { Star, Paperclip } from 'lucide-react';
import type { Email } from '@/types/mail';

interface MailListItemProps {
  email: Email;
  isSelected: boolean;
  isChecked: boolean;
  onSelect: () => void;
  onToggleCheck: () => void;
  onToggleStar: () => void;
}

export default function MailListItem({
  email,
  isSelected,
  isChecked,
  onSelect,
  onToggleCheck,
  onToggleStar,
}: MailListItemProps) {
  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const isToday = date.toDateString() === now.toDateString();
    const isThisYear = date.getFullYear() === now.getFullYear();

    if (isToday) {
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } else if (isThisYear) {
      return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
    } else {
      return date.toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' });
    }
  };

  const getInitials = (name: string, email: string) => {
    if (name) {
      return name.split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2);
    }
    return email.slice(0, 2).toUpperCase();
  };

  const getSenderDisplay = () => {
    if (email.from.name) {
      return email.from.name;
    }
    return email.from.email.split('@')[0];
  };

  const getPreview = () => {
    const text = email.bodyText || email.body || '';
    // Strip HTML if present
    const stripped = text.replace(/<[^>]*>/g, '').trim();
    return stripped.slice(0, 100);
  };

  return (
    <div
      onClick={onSelect}
      className={`
        group flex items-start gap-3 px-4 py-3 cursor-pointer border-b border-gray-100 transition-all
        ${isSelected ? 'bg-orange-50' : 'hover:bg-gray-50'}
        ${!email.isRead ? 'bg-blue-50/50' : ''}
      `}
    >
      {/* Checkbox */}
      <div
        onClick={(e) => {
          e.stopPropagation();
          onToggleCheck();
        }}
        className="flex-shrink-0 pt-1"
      >
        <input
          type="checkbox"
          checked={isChecked}
          onChange={() => {}}
          className="w-4 h-4 rounded border-gray-300 text-orange-600 focus:ring-orange-500"
        />
      </div>

      {/* Star */}
      <button
        onClick={(e) => {
          e.stopPropagation();
          onToggleStar();
        }}
        className="flex-shrink-0 pt-1"
      >
        <Star
          size={18}
          className={`
            transition-colors
            ${email.isStarred
              ? 'text-amber-400 fill-amber-400'
              : 'text-gray-300 hover:text-amber-400'
            }
          `}
        />
      </button>

      {/* Avatar */}
      <div
        className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 text-white font-medium text-sm"
        style={{
          background: `linear-gradient(135deg, ${stringToColor(email.from.email)} 0%, ${stringToColor(email.from.email + '2')} 100%)`,
        }}
      >
        {getInitials(email.from.name, email.from.email)}
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-2">
          <span className={`text-sm truncate ${!email.isRead ? 'font-semibold text-gray-900' : 'text-gray-700'}`}>
            {getSenderDisplay()}
          </span>
          <span className={`text-xs flex-shrink-0 ${!email.isRead ? 'font-semibold text-gray-900' : 'text-gray-500'}`}>
            {formatDate(email.date)}
          </span>
        </div>

        <div className="flex items-center gap-2 mt-0.5">
          <span className={`text-sm truncate ${!email.isRead ? 'font-semibold text-gray-900' : 'text-gray-700'}`}>
            {email.subject || '(No Subject)'}
          </span>
          {email.hasAttachments && (
            <Paperclip size={14} className="text-gray-400 flex-shrink-0" />
          )}
        </div>

        <p className="text-xs text-gray-500 truncate mt-0.5">
          {getPreview()}
        </p>

        {/* Labels */}
        {email.labels && email.labels.length > 0 && (
          <div className="flex items-center gap-1 mt-1.5">
            {email.labels.slice(0, 3).map((label) => (
              <span
                key={label}
                className="px-1.5 py-0.5 text-xs font-medium rounded bg-gray-100 text-gray-600"
              >
                {label}
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// Helper to generate consistent colors from strings
function stringToColor(str: string): string {
  const colors = [
    '#3b82f6', // blue
    '#10b981', // green
    '#8b5cf6', // purple
    '#f59e0b', // amber
    '#ef4444', // red
    '#ec4899', // pink
    '#06b6d4', // cyan
    '#6366f1', // indigo
  ];

  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
  }

  return colors[Math.abs(hash) % colors.length];
}
