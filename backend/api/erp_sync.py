"""
Bheem Workspace - ERP Sync API
Handles synchronization with Bheem Core ERP for internal Bheemverse tenants (BHM001-BHM008)
"""
from typing import Optional, List
from uuid import UUID
from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks, Header, Request
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import text

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

def get_internal_service_with_token(request: Request, db: AsyncSession = Depends(get_db)) -> InternalWorkspaceService:
    """Dependency to get internal workspace service with user's auth token for ERP calls"""
    # Extract user's auth token from request
    auth_header = request.headers.get("Authorization", "")
    user_token = auth_header.replace("Bearer ", "") if auth_header.startswith("Bearer ") else None
    return InternalWorkspaceService(db, user_token=user_token)


async def get_internal_service(db: AsyncSession = Depends(get_db)) -> InternalWorkspaceService:
    """Dependency to get internal workspace service (without user token - for background tasks)"""
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
    service: InternalWorkspaceService = Depends(get_internal_service_with_token),
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
    service: InternalWorkspaceService = Depends(get_internal_service_with_token),
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
    service: InternalWorkspaceService = Depends(get_internal_service_with_token),
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
    service: InternalWorkspaceService = Depends(get_internal_service_with_token),
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
    service: InternalWorkspaceService = Depends(get_internal_service_with_token),
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


# ═══════════════════════════════════════════════════════════════════
# WEBHOOK ENDPOINTS (Called by ERP when employee is created/updated)
# ═══════════════════════════════════════════════════════════════════

class EmployeeWebhookPayload(BaseModel):
    """Payload sent by ERP when employee is created/updated"""
    event: str  # employee.created, employee.updated, employee.deleted
    employee_id: str
    employee_code: Optional[str] = None
    first_name: str
    last_name: str
    work_email: Optional[str] = None
    personal_email: Optional[str] = None
    company_id: str
    company_code: str
    department: Optional[str] = None
    job_title: Optional[str] = None
    status: str = "ACTIVE"
    user_id: Optional[str] = None  # ERP auth user ID


class WebhookResponse(BaseModel):
    """Response from webhook processing"""
    success: bool
    message: str
    user_id: Optional[str] = None
    email: Optional[str] = None
    tenant_id: Optional[str] = None


async def verify_webhook_secret(
    x_webhook_secret: Optional[str] = None
) -> bool:
    """
    Verify the webhook secret from ERP.
    The secret should be passed in X-Webhook-Secret header.
    """
    from core.config import settings
    expected_secret = getattr(settings, 'ERP_WEBHOOK_SECRET', None)

    # If no secret configured, allow all requests (for development)
    if not expected_secret:
        return True

    return x_webhook_secret == expected_secret


@router.post("/webhook/employee", response_model=WebhookResponse)
async def handle_employee_webhook(
    payload: EmployeeWebhookPayload,
    db: AsyncSession = Depends(get_db),
    x_webhook_secret: Optional[str] = Header(None, alias="X-Webhook-Secret")
):
    """
    Webhook endpoint called by ERP when an employee is created, updated, or deleted.

    This automatically provisions/updates/removes workspace access for the employee
    in the appropriate internal tenant based on their company_code.

    Events:
    - employee.created: Provision new workspace user
    - employee.updated: Update workspace user details
    - employee.deleted: Deactivate workspace user

    Security: Requires X-Webhook-Secret header matching ERP_WEBHOOK_SECRET setting.
    """
    import logging
    from uuid import UUID
    import uuid as uuid_module

    logger = logging.getLogger(__name__)

    # Verify webhook secret
    if not await verify_webhook_secret(x_webhook_secret):
        raise HTTPException(
            status_code=401,
            detail="Invalid webhook secret"
        )

    company_code = payload.company_code.upper()

    # Check if this is an internal company
    if company_code not in BHEEMVERSE_COMPANY_CODES:
        return WebhookResponse(
            success=False,
            message=f"Company {company_code} is not a Bheemverse subsidiary - skipping workspace provisioning"
        )

    # Find the tenant for this company
    query = text("""
        SELECT id, name, slug FROM workspace.tenants
        WHERE erp_company_code = :company_code
        LIMIT 1
    """)
    result = await db.execute(query, {"company_code": company_code})
    tenant_row = result.fetchone()

    if not tenant_row:
        logger.warning(f"No tenant found for company code: {company_code}")
        return WebhookResponse(
            success=False,
            message=f"No workspace tenant found for company code: {company_code}"
        )

    tenant_id = tenant_row.id
    tenant_name = tenant_row.name

    # Determine email to use (prefer work_email, fallback to personal_email)
    email = payload.work_email or payload.personal_email
    if not email:
        return WebhookResponse(
            success=False,
            message="No email address provided for employee"
        )

    name = f"{payload.first_name} {payload.last_name}".strip()

    # Map job title to role
    role = "member"
    if payload.job_title:
        title_lower = payload.job_title.lower()
        if any(x in title_lower for x in ["director", "ceo", "cto", "cfo", "coo", "head", "chief"]):
            role = "admin"
        elif any(x in title_lower for x in ["manager", "lead", "senior", "supervisor", "principal"]):
            role = "manager"

    try:
        if payload.event == "employee.created":
            # Check if user already exists
            check_query = text("""
                SELECT id FROM workspace.tenant_users
                WHERE tenant_id = CAST(:tenant_id AS uuid) AND email = :email
            """)
            existing = await db.execute(check_query, {
                "tenant_id": str(tenant_id),
                "email": email
            })

            if existing.fetchone():
                return WebhookResponse(
                    success=True,
                    message=f"User {email} already exists in workspace",
                    email=email,
                    tenant_id=str(tenant_id)
                )

            # Create new workspace user
            # Helper to safely parse UUIDs
            def safe_uuid(val):
                if not val:
                    return None
                try:
                    return str(uuid_module.UUID(val))
                except (ValueError, AttributeError):
                    return None

            user_id = safe_uuid(payload.user_id) or str(uuid_module.uuid4())
            erp_employee_id = safe_uuid(payload.employee_id)
            erp_user_id = safe_uuid(payload.user_id)

            insert_query = text("""
                INSERT INTO workspace.tenant_users (
                    id, tenant_id, user_id, email, name, role,
                    erp_employee_id, erp_user_id, department, job_title,
                    provisioned_by, is_active, created_at, updated_at
                )
                VALUES (
                    gen_random_uuid(),
                    CAST(:tenant_id AS uuid),
                    CAST(:user_id AS uuid),
                    :email,
                    :name,
                    :role,
                    CAST(:erp_employee_id AS uuid),
                    CAST(:erp_user_id AS uuid),
                    :department,
                    :job_title,
                    'erp_hr',
                    true,
                    NOW(),
                    NOW()
                )
                RETURNING id::text
            """)

            result = await db.execute(insert_query, {
                "tenant_id": str(tenant_id),
                "user_id": user_id,
                "email": email,
                "name": name,
                "role": role,
                "erp_employee_id": erp_employee_id,
                "erp_user_id": erp_user_id,
                "department": payload.department,
                "job_title": payload.job_title
            })
            await db.commit()

            row = result.fetchone()
            logger.info(f"Created workspace user {email} in tenant {tenant_name} via ERP webhook")

            return WebhookResponse(
                success=True,
                message=f"User {email} provisioned to workspace {tenant_name}",
                user_id=row[0] if row else None,
                email=email,
                tenant_id=str(tenant_id)
            )

        elif payload.event == "employee.updated":
            # Helper to safely parse UUIDs
            def safe_uuid(val):
                if not val:
                    return None
                try:
                    return str(uuid_module.UUID(val))
                except (ValueError, AttributeError):
                    return None

            erp_employee_id = safe_uuid(payload.employee_id)

            # Update existing user - match by email only if employee_id is not a valid UUID
            if erp_employee_id:
                update_query = text("""
                    UPDATE workspace.tenant_users
                    SET
                        name = :name,
                        role = :role,
                        department = :department,
                        job_title = :job_title,
                        updated_at = NOW()
                    WHERE tenant_id = CAST(:tenant_id AS uuid)
                      AND (email = :email OR erp_employee_id = CAST(:erp_employee_id AS uuid))
                    RETURNING id::text
                """)
                params = {
                    "tenant_id": str(tenant_id),
                    "email": email,
                    "name": name,
                    "role": role,
                    "department": payload.department,
                    "job_title": payload.job_title,
                    "erp_employee_id": erp_employee_id
                }
            else:
                update_query = text("""
                    UPDATE workspace.tenant_users
                    SET
                        name = :name,
                        role = :role,
                        department = :department,
                        job_title = :job_title,
                        updated_at = NOW()
                    WHERE tenant_id = CAST(:tenant_id AS uuid)
                      AND email = :email
                    RETURNING id::text
                """)
                params = {
                    "tenant_id": str(tenant_id),
                    "email": email,
                    "name": name,
                    "role": role,
                    "department": payload.department,
                    "job_title": payload.job_title
                }

            result = await db.execute(update_query, params)
            await db.commit()

            row = result.fetchone()
            if row:
                logger.info(f"Updated workspace user {email} in tenant {tenant_name} via ERP webhook")
                return WebhookResponse(
                    success=True,
                    message=f"User {email} updated in workspace {tenant_name}",
                    user_id=row[0],
                    email=email,
                    tenant_id=str(tenant_id)
                )
            else:
                return WebhookResponse(
                    success=False,
                    message=f"User {email} not found in workspace"
                )

        elif payload.event == "employee.deleted":
            # Helper to safely parse UUIDs
            def safe_uuid(val):
                if not val:
                    return None
                try:
                    return str(uuid_module.UUID(val))
                except (ValueError, AttributeError):
                    return None

            erp_employee_id = safe_uuid(payload.employee_id)

            # Deactivate user (soft delete) - match by email only if employee_id is not a valid UUID
            if erp_employee_id:
                deactivate_query = text("""
                    UPDATE workspace.tenant_users
                    SET is_active = false, updated_at = NOW()
                    WHERE tenant_id = CAST(:tenant_id AS uuid)
                      AND (email = :email OR erp_employee_id = CAST(:erp_employee_id AS uuid))
                    RETURNING id::text
                """)
                params = {
                    "tenant_id": str(tenant_id),
                    "email": email,
                    "erp_employee_id": erp_employee_id
                }
            else:
                deactivate_query = text("""
                    UPDATE workspace.tenant_users
                    SET is_active = false, updated_at = NOW()
                    WHERE tenant_id = CAST(:tenant_id AS uuid)
                      AND email = :email
                    RETURNING id::text
                """)
                params = {
                    "tenant_id": str(tenant_id),
                    "email": email
                }

            result = await db.execute(deactivate_query, params)
            await db.commit()

            row = result.fetchone()
            if row:
                logger.info(f"Deactivated workspace user {email} in tenant {tenant_name} via ERP webhook")
                return WebhookResponse(
                    success=True,
                    message=f"User {email} deactivated in workspace {tenant_name}",
                    user_id=row[0],
                    email=email,
                    tenant_id=str(tenant_id)
                )
            else:
                return WebhookResponse(
                    success=False,
                    message=f"User {email} not found in workspace"
                )

        else:
            return WebhookResponse(
                success=False,
                message=f"Unknown event type: {payload.event}"
            )

    except Exception as e:
        logger.error(f"Error processing employee webhook: {e}", exc_info=True)
        raise HTTPException(
            status_code=500,
            detail=f"Failed to process employee webhook: {str(e)}"
        )
