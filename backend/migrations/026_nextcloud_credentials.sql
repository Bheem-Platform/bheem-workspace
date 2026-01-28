-- Migration: 026_nextcloud_credentials.sql
-- Description: Store per-user Nextcloud credentials for document storage
-- Created: 2026-01-27

-- Create table to store Nextcloud app passwords for users
CREATE TABLE IF NOT EXISTS workspace.nextcloud_credentials (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL UNIQUE,  -- Reference to auth.users.id
    nextcloud_username VARCHAR(255) NOT NULL,  -- Usually the user's email
    app_password TEXT NOT NULL,  -- Encrypted app password from Nextcloud
    app_password_id VARCHAR(255),  -- Nextcloud app password ID for revocation
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    last_used_at TIMESTAMP WITH TIME ZONE,
    is_active BOOLEAN DEFAULT true
);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_nextcloud_credentials_user_id ON workspace.nextcloud_credentials(user_id);
CREATE INDEX IF NOT EXISTS idx_nextcloud_credentials_username ON workspace.nextcloud_credentials(nextcloud_username);

-- Add comment
COMMENT ON TABLE workspace.nextcloud_credentials IS 'Stores Nextcloud app passwords for per-user document storage';

-- Grant permissions
GRANT ALL ON workspace.nextcloud_credentials TO bheem_workspace;
