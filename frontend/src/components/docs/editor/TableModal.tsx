/**
 * Bheem Docs - Table Insert Modal
 */
import { useState } from 'react';
import { X, Table as TableIcon } from 'lucide-react';

interface TableModalProps {
  onSubmit: (rows: number, cols: number) => void;
  onClose: () => void;
}

export default function TableModal({ onSubmit, onClose }: TableModalProps) {
  const [rows, setRows] = useState(3);
  const [cols, setCols] = useState(3);
  const [hoverRows, setHoverRows] = useState(0);
  const [hoverCols, setHoverCols] = useState(0);

  const maxRows = 10;
  const maxCols = 10;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit(rows, cols);
  };

  const handleGridClick = (r: number, c: number) => {
    setRows(r);
    setCols(c);
    onSubmit(r, c);
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md">
        <div className="flex items-center justify-between px-6 py-4 border-b">
          <div className="flex items-center gap-2">
            <TableIcon size={20} className="text-purple-600" />
            <h2 className="text-lg font-semibold">Insert Table</h2>
          </div>
          <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded">
            <X size={20} />
          </button>
        </div>

        <div className="p-6 space-y-6">
          {/* Visual Grid Selector */}
          <div>
            <p className="text-sm text-gray-500 mb-3 text-center">
              {hoverRows > 0 ? `${hoverRows} x ${hoverCols}` : 'Click to select size'}
            </p>
            <div className="flex justify-center">
              <div
                className="grid gap-1"
                style={{ gridTemplateColumns: `repeat(${maxCols}, 1fr)` }}
                onMouseLeave={() => { setHoverRows(0); setHoverCols(0); }}
              >
                {Array.from({ length: maxRows }).map((_, r) =>
                  Array.from({ length: maxCols }).map((_, c) => (
                    <button
                      key={`${r}-${c}`}
                      type="button"
                      onMouseEnter={() => { setHoverRows(r + 1); setHoverCols(c + 1); }}
                      onClick={() => handleGridClick(r + 1, c + 1)}
                      className={`w-5 h-5 border rounded transition-colors ${
                        r < hoverRows && c < hoverCols
                          ? 'bg-blue-500 border-blue-600'
                          : 'bg-gray-100 border-gray-300 hover:bg-gray-200'
                      }`}
                    />
                  ))
                )}
              </div>
            </div>
          </div>

          {/* Manual Input */}
          <div className="flex items-center justify-center gap-4">
            <div className="flex items-center gap-2">
              <label className="text-sm text-gray-600">Rows:</label>
              <input
                type="number"
                min={1}
                max={20}
                value={rows}
                onChange={(e) => setRows(parseInt(e.target.value) || 1)}
                className="w-16 px-2 py-1 border rounded text-center"
              />
            </div>
            <span className="text-gray-400">x</span>
            <div className="flex items-center gap-2">
              <label className="text-sm text-gray-600">Columns:</label>
              <input
                type="number"
                min={1}
                max={20}
                value={cols}
                onChange={(e) => setCols(parseInt(e.target.value) || 1)}
                className="w-16 px-2 py-1 border rounded text-center"
              />
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg"
            >
              Cancel
            </button>
            <button
              onClick={handleSubmit}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              Insert Table
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
