-- Migration: Add OnlyOffice storage support for presentations
-- Similar to spreadsheet storage (migration 020)

-- Add storage columns to presentations table
ALTER TABLE workspace.presentations
ADD COLUMN IF NOT EXISTS storage_path TEXT,
ADD COLUMN IF NOT EXISTS storage_bucket VARCHAR(255),
ADD COLUMN IF NOT EXISTS file_size BIGINT,
ADD COLUMN IF NOT EXISTS checksum VARCHAR(64),
ADD COLUMN IF NOT EXISTS nextcloud_path TEXT,
ADD COLUMN IF NOT EXISTS version INTEGER DEFAULT 1,
ADD COLUMN IF NOT EXISTS document_key VARCHAR(255),
ADD COLUMN IF NOT EXISTS storage_mode VARCHAR(20) DEFAULT 'external',
ADD COLUMN IF NOT EXISTS linked_entity_type VARCHAR(50),
ADD COLUMN IF NOT EXISTS linked_entity_id UUID,
ADD COLUMN IF NOT EXISTS last_edited_by UUID,
ADD COLUMN IF NOT EXISTS last_edited_at TIMESTAMP WITH TIME ZONE;

-- Create index for storage mode
CREATE INDEX IF NOT EXISTS idx_presentations_storage_mode ON workspace.presentations(storage_mode);

-- Create index for entity linking
CREATE INDEX IF NOT EXISTS idx_presentations_entity ON workspace.presentations(linked_entity_type, linked_entity_id) WHERE linked_entity_id IS NOT NULL;

-- Create presentation versions table for version history
CREATE TABLE IF NOT EXISTS workspace.presentation_versions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    presentation_id UUID NOT NULL REFERENCES workspace.presentations(id) ON DELETE CASCADE,
    version_number INTEGER NOT NULL,
    storage_path TEXT NOT NULL,
    file_size BIGINT,
    checksum VARCHAR(64),
    created_by UUID REFERENCES workspace.tenant_users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    comment TEXT,
    UNIQUE(presentation_id, version_number)
);

CREATE INDEX IF NOT EXISTS idx_presentation_versions_presentation ON workspace.presentation_versions(presentation_id);
CREATE INDEX IF NOT EXISTS idx_presentation_versions_number ON workspace.presentation_versions(presentation_id, version_number DESC);

-- Create presentation edit sessions table for tracking active OnlyOffice sessions
CREATE TABLE IF NOT EXISTS workspace.presentation_edit_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    presentation_id UUID NOT NULL REFERENCES workspace.presentations(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES workspace.tenant_users(id) ON DELETE CASCADE,
    session_key VARCHAR(255) NOT NULL,
    started_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    last_activity TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    ended_at TIMESTAMP WITH TIME ZONE,
    is_active BOOLEAN DEFAULT TRUE
);

CREATE INDEX IF NOT EXISTS idx_presentation_edit_sessions_active ON workspace.presentation_edit_sessions(presentation_id, is_active) WHERE is_active = TRUE;
CREATE INDEX IF NOT EXISTS idx_presentation_edit_sessions_user ON workspace.presentation_edit_sessions(user_id);

COMMENT ON TABLE workspace.presentation_versions IS 'Version history for presentations with OnlyOffice';
COMMENT ON TABLE workspace.presentation_edit_sessions IS 'Active OnlyOffice editing sessions for presentations';
