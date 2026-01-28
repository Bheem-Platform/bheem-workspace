"""
Bheem Workspace - User Workspace API
Endpoints for users to manage their workspace settings.
Handles external customer onboarding and workspace provisioning.
"""
from fastapi import APIRouter, HTTPException, Depends, status
from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
import uuid
import re

from core.database import get_db
from core.security import get_current_user, require_tenant_member
from models.admin_models import Tenant, TenantUser
import logging

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/user-workspace", tags=["User Workspace"])


class TenantProfileUpdate(BaseModel):
    """Request to update tenant profile during onboarding."""
    organization_name: Optional[str] = None
    industry: Optional[str] = None
    team_size: Optional[str] = None
    timezone: Optional[str] = None


class CreateWorkspaceRequest(BaseModel):
    """Request to create a new workspace for external customer."""
    workspace_name: str
    industry: Optional[str] = "technology"
    team_size: Optional[str] = "1-10"


def generate_slug(name: str) -> str:
    """Generate a URL-safe slug from workspace name."""
    # Convert to lowercase and replace spaces with hyphens
    slug = name.lower().strip()
    slug = re.sub(r'[^\w\s-]', '', slug)  # Remove special chars
    slug = re.sub(r'[\s_]+', '-', slug)   # Replace spaces/underscores with hyphens
    slug = re.sub(r'-+', '-', slug)       # Remove duplicate hyphens
    slug = slug.strip('-')
    # Add random suffix to ensure uniqueness
    suffix = uuid.uuid4().hex[:6]
    return f"{slug}-{suffix}"


@router.get("/check")
async def check_user_workspace(
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Check if the current user has a workspace.
    This endpoint doesn't require tenant membership - used for onboarding flow.

    Returns:
        - has_workspace: bool
        - workspace: workspace details if exists
        - needs_onboarding: bool
    """
    user_id = current_user.get("user_id") or current_user.get("id")
    email = current_user.get("email") or current_user.get("username")

    if not user_id:
        raise HTTPException(status_code=400, detail="User ID not found in token")

    # Check if user is a member of any tenant
    result = await db.execute(
        select(TenantUser, Tenant)
        .join(Tenant, TenantUser.tenant_id == Tenant.id)
        .where(TenantUser.user_id == uuid.UUID(user_id))
        .where(Tenant.is_active == True)
    )
    membership = result.first()

    if membership:
        tenant_user, tenant = membership
        return {
            "has_workspace": True,
            "needs_onboarding": False,
            "workspace": {
                "id": str(tenant.id),
                "name": tenant.name,
                "slug": tenant.slug,
                "plan": tenant.plan,
                "role": tenant_user.role
            }
        }

    # Check by email as well (for users who were invited but not yet linked by user_id)
    if email:
        result = await db.execute(
            select(TenantUser, Tenant)
            .join(Tenant, TenantUser.tenant_id == Tenant.id)
            .where(TenantUser.email == email)
            .where(Tenant.is_active == True)
        )
        membership = result.first()

        if membership:
            tenant_user, tenant = membership
            # Update the user_id on the tenant_user record
            tenant_user.user_id = uuid.UUID(user_id)
            tenant_user.joined_at = datetime.utcnow()
            await db.commit()

            return {
                "has_workspace": True,
                "needs_onboarding": False,
                "workspace": {
                    "id": str(tenant.id),
                    "name": tenant.name,
                    "slug": tenant.slug,
                    "plan": tenant.plan,
                    "role": tenant_user.role
                }
            }

    # User has no workspace - needs onboarding
    return {
        "has_workspace": False,
        "needs_onboarding": True,
        "workspace": None
    }


@router.post("/create")
async def create_workspace(
    request: CreateWorkspaceRequest,
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Create a new workspace for an external customer.
    This is called during the onboarding flow after social login.

    The user becomes the admin of their new workspace.
    """
    user_id = current_user.get("user_id") or current_user.get("id")
    email = current_user.get("email") or current_user.get("username")
    name = current_user.get("name") or current_user.get("full_name") or email.split("@")[0]

    if not user_id:
        raise HTTPException(status_code=400, detail="User ID not found in token")

    # Check if user already has a workspace
    result = await db.execute(
        select(TenantUser).where(TenantUser.user_id == uuid.UUID(user_id))
    )
    existing = result.scalar_one_or_none()

    if existing:
        raise HTTPException(
            status_code=400,
            detail="You already have a workspace. Cannot create another one."
        )

    # Generate unique slug
    slug = generate_slug(request.workspace_name)

    # Ensure slug is unique
    for attempt in range(5):
        result = await db.execute(
            select(Tenant).where(Tenant.slug == slug)
        )
        if not result.scalar_one_or_none():
            break
        slug = generate_slug(request.workspace_name)

    # Create the tenant/workspace
    tenant = Tenant(
        id=uuid.uuid4(),
        name=request.workspace_name,
        slug=slug,
        owner_email=email,
        tenant_mode="external",  # External customer
        plan="free",  # Start with free plan
        is_active=True,
        max_users=5,  # Free tier limit
        meet_quota_hours=10,
        docs_quota_mb=1024,
        mail_quota_mb=512,
        recordings_quota_mb=1024,
        settings={
            "industry": request.industry,
            "team_size": request.team_size,
            "onboarding_completed": False
        },
        created_at=datetime.utcnow(),
        created_by=uuid.UUID(user_id)
    )

    db.add(tenant)
    await db.flush()  # Get tenant ID

    # Add user as admin of the workspace
    tenant_user = TenantUser(
        id=uuid.uuid4(),
        tenant_id=tenant.id,
        user_id=uuid.UUID(user_id),
        email=email,
        name=name,
        role="admin",  # Creator is admin
        is_active=True,
        joined_at=datetime.utcnow(),
        provisioned_by="self"  # Self-registered via social login
    )

    db.add(tenant_user)
    await db.commit()

    logger.info(f"New workspace created: {tenant.name} (slug: {slug}) by user {email}")

    return {
        "success": True,
        "message": "Workspace created successfully",
        "workspace": {
            "id": str(tenant.id),
            "name": tenant.name,
            "slug": tenant.slug,
            "plan": tenant.plan,
            "role": "admin"
        }
    }


@router.get("/me")
async def get_my_workspace(
    current_user: dict = Depends(require_tenant_member()),
    db: AsyncSession = Depends(get_db)
):
    """Get the current user's workspace details."""
    tenant_id = current_user.get("tenant_id")
    tenant_role = current_user.get("tenant_role")

    result = await db.execute(
        select(Tenant).where(Tenant.id == tenant_id)
    )
    tenant = result.scalar_one_or_none()

    if not tenant:
        raise HTTPException(status_code=404, detail="Workspace not found")

    return {
        "id": str(tenant.id),
        "name": tenant.name,
        "slug": tenant.slug,
        "plan": tenant.plan,
        "role": tenant_role,
        "is_active": tenant.is_active,
        "user": {
            "id": current_user.get("user_id") or current_user.get("id"),
            "email": current_user.get("email"),
            "username": current_user.get("username"),
            "workspace_role": tenant_role
        }
    }


@router.put("/tenant")
async def update_tenant_profile(
    profile: TenantProfileUpdate,
    current_user: dict = Depends(require_tenant_member()),
    db: AsyncSession = Depends(get_db)
):
    """
    Update tenant profile (for onboarding and settings).
    Only admins can update tenant settings.
    """
    tenant_id = current_user.get("tenant_id")
    tenant_role = current_user.get("tenant_role")

    # Check if user is admin
    if tenant_role not in ["admin", "owner"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only workspace admins can update workspace settings"
        )

    result = await db.execute(
        select(Tenant).where(Tenant.id == tenant_id)
    )
    tenant = result.scalar_one_or_none()

    if not tenant:
        raise HTTPException(status_code=404, detail="Workspace not found")

    # Update tenant name if provided
    if profile.organization_name:
        tenant.name = profile.organization_name

    tenant.updated_at = datetime.utcnow()
    await db.commit()

    logger.info(f"Tenant {tenant_id} profile updated by user {current_user.get('user_id')}")

    return {
        "success": True,
        "message": "Workspace profile updated",
        "tenant_id": str(tenant_id)
    }


@router.get("/dashboard-stats")
async def get_dashboard_stats(
    current_user: dict = Depends(require_tenant_member()),
    db: AsyncSession = Depends(get_db)
):
    """Get dashboard statistics for the current user's workspace."""
    # Return basic stats - can be expanded later with real data
    return {
        "unreadEmails": 0,
        "todayEvents": 0,
        "recentDocs": 0,
        "activeMeets": 0
    }
