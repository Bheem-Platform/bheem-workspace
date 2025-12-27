#!/usr/bin/env python3
"""
Run database migrations for Bheem Workspace
"""
import asyncio
import os
import sys
from pathlib import Path

# Add parent directory to path for imports
sys.path.insert(0, str(Path(__file__).parent.parent))

from sqlalchemy import text
from sqlalchemy.ext.asyncio import create_async_engine


async def run_migrations():
    """Execute all SQL migration files in order"""
    from core.config import settings

    # Create async engine
    engine = create_async_engine(settings.DATABASE_URL, echo=True)

    migrations_dir = Path(__file__).parent
    migration_files = sorted(migrations_dir.glob("*.sql"))

    print(f"Found {len(migration_files)} migration files")

    async with engine.begin() as conn:
        for migration_file in migration_files:
            print(f"\nRunning migration: {migration_file.name}")

            with open(migration_file, "r") as f:
                sql = f.read()

            # Execute the SQL
            try:
                await conn.execute(text(sql))
                print(f"Successfully executed: {migration_file.name}")
            except Exception as e:
                print(f"Error executing {migration_file.name}: {e}")
                raise

    await engine.dispose()
    print("\nAll migrations completed successfully!")


if __name__ == "__main__":
    asyncio.run(run_migrations())
