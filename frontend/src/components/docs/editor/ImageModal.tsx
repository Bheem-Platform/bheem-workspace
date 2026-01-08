/**
 * Bheem Docs - Image Insert Modal
 */
import { useState, useRef } from 'react';
import { X, Image as ImageIcon, Upload, Link } from 'lucide-react';

interface ImageModalProps {
  onSubmit: (url: string, alt: string) => void;
  onClose: () => void;
}

export default function ImageModal({ onSubmit, onClose }: ImageModalProps) {
  const [tab, setTab] = useState<'url' | 'upload'>('url');
  const [url, setUrl] = useState('');
  const [alt, setAlt] = useState('');
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (url) {
      onSubmit(url, alt);
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    try {
      // Convert to base64 for now (in production, upload to server)
      const reader = new FileReader();
      reader.onloadend = () => {
        setUrl(reader.result as string);
        setAlt(file.name.split('.')[0]);
        setUploading(false);
      };
      reader.readAsDataURL(file);
    } catch (error) {
      console.error('Upload failed:', error);
      setUploading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md">
        <div className="flex items-center justify-between px-6 py-4 border-b">
          <div className="flex items-center gap-2">
            <ImageIcon size={20} className="text-green-600" />
            <h2 className="text-lg font-semibold">Insert Image</h2>
          </div>
          <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded">
            <X size={20} />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b">
          <button
            onClick={() => setTab('url')}
            className={`flex-1 px-4 py-3 text-sm font-medium ${
              tab === 'url'
                ? 'text-blue-600 border-b-2 border-blue-600'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            <div className="flex items-center justify-center gap-2">
              <Link size={16} />
              By URL
            </div>
          </button>
          <button
            onClick={() => setTab('upload')}
            className={`flex-1 px-4 py-3 text-sm font-medium ${
              tab === 'upload'
                ? 'text-blue-600 border-b-2 border-blue-600'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            <div className="flex items-center justify-center gap-2">
              <Upload size={16} />
              Upload
            </div>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {tab === 'url' ? (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Image URL
              </label>
              <input
                type="text"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="https://example.com/image.jpg"
                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                autoFocus
              />
            </div>
          ) : (
            <div>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleFileChange}
                className="hidden"
              />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading}
                className="w-full py-8 border-2 border-dashed border-gray-300 rounded-lg hover:border-blue-500 hover:bg-blue-50 transition-colors"
              >
                <div className="flex flex-col items-center gap-2 text-gray-500">
                  <Upload size={32} />
                  <span>{uploading ? 'Uploading...' : 'Click to upload an image'}</span>
                  <span className="text-xs">PNG, JPG, GIF up to 10MB</span>
                </div>
              </button>
            </div>
          )}

          {url && (
            <div className="border rounded-lg p-2 bg-gray-50">
              <img src={url} alt="Preview" className="max-h-40 mx-auto rounded" />
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Alt Text
            </label>
            <input
              type="text"
              value={alt}
              onChange={(e) => setAlt(e.target.value)}
              placeholder="Describe the image"
              className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>

          <div className="flex justify-end gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!url}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
            >
              Insert Image
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
