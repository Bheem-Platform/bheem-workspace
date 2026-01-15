"""
Bheem Workspace Tenants API
Public endpoints for self-service workspace creation
"""
import logging
from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from typing import Optional
from datetime import datetime, timedelta
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from core.database import get_db
from core.security import get_current_user
from core.config import settings
from models.admin_models import Tenant, TenantUser
from services.erp_client import erp_client

router = APIRouter()
logger = logging.getLogger(__name__)

# Plan configurations
PLANS = {
    "starter": {"max_users": 10, "meet_quota_hours": 20, "docs_quota_mb": 5120, "mail_quota_mb": 1024, "recordings_quota_mb": 2048},
    "professional": {"max_users": 50, "meet_quota_hours": 100, "docs_quota_mb": 51200, "mail_quota_mb": 10240, "recordings_quota_mb": 20480},
    "enterprise": {"max_users": 500, "meet_quota_hours": -1, "docs_quota_mb": 512000, "mail_quota_mb": 102400, "recordings_quota_mb": 204800},
    "trial": {"max_users": 5, "meet_quota_hours": 10, "docs_quota_mb": 1024, "mail_quota_mb": 256, "recordings_quota_mb": 512},
}


class WorkspaceCreate(BaseModel):
    """Request to create a workspace"""
    name: str
    slug: str
    owner_email: str
    owner_name: str
    plan: str = "trial"


class WorkspaceResponse(BaseModel):
    """Workspace creation response"""
    id: str
    name: str
    slug: str
    owner_email: str
    plan: str
    max_users: int
    is_active: bool
    created_at: datetime
    trial_ends_at: Optional[datetime] = None
    workspace_url: str
    meet_url: str
    docs_url: str


@router.post("", response_model=WorkspaceResponse)
async def create_workspace(
    request: WorkspaceCreate,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    """
    Create a new workspace for the current user.
    This is the self-service endpoint for new users signing up.
    """
    # Validate plan
    plan = request.plan.lower()
    if plan not in PLANS:
        plan = "trial"

    plan_config = PLANS[plan]

    # Check if slug already exists
    existing = await db.execute(
        select(Tenant).where(Tenant.slug == request.slug)
    )
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="Workspace URL already taken. Please choose a different name.")

    # Get user info from JWT
    user_id = current_user.get("user_id") or current_user.get("sub")
    if not user_id:
        raise HTTPException(status_code=400, detail="Invalid user token")

    # Check if user already has a workspace
    existing_membership = await db.execute(
        select(TenantUser).where(TenantUser.user_id == user_id)
    )
    if existing_membership.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="You already have a workspace. Each user can only have one workspace.")

    # Create the tenant
    trial_ends = datetime.utcnow() + timedelta(days=14) if plan == "trial" else None

    new_tenant = Tenant(
        name=request.name,
        slug=request.slug,
        owner_email=request.owner_email,
        plan=plan,
        tenant_mode="external",  # Self-service users are external customers
        max_users=plan_config["max_users"],
        meet_quota_hours=plan_config["meet_quota_hours"],
        docs_quota_mb=plan_config["docs_quota_mb"],
        mail_quota_mb=plan_config["mail_quota_mb"],
        recordings_quota_mb=plan_config["recordings_quota_mb"],
        trial_ends_at=trial_ends,
        created_by=user_id
    )

    db.add(new_tenant)
    await db.flush()  # Get the tenant ID

    # Create tenant user link (owner as admin)
    tenant_user = TenantUser(
        tenant_id=new_tenant.id,
        user_id=user_id,
        email=request.owner_email,
        name=request.owner_name,
        role="admin",
        provisioned_by="self",
        joined_at=datetime.utcnow()
    )

    db.add(tenant_user)
    await db.commit()
    await db.refresh(new_tenant)

    # ═══════════════════════════════════════════════════════════════════
    # ERP INTEGRATION: Create Lead + Sales Customer for external customers
    # ═══════════════════════════════════════════════════════════════════
    erp_sync_errors = []

    if getattr(settings, 'ERP_SYNC_ON_SIGNUP', True):
        try:
            # Step 1: Create CRM Lead for sales tracking
            logger.info(f"Creating CRM lead for tenant: {new_tenant.name}")
            lead_result = await erp_client.create_crm_lead(
                name=request.owner_name,
                email=request.owner_email,
                company_name=request.name,
                source="WORKSPACE_SIGNUP",
                notes=f"Self-service signup for workspace: {request.slug}"
            )

            if lead_result.get("id"):
                new_tenant.erp_lead_id = lead_result.get("id")
                logger.info(f"Created CRM lead: {lead_result.get('id')}")
            elif lead_result.get("error"):
                erp_sync_errors.append(f"Lead: {lead_result.get('error')}")
                logger.warning(f"CRM lead creation failed: {lead_result.get('error')}")
        except Exception as e:
            erp_sync_errors.append(f"Lead: {str(e)}")
            logger.warning(f"CRM lead creation error: {e}")

        try:
            # Step 2: Create Sales Customer for billing/invoicing
            logger.info(f"Creating Sales customer for tenant: {new_tenant.name}")
            customer_result = await erp_client.create_sales_customer(
                name=request.name,
                email=request.owner_email,
                company_id=settings.BHEEMVERSE_PARENT_COMPANY_ID,
                metadata={
                    "workspace_tenant_id": str(new_tenant.id),
                    "workspace_slug": request.slug,
                    "source": "workspace_signup"
                }
            )

            if customer_result.get("id"):
                new_tenant.erp_customer_id = customer_result.get("id")
                logger.info(f"Created Sales customer: {customer_result.get('id')}")
            elif customer_result.get("error"):
                erp_sync_errors.append(f"Customer: {customer_result.get('error')}")
                logger.warning(f"Sales customer creation failed: {customer_result.get('error')}")
        except Exception as e:
            erp_sync_errors.append(f"Customer: {str(e)}")
            logger.warning(f"Sales customer creation error: {e}")

        try:
            # Step 3: Sync user to ERP with Passport credentials
            passport_user_id = current_user.get("user_id") or current_user.get("sub")
            logger.info(f"Syncing user to ERP: {request.owner_email}")

            user_result = await erp_client.sync_user_from_passport(
                passport_user_id=str(passport_user_id),
                email=request.owner_email,
                name=request.owner_name,
                role="Customer",
                company_id=settings.BHEEMVERSE_PARENT_COMPANY_ID
            )

            if user_result.get("id"):
                tenant_user.erp_user_id = user_result.get("id")
                logger.info(f"Synced ERP user: {user_result.get('id')}")
            elif user_result.get("error"):
                erp_sync_errors.append(f"User: {user_result.get('error')}")
                logger.warning(f"ERP user sync failed: {user_result.get('error')}")
        except Exception as e:
            erp_sync_errors.append(f"User: {str(e)}")
            logger.warning(f"ERP user sync error: {e}")

        # Save ERP references to database
        if new_tenant.erp_lead_id or new_tenant.erp_customer_id:
            await db.commit()
            await db.refresh(new_tenant)

        if erp_sync_errors:
            logger.warning(f"ERP sync completed with errors: {erp_sync_errors}")
        else:
            logger.info(f"ERP sync completed successfully for tenant: {new_tenant.slug}")

    return WorkspaceResponse(
        id=str(new_tenant.id),
        name=new_tenant.name,
        slug=new_tenant.slug,
        owner_email=new_tenant.owner_email,
        plan=new_tenant.plan,
        max_users=new_tenant.max_users,
        is_active=new_tenant.is_active,
        created_at=new_tenant.created_at,
        trial_ends_at=new_tenant.trial_ends_at,
        workspace_url=f"https://{request.slug}.workspace.bheem.cloud",
        meet_url=f"https://meet.bheem.cloud/{request.slug}",
        docs_url=f"https://docs.bheem.cloud/{request.slug}"
    )


@router.get("/plans")
async def list_plans():
    """List available workspace plans"""
    return {
        "trial": {
            "name": "Free Trial",
            "max_users": 5,
            "storage_gb": 1,
            "price_monthly": 0,
            "features": ["meet", "docs"],
            "duration_days": 14
        },
        "starter": {
            "name": "Starter",
            "max_users": 10,
            "storage_gb": 5,
            "price_monthly": 0,
            "features": ["meet", "docs"]
        },
        "professional": {
            "name": "Professional",
            "max_users": 50,
            "storage_gb": 50,
            "price_monthly": 49,
            "features": ["meet", "docs", "mail", "recordings"]
        },
        "enterprise": {
            "name": "Enterprise",
            "max_users": 500,
            "storage_gb": 500,
            "price_monthly": 199,
            "features": ["meet", "docs", "mail", "recordings", "custom_domain", "sso", "api"]
        }
    }


@router.get("/my")
async def get_my_workspace(
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    """Get the current user's workspace"""
    user_id = current_user.get("user_id") or current_user.get("sub")
    if not user_id:
        raise HTTPException(status_code=400, detail="Invalid user token")

    # Find user's tenant
    result = await db.execute(
        select(TenantUser).where(TenantUser.user_id == user_id)
    )
    tenant_user = result.scalar_one_or_none()

    if not tenant_user:
        raise HTTPException(status_code=404, detail="No workspace found. Please create one first.")

    # Get tenant details
    tenant_result = await db.execute(
        select(Tenant).where(Tenant.id == tenant_user.tenant_id)
    )
    tenant = tenant_result.scalar_one_or_none()

    if not tenant:
        raise HTTPException(status_code=404, detail="Workspace not found")

    return {
        "id": str(tenant.id),
        "name": tenant.name,
        "slug": tenant.slug,
        "plan": tenant.plan,
        "role": tenant_user.role,
        "is_active": tenant.is_active,
        "trial_ends_at": tenant.trial_ends_at.isoformat() if tenant.trial_ends_at else None
    }
