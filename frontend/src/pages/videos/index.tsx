import { useEffect, useState, useRef } from 'react';
import Head from 'next/head';
import { useRouter } from 'next/router';
import {
  Video,
  Upload,
  Search,
  Grid,
  List,
  Star,
  MoreVertical,
  Play,
  Clock,
  Eye,
  Plus,
  Trash2,
  X,
  FileVideo,
  Loader2,
} from 'lucide-react';
import AppSwitcherBar from '@/components/shared/AppSwitcherBar';
import DocsSidebar from '@/components/docs/DocsSidebar';
import { useRequireAuth } from '@/stores/authStore';
import { api } from '@/lib/api';

interface VideoItem {
  id: string;
  title: string;
  description?: string;
  thumbnail_url?: string;
  duration?: number;
  status: string;
  is_starred: boolean;
  view_count: number;
  created_at: string;
  updated_at: string;
}

export default function VideosPage() {
  const router = useRouter();
  const { isAuthenticated, isLoading: authLoading } = useRequireAuth();
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [videos, setVideos] = useState<VideoItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [searchQuery, setSearchQuery] = useState('');
  const [filter, setFilter] = useState<'all' | 'starred'>('all');
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploadTitle, setUploadTitle] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!authLoading && isAuthenticated) {
      fetchVideos();
    }
  }, [authLoading, isAuthenticated, filter]);

  const fetchVideos = async () => {
    setLoading(true);
    try {
      const params: any = {};
      if (filter === 'starred') params.starred = true;
      if (searchQuery) params.search = searchQuery;

      const response = await api.get('/videos', { params });
      setVideos(response.data);
    } catch (error) {
      console.error('Failed to fetch videos:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = () => {
    fetchVideos();
  };

  const handleStarToggle = async (video: VideoItem, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await api.post(`/videos/${video.id}/star`);
      fetchVideos();
    } catch (error) {
      console.error('Failed to toggle star:', error);
    }
  };

  const handleDelete = async (video: VideoItem, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm('Are you sure you want to delete this video?')) return;
    try {
      await api.delete(`/videos/${video.id}`);
      fetchVideos();
    } catch (error) {
      console.error('Failed to delete video:', error);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedFile(file);
      // Set default title from filename (without extension)
      const nameWithoutExt = file.name.replace(/\.[^/.]+$/, '');
      setUploadTitle(nameWithoutExt);
    }
  };

  const handleUpload = async () => {
    if (!selectedFile) return;

    setUploading(true);
    setUploadProgress(0);

    try {
      const formData = new FormData();
      formData.append('file', selectedFile);
      formData.append('title', uploadTitle || selectedFile.name);

      const response = await api.post('/videos/upload', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
        onUploadProgress: (progressEvent) => {
          const percent = progressEvent.total
            ? Math.round((progressEvent.loaded * 100) / progressEvent.total)
            : 0;
          setUploadProgress(percent);
        },
      });

      // Reset and close modal
      setShowUploadModal(false);
      setSelectedFile(null);
      setUploadTitle('');
      setUploadProgress(0);

      // Refresh video list
      fetchVideos();

      // Optionally navigate to the new video
      if (response.data?.id) {
        router.push(`/videos/${response.data.id}`);
      }
    } catch (error: any) {
      console.error('Failed to upload video:', error);
      alert(error.response?.data?.detail || 'Failed to upload video');
    } finally {
      setUploading(false);
    }
  };

  const openUploadModal = () => {
    setShowUploadModal(true);
    setSelectedFile(null);
    setUploadTitle('');
    setUploadProgress(0);
  };

  const formatDuration = (seconds?: number) => {
    if (!seconds) return '--:--';
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  };

  const filteredVideos = videos.filter((v) =>
    v.title.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Skip showing loading screen - LoginLoader already handles the transition
  if (authLoading) {
    return null;
  }

  return (
    <>
      <Head>
        <title>Videos | Bheem</title>
      </Head>

      <div className="min-h-screen flex bg-gray-100">
        {/* App Switcher Bar */}
        <AppSwitcherBar activeApp="docs" />

        {/* Docs Sidebar */}
        <div className="fixed left-[60px] top-0 bottom-0 w-[240px] z-40">
          <DocsSidebar activeType="videos" />
        </div>

        <div
          className="flex-1 transition-all duration-300 flex flex-col"
          style={{ marginLeft: 300 }}
        >

          <div className="flex-1 max-w-7xl mx-auto px-6 py-8 w-full">
            {/* Header */}
            <div className="flex items-center justify-between mb-6">
              <div>
                <h1 className="text-2xl font-bold text-gray-900">Bheem Videos</h1>
                <p className="text-gray-500">Upload and manage your video content</p>
              </div>
              <button
                onClick={openUploadModal}
                className="flex items-center gap-2 px-4 py-2.5 bg-red-500 text-white font-medium rounded-lg hover:bg-red-600 transition-colors"
              >
                <Upload size={20} />
                <span>Upload Video</span>
              </button>
            </div>

            {/* Toolbar */}
            <div className="bg-white rounded-xl border border-gray-200 p-4 mb-6">
              <div className="flex items-center justify-between gap-4">
                {/* Filters */}
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setFilter('all')}
                    className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
                      filter === 'all'
                        ? 'bg-red-100 text-red-700'
                        : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                    }`}
                  >
                    All Videos
                  </button>
                  <button
                    onClick={() => setFilter('starred')}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
                      filter === 'starred'
                        ? 'bg-yellow-100 text-yellow-700'
                        : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                    }`}
                  >
                    <Star size={14} />
                    <span>Starred</span>
                  </button>
                </div>

                {/* Search & View Toggle */}
                <div className="flex items-center gap-4">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                    <input
                      type="text"
                      placeholder="Search videos..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                      className="pl-10 pr-4 py-2 bg-gray-100 rounded-lg border-0 focus:ring-2 focus:ring-red-500 text-sm w-64"
                    />
                  </div>

                  <div className="flex bg-gray-100 rounded-lg p-1">
                    <button
                      onClick={() => setViewMode('grid')}
                      className={`p-1.5 rounded transition-colors ${
                        viewMode === 'grid' ? 'bg-white shadow-sm' : ''
                      }`}
                    >
                      <Grid size={18} className={viewMode === 'grid' ? 'text-red-500' : 'text-gray-500'} />
                    </button>
                    <button
                      onClick={() => setViewMode('list')}
                      className={`p-1.5 rounded transition-colors ${
                        viewMode === 'list' ? 'bg-white shadow-sm' : ''
                      }`}
                    >
                      <List size={18} className={viewMode === 'list' ? 'text-red-500' : 'text-gray-500'} />
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* Videos Grid/List */}
            {loading ? (
              <div className="flex items-center justify-center py-20">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-red-500" />
              </div>
            ) : filteredVideos.length === 0 ? (
              <div className="text-center py-20">
                <Video size={64} className="mx-auto text-gray-300 mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">No videos found</h3>
                <p className="text-gray-500 mb-6">Upload your first video to get started</p>
                <button
                  onClick={openUploadModal}
                  className="inline-flex items-center gap-2 px-4 py-2.5 bg-red-500 text-white font-medium rounded-lg hover:bg-red-600 transition-colors"
                >
                  <Plus size={20} />
                  <span>Upload Video</span>
                </button>
              </div>
            ) : (
              <div className={`grid gap-4 ${viewMode === 'grid' ? 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4' : 'grid-cols-1'}`}>
                {filteredVideos.map((video) => (
                  <VideoCard
                    key={video.id}
                    video={video}
                    viewMode={viewMode}
                    onOpen={() => router.push(`/videos/${video.id}`)}
                    onStar={(e) => handleStarToggle(video, e)}
                    onDelete={(e) => handleDelete(video, e)}
                    formatDuration={formatDuration}
                    formatDate={formatDate}
                  />
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Upload Modal */}
      {showUploadModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-lg mx-4">
            {/* Modal Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
              <h2 className="text-lg font-semibold text-gray-900">Upload Video</h2>
              <button
                onClick={() => setShowUploadModal(false)}
                className="p-1 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100"
              >
                <X size={20} />
              </button>
            </div>

            {/* Modal Content */}
            <div className="p-6">
              {/* Hidden file input */}
              <input
                ref={fileInputRef}
                type="file"
                accept="video/*"
                onChange={handleFileSelect}
                className="hidden"
              />

              {/* Drop zone / File selector */}
              {!selectedFile ? (
                <div
                  onClick={() => fileInputRef.current?.click()}
                  className="border-2 border-dashed border-gray-300 rounded-xl p-8 text-center cursor-pointer hover:border-red-400 hover:bg-red-50 transition-colors"
                >
                  <FileVideo size={48} className="mx-auto text-gray-400 mb-4" />
                  <p className="text-gray-600 mb-2">Click to select a video file</p>
                  <p className="text-sm text-gray-400">MP4, WebM, MOV, AVI supported</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {/* Selected file info */}
                  <div className="flex items-center gap-3 p-4 bg-gray-50 rounded-lg">
                    <FileVideo size={32} className="text-red-500" />
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-gray-900 truncate">{selectedFile.name}</p>
                      <p className="text-sm text-gray-500">
                        {(selectedFile.size / (1024 * 1024)).toFixed(2)} MB
                      </p>
                    </div>
                    <button
                      onClick={() => {
                        setSelectedFile(null);
                        setUploadTitle('');
                      }}
                      className="p-1 text-gray-400 hover:text-red-500"
                    >
                      <X size={18} />
                    </button>
                  </div>

                  {/* Title input */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Video Title
                    </label>
                    <input
                      type="text"
                      value={uploadTitle}
                      onChange={(e) => setUploadTitle(e.target.value)}
                      placeholder="Enter video title"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500"
                    />
                  </div>

                  {/* Upload progress */}
                  {uploading && (
                    <div>
                      <div className="flex items-center justify-between text-sm mb-1">
                        <span className="text-gray-600">Uploading...</span>
                        <span className="text-gray-900 font-medium">{uploadProgress}%</span>
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-2">
                        <div
                          className="bg-red-500 h-2 rounded-full transition-all duration-300"
                          style={{ width: `${uploadProgress}%` }}
                        />
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-gray-200 bg-gray-50 rounded-b-xl">
              <button
                onClick={() => setShowUploadModal(false)}
                disabled={uploading}
                className="px-4 py-2 text-gray-700 font-medium rounded-lg hover:bg-gray-100 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handleUpload}
                disabled={!selectedFile || uploading}
                className="flex items-center gap-2 px-4 py-2 bg-red-500 text-white font-medium rounded-lg hover:bg-red-600 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {uploading ? (
                  <>
                    <Loader2 size={18} className="animate-spin" />
                    <span>Uploading...</span>
                  </>
                ) : (
                  <>
                    <Upload size={18} />
                    <span>Upload</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

interface VideoCardProps {
  video: VideoItem;
  viewMode: 'grid' | 'list';
  onOpen: () => void;
  onStar: (e: React.MouseEvent) => void;
  onDelete: (e: React.MouseEvent) => void;
  formatDuration: (seconds?: number) => string;
  formatDate: (date: string) => string;
}

function VideoCard({ video, viewMode, onOpen, onStar, onDelete, formatDuration, formatDate }: VideoCardProps) {
  const [showMenu, setShowMenu] = useState(false);

  if (viewMode === 'list') {
    return (
      <div
        onClick={onOpen}
        className="flex items-center gap-4 p-4 bg-white rounded-xl border border-gray-200 hover:shadow-md hover:border-gray-300 cursor-pointer transition-all group"
      >
        {/* Thumbnail */}
        <div className="relative w-40 h-24 bg-gray-200 rounded-lg overflow-hidden flex-shrink-0">
          {video.thumbnail_url ? (
            <img src={video.thumbnail_url} alt={video.title} className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full flex items-center justify-center bg-red-50">
              <Video size={32} className="text-red-300" />
            </div>
          )}
          <div className="absolute bottom-1 right-1 bg-black/80 text-white text-xs px-1.5 py-0.5 rounded">
            {formatDuration(video.duration)}
          </div>
          <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
            <Play size={32} className="text-white" fill="white" />
          </div>
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0">
          <h3 className="font-medium text-gray-900 truncate">{video.title}</h3>
          <div className="flex items-center gap-3 mt-1 text-sm text-gray-500">
            <span className="flex items-center gap-1">
              <Eye size={14} />
              {video.view_count} views
            </span>
            <span>•</span>
            <span>{formatDate(video.updated_at)}</span>
            {video.status !== 'ready' && (
              <>
                <span>•</span>
                <span className="text-yellow-600 capitalize">{video.status}</span>
              </>
            )}
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2">
          <button
            onClick={onStar}
            className={`p-2 rounded-lg transition-colors ${
              video.is_starred
                ? 'text-yellow-500 hover:bg-yellow-50'
                : 'text-gray-400 hover:text-yellow-500 hover:bg-gray-50'
            }`}
          >
            <Star size={18} fill={video.is_starred ? 'currentColor' : 'none'} />
          </button>
          <button
            onClick={onDelete}
            className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
          >
            <Trash2 size={18} />
          </button>
        </div>
      </div>
    );
  }

  return (
    <div
      onClick={onOpen}
      className="bg-white rounded-xl border border-gray-200 hover:shadow-lg hover:border-gray-300 cursor-pointer transition-all overflow-hidden group"
    >
      {/* Thumbnail */}
      <div className="relative aspect-video bg-gray-200">
        {video.thumbnail_url ? (
          <img src={video.thumbnail_url} alt={video.title} className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-red-50">
            <Video size={48} className="text-red-300" />
          </div>
        )}
        <div className="absolute bottom-2 right-2 bg-black/80 text-white text-xs px-1.5 py-0.5 rounded">
          {formatDuration(video.duration)}
        </div>
        <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
          <div className="w-16 h-16 rounded-full bg-white/90 flex items-center justify-center">
            <Play size={32} className="text-red-500 ml-1" fill="currentColor" />
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="p-4">
        <div className="flex items-start justify-between gap-2">
          <h3 className="font-medium text-gray-900 truncate flex-1" title={video.title}>
            {video.title}
          </h3>
          <button
            onClick={onStar}
            className={`p-1 rounded transition-colors ${
              video.is_starred
                ? 'text-yellow-500'
                : 'text-gray-400 opacity-0 group-hover:opacity-100 hover:text-yellow-500'
            }`}
          >
            <Star size={16} fill={video.is_starred ? 'currentColor' : 'none'} />
          </button>
        </div>
        <div className="flex items-center gap-2 mt-2 text-sm text-gray-500">
          <span className="flex items-center gap-1">
            <Eye size={14} />
            {video.view_count}
          </span>
          <span>•</span>
          <span>{formatDate(video.updated_at)}</span>
        </div>
      </div>
    </div>
  );
}
