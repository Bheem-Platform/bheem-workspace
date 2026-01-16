-- Migration: 017_videos.sql
-- Description: Create videos and video_shares tables for Bheem Videos feature
-- Created: 2026-01-16

-- Videos table
CREATE TABLE IF NOT EXISTS workspace.videos (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES workspace.tenants(id) ON DELETE CASCADE,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    folder_id UUID,

    -- Video file info
    file_path TEXT,
    file_size INTEGER,
    duration INTEGER,  -- Duration in seconds
    format VARCHAR(50),
    resolution VARCHAR(20),

    -- Thumbnails
    thumbnail_url TEXT,

    -- Processing status
    status VARCHAR(20) DEFAULT 'uploading',  -- uploading, processing, ready, error
    processing_progress INTEGER DEFAULT 0,
    error_message TEXT,

    -- Playback settings
    settings JSONB DEFAULT '{
        "autoplay": false,
        "loop": false,
        "muted": false,
        "allow_download": true,
        "privacy": "private"
    }'::jsonb,

    -- Status flags
    is_starred BOOLEAN DEFAULT FALSE,
    is_deleted BOOLEAN DEFAULT FALSE,
    deleted_at TIMESTAMP,

    -- Stats
    view_count INTEGER DEFAULT 0,

    -- Metadata
    created_by UUID NOT NULL REFERENCES workspace.tenant_users(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Video shares table
CREATE TABLE IF NOT EXISTS workspace.video_shares (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    video_id UUID NOT NULL REFERENCES workspace.videos(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES workspace.tenant_users(id) ON DELETE CASCADE,
    permission VARCHAR(20) NOT NULL DEFAULT 'view',  -- view, edit

    created_by UUID,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    UNIQUE(video_id, user_id)
);

-- Indexes for videos
CREATE INDEX IF NOT EXISTS idx_videos_tenant ON workspace.videos(tenant_id);
CREATE INDEX IF NOT EXISTS idx_videos_owner ON workspace.videos(created_by);
CREATE INDEX IF NOT EXISTS idx_videos_status ON workspace.videos(status);
CREATE INDEX IF NOT EXISTS idx_videos_folder ON workspace.videos(folder_id);
CREATE INDEX IF NOT EXISTS idx_videos_starred ON workspace.videos(tenant_id, is_starred) WHERE is_starred = TRUE;
CREATE INDEX IF NOT EXISTS idx_videos_deleted ON workspace.videos(tenant_id, is_deleted) WHERE is_deleted = FALSE;

-- Indexes for video shares
CREATE INDEX IF NOT EXISTS idx_video_shares_user ON workspace.video_shares(user_id);
CREATE INDEX IF NOT EXISTS idx_video_shares_video ON workspace.video_shares(video_id);

-- Trigger to update updated_at
CREATE OR REPLACE FUNCTION workspace.update_videos_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_videos_updated_at ON workspace.videos;
CREATE TRIGGER trigger_videos_updated_at
    BEFORE UPDATE ON workspace.videos
    FOR EACH ROW
    EXECUTE FUNCTION workspace.update_videos_timestamp();

-- Add migration record
INSERT INTO workspace.migrations (name, applied_at)
VALUES ('017_videos', CURRENT_TIMESTAMP)
ON CONFLICT (name) DO NOTHING;
