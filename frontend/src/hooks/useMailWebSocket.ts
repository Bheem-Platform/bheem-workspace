/**
 * Bheem Mail - WebSocket Hook for Real-Time Updates
 * Phase 3.4: Real-Time Sync
 */
import { useEffect, useRef, useState, useCallback } from 'react';
import { useAuthStore } from '@/stores/authStore';

export interface MailWebSocketMessage {
  type: 'new_email' | 'email_updated' | 'folder_updated' | 'connected' | 'pong' | 'error' | 'subscribed' | 'unsubscribed' | 'status';
  folder?: string;
  message_id?: string;
  update_type?: 'read' | 'starred' | 'moved' | 'deleted';
  preview?: {
    subject?: string;
    from?: string;
  };
  unread_count?: number;
  timestamp?: string;
  user_id?: string;
  features?: {
    new_email_notifications: boolean;
    email_updates: boolean;
    folder_updates: boolean;
  };
  data?: any;
  message?: string;
}

export interface UseMailWebSocketOptions {
  /** Called when a new email arrives */
  onNewEmail?: (folder: string, preview?: { subject?: string; from?: string }) => void;
  /** Called when an email is updated */
  onEmailUpdated?: (messageId: string, updateType: string, data?: any) => void;
  /** Called when a folder is updated */
  onFolderUpdated?: (folder: string, unreadCount?: number) => void;
  /** Called when connection is established */
  onConnect?: (features: MailWebSocketMessage['features']) => void;
  /** Called when connection is lost */
  onDisconnect?: () => void;
  /** Called on any error */
  onError?: (message: string) => void;
  /** Auto-reconnect on disconnect (default: true) */
  autoReconnect?: boolean;
  /** Reconnect delay in ms (default: 3000) */
  reconnectDelay?: number;
  /** Maximum reconnect attempts (default: 5) */
  maxReconnectAttempts?: number;
}

export interface UseMailWebSocketReturn {
  /** Whether WebSocket is connected */
  isConnected: boolean;
  /** Connection features available */
  features: MailWebSocketMessage['features'] | null;
  /** Subscribe to folder updates */
  subscribeFolder: (folder: string) => void;
  /** Unsubscribe from folder updates */
  unsubscribeFolder: (folder: string) => void;
  /** Request current connection status */
  requestStatus: () => void;
  /** Manually reconnect */
  reconnect: () => void;
  /** Disconnect WebSocket */
  disconnect: () => void;
}

export function useMailWebSocket(options: UseMailWebSocketOptions = {}): UseMailWebSocketReturn {
  const {
    onNewEmail,
    onEmailUpdated,
    onFolderUpdated,
    onConnect,
    onDisconnect,
    onError,
    autoReconnect = true,
    reconnectDelay = 3000,
    maxReconnectAttempts = 5,
  } = options;

  const { token, isAuthenticated } = useAuthStore();
  const wsRef = useRef<WebSocket | null>(null);
  const pingIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const reconnectAttemptsRef = useRef(0);
  const isConnectingRef = useRef(false);
  const isMountedRef = useRef(false);

  const [isConnected, setIsConnected] = useState(false);
  const [features, setFeatures] = useState<MailWebSocketMessage['features'] | null>(null);

  // Create WebSocket URL
  const getWebSocketUrl = useCallback(() => {
    if (!token) return null;
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    return `${protocol}//${window.location.host}/api/v1/mail/ws?token=${token}`;
  }, [token]);

  // Handle incoming messages
  const handleMessage = useCallback(
    (event: MessageEvent) => {
      try {
        const message: MailWebSocketMessage = JSON.parse(event.data);

        switch (message.type) {
          case 'connected':
            setIsConnected(true);
            setFeatures(message.features || null);
            reconnectAttemptsRef.current = 0;
            onConnect?.(message.features);
            break;

          case 'new_email':
            onNewEmail?.(message.folder || 'INBOX', message.preview);
            break;

          case 'email_updated':
            if (message.message_id && message.update_type) {
              onEmailUpdated?.(message.message_id, message.update_type, message.data);
            }
            break;

          case 'folder_updated':
            if (message.folder) {
              onFolderUpdated?.(message.folder, message.unread_count);
            }
            break;

          case 'error':
            onError?.(message.message || 'Unknown error');
            break;

          case 'pong':
            // Keep-alive response, no action needed
            break;

          case 'subscribed':
          case 'unsubscribed':
          case 'status':
            // Acknowledgment messages, no action needed
            break;
        }
      } catch (e) {
        console.error('[useMailWebSocket] Failed to parse message:', e);
      }
    },
    [onNewEmail, onEmailUpdated, onFolderUpdated, onConnect, onError]
  );

  // Connect to WebSocket
  const connect = useCallback(() => {
    const url = getWebSocketUrl();
    if (!url) {
      return;
    }

    // Prevent duplicate connections
    if (isConnectingRef.current) {
      console.log('[useMailWebSocket] Already connecting, skipping...');
      return;
    }

    if (wsRef.current?.readyState === WebSocket.OPEN) {
      console.log('[useMailWebSocket] Already connected, skipping...');
      return;
    }

    if (wsRef.current?.readyState === WebSocket.CONNECTING) {
      console.log('[useMailWebSocket] Connection in progress, skipping...');
      return;
    }

    // Clean up existing connection
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }

    isConnectingRef.current = true;
    console.log('[useMailWebSocket] Connecting...');
    const ws = new WebSocket(url);

    ws.onopen = () => {
      console.log('[useMailWebSocket] Connected');
      isConnectingRef.current = false;
    };

    ws.onmessage = handleMessage;

    ws.onclose = (event) => {
      console.log('[useMailWebSocket] Disconnected:', event.code, event.reason);
      isConnectingRef.current = false;
      setIsConnected(false);
      setFeatures(null);

      // Only handle disconnect if component is still mounted
      if (isMountedRef.current) {
        onDisconnect?.();

        // Clear ping interval
        if (pingIntervalRef.current) {
          clearInterval(pingIntervalRef.current);
          pingIntervalRef.current = null;
        }

        // Auto-reconnect if enabled and component still mounted
        if (autoReconnect && reconnectAttemptsRef.current < maxReconnectAttempts && isMountedRef.current) {
          reconnectAttemptsRef.current += 1;
          console.log(
            `[useMailWebSocket] Reconnecting in ${reconnectDelay}ms (attempt ${reconnectAttemptsRef.current}/${maxReconnectAttempts})`
          );
          reconnectTimeoutRef.current = setTimeout(connect, reconnectDelay);
        }
      }
    };

    ws.onerror = (error) => {
      console.error('[useMailWebSocket] Error:', error);
      isConnectingRef.current = false;
      if (isMountedRef.current) {
        onError?.('WebSocket connection error');
      }
    };

    wsRef.current = ws;

    // Set up ping interval (every 30 seconds)
    if (pingIntervalRef.current) {
      clearInterval(pingIntervalRef.current);
    }
    pingIntervalRef.current = setInterval(() => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: 'ping' }));
      }
    }, 30000);
  }, [getWebSocketUrl, handleMessage, autoReconnect, reconnectDelay, maxReconnectAttempts, onDisconnect, onError]);

  // Disconnect from WebSocket
  const disconnect = useCallback(() => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }

    if (pingIntervalRef.current) {
      clearInterval(pingIntervalRef.current);
      pingIntervalRef.current = null;
    }

    if (wsRef.current) {
      // Disable auto-reconnect for manual disconnect
      reconnectAttemptsRef.current = maxReconnectAttempts;
      wsRef.current.close();
      wsRef.current = null;
    }

    setIsConnected(false);
    setFeatures(null);
  }, [maxReconnectAttempts]);

  // Reconnect manually
  const reconnect = useCallback(() => {
    reconnectAttemptsRef.current = 0;
    disconnect();
    setTimeout(connect, 100);
  }, [connect, disconnect]);

  // Subscribe to folder updates
  const subscribeFolder = useCallback((folder: string) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: 'subscribe_folder', folder }));
    }
  }, []);

  // Unsubscribe from folder updates
  const unsubscribeFolder = useCallback((folder: string) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: 'unsubscribe_folder', folder }));
    }
  }, []);

  // Request connection status
  const requestStatus = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: 'get_status' }));
    }
  }, []);

  // Connect when authenticated
  useEffect(() => {
    isMountedRef.current = true;

    if (isAuthenticated && token) {
      // Small delay to avoid React strict mode double-connect
      const timeoutId = setTimeout(() => {
        if (isMountedRef.current) {
          connect();
        }
      }, 100);

      return () => {
        clearTimeout(timeoutId);
        isMountedRef.current = false;
        disconnect();
      };
    } else {
      disconnect();
    }

    return () => {
      isMountedRef.current = false;
      disconnect();
    };
  }, [isAuthenticated, token, connect, disconnect]);

  return {
    isConnected,
    features,
    subscribeFolder,
    unsubscribeFolder,
    requestStatus,
    reconnect,
    disconnect,
  };
}

export default useMailWebSocket;
