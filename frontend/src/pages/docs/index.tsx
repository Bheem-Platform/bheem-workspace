import { useEffect, useState } from 'react';
import Layout from '@/components/Layout';
import {
  FileText,
  Folder,
  Upload,
  Plus,
  Grid,
  List,
  Search,
  MoreVertical,
  Download,
  Share2,
  Trash2,
  Edit,
  Eye,
  ChevronRight,
} from 'lucide-react';

interface FileItem {
  name: string;
  path: string;
  type: 'file' | 'folder';
  size?: number;
  modified?: string;
  mime_type?: string;
}

export default function DocsPage() {
  const [files, setFiles] = useState<FileItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentPath, setCurrentPath] = useState('/');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [searchQuery, setSearchQuery] = useState('');
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [selectedFile, setSelectedFile] = useState<FileItem | null>(null);

  useEffect(() => {
    // Mock data
    setFiles([
      { name: 'Documents', path: '/Documents', type: 'folder' },
      { name: 'Shared', path: '/Shared', type: 'folder' },
      { name: 'Meeting Notes', path: '/Meeting Notes', type: 'folder' },
      { name: 'Project Proposal.docx', path: '/Project Proposal.docx', type: 'file', size: 245760, modified: new Date().toISOString(), mime_type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' },
      { name: 'Budget 2024.xlsx', path: '/Budget 2024.xlsx', type: 'file', size: 102400, modified: new Date(Date.now() - 86400000).toISOString(), mime_type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' },
      { name: 'Presentation.pptx', path: '/Presentation.pptx', type: 'file', size: 5242880, modified: new Date(Date.now() - 172800000).toISOString(), mime_type: 'application/vnd.openxmlformats-officedocument.presentationml.presentation' },
    ]);
    setLoading(false);
  }, [currentPath]);

  const formatFileSize = (bytes?: number) => {
    if (!bytes) return '-';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const getFileIcon = (item: FileItem) => {
    if (item.type === 'folder') return <Folder className="text-yellow-500" size={24} />;

    const ext = item.name.split('.').pop()?.toLowerCase();
    switch (ext) {
      case 'doc':
      case 'docx':
        return <FileText className="text-blue-500" size={24} />;
      case 'xls':
      case 'xlsx':
        return <FileText className="text-green-500" size={24} />;
      case 'ppt':
      case 'pptx':
        return <FileText className="text-orange-500" size={24} />;
      case 'pdf':
        return <FileText className="text-red-500" size={24} />;
      default:
        return <FileText className="text-gray-500" size={24} />;
    }
  };

  const navigateTo = (path: string) => {
    setCurrentPath(path);
  };

  const openFile = (item: FileItem) => {
    if (item.type === 'folder') {
      navigateTo(item.path);
    } else {
      // Open in OnlyOffice editor
      window.open(`/docs/edit?path=${encodeURIComponent(item.path)}`, '_blank');
    }
  };

  const breadcrumbs = currentPath.split('/').filter(Boolean);

  const filteredFiles = files.filter((f) =>
    f.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <Layout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Bheem Docs</h1>
            <p className="text-gray-500">Manage and collaborate on documents</p>
          </div>
          <div className="flex space-x-3">
            <button
              onClick={() => setShowUploadModal(true)}
              className="flex items-center space-x-2 px-4 py-2 bg-white border border-gray-200 text-gray-700 rounded-lg hover:bg-gray-50"
            >
              <Upload size={20} />
              <span>Upload</span>
            </button>
            <button className="flex items-center space-x-2 px-4 py-2 bg-bheem-primary text-white rounded-lg hover:bg-bheem-secondary">
              <Plus size={20} />
              <span>New</span>
            </button>
          </div>
        </div>

        {/* Toolbar */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
          <div className="flex items-center justify-between">
            {/* Breadcrumb */}
            <div className="flex items-center space-x-2 text-sm">
              <button
                onClick={() => navigateTo('/')}
                className="text-bheem-primary hover:underline"
              >
                Home
              </button>
              {breadcrumbs.map((crumb, idx) => (
                <span key={idx} className="flex items-center">
                  <ChevronRight size={16} className="text-gray-400 mx-1" />
                  <button
                    onClick={() => navigateTo('/' + breadcrumbs.slice(0, idx + 1).join('/'))}
                    className="text-bheem-primary hover:underline"
                  >
                    {crumb}
                  </button>
                </span>
              ))}
            </div>

            <div className="flex items-center space-x-4">
              {/* Search */}
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                <input
                  type="text"
                  placeholder="Search files..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9 pr-4 py-2 bg-gray-100 rounded-lg border-0 focus:ring-2 focus:ring-bheem-primary text-sm"
                />
              </div>

              {/* View Toggle */}
              <div className="flex bg-gray-100 rounded-lg p-1">
                <button
                  onClick={() => setViewMode('grid')}
                  className={`p-1.5 rounded ${viewMode === 'grid' ? 'bg-white shadow-sm' : ''}`}
                >
                  <Grid size={18} className={viewMode === 'grid' ? 'text-bheem-primary' : 'text-gray-500'} />
                </button>
                <button
                  onClick={() => setViewMode('list')}
                  className={`p-1.5 rounded ${viewMode === 'list' ? 'bg-white shadow-sm' : ''}`}
                >
                  <List size={18} className={viewMode === 'list' ? 'text-bheem-primary' : 'text-gray-500'} />
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Files */}
        {loading ? (
          <div className="flex items-center justify-center h-64">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-bheem-primary"></div>
          </div>
        ) : viewMode === 'grid' ? (
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
            {filteredFiles.map((item) => (
              <div
                key={item.path}
                onClick={() => openFile(item)}
                className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 hover:shadow-md transition-shadow cursor-pointer group"
              >
                <div className="flex flex-col items-center">
                  <div className="w-16 h-16 flex items-center justify-center mb-3">
                    {getFileIcon(item)}
                  </div>
                  <p className="text-sm font-medium text-gray-900 text-center truncate w-full">
                    {item.name}
                  </p>
                  {item.type === 'file' && (
                    <p className="text-xs text-gray-500 mt-1">
                      {formatFileSize(item.size)}
                    </p>
                  )}
                </div>
                <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setSelectedFile(item);
                    }}
                    className="p-1 hover:bg-gray-100 rounded"
                  >
                    <MoreVertical size={16} className="text-gray-500" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="bg-white rounded-xl shadow-sm border border-gray-100">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-100">
                <tr>
                  <th className="text-left px-4 py-3 text-sm font-medium text-gray-500">Name</th>
                  <th className="text-left px-4 py-3 text-sm font-medium text-gray-500">Modified</th>
                  <th className="text-left px-4 py-3 text-sm font-medium text-gray-500">Size</th>
                  <th className="text-right px-4 py-3 text-sm font-medium text-gray-500">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredFiles.map((item) => (
                  <tr
                    key={item.path}
                    onClick={() => openFile(item)}
                    className="border-b border-gray-100 last:border-0 hover:bg-gray-50 cursor-pointer"
                  >
                    <td className="px-4 py-3">
                      <div className="flex items-center space-x-3">
                        {getFileIcon(item)}
                        <span className="font-medium text-gray-900">{item.name}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-500">
                      {item.modified ? new Date(item.modified).toLocaleDateString() : '-'}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-500">
                      {formatFileSize(item.size)}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end space-x-2">
                        {item.type === 'file' && (
                          <>
                            <button className="p-1.5 text-gray-500 hover:text-bheem-primary hover:bg-gray-100 rounded">
                              <Eye size={16} />
                            </button>
                            <button className="p-1.5 text-gray-500 hover:text-bheem-primary hover:bg-gray-100 rounded">
                              <Download size={16} />
                            </button>
                          </>
                        )}
                        <button className="p-1.5 text-gray-500 hover:text-bheem-primary hover:bg-gray-100 rounded">
                          <Share2 size={16} />
                        </button>
                        <button className="p-1.5 text-gray-500 hover:text-red-500 hover:bg-gray-100 rounded">
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {filteredFiles.length === 0 && !loading && (
          <div className="text-center py-12">
            <FileText size={48} className="mx-auto text-gray-300 mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">No files found</h3>
            <p className="text-gray-500 mb-4">
              {searchQuery ? 'Try a different search term' : 'Upload files or create new documents'}
            </p>
            <button
              onClick={() => setShowUploadModal(true)}
              className="inline-flex items-center space-x-2 px-4 py-2 bg-bheem-primary text-white rounded-lg hover:bg-bheem-secondary"
            >
              <Upload size={20} />
              <span>Upload Files</span>
            </button>
          </div>
        )}
      </div>

      {/* Upload Modal */}
      {showUploadModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md mx-4">
            <div className="p-6">
              <h2 className="text-xl font-semibold text-gray-900 mb-4">Upload Files</h2>
              <div className="border-2 border-dashed border-gray-300 rounded-xl p-8 text-center">
                <Upload size={48} className="mx-auto text-gray-400 mb-4" />
                <p className="text-gray-600 mb-2">Drag and drop files here</p>
                <p className="text-gray-400 text-sm mb-4">or</p>
                <button className="px-4 py-2 bg-bheem-primary text-white rounded-lg hover:bg-bheem-secondary">
                  Browse Files
                </button>
              </div>
            </div>
            <div className="px-6 py-4 bg-gray-50 rounded-b-xl flex justify-end">
              <button
                onClick={() => setShowUploadModal(false)}
                className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </Layout>
  );
}
