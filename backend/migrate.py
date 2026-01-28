#!/usr/bin/env python3
"""
Bheem Workspace - Database Migration Helper Script

This script provides convenient wrappers for common Alembic operations.
Run from the backend directory: python migrate.py <command>

Commands:
    status      - Show current migration status
    history     - Show migration history
    upgrade     - Apply all pending migrations
    downgrade   - Rollback one migration
    generate    - Auto-generate migration from model changes
    new         - Create empty migration for manual SQL
"""

import subprocess
import sys
import argparse


def run_alembic(args: list[str]) -> int:
    """Run an alembic command and return the exit code."""
    cmd = ["alembic"] + args
    print(f"Running: {' '.join(cmd)}")
    print("-" * 50)
    return subprocess.run(cmd).returncode


def cmd_status():
    """Show current migration status."""
    print("\n📊 Current Migration Status\n")
    run_alembic(["current"])
    print()


def cmd_history():
    """Show migration history."""
    print("\n📜 Migration History\n")
    run_alembic(["history", "--verbose"])
    print()


def cmd_upgrade(revision: str = "head"):
    """Apply migrations."""
    print(f"\n⬆️  Upgrading to: {revision}\n")
    return run_alembic(["upgrade", revision])


def cmd_downgrade(revision: str = "-1"):
    """Rollback migrations."""
    print(f"\n⬇️  Downgrading: {revision}\n")

    # Confirm dangerous operations
    if revision == "base":
        confirm = input("⚠️  This will rollback ALL migrations! Type 'yes' to confirm: ")
        if confirm.lower() != "yes":
            print("Cancelled.")
            return 1

    return run_alembic(["downgrade", revision])


def cmd_generate(message: str):
    """Auto-generate migration from model changes."""
    if not message:
        print("❌ Error: Please provide a migration message")
        print("Usage: python migrate.py generate 'add_user_preferences_table'")
        return 1

    print(f"\n🔍 Generating migration: {message}\n")
    result = run_alembic(["revision", "--autogenerate", "-m", message])

    if result == 0:
        print("\n✅ Migration generated successfully!")
        print("📝 Please review the generated migration file before applying.")
    return result


def cmd_new(message: str):
    """Create empty migration for manual SQL."""
    if not message:
        print("❌ Error: Please provide a migration message")
        print("Usage: python migrate.py new 'add_custom_index'")
        return 1

    print(f"\n📄 Creating empty migration: {message}\n")
    result = run_alembic(["revision", "-m", message])

    if result == 0:
        print("\n✅ Empty migration created!")
        print("📝 Edit the migration file to add your upgrade/downgrade logic.")
    return result


def main():
    parser = argparse.ArgumentParser(
        description="Bheem Workspace Database Migration Helper",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog=__doc__
    )

    subparsers = parser.add_subparsers(dest="command", help="Available commands")

    # Status command
    subparsers.add_parser("status", help="Show current migration status")

    # History command
    subparsers.add_parser("history", help="Show migration history")

    # Upgrade command
    upgrade_parser = subparsers.add_parser("upgrade", help="Apply migrations")
    upgrade_parser.add_argument(
        "revision",
        nargs="?",
        default="head",
        help="Target revision (default: head)"
    )

    # Downgrade command
    downgrade_parser = subparsers.add_parser("downgrade", help="Rollback migrations")
    downgrade_parser.add_argument(
        "revision",
        nargs="?",
        default="-1",
        help="Target revision or steps (default: -1)"
    )

    # Generate command
    generate_parser = subparsers.add_parser(
        "generate",
        help="Auto-generate migration from model changes"
    )
    generate_parser.add_argument("message", help="Migration description")

    # New command
    new_parser = subparsers.add_parser(
        "new",
        help="Create empty migration for manual SQL"
    )
    new_parser.add_argument("message", help="Migration description")

    args = parser.parse_args()

    if not args.command:
        parser.print_help()
        return 0

    commands = {
        "status": lambda: cmd_status(),
        "history": lambda: cmd_history(),
        "upgrade": lambda: cmd_upgrade(args.revision),
        "downgrade": lambda: cmd_downgrade(args.revision),
        "generate": lambda: cmd_generate(args.message),
        "new": lambda: cmd_new(args.message),
    }

    return commands[args.command]()


if __name__ == "__main__":
    sys.exit(main() or 0)
