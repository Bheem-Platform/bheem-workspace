-- Migration: 005_mail_models.sql
-- Description: Create mail feature tables (drafts, signatures, filters, contacts, scheduled emails)
-- Date: 2024-01-05

-- =============================================
-- Mail Drafts Table
-- =============================================
CREATE TABLE IF NOT EXISTS workspace.mail_drafts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,

    -- Email content
    subject TEXT DEFAULT '',
    body TEXT DEFAULT '',
    is_html BOOLEAN DEFAULT TRUE,

    -- Recipients (JSONB arrays of {name, email})
    to_addresses JSONB DEFAULT '[]'::jsonb,
    cc_addresses JSONB DEFAULT '[]'::jsonb,
    bcc_addresses JSONB DEFAULT '[]'::jsonb,

    -- Attachments metadata
    attachments JSONB DEFAULT '[]'::jsonb,

    -- Reply/Forward info
    reply_to_message_id VARCHAR(500),
    forward_message_id VARCHAR(500),
    reply_type VARCHAR(20),  -- 'reply', 'reply_all', 'forward'

    -- Timestamps
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Indexes for mail_drafts
CREATE INDEX IF NOT EXISTS idx_mail_drafts_user ON workspace.mail_drafts(user_id);
CREATE INDEX IF NOT EXISTS idx_mail_drafts_updated ON workspace.mail_drafts(updated_at);

COMMENT ON TABLE workspace.mail_drafts IS 'Email drafts saved server-side for cross-device access';

-- =============================================
-- Mail Signatures Table
-- =============================================
CREATE TABLE IF NOT EXISTS workspace.mail_signatures (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,

    -- Signature details
    name VARCHAR(100) NOT NULL,
    content TEXT NOT NULL,
    is_html BOOLEAN DEFAULT TRUE,

    -- Default flag (only one can be default per user)
    is_default BOOLEAN DEFAULT FALSE,

    -- Timestamps
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Indexes for mail_signatures
CREATE INDEX IF NOT EXISTS idx_mail_signatures_user ON workspace.mail_signatures(user_id);

COMMENT ON TABLE workspace.mail_signatures IS 'Email signatures per user';

-- =============================================
-- Mail Filters Table
-- =============================================
CREATE TABLE IF NOT EXISTS workspace.mail_filters (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,

    -- Filter info
    name VARCHAR(255) NOT NULL,
    is_enabled BOOLEAN DEFAULT TRUE,
    priority INTEGER DEFAULT 0,  -- Lower = higher priority
    stop_processing BOOLEAN DEFAULT FALSE,  -- Stop if this filter matches

    -- Conditions (JSONB array of condition objects)
    -- Example: [{"field": "from", "operator": "contains", "value": "@company.com"}]
    conditions JSONB NOT NULL DEFAULT '[]'::jsonb,

    -- Actions (JSONB array of action objects)
    -- Example: [{"action": "move_to", "value": "Important"}]
    actions JSONB NOT NULL DEFAULT '[]'::jsonb,

    -- Timestamps
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Indexes for mail_filters
CREATE INDEX IF NOT EXISTS idx_mail_filters_user ON workspace.mail_filters(user_id);
CREATE INDEX IF NOT EXISTS idx_mail_filters_priority ON workspace.mail_filters(priority);

COMMENT ON TABLE workspace.mail_filters IS 'Email filters/rules for auto-organizing';

-- =============================================
-- Mail Contacts Table
-- =============================================
CREATE TABLE IF NOT EXISTS workspace.mail_contacts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,

    -- Contact info
    email VARCHAR(320) NOT NULL,
    name VARCHAR(255),

    -- Usage stats
    frequency INTEGER DEFAULT 1,  -- How often emailed
    last_contacted TIMESTAMP,

    -- Status
    is_favorite BOOLEAN DEFAULT FALSE,
    source VARCHAR(50) DEFAULT 'auto',  -- 'auto', 'manual', 'import'

    -- Timestamps
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),

    -- Unique constraint per user+email
    CONSTRAINT uq_mail_contacts_user_email UNIQUE (user_id, email)
);

-- Indexes for mail_contacts
CREATE INDEX IF NOT EXISTS idx_mail_contacts_user ON workspace.mail_contacts(user_id);
CREATE INDEX IF NOT EXISTS idx_mail_contacts_email ON workspace.mail_contacts(email);
CREATE INDEX IF NOT EXISTS idx_mail_contacts_frequency ON workspace.mail_contacts(user_id, frequency DESC);

COMMENT ON TABLE workspace.mail_contacts IS 'Auto-collected mail contacts for autocomplete';

-- =============================================
-- Scheduled Emails Table
-- =============================================
CREATE TABLE IF NOT EXISTS workspace.scheduled_emails (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,

    -- Schedule info
    scheduled_at TIMESTAMP NOT NULL,
    status VARCHAR(20) DEFAULT 'pending',  -- pending, sent, cancelled, failed

    -- Email data (full email content as JSONB)
    email_data JSONB NOT NULL,

    -- Results
    sent_at TIMESTAMP,
    error_message TEXT,

    -- Timestamps
    created_at TIMESTAMP DEFAULT NOW()
);

-- Indexes for scheduled_emails
CREATE INDEX IF NOT EXISTS idx_scheduled_emails_user ON workspace.scheduled_emails(user_id);
CREATE INDEX IF NOT EXISTS idx_scheduled_emails_status ON workspace.scheduled_emails(status);
CREATE INDEX IF NOT EXISTS idx_scheduled_emails_time ON workspace.scheduled_emails(scheduled_at);

-- Index for finding pending emails to send
CREATE INDEX IF NOT EXISTS idx_scheduled_emails_pending ON workspace.scheduled_emails(scheduled_at)
WHERE status = 'pending';

COMMENT ON TABLE workspace.scheduled_emails IS 'Emails scheduled for future delivery';

-- =============================================
-- Update trigger for updated_at columns
-- =============================================
CREATE OR REPLACE FUNCTION workspace.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Apply update trigger to tables with updated_at
DO $$
BEGIN
    -- mail_drafts trigger
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_mail_drafts_updated_at') THEN
        CREATE TRIGGER update_mail_drafts_updated_at
            BEFORE UPDATE ON workspace.mail_drafts
            FOR EACH ROW EXECUTE FUNCTION workspace.update_updated_at_column();
    END IF;

    -- mail_signatures trigger
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_mail_signatures_updated_at') THEN
        CREATE TRIGGER update_mail_signatures_updated_at
            BEFORE UPDATE ON workspace.mail_signatures
            FOR EACH ROW EXECUTE FUNCTION workspace.update_updated_at_column();
    END IF;

    -- mail_filters trigger
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_mail_filters_updated_at') THEN
        CREATE TRIGGER update_mail_filters_updated_at
            BEFORE UPDATE ON workspace.mail_filters
            FOR EACH ROW EXECUTE FUNCTION workspace.update_updated_at_column();
    END IF;

    -- mail_contacts trigger
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_mail_contacts_updated_at') THEN
        CREATE TRIGGER update_mail_contacts_updated_at
            BEFORE UPDATE ON workspace.mail_contacts
            FOR EACH ROW EXECUTE FUNCTION workspace.update_updated_at_column();
    END IF;
END $$;
