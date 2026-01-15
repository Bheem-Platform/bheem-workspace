#!/usr/bin/env python3
"""
Run database migrations for Bheem Workspace
"""
import asyncio
import os
import sys
import re
from pathlib import Path

# Add parent directory to path for imports
sys.path.insert(0, str(Path(__file__).parent.parent))

from sqlalchemy import text
from sqlalchemy.ext.asyncio import create_async_engine


def split_sql_statements(sql_content: str) -> list:
    """
    Split SQL content into individual statements.
    Handles functions/triggers that contain semicolons inside $$ blocks.
    """
    statements = []
    current_statement = []
    in_dollar_quote = False

    lines = sql_content.split('\n')

    for line in lines:
        # Skip empty lines and comments at the start of statements
        stripped = line.strip()
        if not current_statement and (not stripped or stripped.startswith('--')):
            continue

        # Check for $$ delimiters (used in function bodies)
        dollar_count = line.count('$$')
        if dollar_count % 2 == 1:
            in_dollar_quote = not in_dollar_quote

        current_statement.append(line)

        # If we're not in a $$ block and line ends with semicolon, statement is complete
        if not in_dollar_quote and stripped.endswith(';'):
            statement = '\n'.join(current_statement).strip()
            if statement and not statement.startswith('--'):
                statements.append(statement)
            current_statement = []

    # Handle any remaining statement
    if current_statement:
        statement = '\n'.join(current_statement).strip()
        if statement and not statement.startswith('--'):
            statements.append(statement)

    return statements


async def run_migrations():
    """Execute all SQL migration files in order"""
    from core.config import settings

    # Create async engine
    engine = create_async_engine(settings.DATABASE_URL, echo=False)

    migrations_dir = Path(__file__).parent
    migration_files = sorted(migrations_dir.glob("*.sql"))

    print(f"Found {len(migration_files)} migration files")

    total_success = 0
    total_skipped = 0
    total_errors = 0

    for migration_file in migration_files:
        print(f"\n{'='*60}")
        print(f"Running migration: {migration_file.name}")
        print('='*60)

        with open(migration_file, "r") as f:
            sql_content = f.read()

        # Split into individual statements
        statements = split_sql_statements(sql_content)
        print(f"Found {len(statements)} statements")

        for i, statement in enumerate(statements, 1):
            # Skip empty statements
            if not statement.strip():
                continue

            # Get first 80 chars for display
            preview = statement[:80].replace('\n', ' ')
            if len(statement) > 80:
                preview += '...'

            # Use a new connection for each statement to avoid transaction issues
            try:
                async with engine.begin() as conn:
                    await conn.execute(text(statement))
                print(f"  [{i}/{len(statements)}] OK: {preview}")
                total_success += 1
            except Exception as e:
                error_msg = str(e).lower()
                # Check if it's a non-critical error we can skip
                skip_errors = [
                    'already exists',
                    'duplicate',
                    'does not exist',
                    'cannot drop',
                    'is not a table',
                    'no such',
                    'multiple primary keys',
                    'must be owner',
                    'permission denied'
                ]
                if any(skip_err in error_msg for skip_err in skip_errors):
                    print(f"  [{i}/{len(statements)}] SKIP: {preview}")
                    total_skipped += 1
                else:
                    print(f"  [{i}/{len(statements)}] ERROR: {preview}")
                    print(f"      Error: {str(e)[:300]}")
                    total_errors += 1
                    # Continue with next statement instead of failing completely

        print(f"Completed: {migration_file.name}")

    await engine.dispose()
    print(f"\n{'='*60}")
    print(f"Migration Summary:")
    print(f"  Successful: {total_success}")
    print(f"  Skipped:    {total_skipped}")
    print(f"  Errors:     {total_errors}")
    print('='*60)

    if total_errors > 0:
        print("\nWARNING: Some migrations had errors. Review above output.")


if __name__ == "__main__":
    asyncio.run(run_migrations())
