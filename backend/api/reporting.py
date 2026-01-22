"""
Bheem Workspace - Reporting & Analytics API
Usage reports, trend analysis, and bulk operations
"""
from fastapi import APIRouter, HTTPException, Depends, Query, Body
from pydantic import BaseModel
from typing import Optional, List, Dict, Any
from datetime import datetime, timedelta
from enum import Enum
import uuid

from sqlalchemy import select, func, and_, or_, desc
from sqlalchemy.ext.asyncio import AsyncSession

from core.database import get_db
from core.security import get_current_user, require_admin, require_superadmin
from models.admin_models import (
    Tenant, TenantUser, Domain, ActivityLog as ActivityLogModel
)

router = APIRouter(tags=["Reporting"])


# ==================== ENUMS ====================

class ReportPeriod(str, Enum):
    DAY = "day"
    WEEK = "week"
    MONTH = "month"
    QUARTER = "quarter"
    YEAR = "year"


class ExportFormat(str, Enum):
    JSON = "json"
    CSV = "csv"


# ==================== PYDANTIC MODELS ====================

class DateRange(BaseModel):
    start_date: Optional[datetime] = None
    end_date: Optional[datetime] = None


class BulkUserAction(BaseModel):
    user_ids: List[str]
    action: str  # activate, deactivate, change_role
    role: Optional[str] = None


class BulkTenantAction(BaseModel):
    tenant_ids: List[str]
    action: str  # activate, deactivate, change_plan
    plan: Optional[str] = None


# ==================== HELPER FUNCTIONS ====================

def get_period_start(period: ReportPeriod) -> datetime:
    """Get start date for reporting period"""
    now = datetime.utcnow()
    if period == ReportPeriod.DAY:
        return now - timedelta(days=1)
    elif period == ReportPeriod.WEEK:
        return now - timedelta(weeks=1)
    elif period == ReportPeriod.MONTH:
        return now - timedelta(days=30)
    elif period == ReportPeriod.QUARTER:
        return now - timedelta(days=90)
    elif period == ReportPeriod.YEAR:
        return now - timedelta(days=365)
    return now - timedelta(days=30)


# ==================== USAGE REPORTS ====================

@router.get("/tenants/{tenant_id}/reports/usage")
async def get_usage_report(
    tenant_id: str,
    period: ReportPeriod = ReportPeriod.MONTH,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(require_admin())
):
    """Get comprehensive usage report for a tenant"""
    # Get tenant
    result = await db.execute(
        select(Tenant).where(
            or_(
                Tenant.id == uuid.UUID(tenant_id) if len(tenant_id) == 36 else False,
                func.lower(Tenant.slug) == tenant_id.lower()
            )
        )
    )
    tenant = result.scalar_one_or_none()

    if not tenant:
        raise HTTPException(status_code=404, detail="Tenant not found")

    period_start = get_period_start(period)

    # Get user count
    user_count_result = await db.execute(
        select(func.count(TenantUser.id)).where(
            TenantUser.tenant_id == tenant.id
        )
    )
    total_users = user_count_result.scalar() or 0

    # Get active users (joined in period)
    active_users_result = await db.execute(
        select(func.count(TenantUser.id)).where(
            and_(
                TenantUser.tenant_id == tenant.id,
                TenantUser.joined_at >= period_start
            )
        )
    )
    new_users = active_users_result.scalar() or 0

    # Get domain count
    domain_count_result = await db.execute(
        select(func.count(Domain.id)).where(
            Domain.tenant_id == tenant.id
        )
    )
    domain_count = domain_count_result.scalar() or 0

    # Get activity count
    activity_count_result = await db.execute(
        select(func.count(ActivityLogModel.id)).where(
            and_(
                ActivityLogModel.tenant_id == tenant.id,
                ActivityLogModel.created_at >= period_start
            )
        )
    )
    activity_count = activity_count_result.scalar() or 0

    # Get activity by action type
    activity_by_action_result = await db.execute(
        select(
            ActivityLogModel.action,
            func.count(ActivityLogModel.id).label("count")
        ).where(
            and_(
                ActivityLogModel.tenant_id == tenant.id,
                ActivityLogModel.created_at >= period_start
            )
        ).group_by(ActivityLogModel.action)
    )
    activity_by_action = {row.action: row.count for row in activity_by_action_result}

    return {
        "tenant_id": str(tenant.id),
        "tenant_name": tenant.name,
        "period": period.value,
        "period_start": period_start.isoformat(),
        "period_end": datetime.utcnow().isoformat(),
        "users": {
            "total": total_users,
            "max": tenant.max_users,
            "new_in_period": new_users,
            "usage_percent": round(total_users / tenant.max_users * 100, 1) if tenant.max_users else 0
        },
        "domains": domain_count,
        "storage": {
            "meet": {
                "used_hours": float(tenant.meet_used_hours or 0),
                "quota_hours": tenant.meet_quota_hours,
                "usage_percent": round(float(tenant.meet_used_hours or 0) / tenant.meet_quota_hours * 100, 1) if tenant.meet_quota_hours else 0
            },
            "docs": {
                "used_mb": float(tenant.docs_used_mb or 0),
                "quota_mb": tenant.docs_quota_mb,
                "usage_percent": round(float(tenant.docs_used_mb or 0) / tenant.docs_quota_mb * 100, 1) if tenant.docs_quota_mb else 0
            },
            "mail": {
                "used_mb": float(tenant.mail_used_mb or 0),
                "quota_mb": tenant.mail_quota_mb,
                "usage_percent": round(float(tenant.mail_used_mb or 0) / tenant.mail_quota_mb * 100, 1) if tenant.mail_quota_mb else 0
            },
            "recordings": {
                "used_mb": float(tenant.recordings_used_mb or 0),
                "quota_mb": tenant.recordings_quota_mb,
                "usage_percent": round(float(tenant.recordings_used_mb or 0) / tenant.recordings_quota_mb * 100, 1) if tenant.recordings_quota_mb else 0
            }
        },
        "activity": {
            "total_actions": activity_count,
            "by_action": activity_by_action
        }
    }


@router.get("/tenants/{tenant_id}/reports/activity")
async def get_activity_report(
    tenant_id: str,
    period: ReportPeriod = ReportPeriod.WEEK,
    group_by: str = Query("day", regex="^(hour|day|week)$"),
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(require_admin())
):
    """Get activity timeline for a tenant"""
    # Get tenant ID
    result = await db.execute(
        select(Tenant).where(
            or_(
                Tenant.id == uuid.UUID(tenant_id) if len(tenant_id) == 36 else False,
                func.lower(Tenant.slug) == tenant_id.lower()
            )
        )
    )
    tenant = result.scalar_one_or_none()

    if not tenant:
        raise HTTPException(status_code=404, detail="Tenant not found")

    period_start = get_period_start(period)

    # Get activity logs
    logs_result = await db.execute(
        select(ActivityLogModel)
        .where(
            and_(
                ActivityLogModel.tenant_id == tenant.id,
                ActivityLogModel.created_at >= period_start
            )
        )
        .order_by(ActivityLogModel.created_at.desc())
        .limit(1000)
    )
    logs = logs_result.scalars().all()

    # Group by time period
    timeline = {}
    for log in logs:
        if group_by == "hour":
            key = log.created_at.strftime("%Y-%m-%d %H:00")
        elif group_by == "day":
            key = log.created_at.strftime("%Y-%m-%d")
        else:  # week
            key = log.created_at.strftime("%Y-W%W")

        if key not in timeline:
            timeline[key] = {"count": 0, "actions": {}}
        timeline[key]["count"] += 1
        action = log.action or "unknown"
        timeline[key]["actions"][action] = timeline[key]["actions"].get(action, 0) + 1

    # Convert to sorted list
    timeline_list = [
        {"period": k, **v}
        for k, v in sorted(timeline.items())
    ]

    return {
        "tenant_id": str(tenant.id),
        "period": period.value,
        "group_by": group_by,
        "timeline": timeline_list,
        "total_activities": len(logs)
    }


# ==================== SUPER ADMIN REPORTS ====================

@router.get("/reports/tenants/overview")
async def get_tenants_overview(
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(require_superadmin())
):
    """Get overview of all tenants (SuperAdmin only)"""
    # Total tenants
    total_result = await db.execute(select(func.count(Tenant.id)))
    total_tenants = total_result.scalar() or 0

    # Active tenants
    active_result = await db.execute(
        select(func.count(Tenant.id)).where(Tenant.is_active == True)
    )
    active_tenants = active_result.scalar() or 0

    # Tenants by plan
    plan_result = await db.execute(
        select(Tenant.plan, func.count(Tenant.id).label("count"))
        .group_by(Tenant.plan)
    )
    by_plan = {row.plan: row.count for row in plan_result}

    # Total users across all tenants
    users_result = await db.execute(select(func.count(TenantUser.id)))
    total_users = users_result.scalar() or 0

    # Aggregate storage usage
    storage_result = await db.execute(
        select(
            func.sum(Tenant.meet_used_hours).label("meet_hours"),
            func.sum(Tenant.docs_used_mb).label("docs_mb"),
            func.sum(Tenant.mail_used_mb).label("mail_mb"),
            func.sum(Tenant.recordings_used_mb).label("recordings_mb")
        )
    )
    storage = storage_result.first()

    # Recent tenant creations
    recent_result = await db.execute(
        select(Tenant)
        .where(Tenant.created_at >= datetime.utcnow() - timedelta(days=30))
        .order_by(Tenant.created_at.desc())
        .limit(10)
    )
    recent_tenants = recent_result.scalars().all()

    return {
        "summary": {
            "total_tenants": total_tenants,
            "active_tenants": active_tenants,
            "suspended_tenants": total_tenants - active_tenants,
            "total_users": total_users
        },
        "by_plan": by_plan,
        "storage_usage": {
            "meet_hours": float(storage.meet_hours or 0),
            "docs_mb": float(storage.docs_mb or 0),
            "mail_mb": float(storage.mail_mb or 0),
            "recordings_mb": float(storage.recordings_mb or 0)
        },
        "recent_tenants": [
            {
                "id": str(t.id),
                "name": t.name,
                "slug": t.slug,
                "plan": t.plan,
                "created_at": t.created_at.isoformat()
            }
            for t in recent_tenants
        ]
    }


@router.get("/reports/activity/global")
async def get_global_activity_report(
    period: ReportPeriod = ReportPeriod.WEEK,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(require_superadmin())
):
    """Get global activity report (SuperAdmin only)"""
    period_start = get_period_start(period)

    # Total activity count
    total_result = await db.execute(
        select(func.count(ActivityLogModel.id)).where(
            ActivityLogModel.created_at >= period_start
        )
    )
    total_activities = total_result.scalar() or 0

    # Activity by action type
    by_action_result = await db.execute(
        select(
            ActivityLogModel.action,
            func.count(ActivityLogModel.id).label("count")
        ).where(
            ActivityLogModel.created_at >= period_start
        ).group_by(ActivityLogModel.action)
        .order_by(desc("count"))
        .limit(20)
    )
    by_action = {row.action: row.count for row in by_action_result}

    # Most active tenants
    active_tenants_result = await db.execute(
        select(
            ActivityLogModel.tenant_id,
            func.count(ActivityLogModel.id).label("count")
        ).where(
            and_(
                ActivityLogModel.created_at >= period_start,
                ActivityLogModel.tenant_id.isnot(None)
            )
        ).group_by(ActivityLogModel.tenant_id)
        .order_by(desc("count"))
        .limit(10)
    )

    # Get tenant names
    top_tenants = []
    for row in active_tenants_result:
        tenant_result = await db.execute(
            select(Tenant).where(Tenant.id == row.tenant_id)
        )
        tenant = tenant_result.scalar_one_or_none()
        if tenant:
            top_tenants.append({
                "tenant_id": str(tenant.id),
                "tenant_name": tenant.name,
                "activity_count": row.count
            })

    return {
        "period": period.value,
        "total_activities": total_activities,
        "by_action": by_action,
        "top_tenants": top_tenants
    }


# ==================== BULK OPERATIONS ====================

@router.post("/tenants/{tenant_id}/bulk/users")
async def bulk_user_action(
    tenant_id: str,
    action: BulkUserAction,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(require_admin())
):
    """Perform bulk action on multiple users"""
    # Get tenant
    result = await db.execute(
        select(Tenant).where(
            or_(
                Tenant.id == uuid.UUID(tenant_id) if len(tenant_id) == 36 else False,
                func.lower(Tenant.slug) == tenant_id.lower()
            )
        )
    )
    tenant = result.scalar_one_or_none()

    if not tenant:
        raise HTTPException(status_code=404, detail="Tenant not found")

    success_count = 0
    failed_count = 0
    errors = []

    for user_id in action.user_ids:
        try:
            user_result = await db.execute(
                select(TenantUser).where(
                    and_(
                        TenantUser.tenant_id == tenant.id,
                        TenantUser.user_id == uuid.UUID(user_id)
                    )
                )
            )
            user = user_result.scalar_one_or_none()

            if not user:
                failed_count += 1
                errors.append(f"User {user_id} not found")
                continue

            if action.action == "activate":
                user.is_active = True
            elif action.action == "deactivate":
                user.is_active = False
            elif action.action == "change_role" and action.role:
                user.role = action.role
            else:
                failed_count += 1
                errors.append(f"Invalid action for user {user_id}")
                continue

            success_count += 1

        except Exception as e:
            failed_count += 1
            errors.append(f"Error processing user {user_id}: {str(e)}")

    await db.commit()

    return {
        "action": action.action,
        "total": len(action.user_ids),
        "success": success_count,
        "failed": failed_count,
        "errors": errors[:10] if errors else None
    }


@router.post("/bulk/tenants")
async def bulk_tenant_action(
    action: BulkTenantAction,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(require_superadmin())
):
    """Perform bulk action on multiple tenants (SuperAdmin only)"""
    success_count = 0
    failed_count = 0
    errors = []

    for tenant_id in action.tenant_ids:
        try:
            result = await db.execute(
                select(Tenant).where(Tenant.id == uuid.UUID(tenant_id))
            )
            tenant = result.scalar_one_or_none()

            if not tenant:
                failed_count += 1
                errors.append(f"Tenant {tenant_id} not found")
                continue

            if action.action == "activate":
                tenant.is_active = True
                tenant.is_suspended = False
            elif action.action == "deactivate":
                tenant.is_active = False
            elif action.action == "suspend":
                tenant.is_suspended = True
            elif action.action in ("change_plan", "update_plan") and action.plan:
                tenant.plan = action.plan
                # Update quotas based on plan
                quotas = {
                    "free": {"max_users": 5, "meet": 10, "docs": 1024, "mail": 512, "recordings": 1024},
                    "starter": {"max_users": 25, "meet": 100, "docs": 10240, "mail": 5120, "recordings": 10240},
                    "business": {"max_users": 100, "meet": 500, "docs": 102400, "mail": 51200, "recordings": 204800},
                    "enterprise": {"max_users": 10000, "meet": 10000, "docs": 1048576, "mail": 524288, "recordings": 2097152}
                }.get(action.plan, {})

                if quotas:
                    tenant.max_users = quotas.get("max_users", tenant.max_users)
                    tenant.meet_quota_hours = quotas.get("meet", tenant.meet_quota_hours)
                    tenant.docs_quota_mb = quotas.get("docs", tenant.docs_quota_mb)
                    tenant.mail_quota_mb = quotas.get("mail", tenant.mail_quota_mb)
                    tenant.recordings_quota_mb = quotas.get("recordings", tenant.recordings_quota_mb)
            else:
                failed_count += 1
                errors.append(f"Invalid action for tenant {tenant_id}")
                continue

            tenant.updated_at = datetime.utcnow()
            success_count += 1

        except Exception as e:
            failed_count += 1
            errors.append(f"Error processing tenant {tenant_id}: {str(e)}")

    await db.commit()

    return {
        "action": action.action,
        "total": len(action.tenant_ids),
        "success": success_count,
        "failed": failed_count,
        "errors": errors[:10] if errors else None
    }


# ==================== EXPORT ENDPOINTS ====================

@router.get("/tenants/{tenant_id}/export/users")
async def export_users(
    tenant_id: str,
    format: ExportFormat = ExportFormat.JSON,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(require_admin())
):
    """Export tenant users data"""
    # Get tenant
    result = await db.execute(
        select(Tenant).where(
            or_(
                Tenant.id == uuid.UUID(tenant_id) if len(tenant_id) == 36 else False,
                func.lower(Tenant.slug) == tenant_id.lower()
            )
        )
    )
    tenant = result.scalar_one_or_none()

    if not tenant:
        raise HTTPException(status_code=404, detail="Tenant not found")

    # Get all users
    users_result = await db.execute(
        select(TenantUser).where(TenantUser.tenant_id == tenant.id)
    )
    users = users_result.scalars().all()

    user_data = [
        {
            "user_id": str(u.user_id),
            "role": u.role,
            "is_active": u.is_active,
            "invited_at": u.invited_at.isoformat() if u.invited_at else None,
            "joined_at": u.joined_at.isoformat() if u.joined_at else None,
            "created_at": u.created_at.isoformat() if u.created_at else None
        }
        for u in users
    ]

    if format == ExportFormat.CSV:
        # Convert to CSV string
        import csv
        import io
        output = io.StringIO()
        if user_data:
            writer = csv.DictWriter(output, fieldnames=user_data[0].keys())
            writer.writeheader()
            writer.writerows(user_data)
        return {
            "format": "csv",
            "content": output.getvalue(),
            "filename": f"{tenant.slug}_users_{datetime.utcnow().strftime('%Y%m%d')}.csv"
        }

    return {
        "format": "json",
        "tenant_id": str(tenant.id),
        "tenant_name": tenant.name,
        "exported_at": datetime.utcnow().isoformat(),
        "users": user_data
    }


@router.get("/tenants/{tenant_id}/export/activity")
async def export_activity(
    tenant_id: str,
    period: ReportPeriod = ReportPeriod.MONTH,
    format: ExportFormat = ExportFormat.JSON,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(require_admin())
):
    """Export tenant activity logs"""
    # Get tenant
    result = await db.execute(
        select(Tenant).where(
            or_(
                Tenant.id == uuid.UUID(tenant_id) if len(tenant_id) == 36 else False,
                func.lower(Tenant.slug) == tenant_id.lower()
            )
        )
    )
    tenant = result.scalar_one_or_none()

    if not tenant:
        raise HTTPException(status_code=404, detail="Tenant not found")

    period_start = get_period_start(period)

    # Get activity logs
    logs_result = await db.execute(
        select(ActivityLogModel)
        .where(
            and_(
                ActivityLogModel.tenant_id == tenant.id,
                ActivityLogModel.created_at >= period_start
            )
        )
        .order_by(ActivityLogModel.created_at.desc())
    )
    logs = logs_result.scalars().all()

    log_data = [
        {
            "id": str(l.id),
            "action": l.action,
            "entity_type": l.entity_type,
            "description": l.description,
            "user_id": str(l.user_id) if l.user_id else None,
            "created_at": l.created_at.isoformat() if l.created_at else None
        }
        for l in logs
    ]

    if format == ExportFormat.CSV:
        import csv
        import io
        output = io.StringIO()
        if log_data:
            writer = csv.DictWriter(output, fieldnames=log_data[0].keys())
            writer.writeheader()
            writer.writerows(log_data)
        return {
            "format": "csv",
            "content": output.getvalue(),
            "filename": f"{tenant.slug}_activity_{datetime.utcnow().strftime('%Y%m%d')}.csv"
        }

    return {
        "format": "json",
        "tenant_id": str(tenant.id),
        "tenant_name": tenant.name,
        "period": period.value,
        "exported_at": datetime.utcnow().isoformat(),
        "activities": log_data
    }
