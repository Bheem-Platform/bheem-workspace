-- Migration: Add avatar_url to user_settings
-- Stores user profile photo URL

-- Add avatar_url column
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'workspace'
        AND table_name = 'user_settings'
        AND column_name = 'avatar_url'
    ) THEN
        ALTER TABLE workspace.user_settings ADD COLUMN avatar_url VARCHAR(500);
    END IF;
END $$;
