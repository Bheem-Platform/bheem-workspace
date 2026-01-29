/**
 * NotesSidebar Component
 *
 * Navigation sidebar for Notes showing views and labels.
 */

import React from 'react';
import {
  Lightbulb,
  Bell,
  Archive,
  Trash2,
  Tag,
  Plus,
  Edit2,
  X,
} from 'lucide-react';
import { useNotesStore } from '@/stores/notesStore';

export function NotesSidebar() {
  const {
    labels,
    counts,
    activeView,
    activeLabel,
    setActiveView,
    setActiveLabel,
    createLabel,
    updateLabel,
    deleteLabel,
    openLabelModal,
  } = useNotesStore();

  const [isAddingLabel, setIsAddingLabel] = React.useState(false);
  const [newLabelName, setNewLabelName] = React.useState('');
  const [editingLabelId, setEditingLabelId] = React.useState<string | null>(null);
  const [editingLabelName, setEditingLabelName] = React.useState('');

  const handleAddLabel = async () => {
    if (newLabelName.trim()) {
      await createLabel(newLabelName.trim());
      setNewLabelName('');
      setIsAddingLabel(false);
    }
  };

  const handleUpdateLabel = async (labelId: string) => {
    if (editingLabelName.trim()) {
      await updateLabel(labelId, editingLabelName.trim());
      setEditingLabelId(null);
      setEditingLabelName('');
    }
  };

  const handleDeleteLabel = async (labelId: string) => {
    if (confirm('Are you sure you want to delete this label?')) {
      await deleteLabel(labelId);
    }
  };

  const navItems = [
    { id: 'notes', label: 'Notes', icon: Lightbulb, count: counts?.active },
    { id: 'reminders', label: 'Reminders', icon: Bell },
    { id: 'archive', label: 'Archive', icon: Archive, count: counts?.archived },
    { id: 'trash', label: 'Trash', icon: Trash2, count: counts?.trashed },
  ];

  return (
    <div className="w-64 h-full bg-white border-r flex flex-col">
      {/* Main Navigation */}
      <nav className="p-2">
        {navItems.map((item) => (
          <button
            key={item.id}
            onClick={() => setActiveView(item.id as any)}
            className={`
              w-full flex items-center gap-3 px-4 py-2.5 rounded-full text-sm font-medium
              transition-colors
              ${
                activeView === item.id && !activeLabel
                  ? 'bg-amber-100 text-amber-900'
                  : 'text-gray-700 hover:bg-gray-100'
              }
            `}
          >
            <item.icon className="w-5 h-5" />
            <span className="flex-1 text-left">{item.label}</span>
            {item.count !== undefined && item.count > 0 && (
              <span className="text-xs text-gray-500">{item.count}</span>
            )}
          </button>
        ))}
      </nav>

      <hr className="my-2" />

      {/* Labels Section */}
      <div className="flex-1 overflow-auto">
        <div className="px-4 py-2 flex items-center justify-between">
          <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">
            Labels
          </span>
          <button
            onClick={() => setIsAddingLabel(true)}
            className="p-1 rounded hover:bg-gray-100"
            title="Create new label"
          >
            <Plus className="w-4 h-4 text-gray-500" />
          </button>
        </div>

        {/* Add label input */}
        {isAddingLabel && (
          <div className="px-2 py-1">
            <div className="flex items-center gap-1 px-2 py-1 bg-gray-100 rounded">
              <Tag className="w-4 h-4 text-gray-400" />
              <input
                type="text"
                value={newLabelName}
                onChange={(e) => setNewLabelName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleAddLabel();
                  if (e.key === 'Escape') setIsAddingLabel(false);
                }}
                placeholder="New label name"
                className="flex-1 bg-transparent text-sm outline-none"
                autoFocus
              />
              <button onClick={handleAddLabel} className="text-blue-600 text-sm">
                Save
              </button>
              <button
                onClick={() => setIsAddingLabel(false)}
                className="p-1 hover:bg-gray-200 rounded"
              >
                <X className="w-3 h-3" />
              </button>
            </div>
          </div>
        )}

        {/* Labels list */}
        <nav className="p-2">
          {labels.map((label) => (
            <div key={label.id} className="group relative">
              {editingLabelId === label.id ? (
                <div className="flex items-center gap-1 px-2 py-1 bg-gray-100 rounded">
                  <Tag className="w-4 h-4 text-gray-400" />
                  <input
                    type="text"
                    value={editingLabelName}
                    onChange={(e) => setEditingLabelName(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleUpdateLabel(label.id);
                      if (e.key === 'Escape') {
                        setEditingLabelId(null);
                        setEditingLabelName('');
                      }
                    }}
                    className="flex-1 bg-transparent text-sm outline-none"
                    autoFocus
                  />
                  <button
                    onClick={() => handleUpdateLabel(label.id)}
                    className="text-blue-600 text-sm"
                  >
                    Save
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => setActiveLabel(label.id)}
                  className={`
                    w-full flex items-center gap-3 px-4 py-2.5 rounded-full text-sm
                    transition-colors
                    ${
                      activeLabel === label.id
                        ? 'bg-amber-100 text-amber-900'
                        : 'text-gray-700 hover:bg-gray-100'
                    }
                  `}
                >
                  <Tag className="w-5 h-5" />
                  <span className="flex-1 text-left">{label.name}</span>

                  {/* Edit/Delete buttons on hover */}
                  <div className="hidden group-hover:flex items-center gap-1">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setEditingLabelId(label.id);
                        setEditingLabelName(label.name);
                      }}
                      className="p-1 hover:bg-gray-200 rounded"
                    >
                      <Edit2 className="w-3 h-3" />
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDeleteLabel(label.id);
                      }}
                      className="p-1 hover:bg-gray-200 rounded"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                </button>
              )}
            </div>
          ))}
        </nav>

        {labels.length === 0 && !isAddingLabel && (
          <div className="px-4 py-2 text-sm text-gray-500">
            No labels yet. Click + to create one.
          </div>
        )}
      </div>
    </div>
  );
}

export default NotesSidebar;
