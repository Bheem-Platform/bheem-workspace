/**
 * Bheem Mail Undo Send Toast
 * Gmail-style undo send notification with countdown
 */
import { useState, useEffect } from 'react';
import { X, Check, Undo2 } from 'lucide-react';
import * as mailApi from '@/lib/mailApi';

interface UndoSendToastProps {
  queueId: string;
  recipient: string;
  onUndo: () => void;
  onDismiss: () => void;
  delay?: number; // in seconds
}

export default function UndoSendToast({
  queueId,
  recipient,
  onUndo,
  onDismiss,
  delay = 30,
}: UndoSendToastProps) {
  const [countdown, setCountdown] = useState(delay);
  const [isUndoing, setIsUndoing] = useState(false);
  const [status, setStatus] = useState<'pending' | 'undone' | 'sent'>('pending');

  useEffect(() => {
    if (status !== 'pending') return;

    const timer = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          setStatus('sent');
          setTimeout(onDismiss, 2000);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [status, onDismiss]);

  const handleUndo = async () => {
    setIsUndoing(true);
    try {
      await mailApi.undoSend(queueId);
      setStatus('undone');
      onUndo();
      setTimeout(onDismiss, 2000);
    } catch (error) {
      console.error('Failed to undo send:', error);
      setIsUndoing(false);
    }
  };

  // Progress bar width
  const progress = (countdown / delay) * 100;

  return (
    <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50 animate-slide-up">
      <div className="bg-gray-900 text-white rounded-xl shadow-2xl overflow-hidden min-w-[360px]">
        {/* Progress bar */}
        {status === 'pending' && (
          <div className="h-1 bg-gray-700">
            <div
              className="h-full bg-orange-500 transition-all duration-1000 ease-linear"
              style={{ width: `${progress}%` }}
            />
          </div>
        )}

        <div className="px-4 py-3 flex items-center gap-4">
          {status === 'pending' && (
            <>
              <div className="flex-1">
                <p className="text-sm">
                  Message sent to <span className="font-medium">{recipient}</span>
                </p>
                <p className="text-xs text-gray-400 mt-0.5">
                  Sending in {countdown}s...
                </p>
              </div>
              <button
                onClick={handleUndo}
                disabled={isUndoing}
                className="flex items-center gap-2 px-4 py-2 bg-orange-500 hover:bg-orange-600 rounded-lg text-sm font-medium transition-colors"
              >
                <Undo2 size={16} />
                {isUndoing ? 'Undoing...' : 'Undo'}
              </button>
              <button
                onClick={onDismiss}
                className="p-1.5 text-gray-400 hover:text-white rounded"
              >
                <X size={18} />
              </button>
            </>
          )}

          {status === 'undone' && (
            <div className="flex items-center gap-3 py-1">
              <div className="w-8 h-8 bg-green-500 rounded-full flex items-center justify-center">
                <Check size={18} />
              </div>
              <p className="text-sm">Message cancelled. Moved to Drafts.</p>
            </div>
          )}

          {status === 'sent' && (
            <div className="flex items-center gap-3 py-1">
              <div className="w-8 h-8 bg-blue-500 rounded-full flex items-center justify-center">
                <Check size={18} />
              </div>
              <p className="text-sm">Message sent successfully!</p>
            </div>
          )}
        </div>
      </div>

      <style jsx>{`
        @keyframes slide-up {
          from {
            transform: translate(-50%, 100%);
            opacity: 0;
          }
          to {
            transform: translate(-50%, 0);
            opacity: 1;
          }
        }
        .animate-slide-up {
          animation: slide-up 0.3s ease-out;
        }
      `}</style>
    </div>
  );
}

// Toast Manager Component
interface Toast {
  id: string;
  queueId: string;
  recipient: string;
  delay: number;
}

export function UndoSendToastManager() {
  const [toasts, setToasts] = useState<Toast[]>([]);

  // Expose method to show toast
  useEffect(() => {
    (window as any).showUndoSendToast = (queueId: string, recipient: string, delay: number = 30) => {
      const id = Math.random().toString(36).substr(2, 9);
      setToasts((prev) => [...prev, { id, queueId, recipient, delay }]);
    };

    return () => {
      delete (window as any).showUndoSendToast;
    };
  }, []);

  const handleUndo = (id: string) => {
    // Toast will dismiss itself
  };

  const handleDismiss = (id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  };

  return (
    <>
      {toasts.map((toast) => (
        <UndoSendToast
          key={toast.id}
          queueId={toast.queueId}
          recipient={toast.recipient}
          delay={toast.delay}
          onUndo={() => handleUndo(toast.id)}
          onDismiss={() => handleDismiss(toast.id)}
        />
      ))}
    </>
  );
}
