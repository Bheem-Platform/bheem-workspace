#!/usr/bin/env python3
"""
Run database migrations using SQLAlchemy
Adds ERP integration columns to existing workspace schema tables
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
    """Run the ERP integration migration"""
    from core.config import settings

    db_url = settings.DATABASE_URL
    print(f"Connecting to database...")
    print(f"Host: {db_url.split('@')[-1].split('/')[0] if '@' in db_url else 'local'}")

    engine = create_async_engine(db_url, echo=False)

    async with engine.begin() as conn:
        print("\n" + "=" * 60)
        print("Running ERP Integration Migration")
        print("Using existing workspace schema")
        print("=" * 60)

        success_count = 0
        error_count = 0

        # Step 1: Add ERP columns to tenants table
        print("\n📦 Step 1: Adding ERP columns to workspace.tenants...")
        tenant_columns = [
            ("tenant_mode", "VARCHAR(20) DEFAULT 'external'"),
            ("erp_company_code", "VARCHAR(20)"),
            ("erp_company_id", "UUID"),
            ("erp_customer_id", "UUID"),
            ("erp_subscription_id", "UUID"),
            ("subscription_status", "VARCHAR(20)"),
            ("subscription_plan", "VARCHAR(100)"),
            ("subscription_period_end", "TIMESTAMP"),
        ]
        for col_name, col_type in tenant_columns:
            try:
                await conn.execute(text(f"ALTER TABLE workspace.tenants ADD COLUMN IF NOT EXISTS {col_name} {col_type}"))
                print(f"  ✅ Added {col_name}")
                success_count += 1
            except Exception as e:
                err_str = str(e).lower()
                if "already exists" in err_str or "duplicate" in err_str:
                    print(f"  ⏭️  {col_name} (already exists)")
                    success_count += 1
                else:
                    print(f"  ❌ {col_name}: {str(e)}")
                    error_count += 1

        # Step 2: Add ERP columns to tenant_users table
        print("\n📦 Step 2: Adding ERP columns to workspace.tenant_users...")
        user_columns = [
            ("email", "VARCHAR(320)"),
            ("name", "VARCHAR(255)"),
            ("erp_employee_id", "UUID"),
            ("erp_user_id", "UUID"),
            ("department", "VARCHAR(100)"),
            ("job_title", "VARCHAR(100)"),
            ("provisioned_by", "VARCHAR(20) DEFAULT 'self'"),
        ]
        for col_name, col_type in user_columns:
            try:
                await conn.execute(text(f"ALTER TABLE workspace.tenant_users ADD COLUMN IF NOT EXISTS {col_name} {col_type}"))
                print(f"  ✅ Added {col_name}")
                success_count += 1
            except Exception as e:
                err_str = str(e).lower()
                if "already exists" in err_str or "duplicate" in err_str:
                    print(f"  ⏭️  {col_name} (already exists)")
                    success_count += 1
                else:
                    print(f"  ❌ {col_name}: {str(e)}")
                    error_count += 1

        # Step 3: Create indexes
        print("\n📦 Step 3: Creating indexes...")
        indexes = [
            ("idx_tenants_mode", "workspace.tenants(tenant_mode)"),
            ("idx_tenants_erp_company", "workspace.tenants(erp_company_code)"),
            ("idx_tenants_subscription", "workspace.tenants(erp_subscription_id)"),
            ("idx_tenant_users_erp_employee", "workspace.tenant_users(erp_employee_id)"),
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

        # Step 4: Create bheemverse_companies reference table
        print("\n📦 Step 4: Creating Bheemverse companies reference table...")
        try:
            await conn.execute(text("""
                CREATE TABLE IF NOT EXISTS workspace.bheemverse_companies (
                    company_code VARCHAR(20) PRIMARY KEY,
                    company_id UUID NOT NULL,
                    company_name VARCHAR(255) NOT NULL,
                    description TEXT,
                    is_active BOOLEAN DEFAULT true,
                    created_at TIMESTAMP DEFAULT NOW()
                )
            """))
            print("  ✅ Created bheemverse_companies table")
            success_count += 1

            # Insert company data
            companies = [
                ("BHM001", "79f70aef-17eb-48a8-b599-2879721e8796", "BHEEMVERSE", "Parent Company - Bheemverse Innovation"),
                ("BHM002", "4bb6da85-66ab-4707-8d65-3ffee7927e5b", "BHEEM CLOUD", "Cloud Infrastructure Services"),
                ("BHM003", "03ac8147-a3bf-455a-8d87-a04f9dbc3580", "BHEEM FLOW", "Workflow Automation Platform"),
                ("BHM004", "1b505aaf-981e-4155-bb97-7650827b0e12", "SOCIAL SELLING", "Social Commerce Platform"),
                ("BHM005", "9fa118b2-d50a-4867-86c1-b3c532d69f70", "MARKETPLACE", "B2B/B2C Marketplace"),
                ("BHM006", "9bad628b-6d66-441b-a514-09adbbb31b3c", "COMMUNITY", "Community Platform"),
                ("BHM007", "0cccce62-b3b5-4108-884e-1fb89c58001d", "SHIELD", "Security Services"),
                ("BHM008", "cafe17e8-72a3-438b-951e-7af25af4bab8", "BHEEM ACADEMY", "Education Platform"),
            ]

            for code, uuid, name, desc in companies:
                try:
                    await conn.execute(text("""
                        INSERT INTO workspace.bheemverse_companies (company_code, company_id, company_name, description)
                        VALUES (:code, CAST(:uuid AS UUID), :name, :desc)
                        ON CONFLICT (company_code) DO UPDATE SET
                            company_name = EXCLUDED.company_name,
                            description = EXCLUDED.description
                    """), {"code": code, "uuid": uuid, "name": name, "desc": desc})
                except Exception as e:
                    pass

            print("  ✅ Inserted Bheemverse company data (8 companies)")

        except Exception as e:
            err_str = str(e).lower()
            if "already exists" in err_str:
                print("  ⏭️  bheemverse_companies table (already exists)")
                success_count += 1
            else:
                print(f"  ❌ Reference table: {str(e)}")
                error_count += 1

        print("\n" + "=" * 60)
        print(f"Migration Complete: {success_count} successful, {error_count} errors")
        print("=" * 60)

    await engine.dispose()

if __name__ == "__main__":
    asyncio.run(run_migration())
