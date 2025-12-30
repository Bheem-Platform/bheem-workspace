import { useState } from 'react';
import { AlertCircle } from 'lucide-react';
import type { DomainCreate } from '@/types/admin';

interface DomainFormProps {
  onSubmit: (data: DomainCreate) => Promise<void>;
  onCancel: () => void;
  loading?: boolean;
}

export default function DomainForm({
  onSubmit,
  onCancel,
  loading = false,
}: DomainFormProps) {
  const [domain, setDomain] = useState('');
  const [error, setError] = useState('');

  const validate = () => {
    if (!domain.trim()) {
      setError('Domain is required');
      return false;
    }

    setError('');
    return true;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;

    await onSubmit({ domain: domain.toLowerCase().trim() });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Domain */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Domain Name *
        </label>
        <input
          type="text"
          value={domain}
          onChange={(e) => {
            setDomain(e.target.value);
            if (error) setError('');
          }}
          className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${
            error ? 'border-red-500' : 'border-gray-300'
          }`}
          placeholder="example.com"
        />
        {error && <p className="mt-1 text-sm text-red-500">{error}</p>}
      </div>

      {/* Info Box */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <div className="flex">
          <AlertCircle className="text-blue-600 flex-shrink-0 mr-3" size={20} />
          <div className="text-sm">
            <p className="font-medium text-blue-800">Next Steps</p>
            <ul className="mt-2 text-blue-700 space-y-1">
              <li>• After adding, you'll need to verify domain ownership</li>
              <li>• DNS records will be generated for verification</li>
              <li>• You can configure mail and other services after verification</li>
            </ul>
          </div>
        </div>
      </div>

      {/* Actions */}
      <div className="flex justify-end space-x-3 pt-4 border-t">
        <button
          type="button"
          onClick={onCancel}
          disabled={loading}
          className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={loading}
          className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50"
        >
          {loading ? 'Adding...' : 'Add Domain'}
        </button>
      </div>
    </form>
  );
}
