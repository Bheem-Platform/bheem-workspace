/**
 * Bheem Workspace - Global Search Component
 *
 * Unified search modal with filters and results.
 * Phase 8: Search Enhancement
 */

import React, { useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/router';
import {
  Search,
  X,
  Mail,
  HardDrive,
  FileText,
  Table,
  Presentation,
  ListChecks,
  Video,
  Users,
  StickyNote,
  Globe,
  Clock,
  ChevronRight,
  Loader2,
  Filter,
  Calendar,
} from 'lucide-react';
import { useSearchStore } from '@/stores/searchStore';
import { SEARCHABLE_APPS, SearchableApp, SearchResultItem } from '@/lib/searchApi';

// Icon mapping for app types
const APP_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  mail: Mail,
  drive: HardDrive,
  docs: FileText,
  sheets: Table,
  slides: Presentation,
  forms: ListChecks,
  meet: Video,
  contacts: Users,
  notes: StickyNote,
  sites: Globe,
};

// Route mapping for result types
const RESULT_ROUTES: Record<string, (item: SearchResultItem) => string> = {
  mail: (item) => `/mail?id=${item.id}`,
  drive: (item) => `/drive?file=${item.id}`,
  docs: (item) => `/docs/${item.id}`,
  sheets: (item) => `/sheets/${item.id}`,
  slides: (item) => `/slides/${item.id}`,
  forms: (item) => `/forms/${item.id}`,
  meet: (item) => `/meet/${item.meeting_code || item.id}`,
  contacts: (item) => `/contacts?id=${item.id}`,
  notes: (item) => `/notes/${item.id}`,
  sites: (item) => item.slug ? `/sites/${item.slug}` : `/sites`,
  site_page: (item) => item.slug ? `/sites/${item.slug}` : `/sites`,
};

export default function GlobalSearch() {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const resultsRef = useRef<HTMLDivElement>(null);

  const {
    query,
    results,
    total,
    suggestions,
    recentItems,
    selectedApps,
    loading,
    loadingSuggestions,
    error,
    searchOpen,
    hasSearched,
    hasMore,
    setQuery,
    toggleApp,
    search,
    loadMore,
    fetchSuggestions,
    openSearch,
    closeSearch,
    clearSearch,
    clearError,
  } = useSearchStore();

  const [showFilters, setShowFilters] = React.useState(false);
  const [dateRange, setDateRange] = React.useState<{
    from?: string;
    to?: string;
  }>({});

  // Handle keyboard shortcut (Cmd/Ctrl + K)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        if (searchOpen) {
          closeSearch();
        } else {
          openSearch();
        }
      }
      if (e.key === 'Escape' && searchOpen) {
        closeSearch();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [searchOpen, openSearch, closeSearch]);

  // Focus input when opened
  useEffect(() => {
    if (searchOpen && inputRef.current) {
      inputRef.current.focus();
    }
  }, [searchOpen]);

  // Debounced suggestions
  useEffect(() => {
    const timer = setTimeout(() => {
      if (query.length >= 2 && !hasSearched) {
        fetchSuggestions(query);
      }
    }, 200);

    return () => clearTimeout(timer);
  }, [query, hasSearched, fetchSuggestions]);

  // Handle search submit
  const handleSearch = useCallback(
    (e?: React.FormEvent) => {
      e?.preventDefault();
      if (query.trim()) {
        search();
      }
    },
    [query, search]
  );

  // Handle result click
  const handleResultClick = (item: SearchResultItem) => {
    const routeFn = RESULT_ROUTES[item.type];
    if (routeFn) {
      router.push(routeFn(item));
      closeSearch();
    }
  };

  // Handle scroll for infinite loading
  const handleScroll = useCallback(() => {
    if (!resultsRef.current || loading || !hasMore) return;

    const { scrollTop, scrollHeight, clientHeight } = resultsRef.current;
    if (scrollTop + clientHeight >= scrollHeight - 100) {
      loadMore();
    }
  }, [loading, hasMore, loadMore]);

  // Format date for display
  const formatDate = (dateString?: string) => {
    if (!dateString) return '';
    const date = new Date(dateString);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));

    if (days === 0) return 'Today';
    if (days === 1) return 'Yesterday';
    if (days < 7) return `${days} days ago`;
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: date.getFullYear() !== now.getFullYear() ? 'numeric' : undefined,
    });
  };

  if (!searchOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-20 bg-black/50">
      <div
        className="w-full max-w-2xl bg-white rounded-xl shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Search Header */}
        <div className="border-b">
          <form onSubmit={handleSearch} className="flex items-center gap-3 px-4 py-3">
            <Search className="w-5 h-5 text-gray-400 flex-shrink-0" />
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search across all apps..."
              className="flex-1 text-lg outline-none placeholder:text-gray-400"
            />
            {query && (
              <button
                type="button"
                onClick={() => {
                  setQuery('');
                  clearSearch();
                }}
                className="p-1 rounded hover:bg-gray-100"
              >
                <X className="w-4 h-4 text-gray-400" />
              </button>
            )}
            <button
              type="button"
              onClick={() => setShowFilters(!showFilters)}
              className={`p-2 rounded-lg ${
                showFilters ? 'bg-blue-100 text-blue-600' : 'hover:bg-gray-100'
              }`}
            >
              <Filter className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={closeSearch}
              className="p-2 rounded-lg hover:bg-gray-100"
            >
              <X className="w-5 h-5" />
            </button>
          </form>

          {/* Filters */}
          {showFilters && (
            <div className="px-4 pb-3 space-y-3">
              {/* App filters */}
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-2">
                  Search in
                </label>
                <div className="flex flex-wrap gap-2">
                  {SEARCHABLE_APPS.map((app) => {
                    const Icon = APP_ICONS[app.id];
                    const isSelected = selectedApps.includes(app.id);
                    return (
                      <button
                        key={app.id}
                        onClick={() => toggleApp(app.id)}
                        className={`flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-full border transition-colors ${
                          isSelected
                            ? 'bg-blue-50 border-blue-200 text-blue-700'
                            : 'border-gray-200 hover:bg-gray-50'
                        }`}
                      >
                        <Icon className="w-3.5 h-3.5" />
                        {app.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Date filters */}
              <div className="flex gap-4">
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">
                    From
                  </label>
                  <input
                    type="date"
                    value={dateRange.from || ''}
                    onChange={(e) =>
                      setDateRange((prev) => ({ ...prev, from: e.target.value }))
                    }
                    className="px-3 py-1.5 text-sm border rounded-lg"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">
                    To
                  </label>
                  <input
                    type="date"
                    value={dateRange.to || ''}
                    onChange={(e) =>
                      setDateRange((prev) => ({ ...prev, to: e.target.value }))
                    }
                    className="px-3 py-1.5 text-sm border rounded-lg"
                  />
                </div>
              </div>
            </div>
          )}

          {/* Keyboard hint */}
          <div className="px-4 py-2 text-xs text-gray-400 bg-gray-50 flex items-center justify-between">
            <span>Press Enter to search</span>
            <span>
              <kbd className="px-1.5 py-0.5 bg-white border rounded text-xs">Esc</kbd> to
              close
            </span>
          </div>
        </div>

        {/* Results Area */}
        <div
          ref={resultsRef}
          className="max-h-[60vh] overflow-y-auto"
          onScroll={handleScroll}
        >
          {/* Error */}
          {error && (
            <div className="p-4 bg-red-50 text-red-700 flex items-center justify-between">
              <span>{error}</span>
              <button onClick={clearError} className="text-red-500 hover:text-red-700">
                <X className="w-4 h-4" />
              </button>
            </div>
          )}

          {/* Loading */}
          {loading && !results.length && (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-6 h-6 text-blue-600 animate-spin" />
            </div>
          )}

          {/* Results */}
          {hasSearched && results.length > 0 && (
            <div className="py-2">
              <div className="px-4 py-2 text-xs font-medium text-gray-500">
                {total} result{total !== 1 ? 's' : ''} for "{query}"
              </div>
              {results.map((item) => (
                <SearchResultRow
                  key={`${item.type}-${item.id}`}
                  item={item}
                  onClick={() => handleResultClick(item)}
                  formatDate={formatDate}
                />
              ))}
              {loading && hasMore && (
                <div className="flex items-center justify-center py-4">
                  <Loader2 className="w-5 h-5 text-blue-600 animate-spin" />
                </div>
              )}
            </div>
          )}

          {/* No Results */}
          {hasSearched && !loading && results.length === 0 && (
            <div className="py-12 text-center">
              <Search className="w-12 h-12 text-gray-300 mx-auto mb-3" />
              <p className="text-gray-500">No results found for "{query}"</p>
              <p className="text-sm text-gray-400 mt-1">
                Try different keywords or adjust filters
              </p>
            </div>
          )}

          {/* Suggestions */}
          {!hasSearched && suggestions.length > 0 && (
            <div className="py-2">
              <div className="px-4 py-2 text-xs font-medium text-gray-500">
                Suggestions
              </div>
              {suggestions.map((suggestion, i) => (
                <button
                  key={i}
                  onClick={() => {
                    setQuery(suggestion.text);
                    search();
                  }}
                  className="w-full flex items-center gap-3 px-4 py-2 hover:bg-gray-50"
                >
                  <Search className="w-4 h-4 text-gray-400" />
                  <span>{suggestion.text}</span>
                  {suggestion.result_count && (
                    <span className="text-xs text-gray-400 ml-auto">
                      {suggestion.result_count} results
                    </span>
                  )}
                </button>
              ))}
            </div>
          )}

          {/* Recent Items */}
          {!hasSearched && !query && recentItems.length > 0 && (
            <div className="py-2">
              <div className="px-4 py-2 text-xs font-medium text-gray-500 flex items-center gap-2">
                <Clock className="w-3.5 h-3.5" />
                Recent
              </div>
              {recentItems.slice(0, 5).map((item) => {
                const Icon = APP_ICONS[item.type] || FileText;
                return (
                  <button
                    key={`${item.type}-${item.id}`}
                    onClick={() =>
                      handleResultClick(item as SearchResultItem)
                    }
                    className="w-full flex items-center gap-3 px-4 py-2 hover:bg-gray-50"
                  >
                    <Icon className="w-4 h-4 text-gray-400" />
                    <span className="truncate">{item.title}</span>
                    <span className="text-xs text-gray-400 ml-auto">
                      {formatDate(item.updated_at)}
                    </span>
                  </button>
                );
              })}
            </div>
          )}

          {/* Empty State */}
          {!hasSearched && !query && recentItems.length === 0 && !loadingSuggestions && (
            <div className="py-12 text-center">
              <Search className="w-12 h-12 text-gray-300 mx-auto mb-3" />
              <p className="text-gray-500">Search across your workspace</p>
              <p className="text-sm text-gray-400 mt-1">
                Mail, Drive, Docs, Notes, Sites and more
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Backdrop click to close */}
      <div className="absolute inset-0 -z-10" onClick={closeSearch} />
    </div>
  );
}

// Search Result Row Component
function SearchResultRow({
  item,
  onClick,
  formatDate,
}: {
  item: SearchResultItem;
  onClick: () => void;
  formatDate: (date?: string) => string;
}) {
  const Icon = APP_ICONS[item.type] || FileText;

  return (
    <button
      onClick={onClick}
      className="w-full flex items-start gap-3 px-4 py-3 hover:bg-gray-50 text-left"
    >
      <div className="p-2 bg-gray-100 rounded-lg flex-shrink-0">
        <Icon className="w-4 h-4 text-gray-600" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="font-medium text-gray-900 truncate">{item.title}</div>
        {item.snippet && (
          <p className="text-sm text-gray-500 line-clamp-2 mt-0.5">{item.snippet}</p>
        )}
        <div className="flex items-center gap-2 mt-1 text-xs text-gray-400">
          <span className="capitalize">{item.type.replace('_', ' ')}</span>
          {item.updated_at && (
            <>
              <span>-</span>
              <span>{formatDate(item.updated_at)}</span>
            </>
          )}
          {item.mime_type && (
            <>
              <span>-</span>
              <span>{item.mime_type.split('/').pop()}</span>
            </>
          )}
        </div>
      </div>
      <ChevronRight className="w-4 h-4 text-gray-400 flex-shrink-0 mt-2" />
    </button>
  );
}
