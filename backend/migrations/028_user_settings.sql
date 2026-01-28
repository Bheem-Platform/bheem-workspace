-- Migration: User Settings Table
-- Stores per-user preferences and settings

-- Create user_settings table
CREATE TABLE IF NOT EXISTS workspace.user_settings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,
    tenant_id UUID REFERENCES workspace.tenants(id) ON DELETE CASCADE,

    -- Appearance Settings
    theme VARCHAR(20) DEFAULT 'light', -- light, dark, system
    accent_color VARCHAR(20) DEFAULT '#977DFF',
    show_app_names BOOLEAN DEFAULT true,
    compact_mode BOOLEAN DEFAULT false,
    sidebar_position VARCHAR(10) DEFAULT 'left', -- left, right

    -- Apps Settings (JSON for enabled/disabled apps)
    enabled_apps JSONB DEFAULT '{"mail": true, "docs": true, "sheets": true, "slides": true, "calendar": true, "meet": true, "drive": true, "chat": true, "forms": true}'::jsonb,

    -- Notification Settings
    email_notifications BOOLEAN DEFAULT true,
    push_notifications BOOLEAN DEFAULT true,
    desktop_notifications BOOLEAN DEFAULT true,
    sound_enabled BOOLEAN DEFAULT true,
    email_digest VARCHAR(20) DEFAULT 'daily', -- none, daily, weekly
    notify_on_mention BOOLEAN DEFAULT true,
    notify_on_comment BOOLEAN DEFAULT true,
    notify_on_share BOOLEAN DEFAULT true,

    -- Security Settings
    two_factor_enabled BOOLEAN DEFAULT false,
    session_timeout INTEGER DEFAULT 30, -- minutes, 0 = never

    -- Language & Region
    language VARCHAR(10) DEFAULT 'en',
    timezone VARCHAR(50) DEFAULT 'UTC',
    date_format VARCHAR(20) DEFAULT 'MM/DD/YYYY',
    time_format VARCHAR(5) DEFAULT '12h', -- 12h, 24h
    week_start VARCHAR(10) DEFAULT 'sunday', -- sunday, monday

    -- Metadata
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_user_settings_user ON workspace.user_settings(user_id);
CREATE INDEX IF NOT EXISTS idx_user_settings_tenant ON workspace.user_settings(tenant_id);

-- Create unique constraint to ensure one settings record per user per tenant
CREATE UNIQUE INDEX IF NOT EXISTS idx_user_settings_unique ON workspace.user_settings(user_id, tenant_id);

-- Add settings column to tenants if not exists (for workspace-wide settings)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'workspace'
        AND table_name = 'tenants'
        AND column_name = 'workspace_settings'
    ) THEN
        ALTER TABLE workspace.tenants ADD COLUMN workspace_settings JSONB DEFAULT '{}'::jsonb;
    END IF;
END $$;

-- Add updated_at trigger
CREATE OR REPLACE FUNCTION workspace.update_user_settings_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_user_settings_updated_at ON workspace.user_settings;
CREATE TRIGGER trigger_user_settings_updated_at
    BEFORE UPDATE ON workspace.user_settings
    FOR EACH ROW
    EXECUTE FUNCTION workspace.update_user_settings_updated_at();

-- Grant permissions (uncomment if bheem_app role exists)
-- GRANT ALL ON workspace.user_settings TO bheem_app;
