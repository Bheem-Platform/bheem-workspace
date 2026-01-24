/**
 * Bheem Slides - Presentation Editor
 * Full PowerPoint-compatible editing with OnlyOffice
 */
import { useEffect, useState, useCallback, useRef } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import Link from 'next/link';
import {
  Presentation,
  ArrowLeft,
} from 'lucide-react';
import { useRequireAuth } from '@/stores/authStore';
import { api } from '@/lib/api';
import OnlyOfficePresentationEditor from '@/components/slides/OnlyOfficePresentationEditor';
import BheemSlidesHeader from '@/components/slides/BheemSlidesHeader';
import ShareModal from '@/components/shared/ShareModal';

interface PresentationData {
  id: string;
  title: string;
  description: string | null;
  is_starred: boolean;
  storage_mode: string;
  version: number;
  created_at: string;
  updated_at: string;
}

export default function PresentationEditorPage() {
  const router = useRouter();
  const { id } = router.query;
  const { isAuthenticated, isLoading: authLoading } = useRequireAuth();

  const [presentation, setPresentation] = useState<PresentationData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editorMode, setEditorMode] = useState<'edit' | 'view'>('edit');
  const [editorReady, setEditorReady] = useState(false);
  const [showVersions, setShowVersions] = useState(false);
  const [showShareModal, setShowShareModal] = useState(false);

  const fetchPresentation = useCallback(async (showLoading = true) => {
    if (!id) return;
    try {
      if (showLoading) setLoading(true);
      const response = await api.get(`/slides/${id}`);
      setPresentation(response.data);
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Failed to load presentation');
    } finally {
      if (showLoading) setLoading(false);
    }
  }, [id]);

  // Refresh metadata without showing loading spinner (used for auto-save updates)
  const refreshMetadata = useCallback(async () => {
    if (!id) return;
    try {
      const response = await api.get(`/slides/${id}`);
      setPresentation(response.data);
    } catch (err) {
      console.error('Failed to refresh metadata:', err);
    }
  }, [id]);

  useEffect(() => {
    if (isAuthenticated && !authLoading && id) {
      fetchPresentation();
    }
  }, [isAuthenticated, authLoading, id, fetchPresentation]);

  // Ref for debounced title save
  const titleSaveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const lastSavedTitleRef = useRef<string>('');

  const updateTitle = async (newTitle: string) => {
    if (!presentation || newTitle === lastSavedTitleRef.current) return;
    try {
      await api.put(`/slides/${presentation.id}`, { title: newTitle });
      lastSavedTitleRef.current = newTitle;
    } catch (err) {
      console.error('Failed to update title:', err);
    }
  };

  // Debounced title change handler - auto-saves after 1 second of no typing
  const handleTitleChange = (newTitle: string) => {
    if (!presentation) return;
    setPresentation({ ...presentation, title: newTitle });

    // Clear existing timeout
    if (titleSaveTimeoutRef.current) {
      clearTimeout(titleSaveTimeoutRef.current);
    }

    // Set new timeout to save after 1 second
    titleSaveTimeoutRef.current = setTimeout(() => {
      updateTitle(newTitle);
    }, 1000);
  };

  // Initialize lastSavedTitleRef when presentation loads
  useEffect(() => {
    if (presentation?.title) {
      lastSavedTitleRef.current = presentation.title;
    }
  }, [presentation?.id]);

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (titleSaveTimeoutRef.current) {
        clearTimeout(titleSaveTimeoutRef.current);
      }
    };
  }, []);

  const toggleStar = async () => {
    if (!presentation) return;
    try {
      await api.post(`/slides/${presentation.id}/star`);
      setPresentation({ ...presentation, is_starred: !presentation.is_starred });
    } catch (err) {
      console.error('Failed to toggle star:', err);
    }
  };

  const downloadPresentation = async () => {
    if (!presentation) return;
    try {
      const response = await api.get(`/slides/${presentation.id}/download`);
      if (response.data.download_url) {
        window.open(response.data.download_url, '_blank');
      }
    } catch (err) {
      console.error('Failed to download:', err);
    }
  };

  if (authLoading || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading presentation...</p>
        </div>
      </div>
    );
  }

  if (error || !presentation) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100">
        <div className="text-center">
          <Presentation className="mx-auto h-16 w-16 text-gray-400" />
          <h2 className="mt-4 text-xl font-medium text-gray-900">
            {error || 'Presentation not found'}
          </h2>
          <Link href="/slides" className="mt-4 inline-flex items-center text-orange-600 hover:text-orange-700">
            <ArrowLeft size={20} className="mr-1" />
            Back to Slides
          </Link>
        </div>
      </div>
    );
  }

  return (
    <>
      <Head>
        <title>{presentation.title} - Bheem Slides</title>
      </Head>

      <div className="min-h-screen bg-gray-100 flex flex-col">
        {/* Custom Bheem Header */}
        <BheemSlidesHeader
          title={presentation.title}
          isStarred={presentation.is_starred}
          isSaving={false}
          isSaved={editorReady}
          version={presentation.version}
          onTitleChange={handleTitleChange}
          onToggleStar={toggleStar}
          onShare={() => setShowShareModal(true)}
          onDownload={downloadPresentation}
          onShowHistory={() => setShowVersions(!showVersions)}
          onPresent={() => {
            // Open presentation in new fullscreen window
            window.open(`/slides/${presentation.id}/present`, '_blank', 'fullscreen=yes');
          }}
        />

        {/* OnlyOffice Editor */}
        <div className="flex-1 relative">
          <OnlyOfficePresentationEditor
            presentationId={presentation.id}
            mode={editorMode}
            onReady={() => setEditorReady(true)}
            onError={(error) => {
              console.error('Editor error:', error);
              setEditorReady(false);
            }}
            onDocumentReady={() => {
              console.log('Document ready');
            }}
            onSave={() => {
              console.log('Document saved');
              // Refresh metadata to get new version (without showing loading spinner)
              refreshMetadata();
            }}
            className="h-full"
          />

        </div>

        {/* Version History Sidebar */}
        {showVersions && (
          <VersionHistoryPanel
            presentationId={presentation.id}
            onClose={() => setShowVersions(false)}
          />
        )}

        {/* Share Modal */}
        <ShareModal
          isOpen={showShareModal}
          onClose={() => setShowShareModal(false)}
          documentId={presentation.id}
          documentType="slide"
          documentTitle={presentation.title}
        />
      </div>
    </>
  );
}

// Version History Panel Component
function VersionHistoryPanel({ presentationId, onClose }: { presentationId: string; onClose: () => void }) {
  const [versions, setVersions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchVersions = async () => {
      try {
        const response = await api.get(`/slides/${presentationId}/versions`);
        setVersions(response.data.versions || []);
      } catch (err) {
        console.error('Failed to load versions:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchVersions();
  }, [presentationId]);

  return (
    <div className="fixed right-0 top-0 bottom-0 w-80 bg-white border-l border-gray-200 shadow-lg z-50">
      <div className="flex items-center justify-between p-4 border-b border-gray-200">
        <h3 className="font-medium text-gray-900">Version History</h3>
        <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded">
          <span className="text-xl">&times;</span>
        </button>
      </div>

      <div className="overflow-y-auto h-full pb-20">
        {loading ? (
          <div className="p-4 text-center text-gray-500">Loading...</div>
        ) : versions.length === 0 ? (
          <div className="p-4 text-center text-gray-500">No version history</div>
        ) : (
          <div className="divide-y divide-gray-100">
            {versions.map((version) => (
              <div key={version.id} className="p-4 hover:bg-gray-50">
                <div className="flex items-center justify-between">
                  <span className="font-medium text-gray-900">
                    Version {version.version_number}
                  </span>
                  <span className="text-xs text-gray-500">
                    {new Date(version.created_at).toLocaleDateString()}
                  </span>
                </div>
                {version.creator_name && (
                  <p className="text-sm text-gray-600 mt-1">
                    by {version.creator_name}
                  </p>
                )}
                {version.comment && (
                  <p className="text-sm text-gray-500 mt-1">
                    {version.comment}
                  </p>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
