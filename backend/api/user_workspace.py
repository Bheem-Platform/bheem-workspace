"""
Bheem Workspace - User Workspace API
Endpoints for users to manage their workspace settings.
"""
from fastapi import APIRouter, HTTPException, Depends, status
from pydantic import BaseModel
from typing import Optional
from datetime import datetime
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

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
