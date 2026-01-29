/**
 * NoteCard Component
 *
 * Displays a single note in a card format for the grid/list view.
 */

import React from 'react';
import {
  Pin,
  Archive,
  Trash2,
  MoreVertical,
  Bell,
  Palette,
  Copy,
  Tag,
  CheckSquare,
  Square,
} from 'lucide-react';
import type { Note } from '@/lib/notesApi';
import { NOTE_COLORS, NoteColorKey } from '@/lib/notesApi';
import { useNotesStore } from '@/stores/notesStore';

interface NoteCardProps {
  note: Note;
  isSelected?: boolean;
  viewMode?: 'grid' | 'list';
}

export function NoteCard({ note, isSelected, viewMode = 'grid' }: NoteCardProps) {
  const {
    togglePin,
    archiveNote,
    deleteNote,
    changeColor,
    copyNote,
    openEditModal,
    toggleNoteSelection,
  } = useNotesStore();

  const [showMenu, setShowMenu] = React.useState(false);
  const [showColorPicker, setShowColorPicker] = React.useState(false);

  const colorKey = (note.color || 'default') as NoteColorKey;
  const bgColor = NOTE_COLORS[colorKey]?.value || NOTE_COLORS.default.value;

  const handleCardClick = () => {
    openEditModal(note);
  };

  const handleCheckboxChange = (e: React.MouseEvent) => {
    e.stopPropagation();
    toggleNoteSelection(note.id);
  };

  const handlePin = async (e: React.MouseEvent) => {
    e.stopPropagation();
    await togglePin(note.id);
  };

  const handleArchive = async (e: React.MouseEvent) => {
    e.stopPropagation();
    await archiveNote(note.id);
  };

  const handleDelete = async (e: React.MouseEvent) => {
    e.stopPropagation();
    await deleteNote(note.id);
  };

  const handleColorChange = async (color: string) => {
    await changeColor(note.id, color);
    setShowColorPicker(false);
  };

  const handleCopy = async (e: React.MouseEvent) => {
    e.stopPropagation();
    await copyNote(note.id);
    setShowMenu(false);
  };

  // Render checklist preview
  const renderChecklistPreview = () => {
    if (!note.is_checklist || !note.checklist_items) return null;

    const items = note.checklist_items.slice(0, 3);
    const remaining = note.checklist_items.length - 3;

    return (
      <div className="mt-2 space-y-1">
        {items.map((item: any) => (
          <div key={item.id} className="flex items-center gap-2 text-sm">
            {item.is_checked ? (
              <CheckSquare className="w-4 h-4 text-gray-400" />
            ) : (
              <Square className="w-4 h-4 text-gray-400" />
            )}
            <span className={item.is_checked ? 'line-through text-gray-400' : ''}>
              {item.text}
            </span>
          </div>
        ))}
        {remaining > 0 && (
          <div className="text-xs text-gray-500">+{remaining} more items</div>
        )}
      </div>
    );
  };

  return (
    <div
      onClick={handleCardClick}
      className={`
        group relative rounded-lg border cursor-pointer transition-all duration-200
        ${viewMode === 'grid' ? 'p-4' : 'p-3 flex items-start gap-4'}
        ${isSelected ? 'ring-2 ring-blue-500' : 'hover:shadow-md'}
      `}
      style={{ backgroundColor: bgColor }}
    >
      {/* Selection checkbox */}
      <div
        className={`
          absolute top-2 left-2 opacity-0 group-hover:opacity-100 transition-opacity
          ${isSelected ? 'opacity-100' : ''}
        `}
        onClick={handleCheckboxChange}
      >
        <div
          className={`
            w-5 h-5 rounded border-2 flex items-center justify-center
            ${isSelected ? 'bg-blue-500 border-blue-500' : 'border-gray-400 bg-white'}
          `}
        >
          {isSelected && <span className="text-white text-xs">✓</span>}
        </div>
      </div>

      {/* Pin indicator */}
      {note.is_pinned && (
        <div className="absolute top-2 right-2">
          <Pin className="w-4 h-4 text-gray-600 fill-current" />
        </div>
      )}

      {/* Content */}
      <div className={viewMode === 'list' ? 'flex-1' : ''}>
        {note.title && (
          <h3 className="font-medium text-gray-900 mb-1 line-clamp-1">
            {note.title}
          </h3>
        )}

        {note.is_checklist ? (
          renderChecklistPreview()
        ) : note.content ? (
          <p className="text-sm text-gray-700 line-clamp-3 whitespace-pre-wrap">
            {note.content}
          </p>
        ) : null}

        {/* Labels */}
        {note.labels && note.labels.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-3">
            {note.labels.map((label) => (
              <span
                key={label.id}
                className="px-2 py-0.5 text-xs rounded-full bg-gray-200 text-gray-700"
              >
                {label.name}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Action buttons - shown on hover */}
      <div className="absolute bottom-2 left-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1">
            {/* Pin button */}
            <button
              onClick={handlePin}
              className="p-1.5 rounded-full hover:bg-gray-200 transition-colors"
              title={note.is_pinned ? 'Unpin' : 'Pin'}
            >
              <Pin className={`w-4 h-4 ${note.is_pinned ? 'fill-current' : ''}`} />
            </button>

            {/* Reminder button */}
            <button
              onClick={(e) => {
                e.stopPropagation();
                // TODO: Open reminder modal
              }}
              className="p-1.5 rounded-full hover:bg-gray-200 transition-colors"
              title="Set reminder"
            >
              <Bell className="w-4 h-4" />
            </button>

            {/* Color picker */}
            <div className="relative">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setShowColorPicker(!showColorPicker);
                }}
                className="p-1.5 rounded-full hover:bg-gray-200 transition-colors"
                title="Change color"
              >
                <Palette className="w-4 h-4" />
              </button>

              {showColorPicker && (
                <div
                  className="absolute bottom-full left-0 mb-2 p-2 bg-white rounded-lg shadow-lg border z-10"
                  onClick={(e) => e.stopPropagation()}
                >
                  <div className="grid grid-cols-4 gap-1">
                    {Object.entries(NOTE_COLORS).map(([key, { value, name }]) => (
                      <button
                        key={key}
                        onClick={() => handleColorChange(key)}
                        className={`
                          w-6 h-6 rounded-full border-2 transition-transform hover:scale-110
                          ${note.color === key ? 'border-gray-800' : 'border-transparent'}
                        `}
                        style={{ backgroundColor: value }}
                        title={name}
                      />
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Archive button */}
            <button
              onClick={handleArchive}
              className="p-1.5 rounded-full hover:bg-gray-200 transition-colors"
              title="Archive"
            >
              <Archive className="w-4 h-4" />
            </button>
          </div>

          {/* More menu */}
          <div className="relative">
            <button
              onClick={(e) => {
                e.stopPropagation();
                setShowMenu(!showMenu);
              }}
              className="p-1.5 rounded-full hover:bg-gray-200 transition-colors"
            >
              <MoreVertical className="w-4 h-4" />
            </button>

            {showMenu && (
              <div
                className="absolute bottom-full right-0 mb-2 py-1 bg-white rounded-lg shadow-lg border z-10 min-w-[150px]"
                onClick={(e) => e.stopPropagation()}
              >
                <button
                  onClick={handleCopy}
                  className="w-full px-3 py-2 text-left text-sm hover:bg-gray-100 flex items-center gap-2"
                >
                  <Copy className="w-4 h-4" />
                  Make a copy
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    // TODO: Open label modal
                    setShowMenu(false);
                  }}
                  className="w-full px-3 py-2 text-left text-sm hover:bg-gray-100 flex items-center gap-2"
                >
                  <Tag className="w-4 h-4" />
                  Add label
                </button>
                <hr className="my-1" />
                <button
                  onClick={handleDelete}
                  className="w-full px-3 py-2 text-left text-sm hover:bg-gray-100 flex items-center gap-2 text-red-600"
                >
                  <Trash2 className="w-4 h-4" />
                  Delete
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default NoteCard;
