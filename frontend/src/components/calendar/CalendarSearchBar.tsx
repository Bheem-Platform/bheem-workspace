import { useState, useCallback, useRef, useEffect } from 'react';
import { Search, X, Calendar, MapPin, Clock } from 'lucide-react';
import dayjs from 'dayjs';
import * as calendarApi from '@/lib/calendarApi';
import { useCredentialsStore } from '@/stores/credentialsStore';
import { useCalendarStore } from '@/stores/calendarStore';
import type { CalendarEvent } from '@/types/calendar';

interface CalendarSearchBarProps {
  onEventClick?: (event: CalendarEvent) => void;
}

export default function CalendarSearchBar({ onEventClick }: CalendarSearchBarProps) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<CalendarEvent[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const searchRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<NodeJS.Timeout | null>(null);

  const { goToDate, openEditModal } = useCalendarStore();
  const getNextcloudCredentials = useCredentialsStore((s) => s.getNextcloudCredentials);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Debounced search
  const handleSearch = useCallback(
    async (searchQuery: string) => {
      if (searchQuery.length < 2) {
        setResults([]);
        setError(null);
        return;
      }

      const credentials = getNextcloudCredentials();
      if (!credentials) {
        setError('Nextcloud credentials not found');
        return;
      }

      setIsLoading(true);
      setError(null);

      try {
        const data = await calendarApi.searchEvents(
          credentials.username,
          credentials.password,
          searchQuery
        );

        // Map the events to the expected format
        const mappedEvents: CalendarEvent[] = data.events.map((e: any) => ({
          id: e.id || e.uid,
          uid: e.uid || e.id,
          title: e.title || e.summary || 'Untitled',
          description: e.description || '',
          location: e.location || '',
          start: e.start,
          end: e.end || e.start,
          allDay: e.all_day || false,
          calendarId: e.calendar_id || 'personal',
          color: e.color || '#3b82f6',
          status: e.status || 'confirmed',
          visibility: e.visibility || 'public',
          attendees: e.attendees || [],
          reminders: e.reminders || [],
          created: e.created || new Date().toISOString(),
          updated: e.updated || new Date().toISOString(),
        }));

        setResults(mappedEvents);
        setIsOpen(true);
      } catch (err: any) {
        console.error('Search error:', err);
        setError(err.response?.data?.detail || 'Search failed');
        setResults([]);
      } finally {
        setIsLoading(false);
      }
    },
    [getNextcloudCredentials]
  );

  // Handle input change with debounce
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setQuery(value);

    // Clear previous debounce
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }

    // Set new debounce
    debounceRef.current = setTimeout(() => {
      handleSearch(value);
    }, 300);
  };

  // Handle event click
  const handleEventClick = (event: CalendarEvent) => {
    setIsOpen(false);
    setQuery('');
    setResults([]);

    // Navigate to the event's date
    goToDate(new Date(event.start));

    // Open the event modal if handler provided
    if (onEventClick) {
      onEventClick(event);
    } else {
      openEditModal(event);
    }
  };

  // Clear search
  const handleClear = () => {
    setQuery('');
    setResults([]);
    setError(null);
    setIsOpen(false);
  };

  // Format event time for display
  const formatEventTime = (event: CalendarEvent) => {
    if (event.allDay) {
      return dayjs(event.start).format('MMM D, YYYY');
    }
    return `${dayjs(event.start).format('MMM D, YYYY h:mm A')} - ${dayjs(event.end).format('h:mm A')}`;
  };

  return (
    <div ref={searchRef} className="relative">
      {/* Search Input */}
      <div className="relative">
        <div className="flex items-center border border-gray-300 rounded-lg bg-white px-3 py-2 focus-within:ring-2 focus-within:ring-blue-500 focus-within:border-blue-500 transition-shadow">
          <Search className="w-4 h-4 text-gray-400 flex-shrink-0" />
          <input
            type="text"
            placeholder="Search events..."
            value={query}
            onChange={handleInputChange}
            onFocus={() => results.length > 0 && setIsOpen(true)}
            className="ml-2 flex-1 outline-none text-sm placeholder-gray-400 bg-transparent min-w-[200px]"
          />
          {isLoading && (
            <div className="w-4 h-4 border-2 border-gray-300 border-t-blue-500 rounded-full animate-spin" />
          )}
          {query && !isLoading && (
            <button
              onClick={handleClear}
              className="p-1 hover:bg-gray-100 rounded-full transition-colors"
            >
              <X className="w-4 h-4 text-gray-400" />
            </button>
          )}
        </div>
      </div>

      {/* Results Dropdown */}
      {isOpen && (query.length >= 2) && (
        <div className="absolute top-full left-0 right-0 mt-2 bg-white rounded-lg shadow-xl border border-gray-200 z-50 max-h-96 overflow-hidden">
          {error ? (
            <div className="p-4 text-center text-red-500 text-sm">
              {error}
            </div>
          ) : results.length === 0 ? (
            <div className="p-4 text-center text-gray-500 text-sm">
              {isLoading ? 'Searching...' : 'No events found'}
            </div>
          ) : (
            <div className="overflow-y-auto max-h-96">
              <div className="p-2 text-xs text-gray-500 border-b border-gray-100">
                {results.length} event{results.length !== 1 ? 's' : ''} found
              </div>
              {results.map((event) => (
                <button
                  key={event.id}
                  onClick={() => handleEventClick(event)}
                  className="w-full p-3 hover:bg-gray-50 cursor-pointer border-b border-gray-100 last:border-b-0 text-left transition-colors"
                >
                  <div className="flex items-start gap-3">
                    {/* Color indicator */}
                    <div
                      className="w-3 h-3 rounded-full mt-1.5 flex-shrink-0"
                      style={{ backgroundColor: event.color }}
                    />

                    <div className="flex-1 min-w-0">
                      {/* Title */}
                      <p className="font-medium text-gray-900 truncate">
                        {event.title}
                      </p>

                      {/* Time */}
                      <div className="flex items-center gap-1.5 text-xs text-gray-500 mt-1">
                        <Clock className="w-3 h-3" />
                        <span>{formatEventTime(event)}</span>
                      </div>

                      {/* Location */}
                      {event.location && (
                        <div className="flex items-center gap-1.5 text-xs text-gray-500 mt-0.5">
                          <MapPin className="w-3 h-3" />
                          <span className="truncate">{event.location}</span>
                        </div>
                      )}

                      {/* Description preview */}
                      {event.description && (
                        <p className="text-xs text-gray-400 mt-1 line-clamp-1">
                          {event.description}
                        </p>
                      )}
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
