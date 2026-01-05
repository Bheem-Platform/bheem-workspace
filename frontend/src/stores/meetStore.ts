import { create } from 'zustand';
import * as meetApi from '@/lib/meetApi';
import type {
  Meeting,
  Participant,
  ChatMessage,
  CreateMeetingData,
  MeetConfig,
  Recording,
  Transcript,
  EnhancedChatMessage,
  WaitingParticipant,
  RecordingSession,
} from '@/types/meet';

interface MeetState {
  // Data
  meetings: Meeting[];
  currentMeeting: Meeting | null;
  participants: Participant[];
  chatMessages: EnhancedChatMessage[];
  meetConfig: MeetConfig | null;

  // Room state
  roomToken: string | null;
  wsUrl: string | null;
  roomCode: string | null;
  roomName: string | null;
  isHost: boolean;

  // Device state
  isMicEnabled: boolean;
  isCameraEnabled: boolean;
  isScreenSharing: boolean;

  // Recording state
  recordingSession: RecordingSession;
  recordings: Recording[];
  currentTranscript: Transcript | null;

  // Waiting room state
  waitingParticipants: WaitingParticipant[];
  waitingRoomEnabled: boolean;
  myWaitingId: string | null;
  myWaitingStatus: 'waiting' | 'admitted' | 'rejected' | null;

  // UI state
  isCreateModalOpen: boolean;
  isChatPanelOpen: boolean;
  isParticipantsPanelOpen: boolean;
  isWaitingRoomPanelOpen: boolean;
  isRecordingsModalOpen: boolean;
  activeView: 'grid' | 'speaker' | 'sidebar';

  // Loading
  loading: {
    meetings: boolean;
    joining: boolean;
    creating: boolean;
    recording: boolean;
    chat: boolean;
    waitingRoom: boolean;
  };

  // Error
  error: string | null;

  // Actions - Meetings
  fetchMeetings: (status?: string) => Promise<void>;
  createMeeting: (data: CreateMeetingData) => Promise<{ roomCode: string; joinUrl: string } | null>;
  endMeeting: (roomCode: string) => Promise<void>;

  // Actions - Room
  joinRoom: (roomCode: string, participantName: string) => Promise<boolean>;
  leaveRoom: () => void;
  getRoomInfo: (roomCode: string) => Promise<void>;

  // Actions - Devices
  toggleMic: () => void;
  toggleCamera: () => void;
  toggleScreenShare: () => void;

  // Actions - Recording
  startRecording: (options?: { layout?: string; resolution?: string }) => Promise<boolean>;
  stopRecording: () => Promise<boolean>;
  fetchRecordings: (roomCode?: string) => Promise<void>;
  deleteRecording: (recordingId: string) => Promise<boolean>;
  fetchTranscript: (recordingId: string) => Promise<void>;
  requestTranscription: (recordingId: string, language?: string) => Promise<boolean>;
  createShareLink: (recordingId: string, expireDays?: number) => Promise<string | null>;

  // Actions - Chat
  loadChatMessages: () => Promise<void>;
  sendMessage: (content: string, replyToId?: string) => Promise<void>;
  editMessage: (messageId: string, content: string) => Promise<void>;
  deleteMessage: (messageId: string) => Promise<void>;
  addReaction: (messageId: string, emoji: string) => Promise<void>;
  exportChat: (format?: 'json' | 'txt' | 'csv') => Promise<string | object | null>;

  // Actions - Waiting Room
  fetchWaitingParticipants: () => Promise<void>;
  admitParticipant: (waitingId: string) => Promise<void>;
  rejectParticipant: (waitingId: string) => Promise<void>;
  admitAllParticipants: () => Promise<void>;
  joinWaitingRoom: (displayName: string) => Promise<boolean>;
  checkMyWaitingStatus: () => Promise<void>;
  toggleWaitingRoom: (enabled: boolean) => Promise<void>;

  // Actions - UI
  openCreateModal: () => void;
  closeCreateModal: () => void;
  toggleChatPanel: () => void;
  toggleParticipantsPanel: () => void;
  toggleWaitingRoomPanel: () => void;
  openRecordingsModal: () => void;
  closeRecordingsModal: () => void;
  setActiveView: (view: 'grid' | 'speaker' | 'sidebar') => void;

  // Actions - Participants
  updateParticipants: (participants: Participant[]) => void;
  addChatMessage: (message: ChatMessage) => void;

  // Utils
  clearError: () => void;
  reset: () => void;
  fetchConfig: () => Promise<void>;
}

const initialRecordingSession: RecordingSession = {
  isRecording: false,
  recordingId: undefined,
  egressId: undefined,
  startedAt: undefined,
  duration: 0,
};

const initialState = {
  meetings: [],
  currentMeeting: null,
  participants: [],
  chatMessages: [],
  meetConfig: null,
  roomToken: null,
  wsUrl: null,
  roomCode: null,
  roomName: null,
  isHost: false,
  isMicEnabled: true,
  isCameraEnabled: true,
  isScreenSharing: false,
  recordingSession: initialRecordingSession,
  recordings: [],
  currentTranscript: null,
  waitingParticipants: [],
  waitingRoomEnabled: true,
  myWaitingId: null,
  myWaitingStatus: null,
  isCreateModalOpen: false,
  isChatPanelOpen: false,
  isParticipantsPanelOpen: false,
  isWaitingRoomPanelOpen: false,
  isRecordingsModalOpen: false,
  activeView: 'grid' as const,
  loading: {
    meetings: false,
    joining: false,
    creating: false,
    recording: false,
    chat: false,
    waitingRoom: false,
  },
  error: null,
};

export const useMeetStore = create<MeetState>((set, get) => ({
  ...initialState,

  // ============================================
  // Meeting Actions
  // ============================================

  fetchMeetings: async (status?: string) => {
    set((state) => ({ loading: { ...state.loading, meetings: true }, error: null }));

    try {
      const meetings = await meetApi.listRooms(status);
      set({ meetings });
    } catch (error: any) {
      set({ error: error.response?.data?.detail || 'Failed to fetch meetings' });
    } finally {
      set((state) => ({ loading: { ...state.loading, meetings: false } }));
    }
  },

  createMeeting: async (data: CreateMeetingData) => {
    set((state) => ({ loading: { ...state.loading, creating: true }, error: null }));

    try {
      const result = await meetApi.createRoom(data);

      set((state) => ({
        meetings: [{
          id: result.room_id,
          roomCode: result.room_code,
          roomName: result.name,
          title: result.name,
          status: 'scheduled' as const,
          joinUrl: result.join_url,
          createdAt: result.created_at,
          participantsCount: 0,
          maxParticipants: 100,
          hostId: '',
          hostName: '',
          isRecording: false,
          hasRecording: false,
          settings: {
            allowGuests: true,
            waitingRoom: data.settings?.waitingRoom ?? true,
            muteOnEntry: data.settings?.muteOnEntry ?? false,
            videoOffOnEntry: data.settings?.videoOffOnEntry ?? false,
            allowScreenShare: true,
            allowChat: true,
            allowRecording: true,
          },
        }, ...state.meetings],
        isCreateModalOpen: false,
      }));

      return {
        roomCode: result.room_code,
        joinUrl: result.join_url,
      };
    } catch (error: any) {
      set({ error: error.response?.data?.detail || 'Failed to create meeting' });
      return null;
    } finally {
      set((state) => ({ loading: { ...state.loading, creating: false } }));
    }
  },

  endMeeting: async (roomCode: string) => {
    try {
      await meetApi.endRoom(roomCode);
      set((state) => ({
        meetings: state.meetings.map((m) =>
          m.roomCode === roomCode ? { ...m, status: 'ended' } : m
        ),
      }));
    } catch (error: any) {
      set({ error: error.response?.data?.detail || 'Failed to end meeting' });
    }
  },

  // ============================================
  // Room Actions
  // ============================================

  joinRoom: async (roomCode: string, participantName: string) => {
    set((state) => ({ loading: { ...state.loading, joining: true }, error: null }));

    try {
      const tokenData = await meetApi.getJoinToken({
        roomCode,
        participantName,
      });

      set({
        roomToken: tokenData.token,
        wsUrl: tokenData.wsUrl,
        roomCode: tokenData.roomCode,
        roomName: tokenData.roomName,
        isHost: (tokenData as any).isHost || false,
      });

      return true;
    } catch (error: any) {
      set({ error: error.response?.data?.detail || 'Failed to join meeting' });
      return false;
    } finally {
      set((state) => ({ loading: { ...state.loading, joining: false } }));
    }
  },

  leaveRoom: () => {
    const { recordingSession } = get();

    // Stop recording if active before leaving
    if (recordingSession.isRecording && recordingSession.recordingId) {
      get().stopRecording();
    }

    set({
      roomToken: null,
      wsUrl: null,
      roomCode: null,
      roomName: null,
      isHost: false,
      participants: [],
      chatMessages: [],
      isScreenSharing: false,
      recordingSession: initialRecordingSession,
      waitingParticipants: [],
      myWaitingId: null,
      myWaitingStatus: null,
    });
  },

  getRoomInfo: async (roomCode: string) => {
    try {
      const room = await meetApi.getRoom(roomCode);
      set({
        currentMeeting: {
          id: room.id || roomCode,
          roomCode: room.roomCode,
          roomName: room.title,
          title: room.title,
          status: (room.status || 'active') as 'scheduled' | 'active' | 'ended' | 'cancelled',
          joinUrl: room.joinUrl,
          scheduledStart: room.scheduledTime,
          createdAt: new Date().toISOString(),
          participantsCount: 0,
          maxParticipants: room.maxParticipants || 100,
          hostId: '',
          hostName: '',
          isRecording: false,
          hasRecording: false,
          settings: {
            allowGuests: true,
            waitingRoom: true,
            muteOnEntry: false,
            videoOffOnEntry: false,
            allowScreenShare: true,
            allowChat: true,
            allowRecording: true,
          },
        },
      });
    } catch (error: any) {
      set({ error: error.response?.data?.detail || 'Failed to get room info' });
    }
  },

  // ============================================
  // Device Actions
  // ============================================

  toggleMic: () => {
    set((state) => ({ isMicEnabled: !state.isMicEnabled }));
  },

  toggleCamera: () => {
    set((state) => ({ isCameraEnabled: !state.isCameraEnabled }));
  },

  toggleScreenShare: () => {
    set((state) => ({ isScreenSharing: !state.isScreenSharing }));
  },

  // ============================================
  // Recording Actions
  // ============================================

  startRecording: async (options) => {
    const { roomCode } = get();
    if (!roomCode) return false;

    set((state) => ({ loading: { ...state.loading, recording: true }, error: null }));

    try {
      const result = await meetApi.startRecording(roomCode, options);

      set({
        recordingSession: {
          isRecording: true,
          recordingId: result.recordingId,
          egressId: result.egressId,
          startedAt: new Date().toISOString(),
          duration: 0,
        },
      });

      // Start duration counter
      const interval = setInterval(() => {
        const { recordingSession } = get();
        if (recordingSession.isRecording) {
          set({
            recordingSession: {
              ...recordingSession,
              duration: recordingSession.duration + 1,
            },
          });
        } else {
          clearInterval(interval);
        }
      }, 1000);

      return true;
    } catch (error: any) {
      set({ error: error.response?.data?.detail || 'Failed to start recording' });
      return false;
    } finally {
      set((state) => ({ loading: { ...state.loading, recording: false } }));
    }
  },

  stopRecording: async () => {
    const { recordingSession } = get();
    if (!recordingSession.recordingId) return false;

    set((state) => ({ loading: { ...state.loading, recording: true }, error: null }));

    try {
      await meetApi.stopRecording(recordingSession.recordingId);

      set({
        recordingSession: {
          ...recordingSession,
          isRecording: false,
        },
      });

      return true;
    } catch (error: any) {
      set({ error: error.response?.data?.detail || 'Failed to stop recording' });
      return false;
    } finally {
      set((state) => ({ loading: { ...state.loading, recording: false } }));
    }
  },

  fetchRecordings: async (roomCode?: string) => {
    const code = roomCode || get().roomCode;

    try {
      const recordings = await meetApi.listRecordings(code || undefined);
      set({ recordings });
    } catch (error: any) {
      console.error('Failed to fetch recordings:', error);
    }
  },

  deleteRecording: async (recordingId: string) => {
    try {
      await meetApi.deleteRecording(recordingId);
      set((state) => ({
        recordings: state.recordings.filter((r) => r.id !== recordingId),
      }));
      return true;
    } catch (error: any) {
      set({ error: error.response?.data?.detail || 'Failed to delete recording' });
      return false;
    }
  },

  fetchTranscript: async (recordingId: string) => {
    try {
      const transcript = await meetApi.getTranscript(recordingId);
      set({ currentTranscript: transcript });
    } catch (error: any) {
      console.error('Failed to fetch transcript:', error);
    }
  },

  requestTranscription: async (recordingId: string, language?: string) => {
    try {
      await meetApi.requestTranscription(recordingId, language);
      return true;
    } catch (error: any) {
      set({ error: error.response?.data?.detail || 'Failed to request transcription' });
      return false;
    }
  },

  createShareLink: async (recordingId: string, expireDays?: number) => {
    try {
      const result = await meetApi.createShareLink(recordingId, expireDays);
      return result.shareUrl;
    } catch (error: any) {
      set({ error: error.response?.data?.detail || 'Failed to create share link' });
      return null;
    }
  },

  // ============================================
  // Chat Actions
  // ============================================

  loadChatMessages: async () => {
    const { roomCode } = get();
    if (!roomCode) return;

    // Skip loading chat history for guest users (no auth token)
    // Guests can still use real-time chat via LiveKit data channel
    if (typeof window !== 'undefined' && !localStorage.getItem('auth_token')) {
      console.log('Skipping chat history load for guest user - using real-time chat only');
      return;
    }

    set((state) => ({ loading: { ...state.loading, chat: true } }));

    try {
      const messages = await meetApi.getChatMessages(roomCode);
      set({ chatMessages: messages });
    } catch (error: any) {
      // Silently ignore 403 errors for guests who might have expired tokens
      if (error.response?.status !== 403) {
        console.error('Failed to load chat messages:', error);
      }
    } finally {
      set((state) => ({ loading: { ...state.loading, chat: false } }));
    }
  },

  sendMessage: async (content: string, replyToId?: string) => {
    const { roomCode } = get();
    if (!roomCode || !content.trim()) return;

    // For guest users (no auth token), skip the backend API
    // The message will be sent via LiveKit data channel in ChatPanel
    if (typeof window !== 'undefined' && !localStorage.getItem('auth_token')) {
      console.log('Guest user - skipping backend chat API, using LiveKit data channel');
      return;
    }

    try {
      const message = await meetApi.sendChatMessage(roomCode, content, { replyToId });
      set((state) => ({
        chatMessages: [...state.chatMessages, message],
      }));
    } catch (error: any) {
      // Silently ignore 403 errors for guests
      if (error.response?.status !== 403) {
        set({ error: error.response?.data?.detail || 'Failed to send message' });
      }
    }
  },

  editMessage: async (messageId: string, content: string) => {
    const { roomCode } = get();
    if (!roomCode) return;

    try {
      await meetApi.editChatMessage(roomCode, messageId, content);
      set((state) => ({
        chatMessages: state.chatMessages.map((m) =>
          m.id === messageId ? { ...m, content, isEdited: true } : m
        ),
      }));
    } catch (error: any) {
      set({ error: error.response?.data?.detail || 'Failed to edit message' });
    }
  },

  deleteMessage: async (messageId: string) => {
    const { roomCode } = get();
    if (!roomCode) return;

    try {
      await meetApi.deleteChatMessage(roomCode, messageId);
      set((state) => ({
        chatMessages: state.chatMessages.map((m) =>
          m.id === messageId ? { ...m, content: '[Message deleted]', isDeleted: true } : m
        ),
      }));
    } catch (error: any) {
      set({ error: error.response?.data?.detail || 'Failed to delete message' });
    }
  },

  addReaction: async (messageId: string, emoji: string) => {
    const { roomCode } = get();
    if (!roomCode) return;

    try {
      const result = await meetApi.addReaction(roomCode, messageId, emoji);
      set((state) => ({
        chatMessages: state.chatMessages.map((m) =>
          m.id === messageId ? { ...m, reactions: result.reactions } : m
        ),
      }));
    } catch (error: any) {
      console.error('Failed to add reaction:', error);
    }
  },

  exportChat: async (format: 'json' | 'txt' | 'csv' = 'json') => {
    const { roomCode } = get();
    if (!roomCode) return null;

    try {
      return await meetApi.exportChat(roomCode, format);
    } catch (error: any) {
      set({ error: error.response?.data?.detail || 'Failed to export chat' });
      return null;
    }
  },

  // ============================================
  // Waiting Room Actions
  // ============================================

  fetchWaitingParticipants: async () => {
    const { roomCode, isHost } = get();
    if (!roomCode || !isHost) return;

    set((state) => ({ loading: { ...state.loading, waitingRoom: true } }));

    try {
      const participants = await meetApi.getWaitingParticipants(roomCode);
      set({ waitingParticipants: participants });
    } catch (error: any) {
      console.error('Failed to fetch waiting participants:', error);
    } finally {
      set((state) => ({ loading: { ...state.loading, waitingRoom: false } }));
    }
  },

  admitParticipant: async (waitingId: string) => {
    const { roomCode } = get();
    if (!roomCode) return;

    try {
      await meetApi.admitParticipant(roomCode, waitingId);
      set((state) => ({
        waitingParticipants: state.waitingParticipants.filter((p) => p.id !== waitingId),
      }));
    } catch (error: any) {
      set({ error: error.response?.data?.detail || 'Failed to admit participant' });
    }
  },

  rejectParticipant: async (waitingId: string) => {
    const { roomCode } = get();
    if (!roomCode) return;

    try {
      await meetApi.rejectParticipant(roomCode, waitingId);
      set((state) => ({
        waitingParticipants: state.waitingParticipants.filter((p) => p.id !== waitingId),
      }));
    } catch (error: any) {
      set({ error: error.response?.data?.detail || 'Failed to reject participant' });
    }
  },

  admitAllParticipants: async () => {
    const { roomCode } = get();
    if (!roomCode) return;

    try {
      await meetApi.admitAllParticipants(roomCode);
      set({ waitingParticipants: [] });
    } catch (error: any) {
      set({ error: error.response?.data?.detail || 'Failed to admit all participants' });
    }
  },

  joinWaitingRoom: async (displayName: string) => {
    const { roomCode } = get();
    if (!roomCode) return false;

    try {
      const result = await meetApi.joinWaitingRoom(roomCode, displayName);
      set({
        myWaitingId: result.waitingId,
        myWaitingStatus: result.status as 'waiting' | 'admitted' | 'rejected',
      });
      return result.status === 'admitted';
    } catch (error: any) {
      set({ error: error.response?.data?.detail || 'Failed to join waiting room' });
      return false;
    }
  },

  checkMyWaitingStatus: async () => {
    const { roomCode, myWaitingId } = get();
    if (!roomCode || !myWaitingId) return;

    try {
      const result = await meetApi.checkAdmissionStatus(roomCode, myWaitingId);
      set({ myWaitingStatus: result.status as 'waiting' | 'admitted' | 'rejected' });
    } catch (error: any) {
      console.error('Failed to check waiting status:', error);
    }
  },

  toggleWaitingRoom: async (enabled: boolean) => {
    const { roomCode } = get();
    if (!roomCode) return;

    try {
      await meetApi.updateWaitingRoomSettings(roomCode, enabled);
      set({ waitingRoomEnabled: enabled });
    } catch (error: any) {
      set({ error: error.response?.data?.detail || 'Failed to update waiting room setting' });
    }
  },

  // ============================================
  // UI Actions
  // ============================================

  openCreateModal: () => {
    set({ isCreateModalOpen: true });
  },

  closeCreateModal: () => {
    set({ isCreateModalOpen: false });
  },

  toggleChatPanel: () => {
    set((state) => ({
      isChatPanelOpen: !state.isChatPanelOpen,
      isParticipantsPanelOpen: false,
      isWaitingRoomPanelOpen: false,
    }));
  },

  toggleParticipantsPanel: () => {
    set((state) => ({
      isParticipantsPanelOpen: !state.isParticipantsPanelOpen,
      isChatPanelOpen: false,
      isWaitingRoomPanelOpen: false,
    }));
  },

  toggleWaitingRoomPanel: () => {
    set((state) => ({
      isWaitingRoomPanelOpen: !state.isWaitingRoomPanelOpen,
      isChatPanelOpen: false,
      isParticipantsPanelOpen: false,
    }));
  },

  openRecordingsModal: () => {
    set({ isRecordingsModalOpen: true });
    get().fetchRecordings();
  },

  closeRecordingsModal: () => {
    set({ isRecordingsModalOpen: false, currentTranscript: null });
  },

  setActiveView: (view) => {
    set({ activeView: view });
  },

  // Legacy chat message support
  addChatMessage: (message: ChatMessage) => {
    // Check for duplicate messages by ID
    const existingMessages = get().chatMessages;
    if (existingMessages.some(m => m.id === message.id)) {
      console.log('Skipping duplicate chat message:', message.id);
      return;
    }

    const enhanced: EnhancedChatMessage = {
      id: message.id,
      roomCode: get().roomCode || '',
      senderId: message.senderId,
      senderName: message.senderName,
      content: message.content,
      messageType: message.type === 'system' ? 'system' : 'text',
      reactions: {},
      isEdited: false,
      isDeleted: false,
      createdAt: message.timestamp,
    };

    set((state) => ({
      chatMessages: [...state.chatMessages, enhanced],
    }));
  },

  updateParticipants: (participants: Participant[]) => {
    set({ participants });
  },

  clearError: () => {
    set({ error: null });
  },

  reset: () => {
    set(initialState);
  },

  fetchConfig: async () => {
    try {
      const config = await meetApi.getMeetConfig();
      set({ meetConfig: config });
    } catch (error) {
      console.error('Failed to fetch meet config:', error);
    }
  },
}));
