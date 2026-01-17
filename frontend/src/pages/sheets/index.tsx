/**
 * Bheem Sheets - Spreadsheet List
 * Google Sheets-like spreadsheet management
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
  FileSpreadsheet,
  Users,
  ArrowUpDown,
} from 'lucide-react';
import { useRequireAuth } from '@/stores/authStore';
import { api } from '@/lib/api';
import AppSwitcherBar from '@/components/shared/AppSwitcherBar';
import AppLauncher from '@/components/shared/AppLauncher';
import DocsSidebar from '@/components/docs/DocsSidebar';

interface Spreadsheet {
  id: string;
  title: string;
  description: string | null;
  is_starred: boolean;
  is_deleted: boolean;
  created_at: string;
  updated_at: string;
  worksheet_count: number;
}

export default function SheetsPage() {
  const router = useRouter();
  const { isAuthenticated, isLoading: authLoading } = useRequireAuth();

  const [spreadsheets, setSpreadsheets] = useState<Spreadsheet[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [searchQuery, setSearchQuery] = useState('');
  const [filter, setFilter] = useState<'all' | 'starred' | 'recent'>('all');
  const [showNewMenu, setShowNewMenu] = useState(false);
  const [contextMenu, setContextMenu] = useState<{ id: string; x: number; y: number } | null>(null);

  const fetchSpreadsheets = useCallback(async () => {
    try {
      setLoading(true);
      const params: Record<string, any> = {};
      if (filter === 'starred') params.starred_only = true;
      if (searchQuery) params.search = searchQuery;

      const response = await api.get('/sheets', { params });
      let spreadsheetList = response.data.spreadsheets || [];

      // Client-side filtering for "recent" (last 7 days)
      if (filter === 'recent') {
        const sevenDaysAgo = new Date();
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
        spreadsheetList = spreadsheetList.filter((s: Spreadsheet) =>
          new Date(s.updated_at) >= sevenDaysAgo
        );
      }

      setSpreadsheets(spreadsheetList);
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Failed to load spreadsheets');
    } finally {
      setLoading(false);
    }
  }, [filter, searchQuery]);

  useEffect(() => {
    if (isAuthenticated && !authLoading) {
      fetchSpreadsheets();
    }
  }, [isAuthenticated, authLoading, fetchSpreadsheets]);

  const createSpreadsheet = async (templateId?: string) => {
    try {
      const response = await api.post('/sheets', {
        title: 'Untitled spreadsheet',
        template_id: templateId,
      });
      // API returns id directly, not nested under spreadsheet
      const sheetId = response.data.id || response.data.spreadsheet?.id;
      router.push(`/sheets/${sheetId}`);
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Failed to create spreadsheet');
    }
  };

  const toggleStar = async (id: string) => {
    try {
      await api.post(`/sheets/${id}/star`);
      setSpreadsheets((prev) =>
        prev.map((s) => (s.id === id ? { ...s, is_starred: !s.is_starred } : s))
      );
    } catch (err) {
      console.error('Failed to toggle star:', err);
    }
  };

  const deleteSpreadsheet = async (id: string) => {
    try {
      await api.delete(`/sheets/${id}`);
      setSpreadsheets((prev) => prev.filter((s) => s.id !== id));
      setContextMenu(null);
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Failed to delete spreadsheet');
    }
  };

  const duplicateSpreadsheet = async (id: string) => {
    try {
      const response = await api.post(`/sheets/${id}/duplicate`);
      setSpreadsheets((prev) => [response.data.spreadsheet, ...prev]);
      setContextMenu(null);
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Failed to duplicate spreadsheet');
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
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-600"></div>
      </div>
    );
  }

  const filteredSpreadsheets = spreadsheets.filter((s) => {
    if (searchQuery) {
      return s.title.toLowerCase().includes(searchQuery.toLowerCase());
    }
    return true;
  });

  return (
    <>
      <Head>
        <title>Bheem Sheets - Spreadsheets</title>
      </Head>

      <div className="min-h-screen bg-gray-50 flex">
        {/* App Switcher Bar */}
        <AppSwitcherBar activeApp="docs" />

        {/* Docs Sidebar */}
        <div className="fixed left-[60px] top-0 bottom-0 w-[240px] z-40">
          <DocsSidebar activeType="sheets" />
        </div>

        {/* Main Content */}
        <div className="flex-1 ml-[300px]">
          {/* Header */}
          <header className="bg-white border-b border-gray-200 sticky top-0 z-30">
            <div className="px-6">
              <div className="flex items-center justify-between h-16">
                <div className="flex items-center space-x-4">
                  <FileSpreadsheet className="h-8 w-8 text-green-600" />
                  <span className="text-xl font-semibold text-gray-900">Spreadsheets</span>
                </div>

                {/* Search */}
                <div className="flex-1 max-w-xl mx-8">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
                    <input
                      type="text"
                      placeholder="Search spreadsheets..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="w-full pl-10 pr-4 py-2 bg-gray-100 border border-transparent rounded-lg focus:bg-white focus:border-green-500 focus:ring-1 focus:ring-green-500"
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
            <h2 className="text-sm font-medium text-gray-500 mb-4">Start a new spreadsheet</h2>
            <div className="flex items-start space-x-4">
              {/* Blank */}
              <button
                onClick={() => createSpreadsheet()}
                className="group flex flex-col items-center"
              >
                <div className="w-36 h-28 bg-white border-2 border-gray-200 rounded-lg flex items-center justify-center group-hover:border-green-500 group-hover:shadow-md transition-all">
                  <Plus size={40} className="text-green-600" />
                </div>
                <span className="mt-2 text-sm text-gray-700">Blank</span>
              </button>

              {/* Templates */}
              <button
                onClick={() => createSpreadsheet('budget-tracker')}
                className="group flex flex-col items-center"
              >
                <div className="w-36 h-28 bg-gradient-to-br from-green-50 to-green-100 border-2 border-gray-200 rounded-lg flex items-center justify-center group-hover:border-green-500 group-hover:shadow-md transition-all">
                  <FileSpreadsheet size={32} className="text-green-600" />
                </div>
                <span className="mt-2 text-sm text-gray-700">Budget Tracker</span>
              </button>

              <button
                onClick={() => createSpreadsheet('project-timeline')}
                className="group flex flex-col items-center"
              >
                <div className="w-36 h-28 bg-gradient-to-br from-blue-50 to-blue-100 border-2 border-gray-200 rounded-lg flex items-center justify-center group-hover:border-green-500 group-hover:shadow-md transition-all">
                  <Clock size={32} className="text-blue-600" />
                </div>
                <span className="mt-2 text-sm text-gray-700">Project Timeline</span>
              </button>

              <button
                onClick={() => createSpreadsheet('inventory-tracker')}
                className="group flex flex-col items-center"
              >
                <div className="w-36 h-28 bg-gradient-to-br from-purple-50 to-purple-100 border-2 border-gray-200 rounded-lg flex items-center justify-center group-hover:border-green-500 group-hover:shadow-md transition-all">
                  <Folder size={32} className="text-purple-600" />
                </div>
                <span className="mt-2 text-sm text-gray-700">Inventory</span>
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
                    ? 'bg-green-100 text-green-700'
                    : 'text-gray-600 hover:bg-gray-100'
                }`}
              >
                All spreadsheets
              </button>
              <button
                onClick={() => setFilter('starred')}
                className={`px-4 py-2 text-sm font-medium rounded-lg ${
                  filter === 'starred'
                    ? 'bg-green-100 text-green-700'
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
                    ? 'bg-green-100 text-green-700'
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

          {/* Spreadsheets */}
          {loading ? (
            <div className="flex justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-600"></div>
            </div>
          ) : filteredSpreadsheets.length === 0 ? (
            <div className="text-center py-12">
              <FileSpreadsheet className="mx-auto h-16 w-16 text-gray-300" />
              <h3 className="mt-4 text-lg font-medium text-gray-900">No spreadsheets yet</h3>
              <p className="mt-2 text-gray-500">Create your first spreadsheet to get started.</p>
              <button
                onClick={() => createSpreadsheet()}
                className="mt-4 inline-flex items-center px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
              >
                <Plus size={20} className="mr-2" />
                New Spreadsheet
              </button>
            </div>
          ) : viewMode === 'grid' ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {filteredSpreadsheets.map((spreadsheet) => (
                <div
                  key={spreadsheet.id}
                  className="bg-white border border-gray-200 rounded-lg overflow-hidden hover:shadow-md transition-shadow group"
                >
                  <Link href={`/sheets/${spreadsheet.id}`}>
                    <div className="aspect-video bg-gradient-to-br from-green-50 to-green-100 flex items-center justify-center">
                      <FileSpreadsheet size={48} className="text-green-400" />
                    </div>
                  </Link>
                  <div className="p-3">
                    <div className="flex items-start justify-between">
                      <Link href={`/sheets/${spreadsheet.id}`} className="flex-1 min-w-0">
                        <h3 className="font-medium text-gray-900 truncate hover:text-green-600">
                          {spreadsheet.title}
                        </h3>
                      </Link>
                      <div className="flex items-center space-x-1 ml-2">
                        <button
                          onClick={() => toggleStar(spreadsheet.id)}
                          className="p-1 text-gray-400 hover:text-yellow-500"
                        >
                          {spreadsheet.is_starred ? (
                            <Star size={16} className="text-yellow-500 fill-yellow-500" />
                          ) : (
                            <StarOff size={16} />
                          )}
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setContextMenu({
                              id: spreadsheet.id,
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
                      <FileSpreadsheet size={14} className="mr-1" />
                      <span>Opened {formatDate(spreadsheet.updated_at)}</span>
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
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Owner</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Last modified</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {filteredSpreadsheets.map((spreadsheet) => (
                    <tr key={spreadsheet.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3">
                        <Link href={`/sheets/${spreadsheet.id}`} className="flex items-center space-x-3">
                          <FileSpreadsheet size={20} className="text-green-600" />
                          <span className="font-medium text-gray-900 hover:text-green-600">
                            {spreadsheet.title}
                          </span>
                        </Link>
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-500">me</td>
                      <td className="px-4 py-3 text-sm text-gray-500">
                        {formatDate(spreadsheet.updated_at)}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end space-x-1">
                          <button
                            onClick={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              toggleStar(spreadsheet.id);
                            }}
                            className="p-2 text-gray-400 hover:text-yellow-500 hover:bg-gray-100 rounded"
                            title={spreadsheet.is_starred ? 'Remove from starred' : 'Add to starred'}
                          >
                            {spreadsheet.is_starred ? (
                              <Star size={18} className="text-yellow-500 fill-yellow-500" />
                            ) : (
                              <Star size={18} />
                            )}
                          </button>
                          <button
                            onClick={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              duplicateSpreadsheet(spreadsheet.id);
                            }}
                            className="p-2 text-gray-400 hover:text-green-600 hover:bg-gray-100 rounded"
                            title="Make a copy"
                          >
                            <Copy size={18} />
                          </button>
                          <button
                            onClick={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              setContextMenu({
                                id: spreadsheet.id,
                                x: e.clientX,
                                y: e.clientY,
                              });
                            }}
                            className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded"
                            title="More actions"
                          >
                            <MoreVertical size={18} />
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
                style={{
                  left: Math.min(contextMenu.x, window.innerWidth - 200),
                  top: Math.min(contextMenu.y, window.innerHeight - 150)
                }}
              >
                <button
                  onClick={() => duplicateSpreadsheet(contextMenu.id)}
                  className="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-100 flex items-center space-x-2"
                >
                  <Copy size={16} />
                  <span>Make a copy</span>
                </button>
                <button
                  onClick={() => {
                    setContextMenu(null);
                    // Share modal would go here
                  }}
                  className="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-100 flex items-center space-x-2"
                >
                  <Share2 size={16} />
                  <span>Share</span>
                </button>
                <hr className="my-1" />
                <button
                  onClick={() => deleteSpreadsheet(contextMenu.id)}
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
