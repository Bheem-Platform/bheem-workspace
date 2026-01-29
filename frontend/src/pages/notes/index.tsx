/**
 * Bheem Notes Page
 *
 * Main page for the Notes application.
 */

import React from 'react';
import Head from 'next/head';
import {
  Search,
  Plus,
  Grid,
  List,
  RefreshCw,
  Settings,
} from 'lucide-react';
import WorkspaceLayout from '@/components/workspace/WorkspaceLayout';
import { NoteCard } from '@/components/notes/NoteCard';
import { NotesSidebar } from '@/components/notes/NotesSidebar';
import { NoteEditor } from '@/components/notes/NoteEditor';
import { useNotesStore } from '@/stores/notesStore';

export default function NotesPage() {
  const {
    notes,
    counts,
    viewMode,
    activeView,
    activeLabel,
    labels,
    searchQuery,
    loading,
    error,
    isCreateModalOpen,
    isEditModalOpen,
    selectedNoteIds,
    fetchNotes,
    fetchLabels,
    fetchCounts,
    searchNotes,
    clearSearch,
    setViewMode,
    openCreateModal,
    closeCreateModal,
    closeEditModal,
    clearSelection,
    clearError,
  } = useNotesStore();

  const [localSearch, setLocalSearch] = React.useState('');
  const searchTimeoutRef = React.useRef<NodeJS.Timeout>();

  // Initial data fetch
  React.useEffect(() => {
    fetchNotes();
    fetchLabels();
    fetchCounts();
  }, []);

  // Debounced search
  React.useEffect(() => {
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }

    if (localSearch.trim()) {
      searchTimeoutRef.current = setTimeout(() => {
        searchNotes(localSearch);
      }, 300);
    } else if (searchQuery) {
      clearSearch();
    }

    return () => {
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
      }
    };
  }, [localSearch]);

  // Keyboard shortcuts
  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ctrl/Cmd + N for new note
      if ((e.ctrlKey || e.metaKey) && e.key === 'n') {
        e.preventDefault();
        openCreateModal();
      }

      // Escape to close modals or clear selection
      if (e.key === 'Escape') {
        if (isCreateModalOpen) {
          closeCreateModal();
        } else if (isEditModalOpen) {
          closeEditModal();
        } else if (selectedNoteIds.length > 0) {
          clearSelection();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isCreateModalOpen, isEditModalOpen, selectedNoteIds]);

  const getViewTitle = () => {
    if (activeLabel) {
      const label = labels.find((l) => l.id === activeLabel);
      return label?.name || 'Label';
    }

    switch (activeView) {
      case 'notes':
        return 'Notes';
      case 'reminders':
        return 'Reminders';
      case 'archive':
        return 'Archive';
      case 'trash':
        return 'Trash';
      default:
        return 'Notes';
    }
  };

  const pinnedNotes = notes.filter((n) => n.is_pinned && !n.is_archived && !n.is_trashed);
  const otherNotes = notes.filter((n) => !n.is_pinned || n.is_archived || n.is_trashed);

  return (
    <WorkspaceLayout title="Notes" secondarySidebar={<NotesSidebar />}>
      <Head>
        <title>Notes - Bheem Workspace</title>
      </Head>

      <div className="flex h-full">

        {/* Main Content */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Header */}
          <header className="flex items-center justify-between px-6 py-4 border-b bg-gradient-to-r from-[#FFCCF2]/20 via-white to-[#977DFF]/10">
            <h1 className="text-xl font-semibold text-gray-900">{getViewTitle()}</h1>

            <div className="flex items-center gap-4">
              {/* Search */}
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="text"
                  value={localSearch}
                  onChange={(e) => setLocalSearch(e.target.value)}
                  placeholder="Search notes..."
                  className="pl-9 pr-4 py-2 w-64 border rounded-lg focus:outline-none focus:ring-2 focus:ring-[#977DFF]"
                />
                {localSearch && (
                  <button
                    onClick={() => {
                      setLocalSearch('');
                      clearSearch();
                    }}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  >
                    ×
                  </button>
                )}
              </div>

              {/* View toggle */}
              <div className="flex items-center border rounded-lg overflow-hidden">
                <button
                  onClick={() => setViewMode('grid')}
                  className={`p-2 ${
                    viewMode === 'grid' ? 'bg-gray-100' : 'hover:bg-gray-50'
                  }`}
                  title="Grid view"
                >
                  <Grid className="w-4 h-4" />
                </button>
                <button
                  onClick={() => setViewMode('list')}
                  className={`p-2 ${
                    viewMode === 'list' ? 'bg-gray-100' : 'hover:bg-gray-50'
                  }`}
                  title="List view"
                >
                  <List className="w-4 h-4" />
                </button>
              </div>

              {/* Refresh */}
              <button
                onClick={() => fetchNotes()}
                disabled={loading.notes}
                className="p-2 rounded-lg hover:bg-gray-100 disabled:opacity-50"
                title="Refresh"
              >
                <RefreshCw
                  className={`w-4 h-4 ${loading.notes ? 'animate-spin' : ''}`}
                />
              </button>

              {/* Settings */}
              <button
                className="p-2 rounded-lg hover:bg-gray-100"
                title="Settings"
              >
                <Settings className="w-4 h-4" />
              </button>
            </div>
          </header>

          {/* Error message */}
          {error && (
            <div className="mx-6 mt-4 px-4 py-3 bg-red-50 border border-red-200 rounded-lg flex items-center justify-between">
              <span className="text-red-700">{error}</span>
              <button onClick={clearError} className="text-red-500 hover:text-red-700">
                ×
              </button>
            </div>
          )}

          {/* Content */}
          <main className="flex-1 overflow-auto p-6 bg-gradient-to-br from-[#FFCCF2]/5 via-white to-[#977DFF]/5">
            {loading.notes && notes.length === 0 ? (
              <div className="flex items-center justify-center h-64">
                <div className="w-8 h-8 border-4 border-[#977DFF]/30 border-t-[#0033FF] rounded-full animate-spin" />
              </div>
            ) : notes.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-64 text-gray-500">
                <div className="text-6xl mb-4">📝</div>
                <p className="text-lg">No notes yet</p>
                <p className="text-sm mt-1">
                  Click the + button or press Ctrl+N to create a note
                </p>
              </div>
            ) : (
              <>
                {/* Pinned notes */}
                {pinnedNotes.length > 0 && activeView === 'notes' && (
                  <div className="mb-8">
                    <h2 className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-3">
                      Pinned
                    </h2>
                    <div
                      className={
                        viewMode === 'grid'
                          ? 'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4'
                          : 'space-y-3'
                      }
                    >
                      {pinnedNotes.map((note) => (
                        <NoteCard
                          key={note.id}
                          note={note}
                          isSelected={selectedNoteIds.includes(note.id)}
                          viewMode={viewMode}
                        />
                      ))}
                    </div>
                  </div>
                )}

                {/* Other notes */}
                {otherNotes.length > 0 && (
                  <div>
                    {pinnedNotes.length > 0 && activeView === 'notes' && (
                      <h2 className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-3">
                        Others
                      </h2>
                    )}
                    <div
                      className={
                        viewMode === 'grid'
                          ? 'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4'
                          : 'space-y-3'
                      }
                    >
                      {otherNotes.map((note) => (
                        <NoteCard
                          key={note.id}
                          note={note}
                          isSelected={selectedNoteIds.includes(note.id)}
                          viewMode={viewMode}
                        />
                      ))}
                    </div>
                  </div>
                )}
              </>
            )}
          </main>

          {/* Create button (FAB) */}
          {activeView !== 'trash' && (
            <button
              onClick={openCreateModal}
              className="fixed bottom-8 right-8 w-14 h-14 bg-gradient-to-r from-[#977DFF] to-[#0033FF] text-white rounded-full shadow-lg hover:shadow-xl flex items-center justify-center transition-all hover:scale-110"
              title="New note (Ctrl+N)"
            >
              <Plus className="w-6 h-6" />
            </button>
          )}
        </div>
      </div>

      {/* Create Modal */}
      <NoteEditor
        isOpen={isCreateModalOpen}
        onClose={closeCreateModal}
        mode="create"
      />

      {/* Edit Modal */}
      <NoteEditor
        isOpen={isEditModalOpen}
        onClose={closeEditModal}
        mode="edit"
      />
    </WorkspaceLayout>
  );
}
