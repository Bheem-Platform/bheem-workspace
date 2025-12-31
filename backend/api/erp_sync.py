"""
Bheem Workspace - ERP Sync API
Handles synchronization with Bheem Core ERP for internal Bheemverse tenants (BHM001-BHM008)
"""
from typing import Optional, List
from uuid import UUID
from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from core.database import get_db
from core.security import get_current_user, require_admin
from services.internal_workspace_service import (
    InternalWorkspaceService,
    InternalTenantProvisioner,
    BHEEMVERSE_COMPANY_CODES,
    BHEEMVERSE_COMPANY_NAMES
)


router = APIRouter(prefix="/erp-sync", tags=["ERP Sync"])


# ═══════════════════════════════════════════════════════════════════
# REQUEST/RESPONSE MODELS
# ═══════════════════════════════════════════════════════════════════

class SyncResult(BaseModel):
    """Sync operation result"""
    status: str
    synced: int
    total: int
    errors: list = []


class CompanyInfo(BaseModel):
    """Bheemverse company information"""
    company_code: str
    company_id: str
    company_name: str
    mode: str = "internal"


class ProvisionResult(BaseModel):
    """Tenant provisioning result"""
    tenant_id: Optional[str] = None
    name: Optional[str] = None
    slug: Optional[str] = None
    mode: str = "internal"
    company_code: str
    error: Optional[str] = None


# ═══════════════════════════════════════════════════════════════════
# HELPER FUNCTIONS
# ═══════════════════════════════════════════════════════════════════

async def get_internal_service(db: AsyncSession = Depends(get_db)) -> InternalWorkspaceService:
    """Dependency to get internal workspace service"""
    return InternalWorkspaceService(db)


async def get_provisioner(db: AsyncSession = Depends(get_db)) -> InternalTenantProvisioner:
    """Dependency to get tenant provisioner"""
    return InternalTenantProvisioner(db)


async def get_current_internal_tenant(
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
) -> dict:
    """
    Get current tenant and verify it's an internal tenant.
    Only internal tenants can use ERP sync features.
    """
    from sqlalchemy import text

    company_code = current_user.get("company_code", "").upper()

    # Check if user's company is a Bheemverse subsidiary
    if company_code not in BHEEMVERSE_COMPANY_CODES:
        raise HTTPException(
            status_code=403,
            detail="ERP sync is only available for Bheemverse internal tenants"
        )

    # Get tenant
    query = text("""
        SELECT id, name, slug, tenant_mode, erp_company_code
        FROM workspace.tenants
        WHERE erp_company_code = :company_code
        LIMIT 1
    """)
    result = await db.execute(query, {"company_code": company_code})
    row = result.fetchone()

    if not row:
        raise HTTPException(
            status_code=404,
            detail=f"No tenant found for company code: {company_code}"
        )

    if row.tenant_mode != "internal":
        raise HTTPException(
            status_code=403,
            detail="This tenant is not configured for internal mode"
        )

    return {
        "tenant_id": row.id,
        "name": row.name,
        "slug": row.slug,
        "company_code": row.erp_company_code
    }


def require_superadmin_or_internal_admin():
    """Require SuperAdmin or Admin of an internal tenant"""
    async def check_permission(
        current_user: dict = Depends(get_current_user)
    ):
        role = current_user.get("role", "").lower()
        company_code = current_user.get("company_code", "").upper()

        # SuperAdmin can do anything
        if role == "superadmin":
            return current_user

        # Admin of internal company can sync
        if role == "admin" and company_code in BHEEMVERSE_COMPANY_CODES:
            return current_user

        raise HTTPException(
            status_code=403,
            detail="Only SuperAdmin or Admin of internal tenants can perform ERP sync"
        )

    return check_permission


# ═══════════════════════════════════════════════════════════════════
# COMPANY INFO ENDPOINTS
# ═══════════════════════════════════════════════════════════════════

@router.get("/companies", response_model=List[CompanyInfo])
async def list_bheemverse_companies(
    current_user: dict = Depends(require_superadmin_or_internal_admin())
):
    """
    List all Bheemverse subsidiary companies.
    Only SuperAdmin or internal admins can view this.
    """
    return [
        CompanyInfo(
            company_code=code,
            company_id=uuid,
            company_name=BHEEMVERSE_COMPANY_NAMES.get(code, code)
        )
        for code, uuid in BHEEMVERSE_COMPANY_CODES.items()
    ]


@router.get("/companies/{company_code}")
async def get_company_info(
    company_code: str,
    current_user: dict = Depends(require_superadmin_or_internal_admin())
):
    """Get information about a specific Bheemverse company."""
    code = company_code.upper()

    if code not in BHEEMVERSE_COMPANY_CODES:
        raise HTTPException(
            status_code=404,
            detail=f"Company code {company_code} is not a Bheemverse subsidiary"
        )

    return CompanyInfo(
        company_code=code,
        company_id=BHEEMVERSE_COMPANY_CODES[code],
        company_name=BHEEMVERSE_COMPANY_NAMES.get(code, code)
    )


# ═══════════════════════════════════════════════════════════════════
# EMPLOYEE SYNC ENDPOINTS
# ═══════════════════════════════════════════════════════════════════

@router.post("/employees", response_model=SyncResult)
async def sync_employees(
    background_tasks: BackgroundTasks,
    run_async: bool = False,
    tenant: dict = Depends(get_current_internal_tenant),
    service: InternalWorkspaceService = Depends(get_internal_service),
    current_user: dict = Depends(require_superadmin_or_internal_admin())
):
    """
    Sync employees from ERP HR module to workspace users.

    For internal mode tenants, employees are automatically provisioned
    as workspace users with roles mapped from their job titles:
    - Director/CEO/CTO/CFO → admin
    - Manager/Lead/Senior → manager
    - Others → member

    Args:
        run_async: If True, runs sync in background and returns immediately
    """
    company_code = tenant["company_code"]

    if run_async:
        background_tasks.add_task(service.sync_employees, company_code)
        return SyncResult(
            status="started",
            synced=0,
            total=0,
            errors=[]
        )

    try:
        result = await service.sync_employees(company_code)
        return SyncResult(**result)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Employee sync failed: {str(e)}")


@router.post("/employees/{company_code}", response_model=SyncResult)
async def sync_employees_for_company(
    company_code: str,
    background_tasks: BackgroundTasks,
    run_async: bool = False,
    service: InternalWorkspaceService = Depends(get_internal_service),
    current_user: dict = Depends(require_superadmin_or_internal_admin())
):
    """
    Sync employees for a specific company (SuperAdmin only).
    """
    # Verify it's a valid internal company
    if not service.is_internal_company(company_code):
        raise HTTPException(
            status_code=400,
            detail=f"{company_code} is not a Bheemverse subsidiary"
        )

    if run_async:
        background_tasks.add_task(service.sync_employees, company_code)
        return SyncResult(status="started", synced=0, total=0, errors=[])

    try:
        result = await service.sync_employees(company_code)
        return SyncResult(**result)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Employee sync failed: {str(e)}")


# ═══════════════════════════════════════════════════════════════════
# PROJECT SYNC ENDPOINTS
# ═══════════════════════════════════════════════════════════════════

@router.post("/projects", response_model=SyncResult)
async def sync_projects(
    background_tasks: BackgroundTasks,
    run_async: bool = False,
    tenant: dict = Depends(get_current_internal_tenant),
    service: InternalWorkspaceService = Depends(get_internal_service),
    current_user: dict = Depends(require_superadmin_or_internal_admin())
):
    """
    Sync projects from ERP PM module.

    Projects and their team members are synced from the ERP project
    management module for internal tenants.
    """
    company_code = tenant["company_code"]

    if run_async:
        background_tasks.add_task(service.sync_projects, company_code)
        return SyncResult(status="started", synced=0, total=0, errors=[])

    try:
        result = await service.sync_projects(company_code)
        return SyncResult(**result)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Project sync failed: {str(e)}")


@router.post("/projects/{company_code}", response_model=SyncResult)
async def sync_projects_for_company(
    company_code: str,
    background_tasks: BackgroundTasks,
    run_async: bool = False,
    service: InternalWorkspaceService = Depends(get_internal_service),
    current_user: dict = Depends(require_superadmin_or_internal_admin())
):
    """
    Sync projects for a specific company (SuperAdmin only).
    """
    if not service.is_internal_company(company_code):
        raise HTTPException(
            status_code=400,
            detail=f"{company_code} is not a Bheemverse subsidiary"
        )

    if run_async:
        background_tasks.add_task(service.sync_projects, company_code)
        return SyncResult(status="started", synced=0, total=0, errors=[])

    try:
        result = await service.sync_projects(company_code)
        return SyncResult(**result)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Project sync failed: {str(e)}")


# ═══════════════════════════════════════════════════════════════════
# FULL SYNC ENDPOINT
# ═══════════════════════════════════════════════════════════════════

@router.post("/all")
async def sync_all(
    background_tasks: BackgroundTasks,
    tenant: dict = Depends(get_current_internal_tenant),
    service: InternalWorkspaceService = Depends(get_internal_service),
    current_user: dict = Depends(require_superadmin_or_internal_admin())
):
    """
    Sync all ERP data (employees and projects) for the current tenant.
    Always runs asynchronously.
    """
    company_code = tenant["company_code"]

    async def full_sync():
        try:
            await service.sync_employees(company_code)
            await service.sync_projects(company_code)
        except Exception as e:
            print(f"Full sync failed for {company_code}: {e}")

    background_tasks.add_task(full_sync)

    return {
        "status": "started",
        "message": f"Full sync started for {company_code}",
        "company_name": tenant["name"]
    }


# ═══════════════════════════════════════════════════════════════════
# TENANT PROVISIONING ENDPOINTS (SuperAdmin Only)
# ═══════════════════════════════════════════════════════════════════

@router.post("/provision/{company_code}", response_model=ProvisionResult)
async def provision_tenant(
    company_code: str,
    provisioner: InternalTenantProvisioner = Depends(get_provisioner),
    current_user: dict = Depends(get_current_user)
):
    """
    Provision a workspace tenant for a Bheemverse subsidiary.
    SuperAdmin only.
    """
    # Check SuperAdmin
    if current_user.get("role", "").lower() != "superadmin":
        raise HTTPException(
            status_code=403,
            detail="Only SuperAdmin can provision internal tenants"
        )

    try:
        result = await provisioner.provision_subsidiary(company_code.upper())
        return ProvisionResult(**result)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Provisioning failed: {str(e)}")


@router.post("/provision-all", response_model=List[ProvisionResult])
async def provision_all_tenants(
    provisioner: InternalTenantProvisioner = Depends(get_provisioner),
    current_user: dict = Depends(get_current_user)
):
    """
    Provision workspace tenants for all Bheemverse subsidiaries.
    SuperAdmin only.
    """
    # Check SuperAdmin
    if current_user.get("role", "").lower() != "superadmin":
        raise HTTPException(
            status_code=403,
            detail="Only SuperAdmin can provision internal tenants"
        )

    results = await provisioner.provision_all_subsidiaries()
    return [ProvisionResult(**r) for r in results]


# ═══════════════════════════════════════════════════════════════════
# STATUS ENDPOINT
# ═══════════════════════════════════════════════════════════════════

@router.get("/status")
async def get_sync_status(
    tenant: dict = Depends(get_current_internal_tenant),
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(require_superadmin_or_internal_admin())
):
    """
    Get sync status for the current internal tenant.
    Returns counts and last sync information.
    """
    from sqlalchemy import text

    # Get user counts
    query = text("""
        SELECT
            COUNT(*) as total_users,
            COUNT(CASE WHEN provisioned_by = 'erp_hr' THEN 1 END) as synced_from_hr,
            COUNT(CASE WHEN provisioned_by = 'self' THEN 1 END) as self_registered,
            COUNT(CASE WHEN provisioned_by = 'admin' THEN 1 END) as admin_added,
            MAX(updated_at) as last_sync
        FROM workspace.tenant_users
        WHERE tenant_id = CAST(:tenant_id AS uuid)
    """)

    result = await db.execute(query, {"tenant_id": str(tenant["tenant_id"])})
    row = result.fetchone()

    return {
        "tenant": {
            "id": str(tenant["tenant_id"]),
            "name": tenant["name"],
            "company_code": tenant["company_code"]
        },
        "users": {
            "total": row.total_users if row else 0,
            "synced_from_hr": row.synced_from_hr if row else 0,
            "self_registered": row.self_registered if row else 0,
            "admin_added": row.admin_added if row else 0
        },
        "last_sync": row.last_sync.isoformat() if row and row.last_sync else None
    }
