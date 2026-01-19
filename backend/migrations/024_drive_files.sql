-- Migration 024: Drive Files with Nextcloud Integration
-- Creates drive_files, drive_shares, and drive_activity tables for Bheem Drive

-- =============================================
-- Drive Files (files and folders)
-- =============================================
CREATE TABLE IF NOT EXISTS workspace.drive_files (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES workspace.tenants(id) ON DELETE CASCADE,
    parent_id UUID REFERENCES workspace.drive_files(id) ON DELETE CASCADE,

    -- File info
    name VARCHAR(500) NOT NULL,
    file_type VARCHAR(50) NOT NULL,  -- folder, file
    mime_type VARCHAR(255),
    size_bytes BIGINT DEFAULT 0,
    path TEXT DEFAULT '/',  -- Full path for navigation
    storage_path TEXT,  -- Path in Nextcloud
    thumbnail_path TEXT,

    -- Nextcloud integration
    nextcloud_file_id VARCHAR(255),  -- Nextcloud file ID
    nextcloud_share_url TEXT,  -- Public share URL from Nextcloud

    -- Metadata
    description TEXT,
    tags TEXT[] DEFAULT '{}',
    file_metadata JSONB DEFAULT '{}',

    -- Status
    is_starred BOOLEAN DEFAULT FALSE,
    is_trashed BOOLEAN DEFAULT FALSE,
    is_spam BOOLEAN DEFAULT FALSE,
    trashed_at TIMESTAMP WITH TIME ZONE,

    -- Versioning
    version INTEGER DEFAULT 1,
    version_history JSONB DEFAULT '[]',

    -- Ownership
    owner_id UUID NOT NULL REFERENCES workspace.tenant_users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for drive_files
CREATE INDEX IF NOT EXISTS idx_drive_files_tenant ON workspace.drive_files(tenant_id);
CREATE INDEX IF NOT EXISTS idx_drive_files_parent ON workspace.drive_files(parent_id);
CREATE INDEX IF NOT EXISTS idx_drive_files_owner ON workspace.drive_files(owner_id);
CREATE INDEX IF NOT EXISTS idx_drive_files_type ON workspace.drive_files(file_type);
CREATE INDEX IF NOT EXISTS idx_drive_files_trashed ON workspace.drive_files(is_trashed);
CREATE INDEX IF NOT EXISTS idx_drive_files_starred ON workspace.drive_files(tenant_id, is_starred) WHERE is_starred = TRUE;
CREATE INDEX IF NOT EXISTS idx_drive_files_path ON workspace.drive_files(path);
CREATE INDEX IF NOT EXISTS idx_drive_files_name ON workspace.drive_files(name);

-- =============================================
-- Drive Shares (file sharing)
-- =============================================
CREATE TABLE IF NOT EXISTS workspace.drive_shares (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    file_id UUID NOT NULL REFERENCES workspace.drive_files(id) ON DELETE CASCADE,
    shared_with_email VARCHAR(255),  -- Email of person shared with
    shared_with_user_id UUID REFERENCES workspace.tenant_users(id) ON DELETE SET NULL,

    -- Permission
    permission VARCHAR(20) DEFAULT 'view',  -- view, comment, edit

    -- Public link
    is_public BOOLEAN DEFAULT FALSE,
    share_token VARCHAR(100),  -- For public links
    link_password VARCHAR(255),  -- Hashed password
    expires_at TIMESTAMP WITH TIME ZONE,

    -- Nextcloud integration
    nextcloud_share_id VARCHAR(255),  -- Share ID in Nextcloud

    -- Tracking
    shared_by UUID,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for drive_shares
CREATE INDEX IF NOT EXISTS idx_drive_shares_file ON workspace.drive_shares(file_id);
CREATE INDEX IF NOT EXISTS idx_drive_shares_email ON workspace.drive_shares(shared_with_email);
CREATE INDEX IF NOT EXISTS idx_drive_shares_token ON workspace.drive_shares(share_token);
CREATE INDEX IF NOT EXISTS idx_drive_shares_user ON workspace.drive_shares(shared_with_user_id);

-- =============================================
-- Drive Activity (activity log)
-- =============================================
CREATE TABLE IF NOT EXISTS workspace.drive_activity (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    file_id UUID NOT NULL REFERENCES workspace.drive_files(id) ON DELETE CASCADE,
    user_id UUID,

    -- Activity info
    action VARCHAR(50) NOT NULL,  -- created, renamed, moved, shared, downloaded, deleted, restored
    details JSONB DEFAULT '{}',

    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for drive_activity
CREATE INDEX IF NOT EXISTS idx_drive_activity_file ON workspace.drive_activity(file_id);
CREATE INDEX IF NOT EXISTS idx_drive_activity_user ON workspace.drive_activity(user_id);
CREATE INDEX IF NOT EXISTS idx_drive_activity_created ON workspace.drive_activity(created_at DESC);
