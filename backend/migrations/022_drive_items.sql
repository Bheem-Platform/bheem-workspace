-- Migration 022: Drive Items
-- Creates drive_items table for linking forms, sheets, slides, etc. to Drive view

-- =============================================
-- Drive Items (unified view for Drive)
-- =============================================
CREATE TABLE IF NOT EXISTS workspace.drive_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES workspace.tenants(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    item_type VARCHAR(50) NOT NULL,  -- form, sheet, slide, video, doc, folder
    linked_item_id UUID,  -- Reference to the actual item (form_id, spreadsheet_id, etc.)
    parent_folder_id UUID,  -- For folder hierarchy
    is_starred BOOLEAN DEFAULT FALSE,
    is_trashed BOOLEAN DEFAULT FALSE,
    trashed_at TIMESTAMP WITH TIME ZONE,
    created_by UUID NOT NULL REFERENCES workspace.tenant_users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for efficient queries
CREATE INDEX IF NOT EXISTS idx_drive_items_tenant ON workspace.drive_items(tenant_id);
CREATE INDEX IF NOT EXISTS idx_drive_items_type ON workspace.drive_items(item_type);
CREATE INDEX IF NOT EXISTS idx_drive_items_linked ON workspace.drive_items(linked_item_id);
CREATE INDEX IF NOT EXISTS idx_drive_items_parent ON workspace.drive_items(parent_folder_id);
CREATE INDEX IF NOT EXISTS idx_drive_items_owner ON workspace.drive_items(created_by);
CREATE INDEX IF NOT EXISTS idx_drive_items_starred ON workspace.drive_items(tenant_id, is_starred) WHERE is_starred = TRUE;

-- Unique constraint to prevent duplicate links
CREATE UNIQUE INDEX IF NOT EXISTS idx_drive_items_unique_link
ON workspace.drive_items(tenant_id, linked_item_id, item_type)
WHERE linked_item_id IS NOT NULL;
