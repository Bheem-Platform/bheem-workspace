#!/usr/bin/env python3
"""
Bheem Workspace - Internal Tenant Provisioning Script
Creates workspace tenants for all Bheemverse subsidiaries (BHM001-BHM008)

Usage:
    cd /home/coder/bheem-workspace/backend
    source venv/bin/activate
    python scripts/provision_internal_tenants.py

Or provision a single company:
    python scripts/provision_internal_tenants.py BHM001
"""
import asyncio
import sys
import os

# Add parent directory to path for imports
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from dotenv import load_dotenv
load_dotenv()

from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker
from sqlalchemy import text

from services.internal_workspace_service import (
    InternalTenantProvisioner,
    BHEEMVERSE_COMPANY_CODES,
    BHEEMVERSE_COMPANY_NAMES
)
from core.config import settings


async def run_migrations(session: AsyncSession):
    """Run the ERP integration migration if tables don't have the new columns"""
    print("\n📋 Checking database schema...")

    # Check if tenant_mode column exists
    try:
        check_query = text("""
            SELECT column_name
            FROM information_schema.columns
            WHERE table_schema = 'workspace'
              AND table_name = 'tenants'
              AND column_name = 'tenant_mode'
        """)
        result = await session.execute(check_query)
        row = result.fetchone()

        if not row:
            print("   Running ERP integration migration...")
            # Read and execute migration file
            migration_path = os.path.join(
                os.path.dirname(os.path.dirname(os.path.abspath(__file__))),
                "migrations",
                "002_add_erp_integration_columns.sql"
            )

            if os.path.exists(migration_path):
                with open(migration_path, 'r') as f:
                    migration_sql = f.read()

                # Split and execute statements
                for statement in migration_sql.split(';'):
                    statement = statement.strip()
                    if statement and not statement.startswith('--'):
                        try:
                            await session.execute(text(statement))
                        except Exception as e:
                            if "already exists" not in str(e).lower():
                                print(f"   Warning: {e}")

                await session.commit()
                print("   ✅ Migration completed")
            else:
                print(f"   ⚠️  Migration file not found: {migration_path}")
        else:
            print("   ✅ Schema already up to date")

    except Exception as e:
        print(f"   ⚠️  Could not check schema: {e}")


async def provision_subsidiary(session: AsyncSession, company_code: str) -> dict:
    """Provision a single subsidiary"""
    provisioner = InternalTenantProvisioner(session)
    try:
        result = await provisioner.provision_subsidiary(company_code)
        return result
    except Exception as e:
        return {
            "company_code": company_code,
            "error": str(e)
        }


async def provision_all_subsidiaries(session: AsyncSession) -> list:
    """Provision all Bheemverse subsidiaries"""
    provisioner = InternalTenantProvisioner(session)
    return await provisioner.provision_all_subsidiaries()


async def main(company_code: str = None):
    """Main provisioning function"""
    print("\n" + "=" * 60)
    print("🏢 BHEEM WORKSPACE - INTERNAL TENANT PROVISIONING")
    print("=" * 60)

    # Get database URL
    db_url = settings.DATABASE_URL
    print(f"\n📦 Database: {db_url.split('@')[-1] if '@' in db_url else db_url}")

    # Create async engine
    if db_url.startswith("sqlite"):
        # SQLite async support
        db_url = db_url.replace("sqlite://", "sqlite+aiosqlite://")

    engine = create_async_engine(db_url, echo=False)
    async_session = sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)

    async with async_session() as session:
        # Run migrations if needed
        await run_migrations(session)

        if company_code:
            # Provision single company
            code = company_code.upper()
            if code not in BHEEMVERSE_COMPANY_CODES:
                print(f"\n❌ Invalid company code: {company_code}")
                print(f"   Valid codes: {', '.join(BHEEMVERSE_COMPANY_CODES.keys())}")
                return

            print(f"\n🔧 Provisioning {code} ({BHEEMVERSE_COMPANY_NAMES.get(code)})...")
            result = await provision_subsidiary(session, code)

            if result.get("error"):
                print(f"   ❌ Error: {result['error']}")
            else:
                print(f"   ✅ Created tenant: {result.get('name')} (slug: {result.get('slug')})")
                print(f"   📍 Tenant ID: {result.get('tenant_id')}")

        else:
            # Provision all subsidiaries
            print("\n🔧 Provisioning all Bheemverse subsidiaries...")
            print("-" * 60)

            results = await provision_all_subsidiaries(session)

            success_count = 0
            error_count = 0

            for result in results:
                code = result.get("company_code", "")
                name = BHEEMVERSE_COMPANY_NAMES.get(code, code)

                if result.get("error"):
                    print(f"   ❌ {code} ({name}): {result['error']}")
                    error_count += 1
                else:
                    print(f"   ✅ {code} ({name})")
                    print(f"      └── Tenant: {result.get('name')} | Slug: {result.get('slug')}")
                    success_count += 1

            print("-" * 60)
            print(f"\n📊 Summary: {success_count} created, {error_count} errors")

    await engine.dispose()
    print("\n" + "=" * 60)
    print("✨ Provisioning complete!")
    print("=" * 60 + "\n")


def list_companies():
    """List all Bheemverse companies"""
    print("\n📋 BHEEMVERSE SUBSIDIARY COMPANIES")
    print("-" * 60)
    print(f"{'Code':<10} {'Name':<25} {'UUID'}")
    print("-" * 60)
    for code, uuid in BHEEMVERSE_COMPANY_CODES.items():
        name = BHEEMVERSE_COMPANY_NAMES.get(code, code)
        print(f"{code:<10} {name:<25} {uuid}")
    print("-" * 60)
    print()


if __name__ == "__main__":
    if len(sys.argv) > 1:
        arg = sys.argv[1].upper()
        if arg in ["--list", "-l", "LIST"]:
            list_companies()
        elif arg in ["--help", "-h", "HELP"]:
            print(__doc__)
        else:
            asyncio.run(main(arg))
    else:
        asyncio.run(main())
