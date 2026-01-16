-- Migration: Task Lists for Google Tasks-like functionality
-- Creates task_lists and tasks tables for personal and ERP-synced tasks

-- Task Lists Table
CREATE TABLE IF NOT EXISTS workspace.task_lists (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES workspace.tenants(id) ON DELETE CASCADE,
    user_id UUID NOT NULL,

    -- List info
    name VARCHAR(255) NOT NULL,
    color VARCHAR(20) DEFAULT '#4285f4',
    icon VARCHAR(50) DEFAULT 'list',
    is_default BOOLEAN DEFAULT FALSE,
    sort_order INTEGER DEFAULT 0,

    -- Timestamps
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Indexes for task_lists
CREATE INDEX IF NOT EXISTS idx_task_lists_user ON workspace.task_lists(user_id);
CREATE INDEX IF NOT EXISTS idx_task_lists_tenant ON workspace.task_lists(tenant_id);

-- Tasks Table
CREATE TABLE IF NOT EXISTS workspace.tasks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES workspace.tenants(id) ON DELETE CASCADE,
    user_id UUID NOT NULL,
    task_list_id UUID REFERENCES workspace.task_lists(id) ON DELETE CASCADE,

    -- Task info
    title VARCHAR(500) NOT NULL,
    notes TEXT,
    due_date TIMESTAMP,
    due_time VARCHAR(5),

    -- Status
    status VARCHAR(20) DEFAULT 'needsAction',
    completed_at TIMESTAMP,

    -- Organization
    is_starred BOOLEAN DEFAULT FALSE,
    priority VARCHAR(20) DEFAULT 'normal',
    sort_order INTEGER DEFAULT 0,

    -- Parent task (for subtasks)
    parent_task_id UUID REFERENCES workspace.tasks(id) ON DELETE CASCADE,

    -- ERP Integration
    erp_task_id VARCHAR(100),
    erp_project_id VARCHAR(100),
    source VARCHAR(20) DEFAULT 'personal',

    -- Related calendar event
    calendar_event_id VARCHAR(255),

    -- Timestamps
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Indexes for tasks
CREATE INDEX IF NOT EXISTS idx_tasks_user ON workspace.tasks(user_id);
CREATE INDEX IF NOT EXISTS idx_tasks_list ON workspace.tasks(task_list_id);
CREATE INDEX IF NOT EXISTS idx_tasks_status ON workspace.tasks(status);
CREATE INDEX IF NOT EXISTS idx_tasks_due ON workspace.tasks(due_date);
CREATE INDEX IF NOT EXISTS idx_tasks_starred ON workspace.tasks(is_starred);
CREATE INDEX IF NOT EXISTS idx_tasks_erp ON workspace.tasks(erp_task_id);
CREATE INDEX IF NOT EXISTS idx_tasks_parent ON workspace.tasks(parent_task_id);

-- Comments
COMMENT ON TABLE workspace.task_lists IS 'User task lists (My Tasks, custom lists)';
COMMENT ON TABLE workspace.tasks IS 'Individual tasks with ERP integration support';
