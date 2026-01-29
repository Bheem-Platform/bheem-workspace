/**
 * Network Status Indicator Component
 *
 * Displays current network status with sync information.
 * Phase 3: Offline Support
 */

import React, { useState, useEffect } from 'react';
import {
  Wifi,
  WifiOff,
  Cloud,
  CloudOff,
  RefreshCw,
  AlertTriangle,
  Check,
  X,
} from 'lucide-react';
import { useNetworkStatus } from '@/lib/offline/useNetworkStatus';
import { triggerSync, getSyncStatus, onSyncEvent } from '@/lib/offline/syncManager';

interface NetworkStatusIndicatorProps {
  tenantId?: string;
  showDetails?: boolean;
  position?: 'fixed' | 'inline';
  className?: string;
}

export function NetworkStatusIndicator({
  tenantId,
  showDetails = false,
  position = 'inline',
  className = '',
}: NetworkStatusIndicatorProps) {
  const status = useNetworkStatus(tenantId);
  const [isSyncing, setIsSyncing] = useState(false);
  const [showPopover, setShowPopover] = useState(false);
  const [lastSyncResult, setLastSyncResult] = useState<{
    success: number;
    failed: number;
    timestamp: Date;
  } | null>(null);

  useEffect(() => {
    // Listen for sync events
    const unsubscribeStart = onSyncEvent('sync-start', () => {
      setIsSyncing(true);
    });

    const unsubscribeComplete = onSyncEvent('sync-complete', (data: any) => {
      setIsSyncing(false);
      setLastSyncResult({
        success: data.successCount,
        failed: data.failCount,
        timestamp: data.timestamp,
      });
    });

    const unsubscribeError = onSyncEvent('sync-error', () => {
      setIsSyncing(false);
    });

    return () => {
      unsubscribeStart();
      unsubscribeComplete();
      unsubscribeError();
    };
  }, []);

  const handleManualSync = async () => {
    if (!isSyncing && status.isOnline) {
      await triggerSync();
    }
  };

  const getStatusIcon = () => {
    if (!status.isOnline) {
      return <WifiOff className="w-4 h-4 text-red-500" />;
    }
    if (status.isSlowConnection) {
      return <AlertTriangle className="w-4 h-4 text-yellow-500" />;
    }
    if (isSyncing) {
      return <RefreshCw className="w-4 h-4 text-blue-500 animate-spin" />;
    }
    if (status.pendingSyncCount > 0) {
      return <Cloud className="w-4 h-4 text-orange-500" />;
    }
    return <Wifi className="w-4 h-4 text-green-500" />;
  };

  const getStatusText = () => {
    if (!status.isOnline) {
      return 'Offline';
    }
    if (isSyncing) {
      return 'Syncing...';
    }
    if (status.pendingSyncCount > 0) {
      return `${status.pendingSyncCount} pending`;
    }
    if (status.isSlowConnection) {
      return 'Slow connection';
    }
    return 'Online';
  };

  const getStatusColor = () => {
    if (!status.isOnline) return 'bg-red-100 text-red-700 border-red-200';
    if (status.isSlowConnection) return 'bg-yellow-100 text-yellow-700 border-yellow-200';
    if (status.pendingSyncCount > 0) return 'bg-orange-100 text-orange-700 border-orange-200';
    return 'bg-green-100 text-green-700 border-green-200';
  };

  const positionClass = position === 'fixed'
    ? 'fixed bottom-4 right-4 z-50'
    : '';

  return (
    <div className={`relative ${positionClass} ${className}`}>
      {/* Main indicator */}
      <button
        onClick={() => setShowPopover(!showPopover)}
        className={`
          flex items-center gap-2 px-3 py-1.5 rounded-full border text-sm font-medium
          transition-colors cursor-pointer
          ${getStatusColor()}
        `}
      >
        {getStatusIcon()}
        {showDetails && <span>{getStatusText()}</span>}
      </button>

      {/* Popover with details */}
      {showPopover && (
        <div className="absolute bottom-full right-0 mb-2 w-72 bg-white rounded-lg shadow-xl border z-50">
          <div className="p-4">
            {/* Header */}
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-gray-900">Connection Status</h3>
              <button
                onClick={() => setShowPopover(false)}
                className="p-1 rounded hover:bg-gray-100"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Status details */}
            <div className="space-y-3">
              {/* Online/Offline */}
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600">Status</span>
                <span className={`flex items-center gap-1 text-sm font-medium ${
                  status.isOnline ? 'text-green-600' : 'text-red-600'
                }`}>
                  {status.isOnline ? (
                    <>
                      <Wifi className="w-4 h-4" />
                      Online
                    </>
                  ) : (
                    <>
                      <WifiOff className="w-4 h-4" />
                      Offline
                    </>
                  )}
                </span>
              </div>

              {/* Connection type */}
              {status.effectiveType && (
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600">Connection</span>
                  <span className="text-sm font-medium text-gray-900">
                    {status.effectiveType.toUpperCase()}
                    {status.downlink && ` (${status.downlink} Mbps)`}
                  </span>
                </div>
              )}

              {/* Pending sync */}
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600">Pending changes</span>
                <span className={`text-sm font-medium ${
                  status.pendingSyncCount > 0 ? 'text-orange-600' : 'text-green-600'
                }`}>
                  {status.pendingSyncCount > 0 ? (
                    `${status.pendingSyncCount} items`
                  ) : (
                    <span className="flex items-center gap-1">
                      <Check className="w-3 h-3" />
                      All synced
                    </span>
                  )}
                </span>
              </div>

              {/* Last sync result */}
              {lastSyncResult && (
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600">Last sync</span>
                  <span className="text-sm text-gray-900">
                    {lastSyncResult.success} synced
                    {lastSyncResult.failed > 0 && (
                      <span className="text-red-600">
                        , {lastSyncResult.failed} failed
                      </span>
                    )}
                  </span>
                </div>
              )}

              {/* Data saver mode */}
              {status.saveData && (
                <div className="flex items-center gap-2 px-3 py-2 bg-yellow-50 rounded text-sm text-yellow-700">
                  <AlertTriangle className="w-4 h-4" />
                  Data saver mode is on
                </div>
              )}
            </div>

            {/* Actions */}
            <div className="mt-4 pt-4 border-t">
              <button
                onClick={handleManualSync}
                disabled={!status.isOnline || isSyncing || status.pendingSyncCount === 0}
                className={`
                  w-full flex items-center justify-center gap-2 px-4 py-2 rounded-lg
                  text-sm font-medium transition-colors
                  ${status.isOnline && !isSyncing && status.pendingSyncCount > 0
                    ? 'bg-blue-500 text-white hover:bg-blue-600'
                    : 'bg-gray-100 text-gray-400 cursor-not-allowed'
                  }
                `}
              >
                <RefreshCw className={`w-4 h-4 ${isSyncing ? 'animate-spin' : ''}`} />
                {isSyncing ? 'Syncing...' : 'Sync now'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default NetworkStatusIndicator;
