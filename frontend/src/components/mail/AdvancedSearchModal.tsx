/**
 * Bheem Mail Advanced Search Modal
 * Gmail/Zoho-style advanced search with field-specific filters
 */
import { useState } from 'react';
import {
  X,
  Search,
  Calendar,
  Paperclip,
  Tag,
  User,
  Mail,
  FileText,
} from 'lucide-react';
import { useMailStore } from '@/stores/mailStore';

interface AdvancedSearchModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSearch: (params: SearchParams) => void;
}

interface SearchParams {
  query?: string;
  from?: string;
  to?: string;
  subject?: string;
  hasAttachment?: boolean;
  isUnread?: boolean;
  isStarred?: boolean;
  folder?: string;
  dateFrom?: string;
  dateTo?: string;
  labels?: string[];
}

export default function AdvancedSearchModal({
  isOpen,
  onClose,
  onSearch,
}: AdvancedSearchModalProps) {
  const { folders, searchEmails } = useMailStore();

  const [params, setParams] = useState<SearchParams>({
    query: '',
    from: '',
    to: '',
    subject: '',
    hasAttachment: false,
    isUnread: false,
    isStarred: false,
    folder: '',
    dateFrom: '',
    dateTo: '',
  });

  const handleSearch = () => {
    // Build search query
    const cleanParams: SearchParams = {};

    if (params.query) cleanParams.query = params.query;
    if (params.from) cleanParams.from = params.from;
    if (params.to) cleanParams.to = params.to;
    if (params.subject) cleanParams.subject = params.subject;
    if (params.hasAttachment) cleanParams.hasAttachment = true;
    if (params.isUnread) cleanParams.isUnread = true;
    if (params.isStarred) cleanParams.isStarred = true;
    if (params.folder) cleanParams.folder = params.folder;
    if (params.dateFrom) cleanParams.dateFrom = params.dateFrom;
    if (params.dateTo) cleanParams.dateTo = params.dateTo;

    onSearch(cleanParams);
    onClose();
  };

  const handleClear = () => {
    setParams({
      query: '',
      from: '',
      to: '',
      subject: '',
      hasAttachment: false,
      isUnread: false,
      isStarred: false,
      folder: '',
      dateFrom: '',
      dateTo: '',
    });
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-20 bg-black/50">
      <div className="bg-white rounded-xl shadow-2xl w-[600px] max-h-[80vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 sticky top-0 bg-white">
          <div className="flex items-center gap-3">
            <Search className="text-gray-400" size={20} />
            <h2 className="text-lg font-semibold text-gray-900">Advanced Search</h2>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg"
          >
            <X size={20} />
          </button>
        </div>

        {/* Search Form */}
        <div className="p-6 space-y-5">
          {/* General Search */}
          <div>
            <label className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-2">
              <Search size={16} />
              Has the words
            </label>
            <input
              type="text"
              value={params.query}
              onChange={(e) => setParams({ ...params, query: e.target.value })}
              className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
              placeholder="Search for keywords..."
            />
          </div>

          {/* From / To */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-2">
                <User size={16} />
                From
              </label>
              <input
                type="text"
                value={params.from}
                onChange={(e) => setParams({ ...params, from: e.target.value })}
                className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                placeholder="sender@example.com"
              />
            </div>
            <div>
              <label className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-2">
                <Mail size={16} />
                To
              </label>
              <input
                type="text"
                value={params.to}
                onChange={(e) => setParams({ ...params, to: e.target.value })}
                className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                placeholder="recipient@example.com"
              />
            </div>
          </div>

          {/* Subject */}
          <div>
            <label className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-2">
              <FileText size={16} />
              Subject
            </label>
            <input
              type="text"
              value={params.subject}
              onChange={(e) => setParams({ ...params, subject: e.target.value })}
              className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
              placeholder="Search in subject line..."
            />
          </div>

          {/* Date Range */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-2">
                <Calendar size={16} />
                From Date
              </label>
              <input
                type="date"
                value={params.dateFrom}
                onChange={(e) => setParams({ ...params, dateFrom: e.target.value })}
                className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
              />
            </div>
            <div>
              <label className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-2">
                <Calendar size={16} />
                To Date
              </label>
              <input
                type="date"
                value={params.dateTo}
                onChange={(e) => setParams({ ...params, dateTo: e.target.value })}
                className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
              />
            </div>
          </div>

          {/* Folder */}
          <div>
            <label className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-2">
              <Tag size={16} />
              Search in Folder
            </label>
            <select
              value={params.folder}
              onChange={(e) => setParams({ ...params, folder: e.target.value })}
              className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
            >
              <option value="">All folders</option>
              <option value="INBOX">Inbox</option>
              <option value="Sent">Sent</option>
              <option value="Drafts">Drafts</option>
              <option value="Spam">Spam</option>
              <option value="Trash">Trash</option>
              <option value="Archive">Archive</option>
              {folders.filter(f => !f.isSystem).map(folder => (
                <option key={folder.id} value={folder.path || folder.id}>
                  {folder.name}
                </option>
              ))}
            </select>
          </div>

          {/* Checkboxes */}
          <div className="flex flex-wrap gap-4 pt-2">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={params.hasAttachment}
                onChange={(e) => setParams({ ...params, hasAttachment: e.target.checked })}
                className="w-4 h-4 rounded border-gray-300 text-orange-500 focus:ring-orange-500"
              />
              <Paperclip size={16} className="text-gray-500" />
              <span className="text-sm text-gray-700">Has attachment</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={params.isUnread}
                onChange={(e) => setParams({ ...params, isUnread: e.target.checked })}
                className="w-4 h-4 rounded border-gray-300 text-orange-500 focus:ring-orange-500"
              />
              <Mail size={16} className="text-gray-500" />
              <span className="text-sm text-gray-700">Unread only</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={params.isStarred}
                onChange={(e) => setParams({ ...params, isStarred: e.target.checked })}
                className="w-4 h-4 rounded border-gray-300 text-orange-500 focus:ring-orange-500"
              />
              <span className="text-amber-400">★</span>
              <span className="text-sm text-gray-700">Starred</span>
            </label>
          </div>

          {/* Search Tips */}
          <div className="p-4 bg-blue-50 rounded-lg">
            <h4 className="text-sm font-medium text-blue-800 mb-2">Search Tips</h4>
            <ul className="text-xs text-blue-700 space-y-1">
              <li>• Use quotes for exact phrases: <code className="bg-blue-100 px-1 rounded">"project update"</code></li>
              <li>• Use OR for alternatives: <code className="bg-blue-100 px-1 rounded">meeting OR call</code></li>
              <li>• Use minus to exclude: <code className="bg-blue-100 px-1 rounded">report -draft</code></li>
              <li>• Wildcards supported: <code className="bg-blue-100 px-1 rounded">meet*</code> matches meeting, meets, etc.</li>
            </ul>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-gray-200 bg-gray-50 rounded-b-xl sticky bottom-0">
          <button
            onClick={handleClear}
            className="px-4 py-2 text-gray-600 hover:bg-gray-200 rounded-lg transition-colors"
          >
            Clear all
          </button>
          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="px-4 py-2 text-gray-600 hover:bg-gray-200 rounded-lg transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleSearch}
              className="flex items-center gap-2 px-6 py-2 bg-orange-500 text-white rounded-lg hover:bg-orange-600 transition-colors"
            >
              <Search size={18} />
              <span>Search</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
