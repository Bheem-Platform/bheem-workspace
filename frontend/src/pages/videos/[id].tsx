import { useEffect, useState } from 'react';
import Head from 'next/head';
import { useRouter } from 'next/router';
import {
  ArrowLeft,
  Star,
  Share2,
  Download,
  MoreVertical,
  Play,
  Pause,
  Volume2,
  VolumeX,
  Maximize,
  Eye,
  Clock,
  Calendar,
  Loader2,
  AlertCircle,
} from 'lucide-react';
import AppSwitcherBar from '@/components/shared/AppSwitcherBar';
import { useRequireAuth } from '@/stores/authStore';
import { api } from '@/lib/api';

interface VideoDetails {
  id: string;
  title: string;
  description?: string;
  thumbnail_url?: string;
  file_path?: string;
  file_size?: number;
  duration?: number;
  format?: string;
  resolution?: string;
  status: string;
  processing_progress: number;
  is_starred: boolean;
  view_count: number;
  created_at: string;
  updated_at: string;
  settings: {
    autoplay?: boolean;
    loop?: boolean;
    muted?: boolean;
    allow_download?: boolean;
    privacy?: string;
  };
}

export default function VideoPlayerPage() {
  const router = useRouter();
  const { id } = router.query;
  const { isAuthenticated, isLoading: authLoading } = useRequireAuth();
  const [video, setVideo] = useState<VideoDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    if (id && isAuthenticated) {
      fetchVideo();
    }
  }, [id, isAuthenticated]);

  const fetchVideo = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await api.get(`/videos/${id}`);
      setVideo(response.data);
    } catch (err: any) {
      console.error('Failed to fetch video:', err);
      setError(err.response?.data?.detail || 'Failed to load video');
    } finally {
      setLoading(false);
    }
  };

  const toggleStar = async () => {
    if (!video) return;
    try {
      await api.post(`/videos/${video.id}/star`);
      setVideo({ ...video, is_starred: !video.is_starred });
    } catch (err) {
      console.error('Failed to toggle star:', err);
    }
  };

  const refreshShareUrl = async () => {
    if (!video) return;
    try {
      setRefreshing(true);
      const response = await api.post(`/videos/${video.id}/refresh-share`);
      if (response.data.share_url) {
        setVideo({ ...video, thumbnail_url: response.data.share_url });
      }
    } catch (err) {
      console.error('Failed to refresh share URL:', err);
      alert('Failed to refresh video link. Please try again.');
    } finally {
      setRefreshing(false);
    }
  };

  const formatDuration = (seconds?: number) => {
    if (!seconds) return '--:--';
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const formatFileSize = (bytes?: number) => {
    if (!bytes) return 'Unknown';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
    return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  // Get video URL for playback
  const getVideoUrl = () => {
    if (!video) return null;
    // Use the Nextcloud share URL (stored in thumbnail_url as download link)
    // The share URL was created during upload with direct download access
    if (video.thumbnail_url) {
      return video.thumbnail_url;
    }
    return null;
  };

  if (authLoading || loading) {
    return (
      <div className="min-h-screen bg-[#202124] flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-blue-500 animate-spin" />
      </div>
    );
  }

  if (error || !video) {
    return (
      <div className="min-h-screen bg-[#202124]">
        <AppSwitcherBar />
        <div className="flex flex-col items-center justify-center h-[calc(100vh-48px)]">
          <AlertCircle className="w-16 h-16 text-red-500 mb-4" />
          <h2 className="text-xl text-white mb-2">Video Not Found</h2>
          <p className="text-gray-400 mb-4">{error || 'The video you are looking for does not exist.'}</p>
          <button
            onClick={() => router.push('/videos')}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            Back to Videos
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#202124]">
      <Head>
        <title>{video.title} - Bheem Videos</title>
      </Head>

      <AppSwitcherBar />

      <div className="max-w-7xl mx-auto px-4 py-6">
        {/* Back button and title */}
        <div className="flex items-center gap-4 mb-6">
          <button
            onClick={() => router.push('/videos')}
            className="p-2 hover:bg-[#3c4043] rounded-full text-gray-300"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <h1 className="text-xl font-medium text-white truncate">{video.title}</h1>
          <div className="flex-1" />
          <button
            onClick={toggleStar}
            className={`p-2 rounded-full ${video.is_starred ? 'text-yellow-400' : 'text-gray-400 hover:text-yellow-400'}`}
          >
            <Star className={`w-5 h-5 ${video.is_starred ? 'fill-current' : ''}`} />
          </button>
          <button className="p-2 hover:bg-[#3c4043] rounded-full text-gray-400">
            <Share2 className="w-5 h-5" />
          </button>
          <button className="p-2 hover:bg-[#3c4043] rounded-full text-gray-400">
            <MoreVertical className="w-5 h-5" />
          </button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Video Player */}
          <div className="lg:col-span-2">
            <div className="bg-black rounded-xl overflow-hidden aspect-video relative">
              {video.status === 'ready' && getVideoUrl() ? (
                <video
                  src={getVideoUrl() || undefined}
                  className="w-full h-full"
                  controls
                  autoPlay={video.settings?.autoplay}
                  loop={video.settings?.loop}
                  muted={video.settings?.muted}
                >
                  Your browser does not support the video tag.
                </video>
              ) : video.status === 'ready' && !getVideoUrl() ? (
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <AlertCircle className="w-12 h-12 text-yellow-500 mb-4" />
                  <p className="text-white text-lg mb-2">Video link not available</p>
                  <p className="text-gray-400 text-sm mb-4">Click refresh to generate a playback link</p>
                  <button
                    onClick={refreshShareUrl}
                    disabled={refreshing}
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2"
                  >
                    {refreshing ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Refreshing...
                      </>
                    ) : (
                      'Refresh Video Link'
                    )}
                  </button>
                </div>
              ) : video.status === 'processing' ? (
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <Loader2 className="w-12 h-12 text-blue-500 animate-spin mb-4" />
                  <p className="text-white text-lg">Processing video...</p>
                  <p className="text-gray-400">{video.processing_progress}% complete</p>
                </div>
              ) : video.status === 'uploading' ? (
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <Loader2 className="w-12 h-12 text-blue-500 animate-spin mb-4" />
                  <p className="text-white text-lg">Uploading video...</p>
                </div>
              ) : (
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <AlertCircle className="w-12 h-12 text-red-500 mb-4" />
                  <p className="text-white text-lg">Video unavailable</p>
                  <p className="text-gray-400 text-sm">{video.status}</p>
                </div>
              )}
            </div>

            {/* Video description */}
            {video.description && (
              <div className="mt-4 p-4 bg-[#292a2d] rounded-lg">
                <h3 className="text-white font-medium mb-2">Description</h3>
                <p className="text-gray-300 whitespace-pre-wrap">{video.description}</p>
              </div>
            )}
          </div>

          {/* Video Info Sidebar */}
          <div className="space-y-4">
            {/* Stats */}
            <div className="bg-[#292a2d] rounded-lg p-4">
              <h3 className="text-white font-medium mb-4">Video Information</h3>
              <div className="space-y-3">
                <div className="flex items-center gap-3 text-gray-300">
                  <Eye className="w-4 h-4 text-gray-500" />
                  <span>{video.view_count.toLocaleString()} views</span>
                </div>
                <div className="flex items-center gap-3 text-gray-300">
                  <Clock className="w-4 h-4 text-gray-500" />
                  <span>Duration: {formatDuration(video.duration)}</span>
                </div>
                <div className="flex items-center gap-3 text-gray-300">
                  <Calendar className="w-4 h-4 text-gray-500" />
                  <span>Uploaded: {formatDate(video.created_at)}</span>
                </div>
              </div>
            </div>

            {/* Technical Info */}
            <div className="bg-[#292a2d] rounded-lg p-4">
              <h3 className="text-white font-medium mb-4">Technical Details</h3>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-500">Format</span>
                  <span className="text-gray-300">{video.format || 'Unknown'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Resolution</span>
                  <span className="text-gray-300">{video.resolution || 'Unknown'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">File Size</span>
                  <span className="text-gray-300">{formatFileSize(video.file_size)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Status</span>
                  <span className={`capitalize ${
                    video.status === 'ready' ? 'text-green-400' :
                    video.status === 'processing' ? 'text-yellow-400' :
                    video.status === 'error' ? 'text-red-400' : 'text-gray-300'
                  }`}>
                    {video.status}
                  </span>
                </div>
              </div>
            </div>

            {/* Download button */}
            {video.status === 'ready' && video.settings?.allow_download && video.thumbnail_url && (
              <a
                href={video.thumbnail_url}
                download={`${video.title}.${video.format?.toLowerCase() || 'mp4'}`}
                className="flex items-center justify-center gap-2 w-full py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                <Download className="w-5 h-5" />
                Download Video
              </a>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
