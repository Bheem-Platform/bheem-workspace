/**
 * Bheem Notes Store
 *
 * Zustand store for managing notes state.
 */

import { create } from 'zustand';
import * as notesApi from '@/lib/notesApi';
import type {
  Note,
  NoteLabel,
  CreateNoteRequest,
  UpdateNoteRequest,
  ListNotesParams,
  NoteCounts,
  ChecklistItem,
} from '@/lib/notesApi';

// ===========================================
// Types
// ===========================================

type ViewMode = 'grid' | 'list';
type ActiveView = 'notes' | 'reminders' | 'archive' | 'trash';
type SortBy = 'updated_at' | 'created_at' | 'title';
type SortOrder = 'asc' | 'desc';

interface NotesState {
  // Data
  notes: Note[];
  labels: NoteLabel[];
  counts: NoteCounts | null;

  // Selection
  selectedNote: Note | null;
  selectedNoteIds: string[];

  // View State
  viewMode: ViewMode;
  activeView: ActiveView;
  activeLabel: string | null;
  searchQuery: string;

  // Sorting
  sortBy: SortBy;
  sortOrder: SortOrder;

  // Loading
  loading: {
    notes: boolean;
    note: boolean;
    labels: boolean;
    action: boolean;
  };

  // Error
  error: string | null;

  // Modal State
  isCreateModalOpen: boolean;
  isEditModalOpen: boolean;
  isLabelModalOpen: boolean;
  isReminderModalOpen: boolean;

  // Actions - Notes
  fetchNotes: (params?: ListNotesParams) => Promise<void>;
  fetchNote: (noteId: string) => Promise<void>;
  createNote: (request: CreateNoteRequest) => Promise<Note | null>;
  updateNote: (noteId: string, updates: UpdateNoteRequest) => Promise<Note | null>;
  deleteNote: (noteId: string, permanent?: boolean) => Promise<boolean>;

  // Actions - Note Operations
  togglePin: (noteId: string) => Promise<void>;
  archiveNote: (noteId: string) => Promise<void>;
  unarchiveNote: (noteId: string) => Promise<void>;
  restoreNote: (noteId: string) => Promise<void>;
  changeColor: (noteId: string, color: string) => Promise<void>;
  copyNote: (noteId: string) => Promise<Note | null>;

  // Actions - Labels
  fetchLabels: () => Promise<void>;
  createLabel: (name: string, color?: string) => Promise<NoteLabel | null>;
  updateLabel: (labelId: string, name?: string, color?: string) => Promise<void>;
  deleteLabel: (labelId: string) => Promise<boolean>;

  // Actions - Counts
  fetchCounts: () => Promise<void>;

  // Actions - Search
  searchNotes: (query: string) => Promise<void>;
  clearSearch: () => void;

  // Actions - Selection
  selectNote: (note: Note | null) => void;
  toggleNoteSelection: (noteId: string) => void;
  selectAllNotes: () => void;
  clearSelection: () => void;

  // Actions - View
  setViewMode: (mode: ViewMode) => void;
  setActiveView: (view: ActiveView) => void;
  setActiveLabel: (labelId: string | null) => void;
  setSortBy: (sortBy: SortBy) => void;
  setSortOrder: (order: SortOrder) => void;

  // Actions - Modals
  openCreateModal: () => void;
  closeCreateModal: () => void;
  openEditModal: (note: Note) => void;
  closeEditModal: () => void;
  openLabelModal: () => void;
  closeLabelModal: () => void;
  openReminderModal: (note: Note) => void;
  closeReminderModal: () => void;

  // Actions - Utility
  clearError: () => void;
  reset: () => void;
}

// ===========================================
// Initial State
// ===========================================

const initialState = {
  notes: [] as Note[],
  labels: [] as NoteLabel[],
  counts: null as NoteCounts | null,

  selectedNote: null as Note | null,
  selectedNoteIds: [] as string[],

  viewMode: 'grid' as ViewMode,
  activeView: 'notes' as ActiveView,
  activeLabel: null as string | null,
  searchQuery: '',

  sortBy: 'updated_at' as SortBy,
  sortOrder: 'desc' as SortOrder,

  loading: {
    notes: false,
    note: false,
    labels: false,
    action: false,
  },

  error: null as string | null,

  isCreateModalOpen: false,
  isEditModalOpen: false,
  isLabelModalOpen: false,
  isReminderModalOpen: false,
};

// ===========================================
// Store
// ===========================================

export const useNotesStore = create<NotesState>((set, get) => ({
  ...initialState,

  // ===========================================
  // Fetch Notes
  // ===========================================
  fetchNotes: async (params?: ListNotesParams) => {
    set((state) => ({ loading: { ...state.loading, notes: true }, error: null }));

    try {
      const { activeView, activeLabel, sortBy, sortOrder, searchQuery } = get();

      const fetchParams: ListNotesParams = {
        ...params,
        is_archived: activeView === 'archive',
        is_trashed: activeView === 'trash',
        label_id: activeLabel || undefined,
        search: searchQuery || undefined,
        sort_by: sortBy,
        sort_order: sortOrder,
      };

      const notes = await notesApi.listNotes(fetchParams);
      set({ notes });
    } catch (error: any) {
      set({ error: error.message || 'Failed to fetch notes' });
    } finally {
      set((state) => ({ loading: { ...state.loading, notes: false } }));
    }
  },

  // ===========================================
  // Fetch Single Note
  // ===========================================
  fetchNote: async (noteId: string) => {
    set((state) => ({ loading: { ...state.loading, note: true } }));

    try {
      const note = await notesApi.getNote(noteId);
      set({ selectedNote: note });
    } catch (error: any) {
      set({ error: error.message || 'Failed to fetch note' });
    } finally {
      set((state) => ({ loading: { ...state.loading, note: false } }));
    }
  },

  // ===========================================
  // Create Note
  // ===========================================
  createNote: async (request: CreateNoteRequest) => {
    set((state) => ({ loading: { ...state.loading, action: true }, error: null }));

    try {
      const note = await notesApi.createNote(request);
      set((state) => ({
        notes: [note, ...state.notes],
        isCreateModalOpen: false,
      }));

      // Refresh counts
      get().fetchCounts();

      return note;
    } catch (error: any) {
      set({ error: error.message || 'Failed to create note' });
      return null;
    } finally {
      set((state) => ({ loading: { ...state.loading, action: false } }));
    }
  },

  // ===========================================
  // Update Note
  // ===========================================
  updateNote: async (noteId: string, updates: UpdateNoteRequest) => {
    set((state) => ({ loading: { ...state.loading, action: true }, error: null }));

    try {
      const updatedNote = await notesApi.updateNote(noteId, updates);

      set((state) => ({
        notes: state.notes.map((n) => (n.id === noteId ? updatedNote : n)),
        selectedNote: state.selectedNote?.id === noteId ? updatedNote : state.selectedNote,
        isEditModalOpen: false,
      }));

      return updatedNote;
    } catch (error: any) {
      set({ error: error.message || 'Failed to update note' });
      return null;
    } finally {
      set((state) => ({ loading: { ...state.loading, action: false } }));
    }
  },

  // ===========================================
  // Delete Note
  // ===========================================
  deleteNote: async (noteId: string, permanent: boolean = false) => {
    set((state) => ({ loading: { ...state.loading, action: true }, error: null }));

    try {
      await notesApi.deleteNote(noteId, permanent);

      set((state) => ({
        notes: state.notes.filter((n) => n.id !== noteId),
        selectedNote: state.selectedNote?.id === noteId ? null : state.selectedNote,
        selectedNoteIds: state.selectedNoteIds.filter((id) => id !== noteId),
      }));

      // Refresh counts
      get().fetchCounts();

      return true;
    } catch (error: any) {
      set({ error: error.message || 'Failed to delete note' });
      return false;
    } finally {
      set((state) => ({ loading: { ...state.loading, action: false } }));
    }
  },

  // ===========================================
  // Note Operations
  // ===========================================
  togglePin: async (noteId: string) => {
    try {
      const updatedNote = await notesApi.togglePin(noteId);
      set((state) => ({
        notes: state.notes.map((n) => (n.id === noteId ? updatedNote : n)),
      }));
    } catch (error: any) {
      set({ error: error.message });
    }
  },

  archiveNote: async (noteId: string) => {
    try {
      const updatedNote = await notesApi.archiveNote(noteId);
      set((state) => ({
        notes: state.notes.filter((n) => n.id !== noteId),
      }));
      get().fetchCounts();
    } catch (error: any) {
      set({ error: error.message });
    }
  },

  unarchiveNote: async (noteId: string) => {
    try {
      const updatedNote = await notesApi.unarchiveNote(noteId);
      set((state) => ({
        notes: state.notes.filter((n) => n.id !== noteId),
      }));
      get().fetchCounts();
    } catch (error: any) {
      set({ error: error.message });
    }
  },

  restoreNote: async (noteId: string) => {
    try {
      const updatedNote = await notesApi.restoreNote(noteId);
      set((state) => ({
        notes: state.notes.filter((n) => n.id !== noteId),
      }));
      get().fetchCounts();
    } catch (error: any) {
      set({ error: error.message });
    }
  },

  changeColor: async (noteId: string, color: string) => {
    try {
      const updatedNote = await notesApi.changeNoteColor(noteId, color);
      set((state) => ({
        notes: state.notes.map((n) => (n.id === noteId ? updatedNote : n)),
        selectedNote: state.selectedNote?.id === noteId ? updatedNote : state.selectedNote,
      }));
    } catch (error: any) {
      set({ error: error.message });
    }
  },

  copyNote: async (noteId: string) => {
    try {
      const copiedNote = await notesApi.copyNote(noteId);
      set((state) => ({
        notes: [copiedNote, ...state.notes],
      }));
      get().fetchCounts();
      return copiedNote;
    } catch (error: any) {
      set({ error: error.message });
      return null;
    }
  },

  // ===========================================
  // Labels
  // ===========================================
  fetchLabels: async () => {
    set((state) => ({ loading: { ...state.loading, labels: true } }));

    try {
      const labels = await notesApi.listLabels();
      set({ labels });
    } catch (error: any) {
      set({ error: error.message || 'Failed to fetch labels' });
    } finally {
      set((state) => ({ loading: { ...state.loading, labels: false } }));
    }
  },

  createLabel: async (name: string, color?: string) => {
    try {
      const label = await notesApi.createLabel(name, color);
      set((state) => ({
        labels: [...state.labels, label],
      }));
      return label;
    } catch (error: any) {
      set({ error: error.message });
      return null;
    }
  },

  updateLabel: async (labelId: string, name?: string, color?: string) => {
    try {
      const updatedLabel = await notesApi.updateLabel(labelId, name, color);
      set((state) => ({
        labels: state.labels.map((l) => (l.id === labelId ? updatedLabel : l)),
      }));
    } catch (error: any) {
      set({ error: error.message });
    }
  },

  deleteLabel: async (labelId: string) => {
    try {
      await notesApi.deleteLabel(labelId);
      set((state) => ({
        labels: state.labels.filter((l) => l.id !== labelId),
        activeLabel: state.activeLabel === labelId ? null : state.activeLabel,
      }));
      return true;
    } catch (error: any) {
      set({ error: error.message });
      return false;
    }
  },

  // ===========================================
  // Counts
  // ===========================================
  fetchCounts: async () => {
    try {
      const counts = await notesApi.getNoteCounts();
      set({ counts });
    } catch (error: any) {
      console.error('Failed to fetch counts:', error);
    }
  },

  // ===========================================
  // Search
  // ===========================================
  searchNotes: async (query: string) => {
    set({ searchQuery: query });

    if (!query.trim()) {
      get().clearSearch();
      return;
    }

    set((state) => ({ loading: { ...state.loading, notes: true } }));

    try {
      const result = await notesApi.searchNotes(query);
      set({ notes: result.results });
    } catch (error: any) {
      set({ error: error.message });
    } finally {
      set((state) => ({ loading: { ...state.loading, notes: false } }));
    }
  },

  clearSearch: () => {
    set({ searchQuery: '' });
    get().fetchNotes();
  },

  // ===========================================
  // Selection
  // ===========================================
  selectNote: (note: Note | null) => {
    set({ selectedNote: note });
  },

  toggleNoteSelection: (noteId: string) => {
    set((state) => ({
      selectedNoteIds: state.selectedNoteIds.includes(noteId)
        ? state.selectedNoteIds.filter((id) => id !== noteId)
        : [...state.selectedNoteIds, noteId],
    }));
  },

  selectAllNotes: () => {
    set((state) => ({
      selectedNoteIds: state.notes.map((n) => n.id),
    }));
  },

  clearSelection: () => {
    set({ selectedNoteIds: [] });
  },

  // ===========================================
  // View Settings
  // ===========================================
  setViewMode: (mode: ViewMode) => {
    set({ viewMode: mode });
  },

  setActiveView: (view: ActiveView) => {
    set({ activeView: view, activeLabel: null, selectedNote: null });
    get().fetchNotes();
  },

  setActiveLabel: (labelId: string | null) => {
    set({ activeLabel: labelId, activeView: 'notes' });
    get().fetchNotes();
  },

  setSortBy: (sortBy: SortBy) => {
    set({ sortBy });
    get().fetchNotes();
  },

  setSortOrder: (order: SortOrder) => {
    set({ sortOrder: order });
    get().fetchNotes();
  },

  // ===========================================
  // Modals
  // ===========================================
  openCreateModal: () => {
    set({ isCreateModalOpen: true });
  },

  closeCreateModal: () => {
    set({ isCreateModalOpen: false });
  },

  openEditModal: (note: Note) => {
    set({ selectedNote: note, isEditModalOpen: true });
  },

  closeEditModal: () => {
    set({ isEditModalOpen: false });
  },

  openLabelModal: () => {
    set({ isLabelModalOpen: true });
  },

  closeLabelModal: () => {
    set({ isLabelModalOpen: false });
  },

  openReminderModal: (note: Note) => {
    set({ selectedNote: note, isReminderModalOpen: true });
  },

  closeReminderModal: () => {
    set({ isReminderModalOpen: false });
  },

  // ===========================================
  // Utility
  // ===========================================
  clearError: () => {
    set({ error: null });
  },

  reset: () => {
    set(initialState);
  },
}));
