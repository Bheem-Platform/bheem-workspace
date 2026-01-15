-- Migration: Enterprise Device Management
-- Phase 4: Enterprise Features

-- Devices Table
CREATE TABLE IF NOT EXISTS workspace.devices (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES workspace.tenants(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES workspace.tenant_users(id) ON DELETE CASCADE,

    -- Device info
    device_id VARCHAR(255) NOT NULL, -- Unique device identifier
    device_name VARCHAR(255),
    device_type VARCHAR(50), -- desktop, mobile, tablet
    platform VARCHAR(100), -- windows, macos, ios, android, linux, web
    os_version VARCHAR(100),
    app_version VARCHAR(50),
    browser VARCHAR(100),

    -- Security
    is_managed BOOLEAN DEFAULT FALSE,
    is_encrypted BOOLEAN DEFAULT FALSE,
    has_screen_lock BOOLEAN DEFAULT FALSE,
    is_rooted BOOLEAN DEFAULT FALSE, -- Jailbroken/rooted

    -- Status
    status VARCHAR(20) DEFAULT 'active', -- active, blocked, wiped
    blocked_at TIMESTAMP,
    blocked_reason TEXT,
    wiped_at TIMESTAMP,

    -- Activity
    first_seen_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    last_seen_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    last_ip_address INET,
    last_location VARCHAR(255),

    -- Push notifications
    push_token TEXT,
    push_enabled BOOLEAN DEFAULT TRUE,

    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_devices_tenant ON workspace.devices(tenant_id);
CREATE INDEX IF NOT EXISTS idx_devices_user ON workspace.devices(user_id);
CREATE INDEX IF NOT EXISTS idx_devices_status ON workspace.devices(status);
CREATE INDEX IF NOT EXISTS idx_devices_last_seen ON workspace.devices(last_seen_at);
CREATE UNIQUE INDEX IF NOT EXISTS idx_devices_unique ON workspace.devices(tenant_id, user_id, device_id);

-- Device Policies Table
CREATE TABLE IF NOT EXISTS workspace.device_policies (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES workspace.tenants(id) ON DELETE CASCADE,

    name VARCHAR(255) NOT NULL,
    description TEXT,

    -- Policy rules
    require_encryption BOOLEAN DEFAULT FALSE,
    require_screen_lock BOOLEAN DEFAULT FALSE,
    min_os_version JSONB DEFAULT '{}', -- {"ios": "15.0", "android": "12"}
    block_rooted BOOLEAN DEFAULT TRUE,
    allowed_platforms TEXT[] DEFAULT '{}', -- Empty = all allowed
    max_inactive_days INTEGER DEFAULT 90, -- Auto-block after inactivity

    -- Actions
    block_on_violation BOOLEAN DEFAULT FALSE,
    wipe_on_violation BOOLEAN DEFAULT FALSE,

    -- Status
    is_enabled BOOLEAN DEFAULT TRUE,
    is_default BOOLEAN DEFAULT FALSE,

    -- Scope
    apply_to_groups UUID[] DEFAULT '{}',
    apply_to_org_units UUID[] DEFAULT '{}',

    created_by UUID,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_device_policies_tenant ON workspace.device_policies(tenant_id);
