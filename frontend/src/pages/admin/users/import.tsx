/**
 * Bulk User Import Page
 * CSV upload with validation, preview, and progress tracking
 */
import { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/router';
import {
  ArrowLeft,
  Upload,
  FileSpreadsheet,
  Download,
  AlertCircle,
  CheckCircle2,
  XCircle,
  Loader2,
  Users,
  Info,
  RefreshCw,
} from 'lucide-react';
import AdminLayout from '@/components/admin/AdminLayout';
import { useCurrentTenantId, useRequireAuth } from '@/stores/authStore';
import { api } from '@/lib/api';

interface PreviewRow {
  row_number: number;
  email: string;
  first_name: string;
  last_name: string;
  department: string;
  job_title: string;
  role: string;
  valid: boolean;
  errors: string[];
}

interface PreviewResponse {
  total_rows: number;
  valid_rows: number;
  invalid_rows: number;
  preview: PreviewRow[];
  columns_detected: string[];
  warnings: string[];
}

interface ImportJob {
  job_id: string;
  status: string;
  total_users: number;
  processed: number;
  success_count: number;
  error_count: number;
  progress_percent: number;
  errors: Array<{ row: number; email: string; error: string; skipped?: boolean }>;
  created_at: string;
  completed_at: string | null;
}

export default function BulkImportPage() {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { isAuthenticated, isLoading: authLoading } = useRequireAuth();
  const tenantId = useCurrentTenantId();

  const [step, setStep] = useState<'upload' | 'preview' | 'importing' | 'complete'>('upload');
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<PreviewResponse | null>(null);
  const [importJob, setImportJob] = useState<ImportJob | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sendInvites, setSendInvites] = useState(true);
  const [skipDuplicates, setSkipDuplicates] = useState(true);

  // Poll for import progress
  useEffect(() => {
    if (step !== 'importing' || !importJob?.job_id) return;

    const interval = setInterval(async () => {
      try {
        const response = await api.get(`/admin/users/import/${importJob.job_id}`);
        setImportJob(response.data);

        if (response.data.status === 'completed') {
          setStep('complete');
          clearInterval(interval);
        }
      } catch (err) {
        console.error('Failed to fetch import status:', err);
      }
    }, 2000);

    return () => clearInterval(interval);
  }, [step, importJob?.job_id]);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;

    if (!selectedFile.name.endsWith('.csv')) {
      setError('Please select a CSV file');
      return;
    }

    if (selectedFile.size > 5 * 1024 * 1024) {
      setError('File too large. Maximum size is 5MB');
      return;
    }

    setFile(selectedFile);
    setError(null);
  };

  const handlePreview = async () => {
    if (!file) return;

    setLoading(true);
    setError(null);

    try {
      const formData = new FormData();
      formData.append('file', file);

      const response = await api.post('/admin/users/import/preview', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });

      setPreview(response.data);
      setStep('preview');
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Failed to preview file');
    } finally {
      setLoading(false);
    }
  };

  const handleImport = async () => {
    if (!file) return;

    setLoading(true);
    setError(null);

    try {
      const formData = new FormData();
      formData.append('file', file);

      const response = await api.post(
        `/admin/users/import/csv?send_invites=${sendInvites}&skip_duplicates=${skipDuplicates}`,
        formData,
        { headers: { 'Content-Type': 'multipart/form-data' } }
      );

      setImportJob(response.data);
      setStep('importing');
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Failed to start import');
    } finally {
      setLoading(false);
    }
  };

  const downloadTemplate = async () => {
    try {
      const response = await api.get('/admin/users/import/template');
      const blob = new Blob([response.data.template], { type: 'text/csv' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = response.data.filename;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Failed to download template:', err);
    }
  };

  const resetImport = () => {
    setStep('upload');
    setFile(null);
    setPreview(null);
    setImportJob(null);
    setError(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <AdminLayout
      breadcrumbs={[
        { label: 'Admin', href: '/admin' },
        { label: 'Users', href: '/admin/users' },
        { label: 'Bulk Import' },
      ]}
      isSuperAdmin={false}
    >
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Back button */}
        <button
          onClick={() => router.push('/admin/users')}
          className="inline-flex items-center text-gray-600 hover:text-gray-900"
        >
          <ArrowLeft size={20} className="mr-2" />
          Back to Users
        </button>

        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-blue-100 rounded-lg">
              <Users className="text-blue-600" size={24} />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Bulk Import Users</h1>
              <p className="text-sm text-gray-500">Import multiple users from a CSV file</p>
            </div>
          </div>
          <button
            onClick={downloadTemplate}
            className="inline-flex items-center px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
          >
            <Download size={18} className="mr-2" />
            Download Template
          </button>
        </div>

        {/* Progress Steps */}
        <div className="flex items-center justify-center space-x-4">
          {['upload', 'preview', 'importing', 'complete'].map((s, i) => (
            <div key={s} className="flex items-center">
              <div
                className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
                  step === s
                    ? 'bg-blue-600 text-white'
                    : ['upload', 'preview', 'importing', 'complete'].indexOf(step) > i
                    ? 'bg-green-500 text-white'
                    : 'bg-gray-200 text-gray-500'
                }`}
              >
                {['upload', 'preview', 'importing', 'complete'].indexOf(step) > i ? (
                  <CheckCircle2 size={16} />
                ) : (
                  i + 1
                )}
              </div>
              {i < 3 && (
                <div
                  className={`w-12 h-0.5 mx-2 ${
                    ['upload', 'preview', 'importing', 'complete'].indexOf(step) > i
                      ? 'bg-green-500'
                      : 'bg-gray-200'
                  }`}
                />
              )}
            </div>
          ))}
        </div>

        {/* Error Message */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-start space-x-3">
            <AlertCircle className="text-red-500 mt-0.5" size={20} />
            <div>
              <p className="font-medium text-red-800">Error</p>
              <p className="text-red-600">{error}</p>
            </div>
          </div>
        )}

        {/* Step 1: Upload */}
        {step === 'upload' && (
          <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-6">
            {/* Drop Zone */}
            <div
              onClick={() => fileInputRef.current?.click()}
              className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-colors ${
                file
                  ? 'border-green-300 bg-green-50'
                  : 'border-gray-300 hover:border-blue-400 hover:bg-blue-50'
              }`}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv"
                onChange={handleFileSelect}
                className="hidden"
              />
              {file ? (
                <>
                  <FileSpreadsheet className="mx-auto text-green-500" size={48} />
                  <p className="mt-4 font-medium text-gray-900">{file.name}</p>
                  <p className="text-sm text-gray-500">
                    {(file.size / 1024).toFixed(1)} KB
                  </p>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      resetImport();
                    }}
                    className="mt-4 text-sm text-red-600 hover:text-red-700"
                  >
                    Remove file
                  </button>
                </>
              ) : (
                <>
                  <Upload className="mx-auto text-gray-400" size={48} />
                  <p className="mt-4 font-medium text-gray-900">
                    Drop your CSV file here or click to browse
                  </p>
                  <p className="text-sm text-gray-500">Maximum file size: 5MB</p>
                </>
              )}
            </div>

            {/* Import Options */}
            <div className="space-y-4">
              <h3 className="font-medium text-gray-900">Import Options</h3>
              <label className="flex items-center space-x-3">
                <input
                  type="checkbox"
                  checked={sendInvites}
                  onChange={(e) => setSendInvites(e.target.checked)}
                  className="w-4 h-4 text-blue-600 rounded"
                />
                <span className="text-gray-700">Send invitation emails to new users</span>
              </label>
              <label className="flex items-center space-x-3">
                <input
                  type="checkbox"
                  checked={skipDuplicates}
                  onChange={(e) => setSkipDuplicates(e.target.checked)}
                  className="w-4 h-4 text-blue-600 rounded"
                />
                <span className="text-gray-700">Skip duplicate emails (instead of failing)</span>
              </label>
            </div>

            {/* Info Box */}
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <div className="flex items-start space-x-3">
                <Info className="text-blue-500 mt-0.5" size={20} />
                <div className="text-sm text-blue-800">
                  <p className="font-medium">CSV Format Requirements:</p>
                  <ul className="mt-2 list-disc list-inside space-y-1">
                    <li>Required columns: email, first_name, last_name</li>
                    <li>Optional columns: department, job_title, role, org_unit, phone</li>
                    <li>Role values: admin, manager, member (default: member)</li>
                    <li>Maximum 500 users per import</li>
                  </ul>
                </div>
              </div>
            </div>

            {/* Actions */}
            <div className="flex justify-end space-x-3">
              <button
                onClick={() => router.push('/admin/users')}
                className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={handlePreview}
                disabled={!file || loading}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center"
              >
                {loading && <Loader2 className="animate-spin mr-2" size={18} />}
                Preview Import
              </button>
            </div>
          </div>
        )}

        {/* Step 2: Preview */}
        {step === 'preview' && preview && (
          <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-6">
            {/* Summary */}
            <div className="grid grid-cols-3 gap-4">
              <div className="bg-gray-50 rounded-lg p-4 text-center">
                <p className="text-2xl font-bold text-gray-900">{preview.total_rows}</p>
                <p className="text-sm text-gray-500">Total Rows</p>
              </div>
              <div className="bg-green-50 rounded-lg p-4 text-center">
                <p className="text-2xl font-bold text-green-600">{preview.valid_rows}</p>
                <p className="text-sm text-gray-500">Valid</p>
              </div>
              <div className="bg-red-50 rounded-lg p-4 text-center">
                <p className="text-2xl font-bold text-red-600">{preview.invalid_rows}</p>
                <p className="text-sm text-gray-500">Invalid</p>
              </div>
            </div>

            {/* Warnings */}
            {preview.warnings.length > 0 && (
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                <div className="flex items-start space-x-3">
                  <AlertCircle className="text-yellow-500 mt-0.5" size={20} />
                  <div>
                    <p className="font-medium text-yellow-800">Warnings</p>
                    <ul className="mt-1 text-sm text-yellow-700 list-disc list-inside">
                      {preview.warnings.map((w, i) => (
                        <li key={i}>{w}</li>
                      ))}
                    </ul>
                  </div>
                </div>
              </div>
            )}

            {/* Preview Table */}
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      Row
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      Status
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      Email
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      Name
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      Role
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      Errors
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {preview.preview.slice(0, 20).map((row) => (
                    <tr key={row.row_number} className={row.valid ? '' : 'bg-red-50'}>
                      <td className="px-4 py-3 text-sm text-gray-500">{row.row_number}</td>
                      <td className="px-4 py-3">
                        {row.valid ? (
                          <CheckCircle2 className="text-green-500" size={18} />
                        ) : (
                          <XCircle className="text-red-500" size={18} />
                        )}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-900">{row.email}</td>
                      <td className="px-4 py-3 text-sm text-gray-900">
                        {row.first_name} {row.last_name}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600 capitalize">{row.role}</td>
                      <td className="px-4 py-3 text-sm text-red-600">
                        {row.errors.join(', ')}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Actions */}
            <div className="flex justify-between">
              <button
                onClick={resetImport}
                className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
              >
                Back to Upload
              </button>
              <div className="space-x-3">
                <button
                  onClick={() => router.push('/admin/users')}
                  className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  onClick={handleImport}
                  disabled={preview.valid_rows === 0 || loading}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center"
                >
                  {loading && <Loader2 className="animate-spin mr-2" size={18} />}
                  Import {preview.valid_rows} Users
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Step 3: Importing */}
        {step === 'importing' && importJob && (
          <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-6">
            <div className="text-center">
              <Loader2 className="animate-spin mx-auto text-blue-600" size={48} />
              <h3 className="mt-4 text-lg font-semibold text-gray-900">Importing Users...</h3>
              <p className="text-gray-500">Please wait while we process your import</p>
            </div>

            {/* Progress Bar */}
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">Progress</span>
                <span className="font-medium text-gray-900">{importJob.progress_percent}%</span>
              </div>
              <div className="h-3 bg-gray-200 rounded-full overflow-hidden">
                <div
                  className="h-full bg-blue-600 transition-all duration-500"
                  style={{ width: `${importJob.progress_percent}%` }}
                />
              </div>
              <p className="text-sm text-gray-500">
                {importJob.processed} of {importJob.total_users} users processed
              </p>
            </div>

            {/* Live Stats */}
            <div className="grid grid-cols-3 gap-4">
              <div className="bg-gray-50 rounded-lg p-4 text-center">
                <p className="text-xl font-bold text-gray-900">{importJob.processed}</p>
                <p className="text-sm text-gray-500">Processed</p>
              </div>
              <div className="bg-green-50 rounded-lg p-4 text-center">
                <p className="text-xl font-bold text-green-600">{importJob.success_count}</p>
                <p className="text-sm text-gray-500">Success</p>
              </div>
              <div className="bg-red-50 rounded-lg p-4 text-center">
                <p className="text-xl font-bold text-red-600">{importJob.error_count}</p>
                <p className="text-sm text-gray-500">Errors</p>
              </div>
            </div>
          </div>
        )}

        {/* Step 4: Complete */}
        {step === 'complete' && importJob && (
          <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-6">
            <div className="text-center">
              <div
                className={`w-16 h-16 rounded-full flex items-center justify-center mx-auto ${
                  importJob.error_count === 0 ? 'bg-green-100' : 'bg-yellow-100'
                }`}
              >
                {importJob.error_count === 0 ? (
                  <CheckCircle2 className="text-green-600" size={32} />
                ) : (
                  <AlertCircle className="text-yellow-600" size={32} />
                )}
              </div>
              <h3 className="mt-4 text-lg font-semibold text-gray-900">Import Complete</h3>
              <p className="text-gray-500">
                {importJob.error_count === 0
                  ? 'All users were imported successfully!'
                  : 'Import completed with some errors'}
              </p>
            </div>

            {/* Final Stats */}
            <div className="grid grid-cols-3 gap-4">
              <div className="bg-gray-50 rounded-lg p-4 text-center">
                <p className="text-2xl font-bold text-gray-900">{importJob.total_users}</p>
                <p className="text-sm text-gray-500">Total</p>
              </div>
              <div className="bg-green-50 rounded-lg p-4 text-center">
                <p className="text-2xl font-bold text-green-600">{importJob.success_count}</p>
                <p className="text-sm text-gray-500">Imported</p>
              </div>
              <div className="bg-red-50 rounded-lg p-4 text-center">
                <p className="text-2xl font-bold text-red-600">{importJob.error_count}</p>
                <p className="text-sm text-gray-500">Failed</p>
              </div>
            </div>

            {/* Error List */}
            {importJob.errors.length > 0 && (
              <div className="border border-red-200 rounded-lg overflow-hidden">
                <div className="bg-red-50 px-4 py-3 border-b border-red-200">
                  <h4 className="font-medium text-red-800">Errors ({importJob.errors.length})</h4>
                </div>
                <div className="max-h-48 overflow-y-auto">
                  {importJob.errors.map((err, i) => (
                    <div
                      key={i}
                      className={`px-4 py-2 border-b border-red-100 text-sm ${
                        err.skipped ? 'bg-yellow-50' : ''
                      }`}
                    >
                      <span className="text-gray-500">Row {err.row}:</span>{' '}
                      <span className="text-gray-700">{err.email}</span>
                      <span className="text-red-600 ml-2">- {err.error}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Actions */}
            <div className="flex justify-center space-x-4">
              <button
                onClick={resetImport}
                className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 flex items-center"
              >
                <RefreshCw size={18} className="mr-2" />
                Import More Users
              </button>
              <button
                onClick={() => router.push('/admin/users')}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                View All Users
              </button>
            </div>
          </div>
        )}
      </div>
    </AdminLayout>
  );
}
