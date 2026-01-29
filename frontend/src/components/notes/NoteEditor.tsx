/**
 * NoteEditor Component
 *
 * Modal for creating and editing notes with rich features.
 */

import React from 'react';
import {
  X,
  Pin,
  Bell,
  Palette,
  Archive,
  Trash2,
  CheckSquare,
  Square,
  Plus,
  GripVertical,
} from 'lucide-react';
import { useNotesStore } from '@/stores/notesStore';
import { NOTE_COLORS, NoteColorKey } from '@/lib/notesApi';
import type { ChecklistItem } from '@/lib/notesApi';

interface NoteEditorProps {
  isOpen: boolean;
  onClose: () => void;
  mode: 'create' | 'edit';
}

export function NoteEditor({ isOpen, onClose, mode }: NoteEditorProps) {
  const {
    selectedNote,
    labels,
    createNote,
    updateNote,
    deleteNote,
    togglePin,
    archiveNote,
    changeColor,
    loading,
  } = useNotesStore();

  // Form state
  const [title, setTitle] = React.useState('');
  const [content, setContent] = React.useState('');
  const [color, setColor] = React.useState('default');
  const [isPinned, setIsPinned] = React.useState(false);
  const [isChecklist, setIsChecklist] = React.useState(false);
  const [checklistItems, setChecklistItems] = React.useState<ChecklistItem[]>([]);
  const [selectedLabelIds, setSelectedLabelIds] = React.useState<string[]>([]);
  const [showColorPicker, setShowColorPicker] = React.useState(false);
  const [showLabelPicker, setShowLabelPicker] = React.useState(false);

  const titleRef = React.useRef<HTMLInputElement>(null);

  // Initialize form when editing
  React.useEffect(() => {
    if (mode === 'edit' && selectedNote) {
      setTitle(selectedNote.title || '');
      setContent(selectedNote.content || '');
      setColor(selectedNote.color || 'default');
      setIsPinned(selectedNote.is_pinned);
      setIsChecklist(selectedNote.is_checklist);
      setChecklistItems(selectedNote.checklist_items || []);
      setSelectedLabelIds(selectedNote.labels?.map((l) => l.id) || []);
    } else if (mode === 'create') {
      resetForm();
    }
  }, [mode, selectedNote, isOpen]);

  // Focus title on open
  React.useEffect(() => {
    if (isOpen && titleRef.current) {
      titleRef.current.focus();
    }
  }, [isOpen]);

  const resetForm = () => {
    setTitle('');
    setContent('');
    setColor('default');
    setIsPinned(false);
    setIsChecklist(false);
    setChecklistItems([]);
    setSelectedLabelIds([]);
  };

  const handleSave = async () => {
    const noteData = {
      title: title.trim() || undefined,
      content: isChecklist ? undefined : content.trim() || undefined,
      color,
      is_pinned: isPinned,
      is_checklist: isChecklist,
      checklist_items: isChecklist ? checklistItems : undefined,
      label_ids: selectedLabelIds,
    };

    if (mode === 'create') {
      await createNote(noteData);
    } else if (selectedNote) {
      await updateNote(selectedNote.id, noteData);
    }

    onClose();
  };

  const handleDelete = async () => {
    if (selectedNote && confirm('Are you sure you want to delete this note?')) {
      await deleteNote(selectedNote.id);
      onClose();
    }
  };

  const handleTogglePin = async () => {
    if (mode === 'edit' && selectedNote) {
      await togglePin(selectedNote.id);
      setIsPinned(!isPinned);
    } else {
      setIsPinned(!isPinned);
    }
  };

  const handleArchive = async () => {
    if (selectedNote) {
      await archiveNote(selectedNote.id);
      onClose();
    }
  };

  // Checklist functions
  const addChecklistItem = () => {
    const newItem: ChecklistItem = {
      id: `item-${Date.now()}`,
      text: '',
      is_checked: false,
      order: checklistItems.length,
    };
    setChecklistItems([...checklistItems, newItem]);
  };

  const updateChecklistItem = (id: string, updates: Partial<ChecklistItem>) => {
    setChecklistItems(
      checklistItems.map((item) =>
        item.id === id ? { ...item, ...updates } : item
      )
    );
  };

  const removeChecklistItem = (id: string) => {
    setChecklistItems(checklistItems.filter((item) => item.id !== id));
  };

  const toggleChecklistMode = () => {
    if (!isChecklist && content) {
      // Convert content to checklist items
      const lines = content.split('\n').filter((line) => line.trim());
      const items: ChecklistItem[] = lines.map((text, index) => ({
        id: `item-${Date.now()}-${index}`,
        text: text.trim(),
        is_checked: false,
        order: index,
      }));
      setChecklistItems(items);
      setContent('');
    } else if (isChecklist && checklistItems.length > 0) {
      // Convert checklist items to content
      const text = checklistItems.map((item) => item.text).join('\n');
      setContent(text);
      setChecklistItems([]);
    }
    setIsChecklist(!isChecklist);
  };

  const toggleLabel = (labelId: string) => {
    setSelectedLabelIds((prev) =>
      prev.includes(labelId)
        ? prev.filter((id) => id !== labelId)
        : [...prev, labelId]
    );
  };

  if (!isOpen) return null;

  const colorKey = color as NoteColorKey;
  const bgColor = NOTE_COLORS[colorKey]?.value || NOTE_COLORS.default.value;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
      <div
        className="w-full max-w-xl rounded-lg shadow-2xl overflow-hidden"
        style={{ backgroundColor: bgColor }}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200/50">
          <h2 className="text-lg font-medium text-gray-900">
            {mode === 'create' ? 'New Note' : 'Edit Note'}
          </h2>
          <button onClick={onClose} className="p-1 rounded-full hover:bg-gray-200">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-4 space-y-4">
          {/* Title */}
          <input
            ref={titleRef}
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Title"
            className="w-full bg-transparent text-lg font-medium placeholder-gray-500 outline-none"
          />

          {/* Content or Checklist */}
          {isChecklist ? (
            <div className="space-y-2">
              {checklistItems.map((item) => (
                <div key={item.id} className="flex items-center gap-2 group">
                  <GripVertical className="w-4 h-4 text-gray-300 cursor-grab opacity-0 group-hover:opacity-100" />
                  <button
                    onClick={() =>
                      updateChecklistItem(item.id, { is_checked: !item.is_checked })
                    }
                    className="flex-shrink-0"
                  >
                    {item.is_checked ? (
                      <CheckSquare className="w-5 h-5 text-gray-400" />
                    ) : (
                      <Square className="w-5 h-5 text-gray-400" />
                    )}
                  </button>
                  <input
                    type="text"
                    value={item.text}
                    onChange={(e) =>
                      updateChecklistItem(item.id, { text: e.target.value })
                    }
                    placeholder="List item"
                    className={`
                      flex-1 bg-transparent outline-none
                      ${item.is_checked ? 'line-through text-gray-400' : ''}
                    `}
                  />
                  <button
                    onClick={() => removeChecklistItem(item.id)}
                    className="p-1 rounded opacity-0 group-hover:opacity-100 hover:bg-gray-200"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              ))}
              <button
                onClick={addChecklistItem}
                className="flex items-center gap-2 text-sm text-gray-500 hover:text-gray-700"
              >
                <Plus className="w-4 h-4" />
                Add item
              </button>
            </div>
          ) : (
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="Take a note..."
              rows={6}
              className="w-full bg-transparent placeholder-gray-500 outline-none resize-none"
            />
          )}

          {/* Selected Labels */}
          {selectedLabelIds.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {selectedLabelIds.map((labelId) => {
                const label = labels.find((l) => l.id === labelId);
                if (!label) return null;
                return (
                  <span
                    key={labelId}
                    className="px-2 py-0.5 text-xs rounded-full bg-gray-200 text-gray-700 flex items-center gap-1"
                  >
                    {label.name}
                    <button
                      onClick={() => toggleLabel(labelId)}
                      className="hover:text-red-500"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </span>
                );
              })}
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="flex items-center justify-between px-4 py-3 border-t border-gray-200/50">
          <div className="flex items-center gap-1">
            {/* Pin */}
            <button
              onClick={handleTogglePin}
              className={`p-2 rounded-full hover:bg-gray-200 ${
                isPinned ? 'text-amber-600' : ''
              }`}
              title={isPinned ? 'Unpin' : 'Pin'}
            >
              <Pin className={`w-5 h-5 ${isPinned ? 'fill-current' : ''}`} />
            </button>

            {/* Reminder */}
            <button
              onClick={() => {
                // TODO: Open reminder modal
              }}
              className="p-2 rounded-full hover:bg-gray-200"
              title="Add reminder"
            >
              <Bell className="w-5 h-5" />
            </button>

            {/* Checklist toggle */}
            <button
              onClick={toggleChecklistMode}
              className={`p-2 rounded-full hover:bg-gray-200 ${
                isChecklist ? 'text-blue-600' : ''
              }`}
              title={isChecklist ? 'Convert to note' : 'Convert to checklist'}
            >
              <CheckSquare className="w-5 h-5" />
            </button>

            {/* Color picker */}
            <div className="relative">
              <button
                onClick={() => setShowColorPicker(!showColorPicker)}
                className="p-2 rounded-full hover:bg-gray-200"
                title="Change color"
              >
                <Palette className="w-5 h-5" />
              </button>

              {showColorPicker && (
                <div className="absolute bottom-full left-0 mb-2 p-2 bg-white rounded-lg shadow-lg border z-10">
                  <div className="grid grid-cols-4 gap-1">
                    {Object.entries(NOTE_COLORS).map(([key, { value, name }]) => (
                      <button
                        key={key}
                        onClick={() => {
                          setColor(key);
                          setShowColorPicker(false);
                        }}
                        className={`
                          w-6 h-6 rounded-full border-2 transition-transform hover:scale-110
                          ${color === key ? 'border-gray-800' : 'border-transparent'}
                        `}
                        style={{ backgroundColor: value }}
                        title={name}
                      />
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Label picker */}
            <div className="relative">
              <button
                onClick={() => setShowLabelPicker(!showLabelPicker)}
                className="p-2 rounded-full hover:bg-gray-200"
                title="Add label"
              >
                <span className="text-lg">🏷️</span>
              </button>

              {showLabelPicker && labels.length > 0 && (
                <div className="absolute bottom-full left-0 mb-2 py-1 bg-white rounded-lg shadow-lg border z-10 min-w-[150px]">
                  {labels.map((label) => (
                    <button
                      key={label.id}
                      onClick={() => toggleLabel(label.id)}
                      className="w-full px-3 py-2 text-left text-sm hover:bg-gray-100 flex items-center gap-2"
                    >
                      <span
                        className={`w-4 h-4 rounded border ${
                          selectedLabelIds.includes(label.id)
                            ? 'bg-blue-500 border-blue-500'
                            : 'border-gray-300'
                        }`}
                      >
                        {selectedLabelIds.includes(label.id) && (
                          <span className="text-white text-xs">✓</span>
                        )}
                      </span>
                      {label.name}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Archive (edit mode only) */}
            {mode === 'edit' && (
              <button
                onClick={handleArchive}
                className="p-2 rounded-full hover:bg-gray-200"
                title="Archive"
              >
                <Archive className="w-5 h-5" />
              </button>
            )}

            {/* Delete (edit mode only) */}
            {mode === 'edit' && (
              <button
                onClick={handleDelete}
                className="p-2 rounded-full hover:bg-gray-200 text-red-500"
                title="Delete"
              >
                <Trash2 className="w-5 h-5" />
              </button>
            )}
          </div>

          {/* Save button */}
          <button
            onClick={handleSave}
            disabled={loading.action}
            className="px-4 py-2 bg-amber-500 text-white rounded-lg hover:bg-amber-600 disabled:opacity-50 font-medium"
          >
            {loading.action ? 'Saving...' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default NoteEditor;
