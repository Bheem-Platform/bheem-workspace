-- Migration: Enterprise AI Features
-- Phase 4: Enterprise Features

-- AI Conversations Table
CREATE TABLE IF NOT EXISTS workspace.ai_conversations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES workspace.tenants(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES workspace.tenant_users(id) ON DELETE CASCADE,

    -- Conversation context
    title VARCHAR(500),
    context_type VARCHAR(50), -- general, email, document, spreadsheet, etc.
    context_id UUID,

    -- Messages stored as JSONB array
    messages JSONB DEFAULT '[]',
    -- [{"role": "user", "content": "...", "timestamp": "..."}, {"role": "assistant", ...}]

    -- Stats
    message_count INTEGER DEFAULT 0,
    total_tokens INTEGER DEFAULT 0,

    -- Status
    is_archived BOOLEAN DEFAULT FALSE,

    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_ai_conversations_user ON workspace.ai_conversations(user_id);
CREATE INDEX IF NOT EXISTS idx_ai_conversations_created ON workspace.ai_conversations(created_at);
CREATE INDEX IF NOT EXISTS idx_ai_conversations_context ON workspace.ai_conversations(context_type, context_id);

-- AI Usage Log Table (for billing/analytics)
CREATE TABLE IF NOT EXISTS workspace.ai_usage_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES workspace.tenants(id) ON DELETE CASCADE,
    user_id UUID,

    -- Feature used
    feature VARCHAR(100) NOT NULL, -- chat, summarize, translate, compose, analyze
    context_type VARCHAR(50),
    context_id UUID,

    -- Usage metrics
    input_tokens INTEGER DEFAULT 0,
    output_tokens INTEGER DEFAULT 0,
    model_used VARCHAR(100),
    latency_ms INTEGER,

    -- Status
    success BOOLEAN DEFAULT TRUE,
    error_message TEXT,

    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_ai_usage_tenant ON workspace.ai_usage_log(tenant_id);
CREATE INDEX IF NOT EXISTS idx_ai_usage_user ON workspace.ai_usage_log(user_id);
CREATE INDEX IF NOT EXISTS idx_ai_usage_feature ON workspace.ai_usage_log(feature);
CREATE INDEX IF NOT EXISTS idx_ai_usage_created ON workspace.ai_usage_log(created_at);

-- Create view for AI usage statistics
CREATE OR REPLACE VIEW workspace.ai_usage_stats AS
SELECT
    tenant_id,
    feature,
    COUNT(*) as request_count,
    SUM(input_tokens) as total_input_tokens,
    SUM(output_tokens) as total_output_tokens,
    AVG(latency_ms) as avg_latency_ms,
    COUNT(CASE WHEN success = TRUE THEN 1 END) as success_count,
    COUNT(CASE WHEN success = FALSE THEN 1 END) as error_count,
    DATE_TRUNC('day', created_at) as date
FROM workspace.ai_usage_log
GROUP BY tenant_id, feature, DATE_TRUNC('day', created_at);
