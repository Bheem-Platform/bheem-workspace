-- Migration: Add mail labels, templates, and vacation responder tables
-- Date: 2025-01-05

-- ============================================
-- Mail Labels Table
-- ============================================
CREATE TABLE IF NOT EXISTS workspace.mail_labels (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,
    name VARCHAR(100) NOT NULL,
    color VARCHAR(7) DEFAULT '#4A90D9',
    description VARCHAR(255),
    is_visible BOOLEAN DEFAULT TRUE,
    show_in_list BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_mail_labels_user ON workspace.mail_labels(user_id);

-- ============================================
-- Mail Label Assignments Table
-- ============================================
CREATE TABLE IF NOT EXISTS workspace.mail_label_assignments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,
    label_id UUID NOT NULL REFERENCES workspace.mail_labels(id) ON DELETE CASCADE,
    message_id VARCHAR(500) NOT NULL,
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_mail_label_assign_user ON workspace.mail_label_assignments(user_id);
CREATE INDEX IF NOT EXISTS idx_mail_label_assign_label ON workspace.mail_label_assignments(label_id);
CREATE INDEX IF NOT EXISTS idx_mail_label_assign_message ON workspace.mail_label_assignments(message_id);

-- ============================================
-- Mail Templates Table
-- ============================================
CREATE TABLE IF NOT EXISTS workspace.mail_templates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    subject TEXT DEFAULT '',
    body TEXT DEFAULT '',
    is_html BOOLEAN DEFAULT TRUE,
    to_addresses JSONB DEFAULT '[]',
    cc_addresses JSONB DEFAULT '[]',
    category VARCHAR(100) DEFAULT 'general',
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_mail_templates_user ON workspace.mail_templates(user_id);

-- ============================================
-- Mail Vacation Responders Table
-- ============================================
CREATE TABLE IF NOT EXISTS workspace.mail_vacation_responders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL UNIQUE,
    is_enabled BOOLEAN DEFAULT FALSE,
    start_date TIMESTAMP,
    end_date TIMESTAMP,
    subject VARCHAR(500) DEFAULT 'Out of Office',
    message TEXT NOT NULL,
    is_html BOOLEAN DEFAULT FALSE,
    only_contacts BOOLEAN DEFAULT FALSE,
    only_once BOOLEAN DEFAULT TRUE,
    replied_to JSONB DEFAULT '[]',
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_mail_vacation_user ON workspace.mail_vacation_responders(user_id);

-- ============================================
-- Done
-- ============================================
