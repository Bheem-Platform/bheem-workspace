-- Migration: Add shared mailboxes / team inboxes tables
-- Date: 2025-01-05
-- Phase 5.1: Enterprise Features - Shared Mailboxes

-- ============================================
-- Shared Mailboxes Table
-- ============================================
CREATE TABLE IF NOT EXISTS workspace.shared_mailboxes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL,
    email VARCHAR(255) NOT NULL UNIQUE,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    is_active BOOLEAN DEFAULT TRUE,
    created_by UUID,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_shared_mailboxes_tenant ON workspace.shared_mailboxes(tenant_id);
CREATE INDEX IF NOT EXISTS idx_shared_mailboxes_email ON workspace.shared_mailboxes(email);

-- ============================================
-- Shared Mailbox Members Table
-- ============================================
CREATE TABLE IF NOT EXISTS workspace.shared_mailbox_members (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    mailbox_id UUID NOT NULL REFERENCES workspace.shared_mailboxes(id) ON DELETE CASCADE,
    user_id UUID NOT NULL,
    role VARCHAR(20) DEFAULT 'member',  -- admin, member, viewer
    can_send BOOLEAN DEFAULT TRUE,
    can_delete BOOLEAN DEFAULT FALSE,
    can_manage_members BOOLEAN DEFAULT FALSE,
    added_by UUID,
    created_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(mailbox_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_shared_mailbox_members_mailbox ON workspace.shared_mailbox_members(mailbox_id);
CREATE INDEX IF NOT EXISTS idx_shared_mailbox_members_user ON workspace.shared_mailbox_members(user_id);

-- ============================================
-- Shared Mailbox Email Assignments Table
-- (Track who is handling which email)
-- ============================================
CREATE TABLE IF NOT EXISTS workspace.shared_mailbox_assignments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    mailbox_id UUID NOT NULL REFERENCES workspace.shared_mailboxes(id) ON DELETE CASCADE,
    message_id VARCHAR(500) NOT NULL,
    assigned_to UUID,
    assigned_by UUID,
    status VARCHAR(20) DEFAULT 'open',  -- open, in_progress, resolved, closed
    priority VARCHAR(10) DEFAULT 'normal',  -- low, normal, high, urgent
    due_date TIMESTAMP,
    notes TEXT,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_shared_assignments_mailbox ON workspace.shared_mailbox_assignments(mailbox_id);
CREATE INDEX IF NOT EXISTS idx_shared_assignments_assigned ON workspace.shared_mailbox_assignments(assigned_to);
CREATE INDEX IF NOT EXISTS idx_shared_assignments_status ON workspace.shared_mailbox_assignments(status);
CREATE INDEX IF NOT EXISTS idx_shared_assignments_message ON workspace.shared_mailbox_assignments(message_id);

-- ============================================
-- Shared Mailbox Internal Comments
-- (Comments on emails visible only to team)
-- ============================================
CREATE TABLE IF NOT EXISTS workspace.shared_mailbox_comments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    mailbox_id UUID NOT NULL REFERENCES workspace.shared_mailboxes(id) ON DELETE CASCADE,
    message_id VARCHAR(500) NOT NULL,
    user_id UUID NOT NULL,
    comment TEXT NOT NULL,
    is_internal BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_shared_comments_mailbox ON workspace.shared_mailbox_comments(mailbox_id);
CREATE INDEX IF NOT EXISTS idx_shared_comments_message ON workspace.shared_mailbox_comments(message_id);

-- ============================================
-- Shared Mailbox Activity Log
-- ============================================
CREATE TABLE IF NOT EXISTS workspace.shared_mailbox_activity (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    mailbox_id UUID NOT NULL REFERENCES workspace.shared_mailboxes(id) ON DELETE CASCADE,
    message_id VARCHAR(500),
    user_id UUID NOT NULL,
    action VARCHAR(50) NOT NULL,  -- viewed, replied, forwarded, assigned, commented, status_changed
    details JSONB,
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_shared_activity_mailbox ON workspace.shared_mailbox_activity(mailbox_id);
CREATE INDEX IF NOT EXISTS idx_shared_activity_message ON workspace.shared_mailbox_activity(message_id);
CREATE INDEX IF NOT EXISTS idx_shared_activity_created ON workspace.shared_mailbox_activity(created_at);

-- ============================================
-- Done
-- ============================================
