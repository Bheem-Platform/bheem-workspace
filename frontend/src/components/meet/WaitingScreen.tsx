'use client';

import { useEffect, useState } from 'react';
import { useMeetStore } from '@/stores/meetStore';

interface WaitingScreenProps {
  roomName?: string;
  onAdmitted?: () => void;
  onRejected?: () => void;
  onLeave?: () => void;
}

export default function WaitingScreen({
  roomName,
  onAdmitted,
  onRejected,
  onLeave,
}: WaitingScreenProps) {
  const {
    myWaitingStatus,
    checkMyWaitingStatus,
    roomCode,
  } = useMeetStore();

  const [dots, setDots] = useState('');

  // Poll for status updates
  useEffect(() => {
    const interval = setInterval(() => {
      checkMyWaitingStatus();
    }, 3000);

    return () => clearInterval(interval);
  }, [checkMyWaitingStatus]);

  // Handle status changes
  useEffect(() => {
    if (myWaitingStatus === 'admitted') {
      onAdmitted?.();
    } else if (myWaitingStatus === 'rejected') {
      onRejected?.();
    }
  }, [myWaitingStatus, onAdmitted, onRejected]);

  // Animate dots
  useEffect(() => {
    const interval = setInterval(() => {
      setDots((prev) => (prev.length >= 3 ? '' : prev + '.'));
    }, 500);

    return () => clearInterval(interval);
  }, []);

  if (myWaitingStatus === 'rejected') {
    return (
      <div className="fixed inset-0 bg-gray-900 flex items-center justify-center">
        <div className="text-center p-8 max-w-md">
          <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-red-600/20 flex items-center justify-center">
            <svg className="w-10 h-10 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </div>
          <h2 className="text-2xl font-semibold text-white mb-2">
            Unable to Join
          </h2>
          <p className="text-gray-400 mb-6">
            The host did not admit you to this meeting.
          </p>
          <button
            onClick={onLeave}
            className="px-6 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg transition-colors"
          >
            Return to Home
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-gray-900 flex items-center justify-center">
      <div className="text-center p-8 max-w-md">
        {/* Animated waiting indicator */}
        <div className="relative w-24 h-24 mx-auto mb-6">
          <div className="absolute inset-0 rounded-full border-4 border-gray-700" />
          <div className="absolute inset-0 rounded-full border-4 border-t-blue-500 animate-spin" />
          <div className="absolute inset-2 rounded-full bg-gray-800 flex items-center justify-center">
            <svg className="w-8 h-8 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
        </div>

        <h2 className="text-2xl font-semibold text-white mb-2">
          Waiting to join{dots}
        </h2>

        <p className="text-gray-400 mb-2">
          {roomName || roomCode || 'Meeting'}
        </p>

        <p className="text-sm text-gray-500 mb-8">
          The host will let you in soon
        </p>

        {/* Tips while waiting */}
        <div className="bg-gray-800 rounded-lg p-4 mb-6 text-left">
          <h4 className="text-sm font-medium text-gray-300 mb-2">While you wait:</h4>
          <ul className="space-y-2 text-sm text-gray-400">
            <li className="flex items-start gap-2">
              <svg className="w-4 h-4 mt-0.5 text-blue-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              Check your camera and microphone
            </li>
            <li className="flex items-start gap-2">
              <svg className="w-4 h-4 mt-0.5 text-blue-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              Find a quiet, well-lit space
            </li>
            <li className="flex items-start gap-2">
              <svg className="w-4 h-4 mt-0.5 text-blue-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              Close unnecessary applications
            </li>
          </ul>
        </div>

        {/* Leave button */}
        <button
          onClick={onLeave}
          className="px-6 py-2 text-gray-400 hover:text-white transition-colors"
        >
          Leave waiting room
        </button>
      </div>
    </div>
  );
}
