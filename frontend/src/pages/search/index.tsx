/**
 * Bheem Workspace - Search Results Page
 *
 * Displays search results with filters and pagination.
 * Phase 8: Search Enhancement
 */

import React, { useEffect } from 'react';
import Head from 'next/head';
import { useRouter } from 'next/router';
import Link from 'next/link';
import {
  Search,
  Filter,
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
  ChevronRight,
  Loader2,
  Calendar,
  ArrowLeft,
} from 'lucide-react';
import Layout from '@/components/Layout';
import { useSearchStore } from '@/stores/searchStore';
import { SEARCHABLE_APPS, SearchableApp, SearchResultItem } from '@/lib/searchApi';

// Icon mapping
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

// Route mapping
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

export default function SearchPage() {
  const router = useRouter();
  const { q, apps: queryApps } = router.query;

  const {
    query,
    results,
    total,
    selectedApps,
    loading,
    error,
    hasSearched,
    hasMore,
    setQuery,
    toggleApp,
    setSelectedApps,
    search,
    loadMore,
    clearError,
  } = useSearchStore();

  const [showFilters, setShowFilters] = React.useState(true);
  const [localQuery, setLocalQuery] = React.useState('');

  // Initialize from URL params
  useEffect(() => {
    if (typeof q === 'string' && q !== query) {
      setQuery(q);
      setLocalQuery(q);
    }
    if (typeof queryApps === 'string') {
      setSelectedApps(queryApps.split(',') as SearchableApp[]);
    }
  }, [q, queryApps]);

  // Auto-search when query is set from URL
  useEffect(() => {
    if (query && !hasSearched && !loading) {
      search();
    }
  }, [query, hasSearched, loading, search]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (localQuery.trim()) {
      setQuery(localQuery);
      router.push(`/search?q=${encodeURIComponent(localQuery)}`, undefined, {
        shallow: true,
      });
      search();
    }
  };

  const handleResultClick = (item: SearchResultItem) => {
    const routeFn = RESULT_ROUTES[item.type];
    if (routeFn) {
      router.push(routeFn(item));
    }
  };

  const formatDate = (dateString?: string) => {
    if (!dateString) return '';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  const formatSize = (bytes?: number) => {
    if (!bytes) return '';
    const units = ['B', 'KB', 'MB', 'GB'];
    let size = bytes;
    let unitIndex = 0;
    while (size >= 1024 && unitIndex < units.length - 1) {
      size /= 1024;
      unitIndex++;
    }
    return `${size.toFixed(1)} ${units[unitIndex]}`;
  };

  return (
    <Layout>
      <Head>
        <title>
          {query ? `Search: ${query}` : 'Search'} - Bheem Workspace
        </title>
      </Head>

      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="mb-6">
          <Link
            href="/"
            className="inline-flex items-center gap-2 text-sm text-gray-500 hover:text-gray-700 mb-4"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Dashboard
          </Link>

          <h1 className="text-2xl font-semibold text-gray-900">Search</h1>
        </div>

        {/* Search Form */}
        <form onSubmit={handleSearch} className="mb-6">
          <div className="flex gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                type="text"
                value={localQuery}
                onChange={(e) => setLocalQuery(e.target.value)}
                placeholder="Search across all apps..."
                className="w-full pl-12 pr-4 py-3 text-lg border rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
            <button
              type="submit"
              disabled={!localQuery.trim() || loading}
              className="px-6 py-3 bg-blue-600 text-white rounded-xl hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                'Search'
              )}
            </button>
            <button
              type="button"
              onClick={() => setShowFilters(!showFilters)}
              className={`px-4 py-3 rounded-xl border ${
                showFilters
                  ? 'bg-blue-50 border-blue-200 text-blue-600'
                  : 'hover:bg-gray-50'
              }`}
            >
              <Filter className="w-5 h-5" />
            </button>
          </div>
        </form>

        {/* Filters */}
        {showFilters && (
          <div className="mb-6 p-4 bg-white rounded-xl border">
            <h3 className="text-sm font-medium text-gray-700 mb-3">
              Filter by app
            </h3>
            <div className="flex flex-wrap gap-2">
              {SEARCHABLE_APPS.map((app) => {
                const Icon = APP_ICONS[app.id];
                const isSelected = selectedApps.includes(app.id);
                return (
                  <button
                    key={app.id}
                    onClick={() => toggleApp(app.id)}
                    className={`flex items-center gap-2 px-4 py-2 rounded-lg border transition-colors ${
                      isSelected
                        ? 'bg-blue-50 border-blue-200 text-blue-700'
                        : 'hover:bg-gray-50'
                    }`}
                  >
                    <Icon className="w-4 h-4" />
                    {app.label}
                  </button>
                );
              })}
            </div>
            {selectedApps.length > 0 && (
              <button
                onClick={() => setSelectedApps([])}
                className="mt-3 text-sm text-gray-500 hover:text-gray-700"
              >
                Clear filters
              </button>
            )}
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-xl flex items-center justify-between">
            <span className="text-red-700">{error}</span>
            <button
              onClick={clearError}
              className="text-red-500 hover:text-red-700"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        )}

        {/* Results */}
        <div className="bg-white rounded-xl border">
          {/* Results header */}
          {hasSearched && (
            <div className="px-4 py-3 border-b">
              <span className="text-sm text-gray-500">
                {total} result{total !== 1 ? 's' : ''} for "{query}"
              </span>
            </div>
          )}

          {/* Loading state */}
          {loading && !results.length && (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="w-8 h-8 text-blue-600 animate-spin" />
            </div>
          )}

          {/* Results list */}
          {results.length > 0 && (
            <div className="divide-y">
              {results.map((item) => {
                const Icon = APP_ICONS[item.type] || FileText;
                return (
                  <button
                    key={`${item.type}-${item.id}`}
                    onClick={() => handleResultClick(item)}
                    className="w-full flex items-start gap-4 p-4 hover:bg-gray-50 text-left"
                  >
                    <div className="p-3 bg-gray-100 rounded-lg flex-shrink-0">
                      <Icon className="w-5 h-5 text-gray-600" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="font-medium text-gray-900 truncate">
                        {item.title}
                      </h3>
                      {item.snippet && (
                        <p className="text-sm text-gray-500 line-clamp-2 mt-1">
                          {item.snippet}
                        </p>
                      )}
                      <div className="flex items-center gap-3 mt-2 text-xs text-gray-400">
                        <span className="capitalize px-2 py-0.5 bg-gray-100 rounded">
                          {item.type.replace('_', ' ')}
                        </span>
                        {item.updated_at && (
                          <span className="flex items-center gap-1">
                            <Calendar className="w-3 h-3" />
                            {formatDate(item.updated_at)}
                          </span>
                        )}
                        {item.size && (
                          <span>{formatSize(item.size)}</span>
                        )}
                        {item.mime_type && (
                          <span>{item.mime_type.split('/').pop()}</span>
                        )}
                      </div>
                    </div>
                    <ChevronRight className="w-5 h-5 text-gray-400 flex-shrink-0 mt-3" />
                  </button>
                );
              })}
            </div>
          )}

          {/* Load more */}
          {hasMore && (
            <div className="p-4 border-t">
              <button
                onClick={loadMore}
                disabled={loading}
                className="w-full py-2 text-blue-600 hover:bg-blue-50 rounded-lg disabled:opacity-50"
              >
                {loading ? (
                  <Loader2 className="w-5 h-5 animate-spin mx-auto" />
                ) : (
                  'Load more results'
                )}
              </button>
            </div>
          )}

          {/* No results */}
          {hasSearched && !loading && results.length === 0 && (
            <div className="py-16 text-center">
              <Search className="w-16 h-16 text-gray-300 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900">
                No results found
              </h3>
              <p className="text-gray-500 mt-1">
                Try different keywords or adjust your filters
              </p>
            </div>
          )}

          {/* Initial state */}
          {!hasSearched && !loading && (
            <div className="py-16 text-center">
              <Search className="w-16 h-16 text-gray-300 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900">
                Search your workspace
              </h3>
              <p className="text-gray-500 mt-1">
                Find emails, files, documents, notes, and more
              </p>
            </div>
          )}
        </div>
      </div>
    </Layout>
  );
}
