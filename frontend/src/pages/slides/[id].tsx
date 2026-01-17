/**
 * Bheem Slides - Presentation Editor
 * Full PowerPoint-compatible editing with OnlyOffice
 */
import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import Link from 'next/link';
import {
  Presentation,
  Star,
  StarOff,
  Share2,
  Play,
  ArrowLeft,
  Download,
  History,
  MoreHorizontal,
  Edit3,
  Eye,
} from 'lucide-react';
import { useRequireAuth } from '@/stores/authStore';
import { api } from '@/lib/api';
import OnlyOfficePresentationEditor from '@/components/slides/OnlyOfficePresentationEditor';

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

  const fetchPresentation = useCallback(async () => {
    if (!id) return;
    try {
      setLoading(true);
      const response = await api.get(`/slides/${id}`);
      setPresentation(response.data);
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Failed to load presentation');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    if (isAuthenticated && !authLoading && id) {
      fetchPresentation();
    }
  }, [isAuthenticated, authLoading, id, fetchPresentation]);

  const updateTitle = async (newTitle: string) => {
    if (!presentation || newTitle === presentation.title) return;
    try {
      await api.put(`/slides/${presentation.id}`, { title: newTitle });
      setPresentation({ ...presentation, title: newTitle });
    } catch (err) {
      console.error('Failed to update title:', err);
    }
  };

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
        {/* Top Bar */}
        <header className="bg-white border-b border-gray-200 flex-shrink-0 z-10">
          <div className="flex items-center px-4 py-2">
            {/* Logo and Back */}
            <Link href="/slides" className="p-2 hover:bg-gray-100 rounded-full mr-2">
              <Presentation className="h-7 w-7 text-orange-600" />
            </Link>

            {/* Title */}
            <div className="flex-1">
              <input
                type="text"
                value={presentation.title}
                onChange={(e) => setPresentation({ ...presentation, title: e.target.value })}
                onBlur={(e) => updateTitle(e.target.value)}
                className="text-lg font-medium text-gray-900 bg-transparent border-none focus:outline-none focus:ring-2 focus:ring-orange-500 rounded px-2 py-1 w-full max-w-md"
              />
              <div className="flex items-center space-x-2 text-xs text-gray-500 ml-2 mt-0.5">
                <button
                  onClick={toggleStar}
                  className="p-1 hover:bg-gray-100 rounded"
                  title={presentation.is_starred ? 'Remove star' : 'Add star'}
                >
                  {presentation.is_starred ? (
                    <Star size={14} className="text-yellow-500 fill-yellow-500" />
                  ) : (
                    <StarOff size={14} />
                  )}
                </button>
                <span className="text-gray-400">|</span>
                <span>
                  {editorReady ? 'All changes saved' : 'Connecting...'}
                </span>
                {presentation.version > 1 && (
                  <>
                    <span className="text-gray-400">|</span>
                    <span>Version {presentation.version}</span>
                  </>
                )}
              </div>
            </div>

            {/* Actions */}
            <div className="flex items-center space-x-2">
              {/* Mode Toggle */}
              <div className="flex items-center bg-gray-100 rounded-lg p-1">
                <button
                  onClick={() => setEditorMode('edit')}
                  className={`flex items-center px-3 py-1.5 rounded text-sm ${
                    editorMode === 'edit'
                      ? 'bg-white shadow text-orange-600'
                      : 'text-gray-600 hover:text-gray-900'
                  }`}
                >
                  <Edit3 size={14} className="mr-1" />
                  Edit
                </button>
                <button
                  onClick={() => setEditorMode('view')}
                  className={`flex items-center px-3 py-1.5 rounded text-sm ${
                    editorMode === 'view'
                      ? 'bg-white shadow text-orange-600'
                      : 'text-gray-600 hover:text-gray-900'
                  }`}
                >
                  <Eye size={14} className="mr-1" />
                  View
                </button>
              </div>

              {/* Version History */}
              <button
                onClick={() => setShowVersions(!showVersions)}
                className="p-2 text-gray-600 hover:bg-gray-100 rounded-lg"
                title="Version history"
              >
                <History size={20} />
              </button>

              {/* Download */}
              <button
                onClick={downloadPresentation}
                className="p-2 text-gray-600 hover:bg-gray-100 rounded-lg"
                title="Download"
              >
                <Download size={20} />
              </button>

              {/* Share */}
              <button className="flex items-center px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700">
                <Share2 size={18} className="mr-2" />
                Share
              </button>

              {/* More */}
              <button className="p-2 text-gray-600 hover:bg-gray-100 rounded-lg">
                <MoreHorizontal size={20} />
              </button>
            </div>
          </div>
        </header>

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
              // Refresh metadata to get new version
              fetchPresentation();
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
