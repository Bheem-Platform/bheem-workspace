"""
Bheem Workspace - Workspace Email Migration API
================================================
API endpoints for workspace email provisioning and migration.

Endpoints:
- GET  /workspace-email/preview          - Preview email migration
- GET  /workspace-email/summary          - Get migration summary
- POST /workspace-email/migrate          - Migrate all employees
- POST /workspace-email/migrate/{code}   - Migrate single employee
- GET  /workspace-email/employees        - List all employees
"""

from typing import Optional, List
from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks, Query
from pydantic import BaseModel, Field
from datetime import datetime

from core.security import get_current_user
from services.workspace_email_service import (
    get_workspace_email_service,
    WorkspaceEmailService,
    MigrationStatus,
    COMPANY_CODES,
    WORKSPACE_DOMAIN
)

router = APIRouter(prefix="/workspace-email", tags=["Workspace Email"])


# =============================================================================
# REQUEST/RESPONSE MODELS
# =============================================================================

class EmployeePreview(BaseModel):
    """Preview of email migration for an employee"""
    employee_code: str
    name: str
    company: Optional[str]
    current_email: Optional[str]
    proposed_email: Optional[str]
    department_code: Optional[str]
    status: str
    has_password: bool


class MigrationPreviewResponse(BaseModel):
    """Response for migration preview"""
    total: int
    ready: int
    skip: int
    target_domain: str
    employees: List[EmployeePreview]


class MigrationSummaryResponse(BaseModel):
    """Summary statistics for migration"""
    total_employees: int
    ready_to_migrate: int
    will_skip: int
    by_company: dict
    target_domain: str


class MigrationRequest(BaseModel):
    """Request to start migration"""
    company_code: Optional[str] = Field(None, description="Filter by company code (BHM001-BHM009)")
    dry_run: bool = Field(True, description="If True, only preview without making changes")
    default_password: Optional[str] = Field(None, description="Default password for new mailboxes")


class SingleMigrationRequest(BaseModel):
    """Request to migrate single employee"""
    dry_run: bool = Field(True, description="If True, only preview without making changes")
    default_password: Optional[str] = Field(None, description="Password for the mailbox")
    department_override: Optional[str] = Field(None, description="Override department code")


class MigrationResultItem(BaseModel):
    """Result of single employee migration"""
    employee_code: str
    status: str
    old_email: Optional[str]
    new_email: Optional[str]
    department_code: Optional[str]
    error: Optional[str]
    steps_completed: List[str]


class BatchMigrationResponse(BaseModel):
    """Response for batch migration"""
    total: int
    successful: int
    failed: int
    skipped: int
    started_at: Optional[datetime]
    completed_at: Optional[datetime]
    results: List[MigrationResultItem]


class CompanyInfo(BaseModel):
    """Company information"""
    code: str
    id: str
    name: Optional[str] = None


# =============================================================================
# HELPER FUNCTIONS
# =============================================================================

def get_service() -> WorkspaceEmailService:
    """Dependency to get workspace email service"""
    return get_workspace_email_service()


def require_superadmin():
    """Require SuperAdmin role for sensitive operations"""
    async def check_permission(current_user: dict = Depends(get_current_user)):
        role = current_user.get("role", "").lower()
        if role != "superadmin":
            raise HTTPException(
                status_code=403,
                detail="Only SuperAdmin can perform workspace email migration"
            )
        return current_user
    return check_permission


# =============================================================================
# ENDPOINTS
# =============================================================================

@router.get("/companies", response_model=List[CompanyInfo])
async def list_companies(
    current_user: dict = Depends(require_superadmin())
):
    """
    List all available companies for migration.
    """
    return [
        CompanyInfo(code=code, id=uuid)
        for code, uuid in COMPANY_CODES.items()
    ]


@router.get("/summary", response_model=MigrationSummaryResponse)
async def get_migration_summary(
    company_code: Optional[str] = Query(None, description="Filter by company code"),
    service: WorkspaceEmailService = Depends(get_service),
    current_user: dict = Depends(require_superadmin())
):
    """
    Get summary statistics for workspace email migration.

    Shows:
    - Total employees
    - Ready to migrate
    - Will be skipped
    - Breakdown by company
    """
    try:
        summary = service.get_migration_summary(company_code)
        return MigrationSummaryResponse(**summary)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to get summary: {str(e)}")


@router.get("/preview", response_model=MigrationPreviewResponse)
async def preview_migration(
    company_code: Optional[str] = Query(None, description="Filter by company code"),
    service: WorkspaceEmailService = Depends(get_service),
    current_user: dict = Depends(require_superadmin())
):
    """
    Preview workspace email migration without making changes.

    Shows proposed new emails for each employee based on:
    - First name + Last name + Department code
    - Format: firstname.lastname.dept@bheem.co.uk
    """
    try:
        previews = service.preview_migration(company_code)

        ready_count = sum(1 for p in previews if p['status'] == 'READY')
        skip_count = len(previews) - ready_count

        return MigrationPreviewResponse(
            total=len(previews),
            ready=ready_count,
            skip=skip_count,
            target_domain=WORKSPACE_DOMAIN,
            employees=[EmployeePreview(**p) for p in previews]
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to generate preview: {str(e)}")


@router.get("/employees")
async def list_employees(
    company_code: Optional[str] = Query(None, description="Filter by company code"),
    service: WorkspaceEmailService = Depends(get_service),
    current_user: dict = Depends(require_superadmin())
):
    """
    List all employees from ERP database.

    Returns raw employee data including:
    - Employee ID and code
    - Name
    - Current email
    - Company
    - Department
    """
    try:
        employees = service.get_all_employees(company_code)
        return {
            "total": len(employees),
            "employees": [
                {
                    "employee_code": emp.employee_code,
                    "employee_id": emp.employee_id,
                    "user_id": emp.user_id,
                    "person_id": emp.person_id,
                    "name": f"{emp.first_name or ''} {emp.last_name or ''}".strip(),
                    "first_name": emp.first_name,
                    "last_name": emp.last_name,
                    "current_email": emp.current_email,
                    "username": emp.username,
                    "company_code": emp.company_code,
                    "company_name": emp.company_name,
                    "department_id": emp.department_id,
                    "job_title": emp.job_title,
                    "has_password": emp.has_password
                }
                for emp in employees
            ]
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to list employees: {str(e)}")


@router.post("/migrate", response_model=BatchMigrationResponse)
async def migrate_employees(
    request: MigrationRequest,
    background_tasks: BackgroundTasks,
    service: WorkspaceEmailService = Depends(get_service),
    current_user: dict = Depends(require_superadmin())
):
    """
    Migrate employees to workspace emails.

    **WARNING**: This operation modifies data in ERP database and creates mailboxes.

    Steps performed for each employee:
    1. Generate new workspace email (firstname.lastname.dept@bheem.co.uk)
    2. Update auth.users (username, email)
    3. Update public.contacts (move old to secondary, new as primary)
    4. Create mailbox in Mailcow

    Set `dry_run: true` to preview without making changes.
    """
    if not request.dry_run and not request.default_password:
        raise HTTPException(
            status_code=400,
            detail="default_password is required for actual migration"
        )

    try:
        result = await service.migrate_all_employees(
            company_code=request.company_code,
            dry_run=request.dry_run,
            default_password=request.default_password
        )

        return BatchMigrationResponse(
            total=result.total,
            successful=result.successful,
            failed=result.failed,
            skipped=result.skipped,
            started_at=result.started_at,
            completed_at=result.completed_at,
            results=[
                MigrationResultItem(
                    employee_code=r.employee_code,
                    status=r.status.value,
                    old_email=r.old_email,
                    new_email=r.new_email,
                    department_code=r.department_code,
                    error=r.error,
                    steps_completed=r.steps_completed
                )
                for r in result.results
            ]
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Migration failed: {str(e)}")


@router.post("/migrate/{employee_code}", response_model=MigrationResultItem)
async def migrate_single_employee(
    employee_code: str,
    request: SingleMigrationRequest,
    service: WorkspaceEmailService = Depends(get_service),
    current_user: dict = Depends(require_superadmin())
):
    """
    Migrate single employee to workspace email.

    Useful for testing or manual migration of specific employees.
    """
    if not request.dry_run and not request.default_password:
        raise HTTPException(
            status_code=400,
            detail="default_password is required for actual migration"
        )

    try:
        employee = service.get_employee_by_code(employee_code)
        if not employee:
            raise HTTPException(
                status_code=404,
                detail=f"Employee not found: {employee_code}"
            )

        result = await service.migrate_employee(
            employee=employee,
            dry_run=request.dry_run,
            default_password=request.default_password
        )

        return MigrationResultItem(
            employee_code=result.employee_code,
            status=result.status.value,
            old_email=result.old_email,
            new_email=result.new_email,
            department_code=result.department_code,
            error=result.error,
            steps_completed=result.steps_completed
        )
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Migration failed: {str(e)}")


@router.get("/department-codes")
async def list_department_codes(
    current_user: dict = Depends(require_superadmin())
):
    """
    List all available department codes for email generation.

    Shows mapping from role keywords to short codes.
    """
    from services.workspace_email_service import DEPARTMENT_MAPPING

    # Group by code
    by_code = {}
    for keyword, code in DEPARTMENT_MAPPING.items():
        if code not in by_code:
            by_code[code] = []
        by_code[code].append(keyword)

    return {
        "target_domain": WORKSPACE_DOMAIN,
        "email_format": "firstname.lastname.{dept_code}@bheem.co.uk",
        "department_codes": [
            {
                "code": code,
                "keywords": keywords,
                "example": f"john.smith.{code}@{WORKSPACE_DOMAIN}"
            }
            for code, keywords in sorted(by_code.items())
        ]
    }


@router.post("/validate-email")
async def validate_email(
    email: str = Query(..., description="Email to validate"),
    service: WorkspaceEmailService = Depends(get_service),
    current_user: dict = Depends(require_superadmin())
):
    """
    Check if an email already exists in the system.
    """
    exists = service.check_email_exists(email)
    return {
        "email": email,
        "exists": exists,
        "available": not exists
    }


@router.post("/generate-email")
async def generate_email(
    first_name: str = Query(..., description="First name"),
    last_name: str = Query(..., description="Last name"),
    current_email: Optional[str] = Query(None, description="Current email (for role extraction)"),
    department: Optional[str] = Query(None, description="Department override"),
    service: WorkspaceEmailService = Depends(get_service),
    current_user: dict = Depends(require_superadmin())
):
    """
    Generate a workspace email for given name.

    Uses the standard format: firstname.lastname.dept@bheem.co.uk
    """
    try:
        email, dept_code = service.generate_unique_email(
            first_name=first_name,
            last_name=last_name,
            current_email=current_email,
            department_override=department
        )

        return {
            "generated_email": email,
            "department_code": dept_code,
            "format": "firstname.lastname.dept@bheem.co.uk"
        }
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


# =============================================================================
# NEW EMPLOYEE PROVISIONING ENDPOINTS
# =============================================================================

class NewEmployeeProvisionRequest(BaseModel):
    """Request to provision workspace email for a new employee"""
    employee_code: str = Field(..., description="Employee code from ERP")
    first_name: str = Field(..., description="First name")
    last_name: str = Field(..., description="Last name")
    personal_email: str = Field(..., description="Personal/current email")
    department: Optional[str] = Field(None, description="Department code override (dev, mkt, admin, etc.)")
    default_password: str = Field(..., description="Password for the new mailbox")


class NewEmployeeProvisionResponse(BaseModel):
    """Response for new employee provisioning"""
    success: bool
    employee_code: str
    workspace_email: Optional[str]
    mailbox_created: bool
    erp_updated: bool
    personal_email_saved_as: str = "secondary_email"
    error: Optional[str]


@router.post("/provision-new", response_model=NewEmployeeProvisionResponse)
async def provision_new_employee(
    request: NewEmployeeProvisionRequest,
    service: WorkspaceEmailService = Depends(get_service),
    current_user: dict = Depends(require_superadmin())
):
    """
    Provision workspace email for a NEW employee.

    This endpoint is called when HR adds a new employee in ERP.

    **Workflow:**
    1. HR adds new employee in ERP with personal email
    2. Call this endpoint with employee details
    3. System generates workspace email (firstname.lastname.dept@bheem.co.uk)
    4. Creates Mailcow mailbox
    5. Updates ERP with new workspace email (old email → secondary)

    **Returns:**
    - workspace_email: The generated email (e.g., john.doe.dev@bheem.co.uk)
    - mailbox_created: Whether Mailcow mailbox was created
    - erp_updated: Whether ERP database was updated
    """
    try:
        # Generate workspace email
        workspace_email, dept_code = service.generate_unique_email(
            first_name=request.first_name,
            last_name=request.last_name,
            current_email=request.personal_email,
            department_override=request.department
        )

        # Get employee from ERP to get user_id
        employee = service.get_employee_by_code(request.employee_code)
        if not employee:
            return NewEmployeeProvisionResponse(
                success=False,
                employee_code=request.employee_code,
                workspace_email=None,
                mailbox_created=False,
                erp_updated=False,
                error=f"Employee not found in ERP: {request.employee_code}"
            )

        # Prepare employee data for migration
        employee_data = {
            'employee_code': request.employee_code,
            'first_name': request.first_name,
            'last_name': request.last_name,
            'current_email': request.personal_email,
            'user_id': employee.user_id,
            'workspace_email': workspace_email
        }

        # Perform migration (ERP update + mailbox creation)
        result = service.migrate_employee(employee_data, dry_run=False, default_password=request.default_password)

        return NewEmployeeProvisionResponse(
            success=result.get("status") == "success",
            employee_code=request.employee_code,
            workspace_email=workspace_email,
            mailbox_created=result.get("mailbox_created", False),
            erp_updated=result.get("erp_updated", False),
            error=result.get("error")
        )

    except Exception as e:
        return NewEmployeeProvisionResponse(
            success=False,
            employee_code=request.employee_code,
            workspace_email=None,
            mailbox_created=False,
            erp_updated=False,
            error=str(e)
        )


class SyncEmployeesRequest(BaseModel):
    """Request to sync employees from ERP with auto email provisioning"""
    company_code: Optional[str] = Field(None, description="Company code (BHM001-BHM009). Omit for all companies")
    auto_provision_email: bool = Field(True, description="Auto-provision workspace emails for new employees")
    default_password: str = Field(..., description="Default password for new mailboxes")


class SyncEmployeesResponse(BaseModel):
    """Response for employee sync"""
    status: str
    total_employees: int
    synced: int
    emails_provisioned: int
    errors: List[dict]


@router.post("/sync-employees", response_model=SyncEmployeesResponse)
async def sync_employees_with_email(
    request: SyncEmployeesRequest,
    service: WorkspaceEmailService = Depends(get_service),
    current_user: dict = Depends(require_superadmin())
):
    """
    Sync employees from ERP and auto-provision workspace emails.

    This endpoint:
    1. Fetches all active employees from ERP
    2. For employees WITHOUT @bheem.co.uk email:
       - Generates workspace email
       - Creates Mailcow mailbox
       - Updates ERP database
    3. Returns summary of sync operation

    **Use this for:**
    - Initial bulk provisioning
    - Periodic sync to catch new employees
    - Re-running after fixing quota issues
    """
    try:
        from services.internal_workspace_service import InternalWorkspaceService, BHEEMVERSE_COMPANY_CODES
        from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine

        # Get all employees that need provisioning
        employees = service.get_all_employees(request.company_code)

        synced = 0
        emails_provisioned = 0
        errors = []

        for emp in employees:
            try:
                # Skip if already has workspace email
                if emp.current_email and emp.current_email.endswith('@bheem.co.uk'):
                    synced += 1
                    continue

                if not request.auto_provision_email:
                    synced += 1
                    continue

                # Generate workspace email
                workspace_email, dept_code = service.generate_unique_email(
                    first_name=emp.first_name,
                    last_name=emp.last_name,
                    current_email=emp.current_email
                )

                # Prepare employee data
                employee_data = {
                    'employee_code': emp.employee_code,
                    'first_name': emp.first_name,
                    'last_name': emp.last_name,
                    'current_email': emp.current_email,
                    'user_id': emp.user_id,
                    'workspace_email': workspace_email
                }

                # Migrate
                result = service.migrate_employee(employee_data, dry_run=False, default_password=request.default_password)

                if result.get("status") == "success":
                    emails_provisioned += 1
                    synced += 1
                else:
                    errors.append({
                        "employee_code": emp.employee_code,
                        "error": result.get("error", "Unknown error")
                    })

            except Exception as e:
                errors.append({
                    "employee_code": emp.employee_code,
                    "error": str(e)
                })

        return SyncEmployeesResponse(
            status="completed",
            total_employees=len(employees),
            synced=synced,
            emails_provisioned=emails_provisioned,
            errors=errors
        )

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Sync failed: {str(e)}")


# =============================================================================
# AUTOMATIC EMPLOYEE EMAIL PROVISIONING (Webhook for ERP)
# =============================================================================

class AutoProvisionRequest(BaseModel):
    """Request for automatic email provisioning when HR adds employee"""
    employee_code: str = Field(..., description="Employee code from ERP (e.g., BHM0030)")
    department: str = Field(..., description="Department code (dev, mentor, mkt, sales, admin, media, counsel)")


class AutoProvisionResponse(BaseModel):
    """Response for automatic provisioning"""
    success: bool
    employee_code: str
    employee_name: Optional[str]
    workspace_email: Optional[str]
    personal_email: Optional[str]
    department_code: str
    mailbox_created: bool
    erp_updated: bool
    message: str
    error: Optional[str] = None


@router.post("/auto-provision", response_model=AutoProvisionResponse)
async def auto_provision_employee_email(
    request: AutoProvisionRequest,
    service: WorkspaceEmailService = Depends(get_service)
):
    """
    🚀 AUTOMATIC WORKSPACE EMAIL PROVISIONING

    Call this endpoint when HR adds a new employee in ERP.

    **Workflow:**
    1. HR adds employee in ERP with personal email
    2. ERP calls this endpoint with employee_code + department
    3. System automatically:
       - Fetches employee details from ERP
       - Generates workspace email (firstname.lastname.dept@bheem.co.uk)
       - Creates mailbox in Mailcow
       - Updates ERP: workspace email → primary, personal email → secondary

    **Example:**
    ```
    POST /api/v1/workspace-email/auto-provision
    {
        "employee_code": "BHM0030",
        "department": "dev"
    }
    ```

    **Response:**
    ```json
    {
        "success": true,
        "employee_code": "BHM0030",
        "employee_name": "John Doe",
        "workspace_email": "john.doe.dev@bheem.co.uk",
        "personal_email": "john@gmail.com",
        "department_code": "dev",
        "mailbox_created": true,
        "erp_updated": true,
        "message": "Workspace email provisioned successfully"
    }
    ```
    """
    import psycopg2
    from psycopg2.extras import RealDictCursor
    import requests

    MAILCOW_URL = "https://mail.bheem.cloud"
    MAILCOW_API_KEY = "BheemMailAPI2024Key"

    try:
        # Step 1: Fetch employee from ERP
        erp_config = {
            'host': '65.109.167.218',
            'port': 5432,
            'database': 'erp_staging',
            'user': 'postgres',
            'password': 'Bheem924924.@'
        }

        conn = psycopg2.connect(**erp_config)
        cur = conn.cursor(cursor_factory=RealDictCursor)

        cur.execute("""
            SELECT
                e.employee_code,
                e.user_id,
                p.id as person_id,
                p.first_name,
                p.last_name,
                u.username as current_username,
                c.email_primary,
                c.email_secondary
            FROM hr.employees e
            JOIN auth.users u ON e.user_id = u.id
            LEFT JOIN public.persons p ON u.person_id = p.id
            LEFT JOIN public.contacts c ON c.person_id = p.id
            WHERE e.employee_code = %s
        """, (request.employee_code,))

        emp = cur.fetchone()

        if not emp:
            return AutoProvisionResponse(
                success=False,
                employee_code=request.employee_code,
                employee_name=None,
                workspace_email=None,
                personal_email=None,
                department_code=request.department,
                mailbox_created=False,
                erp_updated=False,
                message="Employee not found",
                error=f"No employee found with code: {request.employee_code}"
            )

        # Check if already has workspace email
        if emp['email_primary'] and emp['email_primary'].endswith('@bheem.co.uk'):
            return AutoProvisionResponse(
                success=True,
                employee_code=request.employee_code,
                employee_name=f"{emp['first_name']} {emp['last_name']}",
                workspace_email=emp['email_primary'],
                personal_email=emp['email_secondary'],
                department_code=request.department,
                mailbox_created=True,
                erp_updated=True,
                message="Employee already has workspace email"
            )

        # Step 2: Generate workspace email
        first_name = (emp['first_name'] or '').lower().strip()
        last_name = (emp['last_name'] or '').lower().strip()
        dept = request.department.lower()

        if not first_name:
            first_name = 'user'
        if not last_name:
            last_name = 'unknown'

        # Clean names (remove special chars)
        import re
        first_name = re.sub(r'[^a-z]', '', first_name)
        last_name = re.sub(r'[^a-z]', '', last_name)

        workspace_email = f"{first_name}.{last_name}.{dept}@bheem.co.uk"
        local_part = f"{first_name}.{last_name}.{dept}"

        # Personal email is current username or email
        personal_email = emp['current_username'] or emp['email_primary'] or ''

        employee_name = f"{emp['first_name']} {emp['last_name']}"

        # Step 3: Create mailbox in Mailcow
        headers = {
            "X-API-Key": MAILCOW_API_KEY,
            "Content-Type": "application/json"
        }

        mailbox_data = {
            "local_part": local_part,
            "domain": "bheem.co.uk",
            "name": employee_name,
            "password": "Bheem@2024Temp!",
            "password2": "Bheem@2024Temp!",
            "quota": "1024",
            "active": "1"
        }

        mailbox_created = False
        try:
            response = requests.post(
                f"{MAILCOW_URL}/api/v1/add/mailbox",
                headers=headers,
                json=mailbox_data,
                verify=False,
                timeout=30
            )
            result = response.json()
            mailbox_created = any(r.get('type') == 'success' for r in result)
        except Exception as e:
            pass  # Continue even if mailbox creation fails

        # Step 4: Update ERP database
        erp_updated = False
        try:
            # Update auth.users username
            cur.execute("""
                UPDATE auth.users
                SET username = %s, updated_at = NOW()
                WHERE id = %s::uuid
            """, (workspace_email, str(emp['user_id'])))

            # Update or create contacts
            if emp['person_id']:
                cur.execute("""
                    SELECT id FROM public.contacts WHERE person_id = %s::uuid
                """, (str(emp['person_id']),))
                contact = cur.fetchone()

                if contact:
                    cur.execute("""
                        UPDATE public.contacts
                        SET email_primary = %s, email_secondary = %s, updated_at = NOW()
                        WHERE person_id = %s::uuid
                    """, (workspace_email, personal_email, str(emp['person_id'])))
                else:
                    cur.execute("""
                        INSERT INTO public.contacts (id, person_id, email_primary, email_secondary, created_at, updated_at)
                        VALUES (gen_random_uuid(), %s::uuid, %s, %s, NOW(), NOW())
                    """, (str(emp['person_id']), workspace_email, personal_email))

            conn.commit()
            erp_updated = True
        except Exception as e:
            conn.rollback()
            return AutoProvisionResponse(
                success=False,
                employee_code=request.employee_code,
                employee_name=employee_name,
                workspace_email=workspace_email,
                personal_email=personal_email,
                department_code=dept,
                mailbox_created=mailbox_created,
                erp_updated=False,
                message="Failed to update ERP",
                error=str(e)
            )
        finally:
            cur.close()
            conn.close()

        return AutoProvisionResponse(
            success=True,
            employee_code=request.employee_code,
            employee_name=employee_name,
            workspace_email=workspace_email,
            personal_email=personal_email,
            department_code=dept,
            mailbox_created=mailbox_created,
            erp_updated=erp_updated,
            message="Workspace email provisioned successfully"
        )

    except Exception as e:
        return AutoProvisionResponse(
            success=False,
            employee_code=request.employee_code,
            employee_name=None,
            workspace_email=None,
            personal_email=None,
            department_code=request.department,
            mailbox_created=False,
            erp_updated=False,
            message="Provisioning failed",
            error=str(e)
        )
