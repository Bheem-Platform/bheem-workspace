-- Migration: Gmail-like Features (Categories, Snooze, Importance)
-- Created: 2024-01-15

-- ================================================
-- Email Categories (Primary, Social, Updates, Promotions)
-- ================================================

CREATE TABLE IF NOT EXISTS workspace.email_categories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,
    message_id VARCHAR(500) NOT NULL,
    category VARCHAR(20) NOT NULL DEFAULT 'primary',
    auto_categorized BOOLEAN DEFAULT TRUE,
    categorized_by VARCHAR(50) DEFAULT 'rule',
    confidence INTEGER DEFAULT 100,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(user_id, message_id)
);

CREATE INDEX IF NOT EXISTS idx_email_categories_user ON workspace.email_categories(user_id);
CREATE INDEX IF NOT EXISTS idx_email_categories_message ON workspace.email_categories(message_id);
CREATE INDEX IF NOT EXISTS idx_email_categories_category ON workspace.email_categories(category);

-- ================================================
-- Email Category Rules (Auto-categorization)
-- ================================================

CREATE TABLE IF NOT EXISTS workspace.email_category_rules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,
    name VARCHAR(255) NOT NULL,
    is_enabled BOOLEAN DEFAULT TRUE,
    is_system BOOLEAN DEFAULT FALSE,
    priority INTEGER DEFAULT 0,
    category VARCHAR(20) NOT NULL,
    conditions JSONB NOT NULL DEFAULT '{}',
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_email_category_rules_user ON workspace.email_category_rules(user_id);
CREATE INDEX IF NOT EXISTS idx_email_category_rules_category ON workspace.email_category_rules(category);

-- Insert default system rules for categorization
INSERT INTO workspace.email_category_rules (user_id, name, is_system, category, conditions, priority) VALUES
    ('00000000-0000-0000-0000-000000000000', 'Social Networks', TRUE, 'social',
     '{"from_domains": ["facebook.com", "twitter.com", "linkedin.com", "instagram.com", "pinterest.com", "tiktok.com", "snapchat.com", "reddit.com", "tumblr.com", "whatsapp.com", "telegram.org", "discord.com"]}', 10),
    ('00000000-0000-0000-0000-000000000000', 'Updates & Notifications', TRUE, 'updates',
     '{"from_domains": ["github.com", "gitlab.com", "bitbucket.org", "jira.atlassian.com", "trello.com", "asana.com", "slack.com", "notion.so", "figma.com", "vercel.com", "netlify.com", "aws.amazon.com", "cloud.google.com"], "subject_contains": ["notification", "update", "alert", "digest", "summary", "report"]}', 20),
    ('00000000-0000-0000-0000-000000000000', 'Promotions & Marketing', TRUE, 'promotions',
     '{"headers": {"list-unsubscribe": true}, "subject_contains": ["sale", "offer", "discount", "promo", "deal", "% off", "limited time", "exclusive", "newsletter"]}', 30),
    ('00000000-0000-0000-0000-000000000000', 'Forums & Mailing Lists', TRUE, 'forums',
     '{"headers": {"list-id": true, "mailing-list": true}, "from_contains": ["noreply", "no-reply", "donotreply"]}', 40)
ON CONFLICT DO NOTHING;

-- ================================================
-- Snoozed Emails
-- ================================================

CREATE TABLE IF NOT EXISTS workspace.snoozed_emails (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,
    message_id VARCHAR(500) NOT NULL,
    snooze_until TIMESTAMP NOT NULL,
    original_folder VARCHAR(255) DEFAULT 'INBOX',
    status VARCHAR(20) DEFAULT 'snoozed',
    subject TEXT,
    sender VARCHAR(320),
    snippet TEXT,
    created_at TIMESTAMP DEFAULT NOW(),
    unsnoozed_at TIMESTAMP,
    UNIQUE(user_id, message_id)
);

CREATE INDEX IF NOT EXISTS idx_snoozed_emails_user ON workspace.snoozed_emails(user_id);
CREATE INDEX IF NOT EXISTS idx_snoozed_emails_snooze_until ON workspace.snoozed_emails(snooze_until);
CREATE INDEX IF NOT EXISTS idx_snoozed_emails_status ON workspace.snoozed_emails(status);

-- ================================================
-- Email Importance (Starred, Important)
-- ================================================

CREATE TABLE IF NOT EXISTS workspace.email_importance (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,
    message_id VARCHAR(500) NOT NULL,
    is_starred BOOLEAN DEFAULT FALSE,
    is_important BOOLEAN DEFAULT FALSE,
    auto_important BOOLEAN DEFAULT FALSE,
    importance_reason VARCHAR(100),
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(user_id, message_id)
);

CREATE INDEX IF NOT EXISTS idx_email_importance_user ON workspace.email_importance(user_id);
CREATE INDEX IF NOT EXISTS idx_email_importance_message ON workspace.email_importance(message_id);
CREATE INDEX IF NOT EXISTS idx_email_importance_starred ON workspace.email_importance(is_starred);
CREATE INDEX IF NOT EXISTS idx_email_importance_important ON workspace.email_importance(is_important);

-- ================================================
-- Mail Read Receipts
-- ================================================

CREATE TABLE IF NOT EXISTS workspace.mail_read_receipts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,
    message_id VARCHAR(500) NOT NULL,
    is_read BOOLEAN DEFAULT FALSE,
    read_at TIMESTAMP,
    read_count INTEGER DEFAULT 0,
    receipt_requested BOOLEAN DEFAULT FALSE,
    receipt_sent BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(user_id, message_id)
);

CREATE INDEX IF NOT EXISTS idx_mail_read_receipts_user ON workspace.mail_read_receipts(user_id);
CREATE INDEX IF NOT EXISTS idx_mail_read_receipts_message ON workspace.mail_read_receipts(message_id);

-- ================================================
-- Email Subscriptions (Manage Subscriptions feature)
-- ================================================

CREATE TABLE IF NOT EXISTS workspace.email_subscriptions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,
    sender_email VARCHAR(320) NOT NULL,
    sender_name VARCHAR(255),
    sender_domain VARCHAR(255) NOT NULL,
    is_subscribed BOOLEAN DEFAULT TRUE,
    unsubscribe_url TEXT,
    last_email_at TIMESTAMP,
    email_count INTEGER DEFAULT 1,
    category VARCHAR(20) DEFAULT 'promotions',
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(user_id, sender_email)
);

CREATE INDEX IF NOT EXISTS idx_email_subscriptions_user ON workspace.email_subscriptions(user_id);
CREATE INDEX IF NOT EXISTS idx_email_subscriptions_domain ON workspace.email_subscriptions(sender_domain);
CREATE INDEX IF NOT EXISTS idx_email_subscriptions_subscribed ON workspace.email_subscriptions(is_subscribed);

COMMENT ON TABLE workspace.email_categories IS 'Gmail-like email categorization (Primary, Social, Updates, Promotions)';
COMMENT ON TABLE workspace.email_category_rules IS 'Rules for auto-categorizing incoming emails';
COMMENT ON TABLE workspace.snoozed_emails IS 'Temporarily hidden emails that reappear at scheduled time';
COMMENT ON TABLE workspace.email_importance IS 'Starred and important email flags';
COMMENT ON TABLE workspace.mail_read_receipts IS 'Track email read status and receipts';
COMMENT ON TABLE workspace.email_subscriptions IS 'Manage email subscriptions and unsubscribe tracking';
