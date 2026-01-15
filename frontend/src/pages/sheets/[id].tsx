/**
 * Bheem Sheets - Spreadsheet Editor
 * Google Sheets-like cell editing experience
 */
import { useEffect, useState, useCallback, useRef } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import Link from 'next/link';
import {
  FileSpreadsheet,
  Star,
  StarOff,
  Share2,
  MoreHorizontal,
  Plus,
  ChevronDown,
  Bold,
  Italic,
  Underline,
  AlignLeft,
  AlignCenter,
  AlignRight,
  Undo,
  Redo,
  Paintbrush,
  Type,
  DollarSign,
  Percent,
  Table,
  Download,
  Upload,
  Users,
  MessageSquare,
  History,
  Settings,
  ArrowLeft,
} from 'lucide-react';
import { useRequireAuth } from '@/stores/authStore';
import { api } from '@/lib/api';

interface CellData {
  value: string | number | null;
  formula?: string;
  format?: {
    bold?: boolean;
    italic?: boolean;
    underline?: boolean;
    align?: 'left' | 'center' | 'right';
    backgroundColor?: string;
    textColor?: string;
    fontSize?: number;
  };
}

interface Worksheet {
  id: string;
  name: string;
  sheet_index: number;
  data: Record<string, CellData>;
  row_count: number;
  column_count: number;
  color?: string;
}

interface Spreadsheet {
  id: string;
  title: string;
  description: string | null;
  is_starred: boolean;
  worksheets: Worksheet[];
  created_at: string;
  updated_at: string;
}

const COLUMNS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');
const DEFAULT_ROWS = 100;
const DEFAULT_COLS = 26;

export default function SpreadsheetEditor() {
  const router = useRouter();
  const { id } = router.query;
  const { isAuthenticated, isLoading: authLoading } = useRequireAuth();

  const [spreadsheet, setSpreadsheet] = useState<Spreadsheet | null>(null);
  const [activeWorksheet, setActiveWorksheet] = useState<Worksheet | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedCell, setSelectedCell] = useState<string | null>(null);
  const [editingCell, setEditingCell] = useState<string | null>(null);
  const [cellValue, setCellValue] = useState('');
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [selectionRange, setSelectionRange] = useState<{ start: string; end: string } | null>(null);

  const cellInputRef = useRef<HTMLInputElement>(null);
  const formulaBarRef = useRef<HTMLInputElement>(null);

  const fetchSpreadsheet = useCallback(async () => {
    if (!id) return;
    try {
      setLoading(true);
      const response = await api.get(`/sheets/${id}`);
      setSpreadsheet(response.data);
      if (response.data.worksheets?.length > 0) {
        setActiveWorksheet(response.data.worksheets[0]);
      }
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Failed to load spreadsheet');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    if (isAuthenticated && !authLoading && id) {
      fetchSpreadsheet();
    }
  }, [isAuthenticated, authLoading, id, fetchSpreadsheet]);

  const updateTitle = async (newTitle: string) => {
    if (!spreadsheet || newTitle === spreadsheet.title) return;
    try {
      await api.put(`/sheets/${spreadsheet.id}`, { title: newTitle });
      setSpreadsheet({ ...spreadsheet, title: newTitle });
    } catch (err) {
      console.error('Failed to update title:', err);
    }
  };

  const toggleStar = async () => {
    if (!spreadsheet) return;
    try {
      await api.post(`/sheets/${spreadsheet.id}/star`);
      setSpreadsheet({ ...spreadsheet, is_starred: !spreadsheet.is_starred });
    } catch (err) {
      console.error('Failed to toggle star:', err);
    }
  };

  const updateCell = async (cellRef: string, value: string) => {
    if (!spreadsheet || !activeWorksheet) return;

    setIsSaving(true);
    try {
      // Parse cell reference (e.g., "A1" -> row=1, col=A)
      const match = cellRef.match(/^([A-Z]+)(\d+)$/);
      if (!match) return;

      const col = match[1];
      const row = parseInt(match[2]);

      await api.put(`/sheets/${spreadsheet.id}/worksheets/${activeWorksheet.id}/cells`, {
        updates: [{ cell: cellRef, value, formula: value.startsWith('=') ? value : undefined }]
      });

      // Update local state
      setActiveWorksheet({
        ...activeWorksheet,
        data: {
          ...activeWorksheet.data,
          [cellRef]: { value, formula: value.startsWith('=') ? value : undefined }
        }
      });
    } catch (err) {
      console.error('Failed to update cell:', err);
    } finally {
      setIsSaving(false);
    }
  };

  const getCellValue = (cellRef: string): string => {
    if (!activeWorksheet?.data) return '';
    const cell = activeWorksheet.data[cellRef];
    if (!cell) return '';
    return cell.formula || String(cell.value || '');
  };

  const getDisplayValue = (cellRef: string): string => {
    if (!activeWorksheet?.data) return '';
    const cell = activeWorksheet.data[cellRef];
    if (!cell) return '';
    return String(cell.value || '');
  };

  const handleCellClick = (cellRef: string) => {
    setSelectedCell(cellRef);
    setCellValue(getCellValue(cellRef));
    setEditingCell(null);
  };

  const handleCellDoubleClick = (cellRef: string) => {
    setEditingCell(cellRef);
    setCellValue(getCellValue(cellRef));
    setIsEditing(true);
  };

  const handleCellKeyDown = (e: React.KeyboardEvent, cellRef: string) => {
    if (e.key === 'Enter') {
      if (editingCell) {
        updateCell(cellRef, cellValue);
        setEditingCell(null);
        setIsEditing(false);
        // Move to next row
        const match = cellRef.match(/^([A-Z]+)(\d+)$/);
        if (match) {
          const nextCell = `${match[1]}${parseInt(match[2]) + 1}`;
          setSelectedCell(nextCell);
          setCellValue(getCellValue(nextCell));
        }
      } else {
        handleCellDoubleClick(cellRef);
      }
    } else if (e.key === 'Escape') {
      setEditingCell(null);
      setIsEditing(false);
      setCellValue(getCellValue(selectedCell || ''));
    } else if (e.key === 'Tab') {
      e.preventDefault();
      if (editingCell) {
        updateCell(cellRef, cellValue);
        setEditingCell(null);
        setIsEditing(false);
      }
      // Move to next column
      const match = cellRef.match(/^([A-Z]+)(\d+)$/);
      if (match) {
        const colIndex = COLUMNS.indexOf(match[1]);
        if (colIndex < COLUMNS.length - 1) {
          const nextCell = `${COLUMNS[colIndex + 1]}${match[2]}`;
          setSelectedCell(nextCell);
          setCellValue(getCellValue(nextCell));
        }
      }
    } else if (!editingCell && e.key.length === 1 && !e.ctrlKey && !e.metaKey) {
      // Start editing on any character key
      setEditingCell(cellRef);
      setCellValue(e.key);
      setIsEditing(true);
    }
  };

  const handleFormulaBarKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && selectedCell) {
      updateCell(selectedCell, cellValue);
      setEditingCell(null);
      setIsEditing(false);
    }
  };

  const addWorksheet = async () => {
    if (!spreadsheet) return;
    try {
      const response = await api.post(`/sheets/${spreadsheet.id}/worksheets`, {
        name: `Sheet${spreadsheet.worksheets.length + 1}`
      });
      const newWorksheet = response.data.worksheet;
      setSpreadsheet({
        ...spreadsheet,
        worksheets: [...spreadsheet.worksheets, newWorksheet]
      });
      setActiveWorksheet(newWorksheet);
    } catch (err) {
      console.error('Failed to add worksheet:', err);
    }
  };

  if (authLoading || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-600"></div>
      </div>
    );
  }

  if (error || !spreadsheet) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <FileSpreadsheet className="mx-auto h-16 w-16 text-gray-400" />
          <h2 className="mt-4 text-xl font-medium text-gray-900">
            {error || 'Spreadsheet not found'}
          </h2>
          <Link href="/sheets" className="mt-4 inline-flex items-center text-green-600 hover:text-green-700">
            <ArrowLeft size={20} className="mr-1" />
            Back to Sheets
          </Link>
        </div>
      </div>
    );
  }

  const rowCount = activeWorksheet?.row_count || DEFAULT_ROWS;
  const colCount = Math.min(activeWorksheet?.column_count || DEFAULT_COLS, COLUMNS.length);

  return (
    <>
      <Head>
        <title>{spreadsheet.title} - Bheem Sheets</title>
      </Head>

      <div className="min-h-screen bg-white flex flex-col">
        {/* Top Bar */}
        <header className="bg-white border-b border-gray-200 flex-shrink-0">
          <div className="flex items-center px-3 py-2">
            <Link href="/sheets" className="p-2 hover:bg-gray-100 rounded-full">
              <FileSpreadsheet className="h-8 w-8 text-green-600" />
            </Link>

            <div className="ml-2 flex-1">
              <input
                type="text"
                value={spreadsheet.title}
                onChange={(e) => setSpreadsheet({ ...spreadsheet, title: e.target.value })}
                onBlur={(e) => updateTitle(e.target.value)}
                className="text-lg font-medium text-gray-900 bg-transparent border-none focus:outline-none focus:ring-2 focus:ring-green-500 rounded px-2 py-1"
              />
              <div className="flex items-center space-x-1 text-xs text-gray-500 ml-2">
                <button
                  onClick={toggleStar}
                  className="p-1 hover:bg-gray-100 rounded"
                >
                  {spreadsheet.is_starred ? (
                    <Star size={14} className="text-yellow-500 fill-yellow-500" />
                  ) : (
                    <StarOff size={14} />
                  )}
                </button>
                <span>{isSaving ? 'Saving...' : 'All changes saved'}</span>
              </div>
            </div>

            <div className="flex items-center space-x-2">
              <button className="p-2 text-gray-500 hover:bg-gray-100 rounded-full">
                <History size={20} />
              </button>
              <button className="p-2 text-gray-500 hover:bg-gray-100 rounded-full">
                <MessageSquare size={20} />
              </button>
              <button className="flex items-center px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700">
                <Share2 size={18} className="mr-2" />
                Share
              </button>
            </div>
          </div>

          {/* Toolbar */}
          <div className="flex items-center px-3 py-1 border-t border-gray-100 space-x-1">
            <button className="p-1.5 text-gray-600 hover:bg-gray-100 rounded">
              <Undo size={18} />
            </button>
            <button className="p-1.5 text-gray-600 hover:bg-gray-100 rounded">
              <Redo size={18} />
            </button>
            <div className="w-px h-5 bg-gray-300 mx-1" />
            <button className="p-1.5 text-gray-600 hover:bg-gray-100 rounded">
              <Paintbrush size={18} />
            </button>
            <select className="text-sm border border-gray-300 rounded px-2 py-1">
              <option>100%</option>
              <option>75%</option>
              <option>50%</option>
            </select>
            <div className="w-px h-5 bg-gray-300 mx-1" />
            <select className="text-sm border border-gray-300 rounded px-2 py-1 w-28">
              <option>Arial</option>
              <option>Times New Roman</option>
              <option>Roboto</option>
            </select>
            <select className="text-sm border border-gray-300 rounded px-2 py-1 w-16">
              <option>10</option>
              <option>11</option>
              <option>12</option>
              <option>14</option>
            </select>
            <div className="w-px h-5 bg-gray-300 mx-1" />
            <button className="p-1.5 text-gray-600 hover:bg-gray-100 rounded">
              <Bold size={18} />
            </button>
            <button className="p-1.5 text-gray-600 hover:bg-gray-100 rounded">
              <Italic size={18} />
            </button>
            <button className="p-1.5 text-gray-600 hover:bg-gray-100 rounded">
              <Underline size={18} />
            </button>
            <div className="w-px h-5 bg-gray-300 mx-1" />
            <button className="p-1.5 text-gray-600 hover:bg-gray-100 rounded">
              <AlignLeft size={18} />
            </button>
            <button className="p-1.5 text-gray-600 hover:bg-gray-100 rounded">
              <AlignCenter size={18} />
            </button>
            <button className="p-1.5 text-gray-600 hover:bg-gray-100 rounded">
              <AlignRight size={18} />
            </button>
            <div className="w-px h-5 bg-gray-300 mx-1" />
            <button className="p-1.5 text-gray-600 hover:bg-gray-100 rounded">
              <DollarSign size={18} />
            </button>
            <button className="p-1.5 text-gray-600 hover:bg-gray-100 rounded">
              <Percent size={18} />
            </button>
          </div>

          {/* Formula Bar */}
          <div className="flex items-center px-3 py-1 border-t border-gray-100">
            <div className="w-16 text-center text-sm font-medium text-gray-600 border-r border-gray-200 pr-2">
              {selectedCell || ''}
            </div>
            <span className="mx-2 text-gray-400">fx</span>
            <input
              ref={formulaBarRef}
              type="text"
              value={cellValue}
              onChange={(e) => setCellValue(e.target.value)}
              onKeyDown={handleFormulaBarKeyDown}
              className="flex-1 text-sm border-none focus:outline-none focus:ring-0"
              placeholder="Enter value or formula"
            />
          </div>
        </header>

        {/* Spreadsheet Grid */}
        <div className="flex-1 overflow-auto">
          <table className="border-collapse min-w-full">
            <thead className="sticky top-0 z-10">
              <tr className="bg-gray-100">
                <th className="w-10 min-w-[40px] border border-gray-300 bg-gray-100 sticky left-0 z-20" />
                {COLUMNS.slice(0, colCount).map((col) => (
                  <th
                    key={col}
                    className="min-w-[100px] w-24 border border-gray-300 bg-gray-100 text-xs font-medium text-gray-600 py-1"
                  >
                    {col}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {Array.from({ length: Math.min(rowCount, 100) }, (_, rowIndex) => (
                <tr key={rowIndex}>
                  <td className="w-10 min-w-[40px] border border-gray-300 bg-gray-100 text-xs font-medium text-gray-600 text-center py-1 sticky left-0">
                    {rowIndex + 1}
                  </td>
                  {COLUMNS.slice(0, colCount).map((col) => {
                    const cellRef = `${col}${rowIndex + 1}`;
                    const isSelected = selectedCell === cellRef;
                    const isEditing = editingCell === cellRef;

                    return (
                      <td
                        key={cellRef}
                        className={`min-w-[100px] w-24 border border-gray-200 text-sm relative ${
                          isSelected ? 'ring-2 ring-green-500 ring-inset' : ''
                        }`}
                        onClick={() => handleCellClick(cellRef)}
                        onDoubleClick={() => handleCellDoubleClick(cellRef)}
                        onKeyDown={(e) => handleCellKeyDown(e, cellRef)}
                        tabIndex={0}
                      >
                        {isEditing ? (
                          <input
                            ref={cellInputRef}
                            type="text"
                            value={cellValue}
                            onChange={(e) => setCellValue(e.target.value)}
                            onKeyDown={(e) => handleCellKeyDown(e, cellRef)}
                            onBlur={() => {
                              updateCell(cellRef, cellValue);
                              setEditingCell(null);
                              setIsEditing(false);
                            }}
                            className="absolute inset-0 w-full h-full px-1 border-none focus:outline-none focus:ring-0 text-sm"
                            autoFocus
                          />
                        ) : (
                          <div className="px-1 py-0.5 truncate min-h-[22px]">
                            {getDisplayValue(cellRef)}
                          </div>
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Sheet Tabs */}
        <div className="flex-shrink-0 bg-gray-100 border-t border-gray-300 flex items-center px-2 py-1">
          <button
            onClick={addWorksheet}
            className="p-1.5 text-gray-600 hover:bg-gray-200 rounded"
            title="Add sheet"
          >
            <Plus size={18} />
          </button>
          <div className="flex items-center space-x-1 ml-2 overflow-x-auto">
            {spreadsheet.worksheets.map((worksheet) => (
              <button
                key={worksheet.id}
                onClick={() => setActiveWorksheet(worksheet)}
                className={`px-4 py-1.5 text-sm rounded-t-lg border-b-2 ${
                  activeWorksheet?.id === worksheet.id
                    ? 'bg-white border-green-600 text-gray-900'
                    : 'bg-gray-200 border-transparent text-gray-600 hover:bg-gray-300'
                }`}
                style={worksheet.color ? { borderBottomColor: worksheet.color } : undefined}
              >
                {worksheet.name}
              </button>
            ))}
          </div>
        </div>
      </div>
    </>
  );
}
