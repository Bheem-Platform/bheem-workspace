/**
 * Bheem Sites - Main Page
 *
 * Lists all sites accessible to the user.
 * Phase 5: Bheem Sites/Wiki
 */

import React from 'react';
import Head from 'next/head';
import Link from 'next/link';
import {
  Plus,
  Globe,
  Lock,
  Building,
  MoreVertical,
  Settings,
  Eye,
  Trash2,
  Archive,
  Search,
  Grid,
  List,
  FileText,
} from 'lucide-react';
import WorkspaceLayout from '@/components/workspace/WorkspaceLayout';
import { useSitesStore } from '@/stores/sitesStore';
import type { Site } from '@/lib/sitesApi';

export default function SitesPage() {
  const {
    sites,
    loading,
    error,
    fetchSites,
    createSite,
    deleteSite,
    clearError,
  } = useSitesStore();

  const [viewMode, setViewMode] = React.useState<'grid' | 'list'>('grid');
  const [searchQuery, setSearchQuery] = React.useState('');
  const [showCreateModal, setShowCreateModal] = React.useState(false);
  const [newSiteName, setNewSiteName] = React.useState('');
  const [newSiteDescription, setNewSiteDescription] = React.useState('');
  const [menuOpenId, setMenuOpenId] = React.useState<string | null>(null);

  React.useEffect(() => {
    fetchSites();
  }, []);

  const filteredSites = sites.filter(site =>
    site.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    site.description?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleCreateSite = async () => {
    if (!newSiteName.trim()) return;

    const site = await createSite({
      name: newSiteName.trim(),
      description: newSiteDescription.trim() || undefined,
    });

    if (site) {
      setShowCreateModal(false);
      setNewSiteName('');
      setNewSiteDescription('');
    }
  };

  const handleDeleteSite = async (siteId: string) => {
    if (confirm('Are you sure you want to delete this site? This cannot be undone.')) {
      await deleteSite(siteId);
    }
    setMenuOpenId(null);
  };

  const getVisibilityIcon = (visibility: string) => {
    switch (visibility) {
      case 'public':
        return <Globe className="w-4 h-4 text-green-500" />;
      case 'internal':
        return <Building className="w-4 h-4 text-blue-500" />;
      default:
        return <Lock className="w-4 h-4 text-gray-500" />;
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  return (
    <WorkspaceLayout title="Sites">
      <Head>
        <title>Sites - Bheem Workspace</title>
      </Head>

      <div className="h-full flex flex-col bg-gradient-to-br from-[#FFCCF2]/5 via-white to-[#977DFF]/5">
        {/* Header */}
        <header className="bg-gradient-to-r from-[#FFCCF2]/20 via-white to-[#977DFF]/10 border-b px-6 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-semibold text-gray-900">Sites</h1>
              <p className="text-sm text-gray-500 mt-1">
                Create and manage internal wikis and websites
              </p>
            </div>

            <button
              onClick={() => setShowCreateModal(true)}
              className="flex items-center gap-2 px-4 py-2 bg-[#0033FF] text-white rounded-lg hover:bg-[#0033FF]/90 transition-colors"
            >
              <Plus className="w-4 h-4" />
              New Site
            </button>
          </div>

          {/* Search and filters */}
          <div className="flex items-center gap-4 mt-4">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search sites..."
                className="w-full pl-10 pr-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-[#977DFF]"
              />
            </div>

            <div className="flex items-center border rounded-lg overflow-hidden">
              <button
                onClick={() => setViewMode('grid')}
                className={`p-2 ${viewMode === 'grid' ? 'bg-gray-100' : 'hover:bg-gray-50'}`}
              >
                <Grid className="w-4 h-4" />
              </button>
              <button
                onClick={() => setViewMode('list')}
                className={`p-2 ${viewMode === 'list' ? 'bg-gray-100' : 'hover:bg-gray-50'}`}
              >
                <List className="w-4 h-4" />
              </button>
            </div>
          </div>
        </header>

        {/* Error message */}
        {error && (
          <div className="mx-6 mt-4 px-4 py-3 bg-red-50 border border-red-200 rounded-lg flex items-center justify-between">
            <span className="text-red-700">{error}</span>
            <button onClick={clearError} className="text-red-500 hover:text-red-700">
              ×
            </button>
          </div>
        )}

        {/* Content */}
        <main className="flex-1 overflow-auto p-6">
          {loading.sites ? (
            <div className="flex items-center justify-center h-64">
              <div className="w-8 h-8 border-4 border-[#977DFF]/30 border-t-[#0033FF] rounded-full animate-spin" />
            </div>
          ) : filteredSites.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-64 text-gray-500">
              <FileText className="w-16 h-16 mb-4 text-[#977DFF]/50" />
              <p className="text-lg font-medium">
                {searchQuery ? 'No sites found' : 'No sites yet'}
              </p>
              <p className="text-sm mt-1">
                {searchQuery
                  ? 'Try a different search term'
                  : 'Create your first site to get started'}
              </p>
              {!searchQuery && (
                <button
                  onClick={() => setShowCreateModal(true)}
                  className="mt-4 px-4 py-2 bg-[#0033FF] text-white rounded-lg hover:bg-[#0033FF]/90"
                >
                  Create Site
                </button>
              )}
            </div>
          ) : viewMode === 'grid' ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {filteredSites.map((site) => (
                <SiteCard
                  key={site.id}
                  site={site}
                  menuOpen={menuOpenId === site.id}
                  onMenuToggle={() => setMenuOpenId(menuOpenId === site.id ? null : site.id)}
                  onDelete={() => handleDeleteSite(site.id)}
                  getVisibilityIcon={getVisibilityIcon}
                  formatDate={formatDate}
                />
              ))}
            </div>
          ) : (
            <div className="bg-white rounded-lg border divide-y">
              {filteredSites.map((site) => (
                <SiteRow
                  key={site.id}
                  site={site}
                  menuOpen={menuOpenId === site.id}
                  onMenuToggle={() => setMenuOpenId(menuOpenId === site.id ? null : site.id)}
                  onDelete={() => handleDeleteSite(site.id)}
                  getVisibilityIcon={getVisibilityIcon}
                  formatDate={formatDate}
                />
              ))}
            </div>
          )}
        </main>
      </div>

      {/* Create Site Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <div className="w-full max-w-md bg-white rounded-lg shadow-xl">
            <div className="p-6">
              <h2 className="text-xl font-semibold mb-4">Create New Site</h2>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Site Name *
                  </label>
                  <input
                    type="text"
                    value={newSiteName}
                    onChange={(e) => setNewSiteName(e.target.value)}
                    placeholder="My Team Wiki"
                    className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-[#977DFF]"
                    autoFocus
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Description
                  </label>
                  <textarea
                    value={newSiteDescription}
                    onChange={(e) => setNewSiteDescription(e.target.value)}
                    placeholder="A brief description of your site..."
                    rows={3}
                    className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-[#977DFF] resize-none"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-3 mt-6">
                <button
                  onClick={() => setShowCreateModal(false)}
                  className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg"
                >
                  Cancel
                </button>
                <button
                  onClick={handleCreateSite}
                  disabled={!newSiteName.trim() || loading.saving}
                  className="px-4 py-2 bg-[#0033FF] text-white rounded-lg hover:bg-[#0033FF]/90 disabled:opacity-50"
                >
                  {loading.saving ? 'Creating...' : 'Create Site'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </WorkspaceLayout>
  );
}

// Site Card Component
function SiteCard({
  site,
  menuOpen,
  onMenuToggle,
  onDelete,
  getVisibilityIcon,
  formatDate,
}: {
  site: Site;
  menuOpen: boolean;
  onMenuToggle: () => void;
  onDelete: () => void;
  getVisibilityIcon: (v: string) => React.ReactNode;
  formatDate: (d: string) => string;
}) {
  return (
    <div className="relative bg-white rounded-lg border hover:shadow-md transition-shadow">
      <Link href={`/sites/${site.slug}`}>
        <div className="p-4">
          {/* Header with logo/icon */}
          <div
            className="w-12 h-12 rounded-lg flex items-center justify-center text-white text-xl font-bold mb-3"
            style={{ backgroundColor: site.theme_color }}
          >
            {site.logo_url ? (
              <img src={site.logo_url} alt="" className="w-8 h-8 object-contain" />
            ) : (
              site.name.charAt(0).toUpperCase()
            )}
          </div>

          <h3 className="font-semibold text-gray-900 truncate">{site.name}</h3>
          {site.description && (
            <p className="text-sm text-gray-500 mt-1 line-clamp-2">{site.description}</p>
          )}

          <div className="flex items-center gap-3 mt-3 text-xs text-gray-500">
            {getVisibilityIcon(site.visibility)}
            <span>{formatDate(site.updated_at)}</span>
            {!site.is_published && (
              <span className="px-2 py-0.5 bg-yellow-100 text-yellow-700 rounded">Draft</span>
            )}
          </div>
        </div>
      </Link>

      {/* Menu button */}
      <div className="absolute top-2 right-2">
        <button
          onClick={(e) => {
            e.preventDefault();
            onMenuToggle();
          }}
          className="p-1.5 rounded-full hover:bg-gray-100"
        >
          <MoreVertical className="w-4 h-4" />
        </button>

        {menuOpen && (
          <div className="absolute right-0 mt-1 w-48 bg-white rounded-lg shadow-lg border z-10">
            <Link
              href={`/sites/${site.slug}`}
              className="flex items-center gap-2 px-3 py-2 text-sm hover:bg-gray-50"
            >
              <Eye className="w-4 h-4" />
              View Site
            </Link>
            <Link
              href={`/sites/${site.slug}/settings`}
              className="flex items-center gap-2 px-3 py-2 text-sm hover:bg-gray-50"
            >
              <Settings className="w-4 h-4" />
              Settings
            </Link>
            <hr />
            <button
              onClick={onDelete}
              className="w-full flex items-center gap-2 px-3 py-2 text-sm text-red-600 hover:bg-red-50"
            >
              <Trash2 className="w-4 h-4" />
              Delete
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// Site Row Component (List view)
function SiteRow({
  site,
  menuOpen,
  onMenuToggle,
  onDelete,
  getVisibilityIcon,
  formatDate,
}: {
  site: Site;
  menuOpen: boolean;
  onMenuToggle: () => void;
  onDelete: () => void;
  getVisibilityIcon: (v: string) => React.ReactNode;
  formatDate: (d: string) => string;
}) {
  return (
    <div className="relative flex items-center gap-4 p-4 hover:bg-gray-50">
      <Link href={`/sites/${site.slug}`} className="flex items-center gap-4 flex-1">
        <div
          className="w-10 h-10 rounded-lg flex items-center justify-center text-white font-bold"
          style={{ backgroundColor: site.theme_color }}
        >
          {site.logo_url ? (
            <img src={site.logo_url} alt="" className="w-6 h-6 object-contain" />
          ) : (
            site.name.charAt(0).toUpperCase()
          )}
        </div>

        <div className="flex-1 min-w-0">
          <h3 className="font-medium text-gray-900 truncate">{site.name}</h3>
          {site.description && (
            <p className="text-sm text-gray-500 truncate">{site.description}</p>
          )}
        </div>

        <div className="flex items-center gap-4 text-sm text-gray-500">
          {getVisibilityIcon(site.visibility)}
          <span>{formatDate(site.updated_at)}</span>
          {!site.is_published && (
            <span className="px-2 py-0.5 bg-yellow-100 text-yellow-700 rounded text-xs">
              Draft
            </span>
          )}
        </div>
      </Link>

      {/* Menu */}
      <div className="relative">
        <button onClick={onMenuToggle} className="p-2 rounded hover:bg-gray-100">
          <MoreVertical className="w-4 h-4" />
        </button>

        {menuOpen && (
          <div className="absolute right-0 mt-1 w-48 bg-white rounded-lg shadow-lg border z-10">
            <Link
              href={`/sites/${site.slug}/settings`}
              className="flex items-center gap-2 px-3 py-2 text-sm hover:bg-gray-50"
            >
              <Settings className="w-4 h-4" />
              Settings
            </Link>
            <button
              onClick={onDelete}
              className="w-full flex items-center gap-2 px-3 py-2 text-sm text-red-600 hover:bg-red-50"
            >
              <Trash2 className="w-4 h-4" />
              Delete
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
