/**
 * Bheem Docs - Document Editor Page
 * Full-featured document editor with collaboration
 */
import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import dynamic from 'next/dynamic';
import DocumentHeader from '@/components/docs/editor/DocumentHeader';
import CollaborationBar from '@/components/docs/editor/CollaborationBar';
import CommentsPanel from '@/components/docs/editor/CommentsPanel';
import VersionHistory from '@/components/docs/editor/VersionHistory';
import AIAssistant from '@/components/docs/editor/AIAssistant';
import FindReplace from '@/components/docs/editor/FindReplace';
import ShareModal from '@/components/docs/ShareModal';
import { useDocsStore } from '@/stores/docsStore';
import * as docsEditorApi from '@/lib/docsEditorApi';

// Dynamic import to avoid SSR issues with Tiptap
const TiptapEditor = dynamic(
  () => import('@/components/docs/editor/TiptapEditor'),
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
}

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

  // Document state
  const [docData, setDocData] = useState<Document | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);

  // UI state
  const [showComments, setShowComments] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [showAI, setShowAI] = useState(false);
  const [showFind, setShowFind] = useState(false);
  const [selectedText, setSelectedText] = useState<string>('');

  // Store for share modal
  const { isShareModalOpen, openShareModal, closeShareModal } = useDocsStore();

  // Collaboration state
  const [collaborators, setCollaborators] = useState<Collaborator[]>([]);
  const [isOnline, setIsOnline] = useState(true);

  // Comments and versions
  const [comments, setComments] = useState<any[]>([]);
  const [versions, setVersions] = useState<any[]>([]);

  // Current user (would come from auth context)
  const currentUser = {
    id: 'current-user',
    name: 'Current User',
    email: 'user@example.com',
  };

  // Fetch document on mount
  useEffect(() => {
    if (!documentId) return;

    const fetchDocument = async () => {
      setLoading(true);
      try {
        const doc = await docsEditorApi.getDocument(documentId);
        setDocData(doc);

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
  }, [documentId]);

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
          {/* Editor */}
          <div className="flex-1 p-4 overflow-auto">
            <div className="max-w-4xl mx-auto">
              <TiptapEditor
                content={docData.content}
                onChange={handleContentChange}
                onSave={handleSave}
                placeholder="Start typing your document..."
                className="min-h-[calc(100vh-200px)]"
              />
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
