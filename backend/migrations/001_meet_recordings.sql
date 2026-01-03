-- Bheem Meet - Recording & Enhanced Features Migration
-- Run this migration to add all meeting-related tables to workspace schema

-- ============================================
-- 1. MEETING ROOMS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS workspace.meet_rooms (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    room_code VARCHAR(20) NOT NULL UNIQUE,
    room_name VARCHAR(255) NOT NULL,
    description TEXT,

    -- Host info
    host_id UUID NOT NULL,
    host_name VARCHAR(255),

    -- Status
    status VARCHAR(20) DEFAULT 'active',

    -- Settings
    waiting_room_enabled BOOLEAN DEFAULT TRUE,
    mute_on_entry BOOLEAN DEFAULT FALSE,
    video_off_on_entry BOOLEAN DEFAULT FALSE,
    allow_screen_share BOOLEAN DEFAULT TRUE,
    allow_chat BOOLEAN DEFAULT TRUE,
    allow_recording BOOLEAN DEFAULT TRUE,
    max_participants INTEGER DEFAULT 100,

    -- Scheduling
    scheduled_start TIMESTAMP WITH TIME ZONE,
    scheduled_end TIMESTAMP WITH TIME ZONE,
    actual_start TIMESTAMP WITH TIME ZONE,
    actual_end TIMESTAMP WITH TIME ZONE,

    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

    CONSTRAINT valid_room_status CHECK (status IN ('scheduled', 'active', 'ended', 'cancelled'))
);

CREATE INDEX IF NOT EXISTS idx_meet_rooms_code ON workspace.meet_rooms(room_code);
CREATE INDEX IF NOT EXISTS idx_meet_rooms_host ON workspace.meet_rooms(host_id);
CREATE INDEX IF NOT EXISTS idx_meet_rooms_status ON workspace.meet_rooms(status);

-- ============================================
-- 2. MEETING RECORDINGS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS workspace.meet_recordings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    room_id UUID REFERENCES workspace.meet_rooms(id) ON DELETE SET NULL,
    room_code VARCHAR(20) NOT NULL,
    room_name VARCHAR(255),

    -- Recording by
    user_id UUID NOT NULL,
    user_name VARCHAR(255),

    -- LiveKit Egress
    egress_id VARCHAR(100),

    -- Status
    status VARCHAR(20) DEFAULT 'recording',

    -- Duration and size
    started_at TIMESTAMP WITH TIME ZONE,
    ended_at TIMESTAMP WITH TIME ZONE,
    duration_seconds INTEGER,
    file_size_bytes BIGINT,

    -- Storage
    storage_type VARCHAR(20) DEFAULT 'nextcloud',
    storage_path TEXT,
    local_path TEXT,

    -- Access URLs
    download_url TEXT,
    share_url TEXT,
    share_expires_at TIMESTAMP WITH TIME ZONE,

    -- Recording settings used
    layout VARCHAR(20) DEFAULT 'grid',
    resolution VARCHAR(10) DEFAULT '1080p',
    audio_only BOOLEAN DEFAULT FALSE,

    -- Watermark
    watermark_applied BOOLEAN DEFAULT FALSE,
    watermark_text VARCHAR(255),

    -- Transcription status
    has_transcript BOOLEAN DEFAULT FALSE,

    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

    CONSTRAINT valid_recording_status CHECK (status IN ('recording', 'processing', 'uploading', 'transcribing', 'completed', 'failed'))
);

CREATE INDEX IF NOT EXISTS idx_meet_recordings_room ON workspace.meet_recordings(room_code);
CREATE INDEX IF NOT EXISTS idx_meet_recordings_user ON workspace.meet_recordings(user_id);
CREATE INDEX IF NOT EXISTS idx_meet_recordings_status ON workspace.meet_recordings(status);
CREATE INDEX IF NOT EXISTS idx_meet_recordings_created ON workspace.meet_recordings(created_at);

-- ============================================
-- 3. MEETING TRANSCRIPTS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS workspace.meet_transcripts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    recording_id UUID NOT NULL REFERENCES workspace.meet_recordings(id) ON DELETE CASCADE,

    -- Full text
    text TEXT NOT NULL,
    word_count INTEGER,

    -- Segments with timestamps
    segments JSONB DEFAULT '[]',

    -- Language
    language VARCHAR(10) DEFAULT 'en',

    -- AI-generated content
    summary TEXT,
    action_items JSONB DEFAULT '[]',
    key_topics JSONB DEFAULT '[]',

    -- Processing info
    model_used VARCHAR(50),
    confidence NUMERIC(5,4),
    processing_time_seconds INTEGER,

    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_meet_transcripts_recording ON workspace.meet_transcripts(recording_id);

-- ============================================
-- 4. MEETING CHAT MESSAGES TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS workspace.meet_chat_messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    room_id UUID REFERENCES workspace.meet_rooms(id) ON DELETE SET NULL,
    room_code VARCHAR(20) NOT NULL,

    -- Sender
    sender_id UUID NOT NULL,
    sender_name VARCHAR(255) NOT NULL,
    sender_avatar TEXT,

    -- Message content
    content TEXT NOT NULL,
    message_type VARCHAR(20) DEFAULT 'text',
    reply_to_id UUID,

    -- Reactions
    reactions JSONB DEFAULT '{}',

    -- Status
    is_edited BOOLEAN DEFAULT FALSE,
    is_deleted BOOLEAN DEFAULT FALSE,

    -- Extra data (for file attachments, etc.)
    extra_data JSONB,

    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE,

    CONSTRAINT valid_message_type CHECK (message_type IN ('text', 'file', 'system'))
);

CREATE INDEX IF NOT EXISTS idx_meet_chat_room ON workspace.meet_chat_messages(room_code);
CREATE INDEX IF NOT EXISTS idx_meet_chat_sender ON workspace.meet_chat_messages(sender_id);
CREATE INDEX IF NOT EXISTS idx_meet_chat_created ON workspace.meet_chat_messages(created_at);

-- ============================================
-- 5. MEETING PARTICIPANTS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS workspace.meet_participants (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    room_id UUID REFERENCES workspace.meet_rooms(id) ON DELETE SET NULL,
    room_code VARCHAR(20) NOT NULL,

    -- Participant info
    user_id UUID,
    display_name VARCHAR(255) NOT NULL,
    email VARCHAR(320),

    -- Role
    role VARCHAR(20) DEFAULT 'participant',

    -- Participation times
    joined_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    left_at TIMESTAMP WITH TIME ZONE,
    duration_seconds INTEGER,

    -- Connection info
    ip_address VARCHAR(45),
    user_agent VARCHAR(500),
    connection_quality VARCHAR(20),

    -- Participation stats
    audio_enabled_duration INTEGER DEFAULT 0,
    video_enabled_duration INTEGER DEFAULT 0,
    screen_share_duration INTEGER DEFAULT 0,
    chat_messages_count INTEGER DEFAULT 0,

    CONSTRAINT valid_participant_role CHECK (role IN ('host', 'moderator', 'participant', 'guest')),
    CONSTRAINT valid_connection_quality CHECK (connection_quality IS NULL OR connection_quality IN ('excellent', 'good', 'poor'))
);

CREATE INDEX IF NOT EXISTS idx_meet_participants_room ON workspace.meet_participants(room_code);
CREATE INDEX IF NOT EXISTS idx_meet_participants_user ON workspace.meet_participants(user_id);

-- ============================================
-- 6. WAITING ROOM TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS workspace.meet_waiting_room (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    room_id UUID REFERENCES workspace.meet_rooms(id) ON DELETE SET NULL,
    room_code VARCHAR(20) NOT NULL,

    -- Participant info
    user_id UUID,
    display_name VARCHAR(255) NOT NULL,
    email VARCHAR(320),

    -- Status
    status VARCHAR(20) DEFAULT 'waiting',

    -- Device info
    device_info TEXT,

    -- Timestamps
    requested_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    admitted_at TIMESTAMP WITH TIME ZONE,
    rejected_at TIMESTAMP WITH TIME ZONE,

    -- Admission info
    admitted_by UUID,
    rejected_by UUID,

    CONSTRAINT valid_waiting_status CHECK (status IN ('waiting', 'admitted', 'rejected'))
);

CREATE INDEX IF NOT EXISTS idx_meet_waiting_room ON workspace.meet_waiting_room(room_code);
CREATE INDEX IF NOT EXISTS idx_meet_waiting_status ON workspace.meet_waiting_room(status);

-- ============================================
-- 7. MEETING SETTINGS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS workspace.meet_settings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID,
    tenant_id UUID,

    -- Default meeting settings
    default_waiting_room BOOLEAN DEFAULT TRUE,
    default_mute_on_entry BOOLEAN DEFAULT FALSE,
    default_video_off_on_entry BOOLEAN DEFAULT FALSE,
    default_allow_screen_share BOOLEAN DEFAULT TRUE,
    default_allow_chat BOOLEAN DEFAULT TRUE,
    default_allow_recording BOOLEAN DEFAULT TRUE,

    -- Recording settings
    auto_record BOOLEAN DEFAULT FALSE,
    default_recording_layout VARCHAR(20) DEFAULT 'grid',
    default_recording_resolution VARCHAR(10) DEFAULT '1080p',
    watermark_enabled BOOLEAN DEFAULT TRUE,

    -- Transcription settings
    auto_transcribe BOOLEAN DEFAULT FALSE,
    transcription_language VARCHAR(10) DEFAULT 'en',
    generate_summary BOOLEAN DEFAULT TRUE,

    -- Notification settings
    notify_on_join BOOLEAN DEFAULT TRUE,
    notify_on_recording BOOLEAN DEFAULT TRUE,

    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_meet_settings_user ON workspace.meet_settings(user_id);
CREATE INDEX IF NOT EXISTS idx_meet_settings_tenant ON workspace.meet_settings(tenant_id);

-- ============================================
-- 8. RECORDING ACCESS LOGS TABLE (Optional)
-- ============================================
CREATE TABLE IF NOT EXISTS workspace.meet_recording_access_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    recording_id UUID NOT NULL REFERENCES workspace.meet_recordings(id) ON DELETE CASCADE,

    user_id UUID,
    user_email VARCHAR(320),
    action VARCHAR(50) NOT NULL,
    ip_address VARCHAR(45),
    user_agent TEXT,

    accessed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_meet_access_logs_recording ON workspace.meet_recording_access_logs(recording_id);
CREATE INDEX IF NOT EXISTS idx_meet_access_logs_user ON workspace.meet_recording_access_logs(user_id);

-- ============================================
-- GRANT PERMISSIONS
-- ============================================
GRANT ALL ON ALL TABLES IN SCHEMA workspace TO erp_developer;
GRANT ALL ON ALL SEQUENCES IN SCHEMA workspace TO erp_developer;
