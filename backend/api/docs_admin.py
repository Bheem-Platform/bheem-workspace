"""
Bheem Workspace - Docs Administration API
Nextcloud quota management, shares, and storage administration
"""
from fastapi import APIRouter, HTTPException, Depends, Query
from pydantic import BaseModel
from typing import Optional, List, Dict, Any
from datetime import datetime

from sqlalchemy.ext.asyncio import AsyncSession

from core.database import get_db
from core.security import get_current_user, require_admin, require_superadmin
from services.nextcloud_service import nextcloud_service

router = APIRouter(tags=["Docs Admin"])


# ==================== PYDANTIC MODELS ====================

class QuotaUpdate(BaseModel):
    quota_mb: int  # Quota in MB, 0 for unlimited


class ShareUpdate(BaseModel):
    permissions: Optional[int] = None  # 1=read, 2=update, 4=create, 8=delete, 16=share
    expiration: Optional[str] = None  # Date string YYYY-MM-DD
    password: Optional[str] = None


class GroupCreate(BaseModel):
    name: str


class UserGroupAction(BaseModel):
    group_name: str


# ==================== USER QUOTA ENDPOINTS ====================

@router.get("/tenants/{tenant_id}/docs/users")
async def list_docs_users(
    tenant_id: str,
    search: Optional[str] = None,
    limit: int = Query(50, ge=1, le=100),
    offset: int = Query(0, ge=0),
    current_user: dict = Depends(require_admin())
):
    """List all document storage users with quota info"""
    users = await nextcloud_service.list_users(search=search or "", limit=limit, offset=offset)

    # Get quota info for each user
    user_details = []
    for user in users:
        quota = await nextcloud_service.get_user_quota(user["username"])
        if "error" not in quota:
            user_details.append({
                "username": user["username"],
                "display_name": quota.get("display_name"),
                "email": quota.get("email"),
                "quota_bytes": quota.get("quota_bytes"),
                "quota_mb": round(quota.get("quota_bytes", 0) / (1024 * 1024), 2) if quota.get("quota_bytes", 0) > 0 else None,
                "used_bytes": quota.get("used_bytes"),
                "used_mb": round(quota.get("used_bytes", 0) / (1024 * 1024), 2),
                "usage_percent": quota.get("relative", 0)
            })

    return {
        "users": user_details,
        "total": len(user_details),
        "limit": limit,
        "offset": offset
    }


@router.get("/tenants/{tenant_id}/docs/users/{username}")
async def get_docs_user(
    tenant_id: str,
    username: str,
    current_user: dict = Depends(require_admin())
):
    """Get detailed user info including quota and groups"""
    user_details = await nextcloud_service.get_user_details(username)

    if "error" in user_details:
        raise HTTPException(status_code=404, detail=user_details["error"])

    quota = user_details.get("quota", {})
    return {
        "username": user_details.get("username"),
        "display_name": user_details.get("display_name"),
        "email": user_details.get("email"),
        "enabled": user_details.get("enabled"),
        "groups": user_details.get("groups", []),
        "language": user_details.get("language"),
        "last_login": user_details.get("last_login"),
        "quota": {
            "bytes": quota.get("quota", -1),
            "used": quota.get("used", 0),
            "free": quota.get("free", 0),
            "relative": quota.get("relative", 0)
        }
    }


@router.put("/tenants/{tenant_id}/docs/users/{username}/quota")
async def set_docs_user_quota(
    tenant_id: str,
    username: str,
    quota: QuotaUpdate,
    current_user: dict = Depends(require_admin())
):
    """Set user storage quota"""
    # Convert MB to bytes
    quota_bytes = quota.quota_mb * 1024 * 1024 if quota.quota_mb > 0 else 0

    success = await nextcloud_service.set_user_quota(username, quota_bytes)

    if not success:
        raise HTTPException(status_code=500, detail="Failed to set quota")

    return {
        "message": "Quota updated",
        "username": username,
        "quota_mb": quota.quota_mb if quota.quota_mb > 0 else "unlimited"
    }


@router.post("/tenants/{tenant_id}/docs/users/{username}/disable")
async def disable_docs_user(
    tenant_id: str,
    username: str,
    current_user: dict = Depends(require_admin())
):
    """Disable a docs user"""
    success = await nextcloud_service.disable_user(username)

    if not success:
        raise HTTPException(status_code=500, detail="Failed to disable user")

    return {"message": "User disabled", "username": username}


@router.post("/tenants/{tenant_id}/docs/users/{username}/enable")
async def enable_docs_user(
    tenant_id: str,
    username: str,
    current_user: dict = Depends(require_admin())
):
    """Enable a docs user"""
    success = await nextcloud_service.enable_user(username)

    if not success:
        raise HTTPException(status_code=500, detail="Failed to enable user")

    return {"message": "User enabled", "username": username}


# ==================== SHARE ADMINISTRATION ENDPOINTS ====================

@router.get("/tenants/{tenant_id}/docs/shares")
async def list_shares(
    tenant_id: str,
    path: Optional[str] = None,
    current_user: dict = Depends(require_admin())
):
    """List all shares"""
    shares = await nextcloud_service.list_shares(path=path)

    return {
        "shares": shares,
        "total": len(shares)
    }


@router.get("/tenants/{tenant_id}/docs/shares/{share_id}")
async def get_share(
    tenant_id: str,
    share_id: str,
    current_user: dict = Depends(require_admin())
):
    """Get share details"""
    share = await nextcloud_service.get_share(share_id)

    if not share:
        raise HTTPException(status_code=404, detail="Share not found")

    return share


@router.put("/tenants/{tenant_id}/docs/shares/{share_id}")
async def update_share(
    tenant_id: str,
    share_id: str,
    update: ShareUpdate,
    current_user: dict = Depends(require_admin())
):
    """Update share settings (permissions, expiration, password)"""
    success = await nextcloud_service.update_share(
        share_id=share_id,
        permissions=update.permissions,
        expiration=update.expiration,
        password=update.password
    )

    if not success:
        raise HTTPException(status_code=500, detail="Failed to update share")

    return {"message": "Share updated", "share_id": share_id}


@router.delete("/tenants/{tenant_id}/docs/shares/{share_id}")
async def delete_share(
    tenant_id: str,
    share_id: str,
    current_user: dict = Depends(require_admin())
):
    """Delete a share"""
    success = await nextcloud_service.delete_share(share_id)

    if not success:
        raise HTTPException(status_code=500, detail="Failed to delete share")

    return {"message": "Share deleted", "share_id": share_id}


# ==================== GROUP MANAGEMENT ENDPOINTS ====================

@router.get("/tenants/{tenant_id}/docs/groups")
async def list_groups(
    tenant_id: str,
    current_user: dict = Depends(require_admin())
):
    """List all groups"""
    groups = await nextcloud_service.list_groups()

    return {"groups": groups}


@router.post("/tenants/{tenant_id}/docs/groups")
async def create_group(
    tenant_id: str,
    group: GroupCreate,
    current_user: dict = Depends(require_admin())
):
    """Create a new group"""
    success = await nextcloud_service.create_group(group.name)

    if not success:
        raise HTTPException(status_code=500, detail="Failed to create group")

    return {"message": "Group created", "group_name": group.name}


@router.post("/tenants/{tenant_id}/docs/users/{username}/groups")
async def add_user_to_group(
    tenant_id: str,
    username: str,
    action: UserGroupAction,
    current_user: dict = Depends(require_admin())
):
    """Add user to a group"""
    success = await nextcloud_service.add_user_to_group(username, action.group_name)

    if not success:
        raise HTTPException(status_code=500, detail="Failed to add user to group")

    return {"message": "User added to group", "username": username, "group": action.group_name}


@router.delete("/tenants/{tenant_id}/docs/users/{username}/groups/{group_name}")
async def remove_user_from_group(
    tenant_id: str,
    username: str,
    group_name: str,
    current_user: dict = Depends(require_admin())
):
    """Remove user from a group"""
    success = await nextcloud_service.remove_user_from_group(username, group_name)

    if not success:
        raise HTTPException(status_code=500, detail="Failed to remove user from group")

    return {"message": "User removed from group", "username": username, "group": group_name}


# ==================== STORAGE STATISTICS ENDPOINTS ====================

@router.get("/tenants/{tenant_id}/docs/storage/stats")
async def get_storage_stats(
    tenant_id: str,
    current_user: dict = Depends(require_admin())
):
    """Get overall storage statistics"""
    stats = await nextcloud_service.get_storage_stats()

    return {
        "total_users": stats.get("total_users", 0),
        "storage": {
            "used_bytes": stats.get("total_used_bytes", 0),
            "used_mb": stats.get("total_used_mb", 0),
            "used_gb": stats.get("total_used_gb", 0),
            "quota_bytes": stats.get("total_quota_bytes")
        },
        "top_users": stats.get("top_users", [])
    }


# ==================== SUPER ADMIN ENDPOINTS ====================

@router.get("/docs/storage/overview")
async def get_storage_overview(
    current_user: dict = Depends(require_superadmin())
):
    """Get storage overview across all tenants (SuperAdmin only)"""
    stats = await nextcloud_service.get_storage_stats()

    return {
        "total_users": stats.get("total_users", 0),
        "storage": {
            "used_bytes": stats.get("total_used_bytes", 0),
            "used_mb": stats.get("total_used_mb", 0),
            "used_gb": stats.get("total_used_gb", 0),
            "quota_bytes": stats.get("total_quota_bytes")
        },
        "top_users": stats.get("top_users", [])[:20]
    }


@router.get("/docs/users")
async def list_all_docs_users(
    search: Optional[str] = None,
    limit: int = Query(100, ge=1, le=500),
    current_user: dict = Depends(require_superadmin())
):
    """List all Nextcloud users (SuperAdmin only)"""
    users = await nextcloud_service.list_users(search=search or "", limit=limit)

    return {
        "users": users,
        "total": len(users)
    }
