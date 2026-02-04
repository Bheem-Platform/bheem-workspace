/**
 * ChatLiveKitProvider - Real-time messaging provider using LiveKit data channels
 *
 * This component connects to LiveKit rooms for real-time features:
 * - Instant message delivery
 * - Typing indicators
 * - Read receipts
 * - Online presence
 */

'use client';

import { useEffect, useCallback, useRef } from 'react';
import { Room, RoomEvent, DataPacket_Kind, Participant, ConnectionState } from 'livekit-client';
import { useChatStore, type Message } from '@/stores/chatStore';

interface ChatLiveKitProviderProps {
  conversationId: string;
  token: string;
  wsUrl: string;
  currentUserId: string;
  currentUserName: string;
  children: React.ReactNode;
}

// Message types for data channel
type ChatDataMessage =
  | { type: 'message'; data: Message }
  | { type: 'typing'; userId: string; userName: string; isTyping: boolean }
  | { type: 'read'; userId: string; messageIds: string[] }
  | { type: 'delivered'; userId: string; messageIds: string[] }
  | { type: 'reaction'; messageId: string; emoji: string; userId: string; userName: string }
  | { type: 'edit'; messageId: string; content: string }
  | { type: 'delete'; messageId: string }
  | { type: 'presence'; userId: string; status: 'online' | 'offline'; lastSeen?: string };

export default function ChatLiveKitProvider({
  conversationId,
  token,
  wsUrl,
  currentUserId,
  currentUserName,
  children,
}: ChatLiveKitProviderProps) {
  const roomRef = useRef<Room | null>(null);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const reconnectAttemptRef = useRef(0);
  const connectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const lastConversationIdRef = useRef<string | null>(null);
  const isConnectingRef = useRef(false);

  const {
    addMessage,
    updateMessage,
    removeMessage,
    setTyping,
    setUserOnline,
    setConnected,
    updateMessageReadBy,
    updateMessageDelivery,
    updateParticipantPresence,
    setBroadcastMessageFn,
    setBroadcastDeleteFn,
    setBroadcastEditFn,
    setBroadcastTypingFn,
    setBroadcastReadReceiptFn,
  } = useChatStore();

  // Handle incoming data messages
  const handleDataMessage = useCallback(
    (payload: Uint8Array, participant?: Participant) => {
      try {
        const decoder = new TextDecoder();
        const json = decoder.decode(payload);
        const message: ChatDataMessage = JSON.parse(json);

        console.log('[ChatLiveKit] Received data message type:', message.type);
        console.log('[ChatLiveKit] From participant:', participant?.identity);

        switch (message.type) {
          case 'message':
            console.log('[ChatLiveKit] Received message from:', message.data.sender_id);
            console.log('[ChatLiveKit] Current user:', currentUserId);
            // Don't add our own messages (we already added them locally)
            if (message.data.sender_id !== currentUserId) {
              console.log('[ChatLiveKit] Adding message to store');
              addMessage(message.data);
            } else {
              console.log('[ChatLiveKit] Skipping own message');
            }
            break;

          case 'typing':
            if (message.userId !== currentUserId) {
              setTyping(conversationId, message.userId, message.userName, message.isTyping);
            }
            break;

          case 'read':
            // Update read receipts for messages
            if (message.userId !== currentUserId) {
              message.messageIds.forEach((msgId) => {
                updateMessageReadBy(conversationId, msgId, message.userId);
              });
            }
            break;

          case 'delivered':
            // Update delivery status for messages
            if (message.userId !== currentUserId) {
              message.messageIds.forEach((msgId) => {
                updateMessageDelivery(conversationId, msgId, message.userId);
              });
            }
            break;

          case 'reaction':
            // Reaction updates are handled via API response
            break;

          case 'edit':
            // Update the message content in store
            const messages = useChatStore.getState().messages[conversationId] || [];
            const editedMsg = messages.find(m => m.id === message.messageId);
            if (editedMsg) {
              updateMessage({
                ...editedMsg,
                content: message.content,
                is_edited: true,
              });
            }
            break;

          case 'delete':
            removeMessage(conversationId, message.messageId);
            break;

          case 'presence':
            setUserOnline(message.userId, message.status === 'online');
            // Also update participant presence if lastSeen is provided
            if (message.lastSeen) {
              updateParticipantPresence(
                conversationId,
                message.userId,
                message.lastSeen,
                message.status === 'online'
              );
            }
            break;
        }
      } catch (error) {
        console.error('[ChatLiveKit] Failed to parse data message:', error);
      }
    },
    [conversationId, currentUserId, addMessage, removeMessage, setTyping, setUserOnline, updateMessageReadBy, updateMessageDelivery, updateParticipantPresence]
  );

  // Send data message to all participants
  const sendDataMessage = useCallback(
    async (message: ChatDataMessage) => {
      console.log('[ChatLiveKit] sendDataMessage called, type:', message.type);
      console.log('[ChatLiveKit] Room ref exists:', !!roomRef.current);
      console.log('[ChatLiveKit] Room state:', roomRef.current?.state);

      if (!roomRef.current || roomRef.current.state !== ConnectionState.Connected) {
        console.warn('[ChatLiveKit] Room not connected, cannot send message. State:', roomRef.current?.state);
        return;
      }

      try {
        const encoder = new TextEncoder();
        const payload = encoder.encode(JSON.stringify(message));
        console.log('[ChatLiveKit] Publishing data to room...');
        await roomRef.current.localParticipant.publishData(payload, {
          reliable: true,
        });
        console.log('[ChatLiveKit] Data published successfully');
      } catch (error) {
        console.error('[ChatLiveKit] Failed to send data message:', error);
      }
    },
    []
  );

  // Broadcast new message
  const broadcastMessage = useCallback(
    (message: Message) => {
      console.log('[ChatLiveKit] broadcastMessage called for message:', message.id);
      console.log('[ChatLiveKit] Room state:', roomRef.current?.state);
      sendDataMessage({ type: 'message', data: message });
    },
    [sendDataMessage]
  );

  // Broadcast message deletion
  const broadcastDelete = useCallback(
    (conversationId: string, messageId: string) => {
      sendDataMessage({ type: 'delete', messageId });
    },
    [sendDataMessage]
  );

  // Broadcast message edit
  const broadcastEdit = useCallback(
    (conversationId: string, messageId: string, content: string) => {
      sendDataMessage({ type: 'edit', messageId, content });
    },
    [sendDataMessage]
  );

  // Broadcast typing indicator
  const broadcastTyping = useCallback(
    (isTyping: boolean) => {
      // Clear previous timeout
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }

      // Send typing indicator
      sendDataMessage({
        type: 'typing',
        userId: currentUserId,
        userName: currentUserName,
        isTyping,
      });

      // Auto-stop typing after 3 seconds
      if (isTyping) {
        typingTimeoutRef.current = setTimeout(() => {
          sendDataMessage({
            type: 'typing',
            userId: currentUserId,
            userName: currentUserName,
            isTyping: false,
          });
        }, 3000);
      }
    },
    [currentUserId, currentUserName, sendDataMessage]
  );

  // Broadcast read receipt for multiple messages
  const broadcastReadReceipt = useCallback(
    (messageIds: string[]) => {
      if (messageIds.length === 0) return;
      sendDataMessage({
        type: 'read',
        userId: currentUserId,
        messageIds,
      });
    },
    [currentUserId, sendDataMessage]
  );

  // Broadcast delivery status for multiple messages
  const broadcastDelivered = useCallback(
    (messageIds: string[]) => {
      if (messageIds.length === 0) return;
      sendDataMessage({
        type: 'delivered',
        userId: currentUserId,
        messageIds,
      });
    },
    [currentUserId, sendDataMessage]
  );

  // Register broadcast functions with store
  useEffect(() => {
    setBroadcastMessageFn(broadcastMessage);
    setBroadcastDeleteFn(broadcastDelete);
    setBroadcastEditFn(broadcastEdit);
    setBroadcastTypingFn(broadcastTyping);
    setBroadcastReadReceiptFn(broadcastReadReceipt);
    return () => {
      setBroadcastMessageFn(null);
      setBroadcastDeleteFn(null);
      setBroadcastEditFn(null);
      setBroadcastTypingFn(null);
      setBroadcastReadReceiptFn(null);
    };
  }, [broadcastMessage, broadcastDelete, broadcastEdit, broadcastTyping, broadcastReadReceipt, setBroadcastMessageFn, setBroadcastDeleteFn, setBroadcastEditFn, setBroadcastTypingFn, setBroadcastReadReceiptFn]);

  // Connect to LiveKit room with debouncing to prevent rapid reconnection
  useEffect(() => {
    if (!token || !wsUrl || !conversationId) {
      console.log('[ChatLiveKit] Missing token, wsUrl, or conversationId');
      return;
    }

    // Skip if same conversation and already connected
    if (
      lastConversationIdRef.current === conversationId &&
      roomRef.current?.state === ConnectionState.Connected
    ) {
      console.log('[ChatLiveKit] Already connected to this conversation');
      return;
    }

    // Cancel any pending connection
    if (connectTimeoutRef.current) {
      clearTimeout(connectTimeoutRef.current);
      connectTimeoutRef.current = null;
    }

    // Disconnect existing room if different conversation
    if (roomRef.current && lastConversationIdRef.current !== conversationId) {
      console.log('[ChatLiveKit] Disconnecting from previous room');
      roomRef.current.disconnect();
      roomRef.current = null;
    }

    // Debounce connection by 300ms to prevent rapid reconnection
    connectTimeoutRef.current = setTimeout(() => {
      if (isConnectingRef.current) {
        console.log('[ChatLiveKit] Connection already in progress, skipping');
        return;
      }

      isConnectingRef.current = true;
      lastConversationIdRef.current = conversationId;

      const room = new Room({
        // Optimize for data-only (no video/audio)
        adaptiveStream: false,
        dynacast: false,
      });

      roomRef.current = room;

      // Event handlers
      const handleConnected = () => {
        console.log('[ChatLiveKit] Connected to room:', `chat-${conversationId}`);
        setConnected(true);
        reconnectAttemptRef.current = 0;
        isConnectingRef.current = false;

        // Broadcast presence
        sendDataMessage({
          type: 'presence',
          userId: currentUserId,
          status: 'online',
        });
      };

      const handleDisconnected = () => {
        console.log('[ChatLiveKit] Disconnected from room');
        setConnected(false);
        isConnectingRef.current = false;
      };

      const handleReconnecting = () => {
        console.log('[ChatLiveKit] Reconnecting...');
        setConnected(false);
      };

      const handleReconnected = () => {
        console.log('[ChatLiveKit] Reconnected');
        setConnected(true);

        // Re-broadcast presence
        sendDataMessage({
          type: 'presence',
          userId: currentUserId,
          status: 'online',
        });
      };

      const handleParticipantConnected = (participant: Participant) => {
        console.log('[ChatLiveKit] Participant connected:', participant.identity);
        setUserOnline(participant.identity, true);
      };

      const handleParticipantDisconnected = (participant: Participant) => {
        console.log('[ChatLiveKit] Participant disconnected:', participant.identity);
        setUserOnline(participant.identity, false);
        setTyping(conversationId, participant.identity, '', false);
      };

      const handleDataReceived = (
        payload: Uint8Array,
        participant?: Participant,
        kind?: DataPacket_Kind
      ) => {
        handleDataMessage(payload, participant);
      };

      // Register event handlers
      room.on(RoomEvent.Connected, handleConnected);
      room.on(RoomEvent.Disconnected, handleDisconnected);
      room.on(RoomEvent.Reconnecting, handleReconnecting);
      room.on(RoomEvent.Reconnected, handleReconnected);
      room.on(RoomEvent.ParticipantConnected, handleParticipantConnected);
      room.on(RoomEvent.ParticipantDisconnected, handleParticipantDisconnected);
      room.on(RoomEvent.DataReceived, handleDataReceived);

      // Connect to room
      console.log('[ChatLiveKit] Connecting to room:', `chat-${conversationId}`);
      room
        .connect(wsUrl, token)
        .then(() => {
          console.log('[ChatLiveKit] Connection initiated');

          // Mark existing participants as online
          room.remoteParticipants.forEach((p) => {
            setUserOnline(p.identity, true);
          });
        })
        .catch((error) => {
          console.error('[ChatLiveKit] Connection failed:', error);
          setConnected(false);
          isConnectingRef.current = false;
        });
    }, 300);

    // Cleanup on unmount
    return () => {
      console.log('[ChatLiveKit] Cleaning up...');

      // Clear connect timeout
      if (connectTimeoutRef.current) {
        clearTimeout(connectTimeoutRef.current);
        connectTimeoutRef.current = null;
      }

      // Clear typing timeout
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }

      // Broadcast offline status before disconnect
      if (roomRef.current?.state === ConnectionState.Connected) {
        const encoder = new TextEncoder();
        const payload = encoder.encode(
          JSON.stringify({
            type: 'presence',
            userId: currentUserId,
            status: 'offline',
          })
        );
        roomRef.current.localParticipant.publishData(payload, { reliable: true }).catch(() => {});
      }

      // Disconnect
      if (roomRef.current) {
        roomRef.current.disconnect();
        roomRef.current = null;
      }

      isConnectingRef.current = false;
      setConnected(false);
    };
  }, [
    token,
    wsUrl,
    conversationId,
    currentUserId,
    handleDataMessage,
    sendDataMessage,
    setConnected,
    setTyping,
    setUserOnline,
  ]);

  // Expose methods via store or context
  // For now, we use a simpler approach - the component handles everything

  return <>{children}</>;
}

// Hook to access chat LiveKit functions (exported for use in chat components)
export function useChatLiveKit() {
  // This hook would be used if we implement a context-based approach
  // For now, typing indicators are handled directly in the MessageInput component
  // via the onTyping callback from the store

  return {
    // Placeholder for future context-based methods
  };
}
