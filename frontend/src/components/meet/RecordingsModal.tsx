'use client';

import { useState, useRef, useEffect } from 'react';
import { useMeetStore } from '@/stores/meetStore';
import type { Recording } from '@/types/meet';

function formatDuration(seconds: number): string {
  const hrs = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;

  if (hrs > 0) {
    return `${hrs}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export default function RecordingsModal() {
  const {
    isRecordingsModalOpen,
    closeRecordingsModal,
    recordings,
    currentTranscript,
    fetchTranscript,
    requestTranscription,
    deleteRecording,
    createShareLink,
    loading,
  } = useMeetStore();

  const [selectedRecording, setSelectedRecording] = useState<Recording | null>(null);
  const [showTranscript, setShowTranscript] = useState(false);
  const [shareUrl, setShareUrl] = useState<string | null>(null);
  const [processingId, setProcessingId] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    if (!isRecordingsModalOpen) {
      setSelectedRecording(null);
      setShowTranscript(false);
      setShareUrl(null);
    }
  }, [isRecordingsModalOpen]);

  const handleSelectRecording = async (recording: Recording) => {
    setSelectedRecording(recording);
    setShowTranscript(false);
    setShareUrl(null);

    if (recording.hasTranscript) {
      await fetchTranscript(recording.id);
    }
  };

  const handleRequestTranscript = async () => {
    if (!selectedRecording) return;

    setProcessingId(selectedRecording.id);
    await requestTranscription(selectedRecording.id);
    setProcessingId(null);
  };

  const handleShare = async () => {
    if (!selectedRecording) return;

    const url = await createShareLink(selectedRecording.id);
    if (url) {
      setShareUrl(url);
      navigator.clipboard.writeText(url);
    }
  };

  const handleDelete = async () => {
    if (!selectedRecording) return;

    if (confirm('Are you sure you want to delete this recording?')) {
      await deleteRecording(selectedRecording.id);
      setSelectedRecording(null);
    }
  };

  if (!isRecordingsModalOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70">
      <div className="bg-gray-900 rounded-xl shadow-2xl w-full max-w-5xl max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-700">
          <h2 className="text-xl font-semibold text-white">Recordings</h2>
          <button
            onClick={closeRecordingsModal}
            className="p-2 text-gray-400 hover:text-white rounded-lg hover:bg-gray-800"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="flex flex-1 min-h-0">
          {/* Recordings list */}
          <div className="w-80 border-r border-gray-700 overflow-y-auto">
            {recordings.length === 0 ? (
              <div className="p-6 text-center text-gray-400">
                <svg className="w-12 h-12 mx-auto mb-3 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                </svg>
                <p>No recordings yet</p>
              </div>
            ) : (
              <div className="divide-y divide-gray-700">
                {recordings.map((recording) => (
                  <button
                    key={recording.id}
                    onClick={() => handleSelectRecording(recording)}
                    className={`w-full p-4 text-left hover:bg-gray-800 transition-colors ${
                      selectedRecording?.id === recording.id ? 'bg-gray-800' : ''
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <div className="w-10 h-10 rounded-lg bg-gray-700 flex items-center justify-center flex-shrink-0">
                        <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                        </svg>
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium text-white truncate">
                          {recording.meetingTitle}
                        </div>
                        <div className="text-xs text-gray-400 mt-1">
                          {formatDate(recording.createdAt)}
                        </div>
                        <div className="flex items-center gap-3 mt-1 text-xs text-gray-500">
                          <span>{formatDuration(recording.duration)}</span>
                          <span>{formatFileSize(recording.size)}</span>
                          {recording.hasTranscript && (
                            <span className="px-1.5 py-0.5 bg-blue-600/20 text-blue-400 rounded">
                              Transcript
                            </span>
                          )}
                        </div>
                        <div className="mt-1">
                          <span className={`text-xs px-1.5 py-0.5 rounded ${
                            recording.status === 'completed'
                              ? 'bg-green-600/20 text-green-400'
                              : recording.status === 'failed'
                              ? 'bg-red-600/20 text-red-400'
                              : 'bg-yellow-600/20 text-yellow-400'
                          }`}>
                            {recording.status}
                          </span>
                        </div>
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Player/Details */}
          <div className="flex-1 flex flex-col min-w-0">
            {selectedRecording ? (
              <>
                {/* Video Player */}
                <div className="aspect-video bg-black relative">
                  {selectedRecording.status === 'completed' && selectedRecording.url ? (
                    <video
                      ref={videoRef}
                      src={selectedRecording.url}
                      controls
                      className="w-full h-full"
                    />
                  ) : (
                    <div className="absolute inset-0 flex items-center justify-center text-gray-400">
                      {selectedRecording.status === 'processing' && (
                        <>
                          <svg className="w-8 h-8 animate-spin mr-2" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                          </svg>
                          Processing...
                        </>
                      )}
                      {selectedRecording.status === 'failed' && (
                        <span className="text-red-400">Recording failed</span>
                      )}
                    </div>
                  )}
                </div>

                {/* Actions and Transcript toggle */}
                <div className="p-4 border-b border-gray-700">
                  <div className="flex items-center justify-between">
                    <div className="flex gap-2">
                      <button
                        onClick={() => setShowTranscript(!showTranscript)}
                        className={`px-3 py-1.5 text-sm rounded-lg transition-colors ${
                          showTranscript
                            ? 'bg-blue-600 text-white'
                            : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                        }`}
                      >
                        Transcript
                      </button>

                      {!selectedRecording.hasTranscript && (
                        <button
                          onClick={handleRequestTranscript}
                          disabled={processingId === selectedRecording.id}
                          className="px-3 py-1.5 text-sm bg-gray-700 text-gray-300 hover:bg-gray-600 rounded-lg disabled:opacity-50"
                        >
                          {processingId === selectedRecording.id ? 'Generating...' : 'Generate Transcript'}
                        </button>
                      )}
                    </div>

                    <div className="flex gap-2">
                      <button
                        onClick={handleShare}
                        className="px-3 py-1.5 text-sm bg-gray-700 text-gray-300 hover:bg-gray-600 rounded-lg flex items-center gap-1"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
                        </svg>
                        Share
                      </button>

                      {selectedRecording.url && (
                        <a
                          href={selectedRecording.url}
                          download
                          className="px-3 py-1.5 text-sm bg-gray-700 text-gray-300 hover:bg-gray-600 rounded-lg flex items-center gap-1"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                          </svg>
                          Download
                        </a>
                      )}

                      <button
                        onClick={handleDelete}
                        className="px-3 py-1.5 text-sm bg-red-600/20 text-red-400 hover:bg-red-600/30 rounded-lg flex items-center gap-1"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                        Delete
                      </button>
                    </div>
                  </div>

                  {/* Share URL display */}
                  {shareUrl && (
                    <div className="mt-3 p-2 bg-green-600/20 text-green-400 rounded-lg text-sm flex items-center gap-2">
                      <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                      <span className="truncate">Link copied: {shareUrl}</span>
                    </div>
                  )}
                </div>

                {/* Transcript Panel */}
                {showTranscript && (
                  <div className="flex-1 overflow-y-auto p-4">
                    {currentTranscript ? (
                      <div className="space-y-4">
                        {/* Summary */}
                        {currentTranscript.summary && (
                          <div className="p-4 bg-gray-800 rounded-lg">
                            <h4 className="text-sm font-medium text-gray-300 mb-2">Summary</h4>
                            <p className="text-sm text-gray-400">{currentTranscript.summary}</p>
                          </div>
                        )}

                        {/* Action Items */}
                        {currentTranscript.actionItems && currentTranscript.actionItems.length > 0 && (
                          <div className="p-4 bg-gray-800 rounded-lg">
                            <h4 className="text-sm font-medium text-gray-300 mb-2">Action Items</h4>
                            <ul className="space-y-2">
                              {currentTranscript.actionItems.map((item, i) => (
                                <li key={i} className="flex items-start gap-2 text-sm text-gray-400">
                                  <svg className="w-4 h-4 mt-0.5 text-blue-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                                  </svg>
                                  <span>
                                    {item.task}
                                    {item.assignee && <span className="text-blue-400"> - {item.assignee}</span>}
                                  </span>
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}

                        {/* Key Topics */}
                        {currentTranscript.keyTopics && currentTranscript.keyTopics.length > 0 && (
                          <div className="flex flex-wrap gap-2">
                            {currentTranscript.keyTopics.map((topic, i) => (
                              <span key={i} className="px-2 py-1 bg-gray-700 text-gray-300 rounded-full text-xs">
                                {topic}
                              </span>
                            ))}
                          </div>
                        )}

                        {/* Full Transcript */}
                        <div className="p-4 bg-gray-800 rounded-lg">
                          <h4 className="text-sm font-medium text-gray-300 mb-2">Full Transcript</h4>
                          <div className="space-y-3">
                            {currentTranscript.segments.length > 0 ? (
                              currentTranscript.segments.map((segment, i) => (
                                <div key={i} className="text-sm">
                                  <span className="text-gray-500 text-xs font-mono">
                                    {formatDuration(Math.floor(segment.start))}
                                  </span>
                                  {segment.speaker && (
                                    <span className="text-blue-400 ml-2">{segment.speaker}:</span>
                                  )}
                                  <p className="text-gray-300 mt-1">{segment.text}</p>
                                </div>
                              ))
                            ) : (
                              <p className="text-gray-400 whitespace-pre-wrap">{currentTranscript.text}</p>
                            )}
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div className="text-center text-gray-400 py-8">
                        <p>No transcript available.</p>
                        <button
                          onClick={handleRequestTranscript}
                          disabled={processingId === selectedRecording.id}
                          className="mt-3 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm disabled:opacity-50"
                        >
                          {processingId === selectedRecording.id ? 'Generating...' : 'Generate Transcript'}
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </>
            ) : (
              <div className="flex-1 flex items-center justify-center text-gray-400">
                <div className="text-center">
                  <svg className="w-16 h-16 mx-auto mb-4 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                  </svg>
                  <p>Select a recording to preview</p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
