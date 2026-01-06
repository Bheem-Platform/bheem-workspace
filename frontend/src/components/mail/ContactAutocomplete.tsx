/**
 * Bheem Mail Contact Autocomplete
 * Gmail-style contact suggestions when composing emails
 */
import { useState, useEffect, useRef, useCallback } from 'react';
import { X, User, Star, Clock, Search } from 'lucide-react';
import * as mailApi from '@/lib/mailApi';
import { debounce } from '@/lib/utils';

interface Contact {
  id: string;
  email: string;
  name?: string;
  frequency?: number;
  is_favorite?: boolean;
  avatar_url?: string;
}

interface ContactAutocompleteProps {
  value: string[];
  onChange: (emails: string[]) => void;
  placeholder?: string;
  label?: string;
}

export default function ContactAutocomplete({
  value,
  onChange,
  placeholder = 'Add recipients',
  label,
}: ContactAutocompleteProps) {
  const [inputValue, setInputValue] = useState('');
  const [suggestions, setSuggestions] = useState<Contact[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Debounced search
  const searchContacts = useCallback(
    debounce(async (query: string) => {
      if (!query || query.length < 2) {
        setSuggestions([]);
        return;
      }
      setLoading(true);
      try {
        const response = await mailApi.searchContacts(query, 10);
        setSuggestions(response.suggestions || []);
      } catch (error) {
        console.error('Failed to search contacts:', error);
      } finally {
        setLoading(false);
      }
    }, 200),
    []
  );

  useEffect(() => {
    searchContacts(inputValue);
  }, [inputValue, searchContacts]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setInputValue(e.target.value);
    setIsOpen(true);
    setSelectedIndex(0);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex((prev) => Math.min(prev + 1, suggestions.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex((prev) => Math.max(prev - 1, 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (suggestions[selectedIndex]) {
        addEmail(suggestions[selectedIndex].email);
      } else if (inputValue && isValidEmail(inputValue)) {
        addEmail(inputValue);
      }
    } else if (e.key === 'Backspace' && !inputValue && value.length > 0) {
      removeEmail(value[value.length - 1]);
    } else if (e.key === 'Escape') {
      setIsOpen(false);
    } else if (e.key === ',' || e.key === ';' || e.key === ' ') {
      if (inputValue && isValidEmail(inputValue)) {
        e.preventDefault();
        addEmail(inputValue);
      }
    }
  };

  const addEmail = (email: string) => {
    const normalizedEmail = email.toLowerCase().trim();
    if (!value.includes(normalizedEmail)) {
      onChange([...value, normalizedEmail]);
    }
    setInputValue('');
    setSuggestions([]);
    setIsOpen(false);
    inputRef.current?.focus();
  };

  const removeEmail = (email: string) => {
    onChange(value.filter((e) => e !== email));
  };

  const isValidEmail = (email: string) => {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  };

  const getInitials = (name?: string, email?: string) => {
    if (name) {
      return name.split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2);
    }
    return email?.slice(0, 2).toUpperCase() || '?';
  };

  const stringToColor = (str: string): string => {
    const colors = [
      '#3b82f6', '#10b981', '#8b5cf6', '#f59e0b',
      '#ef4444', '#ec4899', '#06b6d4', '#6366f1',
    ];
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      hash = str.charCodeAt(i) + ((hash << 5) - hash);
    }
    return colors[Math.abs(hash) % colors.length];
  };

  return (
    <div ref={containerRef} className="relative">
      {label && (
        <label className="text-sm text-gray-500 w-12">{label}</label>
      )}

      <div className="flex flex-wrap items-center gap-1 px-2 py-1 min-h-[36px] border-b border-gray-200 focus-within:border-orange-500">
        {/* Email chips */}
        {value.map((email) => (
          <div
            key={email}
            className="flex items-center gap-1 px-2 py-0.5 bg-gray-100 rounded-full text-sm"
          >
            <div
              className="w-5 h-5 rounded-full flex items-center justify-center text-white text-xs"
              style={{ backgroundColor: stringToColor(email) }}
            >
              {getInitials(undefined, email)}
            </div>
            <span className="max-w-[150px] truncate">{email}</span>
            <button
              onClick={() => removeEmail(email)}
              className="p-0.5 text-gray-400 hover:text-gray-600 rounded-full hover:bg-gray-200"
            >
              <X size={12} />
            </button>
          </div>
        ))}

        {/* Input */}
        <input
          ref={inputRef}
          type="text"
          value={inputValue}
          onChange={handleInputChange}
          onKeyDown={handleKeyDown}
          onFocus={() => setIsOpen(true)}
          className="flex-1 min-w-[120px] py-1 px-1 text-sm border-0 focus:ring-0 focus:outline-none"
          placeholder={value.length === 0 ? placeholder : ''}
        />
      </div>

      {/* Suggestions dropdown */}
      {isOpen && (suggestions.length > 0 || loading) && (
        <div className="absolute z-10 mt-1 w-full bg-white rounded-lg shadow-lg border border-gray-200 max-h-64 overflow-y-auto">
          {loading && (
            <div className="px-4 py-3 text-sm text-gray-500 flex items-center gap-2">
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-orange-500" />
              Searching contacts...
            </div>
          )}

          {!loading && suggestions.length === 0 && inputValue && (
            <div className="px-4 py-3 text-sm text-gray-500">
              No contacts found
            </div>
          )}

          {suggestions.map((contact, index) => (
            <button
              key={contact.id}
              onClick={() => addEmail(contact.email)}
              className={`w-full flex items-center gap-3 px-4 py-2.5 text-left hover:bg-gray-50 transition-colors ${
                index === selectedIndex ? 'bg-orange-50' : ''
              }`}
            >
              {/* Avatar */}
              <div
                className="w-9 h-9 rounded-full flex items-center justify-center text-white text-sm font-medium flex-shrink-0"
                style={{ backgroundColor: stringToColor(contact.email) }}
              >
                {contact.avatar_url ? (
                  <img
                    src={contact.avatar_url}
                    alt={contact.name || contact.email}
                    className="w-full h-full rounded-full object-cover"
                  />
                ) : (
                  getInitials(contact.name, contact.email)
                )}
              </div>

              {/* Contact info */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className="text-sm font-medium text-gray-900 truncate">
                    {contact.name || contact.email}
                  </p>
                  {contact.is_favorite && (
                    <Star size={12} className="text-amber-400 fill-amber-400" />
                  )}
                </div>
                {contact.name && (
                  <p className="text-xs text-gray-500 truncate">{contact.email}</p>
                )}
              </div>

              {/* Frequency indicator */}
              {contact.frequency && contact.frequency > 5 && (
                <div className="flex items-center gap-1 text-xs text-gray-400" title="Frequently contacted">
                  <Clock size={12} />
                </div>
              )}
            </button>
          ))}

          {/* Add new email hint */}
          {inputValue && isValidEmail(inputValue) && !suggestions.find(s => s.email === inputValue) && (
            <button
              onClick={() => addEmail(inputValue)}
              className="w-full flex items-center gap-3 px-4 py-2.5 text-left hover:bg-gray-50 border-t border-gray-100"
            >
              <div className="w-9 h-9 rounded-full bg-gray-100 flex items-center justify-center">
                <User size={18} className="text-gray-400" />
              </div>
              <div>
                <p className="text-sm text-gray-900">
                  Add "<span className="font-medium">{inputValue}</span>"
                </p>
                <p className="text-xs text-gray-500">Press Enter or Tab to add</p>
              </div>
            </button>
          )}
        </div>
      )}
    </div>
  );
}

// Utility to create a simple contact chip display
export function ContactChip({ email, onRemove }: { email: string; onRemove?: () => void }) {
  const getInitials = (email: string) => email.slice(0, 2).toUpperCase();

  const stringToColor = (str: string): string => {
    const colors = [
      '#3b82f6', '#10b981', '#8b5cf6', '#f59e0b',
      '#ef4444', '#ec4899', '#06b6d4', '#6366f1',
    ];
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      hash = str.charCodeAt(i) + ((hash << 5) - hash);
    }
    return colors[Math.abs(hash) % colors.length];
  };

  return (
    <div className="inline-flex items-center gap-1.5 px-2 py-1 bg-gray-100 rounded-full text-sm">
      <div
        className="w-5 h-5 rounded-full flex items-center justify-center text-white text-xs"
        style={{ backgroundColor: stringToColor(email) }}
      >
        {getInitials(email)}
      </div>
      <span className="max-w-[150px] truncate">{email}</span>
      {onRemove && (
        <button
          onClick={onRemove}
          className="p-0.5 text-gray-400 hover:text-gray-600 rounded-full hover:bg-gray-200"
        >
          <X size={12} />
        </button>
      )}
    </div>
  );
}
