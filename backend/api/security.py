"""
Bheem Workspace - Security API
Security dashboard, audit logs, and alerts for workspace admins.
"""
from fastapi import APIRouter, Depends, HTTPException, status, Query
from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime, timedelta
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import text

from core.database import get_db
from core.security import get_current_user, require_tenant_admin
import logging

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/security", tags=["Security"])


# Schemas
class SecurityOverview(BaseModel):
    """Security dashboard overview."""
    users_with_2fa: int
    users_total: int
    recent_login_count: int
    suspicious_activity_count: int
    password_health_score: int


class LoginActivity(BaseModel):
    """Login activity entry."""
    user_id: str
    email: str
    login_time: datetime
    ip_address: Optional[str]
    location: Optional[str]
    device: Optional[str]
    status: str  # success, failed


class AuditLogEntry(BaseModel):
    """Audit log entry."""
    id: str
    user_id: Optional[str]
    action: str
    entity_type: Optional[str]
    entity_id: Optional[str]
    description: Optional[str]
    ip_address: Optional[str]
    created_at: datetime


# Endpoints
@router.get("/dashboard")
async def get_security_dashboard(
    current_user: dict = Depends(require_tenant_admin()),
    db: AsyncSession = Depends(get_db)
):
    """
    Get security overview for tenant.
    Shows key security metrics and alerts.
    """
    tenant_id = current_user.get("tenant_id")
    if not tenant_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Tenant not found"
        )

    # Get total users
    users_result = await db.execute(
        text("""
            SELECT COUNT(*) as total
            FROM workspace.tenant_users
            WHERE tenant_id = CAST(:tenant_id AS uuid) AND is_active = TRUE
        """),
        {"tenant_id": tenant_id}
    )
    total_users = users_result.scalar() or 0

    # Get users with 2FA (placeholder - would need 2FA tracking)
    users_with_2fa = 0  # TODO: Implement 2FA tracking

    # Get recent logins (last 7 days)
    week_ago = datetime.utcnow() - timedelta(days=7)
    logins_result = await db.execute(
        text("""
            SELECT COUNT(*) as count
            FROM workspace.activity_log
            WHERE tenant_id = CAST(:tenant_id AS uuid)
            AND action = 'login'
            AND created_at > :week_ago
        """),
        {"tenant_id": tenant_id, "week_ago": week_ago}
    )
    recent_logins = logins_result.scalar() or 0

    # Get suspicious activity (failed logins, unusual patterns)
    suspicious_result = await db.execute(
        text("""
            SELECT COUNT(*) as count
            FROM workspace.activity_log
            WHERE tenant_id = CAST(:tenant_id AS uuid)
            AND action IN ('login_failed', 'suspicious_activity', 'unauthorized_access')
            AND created_at > :week_ago
        """),
        {"tenant_id": tenant_id, "week_ago": week_ago}
    )
    suspicious_count = suspicious_result.scalar() or 0

    # Password health score (placeholder - based on last password change)
    password_health = 85  # Default good score

    return {
        "overview": {
            "users_total": total_users,
            "users_with_2fa": users_with_2fa,
            "two_factor_percentage": int((users_with_2fa / total_users * 100) if total_users > 0 else 0),
            "recent_login_count": recent_logins,
            "suspicious_activity_count": suspicious_count,
            "password_health_score": password_health
        },
        "alerts": [
            {
                "type": "warning" if suspicious_count > 0 else "info",
                "message": f"{suspicious_count} suspicious activities detected" if suspicious_count > 0 else "No suspicious activity detected",
                "count": suspicious_count
            }
        ],
        "recommendations": [
            {
                "id": "enable_2fa",
                "title": "Enable Two-Factor Authentication",
                "description": "Require 2FA for all users to improve security",
                "priority": "high" if users_with_2fa < total_users else "completed"
            },
            {
                "id": "review_permissions",
                "title": "Review User Permissions",
                "description": "Regularly audit user roles and permissions",
                "priority": "medium"
            }
        ]
    }


@router.get("/audit-log")
async def get_audit_log(
    limit: int = Query(100, le=500),
    offset: int = Query(0),
    action_type: Optional[str] = None,
    user_id: Optional[str] = None,
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    current_user: dict = Depends(require_tenant_admin()),
    db: AsyncSession = Depends(get_db)
):
    """
    Get audit log for tenant.
    Shows all tracked activities with filtering options.
    """
    tenant_id = current_user.get("tenant_id")
    if not tenant_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Tenant not found"
        )

    # Build query
    query = """
        SELECT id, user_id, action, entity_type, entity_id,
               description, ip_address, created_at
        FROM workspace.activity_log
        WHERE tenant_id = CAST(:tenant_id AS uuid)
    """
    params = {"tenant_id": tenant_id}

    if action_type:
        query += " AND action = :action_type"
        params["action_type"] = action_type

    if user_id:
        query += " AND user_id = CAST(:user_id AS uuid)"
        params["user_id"] = user_id

    if start_date:
        try:
            start = datetime.strptime(start_date, "%Y-%m-%d")
            query += " AND created_at >= :start_date"
            params["start_date"] = start
        except ValueError:
            pass

    if end_date:
        try:
            end = datetime.strptime(end_date, "%Y-%m-%d") + timedelta(days=1)
            query += " AND created_at < :end_date"
            params["end_date"] = end
        except ValueError:
            pass

    query += " ORDER BY created_at DESC LIMIT :limit OFFSET :offset"
    params["limit"] = limit
    params["offset"] = offset

    result = await db.execute(text(query), params)
    logs = result.fetchall()

    return {
        "logs": [
            {
                "id": str(log.id),
                "user_id": str(log.user_id) if log.user_id else None,
                "action": log.action,
                "entity_type": log.entity_type,
                "entity_id": str(log.entity_id) if log.entity_id else None,
                "description": log.description,
                "ip_address": str(log.ip_address) if log.ip_address else None,
                "created_at": log.created_at.isoformat() if log.created_at else None
            }
            for log in logs
        ],
        "count": len(logs),
        "limit": limit,
        "offset": offset
    }


@router.get("/recent-logins")
async def get_recent_logins(
    limit: int = Query(50, le=100),
    current_user: dict = Depends(require_tenant_admin()),
    db: AsyncSession = Depends(get_db)
):
    """
    Get recent login activity for the workspace.
    """
    tenant_id = current_user.get("tenant_id")
    if not tenant_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Tenant not found"
        )

    result = await db.execute(
        text("""
            SELECT al.user_id, tu.email, tu.name, al.action,
                   al.ip_address, al.extra_data, al.created_at
            FROM workspace.activity_log al
            LEFT JOIN workspace.tenant_users tu ON al.user_id = tu.user_id
            WHERE al.tenant_id = CAST(:tenant_id AS uuid)
            AND al.action IN ('login', 'login_failed', 'logout')
            ORDER BY al.created_at DESC
            LIMIT :limit
        """),
        {"tenant_id": tenant_id, "limit": limit}
    )
    logins = result.fetchall()

    return {
        "logins": [
            {
                "user_id": str(login.user_id) if login.user_id else None,
                "email": login.email,
                "name": login.name,
                "action": login.action,
                "ip_address": str(login.ip_address) if login.ip_address else None,
                "device": login.extra_data.get("user_agent") if login.extra_data else None,
                "location": login.extra_data.get("location") if login.extra_data else None,
                "timestamp": login.created_at.isoformat() if login.created_at else None
            }
            for login in logins
        ],
        "count": len(logins)
    }


@router.get("/suspicious-activity")
async def get_suspicious_activity(
    days: int = Query(7, le=30),
    current_user: dict = Depends(require_tenant_admin()),
    db: AsyncSession = Depends(get_db)
):
    """
    Get suspicious activity alerts for the workspace.
    """
    tenant_id = current_user.get("tenant_id")
    if not tenant_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Tenant not found"
        )

    since = datetime.utcnow() - timedelta(days=days)

    result = await db.execute(
        text("""
            SELECT al.id, al.user_id, tu.email, al.action,
                   al.description, al.ip_address, al.created_at
            FROM workspace.activity_log al
            LEFT JOIN workspace.tenant_users tu ON al.user_id = tu.user_id
            WHERE al.tenant_id = CAST(:tenant_id AS uuid)
            AND al.action IN ('login_failed', 'suspicious_activity',
                             'unauthorized_access', 'permission_denied')
            AND al.created_at > :since
            ORDER BY al.created_at DESC
        """),
        {"tenant_id": tenant_id, "since": since}
    )
    activities = result.fetchall()

    return {
        "period_days": days,
        "activities": [
            {
                "id": str(a.id),
                "user_id": str(a.user_id) if a.user_id else None,
                "email": a.email,
                "action": a.action,
                "description": a.description,
                "ip_address": str(a.ip_address) if a.ip_address else None,
                "timestamp": a.created_at.isoformat() if a.created_at else None,
                "severity": _get_severity(a.action)
            }
            for a in activities
        ],
        "total_count": len(activities)
    }


@router.post("/log-activity")
async def log_security_activity(
    action: str,
    description: Optional[str] = None,
    entity_type: Optional[str] = None,
    entity_id: Optional[str] = None,
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Log a security-relevant activity.
    Used internally by other services.
    """
    tenant_id = current_user.get("tenant_id")
    user_id = current_user.get("id") or current_user.get("user_id")

    try:
        await db.execute(
            text("""
                INSERT INTO workspace.activity_log
                (id, tenant_id, user_id, action, entity_type, entity_id,
                 description, created_at)
                VALUES (gen_random_uuid(), CAST(:tenant_id AS uuid),
                        CAST(:user_id AS uuid), :action, :entity_type,
                        CAST(:entity_id AS uuid), :description, NOW())
            """),
            {
                "tenant_id": tenant_id,
                "user_id": user_id,
                "action": action,
                "entity_type": entity_type,
                "entity_id": entity_id,
                "description": description
            }
        )
        await db.commit()
        return {"success": True}
    except Exception as e:
        logger.error(f"Failed to log activity: {e}")
        return {"success": False, "error": str(e)}


def _get_severity(action: str) -> str:
    """Get severity level for an action."""
    high_severity = ["unauthorized_access", "suspicious_activity"]
    medium_severity = ["login_failed", "permission_denied"]

    if action in high_severity:
        return "high"
    elif action in medium_severity:
        return "medium"
    return "low"
