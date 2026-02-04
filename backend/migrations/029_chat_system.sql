-- =============================================
-- Bheem Chat System Migration
-- Creates tables for direct messages, group chats, audio calls, and file attachments
-- Supports internal, external, and cross-tenant communication
-- =============================================

-- Create schema if not exists
CREATE SCHEMA IF NOT EXISTS workspace;

-- =============================================
-- 1. EXTERNAL CONTACTS TABLE
-- Users outside the workspace (clients, partners)
-- Each workspace manages their own contact list
-- =============================================
CREATE TABLE IF NOT EXISTS workspace.chat_external_contacts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- Owner tenant (who added this contact)
    owner_tenant_id UUID NOT NULL REFERENCES workspace.tenants(id) ON DELETE CASCADE,
    created_by UUID NOT NULL,

    -- Contact info
    email VARCHAR(320) NOT NULL,
    name VARCHAR(255) NOT NULL,
    avatar_url TEXT,
    phone VARCHAR(50),
    company_name VARCHAR(255),
    job_title VARCHAR(255),

    -- Link to workspace user (if they have an account)
    linked_user_id UUID,
    linked_tenant_id UUID,
    linked_at TIMESTAMP,

    -- Invitation
    invitation_sent_at TIMESTAMP,
    invitation_accepted_at TIMESTAMP,
    invitation_token VARCHAR(100),

    -- Status
    is_active BOOLEAN DEFAULT TRUE,
    is_blocked BOOLEAN DEFAULT FALSE,
    blocked_reason TEXT,

    -- Notes and tags
    notes TEXT,
    tags JSONB DEFAULT '[]',

    -- Timestamps
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    last_contacted_at TIMESTAMP,

    -- Unique constraint: one contact per email per tenant
    CONSTRAINT uq_external_contact_tenant_email UNIQUE (owner_tenant_id, email)
);

-- Indexes for external contacts
CREATE INDEX IF NOT EXISTS idx_external_contacts_email ON workspace.chat_external_contacts(email);
CREATE INDEX IF NOT EXISTS idx_external_contacts_tenant ON workspace.chat_external_contacts(owner_tenant_id);
CREATE INDEX IF NOT EXISTS idx_external_contacts_linked ON workspace.chat_external_contacts(linked_user_id);
CREATE INDEX IF NOT EXISTS idx_external_contacts_active ON workspace.chat_external_contacts(owner_tenant_id, is_active) WHERE is_active = TRUE;

-- =============================================
-- 2. CONVERSATIONS TABLE
-- Both direct (1:1) and group chats
-- =============================================
CREATE TABLE IF NOT EXISTS workspace.chat_conversations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- Owning tenant
    tenant_id UUID REFERENCES workspace.tenants(id) ON DELETE SET NULL,

    -- Type: direct or group
    type VARCHAR(20) NOT NULL CHECK (type IN ('direct', 'group')),

    -- Scope: internal, external, cross_tenant
    scope VARCHAR(20) NOT NULL DEFAULT 'internal' CHECK (scope IN ('internal', 'external', 'cross_tenant')),

    -- Group info (null for direct chats)
    name VARCHAR(255),
    description TEXT,
    avatar_url TEXT,

    -- Creator
    created_by UUID NOT NULL,
    created_by_tenant_id UUID,

    -- Last message preview (denormalized for performance)
    last_message_at TIMESTAMP,
    last_message_preview VARCHAR(200),
    last_message_sender_id UUID,
    last_message_sender_name VARCHAR(255),

    -- Settings
    is_archived BOOLEAN DEFAULT FALSE,
    allow_external_files BOOLEAN DEFAULT TRUE,
    external_link_preview BOOLEAN DEFAULT FALSE,

    -- Timestamps
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for conversations
CREATE INDEX IF NOT EXISTS idx_chat_conversations_type ON workspace.chat_conversations(type);
CREATE INDEX IF NOT EXISTS idx_chat_conversations_scope ON workspace.chat_conversations(scope);
CREATE INDEX IF NOT EXISTS idx_chat_conversations_tenant ON workspace.chat_conversations(tenant_id);
CREATE INDEX IF NOT EXISTS idx_chat_conversations_updated ON workspace.chat_conversations(updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_chat_conversations_last_message ON workspace.chat_conversations(last_message_at DESC NULLS LAST);

-- =============================================
-- 3. PARTICIPANTS TABLE
-- Conversation participants with read tracking
-- =============================================
CREATE TABLE IF NOT EXISTS workspace.chat_participants (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    conversation_id UUID NOT NULL REFERENCES workspace.chat_conversations(id) ON DELETE CASCADE,

    -- Participant type: internal, external_user, guest
    participant_type VARCHAR(20) NOT NULL DEFAULT 'internal' CHECK (participant_type IN ('internal', 'external_user', 'guest')),

    -- For internal and external_user types
    user_id UUID,
    tenant_id UUID,

    -- For external_user type (cross-tenant)
    external_tenant_id UUID,
    external_tenant_name VARCHAR(255),

    -- For guest type
    external_contact_id UUID REFERENCES workspace.chat_external_contacts(id) ON DELETE SET NULL,

    -- User info (denormalized)
    user_name VARCHAR(255) NOT NULL,
    user_email VARCHAR(320),
    user_avatar TEXT,
    company_name VARCHAR(255),

    -- Role: owner, admin, member
    role VARCHAR(20) DEFAULT 'member' CHECK (role IN ('owner', 'admin', 'member')),

    -- Read tracking
    last_read_at TIMESTAMP,
    last_read_message_id UUID,
    unread_count INTEGER DEFAULT 0,

    -- Settings
    is_muted BOOLEAN DEFAULT FALSE,
    notifications_enabled BOOLEAN DEFAULT TRUE,

    -- Timestamps
    joined_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    left_at TIMESTAMP,
    invited_by UUID
);

-- Indexes for participants
CREATE INDEX IF NOT EXISTS idx_chat_participants_user ON workspace.chat_participants(user_id);
CREATE INDEX IF NOT EXISTS idx_chat_participants_conversation ON workspace.chat_participants(conversation_id);
CREATE INDEX IF NOT EXISTS idx_chat_participants_tenant ON workspace.chat_participants(tenant_id);
CREATE INDEX IF NOT EXISTS idx_chat_participants_type ON workspace.chat_participants(participant_type);
CREATE INDEX IF NOT EXISTS idx_chat_participants_external ON workspace.chat_participants(external_contact_id);
CREATE INDEX IF NOT EXISTS idx_chat_participants_active ON workspace.chat_participants(conversation_id, left_at) WHERE left_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_chat_participants_user_active ON workspace.chat_participants(user_id, left_at) WHERE left_at IS NULL;

-- =============================================
-- 4. INVITATIONS TABLE
-- Email invitations for external users
-- =============================================
CREATE TABLE IF NOT EXISTS workspace.chat_invitations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    conversation_id UUID NOT NULL REFERENCES workspace.chat_conversations(id) ON DELETE CASCADE,

    -- Inviter
    inviter_id UUID NOT NULL,
    inviter_name VARCHAR(255) NOT NULL,
    inviter_tenant_id UUID NOT NULL,
    inviter_tenant_name VARCHAR(255),

    -- Invitee
    invitee_email VARCHAR(320) NOT NULL,
    invitee_name VARCHAR(255),

    -- Invitation details
    token VARCHAR(100) NOT NULL UNIQUE,
    message TEXT,

    -- Status: pending, accepted, declined, expired
    status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'declined', 'expired')),

    -- Timestamps
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    expires_at TIMESTAMP,
    responded_at TIMESTAMP
);

-- Indexes for invitations
CREATE INDEX IF NOT EXISTS idx_chat_invitations_email ON workspace.chat_invitations(invitee_email);
CREATE INDEX IF NOT EXISTS idx_chat_invitations_token ON workspace.chat_invitations(token);
CREATE INDEX IF NOT EXISTS idx_chat_invitations_conversation ON workspace.chat_invitations(conversation_id);
CREATE INDEX IF NOT EXISTS idx_chat_invitations_status ON workspace.chat_invitations(status);
CREATE INDEX IF NOT EXISTS idx_chat_invitations_pending ON workspace.chat_invitations(status, expires_at) WHERE status = 'pending';

-- =============================================
-- 5. CALL LOGS TABLE
-- Audio/video call history
-- =============================================
CREATE TABLE IF NOT EXISTS workspace.chat_call_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    conversation_id UUID NOT NULL REFERENCES workspace.chat_conversations(id) ON DELETE CASCADE,

    -- Call type: audio, video
    call_type VARCHAR(20) DEFAULT 'audio' CHECK (call_type IN ('audio', 'video')),

    -- LiveKit room name
    room_name VARCHAR(100) NOT NULL,

    -- Caller info
    caller_id UUID NOT NULL,
    caller_name VARCHAR(255) NOT NULL,
    caller_tenant_id UUID,

    -- Status: ringing, ongoing, ended, missed, declined, no_answer
    status VARCHAR(20) DEFAULT 'ringing' CHECK (status IN ('ringing', 'ongoing', 'ended', 'missed', 'declined', 'no_answer')),

    -- Participants who joined
    participants_joined JSONB DEFAULT '[]',

    -- Timing
    started_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    answered_at TIMESTAMP,
    ended_at TIMESTAMP,
    duration_seconds INTEGER DEFAULT 0,

    -- End reason
    end_reason VARCHAR(50),

    -- Timestamps
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for call logs
CREATE INDEX IF NOT EXISTS idx_chat_calls_conversation ON workspace.chat_call_logs(conversation_id);
CREATE INDEX IF NOT EXISTS idx_chat_calls_caller ON workspace.chat_call_logs(caller_id);
CREATE INDEX IF NOT EXISTS idx_chat_calls_status ON workspace.chat_call_logs(status);
CREATE INDEX IF NOT EXISTS idx_chat_calls_started ON workspace.chat_call_logs(started_at DESC);
CREATE INDEX IF NOT EXISTS idx_chat_calls_active ON workspace.chat_call_logs(conversation_id, status) WHERE status IN ('ringing', 'ongoing');

-- =============================================
-- 6. MESSAGES TABLE
-- Individual chat messages
-- =============================================
CREATE TABLE IF NOT EXISTS workspace.chat_messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    conversation_id UUID NOT NULL REFERENCES workspace.chat_conversations(id) ON DELETE CASCADE,

    -- Sender info
    sender_id UUID NOT NULL,
    sender_name VARCHAR(255) NOT NULL,
    sender_avatar TEXT,
    sender_tenant_id UUID,
    is_external_sender BOOLEAN DEFAULT FALSE,

    -- Content
    content TEXT,
    message_type VARCHAR(20) DEFAULT 'text' CHECK (message_type IN ('text', 'image', 'file', 'system', 'call')),

    -- Reply threading
    reply_to_id UUID REFERENCES workspace.chat_messages(id) ON DELETE SET NULL,

    -- Reactions: {emoji: [user_id1, user_id2]}
    reactions JSONB DEFAULT '{}',

    -- Status
    is_edited BOOLEAN DEFAULT FALSE,
    is_deleted BOOLEAN DEFAULT FALSE,

    -- Delivery tracking
    delivered_to JSONB DEFAULT '[]',
    read_by JSONB DEFAULT '[]',

    -- Call reference
    call_log_id UUID REFERENCES workspace.chat_call_logs(id) ON DELETE SET NULL,

    -- Timestamps
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP
);

-- Indexes for messages
CREATE INDEX IF NOT EXISTS idx_chat_messages_conversation ON workspace.chat_messages(conversation_id);
CREATE INDEX IF NOT EXISTS idx_chat_messages_sender ON workspace.chat_messages(sender_id);
CREATE INDEX IF NOT EXISTS idx_chat_messages_created ON workspace.chat_messages(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_chat_messages_conversation_created ON workspace.chat_messages(conversation_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_chat_messages_reply ON workspace.chat_messages(reply_to_id) WHERE reply_to_id IS NOT NULL;

-- =============================================
-- 7. ATTACHMENTS TABLE
-- File attachments for messages
-- =============================================
CREATE TABLE IF NOT EXISTS workspace.chat_attachments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    message_id UUID NOT NULL REFERENCES workspace.chat_messages(id) ON DELETE CASCADE,

    -- File info
    file_name VARCHAR(255) NOT NULL,
    file_type VARCHAR(100),
    file_size INTEGER,

    -- Storage URLs
    file_url TEXT NOT NULL,
    thumbnail_url TEXT,

    -- Image dimensions
    width INTEGER,
    height INTEGER,

    -- Timestamps
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for attachments
CREATE INDEX IF NOT EXISTS idx_chat_attachments_message ON workspace.chat_attachments(message_id);

-- =============================================
-- 8. TRIGGERS
-- =============================================

-- Function to update conversation last message
CREATE OR REPLACE FUNCTION workspace.update_conversation_last_message()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE workspace.chat_conversations
    SET
        last_message_at = NEW.created_at,
        last_message_preview = CASE
            WHEN NEW.message_type = 'call' THEN 'Audio call'
            WHEN NEW.message_type = 'image' THEN 'Sent an image'
            WHEN NEW.message_type = 'file' THEN 'Sent a file'
            WHEN NEW.message_type = 'system' THEN NEW.content
            ELSE LEFT(NEW.content, 200)
        END,
        last_message_sender_id = NEW.sender_id,
        last_message_sender_name = NEW.sender_name,
        updated_at = CURRENT_TIMESTAMP
    WHERE id = NEW.conversation_id;

    -- Increment unread count for other participants
    UPDATE workspace.chat_participants
    SET unread_count = unread_count + 1
    WHERE conversation_id = NEW.conversation_id
    AND (user_id IS NULL OR user_id != NEW.sender_id)
    AND left_at IS NULL;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger for last message update
DROP TRIGGER IF EXISTS trigger_update_last_message ON workspace.chat_messages;
CREATE TRIGGER trigger_update_last_message
    AFTER INSERT ON workspace.chat_messages
    FOR EACH ROW
    EXECUTE FUNCTION workspace.update_conversation_last_message();

-- Function to update external contact last_contacted_at
CREATE OR REPLACE FUNCTION workspace.update_external_contact_last_contacted()
RETURNS TRIGGER AS $$
BEGIN
    -- Update last_contacted_at for external contact participants in this conversation
    UPDATE workspace.chat_external_contacts ec
    SET last_contacted_at = NEW.created_at
    FROM workspace.chat_participants cp
    WHERE cp.conversation_id = NEW.conversation_id
    AND cp.participant_type = 'guest'
    AND cp.external_contact_id = ec.id;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger for external contact update
DROP TRIGGER IF EXISTS trigger_update_external_contact ON workspace.chat_messages;
CREATE TRIGGER trigger_update_external_contact
    AFTER INSERT ON workspace.chat_messages
    FOR EACH ROW
    EXECUTE FUNCTION workspace.update_external_contact_last_contacted();

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION workspace.update_chat_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger for external contacts updated_at
DROP TRIGGER IF EXISTS trigger_external_contacts_updated ON workspace.chat_external_contacts;
CREATE TRIGGER trigger_external_contacts_updated
    BEFORE UPDATE ON workspace.chat_external_contacts
    FOR EACH ROW
    EXECUTE FUNCTION workspace.update_chat_updated_at();

-- =============================================
-- 9. COMMENTS
-- =============================================
COMMENT ON TABLE workspace.chat_external_contacts IS 'External contacts outside the workspace (clients, partners). Each workspace manages their own list.';
COMMENT ON TABLE workspace.chat_conversations IS 'Chat conversations - direct (1:1) or group. Scope determines visibility (internal/external/cross_tenant).';
COMMENT ON TABLE workspace.chat_participants IS 'Conversation participants with read tracking and roles.';
COMMENT ON TABLE workspace.chat_invitations IS 'Email invitations for external users to join conversations.';
COMMENT ON TABLE workspace.chat_call_logs IS 'Audio/video call history with duration and participant tracking.';
COMMENT ON TABLE workspace.chat_messages IS 'Individual chat messages with support for text, images, files, and calls.';
COMMENT ON TABLE workspace.chat_attachments IS 'File attachments for messages.';

COMMENT ON COLUMN workspace.chat_conversations.scope IS 'internal=Team tab, external/cross_tenant=Clients tab';
COMMENT ON COLUMN workspace.chat_participants.participant_type IS 'internal=same tenant, external_user=different tenant, guest=email-only';
