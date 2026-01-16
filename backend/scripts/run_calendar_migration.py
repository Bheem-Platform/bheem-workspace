#!/usr/bin/env python3
"""
Run calendar events migration using SQLAlchemy
Creates calendar_events, calendars, and calendar_reminders tables
"""
import asyncio
import sys
import os

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from dotenv import load_dotenv
load_dotenv()

from sqlalchemy.ext.asyncio import create_async_engine
from sqlalchemy import text

async def run_migration():
    """Run the calendar events migration"""
    from core.config import settings

    db_url = settings.DATABASE_URL
    print(f"Connecting to database...")
    print(f"Host: {db_url.split('@')[-1].split('/')[0] if '@' in db_url else 'local'}")

    engine = create_async_engine(db_url, echo=False)

    async with engine.begin() as conn:
        print("\n" + "=" * 60)
        print("Running Calendar Events Migration")
        print("=" * 60)

        success_count = 0
        error_count = 0

        # Step 1: Create calendars table
        print("\n📅 Step 1: Creating workspace.calendars table...")
        try:
            await conn.execute(text("""
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
                )
            """))
            print("  ✅ Created calendars table")
            success_count += 1
        except Exception as e:
            err_str = str(e).lower()
            if "already exists" in err_str:
                print("  ⏭️  calendars table (already exists)")
                success_count += 1
            else:
                print(f"  ❌ calendars table: {str(e)}")
                error_count += 1

        # Step 2: Create calendar_events table
        print("\n📅 Step 2: Creating workspace.calendar_events table...")
        try:
            await conn.execute(text("""
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
                )
            """))
            print("  ✅ Created calendar_events table")
            success_count += 1
        except Exception as e:
            err_str = str(e).lower()
            if "already exists" in err_str:
                print("  ⏭️  calendar_events table (already exists)")
                success_count += 1
            else:
                print(f"  ❌ calendar_events table: {str(e)}")
                error_count += 1

        # Step 3: Create calendar_reminders table
        print("\n📅 Step 3: Creating workspace.calendar_reminders table...")
        try:
            await conn.execute(text("""
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
                )
            """))
            print("  ✅ Created calendar_reminders table")
            success_count += 1
        except Exception as e:
            err_str = str(e).lower()
            if "already exists" in err_str:
                print("  ⏭️  calendar_reminders table (already exists)")
                success_count += 1
            else:
                print(f"  ❌ calendar_reminders table: {str(e)}")
                error_count += 1

        # Step 4: Create indexes
        print("\n📅 Step 4: Creating indexes...")
        indexes = [
            ("idx_calendar_events_user_id", "workspace.calendar_events(user_id)"),
            ("idx_calendar_events_start_time", "workspace.calendar_events(start_time)"),
            ("idx_calendar_events_calendar_id", "workspace.calendar_events(calendar_id)"),
            ("idx_calendars_user_id", "workspace.calendars(user_id)"),
            ("idx_calendar_reminders_user_id", "workspace.calendar_reminders(user_id)"),
            ("idx_calendar_reminders_trigger_time", "workspace.calendar_reminders(trigger_time)"),
            ("idx_calendar_reminders_status", "workspace.calendar_reminders(status)"),
        ]
        for idx_name, idx_target in indexes:
            try:
                await conn.execute(text(f"CREATE INDEX IF NOT EXISTS {idx_name} ON {idx_target}"))
                print(f"  ✅ Index {idx_name}")
                success_count += 1
            except Exception as e:
                err_str = str(e).lower()
                if "already exists" in err_str:
                    print(f"  ⏭️  {idx_name} (already exists)")
                    success_count += 1
                else:
                    print(f"  ❌ {idx_name}: {str(e)}")
                    error_count += 1

        print("\n" + "=" * 60)
        print(f"Migration Complete: {success_count} successful, {error_count} errors")
        print("=" * 60)

    await engine.dispose()

if __name__ == "__main__":
    asyncio.run(run_migration())
