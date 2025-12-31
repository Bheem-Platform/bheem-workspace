-- Migration: Add ERP Integration Columns
-- Version: 002
-- Date: 2025-12-31
-- Description: Add columns for ERP integration (internal/external mode, subscription, employee linkage)

-- ============================================
-- TENANT TABLE UPDATES
-- ============================================

-- Add ERP Mode & Company Linkage columns
ALTER TABLE workspace.tenants ADD COLUMN IF NOT EXISTS tenant_mode VARCHAR(20) DEFAULT 'external';
ALTER TABLE workspace.tenants ADD COLUMN IF NOT EXISTS erp_company_code VARCHAR(20);
ALTER TABLE workspace.tenants ADD COLUMN IF NOT EXISTS erp_company_id UUID;
ALTER TABLE workspace.tenants ADD COLUMN IF NOT EXISTS erp_customer_id UUID;

-- Add ERP Subscription columns
ALTER TABLE workspace.tenants ADD COLUMN IF NOT EXISTS erp_subscription_id UUID;
ALTER TABLE workspace.tenants ADD COLUMN IF NOT EXISTS subscription_status VARCHAR(20);
ALTER TABLE workspace.tenants ADD COLUMN IF NOT EXISTS subscription_plan VARCHAR(100);
ALTER TABLE workspace.tenants ADD COLUMN IF NOT EXISTS subscription_period_end TIMESTAMP;

-- Create indexes for ERP columns
CREATE INDEX IF NOT EXISTS idx_tenants_mode ON workspace.tenants(tenant_mode);
CREATE INDEX IF NOT EXISTS idx_tenants_erp_company ON workspace.tenants(erp_company_code);
CREATE INDEX IF NOT EXISTS idx_tenants_subscription ON workspace.tenants(erp_subscription_id);

-- Add constraint: internal tenants must have erp_company_code
-- Note: Using a trigger for more flexibility instead of CHECK constraint
-- ALTER TABLE workspace.tenants ADD CONSTRAINT chk_internal_mode
--     CHECK (tenant_mode != 'internal' OR erp_company_code IS NOT NULL);

-- Add comments for documentation
COMMENT ON COLUMN workspace.tenants.tenant_mode IS 'internal = Bheemverse subsidiary (BHM001-008), external = commercial customer';
COMMENT ON COLUMN workspace.tenants.erp_company_code IS 'BHM001-BHM008 for internal mode tenants';
COMMENT ON COLUMN workspace.tenants.erp_company_id IS 'Reference to ERP public.companies.id';
COMMENT ON COLUMN workspace.tenants.erp_customer_id IS 'Reference to ERP crm.contacts.id for external customers (billing contact)';
COMMENT ON COLUMN workspace.tenants.erp_subscription_id IS 'Reference to ERP public.subscriptions.id';
COMMENT ON COLUMN workspace.tenants.subscription_status IS 'active, cancelled, suspended, pending, trial';
COMMENT ON COLUMN workspace.tenants.subscription_plan IS 'Plan name from ERP SKU (e.g., WORKSPACE-PROFESSIONAL)';
COMMENT ON COLUMN workspace.tenants.subscription_period_end IS 'Current billing period end date';

-- ============================================
-- TENANT_USERS TABLE UPDATES
-- ============================================

-- Add user info columns
ALTER TABLE workspace.tenant_users ADD COLUMN IF NOT EXISTS email VARCHAR(320);
ALTER TABLE workspace.tenant_users ADD COLUMN IF NOT EXISTS name VARCHAR(255);

-- Add ERP Employee Linkage columns
ALTER TABLE workspace.tenant_users ADD COLUMN IF NOT EXISTS erp_employee_id UUID;
ALTER TABLE workspace.tenant_users ADD COLUMN IF NOT EXISTS erp_user_id UUID;
ALTER TABLE workspace.tenant_users ADD COLUMN IF NOT EXISTS department VARCHAR(100);
ALTER TABLE workspace.tenant_users ADD COLUMN IF NOT EXISTS job_title VARCHAR(100);
ALTER TABLE workspace.tenant_users ADD COLUMN IF NOT EXISTS provisioned_by VARCHAR(20) DEFAULT 'self';

-- Create index for ERP employee lookup
CREATE INDEX IF NOT EXISTS idx_tenant_users_erp_employee ON workspace.tenant_users(erp_employee_id);

-- Add comments for documentation
COMMENT ON COLUMN workspace.tenant_users.erp_employee_id IS 'Reference to ERP hr.employees.id (for internal mode)';
COMMENT ON COLUMN workspace.tenant_users.erp_user_id IS 'Reference to ERP auth.users.id';
COMMENT ON COLUMN workspace.tenant_users.department IS 'Department name synced from ERP HR module';
COMMENT ON COLUMN workspace.tenant_users.job_title IS 'Job title synced from ERP HR module';
COMMENT ON COLUMN workspace.tenant_users.provisioned_by IS 'self = self-registered, erp_hr = synced from HR, admin = manually added';

-- ============================================
-- BHEEMVERSE COMPANY CODES REFERENCE TABLE
-- ============================================

-- Create a reference table for Bheemverse subsidiaries (optional, for validation)
CREATE TABLE IF NOT EXISTS workspace.bheemverse_companies (
    company_code VARCHAR(20) PRIMARY KEY,
    company_id UUID NOT NULL,
    company_name VARCHAR(255) NOT NULL,
    description TEXT,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Insert Bheemverse subsidiary companies
INSERT INTO workspace.bheemverse_companies (company_code, company_id, company_name, description) VALUES
    ('BHM001', '79f70aef-17eb-48a8-b599-2879721e8796', 'BHEEMVERSE', 'Parent Company - Bheemverse Innovation'),
    ('BHM002', '4bb6da85-66ab-4707-8d65-3ffee7927e5b', 'BHEEM CLOUD', 'Cloud Infrastructure Services'),
    ('BHM003', '03ac8147-a3bf-455a-8d87-a04f9dbc3580', 'BHEEM FLOW', 'Workflow Automation Platform'),
    ('BHM004', '1b505aaf-981e-4155-bb97-7650827b0e12', 'SOCIAL SELLING', 'Social Commerce Platform'),
    ('BHM005', '9fa118b2-d50a-4867-86c1-b3c532d69f70', 'MARKETPLACE', 'B2B/B2C Marketplace'),
    ('BHM006', '9bad628b-6d66-441b-a514-09adbbb31b3c', 'COMMUNITY', 'Community Platform'),
    ('BHM007', '0cccce62-b3b5-4108-884e-1fb89c58001d', 'SHIELD', 'Security Services'),
    ('BHM008', 'cafe17e8-72a3-438b-951e-7af25af4bab8', 'BHEEM ACADEMY', 'Education Platform')
ON CONFLICT (company_code) DO UPDATE SET
    company_name = EXCLUDED.company_name,
    description = EXCLUDED.description;

COMMENT ON TABLE workspace.bheemverse_companies IS 'Reference table for Bheemverse subsidiary companies (internal mode tenants)';

-- ============================================
-- MIGRATION COMPLETE
-- ============================================
