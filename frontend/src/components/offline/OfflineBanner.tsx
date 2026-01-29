/**
 * Offline Banner Component
 *
 * Shows a prominent banner when the user is offline.
 * Phase 3: Offline Support
 */

import React, { useState, useEffect } from 'react';
import { WifiOff, X, RefreshCw } from 'lucide-react';
import { useOnlineStatus } from '@/lib/offline/useNetworkStatus';

interface OfflineBannerProps {
  position?: 'top' | 'bottom';
  dismissible?: boolean;
  className?: string;
}

export function OfflineBanner({
  position = 'top',
  dismissible = true,
  className = '',
}: OfflineBannerProps) {
  const isOnline = useOnlineStatus();
  const [isDismissed, setIsDismissed] = useState(false);
  const [wasOffline, setWasOffline] = useState(false);
  const [showReconnected, setShowReconnected] = useState(false);

  useEffect(() => {
    if (!isOnline) {
      setWasOffline(true);
      setIsDismissed(false);
    } else if (wasOffline) {
      // Show reconnected message briefly
      setShowReconnected(true);
      const timer = setTimeout(() => {
        setShowReconnected(false);
        setWasOffline(false);
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [isOnline, wasOffline]);

  // Don't show anything if online and not showing reconnected message
  if (isOnline && !showReconnected) {
    return null;
  }

  // Don't show if dismissed
  if (!isOnline && isDismissed) {
    return null;
  }

  const positionClass = position === 'top'
    ? 'top-0'
    : 'bottom-0';

  // Reconnected state
  if (showReconnected) {
    return (
      <div
        className={`
          fixed left-0 right-0 ${positionClass} z-50
          bg-green-500 text-white
          transition-all duration-300 ${className}
        `}
      >
        <div className="max-w-screen-xl mx-auto px-4 py-2 flex items-center justify-center gap-2">
          <RefreshCw className="w-4 h-4" />
          <span className="text-sm font-medium">
            Back online! Syncing your changes...
          </span>
        </div>
      </div>
    );
  }

  // Offline state
  return (
    <div
      className={`
        fixed left-0 right-0 ${positionClass} z-50
        bg-gray-900 text-white
        transition-all duration-300 ${className}
      `}
    >
      <div className="max-w-screen-xl mx-auto px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <WifiOff className="w-5 h-5 text-red-400" />
          <div>
            <p className="text-sm font-medium">You're currently offline</p>
            <p className="text-xs text-gray-400">
              Your changes will be saved and synced when you're back online
            </p>
          </div>
        </div>
        {dismissible && (
          <button
            onClick={() => setIsDismissed(true)}
            className="p-1 rounded hover:bg-gray-800 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>
    </div>
  );
}

/**
 * Offline-aware wrapper component
 * Shows children with an offline indicator overlay when offline
 */
interface OfflineAwareProps {
  children: React.ReactNode;
  fallback?: React.ReactNode;
  showOverlay?: boolean;
  className?: string;
}

export function OfflineAware({
  children,
  fallback,
  showOverlay = true,
  className = '',
}: OfflineAwareProps) {
  const isOnline = useOnlineStatus();

  if (!isOnline && fallback) {
    return <>{fallback}</>;
  }

  return (
    <div className={`relative ${className}`}>
      {children}
      {!isOnline && showOverlay && (
        <div className="absolute inset-0 bg-gray-100/80 flex items-center justify-center z-10">
          <div className="bg-white rounded-lg shadow-lg p-4 flex items-center gap-3">
            <WifiOff className="w-5 h-5 text-gray-500" />
            <span className="text-sm text-gray-600">
              This feature requires an internet connection
            </span>
          </div>
        </div>
      )}
    </div>
  );
}

export default OfflineBanner;
