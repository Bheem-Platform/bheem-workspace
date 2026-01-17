#!/usr/bin/env python3
"""
Run storage migrations for Spreadsheets, Presentations, and Drive Items
Migrations: 020, 021, 022
"""
import asyncio
import sys
import os

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from dotenv import load_dotenv
load_dotenv()

from sqlalchemy.ext.asyncio import create_async_engine
from sqlalchemy import text


async def run_sql_file(conn, filepath: str, name: str):
    """Run a SQL migration file"""
    print(f"\n{'='*60}")
    print(f"Running: {name}")
    print(f"{'='*60}")

    try:
        with open(filepath, 'r') as f:
            sql_content = f.read()

        # Split by semicolons and run each statement
        statements = [s.strip() for s in sql_content.split(';') if s.strip() and not s.strip().startswith('--')]

        success_count = 0
        skip_count = 0
        error_count = 0

        for stmt in statements:
            if not stmt or stmt.startswith('--') or stmt.upper().startswith('COMMENT'):
                continue
            try:
                await conn.execute(text(stmt))
                success_count += 1
                # Print first 60 chars of statement
                preview = stmt.replace('\n', ' ')[:60]
                print(f"  ✅ {preview}...")
            except Exception as e:
                err_str = str(e).lower()
                if 'already exists' in err_str or 'duplicate' in err_str:
                    skip_count += 1
                    preview = stmt.replace('\n', ' ')[:40]
                    print(f"  ⏭️  {preview}... (already exists)")
                else:
                    error_count += 1
                    preview = stmt.replace('\n', ' ')[:40]
                    print(f"  ❌ {preview}...")
                    print(f"      Error: {str(e)[:100]}")

        print(f"\n  Summary: {success_count} executed, {skip_count} skipped, {error_count} errors")
        return error_count == 0

    except FileNotFoundError:
        print(f"  ❌ File not found: {filepath}")
        return False
    except Exception as e:
        print(f"  ❌ Error: {e}")
        return False


async def run_migrations():
    """Run all storage migrations"""
    from core.config import settings

    db_url = settings.DATABASE_URL
    print(f"Connecting to database...")
    print(f"Host: {db_url.split('@')[-1].split('/')[0] if '@' in db_url else 'local'}")

    engine = create_async_engine(db_url, echo=False)

    migrations_dir = os.path.join(os.path.dirname(os.path.dirname(__file__)), 'migrations')

    async with engine.begin() as conn:
        print("\n" + "=" * 60)
        print("Storage Migrations for OnlyOffice Integration")
        print("=" * 60)

        # Run migrations in order
        migrations = [
            ('020_spreadsheet_storage.sql', 'Spreadsheet Storage (OnlyOffice)'),
            ('021_presentation_storage.sql', 'Presentation Storage (OnlyOffice)'),
            ('022_drive_items.sql', 'Drive Items Table'),
        ]

        results = []
        for filename, description in migrations:
            filepath = os.path.join(migrations_dir, filename)
            success = await run_sql_file(conn, filepath, description)
            results.append((filename, success))

        print("\n" + "=" * 60)
        print("Migration Results Summary")
        print("=" * 60)
        for filename, success in results:
            status = "✅ SUCCESS" if success else "❌ FAILED"
            print(f"  {filename}: {status}")

    await engine.dispose()
    print("\nMigrations complete!")


if __name__ == "__main__":
    asyncio.run(run_migrations())
