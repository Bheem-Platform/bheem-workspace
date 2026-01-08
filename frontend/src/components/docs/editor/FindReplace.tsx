/**
 * Bheem Docs - Find and Replace Component
 */
import { useState, useEffect, useCallback } from 'react';
import { Search, Replace, X, ChevronUp, ChevronDown, CaseSensitive, WholeWord } from 'lucide-react';
import { Editor } from '@tiptap/react';

interface FindReplaceProps {
  editor: Editor | null;
  onClose: () => void;
}

export default function FindReplace({ editor, onClose }: FindReplaceProps) {
  const [findText, setFindText] = useState('');
  const [replaceText, setReplaceText] = useState('');
  const [showReplace, setShowReplace] = useState(false);
  const [caseSensitive, setCaseSensitive] = useState(false);
  const [wholeWord, setWholeWord] = useState(false);
  const [matchCount, setMatchCount] = useState(0);
  const [currentMatch, setCurrentMatch] = useState(0);
  const [matches, setMatches] = useState<{ from: number; to: number }[]>([]);

  const findMatches = useCallback(() => {
    if (!editor || !findText) {
      setMatches([]);
      setMatchCount(0);
      setCurrentMatch(0);
      return;
    }

    const content = editor.getText();
    const searchText = caseSensitive ? findText : findText.toLowerCase();
    const textToSearch = caseSensitive ? content : content.toLowerCase();

    const foundMatches: { from: number; to: number }[] = [];
    let index = 0;

    while (true) {
      const pos = textToSearch.indexOf(searchText, index);
      if (pos === -1) break;

      // Check whole word if enabled
      if (wholeWord) {
        const before = pos > 0 ? textToSearch[pos - 1] : ' ';
        const after = pos + searchText.length < textToSearch.length
          ? textToSearch[pos + searchText.length]
          : ' ';
        if (/\w/.test(before) || /\w/.test(after)) {
          index = pos + 1;
          continue;
        }
      }

      foundMatches.push({ from: pos, to: pos + findText.length });
      index = pos + 1;
    }

    setMatches(foundMatches);
    setMatchCount(foundMatches.length);
    if (foundMatches.length > 0 && currentMatch === 0) {
      setCurrentMatch(1);
    }
  }, [editor, findText, caseSensitive, wholeWord, currentMatch]);

  useEffect(() => {
    findMatches();
  }, [findMatches]);

  const goToMatch = (direction: 'next' | 'prev') => {
    if (matchCount === 0) return;

    let newMatch = direction === 'next' ? currentMatch + 1 : currentMatch - 1;
    if (newMatch > matchCount) newMatch = 1;
    if (newMatch < 1) newMatch = matchCount;
    setCurrentMatch(newMatch);

    // Scroll to match position (simplified - in real impl would use editor's scrollIntoView)
    const match = matches[newMatch - 1];
    if (match && editor) {
      editor.chain().focus().setTextSelection(match).run();
    }
  };

  const handleReplace = () => {
    if (!editor || matchCount === 0 || !matches[currentMatch - 1]) return;

    const match = matches[currentMatch - 1];
    editor
      .chain()
      .focus()
      .setTextSelection(match)
      .deleteSelection()
      .insertContent(replaceText)
      .run();

    findMatches();
  };

  const handleReplaceAll = () => {
    if (!editor || matchCount === 0) return;

    // Replace from end to start to maintain positions
    const sortedMatches = [...matches].sort((a, b) => b.from - a.from);

    editor.chain().focus();

    for (const match of sortedMatches) {
      editor
        .chain()
        .setTextSelection(match)
        .deleteSelection()
        .insertContent(replaceText)
        .run();
    }

    findMatches();
  };

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      } else if (e.key === 'Enter') {
        if (e.shiftKey) {
          goToMatch('prev');
        } else {
          goToMatch('next');
        }
      } else if ((e.ctrlKey || e.metaKey) && e.key === 'h') {
        e.preventDefault();
        setShowReplace(!showReplace);
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [onClose, showReplace, matchCount]);

  return (
    <div className="absolute top-16 right-4 bg-white border rounded-xl shadow-xl z-50 w-96">
      {/* Find section */}
      <div className="p-3 border-b">
        <div className="flex items-center gap-2">
          <div className="flex-1 relative">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              value={findText}
              onChange={(e) => setFindText(e.target.value)}
              placeholder="Find in document..."
              className="w-full pl-9 pr-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
              autoFocus
            />
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setCaseSensitive(!caseSensitive)}
              className={`p-2 rounded hover:bg-gray-100 ${
                caseSensitive ? 'bg-blue-100 text-blue-600' : 'text-gray-400'
              }`}
              title="Case sensitive"
            >
              <CaseSensitive size={16} />
            </button>
            <button
              onClick={() => setWholeWord(!wholeWord)}
              className={`p-2 rounded hover:bg-gray-100 ${
                wholeWord ? 'bg-blue-100 text-blue-600' : 'text-gray-400'
              }`}
              title="Whole word"
            >
              <WholeWord size={16} />
            </button>
          </div>
        </div>

        {/* Match navigation */}
        <div className="flex items-center justify-between mt-2">
          <span className="text-xs text-gray-500">
            {matchCount > 0 ? `${currentMatch} of ${matchCount} matches` : 'No matches'}
          </span>
          <div className="flex items-center gap-1">
            <button
              onClick={() => goToMatch('prev')}
              disabled={matchCount === 0}
              className="p-1.5 hover:bg-gray-100 rounded disabled:opacity-50"
              title="Previous (Shift+Enter)"
            >
              <ChevronUp size={16} />
            </button>
            <button
              onClick={() => goToMatch('next')}
              disabled={matchCount === 0}
              className="p-1.5 hover:bg-gray-100 rounded disabled:opacity-50"
              title="Next (Enter)"
            >
              <ChevronDown size={16} />
            </button>
            <button
              onClick={() => setShowReplace(!showReplace)}
              className={`p-1.5 rounded hover:bg-gray-100 ${showReplace ? 'bg-blue-100' : ''}`}
              title="Replace (Ctrl+H)"
            >
              <Replace size={16} />
            </button>
            <button onClick={onClose} className="p-1.5 hover:bg-gray-100 rounded" title="Close (Esc)">
              <X size={16} />
            </button>
          </div>
        </div>
      </div>

      {/* Replace section */}
      {showReplace && (
        <div className="p-3 bg-gray-50">
          <div className="flex items-center gap-2">
            <div className="flex-1 relative">
              <Replace size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                value={replaceText}
                onChange={(e) => setReplaceText(e.target.value)}
                placeholder="Replace with..."
                className="w-full pl-9 pr-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>
          <div className="flex gap-2 mt-2">
            <button
              onClick={handleReplace}
              disabled={matchCount === 0}
              className="flex-1 py-1.5 text-sm text-blue-600 bg-blue-100 hover:bg-blue-200 rounded-lg disabled:opacity-50"
            >
              Replace
            </button>
            <button
              onClick={handleReplaceAll}
              disabled={matchCount === 0}
              className="flex-1 py-1.5 text-sm text-white bg-blue-600 hover:bg-blue-700 rounded-lg disabled:opacity-50"
            >
              Replace All
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
