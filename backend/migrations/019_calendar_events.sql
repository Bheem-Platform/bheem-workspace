-- Migration: Calendar Events for Bheem Calendar
-- Creates tables for calendar events and reminders

-- Calendar Events table
CREATE TABLE IF NOT EXISTS workspace.calendar_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    uid VARCHAR(255) UNIQUE NOT NULL,
    calendar_id UUID,
    user_id UUID NOT NULL,
    summary VARCHAR(500) NOT NULL,
    description TEXT,
    location VARCHAR(500),
    start_time TIMESTAMPTZ NOT NULL,
    end_time TIMESTAMPTZ NOT NULL,
    all_day BOOLEAN DEFAULT FALSE,
    status VARCHAR(50) DEFAULT 'confirmed',
    visibility VARCHAR(50) DEFAULT 'default',
    conference_type VARCHAR(50),
    conference_url VARCHAR(500),
    conference_data JSONB,
    recurrence_rule TEXT,
    recurrence_id VARCHAR(255),
    organizer_email VARCHAR(255),
    organizer_name VARCHAR(255),
    attendees JSONB DEFAULT '[]',
    reminders JSONB DEFAULT '[]',
    color VARCHAR(50),
    busy_status VARCHAR(50) DEFAULT 'busy',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Calendars table (if needed for calendar_id reference)
CREATE TABLE IF NOT EXISTS workspace.calendars (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,
    name VARCHAR(255) NOT NULL DEFAULT 'Primary',
    description TEXT,
    color VARCHAR(50) DEFAULT '#4F46E5',
    is_primary BOOLEAN DEFAULT FALSE,
    timezone VARCHAR(100) DEFAULT 'UTC',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, name)
);

-- Calendar Reminders table
CREATE TABLE IF NOT EXISTS workspace.calendar_reminders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,
    event_uid VARCHAR(255) NOT NULL,
    calendar_id UUID,
    event_title VARCHAR(500),
    event_start TIMESTAMPTZ NOT NULL,
    event_location VARCHAR(500),
    reminder_type VARCHAR(50) DEFAULT 'email',
    minutes_before INTEGER DEFAULT 15,
    trigger_time TIMESTAMPTZ NOT NULL,
    status VARCHAR(50) DEFAULT 'pending',
    sent_at TIMESTAMPTZ,
    error_message TEXT,
    user_email VARCHAR(255),
    user_phone VARCHAR(50),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_calendar_events_user_id ON workspace.calendar_events(user_id);
CREATE INDEX IF NOT EXISTS idx_calendar_events_start_time ON workspace.calendar_events(start_time);
CREATE INDEX IF NOT EXISTS idx_calendar_events_calendar_id ON workspace.calendar_events(calendar_id);
CREATE INDEX IF NOT EXISTS idx_calendars_user_id ON workspace.calendars(user_id);
CREATE INDEX IF NOT EXISTS idx_calendar_reminders_user_id ON workspace.calendar_reminders(user_id);
CREATE INDEX IF NOT EXISTS idx_calendar_reminders_trigger_time ON workspace.calendar_reminders(trigger_time);
CREATE INDEX IF NOT EXISTS idx_calendar_reminders_status ON workspace.calendar_reminders(status);
