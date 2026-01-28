/**
 * Bheem OForms - Form Responses Page
 * View and manage form submissions
 */
import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import Link from 'next/link';
import {
  FileText,
  ArrowLeft,
  Download,
  Trash2,
  Eye,
  RefreshCw,
  Search,
  Calendar,
  User,
  Mail,
  MoreVertical,
  CheckCircle,
  Clock,
  Archive,
  X,
} from 'lucide-react';
import { useRequireAuth } from '@/stores/authStore';
import { api } from '@/lib/api';
import Pagination from '@/components/shared/Pagination';

interface OFormResponse {
  id: string;
  form_id: string;
  respondent_email: string | null;
  respondent_name: string | null;
  submitted_at: string;
  status: 'submitted' | 'reviewed' | 'archived';
  file_size: number;
}

interface OForm {
  id: string;
  title: string;
  status: string;
  response_count: number;
}

export default function OFormResponses() {
  const router = useRouter();
  const { id } = router.query;
  const { isAuthenticated, isLoading: authLoading } = useRequireAuth();

  const [form, setForm] = useState<OForm | null>(null);
  const [responses, setResponses] = useState<OFormResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [contextMenu, setContextMenu] = useState<{ id: string; x: number; y: number } | null>(null);

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);

  // Fetch form and responses
  const fetchData = useCallback(async () => {
    if (!id) return;
    try {
      setLoading(true);
      const [formRes, responsesRes] = await Promise.all([
        api.get(`/oforms/${id}`),
        api.get(`/oforms/${id}/responses`),
      ]);
      setForm(formRes.data);
      setResponses(responsesRes.data.responses || []);
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Failed to load responses');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    if (isAuthenticated && !authLoading && id) {
      fetchData();
    }
  }, [isAuthenticated, authLoading, id, fetchData]);

  // Filter responses
  const filteredResponses = responses.filter((r) => {
    if (statusFilter !== 'all' && r.status !== statusFilter) return false;
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      return (
        (r.respondent_email?.toLowerCase().includes(query) || false) ||
        (r.respondent_name?.toLowerCase().includes(query) || false)
      );
    }
    return true;
  });

  // Pagination
  const totalItems = filteredResponses.length;
  const totalPages = Math.ceil(totalItems / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const paginatedResponses = filteredResponses.slice(startIndex, startIndex + itemsPerPage);

  // Update response status
  const updateResponseStatus = async (responseId: string, status: string) => {
    try {
      await api.put(`/oforms/${id}/responses/${responseId}`, { status });
      setResponses((prev) =>
        prev.map((r) => (r.id === responseId ? { ...r, status: status as any } : r))
      );
      setContextMenu(null);
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Failed to update status');
    }
  };

  // Delete response
  const deleteResponse = async (responseId: string) => {
    if (!confirm('Are you sure you want to delete this response?')) return;
    try {
      await api.delete(`/oforms/${id}/responses/${responseId}`);
      setResponses((prev) => prev.filter((r) => r.id !== responseId));
      setContextMenu(null);
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Failed to delete response');
    }
  };

  // Download response
  const downloadResponse = async (responseId: string) => {
    try {
      const response = await api.get(`/oforms/${id}/responses/${responseId}/download`);
      const { download_url, filename } = response.data;

      const link = document.createElement('a');
      link.href = download_url;
      link.download = filename;
      link.target = '_blank';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Failed to download response');
    }
  };

  // Export all responses
  const exportAllResponses = async () => {
    try {
      const response = await api.get(`/oforms/${id}/responses/export`);
      const { download_url, filename } = response.data;

      const link = document.createElement('a');
      link.href = download_url;
      link.download = filename;
      link.target = '_blank';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Failed to export responses');
    }
  };

  // Format date
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleString();
  };

  // Format file size
  const formatFileSize = (bytes: number) => {
    if (!bytes) return '0 B';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  // Get status badge
  const getStatusBadge = (status: string) => {
    const styles = {
      submitted: 'bg-blue-100 text-blue-700',
      reviewed: 'bg-green-100 text-green-700',
      archived: 'bg-gray-100 text-gray-700',
    };
    const icons = {
      submitted: Clock,
      reviewed: CheckCircle,
      archived: Archive,
    };
    const Icon = icons[status as keyof typeof icons] || Clock;
    return (
      <span className={`inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium rounded-full ${styles[status as keyof typeof styles] || styles.submitted}`}>
        <Icon size={12} />
        {status.charAt(0).toUpperCase() + status.slice(1)}
      </span>
    );
  };

  // Loading state
  if (authLoading || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading responses...</p>
        </div>
      </div>
    );
  }

  // Error state
  if (error && !form) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <FileText className="mx-auto h-16 w-16 text-gray-400" />
          <h2 className="mt-4 text-xl font-medium text-gray-900">{error}</h2>
          <Link href="/oforms" className="mt-4 inline-flex items-center text-purple-600 hover:text-purple-700">
            <ArrowLeft size={20} className="mr-1" />
            Back to Forms
          </Link>
        </div>
      </div>
    );
  }

  return (
    <>
      <Head>
        <title>Responses - {form?.title} - Bheem Forms</title>
      </Head>

      <div className="min-h-screen bg-gray-50 flex flex-col">
        {/* Header */}
        <header className="bg-white border-b border-gray-200">
          <div className="px-6 py-4">
            <div className="flex items-center gap-4">
              <Link
                href={`/oforms/${id}`}
                className="p-2 hover:bg-gray-100 rounded-lg"
              >
                <ArrowLeft size={20} className="text-gray-600" />
              </Link>
              <div className="flex-1">
                <h1 className="text-xl font-semibold text-gray-900">
                  Responses: {form?.title}
                </h1>
                <p className="text-sm text-gray-500">
                  {form?.response_count || 0} total responses
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={fetchData}
                  className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg"
                  title="Refresh"
                >
                  <RefreshCw size={20} />
                </button>
                <button
                  onClick={exportAllResponses}
                  className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-[#977DFF] to-[#0033FF] text-white rounded-lg hover:opacity-90"
                >
                  <Download size={18} />
                  Export All
                </button>
              </div>
            </div>

            {/* Filters */}
            <div className="flex items-center gap-4 mt-4">
              <div className="relative flex-1 max-w-md">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={18} />
                <input
                  type="text"
                  placeholder="Search by name or email..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                />
              </div>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
              >
                <option value="all">All statuses</option>
                <option value="submitted">Submitted</option>
                <option value="reviewed">Reviewed</option>
                <option value="archived">Archived</option>
              </select>
            </div>
          </div>
        </header>

        {/* Main Content */}
        <main className="flex-1 px-6 py-6">
          {error && (
            <div className="mb-4 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg flex items-center justify-between">
              {error}
              <button onClick={() => setError(null)}>
                <X size={16} />
              </button>
            </div>
          )}

          {filteredResponses.length === 0 ? (
            <div className="text-center py-12 bg-white rounded-lg border border-gray-200">
              <FileText className="mx-auto h-16 w-16 text-gray-300" />
              <h3 className="mt-4 text-lg font-medium text-gray-900">No responses yet</h3>
              <p className="mt-2 text-gray-500">
                Share your form to start collecting responses.
              </p>
            </div>
          ) : (
            <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
              <table className="w-full">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Respondent</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Submitted</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Size</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {paginatedResponses.map((response) => (
                    <tr key={response.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-purple-100 flex items-center justify-center">
                            {response.respondent_name ? (
                              <User size={16} className="text-purple-600" />
                            ) : (
                              <Mail size={16} className="text-purple-600" />
                            )}
                          </div>
                          <div>
                            <p className="font-medium text-gray-900">
                              {response.respondent_name || 'Anonymous'}
                            </p>
                            {response.respondent_email && (
                              <p className="text-sm text-gray-500">{response.respondent_email}</p>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1 text-sm text-gray-500">
                          <Calendar size={14} />
                          {formatDate(response.submitted_at)}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        {getStatusBadge(response.status)}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-500">
                        {formatFileSize(response.file_size)}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            onClick={() => downloadResponse(response.id)}
                            className="p-1.5 text-gray-400 hover:text-purple-600 hover:bg-purple-50 rounded"
                            title="Download"
                          >
                            <Download size={16} />
                          </button>
                          <button
                            onClick={(e) => {
                              setContextMenu({
                                id: response.id,
                                x: e.clientX,
                                y: e.clientY,
                              });
                            }}
                            className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded"
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
          {filteredResponses.length > 0 && (
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
                onClick={() => updateResponseStatus(contextMenu.id, 'reviewed')}
                className="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-100 flex items-center gap-2"
              >
                <CheckCircle size={16} />
                Mark as Reviewed
              </button>
              <button
                onClick={() => updateResponseStatus(contextMenu.id, 'archived')}
                className="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-100 flex items-center gap-2"
              >
                <Archive size={16} />
                Archive
              </button>
              <hr className="my-1" />
              <button
                onClick={() => deleteResponse(contextMenu.id)}
                className="w-full px-4 py-2 text-left text-sm text-red-600 hover:bg-red-50 flex items-center gap-2"
              >
                <Trash2 size={16} />
                Delete
              </button>
            </div>
          </>
        )}
      </div>
    </>
  );
}
