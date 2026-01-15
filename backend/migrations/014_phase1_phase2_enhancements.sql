-- Phase 1 & 2 Enhancements Migration
-- Additional tables and columns for organization and productivity features

-- =============================================
-- 1. Security Policies
-- =============================================
CREATE TABLE IF NOT EXISTS workspace.security_policies (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES workspace.tenants(id) ON DELETE CASCADE UNIQUE,

    -- Password policies
    password_min_length INTEGER DEFAULT 8,
    password_require_uppercase BOOLEAN DEFAULT TRUE,
    password_require_lowercase BOOLEAN DEFAULT TRUE,
    password_require_numbers BOOLEAN DEFAULT TRUE,
    password_require_symbols BOOLEAN DEFAULT FALSE,
    password_expiry_days INTEGER DEFAULT 0,  -- 0 = never expires
    password_history_count INTEGER DEFAULT 5,

    -- Session policies
    session_timeout_minutes INTEGER DEFAULT 480,  -- 8 hours
    session_max_concurrent INTEGER DEFAULT 0,  -- 0 = unlimited
    require_2fa BOOLEAN DEFAULT FALSE,
    require_2fa_for_admins BOOLEAN DEFAULT TRUE,

    -- Login policies
    max_login_attempts INTEGER DEFAULT 5,
    lockout_duration_minutes INTEGER DEFAULT 30,
    allowed_ip_ranges TEXT[] DEFAULT '{}',

    -- Data policies
    enforce_data_retention BOOLEAN DEFAULT FALSE,
    data_retention_days INTEGER DEFAULT 365,
    allow_external_sharing BOOLEAN DEFAULT TRUE,
    allow_public_links BOOLEAN DEFAULT TRUE,

    -- Device policies
    allow_mobile_apps BOOLEAN DEFAULT TRUE,
    allow_desktop_apps BOOLEAN DEFAULT TRUE,
    require_device_encryption BOOLEAN DEFAULT FALSE,

    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_by UUID
);

CREATE INDEX IF NOT EXISTS idx_security_policies_tenant ON workspace.security_policies(tenant_id);


-- =============================================
-- 2. Enhanced User Import Jobs
-- =============================================
CREATE TABLE IF NOT EXISTS workspace.user_import_jobs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES workspace.tenants(id) ON DELETE CASCADE,
    filename VARCHAR(255),
    file_size INTEGER,
    total_rows INTEGER DEFAULT 0,
    status VARCHAR(20) DEFAULT 'pending',  -- pending, processing, completed, failed
    processed_rows INTEGER DEFAULT 0,
    successful_imports INTEGER DEFAULT 0,
    failed_imports INTEGER DEFAULT 0,
    skipped_rows INTEGER DEFAULT 0,
    errors JSONB DEFAULT '[]'::jsonb,
    import_options JSONB DEFAULT '{}'::jsonb,
    created_by UUID NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    started_at TIMESTAMP WITH TIME ZONE,
    completed_at TIMESTAMP WITH TIME ZONE
);

CREATE INDEX IF NOT EXISTS idx_user_import_jobs_tenant ON workspace.user_import_jobs(tenant_id);
CREATE INDEX IF NOT EXISTS idx_user_import_jobs_status ON workspace.user_import_jobs(status);


-- =============================================
-- 3. Add response_count to forms table
-- =============================================
ALTER TABLE workspace.forms
ADD COLUMN IF NOT EXISTS response_count INTEGER DEFAULT 0;


-- =============================================
-- 4. Enhanced org_units with service settings
-- =============================================
ALTER TABLE workspace.org_units
ADD COLUMN IF NOT EXISTS service_settings JSONB DEFAULT '{}'::jsonb,
ADD COLUMN IF NOT EXISTS inherit_from_parent BOOLEAN DEFAULT TRUE,
ADD COLUMN IF NOT EXISTS created_by UUID;


-- =============================================
-- 5. Enhanced user_groups table
-- =============================================
ALTER TABLE workspace.user_groups
ADD COLUMN IF NOT EXISTS who_can_post VARCHAR(20) DEFAULT 'members',
ADD COLUMN IF NOT EXISTS who_can_view_members VARCHAR(20) DEFAULT 'members',
ADD COLUMN IF NOT EXISTS moderation_enabled BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS moderator_ids UUID[] DEFAULT '{}',
ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT TRUE;


-- =============================================
-- 6. Enhanced group_members table
-- =============================================
ALTER TABLE workspace.group_members
ADD COLUMN IF NOT EXISTS delivery_enabled BOOLEAN DEFAULT TRUE,
ADD COLUMN IF NOT EXISTS membership_source VARCHAR(20) DEFAULT 'manual';


-- =============================================
-- 7. User Admin Roles - add created_by
-- =============================================
ALTER TABLE workspace.admin_roles
ADD COLUMN IF NOT EXISTS created_by UUID;


-- =============================================
-- 8. Drive Integration - Files table
-- =============================================
CREATE TABLE IF NOT EXISTS workspace.drive_files (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES workspace.tenants(id) ON DELETE CASCADE,
    parent_id UUID REFERENCES workspace.drive_files(id) ON DELETE CASCADE,
    name VARCHAR(500) NOT NULL,
    file_type VARCHAR(50) NOT NULL,  -- folder, file
    mime_type VARCHAR(255),
    size_bytes BIGINT DEFAULT 0,
    storage_path TEXT,  -- Path in storage backend (Nextcloud/MinIO)
    thumbnail_path TEXT,

    -- Metadata
    description TEXT,
    tags TEXT[] DEFAULT '{}',
    metadata JSONB DEFAULT '{}'::jsonb,

    -- Status
    is_starred BOOLEAN DEFAULT FALSE,
    is_trashed BOOLEAN DEFAULT FALSE,
    trashed_at TIMESTAMP WITH TIME ZONE,

    -- Versioning
    version INTEGER DEFAULT 1,
    version_history JSONB DEFAULT '[]'::jsonb,

    -- Ownership
    created_by UUID NOT NULL REFERENCES workspace.tenant_users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_drive_files_tenant ON workspace.drive_files(tenant_id);
CREATE INDEX IF NOT EXISTS idx_drive_files_parent ON workspace.drive_files(parent_id);
CREATE INDEX IF NOT EXISTS idx_drive_files_owner ON workspace.drive_files(created_by);
CREATE INDEX IF NOT EXISTS idx_drive_files_type ON workspace.drive_files(file_type);
CREATE INDEX IF NOT EXISTS idx_drive_files_trashed ON workspace.drive_files(is_trashed);

-- Drive file shares
CREATE TABLE IF NOT EXISTS workspace.drive_shares (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    file_id UUID NOT NULL REFERENCES workspace.drive_files(id) ON DELETE CASCADE,
    user_id UUID REFERENCES workspace.tenant_users(id) ON DELETE CASCADE,
    email VARCHAR(255),  -- For external shares
    permission VARCHAR(20) DEFAULT 'view',  -- view, comment, edit
    link_token VARCHAR(100),  -- For public links
    link_password VARCHAR(255),  -- Hashed password for protected links
    expires_at TIMESTAMP WITH TIME ZONE,
    created_by UUID,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(file_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_drive_shares_file ON workspace.drive_shares(file_id);
CREATE INDEX IF NOT EXISTS idx_drive_shares_user ON workspace.drive_shares(user_id);
CREATE INDEX IF NOT EXISTS idx_drive_shares_token ON workspace.drive_shares(link_token);


-- =============================================
-- 9. Meet Enhancements - Breakout Rooms
-- =============================================
CREATE TABLE IF NOT EXISTS workspace.breakout_rooms (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    meeting_id UUID NOT NULL,  -- References meeting_rooms
    name VARCHAR(255) NOT NULL,
    room_index INTEGER NOT NULL DEFAULT 0,
    status VARCHAR(20) DEFAULT 'waiting',  -- waiting, active, closed
    duration_minutes INTEGER,
    started_at TIMESTAMP WITH TIME ZONE,
    ended_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_breakout_rooms_meeting ON workspace.breakout_rooms(meeting_id);

-- Breakout room assignments
CREATE TABLE IF NOT EXISTS workspace.breakout_participants (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    breakout_room_id UUID NOT NULL REFERENCES workspace.breakout_rooms(id) ON DELETE CASCADE,
    participant_id UUID NOT NULL,  -- References meeting_participants
    assignment_type VARCHAR(20) DEFAULT 'auto',  -- auto, manual
    joined_at TIMESTAMP WITH TIME ZONE,
    left_at TIMESTAMP WITH TIME ZONE,
    UNIQUE(breakout_room_id, participant_id)
);

CREATE INDEX IF NOT EXISTS idx_breakout_participants_room ON workspace.breakout_participants(breakout_room_id);


-- =============================================
-- 10. Meet Enhancements - Polls
-- =============================================
CREATE TABLE IF NOT EXISTS workspace.meeting_polls (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    meeting_id UUID NOT NULL,  -- References meeting_rooms
    question TEXT NOT NULL,
    poll_type VARCHAR(20) DEFAULT 'single',  -- single, multiple
    options JSONB NOT NULL DEFAULT '[]'::jsonb,
    is_anonymous BOOLEAN DEFAULT FALSE,
    status VARCHAR(20) DEFAULT 'draft',  -- draft, active, closed
    results JSONB DEFAULT '{}'::jsonb,
    created_by UUID NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    started_at TIMESTAMP WITH TIME ZONE,
    ended_at TIMESTAMP WITH TIME ZONE
);

CREATE INDEX IF NOT EXISTS idx_meeting_polls_meeting ON workspace.meeting_polls(meeting_id);

-- Poll votes
CREATE TABLE IF NOT EXISTS workspace.meeting_poll_votes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    poll_id UUID NOT NULL REFERENCES workspace.meeting_polls(id) ON DELETE CASCADE,
    participant_id UUID NOT NULL,
    selected_options INTEGER[] NOT NULL,  -- Array of option indices
    voted_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(poll_id, participant_id)
);

CREATE INDEX IF NOT EXISTS idx_poll_votes_poll ON workspace.meeting_poll_votes(poll_id);


-- =============================================
-- 11. Meet Enhancements - Q&A
-- =============================================
CREATE TABLE IF NOT EXISTS workspace.meeting_qa (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    meeting_id UUID NOT NULL,  -- References meeting_rooms
    question TEXT NOT NULL,
    asked_by UUID,
    asked_by_name VARCHAR(255),
    is_anonymous BOOLEAN DEFAULT FALSE,
    upvote_count INTEGER DEFAULT 0,
    is_answered BOOLEAN DEFAULT FALSE,
    answer TEXT,
    answered_by UUID,
    answered_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_meeting_qa_meeting ON workspace.meeting_qa(meeting_id);
CREATE INDEX IF NOT EXISTS idx_meeting_qa_upvotes ON workspace.meeting_qa(upvote_count DESC);

-- Q&A upvotes
CREATE TABLE IF NOT EXISTS workspace.meeting_qa_upvotes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    qa_id UUID NOT NULL REFERENCES workspace.meeting_qa(id) ON DELETE CASCADE,
    participant_id UUID NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(qa_id, participant_id)
);


-- =============================================
-- 12. Workflow Automation
-- =============================================
CREATE TABLE IF NOT EXISTS workspace.workflows (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES workspace.tenants(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    trigger_type VARCHAR(100) NOT NULL,  -- mail.received, form.submitted, schedule.daily, etc.
    trigger_config JSONB NOT NULL DEFAULT '{}'::jsonb,
    actions JSONB NOT NULL DEFAULT '[]'::jsonb,
    conditions JSONB DEFAULT '{}'::jsonb,
    is_enabled BOOLEAN DEFAULT FALSE,
    run_count INTEGER DEFAULT 0,
    last_run_at TIMESTAMP WITH TIME ZONE,
    last_error TEXT,
    created_by UUID NOT NULL REFERENCES workspace.tenant_users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_workflows_tenant ON workspace.workflows(tenant_id);
CREATE INDEX IF NOT EXISTS idx_workflows_trigger ON workspace.workflows(trigger_type);
CREATE INDEX IF NOT EXISTS idx_workflows_enabled ON workspace.workflows(is_enabled);

-- Workflow execution history
CREATE TABLE IF NOT EXISTS workspace.workflow_runs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workflow_id UUID NOT NULL REFERENCES workspace.workflows(id) ON DELETE CASCADE,
    status VARCHAR(20) DEFAULT 'running',  -- running, completed, failed
    trigger_data JSONB,
    execution_log JSONB DEFAULT '[]'::jsonb,
    started_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    completed_at TIMESTAMP WITH TIME ZONE,
    duration_ms INTEGER,
    error TEXT
);

CREATE INDEX IF NOT EXISTS idx_workflow_runs_workflow ON workspace.workflow_runs(workflow_id);
CREATE INDEX IF NOT EXISTS idx_workflow_runs_status ON workspace.workflow_runs(status);
CREATE INDEX IF NOT EXISTS idx_workflow_runs_started ON workspace.workflow_runs(started_at DESC);


-- =============================================
-- 13. Enterprise Search Index Log
-- =============================================
CREATE TABLE IF NOT EXISTS workspace.search_index_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL,
    entity_type VARCHAR(50) NOT NULL,  -- mail, doc, spreadsheet, presentation, form, file
    entity_id UUID NOT NULL,
    action VARCHAR(20) NOT NULL,  -- index, update, delete
    status VARCHAR(20) DEFAULT 'pending',  -- pending, processing, completed, failed
    error_message TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    processed_at TIMESTAMP WITH TIME ZONE
);

CREATE INDEX IF NOT EXISTS idx_search_index_log_tenant ON workspace.search_index_log(tenant_id);
CREATE INDEX IF NOT EXISTS idx_search_index_log_status ON workspace.search_index_log(status);
CREATE INDEX IF NOT EXISTS idx_search_index_log_entity ON workspace.search_index_log(entity_type, entity_id);


-- =============================================
-- 14. Calendar Enhancements - Appointment Types
-- =============================================
CREATE TABLE IF NOT EXISTS workspace.appointment_types (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES workspace.tenants(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES workspace.tenant_users(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    slug VARCHAR(100) NOT NULL,
    description TEXT,
    duration_minutes INTEGER NOT NULL DEFAULT 30,
    color VARCHAR(20),
    location_type VARCHAR(50) DEFAULT 'meet',  -- meet, phone, in_person, custom
    custom_location TEXT,
    buffer_before_minutes INTEGER DEFAULT 0,
    buffer_after_minutes INTEGER DEFAULT 0,
    availability JSONB DEFAULT '{}'::jsonb,  -- Custom availability rules
    questions JSONB DEFAULT '[]'::jsonb,  -- Questions to ask when booking
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, slug)
);

CREATE INDEX IF NOT EXISTS idx_appointment_types_user ON workspace.appointment_types(user_id);
CREATE INDEX IF NOT EXISTS idx_appointment_types_slug ON workspace.appointment_types(slug);

-- Scheduled appointments
CREATE TABLE IF NOT EXISTS workspace.scheduled_appointments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    appointment_type_id UUID NOT NULL REFERENCES workspace.appointment_types(id) ON DELETE CASCADE,
    host_id UUID NOT NULL REFERENCES workspace.tenant_users(id),
    guest_email VARCHAR(255) NOT NULL,
    guest_name VARCHAR(255),
    guest_timezone VARCHAR(50),
    start_time TIMESTAMP WITH TIME ZONE NOT NULL,
    end_time TIMESTAMP WITH TIME ZONE NOT NULL,
    status VARCHAR(20) DEFAULT 'confirmed',  -- confirmed, cancelled, completed, no_show
    calendar_event_id UUID,  -- Reference to calendar event
    meeting_room_id UUID,  -- Reference to Meet room
    answers JSONB DEFAULT '{}'::jsonb,  -- Answers to booking questions
    notes TEXT,
    cancelled_at TIMESTAMP WITH TIME ZONE,
    cancellation_reason TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_appointments_type ON workspace.scheduled_appointments(appointment_type_id);
CREATE INDEX IF NOT EXISTS idx_appointments_host ON workspace.scheduled_appointments(host_id);
CREATE INDEX IF NOT EXISTS idx_appointments_time ON workspace.scheduled_appointments(start_time);
CREATE INDEX IF NOT EXISTS idx_appointments_status ON workspace.scheduled_appointments(status);


-- =============================================
-- 15. Email Snooze
-- =============================================
CREATE TABLE IF NOT EXISTS workspace.snoozed_emails (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL,
    user_id UUID NOT NULL REFERENCES workspace.tenant_users(id) ON DELETE CASCADE,
    mail_uid VARCHAR(255) NOT NULL,  -- Mailcow message UID
    mailbox VARCHAR(255) NOT NULL,
    snooze_until TIMESTAMP WITH TIME ZONE NOT NULL,
    original_folder VARCHAR(255),
    is_unsnoozed BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    unsnoozed_at TIMESTAMP WITH TIME ZONE
);

CREATE INDEX IF NOT EXISTS idx_snoozed_emails_user ON workspace.snoozed_emails(user_id);
CREATE INDEX IF NOT EXISTS idx_snoozed_emails_until ON workspace.snoozed_emails(snooze_until);


-- =============================================
-- 16. Email Templates
-- =============================================
CREATE TABLE IF NOT EXISTS workspace.email_templates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES workspace.tenants(id) ON DELETE CASCADE,
    user_id UUID REFERENCES workspace.tenant_users(id) ON DELETE CASCADE,  -- NULL = shared template
    name VARCHAR(255) NOT NULL,
    subject VARCHAR(500),
    body TEXT NOT NULL,
    variables JSONB DEFAULT '[]'::jsonb,  -- Available variables
    category VARCHAR(100),
    is_shared BOOLEAN DEFAULT FALSE,
    use_count INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_email_templates_tenant ON workspace.email_templates(tenant_id);
CREATE INDEX IF NOT EXISTS idx_email_templates_user ON workspace.email_templates(user_id);


-- =============================================
-- Create functions for workflow triggers
-- =============================================
CREATE OR REPLACE FUNCTION workspace.notify_workflow_trigger()
RETURNS TRIGGER AS $$
BEGIN
    PERFORM pg_notify('workflow_trigger', json_build_object(
        'table', TG_TABLE_NAME,
        'action', TG_OP,
        'data', row_to_json(NEW)
    )::text);
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Add triggers for common workflow events
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'forms_response_workflow_trigger') THEN
        CREATE TRIGGER forms_response_workflow_trigger
        AFTER INSERT ON workspace.form_responses
        FOR EACH ROW EXECUTE FUNCTION workspace.notify_workflow_trigger();
    END IF;
END $$;
