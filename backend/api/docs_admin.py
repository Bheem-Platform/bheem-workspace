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


# ==================== NEXTCLOUD HEALTH & SYNC ENDPOINTS ====================

@router.get("/docs/health")
async def check_nextcloud_health(
    current_user: dict = Depends(require_superadmin())
):
    """
    Check Nextcloud connectivity and authentication status.
    Returns detailed status about the Nextcloud connection.
    """
    import httpx
    from core.config import settings

    result = {
        "nextcloud_url": settings.NEXTCLOUD_URL,
        "admin_user": settings.NEXTCLOUD_ADMIN_USER,
        "status": "unknown",
        "version": None,
        "auth_status": "unknown",
        "errors": []
    }

    try:
        async with httpx.AsyncClient(timeout=10.0, verify=False) as client:
            # Check basic connectivity
            status_response = await client.get(f"{settings.NEXTCLOUD_URL}/status.php")
            if status_response.status_code == 200:
                status_data = status_response.json()
                result["status"] = "online"
                result["version"] = status_data.get("versionstring")
                result["installed"] = status_data.get("installed", False)
                result["maintenance"] = status_data.get("maintenance", False)
            else:
                result["status"] = "unreachable"
                result["errors"].append(f"Status endpoint returned {status_response.status_code}")
                return result

            # Check authentication
            auth_response = await client.get(
                f"{settings.NEXTCLOUD_URL}/ocs/v2.php/cloud/users",
                auth=(settings.NEXTCLOUD_ADMIN_USER, settings.NEXTCLOUD_ADMIN_PASSWORD),
                headers={"OCS-APIREQUEST": "true", "Accept": "application/json"}
            )

            if auth_response.status_code == 200:
                data = auth_response.json()
                if data.get("ocs", {}).get("meta", {}).get("statuscode") == 200:
                    result["auth_status"] = "authenticated"
                    users = data.get("ocs", {}).get("data", {}).get("users", [])
                    result["user_count"] = len(users)
                else:
                    result["auth_status"] = "failed"
                    result["errors"].append(data.get("ocs", {}).get("meta", {}).get("message", "Auth failed"))
            else:
                result["auth_status"] = "failed"
                result["errors"].append(f"Auth endpoint returned {auth_response.status_code}")

    except Exception as e:
        result["status"] = "error"
        result["errors"].append(str(e))

    return result


class NextcloudSyncRequest(BaseModel):
    tenant_id: Optional[str] = None
    password: str = "Bheem@1234"  # Default temp password for synced users
    dry_run: bool = True  # Preview without creating


@router.post("/docs/sync-users")
async def sync_workspace_users_to_nextcloud(
    request: NextcloudSyncRequest,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(require_superadmin())
):
    """
    Sync existing workspace users to Nextcloud.
    Creates Nextcloud accounts for users who don't have one.

    - dry_run=True: Preview which users would be created
    - dry_run=False: Actually create the users
    """
    from sqlalchemy import text
    from services.nextcloud_user_service import nextcloud_user_service

    # First check if Nextcloud auth is working
    health = await nextcloud_user_service.health_check()
    if not health:
        raise HTTPException(
            status_code=503,
            detail="Nextcloud service is not available. Please check credentials in .env file (NEXTCLOUD_ADMIN_USER, NEXTCLOUD_ADMIN_PASSWORD)"
        )

    # Get all workspace users
    query = """
        SELECT tu.id, tu.user_id, tu.email, tu.name, tu.role, t.slug as tenant_slug, t.name as tenant_name
        FROM workspace.tenant_users tu
        JOIN workspace.tenants t ON tu.tenant_id = t.id
        WHERE tu.is_active = true
    """
    params = {}

    if request.tenant_id:
        query += " AND (t.id::text = :tenant_id OR t.slug = :tenant_id)"
        params["tenant_id"] = request.tenant_id

    result = await db.execute(text(query), params)
    users = result.fetchall()

    sync_results = {
        "total_users": len(users),
        "to_create": [],
        "already_exists": [],
        "created": [],
        "failed": [],
        "dry_run": request.dry_run
    }

    for user in users:
        email = user.email
        if not email:
            continue

        # Use email local part as username for Nextcloud
        nc_username = email.split("@")[0] if "@" in email else str(user.user_id)

        # Check if user exists in Nextcloud
        exists_result = await nextcloud_user_service.get_user(nc_username)

        if exists_result.get("status") == "found":
            sync_results["already_exists"].append({
                "email": email,
                "nc_username": nc_username,
                "name": user.name,
                "tenant": user.tenant_slug
            })
        else:
            user_info = {
                "email": email,
                "nc_username": nc_username,
                "name": user.name or email,
                "tenant": user.tenant_slug
            }

            if request.dry_run:
                sync_results["to_create"].append(user_info)
            else:
                # Actually create the user
                create_result = await nextcloud_user_service.create_user(
                    user_id=nc_username,
                    email=email,
                    display_name=user.name or email,
                    password=request.password,
                    quota="1 GB"
                )

                if create_result.get("status") in ["created", "exists"]:
                    sync_results["created"].append(user_info)
                else:
                    sync_results["failed"].append({
                        **user_info,
                        "error": create_result.get("error", "Unknown error")
                    })

    return sync_results
