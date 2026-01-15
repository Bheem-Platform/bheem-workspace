-- Migration: Add ERP Sales Integration Columns
-- Version: 016
-- Date: 2026-01-15
-- Description: Add columns for complete ERP Sales integration (Lead, Sales Order, Invoice tracking)

-- ============================================
-- TENANT TABLE UPDATES - Sales Tracking
-- ============================================

-- Add CRM Lead tracking column
ALTER TABLE workspace.tenants ADD COLUMN IF NOT EXISTS erp_lead_id UUID;

-- Add Sales Order tracking column
ALTER TABLE workspace.tenants ADD COLUMN IF NOT EXISTS erp_sales_order_id UUID;

-- Add Sales Invoice tracking column
ALTER TABLE workspace.tenants ADD COLUMN IF NOT EXISTS erp_invoice_id UUID;

-- Add Sales Customer ID (separate from CRM contact)
ALTER TABLE workspace.tenants ADD COLUMN IF NOT EXISTS erp_sales_customer_id UUID;

-- Create indexes for ERP sales columns
CREATE INDEX IF NOT EXISTS idx_tenants_erp_lead ON workspace.tenants(erp_lead_id);
CREATE INDEX IF NOT EXISTS idx_tenants_erp_sales_order ON workspace.tenants(erp_sales_order_id);
CREATE INDEX IF NOT EXISTS idx_tenants_erp_invoice ON workspace.tenants(erp_invoice_id);
CREATE INDEX IF NOT EXISTS idx_tenants_erp_sales_customer ON workspace.tenants(erp_sales_customer_id);

-- Add comments for documentation
COMMENT ON COLUMN workspace.tenants.erp_lead_id IS 'Reference to ERP crm.leads.id - Lead created at signup';
COMMENT ON COLUMN workspace.tenants.erp_sales_order_id IS 'Reference to ERP sales.orders.id - Most recent sales order';
COMMENT ON COLUMN workspace.tenants.erp_invoice_id IS 'Reference to ERP sales.invoices.id - Most recent invoice';
COMMENT ON COLUMN workspace.tenants.erp_sales_customer_id IS 'Reference to ERP sales.customers.id - Sales customer for billing';

-- ============================================
-- TENANT_USERS TABLE UPDATES - User ERP Sync
-- ============================================

-- Add Passport user ID for SSO tracking
ALTER TABLE workspace.tenant_users ADD COLUMN IF NOT EXISTS passport_user_id VARCHAR(100);

-- Add ERP sync timestamp
ALTER TABLE workspace.tenant_users ADD COLUMN IF NOT EXISTS erp_synced_at TIMESTAMP;

-- Create index for passport user lookup
CREATE INDEX IF NOT EXISTS idx_tenant_users_passport ON workspace.tenant_users(passport_user_id);

-- Add comments for documentation
COMMENT ON COLUMN workspace.tenant_users.passport_user_id IS 'Bheem Passport user ID for SSO linkage';
COMMENT ON COLUMN workspace.tenant_users.erp_synced_at IS 'Last sync timestamp with ERP';

-- ============================================
-- ERP SYNC LOG TABLE (for tracking sync operations)
-- ============================================

CREATE TABLE IF NOT EXISTS workspace.erp_sync_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES workspace.tenants(id),
    user_id UUID,
    sync_type VARCHAR(50) NOT NULL,  -- 'lead_create', 'customer_create', 'user_sync', 'order_create', 'invoice_create'
    erp_entity_type VARCHAR(50),     -- 'lead', 'customer', 'user', 'employee', 'order', 'invoice'
    erp_entity_id VARCHAR(100),      -- ID of created entity in ERP
    status VARCHAR(20) NOT NULL,     -- 'success', 'failed', 'partial'
    error_message TEXT,
    request_data JSONB,
    response_data JSONB,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Create indexes for ERP sync log
CREATE INDEX IF NOT EXISTS idx_erp_sync_log_tenant ON workspace.erp_sync_log(tenant_id);
CREATE INDEX IF NOT EXISTS idx_erp_sync_log_type ON workspace.erp_sync_log(sync_type);
CREATE INDEX IF NOT EXISTS idx_erp_sync_log_status ON workspace.erp_sync_log(status);
CREATE INDEX IF NOT EXISTS idx_erp_sync_log_created ON workspace.erp_sync_log(created_at);

COMMENT ON TABLE workspace.erp_sync_log IS 'Audit log for ERP synchronization operations';

-- ============================================
-- MIGRATION COMPLETE
-- ============================================
