// Meet Types for Bheem Meet

export type MeetingStatus = 'scheduled' | 'active' | 'ended' | 'cancelled';

export interface Meeting {
  id: string;
  title: string;
  description?: string;
  roomName: string;
  roomCode: string;
  status: MeetingStatus;
  hostId: string;
  hostName: string;
  scheduledStart?: string;
  scheduledEnd?: string;
  actualStart?: string;
  actualEnd?: string;
  createdAt: string;
  updatedAt?: string;
  participantsCount: number;
  maxParticipants: number;
  isRecording: boolean;
  hasRecording: boolean;
  recordingUrl?: string;
  joinUrl: string;
  settings: MeetingSettings;
}

export interface MeetingSettings {
  allowGuests: boolean;
  waitingRoom: boolean;
  muteOnEntry: boolean;
  videoOffOnEntry: boolean;
  allowScreenShare: boolean;
  allowChat: boolean;
  allowRecording: boolean;
}

export interface Participant {
  id: string;
  name: string;
  email?: string;
  isHost: boolean;
  isModerator: boolean;
  joinedAt: string;
  isMuted: boolean;
  isVideoOff: boolean;
  isScreenSharing: boolean;
  isHandRaised: boolean;
  isSpeaking?: boolean;
  isLocal?: boolean;
  connectionQuality: 'excellent' | 'good' | 'poor' | 'unknown';
}

export interface CreateMeetingData {
  title: string;
  description?: string;
  scheduledStart?: string;
  durationMinutes?: number;
  maxParticipants?: number;
  participants?: string[];
  sendInvites?: boolean;
  settings?: Partial<MeetingSettings>;
}

export interface JoinMeetingData {
  roomCode: string;
  participantName: string;
  email?: string;
}

export interface JoinMeetingResponse {
  token: string;
  wsUrl: string;
  roomCode: string;
  roomName: string;
  isHost: boolean;
}

export interface MeetingToken {
  token: string;
  wsUrl: string;
  roomCode: string;
  roomName: string;
}

export interface MeetConfig {
  wsUrl: string;
  workspaceUrl?: string;
  livekitUrl?: string;
  maxParticipants: number;
  recordingEnabled: boolean;
  features?: {
    screenShare: boolean;
    chat: boolean;
    recording: boolean;
    whiteboard: boolean;
  };
}

export interface ChatMessage {
  id: string;
  senderId: string;
  senderName: string;
  content: string;
  timestamp: string;
  type: 'text' | 'system';
  isLocal?: boolean;
  read?: boolean;
}

export interface MeetState {
  // Data
  meetings: Meeting[];
  currentMeeting: Meeting | null;
  config: MeetConfig | null;

  // Room state
  roomToken: string | null;
  serverUrl: string | null;
  localParticipant: Participant | null;
  remoteParticipants: Participant[];
  chatMessages: ChatMessage[];

  // UI State
  isCreateModalOpen: boolean;
  activeTab: 'active' | 'scheduled' | 'past';
  isChatOpen: boolean;
  isParticipantsOpen: boolean;
  isSettingsOpen: boolean;

  // Media state
  isMicEnabled: boolean;
  isCameraEnabled: boolean;
  isScreenSharing: boolean;
  isRecording: boolean;
  selectedAudioDevice: string | null;
  selectedVideoDevice: string | null;

  // Pre-join state
  previewStream: MediaStream | null;

  // Loading
  loading: {
    meetings: boolean;
    joining: boolean;
    creating: boolean;
    action: boolean;
  };

  // Error
  error: string | null;
}

// Device types for media selection
export interface MediaDevice {
  deviceId: string;
  label: string;
  kind: 'audioinput' | 'videoinput' | 'audiooutput';
}

// Recording types
export interface Recording {
  id: string;
  meetingId: string;
  meetingTitle: string;
  roomCode: string;
  duration: number;
  size: number;
  createdAt: string;
  url: string;
  shareUrl?: string;
  status: 'recording' | 'processing' | 'uploading' | 'transcribing' | 'completed' | 'failed';
  hasTranscript: boolean;
  storagePath?: string;
  storageType?: 'nextcloud' | 'local';
}

// Transcript types
export interface Transcript {
  id: string;
  recordingId: string;
  text: string;
  segments: TranscriptSegment[];
  language: string;
  wordCount: number;
  summary?: string;
  actionItems?: ActionItem[];
  keyTopics?: string[];
  createdAt: string;
}

export interface TranscriptSegment {
  start: number;
  end: number;
  text: string;
  speaker?: string;
  confidence?: number;
}

export interface ActionItem {
  task: string;
  assignee?: string;
  due?: string;
}

// Waiting Room types
export interface WaitingParticipant {
  id: string;
  roomCode: string;
  userId?: string;
  displayName: string;
  email?: string;
  status: 'waiting' | 'admitted' | 'rejected';
  requestedAt: string;
  waitTimeSeconds: number;
}

// Enhanced Chat Message with reactions
export interface EnhancedChatMessage {
  id: string;
  roomCode: string;
  senderId: string;
  senderName: string;
  senderAvatar?: string;
  content: string;
  messageType: 'text' | 'file' | 'system';
  replyToId?: string;
  reactions: Record<string, string[]>; // emoji -> list of user IDs
  isEdited: boolean;
  isDeleted: boolean;
  createdAt: string;
  updatedAt?: string;
}

// Recording session state
export interface RecordingSession {
  isRecording: boolean;
  recordingId?: string;
  egressId?: string;
  startedAt?: string;
  duration: number;
}
