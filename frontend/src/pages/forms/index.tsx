/**
 * Bheem Forms - Form List
 * Google Forms-like form management
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
  FileQuestion,
  Users,
  ArrowUpDown,
  CheckSquare,
  BarChart3,
  Send,
  Eye,
  Settings,
} from 'lucide-react';
import { useRequireAuth } from '@/stores/authStore';
import { api } from '@/lib/api';

interface FormItem {
  id: string;
  title: string;
  description: string | null;
  status: 'draft' | 'published' | 'closed';
  is_starred: boolean;
  is_deleted: boolean;
  response_count: number;
  created_at: string;
  updated_at: string;
}

export default function FormsPage() {
  const router = useRouter();
  const { isAuthenticated, isLoading: authLoading } = useRequireAuth();

  const [forms, setForms] = useState<FormItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [searchQuery, setSearchQuery] = useState('');
  const [filter, setFilter] = useState<'all' | 'starred' | 'draft' | 'published'>('all');
  const [contextMenu, setContextMenu] = useState<{ id: string; x: number; y: number } | null>(null);

  const fetchForms = useCallback(async () => {
    try {
      setLoading(true);
      const params: Record<string, any> = {};
      if (filter === 'starred') params.starred = true;
      if (filter === 'draft' || filter === 'published') params.status = filter;
      if (searchQuery) params.search = searchQuery;

      const response = await api.get('/forms', { params });
      setForms(response.data.forms || []);
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Failed to load forms');
    } finally {
      setLoading(false);
    }
  }, [filter, searchQuery]);

  useEffect(() => {
    if (isAuthenticated && !authLoading) {
      fetchForms();
    }
  }, [isAuthenticated, authLoading, fetchForms]);

  const createForm = async (templateId?: string) => {
    try {
      const response = await api.post('/forms', {
        title: 'Untitled form',
        template_id: templateId,
      });
      router.push(`/forms/${response.data.form.id}/edit`);
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Failed to create form');
    }
  };

  const toggleStar = async (id: string) => {
    try {
      await api.post(`/forms/${id}/star`);
      setForms((prev) =>
        prev.map((f) => (f.id === id ? { ...f, is_starred: !f.is_starred } : f))
      );
    } catch (err) {
      console.error('Failed to toggle star:', err);
    }
  };

  const deleteForm = async (id: string) => {
    try {
      await api.delete(`/forms/${id}`);
      setForms((prev) => prev.filter((f) => f.id !== id));
      setContextMenu(null);
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Failed to delete form');
    }
  };

  const duplicateForm = async (id: string) => {
    try {
      const response = await api.post(`/forms/${id}/duplicate`);
      setForms((prev) => [response.data.form, ...prev]);
      setContextMenu(null);
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Failed to duplicate form');
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

  const getStatusBadge = (status: string) => {
    const styles = {
      draft: 'bg-gray-100 text-gray-700',
      published: 'bg-green-100 text-green-700',
      closed: 'bg-red-100 text-red-700',
    };
    const labels = {
      draft: 'Draft',
      published: 'Live',
      closed: 'Closed',
    };
    return (
      <span className={`px-2 py-0.5 text-xs font-medium rounded-full ${styles[status as keyof typeof styles] || styles.draft}`}>
        {labels[status as keyof typeof labels] || status}
      </span>
    );
  };

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600"></div>
      </div>
    );
  }

  const filteredForms = forms.filter((f) => {
    if (searchQuery) {
      return f.title.toLowerCase().includes(searchQuery.toLowerCase());
    }
    return true;
  });

  return (
    <>
      <Head>
        <title>Bheem Forms - Surveys & Data Collection</title>
      </Head>

      <div className="min-h-screen bg-gray-50">
        {/* Header */}
        <header className="bg-white border-b border-gray-200 sticky top-0 z-40">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex items-center justify-between h-16">
              <div className="flex items-center space-x-4">
                <Link href="/dashboard" className="flex items-center space-x-2">
                  <FileQuestion className="h-8 w-8 text-purple-600" />
                  <span className="text-xl font-semibold text-gray-900">Bheem Forms</span>
                </Link>
              </div>

              {/* Search */}
              <div className="flex-1 max-w-2xl mx-8">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
                  <input
                    type="text"
                    placeholder="Search forms..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full pl-10 pr-4 py-2 bg-gray-100 border border-transparent rounded-lg focus:bg-white focus:border-purple-500 focus:ring-1 focus:ring-purple-500"
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
              </div>
            </div>
          </div>
        </header>

        <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          {/* Create New Section */}
          <section className="mb-8">
            <h2 className="text-sm font-medium text-gray-500 mb-4">Start a new form</h2>
            <div className="flex items-start space-x-4">
              {/* Blank */}
              <button
                onClick={() => createForm()}
                className="group flex flex-col items-center"
              >
                <div className="w-36 h-28 bg-white border-2 border-gray-200 rounded-lg flex items-center justify-center group-hover:border-purple-500 group-hover:shadow-md transition-all">
                  <Plus size={40} className="text-purple-600" />
                </div>
                <span className="mt-2 text-sm text-gray-700">Blank</span>
              </button>

              {/* Templates */}
              <button
                onClick={() => createForm('event-registration')}
                className="group flex flex-col items-center"
              >
                <div className="w-36 h-28 bg-gradient-to-br from-blue-50 to-blue-100 border-2 border-gray-200 rounded-lg flex items-center justify-center group-hover:border-purple-500 group-hover:shadow-md transition-all">
                  <Users size={32} className="text-blue-600" />
                </div>
                <span className="mt-2 text-sm text-gray-700">Event Registration</span>
              </button>

              <button
                onClick={() => createForm('feedback-survey')}
                className="group flex flex-col items-center"
              >
                <div className="w-36 h-28 bg-gradient-to-br from-green-50 to-green-100 border-2 border-gray-200 rounded-lg flex items-center justify-center group-hover:border-purple-500 group-hover:shadow-md transition-all">
                  <BarChart3 size={32} className="text-green-600" />
                </div>
                <span className="mt-2 text-sm text-gray-700">Feedback Survey</span>
              </button>

              <button
                onClick={() => createForm('contact-form')}
                className="group flex flex-col items-center"
              >
                <div className="w-36 h-28 bg-gradient-to-br from-purple-50 to-purple-100 border-2 border-gray-200 rounded-lg flex items-center justify-center group-hover:border-purple-500 group-hover:shadow-md transition-all">
                  <Send size={32} className="text-purple-600" />
                </div>
                <span className="mt-2 text-sm text-gray-700">Contact Form</span>
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
                    ? 'bg-purple-100 text-purple-700'
                    : 'text-gray-600 hover:bg-gray-100'
                }`}
              >
                All forms
              </button>
              <button
                onClick={() => setFilter('starred')}
                className={`px-4 py-2 text-sm font-medium rounded-lg ${
                  filter === 'starred'
                    ? 'bg-purple-100 text-purple-700'
                    : 'text-gray-600 hover:bg-gray-100'
                }`}
              >
                <Star size={16} className="inline mr-1" />
                Starred
              </button>
              <button
                onClick={() => setFilter('draft')}
                className={`px-4 py-2 text-sm font-medium rounded-lg ${
                  filter === 'draft'
                    ? 'bg-purple-100 text-purple-700'
                    : 'text-gray-600 hover:bg-gray-100'
                }`}
              >
                Drafts
              </button>
              <button
                onClick={() => setFilter('published')}
                className={`px-4 py-2 text-sm font-medium rounded-lg ${
                  filter === 'published'
                    ? 'bg-purple-100 text-purple-700'
                    : 'text-gray-600 hover:bg-gray-100'
                }`}
              >
                Published
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

          {/* Forms */}
          {loading ? (
            <div className="flex justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600"></div>
            </div>
          ) : filteredForms.length === 0 ? (
            <div className="text-center py-12">
              <FileQuestion className="mx-auto h-16 w-16 text-gray-300" />
              <h3 className="mt-4 text-lg font-medium text-gray-900">No forms yet</h3>
              <p className="mt-2 text-gray-500">Create your first form to start collecting responses.</p>
              <button
                onClick={() => createForm()}
                className="mt-4 inline-flex items-center px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700"
              >
                <Plus size={20} className="mr-2" />
                New Form
              </button>
            </div>
          ) : viewMode === 'grid' ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredForms.map((form) => (
                <div
                  key={form.id}
                  className="bg-white border border-gray-200 rounded-lg overflow-hidden hover:shadow-md transition-shadow group"
                >
                  <div className="p-4">
                    <div className="flex items-start justify-between mb-3">
                      <Link href={`/forms/${form.id}/edit`} className="flex-1 min-w-0">
                        <h3 className="font-medium text-gray-900 truncate hover:text-purple-600">
                          {form.title}
                        </h3>
                      </Link>
                      <div className="flex items-center space-x-1 ml-2">
                        <button
                          onClick={() => toggleStar(form.id)}
                          className="p-1 text-gray-400 hover:text-yellow-500"
                        >
                          {form.is_starred ? (
                            <Star size={16} className="text-yellow-500 fill-yellow-500" />
                          ) : (
                            <StarOff size={16} />
                          )}
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setContextMenu({
                              id: form.id,
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

                    {form.description && (
                      <p className="text-sm text-gray-500 mb-3 line-clamp-2">{form.description}</p>
                    )}

                    <div className="flex items-center justify-between text-sm">
                      <div className="flex items-center space-x-3">
                        {getStatusBadge(form.status)}
                        <span className="text-gray-500 flex items-center">
                          <CheckSquare size={14} className="mr-1" />
                          {form.response_count} responses
                        </span>
                      </div>
                    </div>

                    <div className="mt-3 pt-3 border-t border-gray-100 flex items-center justify-between">
                      <span className="text-xs text-gray-400">
                        Modified {formatDate(form.updated_at)}
                      </span>
                      <div className="flex items-center space-x-1">
                        <Link
                          href={`/forms/${form.id}/edit`}
                          className="p-1.5 text-gray-400 hover:text-purple-600 hover:bg-purple-50 rounded"
                          title="Edit"
                        >
                          <Settings size={14} />
                        </Link>
                        {form.status === 'published' && (
                          <Link
                            href={`/forms/${form.id}`}
                            className="p-1.5 text-gray-400 hover:text-purple-600 hover:bg-purple-50 rounded"
                            title="Preview"
                          >
                            <Eye size={14} />
                          </Link>
                        )}
                        <Link
                          href={`/forms/${form.id}/responses`}
                          className="p-1.5 text-gray-400 hover:text-purple-600 hover:bg-purple-50 rounded"
                          title="Responses"
                        >
                          <BarChart3 size={14} />
                        </Link>
                      </div>
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
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Responses</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Last modified</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {filteredForms.map((form) => (
                    <tr key={form.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3">
                        <Link href={`/forms/${form.id}/edit`} className="flex items-center space-x-3">
                          <FileQuestion size={20} className="text-purple-600" />
                          <span className="font-medium text-gray-900 hover:text-purple-600">
                            {form.title}
                          </span>
                        </Link>
                      </td>
                      <td className="px-4 py-3">
                        {getStatusBadge(form.status)}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-500">
                        {form.response_count}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-500">
                        {formatDate(form.updated_at)}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end space-x-2">
                          <button
                            onClick={() => toggleStar(form.id)}
                            className="p-1 text-gray-400 hover:text-yellow-500"
                          >
                            {form.is_starred ? (
                              <Star size={16} className="text-yellow-500 fill-yellow-500" />
                            ) : (
                              <StarOff size={16} />
                            )}
                          </button>
                          <button
                            onClick={(e) => {
                              setContextMenu({
                                id: form.id,
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
                onClick={() => duplicateForm(contextMenu.id)}
                className="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-100 flex items-center space-x-2"
              >
                <Copy size={16} />
                <span>Make a copy</span>
              </button>
              <button
                onClick={() => setContextMenu(null)}
                className="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-100 flex items-center space-x-2"
              >
                <Share2 size={16} />
                <span>Share</span>
              </button>
              <hr className="my-1" />
              <button
                onClick={() => deleteForm(contextMenu.id)}
                className="w-full px-4 py-2 text-left text-sm text-red-600 hover:bg-red-50 flex items-center space-x-2"
              >
                <Trash2 size={16} />
                <span>Remove</span>
              </button>
            </div>
          </>
        )}
      </div>
    </>
  );
}
