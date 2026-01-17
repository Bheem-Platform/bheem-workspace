#!/usr/bin/env python3
"""Run the spreadsheet storage migration."""
import asyncio
import sys
import os
os.chdir('/home/coder/bheem-workspace/backend')
sys.path.insert(0, '/home/coder/bheem-workspace/backend')

from sqlalchemy import text
from core.database import engine

async def run_migration():
    """Execute the migration SQL."""
    migration_sql = """
    -- Add storage columns to spreadsheets table
    ALTER TABLE workspace.spreadsheets
    ADD COLUMN IF NOT EXISTS storage_path VARCHAR(500);

    ALTER TABLE workspace.spreadsheets
    ADD COLUMN IF NOT EXISTS storage_bucket VARCHAR(100);

    ALTER TABLE workspace.spreadsheets
    ADD COLUMN IF NOT EXISTS file_size BIGINT DEFAULT 0;

    ALTER TABLE workspace.spreadsheets
    ADD COLUMN IF NOT EXISTS checksum VARCHAR(64);

    ALTER TABLE workspace.spreadsheets
    ADD COLUMN IF NOT EXISTS nextcloud_path VARCHAR(500);

    ALTER TABLE workspace.spreadsheets
    ADD COLUMN IF NOT EXISTS version INTEGER DEFAULT 1;

    ALTER TABLE workspace.spreadsheets
    ADD COLUMN IF NOT EXISTS last_edited_by UUID;

    ALTER TABLE workspace.spreadsheets
    ADD COLUMN IF NOT EXISTS last_edited_at TIMESTAMP;

    ALTER TABLE workspace.spreadsheets
    ADD COLUMN IF NOT EXISTS storage_mode VARCHAR(20) DEFAULT 'external';

    ALTER TABLE workspace.spreadsheets
    ADD COLUMN IF NOT EXISTS linked_entity_type VARCHAR(50);

    ALTER TABLE workspace.spreadsheets
    ADD COLUMN IF NOT EXISTS linked_entity_id UUID;

    ALTER TABLE workspace.spreadsheets
    ADD COLUMN IF NOT EXISTS document_key VARCHAR(100);
    """

    version_table_sql = """
    CREATE TABLE IF NOT EXISTS workspace.spreadsheet_versions (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        spreadsheet_id UUID NOT NULL REFERENCES workspace.spreadsheets(id) ON DELETE CASCADE,
        version_number INTEGER NOT NULL,
        storage_path VARCHAR(500) NOT NULL,
        file_size BIGINT DEFAULT 0,
        checksum VARCHAR(64),
        created_by UUID,
        created_at TIMESTAMP DEFAULT NOW(),
        comment TEXT,
        is_current BOOLEAN DEFAULT FALSE,
        UNIQUE(spreadsheet_id, version_number)
    );
    """

    sessions_table_sql = """
    CREATE TABLE IF NOT EXISTS workspace.spreadsheet_edit_sessions (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        spreadsheet_id UUID NOT NULL REFERENCES workspace.spreadsheets(id) ON DELETE CASCADE,
        user_id UUID NOT NULL,
        document_key VARCHAR(100) NOT NULL,
        started_at TIMESTAMP DEFAULT NOW(),
        last_activity_at TIMESTAMP DEFAULT NOW(),
        ended_at TIMESTAMP,
        status VARCHAR(20) DEFAULT 'active',
        UNIQUE(document_key, user_id)
    );
    """

    indexes_sql = """
    CREATE INDEX IF NOT EXISTS idx_spreadsheets_storage_path
    ON workspace.spreadsheets(storage_path);

    CREATE INDEX IF NOT EXISTS idx_spreadsheets_storage_mode
    ON workspace.spreadsheets(storage_mode);

    CREATE INDEX IF NOT EXISTS idx_spreadsheets_linked_entity
    ON workspace.spreadsheets(linked_entity_type, linked_entity_id);

    CREATE INDEX IF NOT EXISTS idx_spreadsheets_document_key
    ON workspace.spreadsheets(document_key);

    CREATE INDEX IF NOT EXISTS idx_spreadsheet_versions_spreadsheet
    ON workspace.spreadsheet_versions(spreadsheet_id);

    CREATE INDEX IF NOT EXISTS idx_spreadsheet_sessions_spreadsheet
    ON workspace.spreadsheet_edit_sessions(spreadsheet_id);
    """

    async with engine.begin() as conn:
        print("Running spreadsheet columns migration...")
        for statement in migration_sql.split(';'):
            stmt = statement.strip()
            if stmt:
                try:
                    await conn.execute(text(stmt))
                    print(f"  OK: {stmt[:60]}...")
                except Exception as e:
                    print(f"  SKIP (may exist): {e}")

        print("\nCreating spreadsheet_versions table...")
        try:
            await conn.execute(text(version_table_sql))
            print("  OK: spreadsheet_versions table created")
        except Exception as e:
            print(f"  SKIP (may exist): {e}")

        print("\nCreating spreadsheet_edit_sessions table...")
        try:
            await conn.execute(text(sessions_table_sql))
            print("  OK: spreadsheet_edit_sessions table created")
        except Exception as e:
            print(f"  SKIP (may exist): {e}")

        print("\nCreating indexes...")
        for statement in indexes_sql.split(';'):
            stmt = statement.strip()
            if stmt:
                try:
                    await conn.execute(text(stmt))
                    print(f"  OK: Index created")
                except Exception as e:
                    print(f"  SKIP (may exist): {e}")

        print("\nMigration complete!")

if __name__ == "__main__":
    asyncio.run(run_migration())
