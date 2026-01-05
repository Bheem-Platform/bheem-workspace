'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import * as meetApi from '@/lib/meetApi';
import type { Recording, Transcript } from '@/types/meet';

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

export default function RecordingsPage() {
  const router = useRouter();
  const [recordings, setRecordings] = useState<Recording[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedRecording, setSelectedRecording] = useState<Recording | null>(null);
  const [transcript, setTranscript] = useState<Transcript | null>(null);
  const [showTranscript, setShowTranscript] = useState(false);
  const [processingTranscript, setProcessingTranscript] = useState(false);
  const [shareUrl, setShareUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    loadRecordings();
  }, []);

  const loadRecordings = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await meetApi.listRecordings();
      setRecordings(data);
    } catch (err: any) {
      console.error('Failed to load recordings:', err);
      if (err?.response?.status === 401 || err?.response?.status === 403) {
        setError('Please log in to view recordings');
      } else {
        setError('Failed to load recordings. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleSelectRecording = async (recording: Recording) => {
    setSelectedRecording(recording);
    setShowTranscript(false);
    setShareUrl(null);
    setTranscript(null);

    if (recording.hasTranscript) {
      const t = await meetApi.getTranscript(recording.id);
      setTranscript(t);
    }
  };

  const handleRequestTranscript = async () => {
    if (!selectedRecording) return;

    setProcessingTranscript(true);
    try {
      await meetApi.requestTranscription(selectedRecording.id);
      // Poll for completion
      setTimeout(async () => {
        const t = await meetApi.getTranscript(selectedRecording.id);
        setTranscript(t);
        setProcessingTranscript(false);
      }, 5000);
    } catch (error) {
      console.error('Failed to request transcription:', error);
      setProcessingTranscript(false);
    }
  };

  const handleShare = async () => {
    if (!selectedRecording) return;

    try {
      const result = await meetApi.createShareLink(selectedRecording.id);
      const url = result.shareUrl;
      setShareUrl(url);

      // Try to copy to clipboard
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(url);
      } else {
        // Fallback for older browsers or non-HTTPS
        const textArea = document.createElement('textarea');
        textArea.value = url;
        textArea.style.position = 'fixed';
        textArea.style.left = '-9999px';
        document.body.appendChild(textArea);
        textArea.select();
        document.execCommand('copy');
        document.body.removeChild(textArea);
      }
    } catch (error) {
      console.error('Failed to create share link:', error);
      alert('Failed to create share link. Please try again.');
    }
  };

  const handleDelete = async (recording: Recording) => {
    if (!confirm('Are you sure you want to delete this recording?')) return;

    try {
      await meetApi.deleteRecording(recording.id);
      setRecordings(recordings.filter((r) => r.id !== recording.id));
      if (selectedRecording?.id === recording.id) {
        setSelectedRecording(null);
      }
    } catch (error) {
      console.error('Failed to delete recording:', error);
    }
  };

  return (
    <>
      <Head>
        <title>Recordings | Bheem Meet</title>
      </Head>

      <div className="min-h-screen bg-gray-900">
        {/* Header */}
        <header className="bg-gray-800 border-b border-gray-700">
          <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
            <div className="flex items-center gap-4">
              <button
                onClick={() => router.push('/meet')}
                className="p-2 text-gray-400 hover:text-white rounded-lg hover:bg-gray-700"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
              </button>
              <h1 className="text-xl font-semibold text-white">Meeting Recordings</h1>
            </div>

            <button
              onClick={loadRecordings}
              className="flex items-center gap-2 px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              Refresh
            </button>
          </div>
        </header>

        <div className="max-w-7xl mx-auto p-4">
          <div className="flex gap-6">
            {/* Recordings List */}
            <div className="w-96 bg-gray-800 rounded-xl overflow-hidden">
              <div className="p-4 border-b border-gray-700">
                <h2 className="font-medium text-white">All Recordings</h2>
                <p className="text-sm text-gray-400 mt-1">{recordings.length} recordings</p>
              </div>

              <div className="divide-y divide-gray-700 max-h-[calc(100vh-220px)] overflow-y-auto">
                {loading ? (
                  <div className="p-8 text-center">
                    <svg className="w-8 h-8 animate-spin mx-auto text-gray-400" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                  </div>
                ) : error ? (
                  <div className="p-8 text-center">
                    <svg className="w-12 h-12 mx-auto mb-3 text-red-400 opacity-75" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                    </svg>
                    <p className="text-red-400">{error}</p>
                    <button
                      onClick={loadRecordings}
                      className="mt-4 px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg text-sm"
                    >
                      Retry
                    </button>
                  </div>
                ) : recordings.length === 0 ? (
                  <div className="p-8 text-center text-gray-400">
                    <svg className="w-12 h-12 mx-auto mb-3 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                    </svg>
                    <p>No recordings yet</p>
                    <p className="text-sm text-gray-500 mt-1">Start recording in a meeting</p>
                  </div>
                ) : (
                  recordings.map((recording) => (
                    <button
                      key={recording.id}
                      onClick={() => handleSelectRecording(recording)}
                      className={`w-full p-4 text-left hover:bg-gray-700 transition-colors ${
                        selectedRecording?.id === recording.id ? 'bg-gray-700' : ''
                      }`}
                    >
                      <div className="flex items-start gap-3">
                        <div className="w-12 h-12 rounded-lg bg-gray-600 flex items-center justify-center flex-shrink-0">
                          <svg className="w-6 h-6 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                          </svg>
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="font-medium text-white truncate">{recording.meetingTitle}</div>
                          <div className="text-xs text-gray-400 mt-1">{formatDate(recording.createdAt)}</div>
                          <div className="flex items-center gap-3 mt-2 text-xs text-gray-500">
                            <span>{formatDuration(recording.duration)}</span>
                            <span>{formatFileSize(recording.size)}</span>
                            {recording.hasTranscript && (
                              <span className="px-1.5 py-0.5 bg-blue-600/20 text-blue-400 rounded">Transcript</span>
                            )}
                          </div>
                          <span className={`inline-block mt-2 text-xs px-2 py-0.5 rounded ${
                            recording.status === 'completed'
                              ? 'bg-green-600/20 text-green-400'
                              : recording.status === 'failed'
                              ? 'bg-red-600/20 text-red-400'
                              : 'bg-yellow-600/20 text-yellow-400'
                          }`}>
                            {recording.status}
                          </span>
                        </div>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDelete(recording);
                          }}
                          className="p-2 text-gray-400 hover:text-red-400 rounded"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                        </button>
                      </div>
                    </button>
                  ))
                )}
              </div>
            </div>

            {/* Player & Details */}
            <div className="flex-1 bg-gray-800 rounded-xl overflow-hidden">
              {selectedRecording ? (
                <div className="h-full flex flex-col">
                  {/* Video Player */}
                  <div className="aspect-video bg-black">
                    {selectedRecording.status === 'completed' && selectedRecording.url ? (
                      <video
                        ref={videoRef}
                        src={selectedRecording.url}
                        controls
                        className="w-full h-full"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-gray-400">
                        {selectedRecording.status === 'processing' ? (
                          <div className="text-center">
                            <svg className="w-12 h-12 animate-spin mx-auto mb-3" fill="none" viewBox="0 0 24 24">
                              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                            </svg>
                            <p>Processing recording...</p>
                          </div>
                        ) : (
                          <p className="text-red-400">Recording failed</p>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Controls */}
                  <div className="p-4 border-b border-gray-700">
                    <div className="flex items-center justify-between">
                      <div>
                        <h3 className="font-medium text-white">{selectedRecording.meetingTitle}</h3>
                        <p className="text-sm text-gray-400 mt-1">{formatDate(selectedRecording.createdAt)}</p>
                      </div>

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
                      </div>
                    </div>

                    {shareUrl && (
                      <div className="mt-3 p-3 bg-green-600/20 rounded-lg">
                        <div className="flex items-center gap-2 text-green-400 text-sm mb-2">
                          <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                          </svg>
                          <span>Link copied to clipboard!</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <input
                            type="text"
                            readOnly
                            value={shareUrl}
                            className="flex-1 px-2 py-1 bg-gray-700 text-gray-300 text-xs rounded border border-gray-600"
                            onClick={(e) => (e.target as HTMLInputElement).select()}
                          />
                          <button
                            onClick={() => {
                              navigator.clipboard?.writeText(shareUrl);
                            }}
                            className="px-2 py-1 bg-gray-700 hover:bg-gray-600 text-gray-300 text-xs rounded"
                          >
                            Copy
                          </button>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Transcript */}
                  {showTranscript && (
                    <div className="flex-1 overflow-y-auto p-4">
                      {transcript ? (
                        <div className="space-y-4">
                          {transcript.summary && (
                            <div className="p-4 bg-gray-700 rounded-lg">
                              <h4 className="text-sm font-medium text-gray-300 mb-2">Summary</h4>
                              <p className="text-sm text-gray-400">{transcript.summary}</p>
                            </div>
                          )}

                          {transcript.actionItems && transcript.actionItems.length > 0 && (
                            <div className="p-4 bg-gray-700 rounded-lg">
                              <h4 className="text-sm font-medium text-gray-300 mb-2">Action Items</h4>
                              <ul className="space-y-2">
                                {transcript.actionItems.map((item, i) => (
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

                          <div className="p-4 bg-gray-700 rounded-lg">
                            <h4 className="text-sm font-medium text-gray-300 mb-2">Full Transcript</h4>
                            <p className="text-sm text-gray-400 whitespace-pre-wrap">{transcript.text}</p>
                          </div>
                        </div>
                      ) : (
                        <div className="text-center py-8">
                          <p className="text-gray-400 mb-4">No transcript available</p>
                          <button
                            onClick={handleRequestTranscript}
                            disabled={processingTranscript}
                            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg disabled:opacity-50"
                          >
                            {processingTranscript ? 'Generating...' : 'Generate Transcript'}
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ) : (
                <div className="h-full flex items-center justify-center text-gray-400">
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
    </>
  );
}
