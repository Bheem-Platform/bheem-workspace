'use client';

import { useEffect } from 'react';
import { useMeetStore } from '@/stores/meetStore';
import type { WaitingParticipant } from '@/types/meet';

function formatWaitTime(seconds: number): string {
  if (seconds < 60) {
    return `${seconds}s`;
  }
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}m ${secs}s`;
}

interface ParticipantCardProps {
  participant: WaitingParticipant;
  onAdmit: () => void;
  onReject: () => void;
}

function ParticipantCard({ participant, onAdmit, onReject }: ParticipantCardProps) {
  return (
    <div className="flex items-center gap-3 p-3 bg-gray-800 rounded-lg">
      {/* Avatar */}
      <div className="w-10 h-10 rounded-full bg-gradient-to-br from-orange-500 to-pink-600 flex items-center justify-center text-white font-medium flex-shrink-0">
        {participant.displayName.charAt(0).toUpperCase()}
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <div className="font-medium text-white truncate">{participant.displayName}</div>
        {participant.email && (
          <div className="text-xs text-gray-400 truncate">{participant.email}</div>
        )}
        <div className="text-xs text-gray-500 mt-0.5">
          Waiting for {formatWaitTime(participant.waitTimeSeconds)}
        </div>
      </div>

      {/* Actions */}
      <div className="flex gap-2 flex-shrink-0">
        <button
          onClick={onAdmit}
          className="px-3 py-1.5 bg-green-600 hover:bg-green-700 text-white text-sm rounded-lg transition-colors"
        >
          Admit
        </button>
        <button
          onClick={onReject}
          className="px-3 py-1.5 bg-gray-700 hover:bg-gray-600 text-gray-300 text-sm rounded-lg transition-colors"
        >
          Deny
        </button>
      </div>
    </div>
  );
}

export default function WaitingRoomPanel() {
  const {
    waitingParticipants,
    waitingRoomEnabled,
    loading,
    isHost,
    isWaitingRoomPanelOpen,
    toggleWaitingRoomPanel,
    fetchWaitingParticipants,
    admitParticipant,
    rejectParticipant,
    admitAllParticipants,
    toggleWaitingRoom,
  } = useMeetStore();

  // Fetch waiting participants periodically
  useEffect(() => {
    if (isWaitingRoomPanelOpen && isHost) {
      fetchWaitingParticipants();

      const interval = setInterval(() => {
        fetchWaitingParticipants();
      }, 5000); // Poll every 5 seconds

      return () => clearInterval(interval);
    }
  }, [isWaitingRoomPanelOpen, isHost, fetchWaitingParticipants]);

  if (!isWaitingRoomPanelOpen || !isHost) return null;

  const waitingCount = waitingParticipants.length;

  return (
    <div className="w-80 h-full bg-gray-900 border-l border-gray-700 flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between p-3 border-b border-gray-700">
        <div className="flex items-center gap-2">
          <h3 className="font-medium text-white">Waiting Room</h3>
          {waitingCount > 0 && (
            <span className="px-1.5 py-0.5 bg-orange-600 text-white text-xs rounded-full">
              {waitingCount}
            </span>
          )}
        </div>
        <button
          onClick={toggleWaitingRoomPanel}
          className="p-1.5 text-gray-400 hover:text-white rounded hover:bg-gray-800"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      {/* Settings */}
      <div className="p-3 border-b border-gray-700">
        <label className="flex items-center justify-between cursor-pointer">
          <span className="text-sm text-gray-300">Enable waiting room</span>
          <div className="relative">
            <input
              type="checkbox"
              checked={waitingRoomEnabled}
              onChange={(e) => toggleWaitingRoom(e.target.checked)}
              className="sr-only"
            />
            <div
              className={`w-10 h-5 rounded-full transition-colors ${
                waitingRoomEnabled ? 'bg-blue-600' : 'bg-gray-600'
              }`}
            >
              <div
                className={`absolute w-4 h-4 bg-white rounded-full top-0.5 transition-transform ${
                  waitingRoomEnabled ? 'translate-x-5' : 'translate-x-0.5'
                }`}
              />
            </div>
          </div>
        </label>
        <p className="text-xs text-gray-500 mt-1">
          When enabled, participants must be admitted by the host
        </p>
      </div>

      {/* Waiting list */}
      <div className="flex-1 overflow-y-auto p-3">
        {loading.waitingRoom ? (
          <div className="flex items-center justify-center py-8">
            <svg className="w-6 h-6 animate-spin text-gray-400" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
            </svg>
          </div>
        ) : waitingCount === 0 ? (
          <div className="text-center text-gray-500 py-8">
            <svg className="w-12 h-12 mx-auto mb-3 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
            </svg>
            <p className="text-sm">No one is waiting</p>
            <p className="text-xs text-gray-600 mt-1">
              Participants will appear here when they try to join
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {waitingParticipants.map((participant) => (
              <ParticipantCard
                key={participant.id}
                participant={participant}
                onAdmit={() => admitParticipant(participant.id)}
                onReject={() => rejectParticipant(participant.id)}
              />
            ))}
          </div>
        )}
      </div>

      {/* Admit all button */}
      {waitingCount > 0 && (
        <div className="p-3 border-t border-gray-700">
          <button
            onClick={admitAllParticipants}
            className="w-full py-2 bg-green-600 hover:bg-green-700 text-white font-medium rounded-lg transition-colors"
          >
            Admit All ({waitingCount})
          </button>
        </div>
      )}
    </div>
  );
}
