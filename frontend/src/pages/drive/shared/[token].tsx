/**
 * Bheem Drive - Public Shared Link Page
 * Allows public access to shared files without authentication
 */
import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import { motion } from 'framer-motion';
import {
  Download,
  Eye,
  FileText,
  Image,
  Video,
  Music,
  Archive,
  File,
  Lock,
  AlertCircle,
  Loader2,
  ExternalLink,
} from 'lucide-react';
import axios from 'axios';

const BRAND = {
  pink: '#FFCCF2',
  purple: '#977DFF',
  blue: '#0033FF',
  gradient: 'from-[#FFCCF2] via-[#977DFF] to-[#0033FF]',
};

interface SharedFile {
  id: string;
  name: string;
  file_type: string;
  mime_type: string;
  size_bytes: number;
  created_at: string;
  updated_at: string;
}

const getFileIcon = (fileType: string, mimeType: string) => {
  if (fileType === 'folder') return File;
  if (mimeType?.startsWith('image/')) return Image;
  if (mimeType?.startsWith('video/')) return Video;
  if (mimeType?.startsWith('audio/')) return Music;
  if (mimeType?.includes('zip') || mimeType?.includes('rar') || mimeType?.includes('7z')) return Archive;
  if (mimeType?.includes('pdf') || mimeType?.includes('document') || mimeType?.includes('text')) return FileText;
  return File;
};

const formatFileSize = (bytes: number): string => {
  if (!bytes) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
};

const canPreview = (mimeType: string): boolean => {
  if (!mimeType) return false;
  return (
    mimeType.startsWith('image/') ||
    mimeType.startsWith('video/') ||
    mimeType.startsWith('audio/') ||
    mimeType === 'application/pdf' ||
    mimeType.startsWith('text/')
  );
};

export default function SharedFilePage() {
  const router = useRouter();
  const { token } = router.query;

  const [file, setFile] = useState<SharedFile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [needsPassword, setNeedsPassword] = useState(false);
  const [password, setPassword] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [downloading, setDownloading] = useState(false);

  // Use relative URL for API calls - gets proxied through Next.js
  const API_BASE = '/api/v1';

  useEffect(() => {
    if (token) {
      fetchSharedFile();
    }
  }, [token]);

  const fetchSharedFile = async (pwd?: string) => {
    try {
      setLoading(true);
      setError(null);
      setPasswordError('');

      const url = pwd
        ? `${API_BASE}/drive/public/${token}?password=${encodeURIComponent(pwd)}`
        : `${API_BASE}/drive/public/${token}`;

      const response = await axios.get(url);
      setFile(response.data);
      setNeedsPassword(false);
    } catch (err: any) {
      if (err.response?.status === 404) {
        // Check if it's a password-protected file
        const detail = err.response?.data?.detail || '';
        if (detail.toLowerCase().includes('password')) {
          setNeedsPassword(true);
          if (pwd) {
            setPasswordError('Incorrect password. Please try again.');
          }
        } else {
          setError('This link is invalid or has expired.');
        }
      } else {
        setError('Failed to load shared file. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handlePasswordSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (password.trim()) {
      fetchSharedFile(password);
    }
  };

  const handleDownload = async () => {
    if (!file) return;

    try {
      setDownloading(true);
      const url = password
        ? `${API_BASE}/drive/public/${token}/download?password=${encodeURIComponent(password)}`
        : `${API_BASE}/drive/public/${token}/download`;

      const response = await axios.get(url, { responseType: 'blob' });

      // Create download link
      const blob = new Blob([response.data], { type: file.mime_type });
      const downloadUrl = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = downloadUrl;
      link.download = file.name;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(downloadUrl);
    } catch (err) {
      console.error('Download failed:', err);
    } finally {
      setDownloading(false);
    }
  };

  const handlePreview = () => {
    if (!file) return;

    const url = password
      ? `${API_BASE}/drive/public/${token}/preview?password=${encodeURIComponent(password)}`
      : `${API_BASE}/drive/public/${token}/preview`;

    window.open(url, '_blank');
  };

  // Loading state
  if (loading) {
    return (
      <>
        <Head>
          <title>Loading... - Bheem Drive</title>
        </Head>
        <div className="min-h-screen flex items-center justify-center bg-gray-50">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="text-center"
          >
            <Loader2 className="w-12 h-12 animate-spin text-[#977DFF] mx-auto mb-4" />
            <p className="text-gray-600">Loading shared file...</p>
          </motion.div>
        </div>
      </>
    );
  }

  // Password required state
  if (needsPassword) {
    return (
      <>
        <Head>
          <title>Password Required - Bheem Drive</title>
        </Head>
        <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="max-w-md w-full"
          >
            <div className={`bg-gradient-to-r ${BRAND.gradient} p-[2px] rounded-2xl`}>
              <div className="bg-white rounded-2xl p-8">
                <div className="text-center mb-6">
                  <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-purple-100 flex items-center justify-center">
                    <Lock className="w-8 h-8 text-[#977DFF]" />
                  </div>
                  <h1 className="text-2xl font-bold text-gray-900">Password Protected</h1>
                  <p className="text-gray-600 mt-2">This file requires a password to access.</p>
                </div>

                <form onSubmit={handlePasswordSubmit} className="space-y-4">
                  <div>
                    <input
                      type="password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="Enter password"
                      className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-[#977DFF] focus:border-transparent outline-none transition-all"
                      autoFocus
                    />
                    {passwordError && (
                      <p className="text-red-500 text-sm mt-2">{passwordError}</p>
                    )}
                  </div>
                  <motion.button
                    type="submit"
                    className={`w-full py-3 px-4 rounded-xl font-semibold text-white bg-gradient-to-r ${BRAND.gradient}`}
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                  >
                    Access File
                  </motion.button>
                </form>
              </div>
            </div>
          </motion.div>
        </div>
      </>
    );
  }

  // Error state
  if (error) {
    return (
      <>
        <Head>
          <title>Error - Bheem Drive</title>
        </Head>
        <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="max-w-md w-full bg-white rounded-2xl shadow-xl p-8 text-center"
          >
            <div className="w-16 h-16 mx-auto mb-6 rounded-full bg-red-100 flex items-center justify-center">
              <AlertCircle className="w-8 h-8 text-red-500" />
            </div>
            <h1 className="text-2xl font-bold text-gray-900 mb-3">Link Not Found</h1>
            <p className="text-gray-600 mb-6">{error}</p>
            <motion.button
              onClick={() => router.push('/')}
              className={`py-3 px-6 rounded-xl font-semibold text-white bg-gradient-to-r ${BRAND.gradient}`}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
            >
              Go to Bheem
            </motion.button>
          </motion.div>
        </div>
      </>
    );
  }

  // File display
  if (!file) return null;

  const FileIcon = getFileIcon(file.file_type, file.mime_type);
  const showPreview = canPreview(file.mime_type);

  return (
    <>
      <Head>
        <title>{file.name} - Bheem Drive</title>
      </Head>
      <div className="min-h-screen bg-gray-50">
        {/* Header */}
        <header className="bg-white border-b border-gray-200">
          <div className="max-w-4xl mx-auto px-4 py-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <h1 className={`text-2xl font-bold bg-gradient-to-r ${BRAND.gradient} bg-clip-text text-transparent`}>
                Bheem Drive
              </h1>
            </div>
            <a
              href="https://workspace.bheem.cloud"
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm text-gray-500 hover:text-[#977DFF] flex items-center gap-1 transition-colors"
            >
              Open Bheem Workspace
              <ExternalLink className="w-4 h-4" />
            </a>
          </div>
        </header>

        {/* Main content */}
        <main className="max-w-4xl mx-auto px-4 py-12">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-white rounded-2xl shadow-lg overflow-hidden"
          >
            {/* File preview area */}
            {showPreview && file.mime_type?.startsWith('image/') && (
              <div className="bg-gray-100 p-8 flex items-center justify-center">
                <img
                  src={`${API_BASE}/drive/public/${token}/preview${password ? `?password=${encodeURIComponent(password)}` : ''}`}
                  alt={file.name}
                  className="max-w-full max-h-96 object-contain rounded-lg shadow"
                />
              </div>
            )}

            {/* File info */}
            <div className="p-8">
              <div className="flex items-start gap-4">
                <div className={`p-4 rounded-xl bg-gradient-to-br ${BRAND.gradient} bg-opacity-10`}>
                  <FileIcon className="w-8 h-8 text-[#977DFF]" />
                </div>
                <div className="flex-1 min-w-0">
                  <h2 className="text-xl font-semibold text-gray-900 truncate">{file.name}</h2>
                  <p className="text-gray-500 mt-1">
                    {formatFileSize(file.size_bytes)} • {file.mime_type || 'Unknown type'}
                  </p>
                </div>
              </div>

              {/* Actions */}
              <div className="mt-8 flex flex-wrap gap-4">
                <motion.button
                  onClick={handleDownload}
                  disabled={downloading}
                  className={`flex-1 min-w-[200px] py-3 px-6 rounded-xl font-semibold text-white bg-gradient-to-r ${BRAND.gradient} flex items-center justify-center gap-2 disabled:opacity-50`}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                >
                  {downloading ? (
                    <Loader2 className="w-5 h-5 animate-spin" />
                  ) : (
                    <Download className="w-5 h-5" />
                  )}
                  {downloading ? 'Downloading...' : 'Download'}
                </motion.button>

                {showPreview && (
                  <motion.button
                    onClick={handlePreview}
                    className="flex-1 min-w-[200px] py-3 px-6 rounded-xl font-semibold text-[#977DFF] border-2 border-[#977DFF] flex items-center justify-center gap-2 hover:bg-purple-50 transition-colors"
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                  >
                    <Eye className="w-5 h-5" />
                    Preview
                  </motion.button>
                )}
              </div>
            </div>
          </motion.div>

          {/* Footer note */}
          <p className="text-center text-gray-400 text-sm mt-8">
            Shared via Bheem Drive - Secure file sharing for your workspace
          </p>
        </main>
      </div>
    </>
  );
}
