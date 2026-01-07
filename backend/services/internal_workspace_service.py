"""
Bheem Workspace - Internal Workspace Service
Handles internal Bheemverse subsidiary tenants (BHM001-BHM008) with full ERP integration
Includes automatic workspace email provisioning for new employees
"""
from typing import List, Optional, Dict, Any
from uuid import UUID
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import text
import logging

from core.config import settings
from services.erp_client import erp_client

logger = logging.getLogger(__name__)

# Bheemverse company codes and their UUIDs (Internal Mode)
BHEEMVERSE_COMPANY_CODES = {
    "BHM001": "79f70aef-17eb-48a8-b599-2879721e8796",  # BHEEMVERSE (Parent)
    "BHM002": "4bb6da85-66ab-4707-8d65-3ffee7927e5b",  # BHEEM CLOUD
    "BHM003": "03ac8147-a3bf-455a-8d87-a04f9dbc3580",  # BHEEM FLOW
    "BHM004": "1b505aaf-981e-4155-bb97-7650827b0e12",  # SOCIAL SELLING
    "BHM005": "9fa118b2-d50a-4867-86c1-b3c532d69f70",  # MARKETPLACE
    "BHM006": "9bad628b-6d66-441b-a514-09adbbb31b3c",  # COMMUNITY
    "BHM007": "0cccce62-b3b5-4108-884e-1fb89c58001d",  # SHIELD
    "BHM008": "cafe17e8-72a3-438b-951e-7af25af4bab8",  # BHEEM ACADEMY
}

# Company names for reference
BHEEMVERSE_COMPANY_NAMES = {
    "BHM001": "BHEEMVERSE",
    "BHM002": "BHEEM CLOUD",
    "BHM003": "BHEEM FLOW",
    "BHM004": "SOCIAL SELLING",
    "BHM005": "MARKETPLACE",
    "BHM006": "COMMUNITY",
    "BHM007": "SHIELD",
    "BHM008": "BHEEM ACADEMY",
}


class InternalWorkspaceService:
    """Service for internal Bheemverse tenants with full ERP integration"""

    def __init__(self, db: AsyncSession):
        self.db = db
        self.erp = erp_client

    def is_internal_company(self, company_code: str) -> bool:
        """Check if company code is a Bheemverse subsidiary"""
        return company_code.upper() in BHEEMVERSE_COMPANY_CODES

    def get_company_id(self, company_code: str) -> Optional[str]:
        """Get company UUID from code"""
        return BHEEMVERSE_COMPANY_CODES.get(company_code.upper())

    def get_company_name(self, company_code: str) -> Optional[str]:
        """Get company name from code"""
        return BHEEMVERSE_COMPANY_NAMES.get(company_code.upper())

    def get_all_company_codes(self) -> List[str]:
        """Get all Bheemverse company codes"""
        return list(BHEEMVERSE_COMPANY_CODES.keys())

    # ═══════════════════════════════════════════════════════════════════
    # HR MODULE INTEGRATION - Employee Sync
    # ═══════════════════════════════════════════════════════════════════

    async def sync_employees(self, company_code: str, auto_provision_email: bool = True) -> dict:
        """
        Sync employees from ERP HR module to workspace users.

        For internal mode tenants, employees are automatically provisioned
        as workspace users with appropriate roles. If auto_provision_email is True,
        workspace emails are automatically generated and mailboxes created.

        Args:
            company_code: Bheemverse company code (BHM001-BHM008)
            auto_provision_email: Auto-generate workspace emails for new employees

        Returns:
            Sync result with count and errors
        """
        company_id = self.get_company_id(company_code)
        if not company_id:
            raise ValueError(f"Invalid company code: {company_code}")

        # Get active employees from ERP
        employees = await self.erp.get_employees(
            company_id=company_id,
            status="ACTIVE"
        )

        synced = 0
        emails_provisioned = 0
        errors = []

        for emp in employees:
            try:
                work_email = emp.get("work_email") or emp.get("email")
                first_name = emp.get('first_name', '')
                last_name = emp.get('last_name', '')

                # Get department and job title
                department = emp.get("department", {})
                if isinstance(department, dict):
                    department_name = department.get("name", "")
                else:
                    department_name = str(department) if department else ""

                # Check if employee needs workspace email provisioning
                needs_email_provision = auto_provision_email and work_email and not work_email.endswith('@bheem.co.uk')

                if needs_email_provision:
                    # Auto-provision workspace email for new employees
                    try:
                        provision_result = await self._provision_workspace_email(
                            employee_code=emp.get("employee_code"),
                            first_name=first_name,
                            last_name=last_name,
                            current_email=work_email,
                            department=department_name,
                            erp_user_id=emp.get("user_id")
                        )
                        if provision_result.get("success"):
                            work_email = provision_result.get("workspace_email")
                            emails_provisioned += 1
                            logger.info(f"Auto-provisioned workspace email for {emp.get('employee_code')}: {work_email}")
                    except Exception as e:
                        logger.warning(f"Failed to auto-provision email for {emp.get('employee_code')}: {e}")
                        # Continue with existing email

                if not work_email:
                    errors.append({
                        "employee_id": emp.get("id"),
                        "error": "No email address"
                    })
                    continue

                await self._upsert_workspace_user(
                    email=work_email,
                    name=f"{first_name} {last_name}".strip(),
                    erp_employee_id=emp.get("id"),
                    erp_user_id=emp.get("user_id"),
                    department=department_name,
                    job_title=emp.get("job_title"),
                    company_code=company_code,
                    provisioned_by="erp_hr"
                )
                synced += 1
            except Exception as e:
                errors.append({
                    "employee_id": emp.get("id"),
                    "error": str(e)
                })

        return {
            "status": "completed",
            "synced": synced,
            "emails_provisioned": emails_provisioned,
            "errors": errors,
            "total": len(employees)
        }

    async def _provision_workspace_email(
        self,
        employee_code: str,
        first_name: str,
        last_name: str,
        current_email: str,
        department: str,
        erp_user_id: Optional[str]
    ) -> dict:
        """
        Auto-provision workspace email for a new employee.

        This method:
        1. Generates workspace email (firstname.lastname.dept@bheem.co.uk)
        2. Updates ERP database with new email
        3. Creates Mailcow mailbox

        Args:
            employee_code: Employee code from ERP
            first_name: Employee first name
            last_name: Employee last name
            current_email: Current personal email (becomes secondary)
            department: Department name for code extraction
            erp_user_id: ERP user ID for database updates

        Returns:
            Result dict with success status and workspace_email
        """
        from services.workspace_email_service import WorkspaceEmailService

        try:
            service = WorkspaceEmailService()

            # Generate workspace email
            workspace_email = service.generate_workspace_email(
                first_name=first_name,
                last_name=last_name,
                current_email=current_email
            )

            if not workspace_email:
                return {"success": False, "error": "Could not generate workspace email"}

            # Prepare employee data for migration
            employee_data = {
                'employee_code': employee_code,
                'first_name': first_name,
                'last_name': last_name,
                'current_email': current_email,
                'user_id': erp_user_id,
                'workspace_email': workspace_email
            }

            # Migrate (updates ERP + creates mailbox)
            result = service.migrate_employee(employee_data, dry_run=False)

            return {
                "success": result.get("status") == "success",
                "workspace_email": workspace_email,
                "erp_updated": result.get("erp_updated", False),
                "mailbox_created": result.get("mailbox_created", False),
                "error": result.get("error")
            }

        except Exception as e:
            logger.error(f"Failed to provision workspace email for {employee_code}: {e}")
            return {"success": False, "error": str(e)}

    async def get_employee_details(self, employee_id: str) -> Optional[dict]:
        """Get employee details from ERP"""
        return await self.erp.get_employee(employee_id)

    # ═══════════════════════════════════════════════════════════════════
    # PM MODULE INTEGRATION - Project Sync
    # ═══════════════════════════════════════════════════════════════════

    async def sync_projects(self, company_code: str) -> dict:
        """
        Sync projects from ERP PM module.

        Args:
            company_code: Bheemverse company code

        Returns:
            Sync result
        """
        company_id = self.get_company_id(company_code)
        if not company_id:
            raise ValueError(f"Invalid company code: {company_code}")

        projects = await self.erp.get_projects(
            company_id=company_id,
            status="active"
        )

        synced = 0
        errors = []

        for project in projects:
            try:
                # Get team members
                team = await self.erp.get_project_team(project.get("id"))
                team_member_ids = [m.get("employee_id") for m in team if m.get("employee_id")]

                await self._upsert_workspace_project(
                    erp_project_id=project.get("id"),
                    name=project.get("name"),
                    description=project.get("description"),
                    company_code=company_code,
                    team_members=team_member_ids
                )
                synced += 1
            except Exception as e:
                errors.append({
                    "project_id": project.get("id"),
                    "error": str(e)
                })

        return {
            "status": "completed",
            "synced": synced,
            "errors": errors,
            "total": len(projects)
        }

    # ═══════════════════════════════════════════════════════════════════
    # INTERNAL USER PROVISIONING
    # ═══════════════════════════════════════════════════════════════════

    async def _upsert_workspace_user(
        self,
        email: str,
        name: str,
        erp_employee_id: Optional[str],
        erp_user_id: Optional[str],
        department: Optional[str],
        job_title: Optional[str],
        company_code: str,
        provisioned_by: str
    ):
        """Create or update workspace user from ERP employee"""

        # Get tenant for this company
        tenant_query = text("""
            SELECT id FROM workspace.tenants
            WHERE erp_company_code = :company_code
            LIMIT 1
        """)
        tenant_result = await self.db.execute(tenant_query, {"company_code": company_code})
        tenant_row = tenant_result.fetchone()

        if not tenant_row:
            raise ValueError(f"No tenant found for company code: {company_code}")

        tenant_id = tenant_row[0]

        # Determine role from job title
        role = self._map_role_from_job_title(job_title)

        # Upsert user
        query = text("""
            INSERT INTO workspace.tenant_users (
                id, tenant_id, user_id, email, name, role,
                erp_employee_id, erp_user_id, department, job_title, provisioned_by,
                is_active, created_at, updated_at
            )
            VALUES (
                gen_random_uuid(),
                CAST(:tenant_id AS uuid),
                COALESCE(CAST(:erp_user_id AS uuid), gen_random_uuid()),
                :email,
                :name,
                :role,
                CAST(:erp_employee_id AS uuid),
                CAST(:erp_user_id AS uuid),
                :department,
                :job_title,
                :provisioned_by,
                true,
                NOW(),
                NOW()
            )
            ON CONFLICT (tenant_id, user_id) DO UPDATE SET
                email = EXCLUDED.email,
                name = EXCLUDED.name,
                department = EXCLUDED.department,
                job_title = EXCLUDED.job_title,
                erp_employee_id = EXCLUDED.erp_employee_id,
                updated_at = NOW()
        """)

        await self.db.execute(query, {
            "tenant_id": str(tenant_id),
            "email": email,
            "name": name,
            "role": role,
            "erp_employee_id": erp_employee_id,
            "erp_user_id": erp_user_id,
            "department": department,
            "job_title": job_title,
            "provisioned_by": provisioned_by
        })
        await self.db.commit()

    def _map_role_from_job_title(self, job_title: Optional[str]) -> str:
        """Map ERP job title to workspace role"""
        if not job_title:
            return "member"

        title_lower = job_title.lower()

        # Admin roles
        if any(x in title_lower for x in ["director", "ceo", "cto", "cfo", "coo", "head", "chief"]):
            return "admin"

        # Manager roles
        if any(x in title_lower for x in ["manager", "lead", "senior", "supervisor", "principal"]):
            return "manager"

        return "member"

    async def _upsert_workspace_project(
        self,
        erp_project_id: str,
        name: str,
        description: Optional[str],
        company_code: str,
        team_members: List[str]
    ):
        """Create or update workspace project from ERP"""
        # This would sync projects to a workspace projects table
        # For now, we'll just log it - projects can be implemented later
        pass


class InternalTenantProvisioner:
    """Provision internal tenants for Bheemverse subsidiaries"""

    def __init__(self, db: AsyncSession):
        self.db = db

    async def provision_subsidiary(self, company_code: str) -> dict:
        """
        Create a workspace tenant for a Bheemverse subsidiary.
        Called once during initial setup or when new subsidiary is added.

        Args:
            company_code: Bheemverse company code (BHM001-BHM008)

        Returns:
            Created tenant details
        """
        if company_code not in BHEEMVERSE_COMPANY_CODES:
            raise ValueError(f"Not a Bheemverse subsidiary: {company_code}")

        company_id = BHEEMVERSE_COMPANY_CODES[company_code]
        company_name = BHEEMVERSE_COMPANY_NAMES.get(company_code, company_code)

        # Create slug from company name
        slug = company_name.lower().replace(" ", "-")

        # Create tenant in internal mode
        query = text("""
            INSERT INTO workspace.tenants (
                id, name, slug, tenant_mode, erp_company_code, erp_company_id,
                plan, max_users, is_active, owner_email, created_at
            )
            VALUES (
                gen_random_uuid(),
                :company_name,
                :slug,
                'internal',
                :company_code,
                CAST(:company_id AS uuid),
                'enterprise',
                -1,
                true,
                :owner_email,
                NOW()
            )
            ON CONFLICT (slug) DO UPDATE SET
                erp_company_code = EXCLUDED.erp_company_code,
                erp_company_id = EXCLUDED.erp_company_id,
                tenant_mode = 'internal',
                updated_at = NOW()
            RETURNING id::text, name, slug
        """)

        result = await self.db.execute(query, {
            "company_code": company_code,
            "company_id": company_id,
            "company_name": company_name,
            "slug": slug,
            "owner_email": f"admin@{slug.replace('-', '')}.bheem.cloud"
        })
        await self.db.commit()

        row = result.fetchone()
        return {
            "tenant_id": row[0] if row else None,
            "name": row[1] if row else None,
            "slug": row[2] if row else None,
            "mode": "internal",
            "company_code": company_code
        }

    async def provision_all_subsidiaries(self) -> List[dict]:
        """
        Provision workspace tenants for all Bheemverse subsidiaries.

        Returns:
            List of provisioned tenant details
        """
        results = []
        for company_code in BHEEMVERSE_COMPANY_CODES:
            try:
                result = await self.provision_subsidiary(company_code)
                results.append(result)
            except Exception as e:
                results.append({
                    "company_code": company_code,
                    "error": str(e)
                })

        return results
