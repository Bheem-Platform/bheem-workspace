/**
 * Bheem OForms - Document Forms List
 * Professional document forms with OnlyOffice
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
  FileText,
  ArrowUpDown,
  Eye,
  Edit3,
  Download,
  X,
  Link2,
  Mail,
  UserPlus,
  Upload,
} from 'lucide-react';
import { useRequireAuth } from '@/stores/authStore';
import { api } from '@/lib/api';
import AppSwitcherBar from '@/components/shared/AppSwitcherBar';
import AppLauncher from '@/components/shared/AppLauncher';
import DocsSidebar from '@/components/docs/DocsSidebar';
import Pagination from '@/components/shared/Pagination';

interface OFormItem {
  id: string;
  title: string;
  description: string | null;
  form_type: 'docxf' | 'oform';
  status: 'draft' | 'published' | 'closed';
  is_starred: boolean;
  is_deleted: boolean;
  response_count: number;
  version: number;
  created_at: string;
  updated_at: string;
}

export default function OFormsPage() {
  const router = useRouter();
  const { isAuthenticated, isLoading: authLoading } = useRequireAuth();

  const [forms, setForms] = useState<OFormItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [searchQuery, setSearchQuery] = useState('');
  const [filter, setFilter] = useState<'all' | 'starred' | 'draft' | 'published'>('all');
  const [contextMenu, setContextMenu] = useState<{ id: string; x: number; y: number } | null>(null);
  const [shareModal, setShareModal] = useState<{ formId: string; formTitle: string } | null>(null);
  const [shareEmail, setShareEmail] = useState('');
  const [sharePermission, setSharePermission] = useState<'view' | 'edit' | 'fill'>('fill');
  const [sharingLoading, setSharingLoading] = useState(false);
  const [existingShares, setExistingShares] = useState<any[]>([]);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [uploadingFile, setUploadingFile] = useState(false);

  // Sorting
  const [sortBy, setSortBy] = useState<'title' | 'updated_at' | 'created_at'>('updated_at');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [showSortMenu, setShowSortMenu] = useState(false);

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);

  const fetchForms = useCallback(async () => {
    try {
      setLoading(true);
      const params: Record<string, any> = {};
      if (filter === 'starred') params.starred = true;
      if (filter === 'draft' || filter === 'published') params.status = filter;
      if (searchQuery) params.search = searchQuery;

      const response = await api.get('/oforms', { params });
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

  // Reset to page 1 when filter or search changes
  useEffect(() => {
    setCurrentPage(1);
  }, [filter, searchQuery]);

  const createForm = async (formType: 'docxf' | 'oform' = 'docxf') => {
    try {
      const response = await api.post('/oforms', {
        title: 'Untitled Form',
        form_type: formType,
      });
      router.push(`/oforms/${response.data.id}`);
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Failed to create form');
    }
  };

  const uploadForm = async (file: File) => {
    try {
      setUploadingFile(true);
      const formData = new FormData();
      formData.append('file', file);
      formData.append('title', file.name.replace(/\.(docxf|oform)$/i, ''));

      const response = await api.post('/oforms/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });

      router.push(`/oforms/${response.data.id}`);
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Failed to upload form');
    } finally {
      setUploadingFile(false);
      setShowUploadModal(false);
    }
  };

  const toggleStar = async (id: string) => {
    try {
      await api.post(`/oforms/${id}/star`);
      setForms((prev) =>
        prev.map((f) => (f.id === id ? { ...f, is_starred: !f.is_starred } : f))
      );
    } catch (err) {
      console.error('Failed to toggle star:', err);
    }
  };

  const deleteForm = async (id: string) => {
    try {
      await api.delete(`/oforms/${id}`);
      setForms((prev) => prev.filter((f) => f.id !== id));
      setContextMenu(null);
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Failed to delete form');
    }
  };

  const duplicateForm = async (id: string) => {
    try {
      const response = await api.post(`/oforms/${id}/duplicate`);
      setForms((prev) => [response.data, ...prev]);
      setContextMenu(null);
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Failed to duplicate form');
    }
  };

  const openShareModal = async (id: string, title: string) => {
    setShareModal({ formId: id, formTitle: title });
    setShareEmail('');
    setSharePermission('fill');
    setContextMenu(null);
    try {
      const response = await api.get(`/oforms/${id}/shares`);
      setExistingShares(response.data.shares || []);
    } catch (err) {
      console.error('Failed to load shares:', err);
      setExistingShares([]);
    }
  };

  const shareForm = async () => {
    if (!shareModal || !shareEmail.trim()) return;

    setSharingLoading(true);
    try {
      await api.post(`/oforms/${shareModal.formId}/share`, {
        email: shareEmail.trim(),
        permission: sharePermission,
      });
      const response = await api.get(`/oforms/${shareModal.formId}/shares`);
      setExistingShares(response.data.shares || []);
      setShareEmail('');
      setError(null);
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Failed to share form');
    } finally {
      setSharingLoading(false);
    }
  };

  const removeShare = async (shareId: string) => {
    if (!shareModal) return;
    try {
      await api.delete(`/oforms/${shareModal.formId}/shares/${shareId}`);
      setExistingShares((prev) => prev.filter((s) => s.id !== shareId));
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Failed to remove share');
    }
  };

  const copyPublicUrl = (formId: string) => {
    const publicUrl = `${window.location.origin}/oforms/${formId}/fill`;
    navigator.clipboard.writeText(publicUrl);
    alert('Form fill URL copied to clipboard!');
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
      draft: 'bg-yellow-100 text-yellow-700',
      published: 'bg-green-100 text-green-700',
      closed: 'bg-gray-100 text-gray-700',
    };
    const labels = {
      draft: 'Draft',
      published: 'Published',
      closed: 'Closed',
    };
    return (
      <span className={`px-2 py-0.5 text-xs font-medium rounded-full ${styles[status as keyof typeof styles] || styles.draft}`}>
        {labels[status as keyof typeof labels] || status}
      </span>
    );
  };

  const getFormTypeBadge = (formType: string) => {
    return (
      <span className="px-2 py-0.5 text-xs font-medium rounded-full bg-purple-100 text-purple-700 uppercase">
        {formType}
      </span>
    );
  };

  // Skip showing loading screen - LoginLoader already handles the transition
  if (authLoading) {
    return null;
  }

  const filteredForms = forms
    .filter((f) => {
      if (searchQuery) {
        return f.title.toLowerCase().includes(searchQuery.toLowerCase());
      }
      return true;
    })
    .sort((a, b) => {
      let comparison = 0;
      if (sortBy === 'title') {
        comparison = a.title.localeCompare(b.title);
      } else if (sortBy === 'updated_at') {
        comparison = new Date(a.updated_at).getTime() - new Date(b.updated_at).getTime();
      } else if (sortBy === 'created_at') {
        comparison = new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
      }
      return sortOrder === 'asc' ? comparison : -comparison;
    });

  // Pagination calculations
  const totalItems = filteredForms.length;
  const totalPages = Math.ceil(totalItems / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const paginatedForms = filteredForms.slice(startIndex, startIndex + itemsPerPage);

  return (
    <>
      <Head>
        <title>Bheem OForms - Document Forms</title>
      </Head>

      <div className="min-h-screen bg-gray-50 flex">
        {/* App Switcher Bar */}
        <AppSwitcherBar activeApp="docs" />

        {/* Docs Sidebar */}
        <div className="fixed left-[60px] top-0 bottom-0 w-[240px] z-40">
          <DocsSidebar activeType="oforms" />
        </div>

        {/* Main Content */}
        <div className="flex-1 ml-[300px]">
          {/* Header */}
          <header className="bg-white border-b border-gray-200 sticky top-0 z-30">
            <div className="px-6">
              <div className="flex items-center justify-between h-16">
                <div className="flex items-center space-x-4">
                  <div className="w-10 h-10 bg-gradient-to-br from-[#FFCCF2] via-[#977DFF] to-[#0033FF] rounded-lg flex items-center justify-center shadow-sm">
                    <FileText className="h-6 w-6 text-white" />
                  </div>
                  <span className="text-xl font-semibold bg-gradient-to-r from-[#977DFF] to-[#0033FF] bg-clip-text text-transparent">
                    Document Forms
                  </span>
                </div>

                {/* Search */}
                <div className="flex-1 max-w-xl mx-8">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
                    <input
                      type="text"
                      placeholder="Search document forms..."
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
              <h2 className="text-sm font-medium text-gray-500 mb-4">Start a new document form</h2>
              <div className="flex items-start space-x-4">
                {/* Blank DOCXF */}
                <button
                  onClick={() => createForm('docxf')}
                  className="group flex flex-col items-center"
                >
                  <div className="w-36 h-28 bg-white border-2 border-gray-200 rounded-lg flex items-center justify-center group-hover:border-purple-500 group-hover:shadow-md transition-all">
                    <Plus size={40} className="text-purple-600" />
                  </div>
                  <span className="mt-2 text-sm text-gray-700">Blank Form Template</span>
                  <span className="text-xs text-gray-500">DOCXF</span>
                </button>

                {/* Upload */}
                <button
                  onClick={() => setShowUploadModal(true)}
                  className="group flex flex-col items-center"
                >
                  <div className="w-36 h-28 bg-gradient-to-br from-purple-50 to-purple-100 border-2 border-gray-200 rounded-lg flex items-center justify-center group-hover:border-purple-500 group-hover:shadow-md transition-all">
                    <Upload size={32} className="text-purple-600" />
                  </div>
                  <span className="mt-2 text-sm text-gray-700">Upload Form</span>
                  <span className="text-xs text-gray-500">DOCXF / OFORM</span>
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

              <div className="relative">
                <button
                  onClick={() => setShowSortMenu(!showSortMenu)}
                  className="flex items-center space-x-1 text-sm text-gray-600 hover:text-gray-900"
                >
                  <ArrowUpDown size={16} />
                  <span>Sort</span>
                </button>
                {showSortMenu && (
                  <div className="absolute right-0 mt-2 w-48 bg-white rounded-lg shadow-lg border border-gray-200 py-1 z-50">
                    <button
                      onClick={() => { setSortBy('updated_at'); setSortOrder('desc'); setShowSortMenu(false); }}
                      className={`w-full px-4 py-2 text-left text-sm hover:bg-gray-100 ${sortBy === 'updated_at' && sortOrder === 'desc' ? 'bg-purple-50 text-purple-700' : 'text-gray-700'}`}
                    >
                      Last Modified (Newest)
                    </button>
                    <button
                      onClick={() => { setSortBy('updated_at'); setSortOrder('asc'); setShowSortMenu(false); }}
                      className={`w-full px-4 py-2 text-left text-sm hover:bg-gray-100 ${sortBy === 'updated_at' && sortOrder === 'asc' ? 'bg-purple-50 text-purple-700' : 'text-gray-700'}`}
                    >
                      Last Modified (Oldest)
                    </button>
                    <button
                      onClick={() => { setSortBy('created_at'); setSortOrder('desc'); setShowSortMenu(false); }}
                      className={`w-full px-4 py-2 text-left text-sm hover:bg-gray-100 ${sortBy === 'created_at' && sortOrder === 'desc' ? 'bg-purple-50 text-purple-700' : 'text-gray-700'}`}
                    >
                      Created (Newest)
                    </button>
                    <button
                      onClick={() => { setSortBy('created_at'); setSortOrder('asc'); setShowSortMenu(false); }}
                      className={`w-full px-4 py-2 text-left text-sm hover:bg-gray-100 ${sortBy === 'created_at' && sortOrder === 'asc' ? 'bg-purple-50 text-purple-700' : 'text-gray-700'}`}
                    >
                      Created (Oldest)
                    </button>
                    <button
                      onClick={() => { setSortBy('title'); setSortOrder('asc'); setShowSortMenu(false); }}
                      className={`w-full px-4 py-2 text-left text-sm hover:bg-gray-100 ${sortBy === 'title' && sortOrder === 'asc' ? 'bg-purple-50 text-purple-700' : 'text-gray-700'}`}
                    >
                      Title (A-Z)
                    </button>
                    <button
                      onClick={() => { setSortBy('title'); setSortOrder('desc'); setShowSortMenu(false); }}
                      className={`w-full px-4 py-2 text-left text-sm hover:bg-gray-100 ${sortBy === 'title' && sortOrder === 'desc' ? 'bg-purple-50 text-purple-700' : 'text-gray-700'}`}
                    >
                      Title (Z-A)
                    </button>
                  </div>
                )}
              </div>
            </div>

            {/* Error */}
            {error && (
              <div className="mb-6 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg flex items-center justify-between">
                {error}
                <button onClick={() => setError(null)} className="text-red-800 hover:text-red-900">
                  <X size={16} />
                </button>
              </div>
            )}

            {/* Forms */}
            {loading ? (
              <div className="flex justify-center py-12">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600"></div>
              </div>
            ) : filteredForms.length === 0 ? (
              <div className="text-center py-12">
                <FileText className="mx-auto h-16 w-16 text-gray-300" />
                <h3 className="mt-4 text-lg font-medium text-gray-900">No document forms yet</h3>
                <p className="mt-2 text-gray-500">Create your first document form to start collecting data.</p>
                <button
                  onClick={() => createForm('docxf')}
                  className="mt-4 inline-flex items-center px-4 py-2 bg-gradient-to-r from-[#977DFF] to-[#0033FF] text-white rounded-lg hover:opacity-90"
                >
                  <Plus size={20} className="mr-2" />
                  New Form
                </button>
              </div>
            ) : viewMode === 'grid' ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {paginatedForms.map((form) => (
                  <div
                    key={form.id}
                    className="bg-white border border-gray-200 rounded-lg overflow-hidden hover:shadow-md transition-shadow group"
                  >
                    <div className="p-4">
                      <div className="flex items-start justify-between mb-3">
                        <Link href={`/oforms/${form.id}`} className="flex-1 min-w-0">
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

                      <div className="flex items-center flex-wrap gap-2 text-sm">
                        {getStatusBadge(form.status)}
                        {getFormTypeBadge(form.form_type)}
                        <span className="text-gray-500">
                          {form.response_count} response{form.response_count !== 1 ? 's' : ''}
                        </span>
                      </div>

                      <div className="mt-3 pt-3 border-t border-gray-100 flex items-center justify-between">
                        <span className="text-xs text-gray-400">
                          Modified {formatDate(form.updated_at)}
                        </span>
                        <div className="flex items-center space-x-1">
                          <Link
                            href={`/oforms/${form.id}`}
                            className="p-1.5 text-gray-400 hover:text-purple-600 hover:bg-purple-50 rounded"
                            title="Edit"
                          >
                            <Edit3 size={14} />
                          </Link>
                          {form.status === 'published' && (
                            <Link
                              href={`/oforms/${form.id}/fill`}
                              className="p-1.5 text-gray-400 hover:text-purple-600 hover:bg-purple-50 rounded"
                              title="Fill"
                            >
                              <Eye size={14} />
                            </Link>
                          )}
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
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Type</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Responses</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Modified</th>
                      <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {paginatedForms.map((form) => (
                      <tr key={form.id} className="hover:bg-gray-50">
                        <td className="px-4 py-3">
                          <Link href={`/oforms/${form.id}`} className="flex items-center space-x-3">
                            <FileText size={20} className="text-purple-600" />
                            <span className="font-medium text-gray-900 hover:text-purple-600">
                              {form.title}
                            </span>
                          </Link>
                        </td>
                        <td className="px-4 py-3">
                          {getFormTypeBadge(form.form_type)}
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

            {/* Pagination */}
            <Pagination
              currentPage={currentPage}
              totalPages={totalPages}
              totalItems={totalItems}
              itemsPerPage={itemsPerPage}
              onPageChange={setCurrentPage}
              onItemsPerPageChange={setItemsPerPage}
              showItemsPerPage={true}
              className="mt-6"
            />
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
                  onClick={() => {
                    const form = forms.find(f => f.id === contextMenu.id);
                    openShareModal(contextMenu.id, form?.title || 'Untitled Form');
                  }}
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

          {/* Upload Modal */}
          {showUploadModal && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
              <div className="bg-white rounded-lg shadow-xl w-full max-w-md mx-4 p-6">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-lg font-semibold text-gray-900">Upload Form</h2>
                  <button
                    onClick={() => setShowUploadModal(false)}
                    className="p-1 text-gray-400 hover:text-gray-600 rounded"
                  >
                    <X size={20} />
                  </button>
                </div>

                <div
                  className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center hover:border-purple-500 transition-colors"
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={(e) => {
                    e.preventDefault();
                    const file = e.dataTransfer.files[0];
                    if (file && (file.name.endsWith('.docxf') || file.name.endsWith('.oform'))) {
                      uploadForm(file);
                    } else {
                      setError('Please upload a DOCXF or OFORM file');
                    }
                  }}
                >
                  {uploadingFile ? (
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600 mx-auto"></div>
                  ) : (
                    <>
                      <Upload size={48} className="mx-auto text-gray-400 mb-4" />
                      <p className="text-gray-600 mb-2">Drag and drop your form here, or</p>
                      <label className="inline-block px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 cursor-pointer">
                        Browse files
                        <input
                          type="file"
                          accept=".docxf,.oform"
                          className="hidden"
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (file) uploadForm(file);
                          }}
                        />
                      </label>
                      <p className="text-xs text-gray-500 mt-4">Supported formats: DOCXF, OFORM</p>
                    </>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Share Modal */}
          {shareModal && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
              <div className="bg-white rounded-lg shadow-xl w-full max-w-lg mx-4">
                <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
                  <h2 className="text-lg font-semibold text-gray-900">Share "{shareModal.formTitle}"</h2>
                  <button
                    onClick={() => setShareModal(null)}
                    className="p-1 text-gray-400 hover:text-gray-600 rounded"
                  >
                    <X size={20} />
                  </button>
                </div>

                <div className="px-6 py-4 space-y-4">
                  {/* Public Link Section */}
                  <div className="p-4 bg-gray-50 rounded-lg">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center space-x-2">
                        <Link2 size={18} className="text-purple-600" />
                        <span className="font-medium text-gray-900">Public Fill Link</span>
                      </div>
                      <button
                        onClick={() => copyPublicUrl(shareModal.formId)}
                        className="px-3 py-1.5 text-sm bg-purple-600 text-white rounded-lg hover:bg-purple-700"
                      >
                        Copy Link
                      </button>
                    </div>
                    <p className="text-sm text-gray-500">
                      Anyone with this link can fill out the form (when published)
                    </p>
                  </div>

                  {/* Share with People */}
                  <div>
                    <div className="flex items-center space-x-2 mb-3">
                      <UserPlus size={18} className="text-gray-600" />
                      <span className="font-medium text-gray-900">Share with people</span>
                    </div>

                    <div className="flex space-x-2">
                      <input
                        type="email"
                        placeholder="Enter email"
                        value={shareEmail}
                        onChange={(e) => setShareEmail(e.target.value)}
                        className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                      />
                      <select
                        value={sharePermission}
                        onChange={(e) => setSharePermission(e.target.value as any)}
                        className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
                      >
                        <option value="fill">Can fill</option>
                        <option value="view">Can view</option>
                        <option value="edit">Can edit</option>
                      </select>
                      <button
                        onClick={shareForm}
                        disabled={sharingLoading || !shareEmail.trim()}
                        className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50"
                      >
                        {sharingLoading ? '...' : 'Share'}
                      </button>
                    </div>
                  </div>

                  {/* Existing Shares */}
                  {existingShares.length > 0 && (
                    <div>
                      <h3 className="font-medium text-gray-900 mb-2">People with access</h3>
                      <div className="space-y-2 max-h-48 overflow-y-auto">
                        {existingShares.map((share) => (
                          <div key={share.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                            <div className="flex items-center space-x-3">
                              <div className="w-8 h-8 rounded-full bg-purple-100 flex items-center justify-center">
                                <Mail size={16} className="text-purple-600" />
                              </div>
                              <div>
                                <p className="font-medium text-gray-900">{share.external_email || share.user_id}</p>
                              </div>
                            </div>
                            <div className="flex items-center space-x-2">
                              <span className="text-sm text-gray-500 capitalize">{share.permission}</span>
                              <button
                                onClick={() => removeShare(share.id)}
                                className="p-1 text-gray-400 hover:text-red-600"
                              >
                                <X size={16} />
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                <div className="px-6 py-4 border-t border-gray-200 flex justify-end">
                  <button
                    onClick={() => setShareModal(null)}
                    className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg"
                  >
                    Done
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
