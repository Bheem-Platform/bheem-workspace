-- Migration 025: One-Click Migration System
-- Creates tables for OAuth connections, migration jobs, and contacts for data migration

-- =============================================
-- Migration Connections (OAuth tokens)
-- =============================================
CREATE TABLE IF NOT EXISTS workspace.migration_connections (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES workspace.tenants(id) ON DELETE CASCADE,
    user_id UUID NOT NULL,

    -- Provider info
    provider VARCHAR(50) NOT NULL,  -- 'google', 'microsoft', 'imap'
    provider_email VARCHAR(255),     -- user@gmail.com
    provider_name VARCHAR(255),      -- "John Doe"

    -- OAuth tokens (encrypted)
    access_token TEXT,               -- Fernet encrypted
    refresh_token TEXT,              -- Fernet encrypted
    token_expiry TIMESTAMP WITH TIME ZONE,
    scopes TEXT[],

    -- IMAP credentials (for non-OAuth)
    imap_host VARCHAR(255),
    imap_port INTEGER,
    imap_username VARCHAR(255),
    imap_password TEXT,              -- Fernet encrypted
    imap_use_ssl BOOLEAN DEFAULT true,

    -- Status
    is_active BOOLEAN DEFAULT true,
    last_used_at TIMESTAMP WITH TIME ZONE,

    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,

    UNIQUE(tenant_id, provider, provider_email)
);

-- Indexes for migration_connections
CREATE INDEX IF NOT EXISTS idx_migration_connections_tenant ON workspace.migration_connections(tenant_id);
CREATE INDEX IF NOT EXISTS idx_migration_connections_user ON workspace.migration_connections(user_id);
CREATE INDEX IF NOT EXISTS idx_migration_connections_provider ON workspace.migration_connections(provider);

-- =============================================
-- Migration Jobs (track migration progress)
-- =============================================
CREATE TABLE IF NOT EXISTS workspace.migration_jobs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES workspace.tenants(id) ON DELETE CASCADE,
    user_id UUID NOT NULL,
    connection_id UUID REFERENCES workspace.migration_connections(id) ON DELETE SET NULL,

    -- Job configuration
    job_type VARCHAR(50) NOT NULL,   -- 'full', 'email', 'contacts', 'drive'
    config JSONB DEFAULT '{}',       -- Selected folders, date range, etc.

    -- Status
    status VARCHAR(50) DEFAULT 'pending',  -- pending, running, completed, failed, cancelled

    -- Progress tracking
    progress_percent INTEGER DEFAULT 0,
    current_task VARCHAR(255),

    -- Item counts
    items_total INTEGER DEFAULT 0,
    items_processed INTEGER DEFAULT 0,
    items_failed INTEGER DEFAULT 0,

    -- Sub-task progress: Email
    email_status VARCHAR(50) DEFAULT 'pending',
    email_progress INTEGER DEFAULT 0,
    email_total INTEGER DEFAULT 0,
    email_processed INTEGER DEFAULT 0,

    -- Sub-task progress: Contacts
    contacts_status VARCHAR(50) DEFAULT 'pending',
    contacts_progress INTEGER DEFAULT 0,
    contacts_total INTEGER DEFAULT 0,
    contacts_processed INTEGER DEFAULT 0,

    -- Sub-task progress: Drive
    drive_status VARCHAR(50) DEFAULT 'pending',
    drive_progress INTEGER DEFAULT 0,
    drive_total INTEGER DEFAULT 0,
    drive_processed INTEGER DEFAULT 0,
    bytes_transferred BIGINT DEFAULT 0,

    -- Error tracking
    errors JSONB DEFAULT '[]',

    -- Timestamps
    started_at TIMESTAMP WITH TIME ZONE,
    completed_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for migration_jobs
CREATE INDEX IF NOT EXISTS idx_migration_jobs_tenant ON workspace.migration_jobs(tenant_id);
CREATE INDEX IF NOT EXISTS idx_migration_jobs_user ON workspace.migration_jobs(user_id);
CREATE INDEX IF NOT EXISTS idx_migration_jobs_connection ON workspace.migration_jobs(connection_id);
CREATE INDEX IF NOT EXISTS idx_migration_jobs_status ON workspace.migration_jobs(status);
CREATE INDEX IF NOT EXISTS idx_migration_jobs_created ON workspace.migration_jobs(created_at DESC);

-- =============================================
-- Contacts (imported from migration)
-- =============================================
CREATE TABLE IF NOT EXISTS workspace.contacts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES workspace.tenants(id) ON DELETE CASCADE,
    user_id UUID NOT NULL,

    -- Contact info
    email VARCHAR(255),
    first_name VARCHAR(255),
    last_name VARCHAR(255),
    display_name VARCHAR(255),
    phone VARCHAR(50),
    mobile VARCHAR(50),
    company VARCHAR(255),
    job_title VARCHAR(255),

    -- Additional data
    photo_url TEXT,
    notes TEXT,
    metadata JSONB DEFAULT '{}',

    -- Source tracking
    source VARCHAR(50),              -- 'google', 'microsoft', 'csv', 'manual'
    source_id VARCHAR(255),          -- External ID for deduplication

    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,

    UNIQUE(tenant_id, user_id, source, source_id)
);

-- Indexes for contacts
CREATE INDEX IF NOT EXISTS idx_contacts_tenant_user ON workspace.contacts(tenant_id, user_id);
CREATE INDEX IF NOT EXISTS idx_contacts_email ON workspace.contacts(email);
CREATE INDEX IF NOT EXISTS idx_contacts_source ON workspace.contacts(source);
CREATE INDEX IF NOT EXISTS idx_contacts_name ON workspace.contacts(first_name, last_name);
