-- Migration: Add personal_email column to tenant_users
-- Purpose: Support industry-standard user provisioning pattern
--          (separate personal email for invites from workspace email for login)
-- Date: 2026-01-02

-- Add personal_email column to tenant_users table
ALTER TABLE workspace.tenant_users
ADD COLUMN IF NOT EXISTS personal_email VARCHAR(320);

-- Add comment explaining the column purpose
COMMENT ON COLUMN workspace.tenant_users.personal_email IS 'Personal email address for sending notifications/invites (e.g., user gmail). Workspace email (email column) is used for login.';

-- Create index for personal_email lookups
CREATE INDEX IF NOT EXISTS idx_tenant_users_personal_email
ON workspace.tenant_users(personal_email)
WHERE personal_email IS NOT NULL;
