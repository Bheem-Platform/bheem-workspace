-- Bheem Workspace Admin Module - Database Migration
-- Creates the workspace schema and all admin-related tables

-- Create workspace schema
CREATE SCHEMA IF NOT EXISTS workspace;

-- Tenants table (Organizations)
CREATE TABLE IF NOT EXISTS workspace.tenants (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    slug VARCHAR(100) NOT NULL UNIQUE,
    domain VARCHAR(255),
    owner_email VARCHAR(320) NOT NULL,

    -- Plan & Billing
    plan VARCHAR(50) NOT NULL DEFAULT 'free',
    billing_email VARCHAR(320),
    stripe_customer_id VARCHAR(100),

    -- Status
    is_active BOOLEAN DEFAULT TRUE,
    is_suspended BOOLEAN DEFAULT FALSE,
    suspended_reason TEXT,

    -- Quotas (based on plan)
    max_users INTEGER DEFAULT 5,
    meet_quota_hours INTEGER DEFAULT 10,
    docs_quota_mb INTEGER DEFAULT 1024,
    mail_quota_mb INTEGER DEFAULT 512,
    recordings_quota_mb INTEGER DEFAULT 1024,

    -- Current Usage
    meet_used_hours NUMERIC(10, 2) DEFAULT 0,
    docs_used_mb NUMERIC(10, 2) DEFAULT 0,
    mail_used_mb NUMERIC(10, 2) DEFAULT 0,
    recordings_used_mb NUMERIC(10, 2) DEFAULT 0,

    -- Settings (JSON)
    settings JSONB DEFAULT '{}',

    -- Timestamps
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    trial_ends_at TIMESTAMP,

    -- Audit
    created_by UUID
);

CREATE INDEX IF NOT EXISTS idx_tenants_slug ON workspace.tenants(slug);
CREATE INDEX IF NOT EXISTS idx_tenants_owner ON workspace.tenants(owner_email);

-- Tenant Users table (Links users to tenants with roles)
CREATE TABLE IF NOT EXISTS workspace.tenant_users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES workspace.tenants(id) ON DELETE CASCADE,
    user_id UUID NOT NULL,

    -- Role within tenant
    role VARCHAR(50) NOT NULL DEFAULT 'member',

    -- Status
    is_active BOOLEAN DEFAULT TRUE,
    invited_at TIMESTAMP,
    joined_at TIMESTAMP,
    invited_by UUID,

    -- Permissions (JSON for granular permissions)
    permissions JSONB DEFAULT '{}',

    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    UNIQUE(tenant_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_tenant_users_tenant ON workspace.tenant_users(tenant_id);
CREATE INDEX IF NOT EXISTS idx_tenant_users_user ON workspace.tenant_users(user_id);

-- Domains table (Custom domains for tenants)
CREATE TABLE IF NOT EXISTS workspace.domains (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES workspace.tenants(id) ON DELETE CASCADE,
    domain VARCHAR(255) NOT NULL UNIQUE,

    -- Domain type
    domain_type VARCHAR(20) NOT NULL DEFAULT 'email',

    -- Provider references
    mailgun_domain_id VARCHAR(100),
    cloudflare_zone_id VARCHAR(50),

    -- Verification status
    spf_verified BOOLEAN DEFAULT FALSE,
    dkim_verified BOOLEAN DEFAULT FALSE,
    mx_verified BOOLEAN DEFAULT FALSE,
    ownership_verified BOOLEAN DEFAULT FALSE,
    verification_token VARCHAR(100),

    -- Status
    is_primary BOOLEAN DEFAULT FALSE,
    is_active BOOLEAN DEFAULT TRUE,

    -- Timestamps
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    verified_at TIMESTAMP,
    created_by UUID
);

CREATE INDEX IF NOT EXISTS idx_domains_tenant ON workspace.domains(tenant_id);
CREATE INDEX IF NOT EXISTS idx_domains_domain ON workspace.domains(domain);

-- Domain DNS Records table
CREATE TABLE IF NOT EXISTS workspace.domain_dns_records (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    domain_id UUID NOT NULL REFERENCES workspace.domains(id) ON DELETE CASCADE,

    record_type VARCHAR(10) NOT NULL,
    name VARCHAR(255) NOT NULL,
    value TEXT NOT NULL,
    priority INTEGER,
    ttl INTEGER DEFAULT 3600,

    -- Verification
    is_verified BOOLEAN DEFAULT FALSE,
    last_checked_at TIMESTAMP,
    verified_at TIMESTAMP,

    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_dns_records_domain ON workspace.domain_dns_records(domain_id);

-- Developers table
CREATE TABLE IF NOT EXISTS workspace.developers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,

    -- Role
    role VARCHAR(30) NOT NULL,

    -- Access credentials
    ssh_public_key TEXT,
    github_username VARCHAR(100),

    -- Status
    is_active BOOLEAN DEFAULT TRUE,

    -- Timestamps
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_by UUID
);

CREATE INDEX IF NOT EXISTS idx_developers_user ON workspace.developers(user_id);

-- Developer Projects table
CREATE TABLE IF NOT EXISTS workspace.developer_projects (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    developer_id UUID NOT NULL REFERENCES workspace.developers(id) ON DELETE CASCADE,

    project_name VARCHAR(100) NOT NULL,
    access_level VARCHAR(20) NOT NULL,

    -- Git access control
    git_branch_pattern VARCHAR(100),
    can_push_to_main BOOLEAN DEFAULT FALSE,
    can_deploy_staging BOOLEAN DEFAULT FALSE,
    can_deploy_production BOOLEAN DEFAULT FALSE,

    granted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    granted_by UUID
);

CREATE INDEX IF NOT EXISTS idx_dev_projects_developer ON workspace.developer_projects(developer_id);

-- Activity Log table
CREATE TABLE IF NOT EXISTS workspace.activity_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID,
    user_id UUID,

    -- Action info
    action VARCHAR(100) NOT NULL,
    entity_type VARCHAR(50),
    entity_id UUID,
    description TEXT,

    -- Request info
    ip_address INET,
    user_agent VARCHAR(500),

    -- Additional data
    extra_data JSONB,

    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_activity_tenant ON workspace.activity_log(tenant_id);
CREATE INDEX IF NOT EXISTS idx_activity_user ON workspace.activity_log(user_id);
CREATE INDEX IF NOT EXISTS idx_activity_created ON workspace.activity_log(created_at);

-- Function to auto-update updated_at timestamp
CREATE OR REPLACE FUNCTION workspace.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Add triggers for updated_at
DROP TRIGGER IF EXISTS update_tenants_updated_at ON workspace.tenants;
CREATE TRIGGER update_tenants_updated_at
    BEFORE UPDATE ON workspace.tenants
    FOR EACH ROW
    EXECUTE FUNCTION workspace.update_updated_at_column();

DROP TRIGGER IF EXISTS update_tenant_users_updated_at ON workspace.tenant_users;
CREATE TRIGGER update_tenant_users_updated_at
    BEFORE UPDATE ON workspace.tenant_users
    FOR EACH ROW
    EXECUTE FUNCTION workspace.update_updated_at_column();

DROP TRIGGER IF EXISTS update_developers_updated_at ON workspace.developers;
CREATE TRIGGER update_developers_updated_at
    BEFORE UPDATE ON workspace.developers
    FOR EACH ROW
    EXECUTE FUNCTION workspace.update_updated_at_column();
