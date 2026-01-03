# Bheem Meet - Complete Production Implementation Plan

## Overview

This document outlines the complete implementation for a production-ready video conferencing solution matching Google Meet, Zoom, and Teams standards.

---

## Feature Comparison: Current vs Target

| Feature | Current | Target | Priority |
|---------|---------|--------|----------|
| Video Calls | ✅ Basic | ✅ Enhanced | - |
| Recording | ❌ Stub | ✅ Full | P0 |
| Transcription | ❌ None | ✅ AI-powered | P1 |
| Watermarks | ❌ None | ✅ Dynamic | P1 |
| Screen Share | ⚠️ UI only | ✅ Full | P0 |
| Chat | ⚠️ UI only | ✅ Persistent | P1 |
| Waiting Room | ⚠️ UI only | ✅ Full | P1 |
| Virtual Backgrounds | ❌ None | ✅ AI blur + images | P2 |
| Noise Cancellation | ❌ None | ✅ AI-powered | P2 |
| Live Captions | ❌ None | ✅ Real-time | P2 |
| Breakout Rooms | ❌ None | ✅ Full | P3 |
| Polls/Q&A | ❌ None | ✅ Interactive | P3 |

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                              BHEEM MEET ARCHITECTURE                            │
└─────────────────────────────────────────────────────────────────────────────────┘

                                    ┌─────────────┐
                                    │   Client    │
                                    │  (Next.js)  │
                                    └──────┬──────┘
                                           │
                    ┌──────────────────────┼──────────────────────┐
                    │                      │                      │
                    ▼                      ▼                      ▼
            ┌──────────────┐      ┌──────────────┐      ┌──────────────┐
            │   Meet API   │      │  LiveKit     │      │  WebSocket   │
            │  (FastAPI)   │      │  (WebRTC)    │      │   (Chat)     │
            └──────┬───────┘      └──────┬───────┘      └──────┬───────┘
                   │                     │                     │
        ┌──────────┼──────────┬──────────┼──────────┬─────────┘
        │          │          │          │          │
        ▼          ▼          ▼          ▼          ▼
┌───────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐
│ PostgreSQL│ │Nextcloud│ │ Whisper │ │ LiveKit │ │  Redis  │
│    (DB)   │ │(Storage)│ │ (AI)    │ │ Egress  │ │ (Cache) │
└───────────┘ └─────────┘ └─────────┘ └─────────┘ └─────────┘
```

---

## Database Schema

### Table: `pm_meeting_recordings`

```sql
CREATE TABLE project_management.pm_meeting_recordings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    meeting_id UUID NOT NULL,
    room_code VARCHAR(50) NOT NULL,

    -- Recording details
    egress_id VARCHAR(100),
    status VARCHAR(20) NOT NULL DEFAULT 'pending',
    -- Status: pending, recording, processing, transcribing, completed, failed

    -- File info
    storage_type VARCHAR(20) DEFAULT 'nextcloud',
    storage_path VARCHAR(500),
    file_size_bytes BIGINT,
    duration_seconds INTEGER,
    resolution VARCHAR(20),  -- 720p, 1080p, etc.

    -- Transcription
    transcript_path VARCHAR(500),
    transcript_status VARCHAR(20),  -- pending, processing, completed, failed
    transcript_language VARCHAR(10) DEFAULT 'en',

    -- Watermark
    watermark_enabled BOOLEAN DEFAULT TRUE,
    watermark_text VARCHAR(200),
    watermark_position VARCHAR(20) DEFAULT 'bottom-right',

    -- Security
    is_encrypted BOOLEAN DEFAULT TRUE,
    encryption_key_id VARCHAR(100),
    drm_enabled BOOLEAN DEFAULT FALSE,

    -- Access control
    is_public BOOLEAN DEFAULT FALSE,
    password_hash VARCHAR(255),
    allowed_viewers UUID[],
    max_views INTEGER,
    view_count INTEGER DEFAULT 0,

    -- Metadata
    recorded_by UUID NOT NULL,
    company_id UUID,
    participant_count INTEGER,

    -- Timestamps
    started_at TIMESTAMP WITH TIME ZONE,
    ended_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    expires_at TIMESTAMP WITH TIME ZONE,

    CONSTRAINT valid_status CHECK (status IN ('pending', 'recording', 'processing', 'transcribing', 'completed', 'failed'))
);

CREATE INDEX idx_recordings_meeting ON pm_meeting_recordings(meeting_id);
CREATE INDEX idx_recordings_room_code ON pm_meeting_recordings(room_code);
CREATE INDEX idx_recordings_status ON pm_meeting_recordings(status);
CREATE INDEX idx_recordings_recorded_by ON pm_meeting_recordings(recorded_by);
CREATE INDEX idx_recordings_company ON pm_meeting_recordings(company_id);
```

### Table: `pm_meeting_transcripts`

```sql
CREATE TABLE project_management.pm_meeting_transcripts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    recording_id UUID NOT NULL REFERENCES pm_meeting_recordings(id) ON DELETE CASCADE,

    -- Transcript content
    full_text TEXT,
    segments JSONB,  -- [{start: 0, end: 5, speaker: "John", text: "Hello"}]

    -- AI Analysis
    summary TEXT,
    action_items JSONB,  -- [{task: "...", assignee: "...", due: "..."}]
    key_topics JSONB,    -- ["topic1", "topic2"]
    sentiment VARCHAR(20),

    -- Metadata
    language VARCHAR(10) DEFAULT 'en',
    word_count INTEGER,
    confidence_score FLOAT,

    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_transcripts_recording ON pm_meeting_transcripts(recording_id);
CREATE INDEX idx_transcripts_fulltext ON pm_meeting_transcripts USING gin(to_tsvector('english', full_text));
```

### Table: `pm_meeting_chat_messages`

```sql
CREATE TABLE project_management.pm_meeting_chat_messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    room_code VARCHAR(50) NOT NULL,
    meeting_id UUID,

    -- Message
    sender_id UUID NOT NULL,
    sender_name VARCHAR(100) NOT NULL,
    content TEXT NOT NULL,
    message_type VARCHAR(20) DEFAULT 'text',  -- text, file, reaction

    -- Metadata
    reply_to_id UUID REFERENCES pm_meeting_chat_messages(id),
    reactions JSONB DEFAULT '{}',

    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    edited_at TIMESTAMP WITH TIME ZONE,
    deleted_at TIMESTAMP WITH TIME ZONE
);

CREATE INDEX idx_chat_room ON pm_meeting_chat_messages(room_code);
CREATE INDEX idx_chat_meeting ON pm_meeting_chat_messages(meeting_id);
CREATE INDEX idx_chat_sender ON pm_meeting_chat_messages(sender_id);
```

### Table: `pm_meeting_participants`

```sql
CREATE TABLE project_management.pm_meeting_participants (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    meeting_id UUID NOT NULL,
    room_code VARCHAR(50) NOT NULL,

    -- Participant info
    user_id UUID,
    participant_name VARCHAR(100) NOT NULL,
    participant_identity VARCHAR(100) NOT NULL,
    is_host BOOLEAN DEFAULT FALSE,
    is_guest BOOLEAN DEFAULT FALSE,

    -- Session
    joined_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    left_at TIMESTAMP WITH TIME ZONE,
    duration_seconds INTEGER,

    -- Activity
    spoke_duration_seconds INTEGER DEFAULT 0,
    messages_sent INTEGER DEFAULT 0,
    screen_shared BOOLEAN DEFAULT FALSE,
    hand_raised_count INTEGER DEFAULT 0,

    -- Technical
    connection_quality VARCHAR(20),
    device_type VARCHAR(50),
    browser VARCHAR(50)
);

CREATE INDEX idx_participants_meeting ON pm_meeting_participants(meeting_id);
CREATE INDEX idx_participants_room ON pm_meeting_participants(room_code);
CREATE INDEX idx_participants_user ON pm_meeting_participants(user_id);
```

### Table: `pm_waiting_room`

```sql
CREATE TABLE project_management.pm_waiting_room (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    room_code VARCHAR(50) NOT NULL,

    -- Participant
    participant_identity VARCHAR(100) NOT NULL,
    participant_name VARCHAR(100) NOT NULL,
    user_id UUID,
    is_guest BOOLEAN DEFAULT TRUE,

    -- Status
    status VARCHAR(20) DEFAULT 'waiting',  -- waiting, admitted, rejected
    admitted_by UUID,

    -- Timestamps
    requested_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    responded_at TIMESTAMP WITH TIME ZONE,

    CONSTRAINT valid_status CHECK (status IN ('waiting', 'admitted', 'rejected'))
);

CREATE INDEX idx_waiting_room ON pm_waiting_room(room_code);
CREATE INDEX idx_waiting_status ON pm_waiting_room(status);
```

---

## Backend Services

### 1. LiveKit Egress Service

**File: `backend/services/livekit_egress_service.py`**

Handles:
- Start room recording (composite/track)
- Stop recording
- Get recording status
- Configure output format (MP4, WebM)
- Apply watermarks via FFmpeg post-processing

### 2. Transcription Service

**File: `backend/services/transcription_service.py`**

Handles:
- Audio extraction from recording
- Whisper API integration (local or OpenAI)
- Speaker diarization
- Timestamp generation
- AI summary generation

### 3. Watermark Service

**File: `backend/services/watermark_service.py`**

Handles:
- Dynamic text watermarks (user email, timestamp)
- Image watermarks (company logo)
- Position configuration
- Opacity settings
- FFmpeg processing

### 4. Chat Service

**File: `backend/services/chat_service.py`**

Handles:
- Real-time message delivery (LiveKit data channels)
- Message persistence to database
- Message reactions
- File attachments
- Chat export

### 5. Waiting Room Service

**File: `backend/services/waiting_room_service.py`**

Handles:
- Queue management
- Host notifications
- Admit/reject participants
- Auto-admit settings

---

## API Endpoints

### Recording API (`/api/v1/recordings`)

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/start` | Start recording |
| POST | `/{id}/stop` | Stop recording |
| GET | `/` | List recordings |
| GET | `/{id}` | Get recording details |
| GET | `/{id}/download` | Download recording |
| GET | `/{id}/stream` | Stream recording |
| DELETE | `/{id}` | Delete recording |
| POST | `/{id}/share` | Create share link |
| GET | `/{id}/transcript` | Get transcript |
| POST | `/{id}/transcribe` | Trigger transcription |

### Chat API (`/api/v1/meet/chat`)

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/{room_code}/messages` | Get chat history |
| POST | `/{room_code}/messages` | Send message |
| PUT | `/{room_code}/messages/{id}` | Edit message |
| DELETE | `/{room_code}/messages/{id}` | Delete message |
| POST | `/{room_code}/messages/{id}/react` | Add reaction |
| GET | `/{room_code}/export` | Export chat |

### Waiting Room API (`/api/v1/meet/waiting-room`)

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/{room_code}` | Get waiting list (host) |
| POST | `/{room_code}/join` | Request to join |
| POST | `/{room_code}/admit/{id}` | Admit participant |
| POST | `/{room_code}/reject/{id}` | Reject participant |
| POST | `/{room_code}/admit-all` | Admit all waiting |

### Participants API (`/api/v1/meet/participants`)

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/{room_code}` | List participants |
| POST | `/{room_code}/{id}/mute` | Mute participant |
| POST | `/{room_code}/{id}/remove` | Remove participant |
| POST | `/{room_code}/mute-all` | Mute all |
| GET | `/{room_code}/analytics` | Get participation stats |

---

## Frontend Components

### New Components to Create

```
frontend/src/components/meet/
├── recording/
│   ├── RecordingIndicator.tsx      # Red dot + timer
│   ├── RecordingControls.tsx       # Start/stop/pause
│   ├── RecordingsList.tsx          # List view
│   ├── RecordingCard.tsx           # Single recording
│   ├── RecordingPlayer.tsx         # Video player
│   └── TranscriptViewer.tsx        # Transcript display
├── chat/
│   ├── ChatPanel.tsx               # Enhanced chat
│   ├── ChatMessage.tsx             # Single message
│   ├── ChatInput.tsx               # Input with formatting
│   ├── ChatReactions.tsx           # Emoji reactions
│   └── ChatExport.tsx              # Export dialog
├── waiting-room/
│   ├── WaitingRoomScreen.tsx       # Guest waiting UI
│   ├── WaitingRoomQueue.tsx        # Host queue view
│   └── WaitingRoomCard.tsx         # Single waiting user
├── participants/
│   ├── ParticipantsPanel.tsx       # Enhanced panel
│   ├── ParticipantCard.tsx         # Single participant
│   ├── ParticipantActions.tsx      # Mute/remove menu
│   └── SpeakerStats.tsx            # Speaking time
├── controls/
│   ├── MeetingControls.tsx         # Enhanced controls
│   ├── MoreMenu.tsx                # Settings dropdown
│   ├── DeviceSettings.tsx          # Audio/video config
│   └── LayoutPicker.tsx            # Grid/speaker/sidebar
├── video/
│   ├── VideoGrid.tsx               # Enhanced grid
│   ├── VideoTile.tsx               # Single video
│   ├── ScreenShareView.tsx         # Screen share display
│   └── SpeakerView.tsx             # Active speaker
└── shared/
    ├── MeetingTimer.tsx            # Duration display
    ├── ConnectionQuality.tsx       # Quality indicator
    ├── HandRaiseQueue.tsx          # Raised hands list
    └── MeetingInfo.tsx             # Room details
```

### New Pages

```
frontend/src/pages/meet/
├── index.tsx                       # Meeting list (enhanced)
├── room/[roomName].tsx             # Video room (enhanced)
├── recordings/
│   ├── index.tsx                   # All recordings
│   └── [id].tsx                    # Recording player
├── join/[code].tsx                 # Quick join
└── settings.tsx                    # Meet preferences
```

---

## Implementation Phases

### Phase 1: Core Recording (Days 1-2)
1. Database migrations
2. LiveKit Egress service
3. Recording storage service
4. Basic recording API
5. Recording UI controls

### Phase 2: Enhanced Recording (Days 3-4)
1. Watermark service
2. Transcription service (Whisper)
3. Recording player component
4. Transcript viewer
5. Download/share functionality

### Phase 3: Chat System (Day 5)
1. Chat database tables
2. Chat API endpoints
3. Enhanced ChatPanel component
4. Message persistence
5. Chat export

### Phase 4: Waiting Room (Day 6)
1. Waiting room database
2. Waiting room API
3. WaitingRoomScreen component
4. Host queue management
5. Auto-admit settings

### Phase 5: Participant Management (Day 7)
1. Participants tracking
2. Mute/remove functionality
3. Enhanced ParticipantsPanel
4. Speaking time tracking
5. Analytics API

### Phase 6: UI Polish (Days 8-9)
1. Enhanced video grid
2. Layout options (grid/speaker/sidebar)
3. Device settings modal
4. Connection quality indicators
5. Responsive design

### Phase 7: Testing & Optimization (Day 10)
1. End-to-end testing
2. Performance optimization
3. Error handling
4. Documentation
5. Deployment

---

## Best Practices Implemented

### Security
- End-to-end encryption option
- Watermarks with user identification
- Password-protected recordings
- Access control lists
- Audit logging

### Performance
- Lazy loading for recordings list
- Video streaming (not full download)
- Optimized transcoding
- CDN for static assets
- WebSocket for real-time updates

### User Experience
- Intuitive controls
- Keyboard shortcuts
- Accessibility (ARIA labels)
- Mobile responsive
- Error recovery

### Scalability
- Background job processing
- Horizontal scaling ready
- Database indexing
- Caching layer
- Rate limiting

---

## Configuration

### Environment Variables

```env
# LiveKit Egress
LIVEKIT_EGRESS_ENABLED=true

# Transcription
WHISPER_API_URL=http://localhost:9000
WHISPER_MODEL=large-v3
OPENAI_API_KEY=sk-xxx  # Optional: Use OpenAI Whisper

# Watermark
WATERMARK_ENABLED=true
WATERMARK_LOGO_PATH=/assets/logo.png
WATERMARK_OPACITY=0.3

# Recording
RECORDING_MAX_DURATION=14400  # 4 hours
RECORDING_DEFAULT_QUALITY=1080p
RECORDING_RETENTION_DAYS=90

# Chat
CHAT_MAX_MESSAGE_LENGTH=4000
CHAT_RATE_LIMIT=60  # messages per minute

# Waiting Room
WAITING_ROOM_ENABLED=true
WAITING_ROOM_AUTO_ADMIT=false
```

---

## Dependencies

### Backend
```
livekit-api>=0.6.0
openai-whisper>=20231117
ffmpeg-python>=0.2.0
aiofiles>=23.2.1
python-jose>=3.3.0
```

### Frontend
```
@livekit/components-react>=2.0.0
@livekit/components-styles>=1.0.0
react-player>=2.14.0
wavesurfer.js>=7.0.0  # Audio waveform
```

---

## Success Metrics

| Metric | Target |
|--------|--------|
| Recording start time | < 3 seconds |
| Recording quality | 1080p @ 30fps |
| Transcription accuracy | > 95% |
| Chat latency | < 100ms |
| Waiting room response | < 1 second |
| Video grid performance | 60fps with 9 participants |

---

## Next Steps

1. **Run database migrations**
2. **Implement backend services**
3. **Create API endpoints**
4. **Build frontend components**
5. **Integrate and test**
6. **Deploy to staging**
7. **User acceptance testing**
8. **Production deployment**
