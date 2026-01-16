/**
 * Bheem Slides - Presentation List
 * Google Slides-like presentation management
 */
import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import Link from 'next/link';
import {
  Plus,
  Search,
  Grid,
  List,
  Star,
  StarOff,
  MoreVertical,
  Trash2,
  Copy,
  Share2,
  Clock,
  Folder,
  Presentation,
  Users,
  ArrowUpDown,
  Layout,
  FileText,
  Briefcase,
} from 'lucide-react';
import { useRequireAuth } from '@/stores/authStore';
import { api } from '@/lib/api';
import AppSwitcherBar from '@/components/shared/AppSwitcherBar';
import AppLauncher from '@/components/shared/AppLauncher';
import DocsSidebar from '@/components/docs/DocsSidebar';

interface PresentationItem {
  id: string;
  title: string;
  description: string | null;
  is_starred: boolean;
  is_deleted: boolean;
  slide_count: number;
  created_at: string;
  updated_at: string;
  thumbnail_url?: string;
}

export default function SlidesPage() {
  const router = useRouter();
  const { isAuthenticated, isLoading: authLoading } = useRequireAuth();

  const [presentations, setPresentations] = useState<PresentationItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [searchQuery, setSearchQuery] = useState('');
  const [filter, setFilter] = useState<'all' | 'starred' | 'recent'>('all');
  const [contextMenu, setContextMenu] = useState<{ id: string; x: number; y: number } | null>(null);

  const fetchPresentations = useCallback(async () => {
    try {
      setLoading(true);
      const params: Record<string, any> = {};
      if (filter === 'starred') params.starred = true;
      if (searchQuery) params.search = searchQuery;

      const response = await api.get('/slides', { params });
      setPresentations(response.data.presentations || []);
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Failed to load presentations');
    } finally {
      setLoading(false);
    }
  }, [filter, searchQuery]);

  useEffect(() => {
    if (isAuthenticated && !authLoading) {
      fetchPresentations();
    }
  }, [isAuthenticated, authLoading, fetchPresentations]);

  const createPresentation = async (templateId?: string) => {
    try {
      const response = await api.post('/slides', {
        title: 'Untitled presentation',
        template_id: templateId,
      });
      router.push(`/slides/${response.data.presentation.id}`);
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Failed to create presentation');
    }
  };

  const toggleStar = async (id: string) => {
    try {
      await api.post(`/slides/${id}/star`);
      setPresentations((prev) =>
        prev.map((p) => (p.id === id ? { ...p, is_starred: !p.is_starred } : p))
      );
    } catch (err) {
      console.error('Failed to toggle star:', err);
    }
  };

  const deletePresentation = async (id: string) => {
    try {
      await api.delete(`/slides/${id}`);
      setPresentations((prev) => prev.filter((p) => p.id !== id));
      setContextMenu(null);
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Failed to delete presentation');
    }
  };

  const duplicatePresentation = async (id: string) => {
    try {
      const response = await api.post(`/slides/${id}/duplicate`);
      setPresentations((prev) => [response.data.presentation, ...prev]);
      setContextMenu(null);
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Failed to duplicate presentation');
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins} min ago`;
    if (diffHours < 24) return `${diffHours} hours ago`;
    if (diffDays < 7) return `${diffDays} days ago`;
    return date.toLocaleDateString();
  };

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-yellow-600"></div>
      </div>
    );
  }

  const filteredPresentations = presentations.filter((p) => {
    if (searchQuery) {
      return p.title.toLowerCase().includes(searchQuery.toLowerCase());
    }
    return true;
  });

  return (
    <>
      <Head>
        <title>Bheem Slides - Presentations</title>
      </Head>

      <div className="min-h-screen bg-gray-50 flex">
        {/* App Switcher Bar */}
        <AppSwitcherBar activeApp="docs" />

        {/* Docs Sidebar */}
        <div className="fixed left-[60px] top-0 bottom-0 w-[240px] z-40">
          <DocsSidebar activeType="slides" />
        </div>

        {/* Main Content */}
        <div className="flex-1 ml-[300px]">
          {/* Header */}
          <header className="bg-white border-b border-gray-200 sticky top-0 z-30">
            <div className="px-6">
              <div className="flex items-center justify-between h-16">
                <div className="flex items-center space-x-4">
                  <Presentation className="h-8 w-8 text-yellow-600" />
                  <span className="text-xl font-semibold text-gray-900">Presentations</span>
                </div>

                {/* Search */}
                <div className="flex-1 max-w-xl mx-8">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
                    <input
                      type="text"
                      placeholder="Search presentations..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="w-full pl-10 pr-4 py-2 bg-gray-100 border border-transparent rounded-lg focus:bg-white focus:border-yellow-500 focus:ring-1 focus:ring-yellow-500"
                    />
                  </div>
                </div>

                {/* Actions */}
                <div className="flex items-center space-x-2">
                  <button
                    onClick={() => setViewMode(viewMode === 'grid' ? 'list' : 'grid')}
                    className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg"
                    title={viewMode === 'grid' ? 'List view' : 'Grid view'}
                  >
                    {viewMode === 'grid' ? <List size={20} /> : <Grid size={20} />}
                  </button>
                  <AppLauncher />
                </div>
              </div>
            </div>
          </header>

          <main className="px-6 py-8">
          {/* Create New Section */}
          <section className="mb-8">
            <h2 className="text-sm font-medium text-gray-500 mb-4">Start a new presentation</h2>
            <div className="flex items-start space-x-4">
              {/* Blank */}
              <button
                onClick={() => createPresentation()}
                className="group flex flex-col items-center"
              >
                <div className="w-40 h-24 bg-white border-2 border-gray-200 rounded-lg flex items-center justify-center group-hover:border-yellow-500 group-hover:shadow-md transition-all">
                  <Plus size={40} className="text-yellow-600" />
                </div>
                <span className="mt-2 text-sm text-gray-700">Blank</span>
              </button>

              {/* Templates */}
              <button
                onClick={() => createPresentation('business-proposal')}
                className="group flex flex-col items-center"
              >
                <div className="w-40 h-24 bg-gradient-to-br from-blue-50 to-blue-100 border-2 border-gray-200 rounded-lg flex items-center justify-center group-hover:border-yellow-500 group-hover:shadow-md transition-all">
                  <Briefcase size={32} className="text-blue-600" />
                </div>
                <span className="mt-2 text-sm text-gray-700">Business Proposal</span>
              </button>

              <button
                onClick={() => createPresentation('team-meeting')}
                className="group flex flex-col items-center"
              >
                <div className="w-40 h-24 bg-gradient-to-br from-green-50 to-green-100 border-2 border-gray-200 rounded-lg flex items-center justify-center group-hover:border-yellow-500 group-hover:shadow-md transition-all">
                  <Users size={32} className="text-green-600" />
                </div>
                <span className="mt-2 text-sm text-gray-700">Team Meeting</span>
              </button>

              <button
                onClick={() => createPresentation('product-launch')}
                className="group flex flex-col items-center"
              >
                <div className="w-40 h-24 bg-gradient-to-br from-purple-50 to-purple-100 border-2 border-gray-200 rounded-lg flex items-center justify-center group-hover:border-yellow-500 group-hover:shadow-md transition-all">
                  <Layout size={32} className="text-purple-600" />
                </div>
                <span className="mt-2 text-sm text-gray-700">Product Launch</span>
              </button>
            </div>
          </section>

          {/* Filter Tabs */}
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center space-x-4">
              <button
                onClick={() => setFilter('all')}
                className={`px-4 py-2 text-sm font-medium rounded-lg ${
                  filter === 'all'
                    ? 'bg-yellow-100 text-yellow-700'
                    : 'text-gray-600 hover:bg-gray-100'
                }`}
              >
                All presentations
              </button>
              <button
                onClick={() => setFilter('starred')}
                className={`px-4 py-2 text-sm font-medium rounded-lg ${
                  filter === 'starred'
                    ? 'bg-yellow-100 text-yellow-700'
                    : 'text-gray-600 hover:bg-gray-100'
                }`}
              >
                <Star size={16} className="inline mr-1" />
                Starred
              </button>
              <button
                onClick={() => setFilter('recent')}
                className={`px-4 py-2 text-sm font-medium rounded-lg ${
                  filter === 'recent'
                    ? 'bg-yellow-100 text-yellow-700'
                    : 'text-gray-600 hover:bg-gray-100'
                }`}
              >
                <Clock size={16} className="inline mr-1" />
                Recent
              </button>
            </div>

            <button className="flex items-center space-x-1 text-sm text-gray-600 hover:text-gray-900">
              <ArrowUpDown size={16} />
              <span>Sort</span>
            </button>
          </div>

          {/* Error */}
          {error && (
            <div className="mb-6 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
              {error}
            </div>
          )}

          {/* Presentations */}
          {loading ? (
            <div className="flex justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-yellow-600"></div>
            </div>
          ) : filteredPresentations.length === 0 ? (
            <div className="text-center py-12">
              <Presentation className="mx-auto h-16 w-16 text-gray-300" />
              <h3 className="mt-4 text-lg font-medium text-gray-900">No presentations yet</h3>
              <p className="mt-2 text-gray-500">Create your first presentation to get started.</p>
              <button
                onClick={() => createPresentation()}
                className="mt-4 inline-flex items-center px-4 py-2 bg-yellow-600 text-white rounded-lg hover:bg-yellow-700"
              >
                <Plus size={20} className="mr-2" />
                New Presentation
              </button>
            </div>
          ) : viewMode === 'grid' ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {filteredPresentations.map((presentation) => (
                <div
                  key={presentation.id}
                  className="bg-white border border-gray-200 rounded-lg overflow-hidden hover:shadow-md transition-shadow group"
                >
                  <Link href={`/slides/${presentation.id}`}>
                    <div className="aspect-video bg-gradient-to-br from-yellow-50 to-orange-100 flex items-center justify-center relative">
                      <Presentation size={48} className="text-yellow-400" />
                      <div className="absolute bottom-2 right-2 bg-black/50 text-white text-xs px-2 py-0.5 rounded">
                        {presentation.slide_count || 0} slides
                      </div>
                    </div>
                  </Link>
                  <div className="p-3">
                    <div className="flex items-start justify-between">
                      <Link href={`/slides/${presentation.id}`} className="flex-1 min-w-0">
                        <h3 className="font-medium text-gray-900 truncate hover:text-yellow-600">
                          {presentation.title}
                        </h3>
                      </Link>
                      <div className="flex items-center space-x-1 ml-2">
                        <button
                          onClick={() => toggleStar(presentation.id)}
                          className="p-1 text-gray-400 hover:text-yellow-500"
                        >
                          {presentation.is_starred ? (
                            <Star size={16} className="text-yellow-500 fill-yellow-500" />
                          ) : (
                            <StarOff size={16} />
                          )}
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setContextMenu({
                              id: presentation.id,
                              x: e.clientX,
                              y: e.clientY,
                            });
                          }}
                          className="p-1 text-gray-400 hover:text-gray-600"
                        >
                          <MoreVertical size={16} />
                        </button>
                      </div>
                    </div>
                    <div className="mt-2 flex items-center text-xs text-gray-500">
                      <Presentation size={14} className="mr-1" />
                      <span>Opened {formatDate(presentation.updated_at)}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
              <table className="w-full">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Name</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Slides</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Last modified</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {filteredPresentations.map((presentation) => (
                    <tr key={presentation.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3">
                        <Link href={`/slides/${presentation.id}`} className="flex items-center space-x-3">
                          <Presentation size={20} className="text-yellow-600" />
                          <span className="font-medium text-gray-900 hover:text-yellow-600">
                            {presentation.title}
                          </span>
                        </Link>
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-500">
                        {presentation.slide_count || 0}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-500">
                        {formatDate(presentation.updated_at)}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end space-x-2">
                          <button
                            onClick={() => toggleStar(presentation.id)}
                            className="p-1 text-gray-400 hover:text-yellow-500"
                          >
                            {presentation.is_starred ? (
                              <Star size={16} className="text-yellow-500 fill-yellow-500" />
                            ) : (
                              <StarOff size={16} />
                            )}
                          </button>
                          <button
                            onClick={(e) => {
                              setContextMenu({
                                id: presentation.id,
                                x: e.clientX,
                                y: e.clientY,
                              });
                            }}
                            className="p-1 text-gray-400 hover:text-gray-600"
                          >
                            <MoreVertical size={16} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          </main>

          {/* Context Menu */}
          {contextMenu && (
            <>
              <div
                className="fixed inset-0 z-50"
                onClick={() => setContextMenu(null)}
              />
              <div
                className="fixed z-50 bg-white border border-gray-200 rounded-lg shadow-lg py-1 w-48"
                style={{ left: contextMenu.x, top: contextMenu.y }}
              >
                <button
                  onClick={() => duplicatePresentation(contextMenu.id)}
                  className="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-100 flex items-center space-x-2"
                >
                  <Copy size={16} />
                  <span>Make a copy</span>
                </button>
                <button
                  onClick={() => {
                    setContextMenu(null);
                  }}
                  className="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-100 flex items-center space-x-2"
                >
                  <Share2 size={16} />
                  <span>Share</span>
                </button>
                <hr className="my-1" />
                <button
                  onClick={() => deletePresentation(contextMenu.id)}
                  className="w-full px-4 py-2 text-left text-sm text-red-600 hover:bg-red-50 flex items-center space-x-2"
                >
                  <Trash2 size={16} />
                  <span>Remove</span>
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </>
  );
}
