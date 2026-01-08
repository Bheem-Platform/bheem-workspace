/**
 * Bheem Docs - Tiptap Editor Component
 * Rich text editor with full formatting support
 */
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Placeholder from '@tiptap/extension-placeholder';
import TextAlign from '@tiptap/extension-text-align';
import Underline from '@tiptap/extension-underline';
import { Link } from '@tiptap/extension-link';
import { Image } from '@tiptap/extension-image';
import { Table } from '@tiptap/extension-table';
import { TableRow } from '@tiptap/extension-table-row';
import { TableCell } from '@tiptap/extension-table-cell';
import { TableHeader } from '@tiptap/extension-table-header';
import { TaskList } from '@tiptap/extension-task-list';
import { TaskItem } from '@tiptap/extension-task-item';
import { Highlight } from '@tiptap/extension-highlight';
import { Color } from '@tiptap/extension-color';
import { TextStyle } from '@tiptap/extension-text-style';
import { FontFamily } from '@tiptap/extension-font-family';
import { Subscript } from '@tiptap/extension-subscript';
import { Superscript } from '@tiptap/extension-superscript';
import { useEffect, useState, useCallback } from 'react';
import EditorToolbar from './EditorToolbar';
import LinkModal from './LinkModal';
import ImageModal from './ImageModal';
import TableModal from './TableModal';

interface TiptapEditorProps {
  content?: any;
  onChange?: (content: any) => void;
  onSave?: (content: any) => void;
  placeholder?: string;
  editable?: boolean;
  autoSave?: boolean;
  autoSaveInterval?: number;
  className?: string;
}

export default function TiptapEditor({
  content,
  onChange,
  onSave,
  placeholder = 'Start typing...',
  editable = true,
  autoSave = true,
  autoSaveInterval = 30000,
  className = '',
}: TiptapEditorProps) {
  const [showLinkModal, setShowLinkModal] = useState(false);
  const [showImageModal, setShowImageModal] = useState(false);
  const [showTableModal, setShowTableModal] = useState(false);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [wordCount, setWordCount] = useState({ words: 0, characters: 0 });

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: {
          levels: [1, 2, 3, 4, 5, 6],
        },
      }),
      Placeholder.configure({
        placeholder,
      }),
      TextAlign.configure({
        types: ['heading', 'paragraph'],
      }),
      Underline,
      Link.configure({
        openOnClick: false,
        HTMLAttributes: {
          class: 'text-blue-600 underline cursor-pointer hover:text-blue-800',
        },
      }),
      Image.configure({
        inline: true,
        allowBase64: true,
        HTMLAttributes: {
          class: 'max-w-full rounded-lg',
        },
      }),
      Table.configure({
        resizable: true,
        HTMLAttributes: {
          class: 'border-collapse border border-gray-300',
        },
      }),
      TableRow,
      TableHeader.configure({
        HTMLAttributes: {
          class: 'border border-gray-300 bg-gray-100 p-2 font-semibold',
        },
      }),
      TableCell.configure({
        HTMLAttributes: {
          class: 'border border-gray-300 p-2',
        },
      }),
      TaskList.configure({
        HTMLAttributes: {
          class: 'list-none pl-0',
        },
      }),
      TaskItem.configure({
        nested: true,
        HTMLAttributes: {
          class: 'flex items-start gap-2',
        },
      }),
      Highlight.configure({
        multicolor: true,
      }),
      Color,
      TextStyle,
      FontFamily,
      Subscript,
      Superscript,
    ],
    content,
    editable,
    onUpdate: ({ editor }) => {
      const json = editor.getJSON();
      onChange?.(json);
      updateWordCount(editor);
    },
    editorProps: {
      attributes: {
        class: 'prose prose-lg max-w-none focus:outline-none min-h-[500px] px-8 py-6',
      },
    },
  });

  const updateWordCount = useCallback((editor: any) => {
    const text = editor.getText();
    const words = text.split(/\s+/).filter((word: string) => word.length > 0).length;
    const characters = text.length;
    setWordCount({ words, characters });
  }, []);

  // Auto-save functionality
  useEffect(() => {
    if (!autoSave || !editor || !onSave) return;

    const interval = setInterval(async () => {
      const json = editor.getJSON();
      setIsSaving(true);
      try {
        await onSave(json);
        setLastSaved(new Date());
      } catch (error) {
        console.error('Auto-save failed:', error);
      } finally {
        setIsSaving(false);
      }
    }, autoSaveInterval);

    return () => clearInterval(interval);
  }, [autoSave, autoSaveInterval, editor, onSave]);

  // Update content when prop changes
  useEffect(() => {
    if (editor && content && JSON.stringify(editor.getJSON()) !== JSON.stringify(content)) {
      editor.commands.setContent(content);
    }
  }, [content, editor]);

  const handleInsertLink = () => {
    setShowLinkModal(true);
  };

  const handleLinkSubmit = (url: string, text: string) => {
    if (!editor) return;

    if (text) {
      editor.chain().focus().insertContent(`<a href="${url}">${text}</a>`).run();
    } else {
      editor.chain().focus().setLink({ href: url }).run();
    }
    setShowLinkModal(false);
  };

  const handleInsertImage = () => {
    setShowImageModal(true);
  };

  const handleImageSubmit = (url: string, alt: string) => {
    if (!editor) return;
    editor.chain().focus().setImage({ src: url, alt }).run();
    setShowImageModal(false);
  };

  const handleInsertTable = () => {
    setShowTableModal(true);
  };

  const handleTableSubmit = (rows: number, cols: number) => {
    if (!editor) return;
    editor.chain().focus().insertTable({ rows, cols, withHeaderRow: true }).run();
    setShowTableModal(false);
  };

  const handleManualSave = async () => {
    if (!editor || !onSave) return;
    const json = editor.getJSON();
    setIsSaving(true);
    try {
      await onSave(json);
      setLastSaved(new Date());
    } catch (error) {
      console.error('Save failed:', error);
    } finally {
      setIsSaving(false);
    }
  };

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault();
        handleManualSave();
      }
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        handleInsertLink();
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [editor, onSave]);

  return (
    <div className={`flex flex-col bg-white rounded-lg shadow-sm border ${className}`}>
      {/* Toolbar */}
      {editable && (
        <EditorToolbar
          editor={editor}
          onInsertLink={handleInsertLink}
          onInsertImage={handleInsertImage}
          onInsertTable={handleInsertTable}
        />
      )}

      {/* Editor Content */}
      <div className="flex-1 overflow-auto">
        <EditorContent editor={editor} />
      </div>

      {/* Status Bar */}
      <div className="flex items-center justify-between px-4 py-2 border-t bg-gray-50 text-sm text-gray-500">
        <div className="flex items-center gap-4">
          <span>{wordCount.words} words</span>
          <span>{wordCount.characters} characters</span>
        </div>
        <div className="flex items-center gap-4">
          {isSaving && <span className="text-orange-500">Saving...</span>}
          {lastSaved && !isSaving && (
            <span>Last saved: {lastSaved.toLocaleTimeString()}</span>
          )}
          {editable && (
            <button
              onClick={handleManualSave}
              className="text-blue-600 hover:text-blue-800"
            >
              Save now (Ctrl+S)
            </button>
          )}
        </div>
      </div>

      {/* Modals */}
      {showLinkModal && (
        <LinkModal
          onSubmit={handleLinkSubmit}
          onClose={() => setShowLinkModal(false)}
          initialUrl={editor?.getAttributes('link').href || ''}
        />
      )}
      {showImageModal && (
        <ImageModal
          onSubmit={handleImageSubmit}
          onClose={() => setShowImageModal(false)}
        />
      )}
      {showTableModal && (
        <TableModal
          onSubmit={handleTableSubmit}
          onClose={() => setShowTableModal(false)}
        />
      )}
    </div>
  );
}
