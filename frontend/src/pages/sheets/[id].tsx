/**
 * Bheem Sheets - Spreadsheet Editor
 * OnlyOffice-powered full Excel-compatible editing
 *
 * Features:
 * - Full Excel compatibility via OnlyOffice
 * - Real-time collaboration
 * - 400+ formulas
 * - Version history
 * - Auto-save
 */
import { useEffect, useState, useCallback, useRef } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import Link from 'next/link';
import {
  FileSpreadsheet,
  Star,
  StarOff,
  Share2,
  MoreHorizontal,
  Download,
  History,
  ArrowLeft,
  Clock,
  Users,
  CheckCircle,
  AlertCircle,
  Loader2,
} from 'lucide-react';
import { useRequireAuth } from '@/stores/authStore';
import { api } from '@/lib/api';
import OnlyOfficeEditor, { useOnlyOfficeAvailable } from '@/components/sheets/OnlyOfficeEditor';

interface Spreadsheet {
  id: string;
  title: string;
  description: string | null;
  is_starred: boolean;
  storage_path?: string;
  storage_mode?: string;
  version?: number;
  created_at: string;
  updated_at: string;
  creator_email?: string;
  creator_name?: string;
}

interface Version {
  id: string;
  version_number: number;
  file_size: number;
  created_at: string;
  creator_name?: string;
  comment?: string;
  is_current: boolean;
}

export default function SpreadsheetEditor() {
  const router = useRouter();
  const { id } = router.query;
  const { isAuthenticated, isLoading: authLoading } = useRequireAuth();

  const [spreadsheet, setSpreadsheet] = useState<Spreadsheet | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState<'saved' | 'saving' | 'error'>('saved');
  const [showVersions, setShowVersions] = useState(false);
  const [versions, setVersions] = useState<Version[]>([]);
  const [loadingVersions, setLoadingVersions] = useState(false);
  const [editorMode, setEditorMode] = useState<'edit' | 'view'>('edit');

  // Check if OnlyOffice is available
  const onlyOfficeAvailable = useOnlyOfficeAvailable();

  // Fetch spreadsheet metadata
  const fetchSpreadsheet = useCallback(async () => {
    if (!id) return;
    try {
      setLoading(true);
      const response = await api.get(`/sheets/${id}`);
      setSpreadsheet(response.data);
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Failed to load spreadsheet');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    if (isAuthenticated && !authLoading && id) {
      fetchSpreadsheet();
    }
  }, [isAuthenticated, authLoading, id, fetchSpreadsheet]);

  // Ref for debounced title save
  const titleSaveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const lastSavedTitleRef = useRef<string>('');

  // Update title
  const updateTitle = async (newTitle: string) => {
    if (!spreadsheet || newTitle === lastSavedTitleRef.current) return;
    try {
      await api.put(`/sheets/${spreadsheet.id}`, { title: newTitle });
      lastSavedTitleRef.current = newTitle;
    } catch (err) {
      console.error('Failed to update title:', err);
    }
  };

  // Debounced title change handler - auto-saves after 1 second of no typing
  const handleTitleChange = (newTitle: string) => {
    if (!spreadsheet) return;
    setSpreadsheet({ ...spreadsheet, title: newTitle });

    // Clear existing timeout
    if (titleSaveTimeoutRef.current) {
      clearTimeout(titleSaveTimeoutRef.current);
    }

    // Set new timeout to save after 1 second
    titleSaveTimeoutRef.current = setTimeout(() => {
      updateTitle(newTitle);
    }, 1000);
  };

  // Initialize lastSavedTitleRef when spreadsheet loads
  useEffect(() => {
    if (spreadsheet?.title) {
      lastSavedTitleRef.current = spreadsheet.title;
    }
  }, [spreadsheet?.id]);

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (titleSaveTimeoutRef.current) {
        clearTimeout(titleSaveTimeoutRef.current);
      }
    };
  }, []);

  // Toggle star
  const toggleStar = async () => {
    if (!spreadsheet) return;
    try {
      await api.post(`/sheets/${spreadsheet.id}/star`);
      setSpreadsheet({ ...spreadsheet, is_starred: !spreadsheet.is_starred });
    } catch (err) {
      console.error('Failed to toggle star:', err);
    }
  };

  // Fetch version history
  const fetchVersions = async () => {
    if (!spreadsheet) return;
    try {
      setLoadingVersions(true);
      const response = await api.get(`/sheets/${spreadsheet.id}/versions`);
      setVersions(response.data.versions || []);
    } catch (err) {
      console.error('Failed to fetch versions:', err);
    } finally {
      setLoadingVersions(false);
    }
  };

  // Toggle version panel
  const handleShowVersions = () => {
    setShowVersions(!showVersions);
    if (!showVersions && versions.length === 0) {
      fetchVersions();
    }
  };

  // Restore version
  const restoreVersion = async (versionNumber: number) => {
    if (!spreadsheet) return;
    try {
      await api.post(`/sheets/${spreadsheet.id}/restore-version`, {
        version_number: versionNumber,
      });
      // Reload the page to get the restored version
      window.location.reload();
    } catch (err: any) {
      console.error('Failed to restore version:', err);
      alert(err.response?.data?.detail || 'Failed to restore version');
    }
  };

  // Download spreadsheet
  const downloadSpreadsheet = async () => {
    if (!spreadsheet) return;
    try {
      const response = await api.get(`/sheets/${spreadsheet.id}/download`);
      const { download_url, filename } = response.data;

      // Create download link
      const link = document.createElement('a');
      link.href = download_url;
      link.download = filename;
      link.target = '_blank';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (err: any) {
      console.error('Failed to download:', err);
      alert(err.response?.data?.detail || 'Failed to download spreadsheet');
    }
  };

  // Format file size
  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  // Format date
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleString();
  };

  // Handle editor events
  const handleEditorReady = () => {
    console.log('OnlyOffice editor ready');
  };

  const handleEditorError = (error: string) => {
    console.error('OnlyOffice editor error:', error);
    setSaveStatus('error');
  };

  const handleDocumentReady = () => {
    console.log('Document loaded in OnlyOffice');
    setSaveStatus('saved');
  };

  const handleSave = () => {
    setSaveStatus('saved');
  };

  // Loading state
  if (authLoading || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading spreadsheet...</p>
        </div>
      </div>
    );
  }

  // Error state
  if (error || !spreadsheet) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <FileSpreadsheet className="mx-auto h-16 w-16 text-gray-400" />
          <h2 className="mt-4 text-xl font-medium text-gray-900">
            {error || 'Spreadsheet not found'}
          </h2>
          <Link href="/sheets" className="mt-4 inline-flex items-center text-green-600 hover:text-green-700">
            <ArrowLeft size={20} className="mr-1" />
            Back to Sheets
          </Link>
        </div>
      </div>
    );
  }

  return (
    <>
      <Head>
        <title>{spreadsheet.title} - Bheem Sheets</title>
      </Head>

      <div className="min-h-screen bg-white flex flex-col">
        {/* Top Bar */}
        <header className="bg-white border-b border-gray-200 flex-shrink-0 z-50">
          <div className="flex items-center px-3 py-2">
            {/* Logo and Title */}
            <Link href="/sheets" className="p-2 hover:bg-gray-100 rounded-full">
              <FileSpreadsheet className="h-8 w-8 text-green-600" />
            </Link>

            <div className="ml-2 flex-1">
              <input
                type="text"
                value={spreadsheet.title}
                onChange={(e) => handleTitleChange(e.target.value)}
                onBlur={(e) => updateTitle(e.target.value)}
                className="text-lg font-medium text-gray-900 bg-transparent border-none focus:outline-none focus:ring-2 focus:ring-green-500 rounded px-2 py-1"
              />
              <div className="flex items-center space-x-2 text-xs text-gray-500 ml-2">
                <button
                  onClick={toggleStar}
                  className="p-1 hover:bg-gray-100 rounded"
                  title={spreadsheet.is_starred ? 'Remove from starred' : 'Add to starred'}
                >
                  {spreadsheet.is_starred ? (
                    <Star size={14} className="text-yellow-500 fill-yellow-500" />
                  ) : (
                    <StarOff size={14} />
                  )}
                </button>

                {/* Save status indicator */}
                <div className="flex items-center space-x-1">
                  {saveStatus === 'saving' && (
                    <>
                      <Loader2 size={12} className="animate-spin" />
                      <span>Saving...</span>
                    </>
                  )}
                  {saveStatus === 'saved' && (
                    <>
                      <CheckCircle size={12} className="text-green-500" />
                      <span>All changes saved</span>
                    </>
                  )}
                  {saveStatus === 'error' && (
                    <>
                      <AlertCircle size={12} className="text-red-500" />
                      <span className="text-red-500">Save error</span>
                    </>
                  )}
                </div>

                {/* Version indicator */}
                {spreadsheet.version && (
                  <span className="text-gray-400">v{spreadsheet.version}</span>
                )}
              </div>
            </div>

            {/* Actions */}
            <div className="flex items-center space-x-2">
              {/* Version history */}
              <button
                onClick={handleShowVersions}
                className={`p-2 rounded-full transition-colors ${
                  showVersions
                    ? 'bg-green-100 text-green-600'
                    : 'text-gray-500 hover:bg-gray-100'
                }`}
                title="Version history"
              >
                <History size={20} />
              </button>

              {/* Download */}
              <button
                onClick={downloadSpreadsheet}
                className="p-2 text-gray-500 hover:bg-gray-100 rounded-full"
                title="Download as XLSX"
              >
                <Download size={20} />
              </button>

              {/* Share */}
              <button className="flex items-center px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700">
                <Share2 size={18} className="mr-2" />
                Share
              </button>
            </div>
          </div>
        </header>

        {/* Main Content */}
        <div className="flex-1 flex overflow-hidden">
          {/* Editor Area */}
          <div className="flex-1 relative">
            {onlyOfficeAvailable === false ? (
              // Fallback message when document server is not available
              <div className="flex items-center justify-center h-full bg-gray-50">
                <div className="text-center max-w-md p-8">
                  <FileSpreadsheet className="h-16 w-16 text-green-500 mx-auto mb-4" />
                  <h3 className="text-lg font-medium text-gray-900 mb-2">
                    Bheem Sheets Editor Unavailable
                  </h3>
                  <p className="text-gray-600 mb-4">
                    The spreadsheet editing service is currently unavailable.
                    Please contact your administrator or try again later.
                  </p>
                  <button
                    onClick={() => window.location.reload()}
                    className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
                  >
                    Try Again
                  </button>
                </div>
              </div>
            ) : (
              // Bheem Sheets Editor
              <OnlyOfficeEditor
                spreadsheetId={spreadsheet.id}
                mode={editorMode}
                onReady={handleEditorReady}
                onError={handleEditorError}
                onDocumentReady={handleDocumentReady}
                onSave={handleSave}
                className="h-full"
              />
            )}
          </div>

          {/* Version History Panel */}
          {showVersions && (
            <div className="w-80 border-l border-gray-200 bg-white overflow-y-auto">
              <div className="p-4 border-b border-gray-200">
                <div className="flex items-center justify-between">
                  <h3 className="font-medium text-gray-900">Version history</h3>
                  <button
                    onClick={() => setShowVersions(false)}
                    className="text-gray-500 hover:text-gray-700"
                  >
                    <ArrowLeft size={20} />
                  </button>
                </div>
              </div>

              {loadingVersions ? (
                <div className="flex items-center justify-center py-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-600"></div>
                </div>
              ) : versions.length === 0 ? (
                <div className="p-4 text-center text-gray-500">
                  <Clock className="h-12 w-12 mx-auto mb-2 text-gray-400" />
                  <p>No version history yet</p>
                </div>
              ) : (
                <div className="divide-y divide-gray-100">
                  {versions.map((version) => (
                    <div
                      key={version.id}
                      className={`p-4 hover:bg-gray-50 ${
                        version.is_current ? 'bg-green-50' : ''
                      }`}
                    >
                      <div className="flex items-start justify-between">
                        <div>
                          <div className="flex items-center space-x-2">
                            <span className="font-medium text-gray-900">
                              Version {version.version_number}
                            </span>
                            {version.is_current && (
                              <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded">
                                Current
                              </span>
                            )}
                          </div>
                          <div className="text-sm text-gray-500 mt-1">
                            {formatDate(version.created_at)}
                          </div>
                          {version.creator_name && (
                            <div className="text-sm text-gray-500 flex items-center mt-1">
                              <Users size={12} className="mr-1" />
                              {version.creator_name}
                            </div>
                          )}
                          <div className="text-xs text-gray-400 mt-1">
                            {formatFileSize(version.file_size)}
                          </div>
                          {version.comment && (
                            <div className="text-sm text-gray-600 mt-2 italic">
                              {version.comment}
                            </div>
                          )}
                        </div>

                        {!version.is_current && (
                          <button
                            onClick={() => restoreVersion(version.version_number)}
                            className="text-sm text-green-600 hover:text-green-700 font-medium"
                          >
                            Restore
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </>
  );
}
