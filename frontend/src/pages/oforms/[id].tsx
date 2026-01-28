/**
 * Bheem OForms - Document Form Editor
 * OnlyOffice-powered document forms (DOCXF/OFORM)
 *
 * Features:
 * - Professional document forms editing via OnlyOffice
 * - Form field creation and management
 * - Real-time collaboration
 * - Version history
 * - Auto-save
 */
import { useEffect, useState, useCallback, useRef } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import Link from 'next/link';
import {
  FileText,
  ArrowLeft,
  Clock,
  Users,
} from 'lucide-react';
import { useRequireAuth } from '@/stores/authStore';
import { api } from '@/lib/api';
import OnlyOfficeFormEditor, { useOnlyOfficeFormAvailable } from '@/components/forms/OnlyOfficeFormEditor';
import BheemFormsHeader from '@/components/forms/BheemFormsHeader';
import ShareModal from '@/components/shared/ShareModal';

interface OForm {
  id: string;
  title: string;
  description: string | null;
  form_type: 'docxf' | 'oform';
  status: 'draft' | 'published' | 'closed';
  is_starred: boolean;
  is_deleted: boolean;
  storage_path?: string;
  storage_bucket?: string;
  document_key?: string;
  version?: number;
  response_count: number;
  created_at: string;
  updated_at: string;
  created_by?: string;
}

interface Version {
  id: string;
  version: number;
  file_size: number;
  created_at: string;
  created_by?: string;
  comment?: string;
}

export default function OFormEditor() {
  const router = useRouter();
  const { id } = router.query;
  const { isAuthenticated, isLoading: authLoading } = useRequireAuth();

  const [form, setForm] = useState<OForm | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saveStatus, setSaveStatus] = useState<'saved' | 'saving' | 'error'>('saved');
  const [showVersions, setShowVersions] = useState(false);
  const [versions, setVersions] = useState<Version[]>([]);
  const [loadingVersions, setLoadingVersions] = useState(false);
  const [editorMode, setEditorMode] = useState<'edit' | 'view' | 'fill'>('edit');
  const [showShareModal, setShowShareModal] = useState(false);

  // Check if OnlyOffice is available
  const onlyOfficeAvailable = useOnlyOfficeFormAvailable();

  // Fetch form metadata
  const fetchForm = useCallback(async () => {
    if (!id) return;
    try {
      setLoading(true);
      const response = await api.get(`/oforms/${id}`);
      setForm(response.data);
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Failed to load form');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    if (isAuthenticated && !authLoading && id) {
      fetchForm();
    }
  }, [isAuthenticated, authLoading, id, fetchForm]);

  // Ref for debounced title save
  const titleSaveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const lastSavedTitleRef = useRef<string>('');

  // Update title
  const updateTitle = async (newTitle: string) => {
    if (!form || newTitle === lastSavedTitleRef.current) return;
    try {
      await api.put(`/oforms/${form.id}`, { title: newTitle });
      lastSavedTitleRef.current = newTitle;
    } catch (err) {
      console.error('Failed to update title:', err);
    }
  };

  // Debounced title change handler
  const handleTitleChange = (newTitle: string) => {
    if (!form) return;
    setForm({ ...form, title: newTitle });

    if (titleSaveTimeoutRef.current) {
      clearTimeout(titleSaveTimeoutRef.current);
    }

    titleSaveTimeoutRef.current = setTimeout(() => {
      updateTitle(newTitle);
    }, 1000);
  };

  // Initialize lastSavedTitleRef when form loads
  useEffect(() => {
    if (form?.title) {
      lastSavedTitleRef.current = form.title;
    }
  }, [form?.id]);

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
    if (!form) return;
    try {
      await api.post(`/oforms/${form.id}/star`);
      setForm({ ...form, is_starred: !form.is_starred });
    } catch (err) {
      console.error('Failed to toggle star:', err);
    }
  };

  // Publish form
  const publishForm = async () => {
    if (!form) return;
    try {
      await api.post(`/oforms/${form.id}/publish`);
      setForm({ ...form, status: 'published' });
    } catch (err: any) {
      console.error('Failed to publish form:', err);
      alert(err.response?.data?.detail || 'Failed to publish form');
    }
  };

  // Fetch version history
  const fetchVersions = async () => {
    if (!form) return;
    try {
      setLoadingVersions(true);
      const response = await api.get(`/oforms/${form.id}/versions`);
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
    if (!form) return;
    try {
      await api.post(`/oforms/${form.id}/restore`, {
        version: versionNumber,
      });
      window.location.reload();
    } catch (err: any) {
      console.error('Failed to restore version:', err);
      alert(err.response?.data?.detail || 'Failed to restore version');
    }
  };

  // Download form
  const downloadForm = async () => {
    if (!form) return;
    try {
      const response = await api.get(`/oforms/${form.id}/download`);
      const { download_url, filename } = response.data;

      const link = document.createElement('a');
      link.href = download_url;
      link.download = filename;
      link.target = '_blank';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (err: any) {
      console.error('Failed to download:', err);
      alert(err.response?.data?.detail || 'Failed to download form');
    }
  };

  // Preview form
  const previewForm = () => {
    if (!form) return;
    window.open(`/oforms/${form.id}/fill`, '_blank');
  };

  // View responses
  const viewResponses = () => {
    if (!form) return;
    router.push(`/oforms/${form.id}/responses`);
  };

  // Format file size
  const formatFileSize = (bytes: number) => {
    if (!bytes) return '0 B';
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
    console.log('OnlyOffice form editor ready');
  };

  const handleEditorError = (error: string) => {
    console.error('OnlyOffice form editor error:', error);
    setSaveStatus('error');
  };

  const handleDocumentReady = () => {
    console.log('Form document loaded in OnlyOffice');
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
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading form...</p>
        </div>
      </div>
    );
  }

  // Error state
  if (error || !form) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <FileText className="mx-auto h-16 w-16 text-gray-400" />
          <h2 className="mt-4 text-xl font-medium text-gray-900">
            {error || 'Form not found'}
          </h2>
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
        <title>{form.title} - Bheem Forms</title>
      </Head>

      <div className="min-h-screen bg-white flex flex-col">
        {/* Custom Bheem Header */}
        <BheemFormsHeader
          title={form.title}
          isStarred={form.is_starred}
          isSaving={saveStatus === 'saving'}
          isSaved={saveStatus === 'saved'}
          version={form.version}
          status={form.status}
          formType={form.form_type}
          responseCount={form.response_count}
          onTitleChange={handleTitleChange}
          onToggleStar={toggleStar}
          onShare={() => setShowShareModal(true)}
          onDownload={downloadForm}
          onShowHistory={handleShowVersions}
          onPublish={publishForm}
          onPreview={previewForm}
          onViewResponses={viewResponses}
        />

        {/* Main Content */}
        <div className="flex-1 flex overflow-hidden">
          {/* Editor Area */}
          <div className="flex-1 relative">
            {onlyOfficeAvailable === false ? (
              <div className="flex items-center justify-center h-full bg-gray-50">
                <div className="text-center max-w-md p-8">
                  <FileText className="h-16 w-16 text-purple-500 mx-auto mb-4" />
                  <h3 className="text-lg font-medium text-gray-900 mb-2">
                    Bheem Forms Editor Unavailable
                  </h3>
                  <p className="text-gray-600 mb-4">
                    The form editing service is currently unavailable.
                    Please contact your administrator or try again later.
                  </p>
                  <button
                    onClick={() => window.location.reload()}
                    className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700"
                  >
                    Try Again
                  </button>
                </div>
              </div>
            ) : (
              <OnlyOfficeFormEditor
                formId={form.id}
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
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600"></div>
                </div>
              ) : versions.length === 0 ? (
                <div className="p-4 text-center text-gray-500">
                  <Clock className="h-12 w-12 mx-auto mb-2 text-gray-400" />
                  <p>No version history yet</p>
                </div>
              ) : (
                <div className="divide-y divide-gray-100">
                  {versions.map((version, index) => (
                    <div
                      key={version.id}
                      className={`p-4 hover:bg-gray-50 ${
                        index === 0 ? 'bg-purple-50' : ''
                      }`}
                    >
                      <div className="flex items-start justify-between">
                        <div>
                          <div className="flex items-center space-x-2">
                            <span className="font-medium text-gray-900">
                              Version {version.version}
                            </span>
                            {index === 0 && (
                              <span className="text-xs bg-purple-100 text-purple-700 px-2 py-0.5 rounded">
                                Current
                              </span>
                            )}
                          </div>
                          <div className="text-sm text-gray-500 mt-1">
                            {formatDate(version.created_at)}
                          </div>
                          <div className="text-xs text-gray-400 mt-1">
                            {formatFileSize(version.file_size)}
                          </div>
                          {version.comment && (
                            <div className="text-sm text-gray-600 mt-2 italic">
                              {version.comment}
                            </div>
                          )}
                        </div>

                        {index !== 0 && (
                          <button
                            onClick={() => restoreVersion(version.version)}
                            className="text-sm text-purple-600 hover:text-purple-700 font-medium"
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

        {/* Share Modal */}
        <ShareModal
          isOpen={showShareModal}
          onClose={() => setShowShareModal(false)}
          documentId={form.id}
          documentType="oform"
          documentTitle={form.title}
        />
      </div>
    </>
  );
}
