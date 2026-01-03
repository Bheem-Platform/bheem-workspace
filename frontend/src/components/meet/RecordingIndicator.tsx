'use client';

import { useMeetStore } from '@/stores/meetStore';

function formatDuration(seconds: number): string {
  const hrs = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;

  if (hrs > 0) {
    return `${hrs}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

export default function RecordingIndicator() {
  const { recordingSession } = useMeetStore();

  if (!recordingSession.isRecording) {
    return null;
  }

  return (
    <div className="flex items-center gap-2 px-3 py-1.5 bg-red-600 text-white rounded-full text-sm font-medium animate-pulse">
      <div className="w-2 h-2 bg-white rounded-full" />
      <span>REC</span>
      <span className="font-mono">{formatDuration(recordingSession.duration)}</span>
    </div>
  );
}
