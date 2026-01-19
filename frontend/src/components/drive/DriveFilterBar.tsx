/**
 * Bheem Drive - Filter Bar
 * Filters: Type, People, Modified, Location
 */
import { useState, useRef, useEffect } from 'react';
import {
  ChevronDown,
  X,
  FileText,
  Image,
  Film,
  Music,
  Archive,
  FileSpreadsheet,
  Presentation,
  Folder,
  File,
  Calendar,
  MapPin,
  Users,
  Check,
  LucideIcon,
} from 'lucide-react';

interface FilterOption {
  id: string;
  label: string;
  icon?: LucideIcon;
  color?: string;
}

interface DriveFilterBarProps {
  onFilterChange: (filters: FilterState) => void;
  activeFilters: FilterState;
}

export interface FilterState {
  type: string | null;
  people: string | null;
  modified: string | null;
  location: string | null;
}

const typeOptions: FilterOption[] = [
  { id: 'all', label: 'Any type' },
  { id: 'folder', label: 'Folders', icon: Folder, color: 'text-gray-500' },
  { id: 'document', label: 'Documents', icon: FileText, color: 'text-blue-500' },
  { id: 'spreadsheet', label: 'Spreadsheets', icon: FileSpreadsheet, color: 'text-green-500' },
  { id: 'presentation', label: 'Presentations', icon: Presentation, color: 'text-yellow-500' },
  { id: 'pdf', label: 'PDFs', icon: File, color: 'text-red-500' },
  { id: 'image', label: 'Photos & images', icon: Image, color: 'text-pink-500' },
  { id: 'video', label: 'Videos', icon: Film, color: 'text-purple-500' },
  { id: 'audio', label: 'Audio', icon: Music, color: 'text-orange-500' },
  { id: 'archive', label: 'Archives', icon: Archive, color: 'text-gray-600' },
];

const modifiedOptions: FilterOption[] = [
  { id: 'all', label: 'Any time' },
  { id: 'today', label: 'Today' },
  { id: 'yesterday', label: 'Yesterday' },
  { id: 'week', label: 'Last 7 days' },
  { id: 'month', label: 'Last 30 days' },
  { id: 'year', label: 'This year' },
  { id: 'custom', label: 'Custom range...' },
];

const locationOptions: FilterOption[] = [
  { id: 'all', label: 'Anywhere' },
  { id: 'my-drive', label: 'My Drive' },
  { id: 'shared-with-me', label: 'Shared with me' },
  { id: 'starred', label: 'Starred' },
  { id: 'trash', label: 'Trash' },
];

interface FilterDropdownProps {
  label: string;
  icon: LucideIcon;
  options: FilterOption[];
  value: string | null;
  onChange: (value: string | null) => void;
  showUserSearch?: boolean;
}

function FilterDropdown({
  label,
  icon: Icon,
  options,
  value,
  onChange,
  showUserSearch = false,
}: FilterDropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const selectedOption = options.find((o) => o.id === value);
  const hasActiveFilter = value && value !== 'all';

  return (
    <div ref={dropdownRef} className="relative flex items-center gap-1">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`flex items-center gap-2 px-3 py-2 rounded-lg border transition-colors ${
          hasActiveFilter
            ? 'bg-blue-50 border-blue-200 text-blue-700'
            : 'border-gray-200 text-gray-700 hover:bg-gray-50'
        }`}
      >
        <Icon size={16} className={hasActiveFilter ? 'text-blue-600' : 'text-gray-500'} />
        <span className="text-sm font-medium">
          {hasActiveFilter ? selectedOption?.label : label}
        </span>
        <ChevronDown
          size={14}
          className={`transition-transform ${isOpen ? 'rotate-180' : ''} ${
            hasActiveFilter ? 'text-blue-600' : 'text-gray-400'
          }`}
        />
      </button>
      {hasActiveFilter && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            onChange(null);
          }}
          className="p-1 hover:bg-blue-100 rounded text-blue-600"
          title="Clear filter"
        >
          <X size={14} />
        </button>
      )}

      {isOpen && (
        <div className="absolute left-0 top-full mt-1 w-56 bg-white rounded-xl shadow-lg border border-gray-200 py-2 z-30">
          {showUserSearch && (
            <div className="px-3 pb-2 mb-2 border-b border-gray-100">
              <input
                type="text"
                placeholder="Search people..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          )}

          <div className="max-h-64 overflow-y-auto">
            {options.map((option) => {
              const OptionIcon = option.icon;
              const isSelected = value === option.id || (!value && option.id === 'all');

              return (
                <button
                  key={option.id}
                  onClick={() => {
                    onChange(option.id === 'all' ? null : option.id);
                    setIsOpen(false);
                  }}
                  className={`w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors ${
                    isSelected ? 'bg-blue-50 text-blue-700' : 'text-gray-700 hover:bg-gray-50'
                  }`}
                >
                  {OptionIcon && (
                    <OptionIcon
                      size={18}
                      className={option.color || (isSelected ? 'text-blue-600' : 'text-gray-400')}
                    />
                  )}
                  <span className="flex-1 text-sm">{option.label}</span>
                  {isSelected && <Check size={16} className="text-blue-600" />}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

export default function DriveFilterBar({ onFilterChange, activeFilters }: DriveFilterBarProps) {
  const hasAnyFilter =
    activeFilters.type || activeFilters.people || activeFilters.modified || activeFilters.location;

  const handleFilterChange = (key: keyof FilterState, value: string | null) => {
    onFilterChange({
      ...activeFilters,
      [key]: value,
    });
  };

  const clearAllFilters = () => {
    onFilterChange({
      type: null,
      people: null,
      modified: null,
      location: null,
    });
  };

  return (
    <div className="flex items-center gap-2 py-3">
      {/* Type Filter */}
      <FilterDropdown
        label="Type"
        icon={File}
        options={typeOptions}
        value={activeFilters.type}
        onChange={(value) => handleFilterChange('type', value)}
      />

      {/* People Filter */}
      <FilterDropdown
        label="People"
        icon={Users}
        options={[
          { id: 'all', label: 'Anyone' },
          { id: 'me', label: 'Owned by me' },
          { id: 'not-me', label: 'Not owned by me' },
        ]}
        value={activeFilters.people}
        onChange={(value) => handleFilterChange('people', value)}
        showUserSearch
      />

      {/* Modified Filter */}
      <FilterDropdown
        label="Modified"
        icon={Calendar}
        options={modifiedOptions}
        value={activeFilters.modified}
        onChange={(value) => handleFilterChange('modified', value)}
      />

      {/* Location Filter */}
      <FilterDropdown
        label="Location"
        icon={MapPin}
        options={locationOptions}
        value={activeFilters.location}
        onChange={(value) => handleFilterChange('location', value)}
      />

      {/* Clear All Button */}
      {hasAnyFilter && (
        <button
          onClick={clearAllFilters}
          className="flex items-center gap-1 px-3 py-2 text-sm text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
        >
          <X size={14} />
          <span>Clear filters</span>
        </button>
      )}
    </div>
  );
}
