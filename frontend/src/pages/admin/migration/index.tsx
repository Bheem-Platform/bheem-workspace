/**
 * Bheem Workspace - Data Migration
 * Import data from Google Workspace, Outlook, and other sources
 */
import { useEffect, useState, useRef } from 'react';
import { useRouter } from 'next/router';
import {
  Upload,
  FileText,
  Mail,
  Calendar,
  Users,
  FolderOpen,
  CheckCircle,
  XCircle,
  Clock,
  AlertCircle,
  Download,
  RefreshCw,
  ChevronRight,
  ArrowRight,
  Loader2,
} from 'lucide-react';
import AdminLayout from '@/components/admin/AdminLayout';
import { useCurrentTenantId, useRequireAuth } from '@/stores/authStore';
import { api } from '@/lib/api';

interface MigrationJob {
  job_id: string;
  source: string;
  data_type: string;
  status: string;
  progress: number;
  total_items: number;
  processed_items: number;
  errors: string[];
  error_count: number;
  created_at: string;
  started_at: string | null;
  completed_at: string | null;
}

interface SupportedFormats {
  google: Record<string, string[]>;
  outlook: Record<string, string[]>;
  generic: Record<string, string[]>;
}

const DATA_TYPES = [
  { id: 'email', label: 'Emails', icon: <Mail size={24} />, color: 'blue' },
  { id: 'calendar', label: 'Calendar', icon: <Calendar size={24} />, color: 'green' },
  { id: 'contacts', label: 'Contacts', icon: <Users size={24} />, color: 'purple' },
  { id: 'documents', label: 'Documents', icon: <FolderOpen size={24} />, color: 'orange' },
];

const SOURCES = [
  {
    id: 'google',
    name: 'Google Workspace',
    description: 'Import from Google Takeout export',
    icon: '/icons/google.svg',
    color: 'bg-white border-gray-200',
  },
  {
    id: 'outlook',
    name: 'Microsoft 365',
    description: 'Import from Outlook export',
    icon: '/icons/microsoft.svg',
    color: 'bg-white border-gray-200',
  },
  {
    id: 'csv',
    name: 'CSV File',
    description: 'Import contacts from CSV',
    icon: '/icons/csv.svg',
    color: 'bg-white border-gray-200',
  },
];

export default function MigrationPage() {
  const router = useRouter();
  const { isAuthenticated, isLoading } = useRequireAuth();
  const tenantId = useCurrentTenantId();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [jobs, setJobs] = useState<MigrationJob[]>([]);
  const [formats, setFormats] = useState<SupportedFormats | null>(null);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);

  // Import wizard state
  const [step, setStep] = useState<'source' | 'type' | 'upload' | 'progress'>('source');
  const [selectedSource, setSelectedSource] = useState<string>('');
  const [selectedType, setSelectedType] = useState<string>('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [currentJob, setCurrentJob] = useState<MigrationJob | null>(null);

  // CSV mapping
  const [csvPreview, setCsvPreview] = useState<any>(null);
  const [csvMapping, setCsvMapping] = useState({
    name: '',
    email: '',
    phone: '',
    organization: '',
  });

  useEffect(() => {
    if (!isAuthenticated || isLoading) return;
    fetchJobs();
    fetchFormats();
  }, [isAuthenticated, isLoading, tenantId]);

  // Poll for job updates
  useEffect(() => {
    if (!currentJob || currentJob.status === 'completed' || currentJob.status === 'failed') return;

    const interval = setInterval(async () => {
      try {
        const res = await api.get(`/migration/jobs/${currentJob.job_id}`);
        setCurrentJob(res.data);
        if (res.data.status === 'completed' || res.data.status === 'failed') {
          fetchJobs();
        }
      } catch (err) {
        console.error('Failed to fetch job status:', err);
      }
    }, 2000);

    return () => clearInterval(interval);
  }, [currentJob]);

  const fetchJobs = async () => {
    try {
      const res = await api.get('/migration/jobs');
      setJobs(res.data || []);
    } catch (err) {
      console.error('Failed to fetch migration jobs:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchFormats = async () => {
    try {
      const res = await api.get('/migration/formats');
      setFormats(res.data);
    } catch (err) {
      console.error('Failed to fetch supported formats:', err);
    }
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setSelectedFile(file);

    // Preview CSV for mapping
    if (selectedSource === 'csv' && file.name.endsWith('.csv')) {
      try {
        const formData = new FormData();
        formData.append('file', file);
        const res = await api.post('/migration/preview/csv', formData);
        setCsvPreview(res.data);
        if (res.data.suggested_mapping) {
          setCsvMapping(res.data.suggested_mapping);
        }
      } catch (err) {
        console.error('Failed to preview CSV:', err);
      }
    }
  };

  const startImport = async () => {
    if (!selectedFile) return;

    setUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', selectedFile);
      formData.append('data_type', selectedType);

      let endpoint = '';
      if (selectedSource === 'google') {
        endpoint = '/migration/import/google';
      } else if (selectedSource === 'outlook') {
        endpoint = '/migration/import/outlook';
      } else if (selectedSource === 'csv') {
        endpoint = '/migration/import/csv';
        // Add CSV mapping
        Object.entries(csvMapping).forEach(([key, value]) => {
          if (value) formData.append(`${key}_column`, value);
        });
      }

      const res = await api.post(endpoint, formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });

      setCurrentJob(res.data);
      setStep('progress');
    } catch (err) {
      console.error('Failed to start import:', err);
      alert('Failed to start import. Please try again.');
    } finally {
      setUploading(false);
    }
  };

  const resetWizard = () => {
    setStep('source');
    setSelectedSource('');
    setSelectedType('');
    setSelectedFile(null);
    setCurrentJob(null);
    setCsvPreview(null);
    setCsvMapping({ name: '', email: '', phone: '', organization: '' });
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed': return <CheckCircle size={20} className="text-green-500" />;
      case 'failed': return <XCircle size={20} className="text-red-500" />;
      case 'processing': return <Loader2 size={20} className="text-blue-500 animate-spin" />;
      default: return <Clock size={20} className="text-gray-400" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed': return 'bg-green-100 text-green-700';
      case 'failed': return 'bg-red-100 text-red-700';
      case 'processing': return 'bg-blue-100 text-blue-700';
      default: return 'bg-gray-100 text-gray-700';
    }
  };

  if (isLoading || loading) {
    return (
      <AdminLayout>
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Data Migration</h1>
            <p className="text-gray-600">Import your data from other platforms</p>
          </div>
        </div>

        {/* Import Wizard */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
          {/* Progress Steps */}
          <div className="px-6 py-4 bg-gray-50 border-b">
            <div className="flex items-center justify-center gap-2">
              {['source', 'type', 'upload', 'progress'].map((s, idx) => (
                <div key={s} className="flex items-center">
                  <div
                    className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
                      step === s
                        ? 'bg-blue-600 text-white'
                        : idx < ['source', 'type', 'upload', 'progress'].indexOf(step)
                        ? 'bg-green-500 text-white'
                        : 'bg-gray-200 text-gray-500'
                    }`}
                  >
                    {idx < ['source', 'type', 'upload', 'progress'].indexOf(step) ? (
                      <CheckCircle size={16} />
                    ) : (
                      idx + 1
                    )}
                  </div>
                  {idx < 3 && (
                    <ChevronRight size={16} className="mx-2 text-gray-300" />
                  )}
                </div>
              ))}
            </div>
          </div>

          <div className="p-6">
            {/* Step 1: Select Source */}
            {step === 'source' && (
              <div>
                <h2 className="text-lg font-semibold text-gray-900 mb-4">Select Import Source</h2>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {SOURCES.map(source => (
                    <button
                      key={source.id}
                      onClick={() => {
                        setSelectedSource(source.id);
                        setStep('type');
                      }}
                      className={`p-6 rounded-xl border-2 text-left transition-all hover:shadow-md ${
                        selectedSource === source.id
                          ? 'border-blue-500 bg-blue-50'
                          : 'border-gray-200 hover:border-gray-300'
                      }`}
                    >
                      <div className="w-12 h-12 bg-gray-100 rounded-xl flex items-center justify-center mb-4">
                        <FileText size={24} className="text-gray-600" />
                      </div>
                      <h3 className="font-semibold text-gray-900">{source.name}</h3>
                      <p className="text-sm text-gray-500 mt-1">{source.description}</p>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Step 2: Select Data Type */}
            {step === 'type' && (
              <div>
                <h2 className="text-lg font-semibold text-gray-900 mb-4">What would you like to import?</h2>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  {DATA_TYPES.filter(type => {
                    if (selectedSource === 'csv') return type.id === 'contacts';
                    if (selectedSource === 'outlook') return type.id !== 'documents';
                    return true;
                  }).map(type => (
                    <button
                      key={type.id}
                      onClick={() => {
                        setSelectedType(type.id);
                        setStep('upload');
                      }}
                      className={`p-6 rounded-xl border-2 text-center transition-all hover:shadow-md ${
                        selectedType === type.id
                          ? 'border-blue-500 bg-blue-50'
                          : 'border-gray-200 hover:border-gray-300'
                      }`}
                    >
                      <div className={`w-12 h-12 bg-${type.color}-100 rounded-xl flex items-center justify-center mx-auto mb-3 text-${type.color}-600`}>
                        {type.icon}
                      </div>
                      <h3 className="font-semibold text-gray-900">{type.label}</h3>
                    </button>
                  ))}
                </div>
                <div className="mt-6">
                  <button
                    onClick={() => setStep('source')}
                    className="text-gray-500 hover:text-gray-700"
                  >
                    &larr; Back
                  </button>
                </div>
              </div>
            )}

            {/* Step 3: Upload File */}
            {step === 'upload' && (
              <div>
                <h2 className="text-lg font-semibold text-gray-900 mb-4">Upload Your File</h2>

                <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                  <h4 className="font-medium text-blue-900 mb-2">How to export your data:</h4>
                  {selectedSource === 'google' && (
                    <ol className="text-sm text-blue-800 list-decimal list-inside space-y-1">
                      <li>Go to <strong>takeout.google.com</strong></li>
                      <li>Select the data you want to export ({selectedType})</li>
                      <li>Download the ZIP file</li>
                      <li>Upload it here</li>
                    </ol>
                  )}
                  {selectedSource === 'outlook' && (
                    <ol className="text-sm text-blue-800 list-decimal list-inside space-y-1">
                      <li>Open Outlook and go to File &gt; Export</li>
                      <li>Choose the format (ICS for calendar, CSV for contacts)</li>
                      <li>Save and upload the file here</li>
                    </ol>
                  )}
                  {selectedSource === 'csv' && (
                    <p className="text-sm text-blue-800">
                      Upload a CSV file with contact information. We'll help you map the columns.
                    </p>
                  )}
                </div>

                <div
                  onClick={() => fileInputRef.current?.click()}
                  className="border-2 border-dashed border-gray-300 rounded-xl p-8 text-center cursor-pointer hover:border-blue-400 hover:bg-blue-50 transition-all"
                >
                  <input
                    ref={fileInputRef}
                    type="file"
                    onChange={handleFileSelect}
                    accept={selectedSource === 'csv' ? '.csv' : '.zip,.csv,.ics,.vcf,.eml'}
                    className="hidden"
                  />
                  <Upload size={40} className="mx-auto text-gray-400 mb-4" />
                  {selectedFile ? (
                    <div>
                      <p className="font-medium text-gray-900">{selectedFile.name}</p>
                      <p className="text-sm text-gray-500">
                        {(selectedFile.size / 1024 / 1024).toFixed(2)} MB
                      </p>
                    </div>
                  ) : (
                    <div>
                      <p className="font-medium text-gray-900">Click to upload or drag and drop</p>
                      <p className="text-sm text-gray-500">
                        {selectedSource === 'google' && 'ZIP file from Google Takeout'}
                        {selectedSource === 'outlook' && 'ZIP, ICS, or CSV file'}
                        {selectedSource === 'csv' && 'CSV file'}
                      </p>
                    </div>
                  )}
                </div>

                {/* CSV Column Mapping */}
                {selectedSource === 'csv' && csvPreview && (
                  <div className="mt-6">
                    <h3 className="font-medium text-gray-900 mb-3">Map Columns</h3>
                    <div className="grid grid-cols-2 gap-4">
                      {['name', 'email', 'phone', 'organization'].map(field => (
                        <div key={field}>
                          <label className="block text-sm font-medium text-gray-700 mb-1 capitalize">
                            {field}
                          </label>
                          <select
                            value={csvMapping[field as keyof typeof csvMapping]}
                            onChange={(e) => setCsvMapping({ ...csvMapping, [field]: e.target.value })}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                          >
                            <option value="">Select column</option>
                            {csvPreview.columns?.map((col: string) => (
                              <option key={col} value={col}>{col}</option>
                            ))}
                          </select>
                        </div>
                      ))}
                    </div>

                    {csvPreview.preview_rows?.length > 0 && (
                      <div className="mt-4">
                        <h4 className="text-sm font-medium text-gray-700 mb-2">Preview</h4>
                        <div className="overflow-x-auto border rounded-lg">
                          <table className="w-full text-sm">
                            <thead className="bg-gray-50">
                              <tr>
                                {csvPreview.columns?.map((col: string) => (
                                  <th key={col} className="px-3 py-2 text-left font-medium text-gray-600">
                                    {col}
                                  </th>
                                ))}
                              </tr>
                            </thead>
                            <tbody>
                              {csvPreview.preview_rows?.slice(0, 3).map((row: any, idx: number) => (
                                <tr key={idx} className="border-t">
                                  {csvPreview.columns?.map((col: string) => (
                                    <td key={col} className="px-3 py-2 text-gray-600">
                                      {row[col]}
                                    </td>
                                  ))}
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                <div className="mt-6 flex justify-between">
                  <button
                    onClick={() => setStep('type')}
                    className="text-gray-500 hover:text-gray-700"
                  >
                    &larr; Back
                  </button>
                  <button
                    onClick={startImport}
                    disabled={!selectedFile || uploading}
                    className="inline-flex items-center gap-2 px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {uploading ? (
                      <>
                        <Loader2 size={20} className="animate-spin" />
                        Uploading...
                      </>
                    ) : (
                      <>
                        Start Import
                        <ArrowRight size={20} />
                      </>
                    )}
                  </button>
                </div>
              </div>
            )}

            {/* Step 4: Progress */}
            {step === 'progress' && currentJob && (
              <div className="text-center">
                <div className="mb-6">
                  {currentJob.status === 'completed' ? (
                    <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto">
                      <CheckCircle size={40} className="text-green-600" />
                    </div>
                  ) : currentJob.status === 'failed' ? (
                    <div className="w-20 h-20 bg-red-100 rounded-full flex items-center justify-center mx-auto">
                      <XCircle size={40} className="text-red-600" />
                    </div>
                  ) : (
                    <div className="w-20 h-20 bg-blue-100 rounded-full flex items-center justify-center mx-auto">
                      <Loader2 size={40} className="text-blue-600 animate-spin" />
                    </div>
                  )}
                </div>

                <h2 className="text-xl font-semibold text-gray-900 mb-2">
                  {currentJob.status === 'completed' && 'Import Complete!'}
                  {currentJob.status === 'failed' && 'Import Failed'}
                  {currentJob.status === 'processing' && 'Importing...'}
                  {currentJob.status === 'pending' && 'Starting Import...'}
                </h2>

                <p className="text-gray-600 mb-6">
                  {currentJob.processed_items} of {currentJob.total_items} items processed
                </p>

                {/* Progress Bar */}
                <div className="max-w-md mx-auto mb-6">
                  <div className="w-full bg-gray-200 rounded-full h-3">
                    <div
                      className={`h-3 rounded-full transition-all ${
                        currentJob.status === 'completed' ? 'bg-green-500' :
                        currentJob.status === 'failed' ? 'bg-red-500' : 'bg-blue-500'
                      }`}
                      style={{ width: `${currentJob.progress}%` }}
                    />
                  </div>
                  <p className="text-sm text-gray-500 mt-2">{currentJob.progress}%</p>
                </div>

                {/* Errors */}
                {currentJob.errors && currentJob.errors.length > 0 && (
                  <div className="max-w-md mx-auto mb-6 text-left">
                    <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                      <h4 className="font-medium text-red-900 mb-2 flex items-center gap-2">
                        <AlertCircle size={16} />
                        {currentJob.error_count} error{currentJob.error_count !== 1 ? 's' : ''}
                      </h4>
                      <ul className="text-sm text-red-700 space-y-1">
                        {currentJob.errors.slice(0, 5).map((err, idx) => (
                          <li key={idx}>{err}</li>
                        ))}
                      </ul>
                    </div>
                  </div>
                )}

                <button
                  onClick={resetWizard}
                  className="inline-flex items-center gap-2 px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                >
                  {currentJob.status === 'completed' || currentJob.status === 'failed'
                    ? 'Start Another Import'
                    : 'Cancel'
                  }
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Past Imports */}
        {jobs.length > 0 && (
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
            <div className="px-6 py-4 border-b">
              <h2 className="font-semibold text-gray-900">Import History</h2>
            </div>
            <div className="divide-y">
              {jobs.map(job => (
                <div key={job.job_id} className="px-6 py-4 flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    {getStatusIcon(job.status)}
                    <div>
                      <p className="font-medium text-gray-900 capitalize">
                        {job.source} - {job.data_type}
                      </p>
                      <p className="text-sm text-gray-500">
                        {job.processed_items} items • {new Date(job.created_at).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                  <span className={`px-3 py-1 rounded-full text-xs font-medium ${getStatusColor(job.status)}`}>
                    {job.status}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </AdminLayout>
  );
}
