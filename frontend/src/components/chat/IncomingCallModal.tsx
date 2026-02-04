/**
 * IncomingCallModal - UI for receiving incoming calls
 */

'use client';

import { useEffect, useState } from 'react';
import { Phone, PhoneOff, Video, X, User } from 'lucide-react';
import type { CallLog } from '@/stores/chatStore';

interface IncomingCallModalProps {
  isOpen: boolean;
  call: CallLog | null;
  callerName: string;
  callerAvatar?: string;
  onAnswer: () => void;
  onDecline: () => void;
  onClose: () => void;
}

export default function IncomingCallModal({
  isOpen,
  call,
  callerName,
  callerAvatar,
  onAnswer,
  onDecline,
  onClose,
}: IncomingCallModalProps) {
  const [ringCount, setRingCount] = useState(0);

  // Ring animation
  useEffect(() => {
    if (!isOpen) return;

    const interval = setInterval(() => {
      setRingCount((c) => c + 1);
    }, 2000);

    return () => clearInterval(interval);
  }, [isOpen]);

  // Play ringtone (optional - browser may block autoplay)
  useEffect(() => {
    if (!isOpen) return;

    // You could add a ringtone audio here
    // const audio = new Audio('/sounds/ringtone.mp3');
    // audio.loop = true;
    // audio.play().catch(() => {});
    // return () => audio.pause();
  }, [isOpen]);

  if (!isOpen || !call) return null;

  const isVideoCall = call.call_type === 'video';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm">
      <div className="bg-gray-900 rounded-2xl p-8 w-full max-w-sm mx-4 text-center shadow-2xl">
        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-2 text-gray-400 hover:text-white"
        >
          <X size={20} />
        </button>

        {/* Incoming call indicator */}
        <div className="mb-6">
          <span className="inline-flex items-center gap-2 px-4 py-2 bg-green-500/20 text-green-400 rounded-full text-sm font-medium">
            {isVideoCall ? <Video size={16} /> : <Phone size={16} />}
            Incoming {isVideoCall ? 'Video' : 'Audio'} Call
          </span>
        </div>

        {/* Caller avatar with ring animation */}
        <div className="relative mb-6">
          <div
            className={`absolute inset-0 bg-green-500/30 rounded-full animate-ping`}
            style={{ animationDuration: '2s' }}
          />
          <div
            className={`absolute inset-0 bg-green-500/20 rounded-full animate-pulse`}
            style={{ animationDuration: '1s' }}
          />
          <div className="relative w-28 h-28 mx-auto">
            {callerAvatar ? (
              <img
                src={callerAvatar}
                alt={callerName}
                className="w-full h-full rounded-full object-cover border-4 border-green-500"
              />
            ) : (
              <div className="w-full h-full rounded-full bg-gradient-to-br from-[#977DFF] to-[#0033FF] flex items-center justify-center border-4 border-green-500">
                <User size={48} className="text-white" />
              </div>
            )}
          </div>
        </div>

        {/* Caller name */}
        <h2 className="text-2xl font-semibold text-white mb-2">{callerName}</h2>
        <p className="text-gray-400 mb-8">
          is calling you...
        </p>

        {/* Action buttons */}
        <div className="flex items-center justify-center gap-8">
          {/* Decline button */}
          <div className="text-center">
            <button
              onClick={onDecline}
              className="p-5 bg-red-500 text-white rounded-full hover:bg-red-600 transition-all hover:scale-110 shadow-lg shadow-red-500/30"
            >
              <PhoneOff size={28} />
            </button>
            <p className="mt-2 text-sm text-gray-400">Decline</p>
          </div>

          {/* Answer button */}
          <div className="text-center">
            <button
              onClick={onAnswer}
              className="p-5 bg-green-500 text-white rounded-full hover:bg-green-600 transition-all hover:scale-110 shadow-lg shadow-green-500/30 animate-pulse"
            >
              {isVideoCall ? <Video size={28} /> : <Phone size={28} />}
            </button>
            <p className="mt-2 text-sm text-gray-400">Answer</p>
          </div>
        </div>
      </div>
    </div>
  );
}
