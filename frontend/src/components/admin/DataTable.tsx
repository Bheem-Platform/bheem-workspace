import { ReactNode } from 'react';
import { ChevronLeft, ChevronRight, Loader2 } from 'lucide-react';

interface Column<T> {
  key: string;
  header: string;
  render?: (item: T) => ReactNode;
  className?: string;
}

interface DataTableProps<T> {
  data: T[];
  columns: Column<T>[];
  loading?: boolean;
  emptyMessage?: string;
  onRowClick?: (item: T) => void;
  keyField?: string;
  pagination?: {
    page: number;
    pageSize: number;
    total: number;
    onPageChange: (page: number) => void;
  };
}

export default function DataTable<T extends Record<string, any>>({
  data,
  columns,
  loading = false,
  emptyMessage = 'No data found',
  onRowClick,
  keyField = 'id',
  pagination,
}: DataTableProps<T>) {
  if (loading) {
    return (
      <div className="bg-white rounded-xl border border-gray-200 p-12 flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-blue-500 animate-spin" />
      </div>
    );
  }

  if (data.length === 0) {
    return (
      <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
        <p className="text-gray-500">{emptyMessage}</p>
      </div>
    );
  }

  const totalPages = pagination ? Math.ceil(pagination.total / pagination.pageSize) : 1;

  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="bg-gray-50 border-b border-gray-200">
              {columns.map((column) => (
                <th
                  key={column.key}
                  className={`px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider ${column.className || ''}`}
                >
                  {column.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {data.map((item, index) => (
              <tr
                key={item[keyField] || index}
                onClick={() => onRowClick?.(item)}
                className={`${
                  onRowClick ? 'cursor-pointer hover:bg-gray-50' : ''
                } transition-colors`}
              >
                {columns.map((column) => (
                  <td
                    key={column.key}
                    className={`px-6 py-4 text-sm text-gray-900 ${column.className || ''}`}
                  >
                    {column.render
                      ? column.render(item)
                      : item[column.key] ?? '-'}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {pagination && totalPages > 1 && (
        <div className="px-6 py-4 border-t border-gray-200 flex items-center justify-between">
          <p className="text-sm text-gray-500">
            Showing {((pagination.page - 1) * pagination.pageSize) + 1} to{' '}
            {Math.min(pagination.page * pagination.pageSize, pagination.total)} of{' '}
            {pagination.total} results
          </p>
          <div className="flex items-center space-x-2">
            <button
              onClick={() => pagination.onPageChange(pagination.page - 1)}
              disabled={pagination.page <= 1}
              className="p-2 text-gray-500 hover:text-gray-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <ChevronLeft size={20} />
            </button>
            <span className="text-sm text-gray-700">
              Page {pagination.page} of {totalPages}
            </span>
            <button
              onClick={() => pagination.onPageChange(pagination.page + 1)}
              disabled={pagination.page >= totalPages}
              className="p-2 text-gray-500 hover:text-gray-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <ChevronRight size={20} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
