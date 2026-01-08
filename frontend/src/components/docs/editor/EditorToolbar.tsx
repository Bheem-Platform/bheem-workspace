/**
 * Bheem Docs - Editor Toolbar
 * Google Docs-like formatting toolbar with all formatting options
 */
import { Editor } from '@tiptap/react';
import {
  Bold,
  Italic,
  Underline,
  Strikethrough,
  Code,
  Heading1,
  Heading2,
  Heading3,
  List,
  ListOrdered,
  CheckSquare,
  AlignLeft,
  AlignCenter,
  AlignRight,
  AlignJustify,
  Link,
  Image,
  Table,
  Quote,
  Minus,
  Undo,
  Redo,
  Highlighter,
  Subscript,
  Superscript,
  RemoveFormatting,
  Pilcrow,
  ChevronDown,
  Type,
  Palette,
} from 'lucide-react';
import { useState, useRef, useEffect } from 'react';

interface EditorToolbarProps {
  editor: Editor | null;
  onInsertImage?: () => void;
  onInsertLink?: () => void;
  onInsertTable?: () => void;
}

const FONT_FAMILIES = [
  { label: 'Default', value: 'Inter, sans-serif' },
  { label: 'Arial', value: 'Arial, sans-serif' },
  { label: 'Times New Roman', value: 'Times New Roman, serif' },
  { label: 'Georgia', value: 'Georgia, serif' },
  { label: 'Courier New', value: 'Courier New, monospace' },
  { label: 'Verdana', value: 'Verdana, sans-serif' },
  { label: 'Trebuchet MS', value: 'Trebuchet MS, sans-serif' },
  { label: 'Comic Sans MS', value: 'Comic Sans MS, cursive' },
];

const FONT_SIZES = ['10', '11', '12', '14', '16', '18', '20', '24', '28', '32', '36', '48', '72'];

const COLORS = [
  '#000000', '#434343', '#666666', '#999999', '#b7b7b7', '#cccccc', '#d9d9d9', '#efefef', '#f3f3f3', '#ffffff',
  '#980000', '#ff0000', '#ff9900', '#ffff00', '#00ff00', '#00ffff', '#4a86e8', '#0000ff', '#9900ff', '#ff00ff',
  '#e6b8af', '#f4cccc', '#fce5cd', '#fff2cc', '#d9ead3', '#d0e0e3', '#c9daf8', '#cfe2f3', '#d9d2e9', '#ead1dc',
];

export default function EditorToolbar({ editor, onInsertImage, onInsertLink, onInsertTable }: EditorToolbarProps) {
  const [showFontFamily, setShowFontFamily] = useState(false);
  const [showFontSize, setShowFontSize] = useState(false);
  const [showTextColor, setShowTextColor] = useState(false);
  const [showHighlightColor, setShowHighlightColor] = useState(false);
  const [showHeadingMenu, setShowHeadingMenu] = useState(false);

  const fontFamilyRef = useRef<HTMLDivElement>(null);
  const fontSizeRef = useRef<HTMLDivElement>(null);
  const textColorRef = useRef<HTMLDivElement>(null);
  const highlightRef = useRef<HTMLDivElement>(null);
  const headingRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (fontFamilyRef.current && !fontFamilyRef.current.contains(e.target as Node)) setShowFontFamily(false);
      if (fontSizeRef.current && !fontSizeRef.current.contains(e.target as Node)) setShowFontSize(false);
      if (textColorRef.current && !textColorRef.current.contains(e.target as Node)) setShowTextColor(false);
      if (highlightRef.current && !highlightRef.current.contains(e.target as Node)) setShowHighlightColor(false);
      if (headingRef.current && !headingRef.current.contains(e.target as Node)) setShowHeadingMenu(false);
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  if (!editor) return null;

  const ToolbarButton = ({
    onClick,
    isActive,
    disabled,
    title,
    children,
  }: {
    onClick: () => void;
    isActive?: boolean;
    disabled?: boolean;
    title: string;
    children: React.ReactNode;
  }) => (
    <button
      onClick={onClick}
      disabled={disabled}
      title={title}
      className={`p-1.5 rounded hover:bg-gray-100 transition-colors ${
        isActive ? 'bg-blue-100 text-blue-600' : 'text-gray-600'
      } ${disabled ? 'opacity-40 cursor-not-allowed' : ''}`}
    >
      {children}
    </button>
  );

  const Divider = () => <div className="w-px h-6 bg-gray-200 mx-1" />;

  const getCurrentHeading = () => {
    if (editor.isActive('heading', { level: 1 })) return 'Heading 1';
    if (editor.isActive('heading', { level: 2 })) return 'Heading 2';
    if (editor.isActive('heading', { level: 3 })) return 'Heading 3';
    if (editor.isActive('heading', { level: 4 })) return 'Heading 4';
    if (editor.isActive('heading', { level: 5 })) return 'Heading 5';
    if (editor.isActive('heading', { level: 6 })) return 'Heading 6';
    return 'Normal text';
  };

  return (
    <div className="flex items-center gap-0.5 px-3 py-2 border-b bg-gray-50 flex-wrap">
      {/* Undo/Redo */}
      <ToolbarButton
        onClick={() => editor.chain().focus().undo().run()}
        disabled={!editor.can().undo()}
        title="Undo (Ctrl+Z)"
      >
        <Undo size={18} />
      </ToolbarButton>
      <ToolbarButton
        onClick={() => editor.chain().focus().redo().run()}
        disabled={!editor.can().redo()}
        title="Redo (Ctrl+Y)"
      >
        <Redo size={18} />
      </ToolbarButton>

      <Divider />

      {/* Heading/Paragraph Selector */}
      <div ref={headingRef} className="relative">
        <button
          onClick={() => setShowHeadingMenu(!showHeadingMenu)}
          className="flex items-center gap-1 px-2 py-1 text-sm text-gray-700 hover:bg-gray-100 rounded min-w-[120px]"
        >
          <Pilcrow size={16} />
          <span className="truncate">{getCurrentHeading()}</span>
          <ChevronDown size={14} />
        </button>
        {showHeadingMenu && (
          <div className="absolute top-full left-0 mt-1 bg-white border rounded-lg shadow-lg py-1 z-50 min-w-[150px]">
            <button
              onClick={() => { editor.chain().focus().setParagraph().run(); setShowHeadingMenu(false); }}
              className={`w-full px-3 py-1.5 text-left text-sm hover:bg-gray-100 ${editor.isActive('paragraph') ? 'bg-blue-50' : ''}`}
            >
              Normal text
            </button>
            {[1, 2, 3, 4, 5, 6].map((level) => (
              <button
                key={level}
                onClick={() => { editor.chain().focus().toggleHeading({ level: level as 1|2|3|4|5|6 }).run(); setShowHeadingMenu(false); }}
                className={`w-full px-3 py-1.5 text-left hover:bg-gray-100 ${editor.isActive('heading', { level }) ? 'bg-blue-50' : ''}`}
                style={{ fontSize: `${20 - level * 2}px`, fontWeight: 600 }}
              >
                Heading {level}
              </button>
            ))}
          </div>
        )}
      </div>

      <Divider />

      {/* Font Family */}
      <div ref={fontFamilyRef} className="relative">
        <button
          onClick={() => setShowFontFamily(!showFontFamily)}
          className="flex items-center gap-1 px-2 py-1 text-sm text-gray-700 hover:bg-gray-100 rounded min-w-[100px]"
        >
          <Type size={16} />
          <span className="truncate">Font</span>
          <ChevronDown size={14} />
        </button>
        {showFontFamily && (
          <div className="absolute top-full left-0 mt-1 bg-white border rounded-lg shadow-lg py-1 z-50 max-h-60 overflow-y-auto">
            {FONT_FAMILIES.map((font) => (
              <button
                key={font.value}
                onClick={() => { editor.chain().focus().setFontFamily(font.value).run(); setShowFontFamily(false); }}
                className="w-full px-3 py-1.5 text-left text-sm hover:bg-gray-100"
                style={{ fontFamily: font.value }}
              >
                {font.label}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Font Size */}
      <div ref={fontSizeRef} className="relative">
        <button
          onClick={() => setShowFontSize(!showFontSize)}
          className="flex items-center gap-1 px-2 py-1 text-sm text-gray-700 hover:bg-gray-100 rounded w-16"
        >
          <span>12</span>
          <ChevronDown size={14} />
        </button>
        {showFontSize && (
          <div className="absolute top-full left-0 mt-1 bg-white border rounded-lg shadow-lg py-1 z-50 max-h-60 overflow-y-auto">
            {FONT_SIZES.map((size) => (
              <button
                key={size}
                onClick={() => { editor.chain().focus().setMark('textStyle', { fontSize: `${size}px` }).run(); setShowFontSize(false); }}
                className="w-full px-3 py-1.5 text-left text-sm hover:bg-gray-100"
              >
                {size}
              </button>
            ))}
          </div>
        )}
      </div>

      <Divider />

      {/* Basic Formatting */}
      <ToolbarButton
        onClick={() => editor.chain().focus().toggleBold().run()}
        isActive={editor.isActive('bold')}
        title="Bold (Ctrl+B)"
      >
        <Bold size={18} />
      </ToolbarButton>
      <ToolbarButton
        onClick={() => editor.chain().focus().toggleItalic().run()}
        isActive={editor.isActive('italic')}
        title="Italic (Ctrl+I)"
      >
        <Italic size={18} />
      </ToolbarButton>
      <ToolbarButton
        onClick={() => editor.chain().focus().toggleUnderline().run()}
        isActive={editor.isActive('underline')}
        title="Underline (Ctrl+U)"
      >
        <Underline size={18} />
      </ToolbarButton>
      <ToolbarButton
        onClick={() => editor.chain().focus().toggleStrike().run()}
        isActive={editor.isActive('strike')}
        title="Strikethrough"
      >
        <Strikethrough size={18} />
      </ToolbarButton>

      <Divider />

      {/* Text Color */}
      <div ref={textColorRef} className="relative">
        <button
          onClick={() => setShowTextColor(!showTextColor)}
          className="p-1.5 rounded hover:bg-gray-100 text-gray-600"
          title="Text color"
        >
          <div className="flex flex-col items-center">
            <Type size={16} />
            <div className="w-4 h-1 bg-black mt-0.5 rounded" />
          </div>
        </button>
        {showTextColor && (
          <div className="absolute top-full left-0 mt-1 bg-white border rounded-lg shadow-lg p-2 z-50">
            <div className="grid grid-cols-10 gap-1">
              {COLORS.map((color) => (
                <button
                  key={color}
                  onClick={() => { editor.chain().focus().setColor(color).run(); setShowTextColor(false); }}
                  className="w-5 h-5 rounded border border-gray-200 hover:scale-110 transition-transform"
                  style={{ backgroundColor: color }}
                  title={color}
                />
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Highlight Color */}
      <div ref={highlightRef} className="relative">
        <button
          onClick={() => setShowHighlightColor(!showHighlightColor)}
          className="p-1.5 rounded hover:bg-gray-100 text-gray-600"
          title="Highlight color"
        >
          <Highlighter size={18} />
        </button>
        {showHighlightColor && (
          <div className="absolute top-full left-0 mt-1 bg-white border rounded-lg shadow-lg p-2 z-50">
            <div className="grid grid-cols-10 gap-1">
              {COLORS.map((color) => (
                <button
                  key={color}
                  onClick={() => { editor.chain().focus().toggleHighlight({ color }).run(); setShowHighlightColor(false); }}
                  className="w-5 h-5 rounded border border-gray-200 hover:scale-110 transition-transform"
                  style={{ backgroundColor: color }}
                  title={color}
                />
              ))}
            </div>
          </div>
        )}
      </div>

      <Divider />

      {/* Subscript/Superscript */}
      <ToolbarButton
        onClick={() => editor.chain().focus().toggleSubscript().run()}
        isActive={editor.isActive('subscript')}
        title="Subscript"
      >
        <Subscript size={18} />
      </ToolbarButton>
      <ToolbarButton
        onClick={() => editor.chain().focus().toggleSuperscript().run()}
        isActive={editor.isActive('superscript')}
        title="Superscript"
      >
        <Superscript size={18} />
      </ToolbarButton>

      <Divider />

      {/* Lists */}
      <ToolbarButton
        onClick={() => editor.chain().focus().toggleBulletList().run()}
        isActive={editor.isActive('bulletList')}
        title="Bullet list"
      >
        <List size={18} />
      </ToolbarButton>
      <ToolbarButton
        onClick={() => editor.chain().focus().toggleOrderedList().run()}
        isActive={editor.isActive('orderedList')}
        title="Numbered list"
      >
        <ListOrdered size={18} />
      </ToolbarButton>
      <ToolbarButton
        onClick={() => editor.chain().focus().toggleTaskList().run()}
        isActive={editor.isActive('taskList')}
        title="Checklist"
      >
        <CheckSquare size={18} />
      </ToolbarButton>

      <Divider />

      {/* Alignment */}
      <ToolbarButton
        onClick={() => editor.chain().focus().setTextAlign('left').run()}
        isActive={editor.isActive({ textAlign: 'left' })}
        title="Align left"
      >
        <AlignLeft size={18} />
      </ToolbarButton>
      <ToolbarButton
        onClick={() => editor.chain().focus().setTextAlign('center').run()}
        isActive={editor.isActive({ textAlign: 'center' })}
        title="Align center"
      >
        <AlignCenter size={18} />
      </ToolbarButton>
      <ToolbarButton
        onClick={() => editor.chain().focus().setTextAlign('right').run()}
        isActive={editor.isActive({ textAlign: 'right' })}
        title="Align right"
      >
        <AlignRight size={18} />
      </ToolbarButton>
      <ToolbarButton
        onClick={() => editor.chain().focus().setTextAlign('justify').run()}
        isActive={editor.isActive({ textAlign: 'justify' })}
        title="Justify"
      >
        <AlignJustify size={18} />
      </ToolbarButton>

      <Divider />

      {/* Insert Elements */}
      <ToolbarButton
        onClick={() => onInsertLink?.()}
        isActive={editor.isActive('link')}
        title="Insert link (Ctrl+K)"
      >
        <Link size={18} />
      </ToolbarButton>
      <ToolbarButton
        onClick={() => onInsertImage?.()}
        title="Insert image"
      >
        <Image size={18} />
      </ToolbarButton>
      <ToolbarButton
        onClick={() => onInsertTable?.()}
        title="Insert table"
      >
        <Table size={18} />
      </ToolbarButton>

      <Divider />

      {/* Block Elements */}
      <ToolbarButton
        onClick={() => editor.chain().focus().toggleBlockquote().run()}
        isActive={editor.isActive('blockquote')}
        title="Block quote"
      >
        <Quote size={18} />
      </ToolbarButton>
      <ToolbarButton
        onClick={() => editor.chain().focus().toggleCodeBlock().run()}
        isActive={editor.isActive('codeBlock')}
        title="Code block"
      >
        <Code size={18} />
      </ToolbarButton>
      <ToolbarButton
        onClick={() => editor.chain().focus().setHorizontalRule().run()}
        title="Horizontal rule"
      >
        <Minus size={18} />
      </ToolbarButton>

      <Divider />

      {/* Clear Formatting */}
      <ToolbarButton
        onClick={() => editor.chain().focus().clearNodes().unsetAllMarks().run()}
        title="Clear formatting"
      >
        <RemoveFormatting size={18} />
      </ToolbarButton>
    </div>
  );
}
