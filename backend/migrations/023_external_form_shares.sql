-- Migration: Add external email sharing for forms
-- Allows sharing forms with users outside the workspace

-- Add external_email column to form_shares
ALTER TABLE workspace.form_shares
    ALTER COLUMN user_id DROP NOT NULL,
    ADD COLUMN IF NOT EXISTS external_email VARCHAR(255),
    ADD COLUMN IF NOT EXISTS external_name VARCHAR(255),
    ADD COLUMN IF NOT EXISTS share_token VARCHAR(64),
    ADD COLUMN IF NOT EXISTS notified_at TIMESTAMP WITH TIME ZONE;

-- Add unique constraint for external shares
CREATE UNIQUE INDEX IF NOT EXISTS idx_form_shares_external_email
    ON workspace.form_shares(form_id, external_email)
    WHERE external_email IS NOT NULL;

-- Add index for share token lookups
CREATE INDEX IF NOT EXISTS idx_form_shares_token
    ON workspace.form_shares(share_token)
    WHERE share_token IS NOT NULL;

-- Add constraint to ensure either user_id or external_email is set
ALTER TABLE workspace.form_shares
    DROP CONSTRAINT IF EXISTS chk_form_shares_user_or_email;

ALTER TABLE workspace.form_shares
    ADD CONSTRAINT chk_form_shares_user_or_email
    CHECK (user_id IS NOT NULL OR external_email IS NOT NULL);
