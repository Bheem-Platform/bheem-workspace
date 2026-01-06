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
