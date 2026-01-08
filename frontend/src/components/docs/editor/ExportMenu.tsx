/**
 * Bheem Docs - Export Menu Component
 * Export document to various formats
 */
import { useState } from 'react';
import {
  Download,
  FileText,
  FileCode,
  FileType,
  File,
  Loader2,
  Check,
  ExternalLink,
  Printer,
} from 'lucide-react';

interface ExportMenuProps {
  documentId: string;
  documentTitle: string;
  onClose: () => void;
}

type ExportFormat = 'pdf' | 'docx' | 'html' | 'markdown' | 'txt';

interface ExportOption {
  format: ExportFormat;
  label: string;
  description: string;
  icon: any;
  extension: string;
}

const EXPORT_OPTIONS: ExportOption[] = [
  {
    format: 'pdf',
    label: 'PDF Document',
    description: 'Best for printing and sharing',
    icon: FileText,
    extension: '.pdf',
  },
  {
    format: 'docx',
    label: 'Microsoft Word',
    description: 'Compatible with Word and Google Docs',
    icon: FileType,
    extension: '.docx',
  },
  {
    format: 'html',
    label: 'Web Page (HTML)',
    description: 'For web publishing',
    icon: FileCode,
    extension: '.html',
  },
  {
    format: 'markdown',
    label: 'Markdown',
    description: 'Plain text with formatting',
    icon: FileCode,
    extension: '.md',
  },
  {
    format: 'txt',
    label: 'Plain Text',
    description: 'No formatting, just text',
    icon: File,
    extension: '.txt',
  },
];

export default function ExportMenu({ documentId, documentTitle, onClose }: ExportMenuProps) {
  const [exporting, setExporting] = useState<ExportFormat | null>(null);
  const [exported, setExported] = useState<ExportFormat | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleExport = async (format: ExportFormat) => {
    setExporting(format);
    setError(null);

    try {
      const response = await fetch(`/api/v1/docs/editor/${documentId}/export/${format}`, {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${localStorage.getItem('auth_token')}`,
        },
      });

      if (!response.ok) throw new Error('Export failed');

      // Get the blob
      const blob = await response.blob();
      const option = EXPORT_OPTIONS.find((o) => o.format === format);
      const filename = `${documentTitle || 'document'}${option?.extension || '.txt'}`;

      // Create download link
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      setExported(format);
      setTimeout(() => setExported(null), 3000);
    } catch (err) {
      setError('Failed to export document. Please try again.');
    } finally {
      setExporting(null);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="absolute right-0 top-full mt-2 bg-white border rounded-xl shadow-xl w-72 z-50">
      {/* Header */}
      <div className="px-4 py-3 border-b">
        <div className="flex items-center gap-2">
          <Download size={18} className="text-blue-600" />
          <h3 className="font-semibold">Export Document</h3>
        </div>
        <p className="text-xs text-gray-500 mt-1">Download in your preferred format</p>
      </div>

      {/* Export options */}
      <div className="py-2">
        {EXPORT_OPTIONS.map((option) => {
          const Icon = option.icon;
          const isExporting = exporting === option.format;
          const isExported = exported === option.format;

          return (
            <button
              key={option.format}
              onClick={() => handleExport(option.format)}
              disabled={isExporting}
              className="w-full px-4 py-3 flex items-center gap-3 hover:bg-gray-50 disabled:opacity-50"
            >
              <div
                className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                  isExported
                    ? 'bg-green-100 text-green-600'
                    : 'bg-gray-100 text-gray-600'
                }`}
              >
                {isExporting ? (
                  <Loader2 size={20} className="animate-spin" />
                ) : isExported ? (
                  <Check size={20} />
                ) : (
                  <Icon size={20} />
                )}
              </div>
              <div className="flex-1 text-left">
                <p className="text-sm font-medium text-gray-900">{option.label}</p>
                <p className="text-xs text-gray-500">{option.description}</p>
              </div>
              <span className="text-xs text-gray-400 font-mono">{option.extension}</span>
            </button>
          );
        })}
      </div>

      {/* Divider */}
      <div className="border-t" />

      {/* Additional options */}
      <div className="py-2">
        <button
          onClick={handlePrint}
          className="w-full px-4 py-3 flex items-center gap-3 hover:bg-gray-50"
        >
          <div className="w-10 h-10 rounded-lg bg-gray-100 flex items-center justify-center text-gray-600">
            <Printer size={20} />
          </div>
          <div className="flex-1 text-left">
            <p className="text-sm font-medium text-gray-900">Print</p>
            <p className="text-xs text-gray-500">Print or save as PDF</p>
          </div>
        </button>
      </div>

      {/* Error message */}
      {error && (
        <div className="px-4 py-3 bg-red-50 border-t text-sm text-red-600">{error}</div>
      )}

      {/* Close button */}
      <div className="px-4 py-3 border-t">
        <button
          onClick={onClose}
          className="w-full py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg"
        >
          Close
        </button>
      </div>
    </div>
  );
}
