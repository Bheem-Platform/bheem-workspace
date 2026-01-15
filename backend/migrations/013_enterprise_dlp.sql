-- Migration: Enterprise DLP (Data Loss Prevention)
-- Phase 4: Enterprise Features

-- DLP Rules Table
CREATE TABLE IF NOT EXISTS workspace.dlp_rules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES workspace.tenants(id) ON DELETE CASCADE,

    -- Rule info
    name VARCHAR(255) NOT NULL,
    description TEXT,

    -- Pattern matching
    pattern_type VARCHAR(50) NOT NULL, -- regex, keyword, predefined
    pattern TEXT NOT NULL,
    predefined_type VARCHAR(100), -- credit_card, ssn, phone, email, etc.

    -- Scope
    scope JSONB DEFAULT '{}', -- apps, file_types, users, groups

    -- Action when detected
    action VARCHAR(50) NOT NULL, -- warn, block, notify, log
    notify_admins BOOLEAN DEFAULT TRUE,
    notify_user BOOLEAN DEFAULT TRUE,
    custom_message TEXT,

    -- Status
    is_enabled BOOLEAN DEFAULT TRUE,
    severity VARCHAR(20) DEFAULT 'medium', -- low, medium, high, critical

    -- Stats
    trigger_count INTEGER DEFAULT 0,
    last_triggered_at TIMESTAMP,

    -- Tracking
    created_by UUID,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_dlp_rules_tenant ON workspace.dlp_rules(tenant_id);
CREATE INDEX IF NOT EXISTS idx_dlp_rules_enabled ON workspace.dlp_rules(is_enabled);

-- DLP Incidents Table
CREATE TABLE IF NOT EXISTS workspace.dlp_incidents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES workspace.tenants(id) ON DELETE CASCADE,
    rule_id UUID REFERENCES workspace.dlp_rules(id) ON DELETE SET NULL,
    user_id UUID NOT NULL,

    -- Content info
    content_type VARCHAR(100) NOT NULL, -- email, document, file, chat
    content_id UUID,
    content_title VARCHAR(500),

    -- Match details
    matched_pattern TEXT,
    matched_content TEXT, -- Redacted snippet
    match_count INTEGER DEFAULT 1,

    -- Action taken
    action_taken VARCHAR(50) NOT NULL,
    was_blocked BOOLEAN DEFAULT FALSE,

    -- Status
    status VARCHAR(20) DEFAULT 'open', -- open, reviewed, resolved, false_positive
    reviewed_by UUID,
    reviewed_at TIMESTAMP,
    resolution_notes TEXT,

    -- Context
    ip_address INET,
    user_agent TEXT,

    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_dlp_incidents_tenant ON workspace.dlp_incidents(tenant_id);
CREATE INDEX IF NOT EXISTS idx_dlp_incidents_rule ON workspace.dlp_incidents(rule_id);
CREATE INDEX IF NOT EXISTS idx_dlp_incidents_user ON workspace.dlp_incidents(user_id);
CREATE INDEX IF NOT EXISTS idx_dlp_incidents_status ON workspace.dlp_incidents(status);
CREATE INDEX IF NOT EXISTS idx_dlp_incidents_created ON workspace.dlp_incidents(created_at);
