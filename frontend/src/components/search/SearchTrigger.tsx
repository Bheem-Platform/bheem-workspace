/**
 * Bheem Workspace - Search Trigger Component
 *
 * Button to open global search modal.
 * Phase 8: Search Enhancement
 */

import React from 'react';
import { Search } from 'lucide-react';
import { useSearchStore } from '@/stores/searchStore';

interface SearchTriggerProps {
  variant?: 'icon' | 'button' | 'input';
  className?: string;
}

export default function SearchTrigger({
  variant = 'button',
  className = '',
}: SearchTriggerProps) {
  const { openSearch } = useSearchStore();

  // Detect OS for keyboard shortcut display
  const [isMac, setIsMac] = React.useState(false);
  React.useEffect(() => {
    setIsMac(navigator.platform.toLowerCase().includes('mac'));
  }, []);

  if (variant === 'icon') {
    return (
      <button
        onClick={openSearch}
        className={`p-2 rounded-lg hover:bg-gray-100 transition-colors ${className}`}
        title={`Search (${isMac ? 'Cmd' : 'Ctrl'}+K)`}
      >
        <Search className="w-5 h-5 text-gray-600" />
      </button>
    );
  }

  if (variant === 'input') {
    return (
      <button
        onClick={openSearch}
        className={`flex items-center gap-2 px-4 py-2 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors w-full max-w-md ${className}`}
      >
        <Search className="w-4 h-4 text-gray-500" />
        <span className="text-gray-500 flex-1 text-left">Search...</span>
        <kbd className="hidden sm:inline-flex items-center gap-1 px-2 py-0.5 bg-white border rounded text-xs text-gray-400">
          {isMac ? '⌘' : 'Ctrl'}+K
        </kbd>
      </button>
    );
  }

  // Default button variant
  return (
    <button
      onClick={openSearch}
      className={`flex items-center gap-2 px-3 py-2 text-sm text-gray-600 rounded-lg hover:bg-gray-100 transition-colors ${className}`}
    >
      <Search className="w-4 h-4" />
      <span className="hidden sm:inline">Search</span>
      <kbd className="hidden md:inline-flex items-center gap-1 px-1.5 py-0.5 bg-gray-100 border rounded text-xs text-gray-400">
        {isMac ? '⌘' : 'Ctrl'}K
      </kbd>
    </button>
  );
}
