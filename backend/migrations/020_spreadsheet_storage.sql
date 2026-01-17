-- Migration: Add storage support for spreadsheets (OnlyOffice integration)
-- This migration adds columns to support file-based storage (XLSX) instead of JSON blobs
-- Supports both internal (ERP) and external (SaaS) modes

-- =============================================
-- Add storage columns to spreadsheets table
-- =============================================

ALTER TABLE workspace.spreadsheets
ADD COLUMN IF NOT EXISTS storage_path VARCHAR(500);

ALTER TABLE workspace.spreadsheets
ADD COLUMN IF NOT EXISTS storage_bucket VARCHAR(100);

ALTER TABLE workspace.spreadsheets
ADD COLUMN IF NOT EXISTS file_size BIGINT DEFAULT 0;

ALTER TABLE workspace.spreadsheets
ADD COLUMN IF NOT EXISTS checksum VARCHAR(64);

ALTER TABLE workspace.spreadsheets
ADD COLUMN IF NOT EXISTS nextcloud_path VARCHAR(500);

ALTER TABLE workspace.spreadsheets
ADD COLUMN IF NOT EXISTS version INTEGER DEFAULT 1;

ALTER TABLE workspace.spreadsheets
ADD COLUMN IF NOT EXISTS last_edited_by UUID REFERENCES workspace.tenant_users(id);

ALTER TABLE workspace.spreadsheets
ADD COLUMN IF NOT EXISTS last_edited_at TIMESTAMP;

-- Mode indicator: 'internal' (ERP) or 'external' (SaaS)
ALTER TABLE workspace.spreadsheets
ADD COLUMN IF NOT EXISTS storage_mode VARCHAR(20) DEFAULT 'external';

-- ERP entity linking for internal mode
ALTER TABLE workspace.spreadsheets
ADD COLUMN IF NOT EXISTS linked_entity_type VARCHAR(50);

ALTER TABLE workspace.spreadsheets
ADD COLUMN IF NOT EXISTS linked_entity_id UUID;

-- OnlyOffice document key (for real-time collaboration)
ALTER TABLE workspace.spreadsheets
ADD COLUMN IF NOT EXISTS document_key VARCHAR(100);

-- =============================================
-- Add indexes for new columns
-- =============================================

CREATE INDEX IF NOT EXISTS idx_spreadsheets_storage_path
ON workspace.spreadsheets(storage_path);

CREATE INDEX IF NOT EXISTS idx_spreadsheets_storage_mode
ON workspace.spreadsheets(storage_mode);

CREATE INDEX IF NOT EXISTS idx_spreadsheets_linked_entity
ON workspace.spreadsheets(linked_entity_type, linked_entity_id);

CREATE INDEX IF NOT EXISTS idx_spreadsheets_document_key
ON workspace.spreadsheets(document_key);

-- =============================================
-- Add version history table for spreadsheets
-- =============================================

CREATE TABLE IF NOT EXISTS workspace.spreadsheet_versions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    spreadsheet_id UUID NOT NULL REFERENCES workspace.spreadsheets(id) ON DELETE CASCADE,
    version_number INTEGER NOT NULL,
    storage_path VARCHAR(500) NOT NULL,
    file_size BIGINT DEFAULT 0,
    checksum VARCHAR(64),
    created_by UUID REFERENCES workspace.tenant_users(id),
    created_at TIMESTAMP DEFAULT NOW(),
    comment TEXT,
    is_current BOOLEAN DEFAULT FALSE,

    UNIQUE(spreadsheet_id, version_number)
);

CREATE INDEX IF NOT EXISTS idx_spreadsheet_versions_spreadsheet
ON workspace.spreadsheet_versions(spreadsheet_id);

CREATE INDEX IF NOT EXISTS idx_spreadsheet_versions_current
ON workspace.spreadsheet_versions(spreadsheet_id, is_current) WHERE is_current = TRUE;

-- =============================================
-- OnlyOffice callback tracking
-- =============================================

CREATE TABLE IF NOT EXISTS workspace.spreadsheet_edit_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    spreadsheet_id UUID NOT NULL REFERENCES workspace.spreadsheets(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES workspace.tenant_users(id),
    document_key VARCHAR(100) NOT NULL,
    started_at TIMESTAMP DEFAULT NOW(),
    last_activity_at TIMESTAMP DEFAULT NOW(),
    ended_at TIMESTAMP,
    status VARCHAR(20) DEFAULT 'active', -- active, closed, error

    UNIQUE(document_key, user_id)
);

CREATE INDEX IF NOT EXISTS idx_spreadsheet_sessions_spreadsheet
ON workspace.spreadsheet_edit_sessions(spreadsheet_id);

CREATE INDEX IF NOT EXISTS idx_spreadsheet_sessions_active
ON workspace.spreadsheet_edit_sessions(status) WHERE status = 'active';

-- =============================================
-- Comments
-- =============================================

COMMENT ON COLUMN workspace.spreadsheets.storage_path IS 'S3 path to XLSX file (internal/{company_id}/ or external/{tenant_id}/)';
COMMENT ON COLUMN workspace.spreadsheets.storage_mode IS 'internal = ERP mode, external = SaaS mode';
COMMENT ON COLUMN workspace.spreadsheets.document_key IS 'OnlyOffice document key for collaboration';
COMMENT ON COLUMN workspace.spreadsheets.linked_entity_type IS 'ERP entity type (SALES_INVOICE, PURCHASE_ORDER, etc.) for internal mode';
COMMENT ON COLUMN workspace.spreadsheets.linked_entity_id IS 'ERP entity ID for internal mode linking';
