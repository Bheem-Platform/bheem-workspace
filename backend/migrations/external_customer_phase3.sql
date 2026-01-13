-- =============================================================================
-- Bheem Workspace - External Customer Implementation Phase 3 Migrations
-- Run this migration to add all tables required for the External Customer features
-- =============================================================================

-- Create workspace schema if not exists
CREATE SCHEMA IF NOT EXISTS workspace;

-- =============================================================================
-- 1. Onboarding Progress Table (Phase 2.2)
-- =============================================================================
CREATE TABLE IF NOT EXISTS workspace.onboarding_progress (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID REFERENCES workspace.tenants(id) ON DELETE CASCADE,

    -- Onboarding steps
    profile_completed BOOLEAN DEFAULT FALSE,
    domain_setup_completed BOOLEAN DEFAULT FALSE,
    team_invited BOOLEAN DEFAULT FALSE,
    first_meeting_created BOOLEAN DEFAULT FALSE,
    first_document_uploaded BOOLEAN DEFAULT FALSE,

    -- Progress tracking
    current_step VARCHAR(50) DEFAULT 'welcome',
    completed_at TIMESTAMP,
    skipped_steps VARCHAR[] DEFAULT '{}',

    -- Metadata
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),

    UNIQUE(tenant_id)
);

CREATE INDEX IF NOT EXISTS idx_onboarding_tenant ON workspace.onboarding_progress(tenant_id);

-- =============================================================================
-- 2. Resources Table (Phase 2.3 - Meeting Room Booking)
-- =============================================================================
CREATE TABLE IF NOT EXISTS workspace.resources (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID REFERENCES workspace.tenants(id) ON DELETE CASCADE,

    name VARCHAR(255) NOT NULL,
    resource_type VARCHAR(50) NOT NULL,  -- 'room', 'equipment', 'vehicle'
    capacity INTEGER,
    location VARCHAR(255),
    description TEXT,

    -- Availability settings
    available_from TIME,
    available_until TIME,
    available_days INTEGER[] DEFAULT '{1,2,3,4,5}',  -- 1=Monday, 7=Sunday

    -- Booking settings
    requires_approval BOOLEAN DEFAULT FALSE,
    auto_release_minutes INTEGER DEFAULT 15,
    min_booking_minutes INTEGER DEFAULT 15,
    max_booking_minutes INTEGER DEFAULT 480,

    -- Status
    is_active BOOLEAN DEFAULT TRUE,

    -- Metadata
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_resources_tenant ON workspace.resources(tenant_id);
CREATE INDEX IF NOT EXISTS idx_resources_type ON workspace.resources(resource_type);
CREATE INDEX IF NOT EXISTS idx_resources_active ON workspace.resources(is_active) WHERE is_active = TRUE;

-- =============================================================================
-- 3. Resource Bookings Table (Phase 2.3)
-- =============================================================================
CREATE TABLE IF NOT EXISTS workspace.resource_bookings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    resource_id UUID REFERENCES workspace.resources(id) ON DELETE CASCADE,
    tenant_id UUID REFERENCES workspace.tenants(id) ON DELETE CASCADE,

    booked_by UUID NOT NULL,  -- User ID
    booked_by_name VARCHAR(255),
    booked_by_email VARCHAR(255),

    title VARCHAR(255),
    description TEXT,
    start_time TIMESTAMP NOT NULL,
    end_time TIMESTAMP NOT NULL,

    -- Link to calendar/meet
    calendar_event_id VARCHAR(255),
    meet_room_code VARCHAR(50),

    -- Status
    status VARCHAR(50) DEFAULT 'confirmed',  -- pending, confirmed, cancelled, completed
    approval_status VARCHAR(50),  -- pending, approved, rejected (if requires_approval)
    approved_by UUID,
    approved_at TIMESTAMP,

    -- Check-in tracking
    checked_in_at TIMESTAMP,
    checked_out_at TIMESTAMP,

    -- Metadata
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_resource_bookings_resource ON workspace.resource_bookings(resource_id);
CREATE INDEX IF NOT EXISTS idx_resource_bookings_user ON workspace.resource_bookings(booked_by);
CREATE INDEX IF NOT EXISTS idx_resource_bookings_time ON workspace.resource_bookings(start_time, end_time);
CREATE INDEX IF NOT EXISTS idx_resource_bookings_status ON workspace.resource_bookings(status);

-- =============================================================================
-- 4. Activity Log Table (Phase 3.2 - Security)
-- =============================================================================
CREATE TABLE IF NOT EXISTS workspace.activity_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID,
    user_id UUID,

    action VARCHAR(100) NOT NULL,  -- login, login_failed, user_created, etc.
    description TEXT,

    -- Request details
    ip_address INET,
    user_agent TEXT,

    -- Additional data
    extra_data JSONB DEFAULT '{}',

    -- Metadata
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_activity_log_tenant ON workspace.activity_log(tenant_id);
CREATE INDEX IF NOT EXISTS idx_activity_log_user ON workspace.activity_log(user_id);
CREATE INDEX IF NOT EXISTS idx_activity_log_action ON workspace.activity_log(action);
CREATE INDEX IF NOT EXISTS idx_activity_log_created ON workspace.activity_log(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_activity_log_ip ON workspace.activity_log(ip_address);

-- =============================================================================
-- 5. Import Queue Table (Phase 3.3 - Data Migration)
-- =============================================================================
CREATE TABLE IF NOT EXISTS workspace.import_queue (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID REFERENCES workspace.tenants(id) ON DELETE CASCADE,
    user_id UUID NOT NULL,

    import_type VARCHAR(50) NOT NULL,  -- email, calendar, contacts, document
    data JSONB NOT NULL,
    file_content BYTEA,

    -- Processing status
    status VARCHAR(50) DEFAULT 'pending',  -- pending, processing, completed, failed
    error_message TEXT,
    processed_at TIMESTAMP,

    -- Metadata
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_import_queue_tenant ON workspace.import_queue(tenant_id);
CREATE INDEX IF NOT EXISTS idx_import_queue_user ON workspace.import_queue(user_id);
CREATE INDEX IF NOT EXISTS idx_import_queue_status ON workspace.import_queue(status);
CREATE INDEX IF NOT EXISTS idx_import_queue_type ON workspace.import_queue(import_type);

-- =============================================================================
-- 6. Contacts Table (Phase 3.3 - Data Migration)
-- =============================================================================
CREATE TABLE IF NOT EXISTS workspace.contacts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID REFERENCES workspace.tenants(id) ON DELETE CASCADE,
    user_id UUID NOT NULL,

    name VARCHAR(255),
    email VARCHAR(255),
    phone VARCHAR(50),
    organization VARCHAR(255),
    job_title VARCHAR(255),

    -- Additional info
    notes TEXT,
    tags VARCHAR[],

    -- Avatar
    avatar_url VARCHAR(500),

    -- Source
    source VARCHAR(50) DEFAULT 'manual',  -- manual, import_google, import_outlook
    external_id VARCHAR(255),

    -- Metadata
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),

    -- Unique constraint to prevent duplicates
    UNIQUE(tenant_id, user_id, email)
);

CREATE INDEX IF NOT EXISTS idx_contacts_tenant ON workspace.contacts(tenant_id);
CREATE INDEX IF NOT EXISTS idx_contacts_user ON workspace.contacts(user_id);
CREATE INDEX IF NOT EXISTS idx_contacts_email ON workspace.contacts(email);
CREATE INDEX IF NOT EXISTS idx_contacts_name ON workspace.contacts(name);

-- =============================================================================
-- 7. Meeting Attendance Table (Meeting Attendance Tracking)
-- =============================================================================
CREATE TABLE IF NOT EXISTS workspace.meeting_attendance (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    room_code VARCHAR(50) NOT NULL,

    participant_id VARCHAR(255) NOT NULL,
    participant_name VARCHAR(255),
    participant_email VARCHAR(255),

    join_time TIMESTAMP NOT NULL DEFAULT NOW(),
    leave_time TIMESTAMP,
    duration_minutes DECIMAL(10, 2),

    is_host BOOLEAN DEFAULT FALSE,

    -- Connection info
    ip_address INET,
    user_agent TEXT,
    device_type VARCHAR(50),  -- desktop, mobile, tablet

    -- Metadata
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_attendance_room ON workspace.meeting_attendance(room_code);
CREATE INDEX IF NOT EXISTS idx_attendance_participant ON workspace.meeting_attendance(participant_id);
CREATE INDEX IF NOT EXISTS idx_attendance_join_time ON workspace.meeting_attendance(join_time);
CREATE INDEX IF NOT EXISTS idx_attendance_email ON workspace.meeting_attendance(participant_email);

-- =============================================================================
-- 8. Add Mattermost Integration Columns (Phase 2.1 - Team Chat)
-- =============================================================================
DO $$
BEGIN
    -- Add mattermost_team_id to tenants if not exists
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'workspace'
        AND table_name = 'tenants'
        AND column_name = 'mattermost_team_id'
    ) THEN
        ALTER TABLE workspace.tenants ADD COLUMN mattermost_team_id VARCHAR(255);
    END IF;

    -- Add mattermost_user_id to tenant_users if not exists
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'workspace'
        AND table_name = 'tenant_users'
        AND column_name = 'mattermost_user_id'
    ) THEN
        ALTER TABLE workspace.tenant_users ADD COLUMN mattermost_user_id VARCHAR(255);
    END IF;

    -- Add encrypted_mail_password to tenant_users if not exists (Phase 1.3)
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'workspace'
        AND table_name = 'tenant_users'
        AND column_name = 'encrypted_mail_password'
    ) THEN
        ALTER TABLE workspace.tenant_users ADD COLUMN encrypted_mail_password TEXT;
    END IF;
END $$;

-- =============================================================================
-- 9. Add Breakout Room Support Columns (Phase 2.4)
-- =============================================================================
DO $$
BEGIN
    -- Add parent_room_code for breakout room tracking
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'workspace'
        AND table_name = 'meet_rooms'
        AND column_name = 'parent_room_code'
    ) THEN
        ALTER TABLE workspace.meet_rooms ADD COLUMN parent_room_code VARCHAR(50);
    END IF;

    -- Add is_breakout_room flag
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'workspace'
        AND table_name = 'meet_rooms'
        AND column_name = 'is_breakout_room'
    ) THEN
        ALTER TABLE workspace.meet_rooms ADD COLUMN is_breakout_room BOOLEAN DEFAULT FALSE;
    END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_meet_rooms_parent ON workspace.meet_rooms(parent_room_code) WHERE parent_room_code IS NOT NULL;

-- =============================================================================
-- 10. Domain DNS Records Table (already exists, ensure structure)
-- =============================================================================
CREATE TABLE IF NOT EXISTS workspace.domain_dns_records (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    domain_id UUID REFERENCES workspace.domains(id) ON DELETE CASCADE,

    record_type VARCHAR(20) NOT NULL,  -- TXT, MX, CNAME, A, AAAA
    name VARCHAR(255) NOT NULL,
    value TEXT NOT NULL,
    priority INTEGER,
    ttl INTEGER DEFAULT 3600,

    -- Verification status
    verified BOOLEAN DEFAULT FALSE,
    last_check TIMESTAMP,

    -- Metadata
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_domain_dns_domain ON workspace.domain_dns_records(domain_id);

-- =============================================================================
-- 11. Security Sessions Table (For tracking active sessions)
-- =============================================================================
CREATE TABLE IF NOT EXISTS workspace.user_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,
    tenant_id UUID,

    session_token VARCHAR(255) NOT NULL,

    -- Device info
    ip_address INET,
    user_agent TEXT,
    device_name VARCHAR(255),
    device_type VARCHAR(50),
    location VARCHAR(255),

    -- Status
    is_active BOOLEAN DEFAULT TRUE,
    last_activity TIMESTAMP DEFAULT NOW(),

    -- Metadata
    created_at TIMESTAMP DEFAULT NOW(),
    expires_at TIMESTAMP,

    UNIQUE(session_token)
);

CREATE INDEX IF NOT EXISTS idx_sessions_user ON workspace.user_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_sessions_tenant ON workspace.user_sessions(tenant_id);
CREATE INDEX IF NOT EXISTS idx_sessions_active ON workspace.user_sessions(is_active) WHERE is_active = TRUE;
CREATE INDEX IF NOT EXISTS idx_sessions_token ON workspace.user_sessions(session_token);

-- =============================================================================
-- 12. Webhook Events Table (For integration tracking)
-- =============================================================================
CREATE TABLE IF NOT EXISTS workspace.webhook_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID,

    event_type VARCHAR(100) NOT NULL,
    payload JSONB NOT NULL,
    source VARCHAR(50),  -- livekit, mailcow, nextcloud, etc.

    -- Processing
    processed BOOLEAN DEFAULT FALSE,
    processed_at TIMESTAMP,
    error_message TEXT,

    -- Metadata
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_webhook_tenant ON workspace.webhook_events(tenant_id);
CREATE INDEX IF NOT EXISTS idx_webhook_type ON workspace.webhook_events(event_type);
CREATE INDEX IF NOT EXISTS idx_webhook_processed ON workspace.webhook_events(processed);
CREATE INDEX IF NOT EXISTS idx_webhook_created ON workspace.webhook_events(created_at DESC);

-- =============================================================================
-- Create trigger to update updated_at columns
-- =============================================================================
CREATE OR REPLACE FUNCTION workspace.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Apply trigger to tables with updated_at
DO $$
DECLARE
    t TEXT;
BEGIN
    FOR t IN SELECT unnest(ARRAY['onboarding_progress', 'resources', 'resource_bookings', 'contacts'])
    LOOP
        EXECUTE format('
            DROP TRIGGER IF EXISTS update_%I_updated_at ON workspace.%I;
            CREATE TRIGGER update_%I_updated_at
            BEFORE UPDATE ON workspace.%I
            FOR EACH ROW EXECUTE FUNCTION workspace.update_updated_at_column();
        ', t, t, t, t);
    END LOOP;
END $$;

-- =============================================================================
-- Grant permissions (adjust as needed for your setup)
-- =============================================================================
-- GRANT ALL ON ALL TABLES IN SCHEMA workspace TO bheem_app;
-- GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA workspace TO bheem_app;

-- =============================================================================
-- Summary
-- =============================================================================
-- Tables created:
-- 1. workspace.onboarding_progress - Tracks onboarding wizard progress
-- 2. workspace.resources - Meeting rooms and equipment
-- 3. workspace.resource_bookings - Resource bookings
-- 4. workspace.activity_log - Security audit log
-- 5. workspace.import_queue - Data migration queue
-- 6. workspace.contacts - Imported contacts
-- 7. workspace.meeting_attendance - Meeting attendance tracking
-- 8. workspace.domain_dns_records - DNS record tracking
-- 9. workspace.user_sessions - Active session tracking
-- 10. workspace.webhook_events - Webhook event logging
--
-- Columns added:
-- - workspace.tenants.mattermost_team_id
-- - workspace.tenant_users.mattermost_user_id
-- - workspace.tenant_users.encrypted_mail_password
-- - workspace.meet_rooms.parent_room_code
-- - workspace.meet_rooms.is_breakout_room
-- =============================================================================
