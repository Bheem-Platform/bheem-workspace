-- Phase 2: Productivity Suite
-- Migration for: Bheem Sheets, Slides, and Forms

-- =============================================
-- 1. Spreadsheets (Bheem Sheets)
-- =============================================
CREATE TABLE IF NOT EXISTS workspace.spreadsheets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES workspace.tenants(id) ON DELETE CASCADE,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    folder_id UUID,  -- Optional folder organization
    is_starred BOOLEAN DEFAULT FALSE,
    is_deleted BOOLEAN DEFAULT FALSE,
    deleted_at TIMESTAMP WITH TIME ZONE,
    created_by UUID NOT NULL REFERENCES workspace.tenant_users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_spreadsheets_tenant ON workspace.spreadsheets(tenant_id);
CREATE INDEX IF NOT EXISTS idx_spreadsheets_owner ON workspace.spreadsheets(created_by);
CREATE INDEX IF NOT EXISTS idx_spreadsheets_folder ON workspace.spreadsheets(folder_id);

-- Worksheets (tabs within spreadsheets)
CREATE TABLE IF NOT EXISTS workspace.worksheets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    spreadsheet_id UUID NOT NULL REFERENCES workspace.spreadsheets(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL DEFAULT 'Sheet1',
    sheet_index INTEGER NOT NULL DEFAULT 0,
    data JSONB DEFAULT '{}'::jsonb,  -- Cell data, formatting, etc.
    row_count INTEGER DEFAULT 1000,
    column_count INTEGER DEFAULT 26,
    color VARCHAR(20),  -- Tab color
    is_hidden BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_worksheets_spreadsheet ON workspace.worksheets(spreadsheet_id);

-- Spreadsheet sharing
CREATE TABLE IF NOT EXISTS workspace.spreadsheet_shares (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    spreadsheet_id UUID NOT NULL REFERENCES workspace.spreadsheets(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES workspace.tenant_users(id) ON DELETE CASCADE,
    permission VARCHAR(20) NOT NULL DEFAULT 'view',  -- view, comment, edit
    created_by UUID,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(spreadsheet_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_spreadsheet_shares_user ON workspace.spreadsheet_shares(user_id);


-- =============================================
-- 2. Presentations (Bheem Slides)
-- =============================================
CREATE TABLE IF NOT EXISTS workspace.presentations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES workspace.tenants(id) ON DELETE CASCADE,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    folder_id UUID,
    theme JSONB DEFAULT '{
        "font_heading": "Arial",
        "font_body": "Arial",
        "color_primary": "#1a73e8",
        "color_secondary": "#34a853",
        "color_background": "#ffffff"
    }'::jsonb,
    is_starred BOOLEAN DEFAULT FALSE,
    is_deleted BOOLEAN DEFAULT FALSE,
    deleted_at TIMESTAMP WITH TIME ZONE,
    created_by UUID NOT NULL REFERENCES workspace.tenant_users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_presentations_tenant ON workspace.presentations(tenant_id);
CREATE INDEX IF NOT EXISTS idx_presentations_owner ON workspace.presentations(created_by);

-- Slides within presentations
CREATE TABLE IF NOT EXISTS workspace.slides (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    presentation_id UUID NOT NULL REFERENCES workspace.presentations(id) ON DELETE CASCADE,
    slide_index INTEGER NOT NULL DEFAULT 0,
    layout VARCHAR(50) DEFAULT 'blank',  -- title, title_content, two_column, blank, etc.
    content JSONB DEFAULT '{}'::jsonb,  -- Elements: text boxes, images, shapes, etc.
    speaker_notes TEXT,
    transition JSONB,  -- Transition settings
    background JSONB,  -- Background settings
    is_hidden BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_slides_presentation ON workspace.slides(presentation_id);
CREATE INDEX IF NOT EXISTS idx_slides_index ON workspace.slides(presentation_id, slide_index);

-- Presentation sharing
CREATE TABLE IF NOT EXISTS workspace.presentation_shares (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    presentation_id UUID NOT NULL REFERENCES workspace.presentations(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES workspace.tenant_users(id) ON DELETE CASCADE,
    permission VARCHAR(20) NOT NULL DEFAULT 'view',  -- view, comment, edit
    created_by UUID,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(presentation_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_presentation_shares_user ON workspace.presentation_shares(user_id);


-- =============================================
-- 3. Forms (Bheem Forms)
-- =============================================
CREATE TABLE IF NOT EXISTS workspace.forms (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES workspace.tenants(id) ON DELETE CASCADE,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    folder_id UUID,
    settings JSONB DEFAULT '{
        "collect_email": false,
        "limit_responses": false,
        "response_limit": null,
        "allow_edit_response": true,
        "show_progress_bar": true,
        "shuffle_questions": false,
        "confirmation_message": "Your response has been recorded."
    }'::jsonb,
    theme JSONB DEFAULT '{
        "color_primary": "#1a73e8",
        "color_background": "#f8f9fa",
        "font_family": "Roboto",
        "header_image": null
    }'::jsonb,
    status VARCHAR(20) DEFAULT 'draft',  -- draft, published, closed
    is_starred BOOLEAN DEFAULT FALSE,
    is_deleted BOOLEAN DEFAULT FALSE,
    deleted_at TIMESTAMP WITH TIME ZONE,
    published_at TIMESTAMP WITH TIME ZONE,
    closes_at TIMESTAMP WITH TIME ZONE,
    created_by UUID NOT NULL REFERENCES workspace.tenant_users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_forms_tenant ON workspace.forms(tenant_id);
CREATE INDEX IF NOT EXISTS idx_forms_owner ON workspace.forms(created_by);
CREATE INDEX IF NOT EXISTS idx_forms_status ON workspace.forms(status);

-- Form questions
CREATE TABLE IF NOT EXISTS workspace.form_questions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    form_id UUID NOT NULL REFERENCES workspace.forms(id) ON DELETE CASCADE,
    question_index INTEGER NOT NULL DEFAULT 0,
    question_type VARCHAR(50) NOT NULL,  -- short_text, long_text, multiple_choice, checkbox, dropdown, file, date, time, scale, grid
    title TEXT NOT NULL,
    description TEXT,
    is_required BOOLEAN DEFAULT FALSE,
    options JSONB,  -- For choice-based questions
    validation JSONB,  -- Validation rules
    settings JSONB DEFAULT '{}'::jsonb,  -- Question-specific settings
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_form_questions_form ON workspace.form_questions(form_id);
CREATE INDEX IF NOT EXISTS idx_form_questions_index ON workspace.form_questions(form_id, question_index);

-- Form responses
CREATE TABLE IF NOT EXISTS workspace.form_responses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    form_id UUID NOT NULL REFERENCES workspace.forms(id) ON DELETE CASCADE,
    respondent_email VARCHAR(255),
    respondent_user_id UUID REFERENCES workspace.tenant_users(id),
    answers JSONB NOT NULL DEFAULT '{}'::jsonb,  -- { question_id: answer }
    ip_address INET,
    user_agent TEXT,
    submitted_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    edited_at TIMESTAMP WITH TIME ZONE
);

CREATE INDEX IF NOT EXISTS idx_form_responses_form ON workspace.form_responses(form_id);
CREATE INDEX IF NOT EXISTS idx_form_responses_email ON workspace.form_responses(respondent_email);
CREATE INDEX IF NOT EXISTS idx_form_responses_submitted ON workspace.form_responses(submitted_at DESC);

-- Form sharing/collaboration
CREATE TABLE IF NOT EXISTS workspace.form_shares (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    form_id UUID NOT NULL REFERENCES workspace.forms(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES workspace.tenant_users(id) ON DELETE CASCADE,
    permission VARCHAR(20) NOT NULL DEFAULT 'view',  -- view, edit, view_responses
    created_by UUID,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(form_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_form_shares_user ON workspace.form_shares(user_id);


-- =============================================
-- 4. Folders for organization
-- =============================================
CREATE TABLE IF NOT EXISTS workspace.content_folders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES workspace.tenants(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    parent_id UUID REFERENCES workspace.content_folders(id) ON DELETE CASCADE,
    color VARCHAR(20),
    content_type VARCHAR(50) NOT NULL,  -- spreadsheets, presentations, forms, mixed
    created_by UUID NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(tenant_id, parent_id, name, content_type)
);

CREATE INDEX IF NOT EXISTS idx_content_folders_tenant ON workspace.content_folders(tenant_id);
CREATE INDEX IF NOT EXISTS idx_content_folders_parent ON workspace.content_folders(parent_id);


-- =============================================
-- 5. Templates for productivity apps
-- =============================================
CREATE TABLE IF NOT EXISTS workspace.productivity_templates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID REFERENCES workspace.tenants(id) ON DELETE CASCADE,  -- NULL = system template
    template_type VARCHAR(50) NOT NULL,  -- spreadsheet, presentation, form
    name VARCHAR(255) NOT NULL,
    description TEXT,
    thumbnail_url TEXT,
    content JSONB NOT NULL,  -- Template data
    category VARCHAR(100),
    is_public BOOLEAN DEFAULT FALSE,  -- Available to all tenants
    use_count INTEGER DEFAULT 0,
    created_by UUID,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_productivity_templates_type ON workspace.productivity_templates(template_type);
CREATE INDEX IF NOT EXISTS idx_productivity_templates_tenant ON workspace.productivity_templates(tenant_id);


-- =============================================
-- Insert default templates
-- =============================================

-- Spreadsheet templates
INSERT INTO workspace.productivity_templates (id, template_type, name, description, category, is_public, content)
VALUES
    (gen_random_uuid(), 'spreadsheet', 'Budget Tracker', 'Track your monthly income and expenses', 'Finance', TRUE,
    '{"worksheets": [{"name": "Budget", "cells": {"A1": {"value": "Month"}, "B1": {"value": "Income"}, "C1": {"value": "Expenses"}, "D1": {"value": "Balance"}}}]}'::jsonb),

    (gen_random_uuid(), 'spreadsheet', 'Project Timeline', 'Plan and track project milestones', 'Project Management', TRUE,
    '{"worksheets": [{"name": "Timeline", "cells": {"A1": {"value": "Task"}, "B1": {"value": "Start Date"}, "C1": {"value": "End Date"}, "D1": {"value": "Status"}}}]}'::jsonb),

    (gen_random_uuid(), 'spreadsheet', 'Inventory Tracker', 'Manage product inventory', 'Operations', TRUE,
    '{"worksheets": [{"name": "Inventory", "cells": {"A1": {"value": "SKU"}, "B1": {"value": "Product"}, "C1": {"value": "Quantity"}, "D1": {"value": "Price"}}}]}'::jsonb)
ON CONFLICT DO NOTHING;

-- Presentation templates
INSERT INTO workspace.productivity_templates (id, template_type, name, description, category, is_public, content)
VALUES
    (gen_random_uuid(), 'presentation', 'Business Proposal', 'Professional business proposal template', 'Business', TRUE,
    '{"slides": [{"layout": "title", "content": {"title": "Business Proposal", "subtitle": "Company Name"}}, {"layout": "title_content", "content": {"title": "Executive Summary"}}]}'::jsonb),

    (gen_random_uuid(), 'presentation', 'Team Meeting', 'Weekly team meeting agenda', 'Meetings', TRUE,
    '{"slides": [{"layout": "title", "content": {"title": "Team Meeting", "subtitle": "Week of ..."}}, {"layout": "bullet_list", "content": {"title": "Agenda"}}]}'::jsonb),

    (gen_random_uuid(), 'presentation', 'Product Launch', 'New product announcement template', 'Marketing', TRUE,
    '{"slides": [{"layout": "title", "content": {"title": "Introducing...", "subtitle": "Product Name"}}, {"layout": "title_content", "content": {"title": "Key Features"}}]}'::jsonb)
ON CONFLICT DO NOTHING;

-- Form templates
INSERT INTO workspace.productivity_templates (id, template_type, name, description, category, is_public, content)
VALUES
    (gen_random_uuid(), 'form', 'Event Registration', 'Collect attendee information', 'Events', TRUE,
    '{"questions": [{"type": "short_text", "title": "Full Name", "required": true}, {"type": "short_text", "title": "Email", "required": true}, {"type": "multiple_choice", "title": "Session Preference", "options": ["Morning", "Afternoon"]}]}'::jsonb),

    (gen_random_uuid(), 'form', 'Feedback Survey', 'Gather customer feedback', 'Surveys', TRUE,
    '{"questions": [{"type": "scale", "title": "How satisfied are you?", "required": true}, {"type": "long_text", "title": "What could we improve?"}]}'::jsonb),

    (gen_random_uuid(), 'form', 'Job Application', 'Collect job applications', 'HR', TRUE,
    '{"questions": [{"type": "short_text", "title": "Full Name", "required": true}, {"type": "short_text", "title": "Email", "required": true}, {"type": "file", "title": "Resume", "required": true}, {"type": "long_text", "title": "Cover Letter"}]}'::jsonb)
ON CONFLICT DO NOTHING;
