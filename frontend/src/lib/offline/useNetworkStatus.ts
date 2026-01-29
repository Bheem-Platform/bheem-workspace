/**
 * Bheem Workspace - Network Status Hook
 *
 * React hook for monitoring network connectivity.
 * Phase 3: Offline Support
 */

import { useState, useEffect, useCallback } from 'react';
import { getSyncQueueCount } from './syncManager';

export interface NetworkStatus {
  isOnline: boolean;
  isSlowConnection: boolean;
  connectionType: string | null;
  downlink: number | null;
  rtt: number | null;
  saveData: boolean;
  effectiveType: string | null;
  pendingSyncCount: number;
  lastOnlineAt: Date | null;
  lastOfflineAt: Date | null;
}

// Connection info from Navigator API
interface NavigatorConnection {
  effectiveType?: string;
  type?: string;
  downlink?: number;
  rtt?: number;
  saveData?: boolean;
  addEventListener?: (event: string, handler: () => void) => void;
  removeEventListener?: (event: string, handler: () => void) => void;
}

declare global {
  interface Navigator {
    connection?: NavigatorConnection;
    mozConnection?: NavigatorConnection;
    webkitConnection?: NavigatorConnection;
  }
}

/**
 * Get connection information from Navigator API
 */
function getConnectionInfo(): Partial<NetworkStatus> {
  const connection =
    navigator.connection ||
    navigator.mozConnection ||
    navigator.webkitConnection;

  if (!connection) {
    return {
      connectionType: null,
      downlink: null,
      rtt: null,
      saveData: false,
      effectiveType: null,
      isSlowConnection: false,
    };
  }

  const effectiveType = connection.effectiveType || null;
  const isSlowConnection = effectiveType === '2g' || effectiveType === 'slow-2g';

  return {
    connectionType: connection.type || null,
    downlink: connection.downlink || null,
    rtt: connection.rtt || null,
    saveData: connection.saveData || false,
    effectiveType,
    isSlowConnection,
  };
}

/**
 * Hook for monitoring network status
 */
export function useNetworkStatus(tenantId?: string): NetworkStatus {
  const [status, setStatus] = useState<NetworkStatus>(() => ({
    isOnline: typeof navigator !== 'undefined' ? navigator.onLine : true,
    isSlowConnection: false,
    connectionType: null,
    downlink: null,
    rtt: null,
    saveData: false,
    effectiveType: null,
    pendingSyncCount: 0,
    lastOnlineAt: null,
    lastOfflineAt: null,
  }));

  // Update pending sync count
  const updatePendingCount = useCallback(async () => {
    try {
      const count = await getSyncQueueCount(tenantId);
      setStatus(prev => ({ ...prev, pendingSyncCount: count }));
    } catch (error) {
      console.error('[NetworkStatus] Failed to get sync count:', error);
    }
  }, [tenantId]);

  useEffect(() => {
    // Initial state
    const connectionInfo = getConnectionInfo();
    setStatus(prev => ({
      ...prev,
      ...connectionInfo,
      isOnline: navigator.onLine,
      lastOnlineAt: navigator.onLine ? new Date() : null,
    }));

    // Update pending count
    updatePendingCount();

    // Online handler
    const handleOnline = () => {
      const connectionInfo = getConnectionInfo();
      setStatus(prev => ({
        ...prev,
        ...connectionInfo,
        isOnline: true,
        lastOnlineAt: new Date(),
      }));
      updatePendingCount();
    };

    // Offline handler
    const handleOffline = () => {
      setStatus(prev => ({
        ...prev,
        isOnline: false,
        lastOfflineAt: new Date(),
      }));
    };

    // Connection change handler
    const handleConnectionChange = () => {
      const connectionInfo = getConnectionInfo();
      setStatus(prev => ({
        ...prev,
        ...connectionInfo,
      }));
    };

    // Add event listeners
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    const connection =
      navigator.connection ||
      navigator.mozConnection ||
      navigator.webkitConnection;

    if (connection?.addEventListener) {
      connection.addEventListener('change', handleConnectionChange);
    }

    // Poll for pending sync count periodically
    const pollInterval = setInterval(updatePendingCount, 30000);

    // Cleanup
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);

      if (connection?.removeEventListener) {
        connection.removeEventListener('change', handleConnectionChange);
      }

      clearInterval(pollInterval);
    };
  }, [updatePendingCount]);

  return status;
}

/**
 * Simple hook for just online/offline status
 */
export function useOnlineStatus(): boolean {
  const [isOnline, setIsOnline] = useState(
    typeof navigator !== 'undefined' ? navigator.onLine : true
  );

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  return isOnline;
}

export default useNetworkStatus;
