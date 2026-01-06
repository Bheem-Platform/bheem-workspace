-- Migration: 004_mail_2fa.sql
-- Description: Add 2FA support for mail authentication
-- Date: 2024-01-05

-- Add 2FA columns to tenant_users table
ALTER TABLE workspace.tenant_users
ADD COLUMN IF NOT EXISTS mail_2fa_enabled BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS mail_2fa_secret TEXT,
ADD COLUMN IF NOT EXISTS mail_2fa_backup_codes TEXT[],
ADD COLUMN IF NOT EXISTS mail_2fa_enabled_at TIMESTAMP;

-- Create 2FA audit log table
CREATE TABLE IF NOT EXISTS workspace.mail_2fa_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,
    action VARCHAR(50) NOT NULL, -- 'setup_started', 'enabled', 'disabled', 'verified', 'backup_used', 'failed_attempt'
    ip_address INET,
    user_agent TEXT,
    success BOOLEAN DEFAULT TRUE,
    failure_reason TEXT,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Create index for efficient lookups
CREATE INDEX IF NOT EXISTS idx_mail_2fa_logs_user_id
ON workspace.mail_2fa_logs(user_id);

CREATE INDEX IF NOT EXISTS idx_mail_2fa_logs_created_at
ON workspace.mail_2fa_logs(created_at);

-- Create index for 2FA enabled users
CREATE INDEX IF NOT EXISTS idx_tenant_users_2fa_enabled
ON workspace.tenant_users(mail_2fa_enabled)
WHERE mail_2fa_enabled = TRUE;

-- Add comment
COMMENT ON COLUMN workspace.tenant_users.mail_2fa_enabled IS 'Whether 2FA is enabled for mail access';
COMMENT ON COLUMN workspace.tenant_users.mail_2fa_secret IS 'Encrypted TOTP secret key';
COMMENT ON COLUMN workspace.tenant_users.mail_2fa_backup_codes IS 'Array of backup codes (hashed)';
