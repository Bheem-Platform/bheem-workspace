-- Migration: 027_oforms.sql
-- Description: Create OnlyOffice-based document forms tables
-- Created: 2026-01-27

-- OForms table for OnlyOffice document-based forms
CREATE TABLE IF NOT EXISTS workspace.oforms (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES workspace.tenants(id) ON DELETE CASCADE,

    -- Form metadata
    title VARCHAR(500) NOT NULL DEFAULT 'Untitled Form',
    description TEXT,
    form_type VARCHAR(20) DEFAULT 'docxf', -- docxf (template), oform (fillable)
    status VARCHAR(20) DEFAULT 'draft', -- draft, published, closed

    -- Storage info (S3/MinIO)
    storage_path TEXT,
    storage_bucket VARCHAR(255),
    file_size BIGINT DEFAULT 0,
    checksum VARCHAR(64),

    -- OnlyOffice document key
    document_key VARCHAR(255),

    -- Version control
    version INTEGER DEFAULT 1,

    -- Organization
    folder_id UUID,

    -- Metadata
    is_starred BOOLEAN DEFAULT FALSE,
    is_deleted BOOLEAN DEFAULT FALSE,
    response_count INTEGER DEFAULT 0,

    -- Audit fields
    created_by UUID REFERENCES workspace.tenant_users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    last_edited_by UUID REFERENCES workspace.tenant_users(id),
    last_edited_at TIMESTAMP WITH TIME ZONE,

    -- Constraints
    CONSTRAINT oforms_title_not_empty CHECK (title <> '')
);

-- Version history for forms
CREATE TABLE IF NOT EXISTS workspace.oform_versions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    form_id UUID NOT NULL REFERENCES workspace.oforms(id) ON DELETE CASCADE,
    version INTEGER NOT NULL,
    storage_path TEXT,
    file_size BIGINT,
    checksum VARCHAR(64),
    comment TEXT,
    created_by UUID REFERENCES workspace.tenant_users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT oform_versions_unique UNIQUE (form_id, version)
);

-- Form responses (for filled forms)
CREATE TABLE IF NOT EXISTS workspace.oform_responses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    form_id UUID NOT NULL REFERENCES workspace.oforms(id) ON DELETE CASCADE,
    tenant_id UUID NOT NULL REFERENCES workspace.tenants(id) ON DELETE CASCADE,

    -- Response storage
    storage_path TEXT,
    storage_bucket VARCHAR(255),
    file_size BIGINT DEFAULT 0,

    -- Respondent info (optional)
    respondent_email VARCHAR(255),
    respondent_name VARCHAR(255),
    respondent_user_id UUID REFERENCES workspace.tenant_users(id),

    -- Metadata
    submitted_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    ip_address INET,
    user_agent TEXT,

    -- Status
    status VARCHAR(20) DEFAULT 'submitted', -- submitted, reviewed, archived
    reviewed_by UUID REFERENCES workspace.tenant_users(id),
    reviewed_at TIMESTAMP WITH TIME ZONE
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_oforms_tenant_id ON workspace.oforms(tenant_id);
CREATE INDEX IF NOT EXISTS idx_oforms_created_by ON workspace.oforms(created_by);
CREATE INDEX IF NOT EXISTS idx_oforms_status ON workspace.oforms(status);
CREATE INDEX IF NOT EXISTS idx_oforms_is_deleted ON workspace.oforms(is_deleted);
CREATE INDEX IF NOT EXISTS idx_oforms_updated_at ON workspace.oforms(updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_oforms_title ON workspace.oforms(title);

CREATE INDEX IF NOT EXISTS idx_oform_versions_form_id ON workspace.oform_versions(form_id);
CREATE INDEX IF NOT EXISTS idx_oform_responses_form_id ON workspace.oform_responses(form_id);
CREATE INDEX IF NOT EXISTS idx_oform_responses_tenant_id ON workspace.oform_responses(tenant_id);

-- Form sharing
CREATE TABLE IF NOT EXISTS workspace.oform_shares (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    form_id UUID NOT NULL REFERENCES workspace.oforms(id) ON DELETE CASCADE,

    -- Share target (internal user or external email)
    user_id UUID REFERENCES workspace.tenant_users(id),
    external_email VARCHAR(255),

    -- Permissions
    permission VARCHAR(20) DEFAULT 'fill', -- fill, view, edit

    -- Share settings
    is_active BOOLEAN DEFAULT TRUE,
    expires_at TIMESTAMP WITH TIME ZONE,
    access_count INTEGER DEFAULT 0,
    last_accessed_at TIMESTAMP WITH TIME ZONE,

    -- Audit
    created_by UUID REFERENCES workspace.tenant_users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT oform_shares_target CHECK (
        (user_id IS NOT NULL AND external_email IS NULL) OR
        (user_id IS NULL AND external_email IS NOT NULL)
    )
);

CREATE INDEX IF NOT EXISTS idx_oform_shares_form_id ON workspace.oform_shares(form_id);
CREATE INDEX IF NOT EXISTS idx_oform_shares_user_id ON workspace.oform_shares(user_id);
CREATE INDEX IF NOT EXISTS idx_oform_shares_external_email ON workspace.oform_shares(external_email);

-- Edit sessions for real-time collaboration
CREATE TABLE IF NOT EXISTS workspace.oform_edit_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    form_id UUID NOT NULL REFERENCES workspace.oforms(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES workspace.tenant_users(id),
    document_key VARCHAR(255),
    started_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    last_activity_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    ended_at TIMESTAMP WITH TIME ZONE,
    is_active BOOLEAN DEFAULT TRUE
);

CREATE INDEX IF NOT EXISTS idx_oform_edit_sessions_form_id ON workspace.oform_edit_sessions(form_id);
CREATE INDEX IF NOT EXISTS idx_oform_edit_sessions_user_id ON workspace.oform_edit_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_oform_edit_sessions_is_active ON workspace.oform_edit_sessions(is_active);

-- Trigger for updated_at
CREATE OR REPLACE FUNCTION workspace.update_oforms_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_oforms_updated_at ON workspace.oforms;
CREATE TRIGGER trigger_oforms_updated_at
    BEFORE UPDATE ON workspace.oforms
    FOR EACH ROW
    EXECUTE FUNCTION workspace.update_oforms_updated_at();

-- Update response count trigger
CREATE OR REPLACE FUNCTION workspace.update_oform_response_count()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        UPDATE workspace.oforms SET response_count = response_count + 1 WHERE id = NEW.form_id;
    ELSIF TG_OP = 'DELETE' THEN
        UPDATE workspace.oforms SET response_count = response_count - 1 WHERE id = OLD.form_id;
    END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_oform_response_count ON workspace.oform_responses;
CREATE TRIGGER trigger_oform_response_count
    AFTER INSERT OR DELETE ON workspace.oform_responses
    FOR EACH ROW
    EXECUTE FUNCTION workspace.update_oform_response_count();
