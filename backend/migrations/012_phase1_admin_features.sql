-- Phase 1: Admin & User Management Enhancements
-- Migration for: Bulk Import, Org Units, User Groups, Admin Roles, Domain Aliases

-- =============================================
-- 1. Import Jobs Table (for bulk import tracking)
-- =============================================
CREATE TABLE IF NOT EXISTS workspace.import_jobs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES workspace.tenants(id) ON DELETE CASCADE,
    job_type VARCHAR(50) NOT NULL DEFAULT 'users',  -- users, contacts, etc.
    status VARCHAR(20) NOT NULL DEFAULT 'pending',  -- pending, processing, completed, failed
    total_items INTEGER NOT NULL DEFAULT 0,
    processed_items INTEGER NOT NULL DEFAULT 0,
    success_count INTEGER NOT NULL DEFAULT 0,
    error_count INTEGER NOT NULL DEFAULT 0,
    errors JSONB DEFAULT '[]'::jsonb,
    options JSONB DEFAULT '{}'::jsonb,  -- send_invites, skip_duplicates, etc.
    created_by UUID NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    started_at TIMESTAMP WITH TIME ZONE,
    completed_at TIMESTAMP WITH TIME ZONE
);

CREATE INDEX IF NOT EXISTS idx_import_jobs_tenant ON workspace.import_jobs(tenant_id);
CREATE INDEX IF NOT EXISTS idx_import_jobs_status ON workspace.import_jobs(status);
CREATE INDEX IF NOT EXISTS idx_import_jobs_created_at ON workspace.import_jobs(created_at DESC);


-- =============================================
-- 2. Organizational Units (Org Units)
-- =============================================
CREATE TABLE IF NOT EXISTS workspace.org_units (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES workspace.tenants(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    path VARCHAR(1000) NOT NULL,  -- e.g., /Engineering/Backend
    parent_id UUID REFERENCES workspace.org_units(id) ON DELETE CASCADE,
    description TEXT,
    manager_id UUID,  -- References tenant_users.id
    cost_center VARCHAR(50),
    department_code VARCHAR(50),
    settings JSONB DEFAULT '{}'::jsonb,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(tenant_id, path)
);

CREATE INDEX IF NOT EXISTS idx_org_units_tenant ON workspace.org_units(tenant_id);
CREATE INDEX IF NOT EXISTS idx_org_units_parent ON workspace.org_units(parent_id);
CREATE INDEX IF NOT EXISTS idx_org_units_path ON workspace.org_units(path);

-- Add org_unit_id to tenant_users
ALTER TABLE workspace.tenant_users
ADD COLUMN IF NOT EXISTS org_unit_id UUID REFERENCES workspace.org_units(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_tenant_users_org_unit ON workspace.tenant_users(org_unit_id);


-- =============================================
-- 3. User Groups
-- =============================================
CREATE TABLE IF NOT EXISTS workspace.user_groups (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES workspace.tenants(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    group_email VARCHAR(255),  -- e.g., engineering@company.com
    group_type VARCHAR(50) DEFAULT 'static',  -- static, dynamic
    dynamic_rules JSONB,  -- For dynamic groups: {"department": "Engineering", "role": "member"}
    allow_external_members BOOLEAN DEFAULT FALSE,
    is_public BOOLEAN DEFAULT FALSE,  -- Can be discovered by other users
    settings JSONB DEFAULT '{}'::jsonb,
    created_by UUID,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(tenant_id, name)
);

CREATE INDEX IF NOT EXISTS idx_user_groups_tenant ON workspace.user_groups(tenant_id);
CREATE INDEX IF NOT EXISTS idx_user_groups_email ON workspace.user_groups(group_email);

-- Group Membership
CREATE TABLE IF NOT EXISTS workspace.group_members (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    group_id UUID NOT NULL REFERENCES workspace.user_groups(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES workspace.tenant_users(id) ON DELETE CASCADE,
    member_role VARCHAR(20) DEFAULT 'member',  -- owner, manager, member
    can_post BOOLEAN DEFAULT TRUE,
    can_invite BOOLEAN DEFAULT FALSE,
    joined_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    added_by UUID,
    UNIQUE(group_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_group_members_group ON workspace.group_members(group_id);
CREATE INDEX IF NOT EXISTS idx_group_members_user ON workspace.group_members(user_id);


-- =============================================
-- 4. Custom Admin Roles & Permissions
-- =============================================
CREATE TABLE IF NOT EXISTS workspace.admin_roles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES workspace.tenants(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    description TEXT,
    permissions JSONB NOT NULL DEFAULT '[]'::jsonb,  -- Array of permission strings
    is_system BOOLEAN DEFAULT FALSE,  -- Built-in roles cannot be deleted
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(tenant_id, name)
);

CREATE INDEX IF NOT EXISTS idx_admin_roles_tenant ON workspace.admin_roles(tenant_id);

-- User Admin Role Assignments
CREATE TABLE IF NOT EXISTS workspace.user_admin_roles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES workspace.tenant_users(id) ON DELETE CASCADE,
    role_id UUID NOT NULL REFERENCES workspace.admin_roles(id) ON DELETE CASCADE,
    scope_type VARCHAR(50) DEFAULT 'global',  -- global, org_unit, group
    scope_id UUID,  -- ID of org_unit or group if scope_type is not global
    assigned_by UUID,
    assigned_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    expires_at TIMESTAMP WITH TIME ZONE,  -- For temporary role assignments
    UNIQUE(user_id, role_id, scope_type, scope_id)
);

CREATE INDEX IF NOT EXISTS idx_user_admin_roles_user ON workspace.user_admin_roles(user_id);
CREATE INDEX IF NOT EXISTS idx_user_admin_roles_role ON workspace.user_admin_roles(role_id);

-- Insert default admin roles
INSERT INTO workspace.admin_roles (tenant_id, name, description, permissions, is_system)
SELECT id, 'Super Admin', 'Full administrative access',
    '["*"]'::jsonb, TRUE
FROM workspace.tenants
WHERE NOT EXISTS (
    SELECT 1 FROM workspace.admin_roles WHERE name = 'Super Admin' AND tenant_id = workspace.tenants.id
);

INSERT INTO workspace.admin_roles (tenant_id, name, description, permissions, is_system)
SELECT id, 'User Admin', 'Manage users and groups',
    '["users.read", "users.write", "users.delete", "groups.read", "groups.write"]'::jsonb, TRUE
FROM workspace.tenants
WHERE NOT EXISTS (
    SELECT 1 FROM workspace.admin_roles WHERE name = 'User Admin' AND tenant_id = workspace.tenants.id
);

INSERT INTO workspace.admin_roles (tenant_id, name, description, permissions, is_system)
SELECT id, 'Help Desk', 'Reset passwords and view user details',
    '["users.read", "users.reset_password", "security.view_logs"]'::jsonb, TRUE
FROM workspace.tenants
WHERE NOT EXISTS (
    SELECT 1 FROM workspace.admin_roles WHERE name = 'Help Desk' AND tenant_id = workspace.tenants.id
);

INSERT INTO workspace.admin_roles (tenant_id, name, description, permissions, is_system)
SELECT id, 'Billing Admin', 'Manage billing and subscriptions',
    '["billing.read", "billing.write", "reports.billing"]'::jsonb, TRUE
FROM workspace.tenants
WHERE NOT EXISTS (
    SELECT 1 FROM workspace.admin_roles WHERE name = 'Billing Admin' AND tenant_id = workspace.tenants.id
);


-- =============================================
-- 5. Domain Aliases
-- =============================================
CREATE TABLE IF NOT EXISTS workspace.domain_aliases (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES workspace.tenants(id) ON DELETE CASCADE,
    domain_name VARCHAR(255) NOT NULL,  -- The alias domain
    primary_domain_id UUID,  -- References workspace.domains if tracking primary
    verification_status VARCHAR(20) DEFAULT 'pending',  -- pending, verified, failed
    verification_code VARCHAR(100),
    verified_at TIMESTAMP WITH TIME ZONE,
    mx_verified BOOLEAN DEFAULT FALSE,
    spf_verified BOOLEAN DEFAULT FALSE,
    dkim_verified BOOLEAN DEFAULT FALSE,
    dmarc_verified BOOLEAN DEFAULT FALSE,
    is_primary BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(tenant_id, domain_name)
);

CREATE INDEX IF NOT EXISTS idx_domain_aliases_tenant ON workspace.domain_aliases(tenant_id);
CREATE INDEX IF NOT EXISTS idx_domain_aliases_domain ON workspace.domain_aliases(domain_name);

-- User Email Aliases
CREATE TABLE IF NOT EXISTS workspace.user_email_aliases (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES workspace.tenant_users(id) ON DELETE CASCADE,
    alias_email VARCHAR(255) NOT NULL UNIQUE,
    domain_alias_id UUID REFERENCES workspace.domain_aliases(id) ON DELETE CASCADE,
    is_primary BOOLEAN DEFAULT FALSE,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, alias_email)
);

CREATE INDEX IF NOT EXISTS idx_user_email_aliases_user ON workspace.user_email_aliases(user_id);
CREATE INDEX IF NOT EXISTS idx_user_email_aliases_email ON workspace.user_email_aliases(alias_email);


-- =============================================
-- 6. SSO Configuration (SAML/OIDC)
-- =============================================
CREATE TABLE IF NOT EXISTS workspace.sso_configurations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES workspace.tenants(id) ON DELETE CASCADE,
    provider_name VARCHAR(100) NOT NULL,  -- e.g., "Okta", "Azure AD", "Google"
    provider_type VARCHAR(20) NOT NULL DEFAULT 'saml',  -- saml, oidc
    is_enabled BOOLEAN DEFAULT FALSE,
    is_primary BOOLEAN DEFAULT FALSE,  -- Use as default login

    -- SAML Configuration
    saml_entity_id VARCHAR(500),
    saml_sso_url VARCHAR(500),
    saml_slo_url VARCHAR(500),
    saml_certificate TEXT,
    saml_name_id_format VARCHAR(100) DEFAULT 'urn:oasis:names:tc:SAML:1.1:nameid-format:emailAddress',

    -- OIDC Configuration
    oidc_client_id VARCHAR(255),
    oidc_client_secret TEXT,  -- Encrypted
    oidc_issuer_url VARCHAR(500),
    oidc_authorization_url VARCHAR(500),
    oidc_token_url VARCHAR(500),
    oidc_userinfo_url VARCHAR(500),
    oidc_scopes VARCHAR(255) DEFAULT 'openid email profile',

    -- Attribute Mapping
    attribute_mapping JSONB DEFAULT '{
        "email": "email",
        "first_name": "given_name",
        "last_name": "family_name",
        "department": "department",
        "job_title": "jobTitle"
    }'::jsonb,

    -- Settings
    auto_provision_users BOOLEAN DEFAULT TRUE,
    auto_update_profile BOOLEAN DEFAULT TRUE,
    default_role VARCHAR(20) DEFAULT 'member',
    allowed_domains JSONB DEFAULT '[]'::jsonb,  -- Restrict to specific email domains

    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    last_synced_at TIMESTAMP WITH TIME ZONE,

    UNIQUE(tenant_id, provider_name)
);

CREATE INDEX IF NOT EXISTS idx_sso_configurations_tenant ON workspace.sso_configurations(tenant_id);

-- SSO Session Tracking
CREATE TABLE IF NOT EXISTS workspace.sso_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES workspace.tenant_users(id) ON DELETE CASCADE,
    sso_config_id UUID NOT NULL REFERENCES workspace.sso_configurations(id) ON DELETE CASCADE,
    session_index VARCHAR(255),  -- SAML SessionIndex
    name_id VARCHAR(255),  -- SAML NameID
    authenticated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    expires_at TIMESTAMP WITH TIME ZONE,
    ip_address INET,
    user_agent TEXT,
    is_active BOOLEAN DEFAULT TRUE
);

CREATE INDEX IF NOT EXISTS idx_sso_sessions_user ON workspace.sso_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_sso_sessions_active ON workspace.sso_sessions(is_active) WHERE is_active = TRUE;


-- =============================================
-- 7. Audit Log Enhancements
-- =============================================
ALTER TABLE workspace.audit_logs
ADD COLUMN IF NOT EXISTS ip_address INET,
ADD COLUMN IF NOT EXISTS user_agent TEXT,
ADD COLUMN IF NOT EXISTS request_id UUID,
ADD COLUMN IF NOT EXISTS duration_ms INTEGER;


-- =============================================
-- 8. Update tenant_users table for additional fields
-- =============================================
ALTER TABLE workspace.tenant_users
ADD COLUMN IF NOT EXISTS job_title VARCHAR(255),
ADD COLUMN IF NOT EXISTS manager_id UUID REFERENCES workspace.tenant_users(id),
ADD COLUMN IF NOT EXISTS office_location VARCHAR(255),
ADD COLUMN IF NOT EXISTS employee_id VARCHAR(100),
ADD COLUMN IF NOT EXISTS hire_date DATE,
ADD COLUMN IF NOT EXISTS profile_picture_url TEXT,
ADD COLUMN IF NOT EXISTS timezone VARCHAR(50) DEFAULT 'UTC',
ADD COLUMN IF NOT EXISTS locale VARCHAR(10) DEFAULT 'en-US',
ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}'::jsonb;


-- =============================================
-- Create indexes for better query performance
-- =============================================
CREATE INDEX IF NOT EXISTS idx_tenant_users_manager ON workspace.tenant_users(manager_id);
CREATE INDEX IF NOT EXISTS idx_tenant_users_department ON workspace.tenant_users(department);
CREATE INDEX IF NOT EXISTS idx_tenant_users_role ON workspace.tenant_users(role);


-- =============================================
-- Function to get user's full org unit path
-- =============================================
CREATE OR REPLACE FUNCTION workspace.get_org_unit_path(unit_id UUID)
RETURNS TEXT AS $$
DECLARE
    result TEXT;
BEGIN
    WITH RECURSIVE org_path AS (
        SELECT id, name, parent_id, name::TEXT as path
        FROM workspace.org_units
        WHERE id = unit_id

        UNION ALL

        SELECT o.id, o.name, o.parent_id, o.name || '/' || p.path
        FROM workspace.org_units o
        JOIN org_path p ON o.id = p.parent_id
    )
    SELECT '/' || path INTO result
    FROM org_path
    WHERE parent_id IS NULL;

    RETURN result;
END;
$$ LANGUAGE plpgsql;


-- =============================================
-- Function to get all users in an org unit (including children)
-- =============================================
CREATE OR REPLACE FUNCTION workspace.get_org_unit_users(unit_id UUID)
RETURNS TABLE(user_id UUID, email VARCHAR, name VARCHAR, org_unit_path TEXT) AS $$
BEGIN
    RETURN QUERY
    WITH RECURSIVE child_units AS (
        SELECT id FROM workspace.org_units WHERE id = unit_id
        UNION ALL
        SELECT o.id FROM workspace.org_units o
        JOIN child_units c ON o.parent_id = c.id
    )
    SELECT tu.id, tu.email, tu.name, workspace.get_org_unit_path(tu.org_unit_id)
    FROM workspace.tenant_users tu
    WHERE tu.org_unit_id IN (SELECT id FROM child_units);
END;
$$ LANGUAGE plpgsql;
