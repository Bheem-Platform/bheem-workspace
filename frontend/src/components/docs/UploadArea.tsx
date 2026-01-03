import { useCallback, useState } from 'react';
import { useDropzone } from 'react-dropzone';
import { Upload, X, File, CheckCircle, AlertCircle } from 'lucide-react';
import { useDocsStore } from '@/stores/docsStore';
import { formatFileSize } from '@/lib/docsApi';

interface UploadAreaProps {
  onClose?: () => void;
}

export default function UploadArea({ onClose }: UploadAreaProps) {
  const { uploadFiles, uploadQueue, isUploading } = useDocsStore();
  const [dragActive, setDragActive] = useState(false);

  const onDrop = useCallback((acceptedFiles: File[]) => {
    if (acceptedFiles.length > 0) {
      uploadFiles(acceptedFiles);
    }
  }, [uploadFiles]);

  const { getRootProps, getInputProps, isDragActive, open } = useDropzone({
    onDrop,
    noClick: true,
    onDragEnter: () => setDragActive(true),
    onDragLeave: () => setDragActive(false),
  });

  return (
    <div className="bg-white rounded-2xl shadow-xl border border-gray-200 p-6 max-w-lg w-full">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-lg font-semibold text-gray-900">Upload Files</h2>
        {onClose && (
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <X size={20} className="text-gray-500" />
          </button>
        )}
      </div>

      {/* Drop Zone */}
      <div
        {...getRootProps()}
        className={`
          relative border-2 border-dashed rounded-xl p-8 text-center transition-colors
          ${isDragActive || dragActive
            ? 'border-purple-500 bg-purple-50'
            : 'border-gray-300 hover:border-gray-400'
          }
        `}
      >
        <input {...getInputProps()} />
        <Upload
          size={48}
          className={`mx-auto mb-4 ${isDragActive ? 'text-purple-500' : 'text-gray-400'}`}
        />
        <p className="text-gray-900 font-medium mb-1">
          {isDragActive ? 'Drop files here' : 'Drag and drop files here'}
        </p>
        <p className="text-sm text-gray-500 mb-4">or</p>
        <button
          onClick={open}
          disabled={isUploading}
          className="px-6 py-2.5 bg-purple-500 text-white font-medium rounded-lg hover:bg-purple-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          Browse Files
        </button>
      </div>

      {/* Upload Queue */}
      {uploadQueue.length > 0 && (
        <div className="mt-6 space-y-3">
          <h3 className="text-sm font-medium text-gray-700">
            {isUploading ? 'Uploading...' : 'Upload Complete'}
          </h3>
          {uploadQueue.map((item) => (
            <div
              key={item.id}
              className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg"
            >
              <div className="flex-shrink-0">
                {item.status === 'completed' ? (
                  <CheckCircle size={20} className="text-green-500" />
                ) : item.status === 'failed' ? (
                  <AlertCircle size={20} className="text-red-500" />
                ) : (
                  <File size={20} className="text-gray-400" />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-900 truncate">
                  {item.filename}
                </p>
                {item.status === 'uploading' && (
                  <div className="mt-1 w-full bg-gray-200 rounded-full h-1.5">
                    <div
                      className="bg-purple-500 h-1.5 rounded-full transition-all"
                      style={{ width: `${item.progress}%` }}
                    />
                  </div>
                )}
              </div>
              <span className="text-xs text-gray-500">
                {item.status === 'uploading'
                  ? `${item.progress}%`
                  : item.status === 'completed'
                  ? 'Done'
                  : item.status === 'failed'
                  ? 'Failed'
                  : 'Pending'}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// Overlay version for modal
export function UploadModal({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative z-10">
        <UploadArea onClose={onClose} />
      </div>
    </div>
  );
}
