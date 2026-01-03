import { api } from './api';
import type {
  Meeting,
  CreateMeetingData,
  JoinMeetingData,
  MeetingToken,
  MeetConfig,
  Recording,
  Transcript,
  EnhancedChatMessage,
  WaitingParticipant,
} from '@/types/meet';

// Room/Meeting operations
export const createRoom = async (data: CreateMeetingData): Promise<{
  room_id: string;
  room_code: string;
  name: string;
  join_url: string;
  host_token: string;
  ws_url: string;
  created_at: string;
}> => {
  const response = await api.post('/meet/rooms', {
    name: data.title,
    scheduled_time: data.scheduledStart,
    duration_minutes: data.durationMinutes,
    description: data.description,
    max_participants: data.maxParticipants || 100,
    participants: data.participants,
    send_invites: data.sendInvites ?? true,
  });
  return response.data;
};

export const getJoinToken = async (data: JoinMeetingData): Promise<MeetingToken> => {
  const response = await api.post('/meet/token', {
    room_code: data.roomCode,
    participant_name: data.participantName,
  });
  return {
    token: response.data.token,
    wsUrl: response.data.ws_url,
    roomCode: response.data.room_code,
    roomName: response.data.room_name,
  };
};

export const listRooms = async (status?: string): Promise<Meeting[]> => {
  const response = await api.get('/meet/rooms', {
    params: status ? { status } : undefined,
  });
  return (response.data || []).map((room: any) => ({
    id: room.id,
    roomCode: room.room_code,
    title: room.name,
    status: room.status,
    joinUrl: room.join_url,
    createdBy: room.created_by,
    createdAt: room.created_at,
    scheduledTime: room.scheduled_time,
    participantCount: room.participant_count || 0,
  }));
};

export const getRoom = async (roomCode: string): Promise<{
  id?: string;
  roomCode: string;
  title: string;
  status: string;
  joinUrl: string;
  wsUrl: string;
  scheduledTime?: string;
  maxParticipants?: number;
}> => {
  const response = await api.get(`/meet/rooms/${roomCode}`);
  return {
    id: response.data.id,
    roomCode: response.data.room_code,
    title: response.data.name,
    status: response.data.status,
    joinUrl: response.data.join_url,
    wsUrl: response.data.ws_url,
    scheduledTime: response.data.scheduled_time,
    maxParticipants: response.data.max_participants,
  };
};

export const endRoom = async (roomCode: string): Promise<void> => {
  await api.post(`/meet/rooms/${roomCode}/end`);
};

export const getMeetConfig = async (): Promise<MeetConfig> => {
  const response = await api.get('/meet/config');
  return {
    wsUrl: response.data.ws_url,
    workspaceUrl: response.data.workspace_url,
    maxParticipants: response.data.max_participants,
    recordingEnabled: response.data.recording_enabled,
  };
};

// Helper functions
export function generateMeetingLink(roomCode: string): string {
  if (typeof window !== 'undefined') {
    return `${window.location.origin}/meet/room/${roomCode}`;
  }
  return `/meet/room/${roomCode}`;
}

export function formatDuration(minutes: number): string {
  if (minutes < 60) {
    return `${minutes} min`;
  }
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
}

export function formatMeetingTime(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

// ============================================
// Recording API
// ============================================

export const startRecording = async (
  roomCode: string,
  options?: { layout?: string; resolution?: string; audioOnly?: boolean }
): Promise<{ recordingId: string; egressId: string; status: string }> => {
  const response = await api.post('/recordings/start', {
    room_code: roomCode,
    ...options,
  });
  return {
    recordingId: response.data.recording_id,
    egressId: response.data.egress_id,
    status: response.data.status,
  };
};

export const stopRecording = async (
  recordingId: string
): Promise<{ status: string; duration?: number }> => {
  const response = await api.post(`/recordings/${recordingId}/stop`);
  return {
    status: response.data.status,
    duration: response.data.duration_seconds,
  };
};

export const getRecording = async (recordingId: string): Promise<Recording> => {
  const response = await api.get(`/recordings/${recordingId}`);
  return mapRecordingResponse(response.data);
};

export const listRecordings = async (
  roomCode?: string,
  limit?: number
): Promise<Recording[]> => {
  const response = await api.get('/recordings', {
    params: { room_code: roomCode, limit },
  });
  return (response.data.recordings || []).map(mapRecordingResponse);
};

export const deleteRecording = async (recordingId: string): Promise<void> => {
  await api.delete(`/recordings/${recordingId}`);
};

export const getTranscript = async (recordingId: string): Promise<Transcript | null> => {
  try {
    const response = await api.get(`/recordings/${recordingId}/transcript`);
    if (!response.data || !response.data.text) return null;

    const t = response.data;
    return {
      id: t.id || recordingId,
      recordingId: t.recording_id || recordingId,
      text: t.text,
      segments: t.segments || [],
      language: t.language || 'en',
      wordCount: t.word_count || 0,
      summary: t.summary,
      actionItems: t.action_items || [],
      keyTopics: t.key_topics || [],
      createdAt: t.created_at,
    };
  } catch {
    return null;
  }
};

export const requestTranscription = async (
  recordingId: string,
  language?: string
): Promise<{ status: string }> => {
  const response = await api.post(`/recordings/${recordingId}/transcribe`, {
    language,
  });
  return { status: response.data.status };
};

export const createShareLink = async (
  recordingId: string,
  expireDays?: number
): Promise<{ shareUrl: string }> => {
  const response = await api.post(`/recordings/${recordingId}/share`, {
    expire_days: expireDays,
  });
  return { shareUrl: response.data.share_url };
};

function mapRecordingResponse(data: any): Recording {
  return {
    id: data.id,
    meetingId: data.room_code,
    meetingTitle: data.room_name || data.room_code,
    roomCode: data.room_code,
    duration: data.duration_seconds || 0,
    size: data.file_size_bytes || 0,
    createdAt: data.created_at,
    url: data.download_url || '',
    shareUrl: data.share_url,
    status: data.status,
    hasTranscript: data.has_transcript || false,
    storagePath: data.storage_path,
    storageType: data.storage_type,
  };
}

// ============================================
// Chat API
// ============================================

export const getChatMessages = async (
  roomCode: string,
  options?: { limit?: number; before?: string; after?: string }
): Promise<EnhancedChatMessage[]> => {
  const response = await api.get(`/meet/chat/${roomCode}/messages`, {
    params: options,
  });
  return (response.data.messages || []).map(mapChatMessage);
};

export const sendChatMessage = async (
  roomCode: string,
  content: string,
  options?: { messageType?: string; replyToId?: string }
): Promise<EnhancedChatMessage> => {
  const response = await api.post(`/meet/chat/${roomCode}/messages`, {
    content,
    message_type: options?.messageType || 'text',
    reply_to_id: options?.replyToId,
  });
  return mapChatMessage(response.data.message);
};

export const editChatMessage = async (
  roomCode: string,
  messageId: string,
  content: string
): Promise<void> => {
  await api.put(`/meet/chat/${roomCode}/messages/${messageId}`, { content });
};

export const deleteChatMessage = async (
  roomCode: string,
  messageId: string
): Promise<void> => {
  await api.delete(`/meet/chat/${roomCode}/messages/${messageId}`);
};

export const addReaction = async (
  roomCode: string,
  messageId: string,
  emoji: string
): Promise<{ reactions: Record<string, string[]> }> => {
  const response = await api.post(
    `/meet/chat/${roomCode}/messages/${messageId}/react`,
    { emoji }
  );
  return { reactions: response.data.reactions };
};

export const exportChat = async (
  roomCode: string,
  format: 'json' | 'txt' | 'csv' = 'json'
): Promise<string | object> => {
  const response = await api.get(`/meet/chat/${roomCode}/export`, {
    params: { format },
  });
  return format === 'json' ? response.data : response.data.content;
};

function mapChatMessage(data: any): EnhancedChatMessage {
  return {
    id: data.id,
    roomCode: data.room_code,
    senderId: data.sender_id,
    senderName: data.sender_name,
    senderAvatar: data.sender_avatar,
    content: data.content,
    messageType: data.message_type || 'text',
    replyToId: data.reply_to_id,
    reactions: data.reactions || {},
    isEdited: data.is_edited || false,
    isDeleted: data.is_deleted || false,
    createdAt: data.created_at,
    updatedAt: data.updated_at,
  };
}

// ============================================
// Waiting Room API
// ============================================

export const joinWaitingRoom = async (
  roomCode: string,
  displayName: string,
  email?: string
): Promise<{ waitingId: string; status: string; message: string }> => {
  const response = await api.post(`/meet/waiting-room/${roomCode}/join`, {
    display_name: displayName,
    email,
  });
  return {
    waitingId: response.data.waiting_id,
    status: response.data.status,
    message: response.data.message,
  };
};

export const getWaitingParticipants = async (
  roomCode: string
): Promise<WaitingParticipant[]> => {
  const response = await api.get(`/meet/waiting-room/${roomCode}/participants`);
  return (response.data.participants || []).map(mapWaitingParticipant);
};

export const admitParticipant = async (
  roomCode: string,
  waitingId: string
): Promise<{ displayName: string }> => {
  const response = await api.post(
    `/meet/waiting-room/${roomCode}/admit/${waitingId}`
  );
  return { displayName: response.data.display_name };
};

export const rejectParticipant = async (
  roomCode: string,
  waitingId: string
): Promise<void> => {
  await api.post(`/meet/waiting-room/${roomCode}/reject/${waitingId}`);
};

export const admitAllParticipants = async (
  roomCode: string
): Promise<{ admittedCount: number }> => {
  const response = await api.post(`/meet/waiting-room/${roomCode}/admit-all`);
  return { admittedCount: response.data.admitted_count };
};

export const checkAdmissionStatus = async (
  roomCode: string,
  waitingId: string
): Promise<{ status: string }> => {
  const response = await api.get(
    `/meet/waiting-room/${roomCode}/status/${waitingId}`
  );
  return { status: response.data.status };
};

export const updateWaitingRoomSettings = async (
  roomCode: string,
  enabled: boolean
): Promise<void> => {
  await api.put(`/meet/waiting-room/${roomCode}/settings`, null, {
    params: { enabled },
  });
};

export const leaveWaitingRoom = async (
  roomCode: string,
  waitingId: string
): Promise<void> => {
  await api.delete(`/meet/waiting-room/${roomCode}/leave/${waitingId}`);
};

function mapWaitingParticipant(data: any): WaitingParticipant {
  return {
    id: data.id,
    roomCode: data.room_code,
    userId: data.user_id,
    displayName: data.display_name,
    email: data.email,
    status: data.status,
    requestedAt: data.requested_at,
    waitTimeSeconds: data.wait_time_seconds || 0,
  };
}
