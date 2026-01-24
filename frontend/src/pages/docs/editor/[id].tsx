/**
 * Bheem Docs - Document Editor Page
 * Full-featured document editor with collaboration
 * Supports both Tiptap (rich text) and OnlyOffice (Word documents)
 */
import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import dynamic from 'next/dynamic';
import DocumentHeader from '@/components/docs/editor/DocumentHeader';
import BheemDocsHeader from '@/components/docs/BheemDocsHeader';
import CollaborationBar from '@/components/docs/editor/CollaborationBar';
import CommentsPanel from '@/components/docs/editor/CommentsPanel';
import VersionHistory from '@/components/docs/editor/VersionHistory';
import AIAssistant from '@/components/docs/editor/AIAssistant';
import FindReplace from '@/components/docs/editor/FindReplace';
import ShareModal from '@/components/docs/ShareModal';
import ShareModalShared from '@/components/shared/ShareModal';
import { useDocsStore } from '@/stores/docsStore';
import { useRequireAuth, useAuthStore } from '@/stores/authStore';
import * as docsEditorApi from '@/lib/docsEditorApi';
import { api } from '@/lib/api';

// Dynamic import to avoid SSR issues with Tiptap
const TiptapEditor = dynamic(
  () => import('@/components/docs/editor/TiptapEditor'),
  { ssr: false, loading: () => <EditorSkeleton /> }
);

// Dynamic import for OnlyOffice editor
const OnlyOfficeDocEditor = dynamic(
  () => import('@/components/docs/OnlyOfficeDocEditor'),
  { ssr: false, loading: () => <EditorSkeleton /> }
);

function EditorSkeleton() {
  return (
    <div className="flex-1 bg-white rounded-lg shadow-sm border animate-pulse">
      <div className="h-12 bg-gray-100 border-b" />
      <div className="p-8 space-y-4">
        <div className="h-8 bg-gray-200 rounded w-3/4" />
        <div className="h-4 bg-gray-200 rounded w-full" />
        <div className="h-4 bg-gray-200 rounded w-5/6" />
        <div className="h-4 bg-gray-200 rounded w-4/5" />
      </div>
    </div>
  );
}

interface Document {
  id: string;
  title: string;
  content: any;
  is_favorite: boolean;
  is_shared: boolean;
  created_at: string;
  updated_at: string;
  owner: {
    id: string;
    name: string;
    email: string;
  };
  // File info for uploaded documents
  mime_type?: string;
  file_name?: string;
  file_size?: number;
  storage_path?: string;
  document_type?: string;
}

// Check if document is an uploaded file (not a rich text document)
const isUploadedFile = (doc: Document): boolean => {
  // If it has a storage_path and mime_type that's not a bheem doc, it's an uploaded file
  if (doc.storage_path && doc.mime_type) {
    const editableMimeTypes = ['application/vnd.bheem.document', 'text/html'];
    return !editableMimeTypes.includes(doc.mime_type);
  }
  return false;
};

// Check if file content can be displayed as text
const isTextFile = (mimeType?: string): boolean => {
  if (!mimeType) return false;
  return mimeType.startsWith('text/') ||
         mimeType === 'application/json' ||
         mimeType === 'application/xml';
};

// Check if file is a PDF
const isPdfFile = (mimeType?: string): boolean => {
  return mimeType === 'application/pdf';
};

// Check if file is an image
const isImageFile = (mimeType?: string): boolean => {
  if (!mimeType) return false;
  return mimeType.startsWith('image/');
};

// Check if file is a Word document (editable with OnlyOffice)
const isWordDocument = (doc: Document): boolean => {
  const wordMimeTypes = [
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document', // docx
    'application/msword', // doc
    'application/vnd.oasis.opendocument.text', // odt
    'application/rtf', // rtf
  ];

  if (doc.mime_type && wordMimeTypes.includes(doc.mime_type)) {
    return true;
  }

  // Also check file extension
  const fileName = doc.file_name || '';
  const extension = fileName.split('.').pop()?.toLowerCase();
  return ['docx', 'doc', 'odt', 'rtf'].includes(extension || '');
};

interface Collaborator {
  id: string;
  name: string;
  email: string;
  avatar?: string;
  color: string;
  cursor_position?: number;
  is_editing: boolean;
  last_active: string;
}

export default function DocumentEditorPage() {
  const router = useRouter();
  const { id } = router.query;
  const documentId = id as string;

  // Auth check
  const { isAuthenticated, isLoading: authLoading } = useRequireAuth();
  const user = useAuthStore((state) => state.user);

  // Document state
  const [docData, setDocData] = useState<Document | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const [fileContent, setFileContent] = useState<string | null>(null);
  const [downloadUrl, setDownloadUrl] = useState<string | null>(null);

  // UI state
  const [showComments, setShowComments] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [showAI, setShowAI] = useState(false);
  const [showFind, setShowFind] = useState(false);
  const [selectedText, setSelectedText] = useState<string>('');

  // OnlyOffice editor state
  const [editorReady, setEditorReady] = useState(false);
  const [useOnlyOffice, setUseOnlyOffice] = useState(false);
  const [showShareModalNew, setShowShareModalNew] = useState(false);

  // Store for share modal
  const { isShareModalOpen, openShareModal, closeShareModal } = useDocsStore();

  // Collaboration state
  const [collaborators, setCollaborators] = useState<Collaborator[]>([]);
  const [isOnline, setIsOnline] = useState(true);

  // Comments and versions
  const [comments, setComments] = useState<any[]>([]);
  const [versions, setVersions] = useState<any[]>([]);

  // Current user from auth
  const currentUser = {
    id: user?.id || 'current-user',
    name: user?.username || 'Current User',
    email: user?.email || 'user@example.com',
  };

  // Fetch document on mount (only when authenticated)
  useEffect(() => {
    if (!documentId || authLoading || !isAuthenticated) return;

    const fetchDocument = async () => {
      setLoading(true);
      try {
        const doc = await docsEditorApi.getDocument(documentId);
        console.log('Loaded document:', doc);
        console.log('Document content:', doc.content);
        setDocData(doc);

        // Check if it's a Word document - use OnlyOffice
        if (isWordDocument(doc)) {
          console.log('Word document detected, using OnlyOffice editor');
          setUseOnlyOffice(true);
          // Get download URL for the document
          try {
            const url = await docsEditorApi.getFileDownloadUrl(documentId);
            setDownloadUrl(url);
          } catch (e) {
            console.error('Failed to get download URL:', e);
          }
        }
        // Check if it's another type of uploaded file
        else if (isUploadedFile(doc)) {
          // For text files, fetch content
          if (isTextFile(doc.mime_type)) {
            try {
              const content = await docsEditorApi.getFileContent(documentId);
              setFileContent(content);
            } catch (e) {
              console.error('Failed to load file content:', e);
            }
          }
          // Get download URL
          try {
            const url = await docsEditorApi.getFileDownloadUrl(documentId);
            setDownloadUrl(url);
          } catch (e) {
            console.error('Failed to get download URL:', e);
          }
        }

        // Also fetch comments
        const commentsData = await docsEditorApi.getComments(documentId);
        setComments(commentsData);
      } catch (err) {
        setError('Failed to load document');
        console.error(err);
      } finally {
        setLoading(false);
      }
    };

    fetchDocument();
  }, [documentId, authLoading, isAuthenticated]);

  // Handle content changes
  const handleContentChange = useCallback((content: any) => {
    if (docData) {
      setDocData({ ...docData, content });
    }
  }, [docData]);

  // Save document
  const handleSave = useCallback(async (content: any) => {
    if (!documentId) return;

    setIsSaving(true);
    try {
      await docsEditorApi.saveDocument(documentId, content);
      setLastSaved(new Date());
    } catch (err) {
      console.error('Save failed:', err);
    } finally {
      setIsSaving(false);
    }
  }, [documentId]);

  // Title change
  const handleTitleChange = async (newTitle: string) => {
    if (!documentId || !docData) return;

    try {
      await docsEditorApi.updateDocumentTitle(documentId, newTitle);
      setDocData({ ...docData, title: newTitle });
    } catch (err) {
      console.error('Failed to update title:', err);
    }
  };

  // Toggle favorite
  const handleToggleFavorite = async () => {
    if (!documentId || !docData) return;

    try {
      await docsEditorApi.toggleFavorite(documentId, !docData.is_favorite);
      setDocData({ ...docData, is_favorite: !docData.is_favorite });
    } catch (err) {
      console.error('Failed to toggle favorite:', err);
    }
  };

  // Comments handlers
  const handleAddComment = async (content: string, position?: { start: number; end: number }, selectionText?: string) => {
    try {
      const newComment = await docsEditorApi.addComment(documentId, content, position, selectionText);
      setComments([...comments, newComment]);
    } catch (err) {
      console.error('Failed to add comment:', err);
    }
  };

  const handleReplyComment = async (commentId: string, content: string) => {
    try {
      const reply = await docsEditorApi.replyToComment(documentId, commentId, content);
      setComments(comments.map(c =>
        c.id === commentId
          ? { ...c, replies: [...c.replies, reply] }
          : c
      ));
    } catch (err) {
      console.error('Failed to reply:', err);
    }
  };

  const handleResolveComment = async (commentId: string) => {
    try {
      await docsEditorApi.resolveComment(documentId, commentId);
      setComments(comments.map(c =>
        c.id === commentId ? { ...c, resolved: true } : c
      ));
    } catch (err) {
      console.error('Failed to resolve comment:', err);
    }
  };

  const handleDeleteComment = async (commentId: string) => {
    try {
      await docsEditorApi.deleteComment(documentId, commentId);
      setComments(comments.filter(c => c.id !== commentId));
    } catch (err) {
      console.error('Failed to delete comment:', err);
    }
  };

  // Version history handlers
  const fetchVersions = async () => {
    try {
      const data = await docsEditorApi.getVersionHistory(documentId);
      setVersions(data);
    } catch (err) {
      console.error('Failed to fetch versions:', err);
    }
  };

  const handleToggleHistory = () => {
    if (!showHistory) {
      fetchVersions();
    }
    setShowHistory(!showHistory);
    setShowComments(false);
    setShowAI(false);
  };

  const handleRestoreVersion = async (version: any) => {
    try {
      await docsEditorApi.restoreVersion(documentId, version.id);
      // Reload document
      const doc = await docsEditorApi.getDocument(documentId);
      setDocData(doc);
      setShowHistory(false);
    } catch (err) {
      console.error('Failed to restore version:', err);
    }
  };

  // AI handlers
  const handleInsertAIText = (text: string) => {
    // This would insert at cursor position in editor
    console.log('Insert AI text:', text);
  };

  const handleReplaceWithAI = (text: string) => {
    // This would replace selection in editor
    console.log('Replace with AI text:', text);
  };

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'f') {
        e.preventDefault();
        setShowFind(true);
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Online status
  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Show loading while checking auth
  if (authLoading) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600" />
      </div>
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600" />
      </div>
    );
  }

  if (error || !docData) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <div className="text-center">
          <p className="text-red-600 mb-4">{error || 'Document not found'}</p>
          <button
            onClick={() => router.push('/docs')}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg"
          >
            Back to Documents
          </button>
        </div>
      </div>
    );
  }

  // Download handler for OnlyOffice documents
  const handleDownloadDoc = async () => {
    if (downloadUrl) {
      window.open(downloadUrl, '_blank');
    } else {
      try {
        const url = await docsEditorApi.getFileDownloadUrl(documentId);
        if (url) {
          window.open(url, '_blank');
        }
      } catch (e) {
        console.error('Failed to download:', e);
      }
    }
  };

  // Render OnlyOffice editor for Word documents
  if (useOnlyOffice && docData) {
    return (
      <>
        <Head>
          <title>{docData.title || 'Untitled'} - Bheem Docs</title>
        </Head>

        <div className="min-h-screen bg-gray-100 flex flex-col">
          {/* Custom Bheem Header for OnlyOffice */}
          <BheemDocsHeader
            title={docData.title}
            isFavorite={docData.is_favorite}
            isSaving={isSaving}
            isSaved={editorReady}
            onTitleChange={handleTitleChange}
            onToggleFavorite={handleToggleFavorite}
            onShare={() => setShowShareModalNew(true)}
            onDownload={handleDownloadDoc}
            onShowHistory={handleToggleHistory}
            onToggleComments={() => {
              setShowComments(!showComments);
              setShowHistory(false);
            }}
          />

          {/* OnlyOffice Editor */}
          <div className="flex-1 relative">
            <OnlyOfficeDocEditor
              documentId={documentId}
              mode="edit"
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
                setLastSaved(new Date());
              }}
              className="h-full"
            />
          </div>

          {/* Comments Panel for OnlyOffice */}
          {showComments && (
            <CommentsPanel
              documentId={documentId}
              comments={comments}
              currentUser={currentUser}
              onAddComment={handleAddComment}
              onReply={handleReplyComment}
              onResolve={handleResolveComment}
              onDelete={handleDeleteComment}
              onEdit={() => {}}
              onReact={() => {}}
              onClose={() => setShowComments(false)}
              selectedText={selectedText ? { text: selectedText, start: 0, end: selectedText.length } : undefined}
            />
          )}

          {/* Version History Sidebar */}
          {showHistory && (
            <VersionHistory
              versions={versions}
              currentVersionId={docData.id}
              onPreview={() => {}}
              onRestore={handleRestoreVersion}
              onClose={() => setShowHistory(false)}
            />
          )}

          {/* Share Modal */}
          <ShareModalShared
            isOpen={showShareModalNew}
            onClose={() => setShowShareModalNew(false)}
            documentId={docData.id}
            documentType="doc"
            documentTitle={docData.title}
          />
        </div>
      </>
    );
  }

  return (
    <>
      <Head>
        <title>{docData.title || 'Untitled'} - Bheem Docs</title>
      </Head>

      <div className="min-h-screen bg-gray-100 flex flex-col">
        {/* Document Header */}
        <DocumentHeader
          documentId={documentId}
          title={docData.title}
          isFavorite={docData.is_favorite}
          isShared={docData.is_shared}
          lastSaved={lastSaved ?? undefined}
          isSaving={isSaving}
          isOnline={isOnline}
          onTitleChange={handleTitleChange}
          onToggleFavorite={handleToggleFavorite}
          onShare={() => openShareModal({ id: docData.id, name: docData.title, path: `/docs/${documentId}`, type: 'file', size: 0, modified: new Date().toISOString(), isShared: docData.is_shared, isFavorite: docData.is_favorite, permissions: 'write' })}
          onToggleComments={() => {
            setShowComments(!showComments);
            setShowHistory(false);
            setShowAI(false);
          }}
          onToggleHistory={handleToggleHistory}
          onToggleAI={() => {
            setShowAI(!showAI);
            setShowComments(false);
            setShowHistory(false);
          }}
          onToggleFind={() => setShowFind(!showFind)}
          onMoveToFolder={() => {}}
          onDuplicate={() => {}}
          onDelete={() => {}}
        />

        {/* Collaboration Bar */}
        {collaborators.length > 0 && (
          <CollaborationBar
            collaborators={collaborators}
            currentUserId={currentUser.id}
            documentTitle={docData.title}
            isOnline={isOnline}
          />
        )}

        {/* Main content area */}
        <div className="flex-1 flex overflow-hidden">
          {/* Editor or File Preview */}
          <div className="flex-1 p-4 overflow-auto">
            <div className="max-w-4xl mx-auto">
              {isWordDocument(docData) ? (
                /* OnlyOffice Editor for Word docs - already handled above */
                <div className="text-center py-8">
                  <p>Loading Word editor...</p>
                </div>
              ) : isUploadedFile(docData) ? (
                /* File Preview for uploaded documents */
                <div className="bg-white rounded-lg shadow-sm border p-6">
                  <div className="flex items-center justify-between mb-6">
                    <div>
                      <h2 className="text-lg font-semibold text-gray-900">{docData.file_name || docData.title}</h2>
                      <p className="text-sm text-gray-500">
                        {docData.mime_type} • {docData.file_size ? `${(docData.file_size / 1024).toFixed(1)} KB` : 'Unknown size'}
                      </p>
                    </div>
                    {downloadUrl && (
                      <a
                        href={downloadUrl}
                        download={docData.file_name}
                        className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                      >
                        Download File
                      </a>
                    )}
                  </div>

                  {/* File preview based on type */}
                  {isPdfFile(docData.mime_type) && downloadUrl ? (
                    /* PDF Preview */
                    <div className="border rounded-lg overflow-hidden">
                      <iframe
                        src={downloadUrl}
                        className="w-full h-[70vh]"
                        title={docData.file_name || 'PDF Preview'}
                      />
                    </div>
                  ) : isImageFile(docData.mime_type) && downloadUrl ? (
                    /* Image Preview */
                    <div className="border rounded-lg overflow-hidden p-4 bg-gray-50 flex items-center justify-center">
                      <img
                        src={downloadUrl}
                        alt={docData.file_name || 'Image Preview'}
                        className="max-w-full max-h-[70vh] object-contain"
                      />
                    </div>
                  ) : isTextFile(docData.mime_type) && fileContent ? (
                    /* Text file content preview */
                    <div className="border rounded-lg overflow-hidden">
                      <div className="bg-gray-100 px-4 py-2 border-b">
                        <span className="text-sm font-medium text-gray-600">File Contents</span>
                      </div>
                      <pre className="p-4 overflow-auto max-h-[60vh] text-sm font-mono bg-gray-50 whitespace-pre-wrap">
                        {fileContent}
                      </pre>
                    </div>
                  ) : (
                    /* No preview available */
                    <div className="flex flex-col items-center justify-center py-16 text-gray-500">
                      <svg className="w-16 h-16 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                      </svg>
                      <p className="text-lg font-medium">Preview not available</p>
                      <p className="text-sm">Download the file to view its contents</p>
                    </div>
                  )}
                </div>
              ) : (
                /* TiptapEditor for rich text documents */
                <TiptapEditor
                  content={docData.content}
                  onChange={handleContentChange}
                  onSave={handleSave}
                  placeholder="Start typing your document..."
                  className="min-h-[calc(100vh-200px)]"
                />
              )}
            </div>
          </div>

          {/* Side panels */}
          {showComments && (
            <CommentsPanel
              documentId={documentId}
              comments={comments}
              currentUser={currentUser}
              onAddComment={handleAddComment}
              onReply={handleReplyComment}
              onResolve={handleResolveComment}
              onDelete={handleDeleteComment}
              onEdit={() => {}}
              onReact={() => {}}
              onClose={() => setShowComments(false)}
              selectedText={selectedText ? { text: selectedText, start: 0, end: selectedText.length } : undefined}
            />
          )}

          {showHistory && (
            <VersionHistory
              versions={versions}
              currentVersionId={docData.id}
              onPreview={() => {}}
              onRestore={handleRestoreVersion}
              onClose={() => setShowHistory(false)}
            />
          )}

          {showAI && (
            <AIAssistant
              documentId={documentId}
              selectedText={selectedText}
              onInsertText={handleInsertAIText}
              onReplaceSelection={handleReplaceWithAI}
              onClose={() => setShowAI(false)}
            />
          )}
        </div>

        {/* Find and Replace */}
        {showFind && (
          <FindReplace
            editor={null} // Would pass actual editor instance
            onClose={() => setShowFind(false)}
          />
        )}

        {/* Share Modal */}
        <ShareModal
          isOpen={isShareModalOpen}
          onClose={closeShareModal}
        />
      </div>
    </>
  );
}
