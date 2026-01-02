"""
Bheem Workspace Admin API - Database-backed Administration Module
With full authentication and RBAC
"""
from fastapi import APIRouter, HTTPException, Depends, Query, Body, Request
from pydantic import BaseModel, EmailStr
from typing import Optional, List, Dict, Any
from datetime import datetime, timedelta
from enum import Enum
from decimal import Decimal
import uuid

from sqlalchemy import select, func, and_, or_
from sqlalchemy.ext.asyncio import AsyncSession

from core.database import get_db
from core.security import (
    get_current_user,
    require_admin,
    require_superadmin,
    has_permission,
    Permission
)
from models.admin_models import (
    Tenant, TenantUser, Domain, DomainDNSRecord,
    Developer, DeveloperProject, ActivityLog as ActivityLogModel
)
from services.mailgun_service import mailgun_service
from services.cloudflare_service import cloudflare_service
from services.mailcow_service import mailcow_service

router = APIRouter()


# ==================== ENUMS ====================

class UserRole(str, Enum):
    ADMIN = "admin"
    MANAGER = "manager"
    MEMBER = "member"

class PlanType(str, Enum):
    FREE = "free"
    STARTER = "starter"
    BUSINESS = "business"
    ENTERPRISE = "enterprise"

class ServiceType(str, Enum):
    MAIL = "mail"
    DOCS = "docs"
    MEET = "meet"

class DomainType(str, Enum):
    EMAIL = "email"
    WORKSPACE = "workspace"
    CUSTOM = "custom"

# ==================== PYDANTIC MODELS ====================

# Tenant/Organization Models
class TenantCreate(BaseModel):
    name: str
    slug: str
    domain: Optional[str] = None
    owner_email: EmailStr
    plan: PlanType = PlanType.FREE

class TenantUpdate(BaseModel):
    name: Optional[str] = None
    domain: Optional[str] = None
    plan: Optional[PlanType] = None
    is_active: Optional[bool] = None
    settings: Optional[Dict[str, Any]] = None

class TenantResponse(BaseModel):
    id: str
    name: str
    slug: str
    domain: Optional[str]
    owner_email: str
    plan: str
    is_active: bool
    is_suspended: bool
    settings: Dict[str, Any]
    # Quotas
    max_users: int
    meet_quota_hours: int
    docs_quota_mb: int
    mail_quota_mb: int
    recordings_quota_mb: int
    # Usage
    meet_used_hours: float
    docs_used_mb: float
    mail_used_mb: float
    recordings_used_mb: float
    created_at: datetime
    user_count: int = 0

    class Config:
        from_attributes = True

# User Models
class UserCreate(BaseModel):
    email: EmailStr
    name: str
    role: UserRole = UserRole.MEMBER
    user_id: Optional[str] = None  # Reference to bheem-core user (optional for invites)

class UserUpdate(BaseModel):
    role: Optional[UserRole] = None
    is_active: Optional[bool] = None
    permissions: Optional[Dict[str, Any]] = None

class UserResponse(BaseModel):
    id: str
    tenant_id: str
    user_id: str
    email: Optional[str] = None
    name: Optional[str] = None
    role: str
    is_active: bool
    permissions: Dict[str, Any]
    invited_at: Optional[datetime]
    joined_at: Optional[datetime]
    created_at: datetime

    class Config:
        from_attributes = True

# Domain Models
class DomainCreate(BaseModel):
    domain: str
    domain_type: DomainType = DomainType.EMAIL
    is_primary: bool = False

class DomainResponse(BaseModel):
    id: str
    tenant_id: str
    domain: str
    domain_type: str
    is_primary: bool
    is_active: bool
    verification_status: str = "pending"
    mail_enabled: bool = False
    meet_enabled: bool = False
    spf_verified: bool
    dkim_verified: bool
    mx_verified: bool
    ownership_verified: bool
    mailgun_domain_id: Optional[str]
    cloudflare_zone_id: Optional[str]
    created_at: datetime
    verified_at: Optional[datetime]

    class Config:
        from_attributes = True

# Mail Admin Models
class MailboxCreate(BaseModel):
    local_part: str
    domain: str
    name: str
    password: str
    quota_mb: int = 1024

class MailboxResponse(BaseModel):
    id: str
    email: str
    name: str
    active: bool
    quota_mb: int
    used_mb: float
    created_at: datetime

# Docs Admin Models
class StorageQuotaUpdate(BaseModel):
    user_id: str
    quota_mb: int

class SharedFolderCreate(BaseModel):
    name: str
    path: str
    allowed_users: List[str]
    permissions: str = "read"

# Meet Admin Models
class MeetingSettingsUpdate(BaseModel):
    max_participants: int = 100
    max_duration_minutes: int = 480
    enable_recording: bool = True
    enable_waiting_room: bool = True
    enable_chat: bool = True
    enable_screen_share: bool = True

class RecordingPolicy(BaseModel):
    auto_record: bool = False
    retention_days: int = 90
    drm_enabled: bool = True
    watermark_enabled: bool = True

# Developer Models
class DeveloperCreate(BaseModel):
    user_id: str
    role: str  # lead_developer, developer, junior_developer
    ssh_public_key: Optional[str] = None
    github_username: Optional[str] = None

class DeveloperProjectAccess(BaseModel):
    project_name: str
    access_level: str  # read, write, admin
    git_branch_pattern: Optional[str] = None
    can_push_to_main: bool = False
    can_deploy_staging: bool = False
    can_deploy_production: bool = False

# Analytics Models
class UsageStats(BaseModel):
    service: str
    period: str
    total_usage: float
    quota: float
    usage_percent: float
    trend: str

class ActivityLogResponse(BaseModel):
    id: str
    tenant_id: Optional[str]
    user_id: Optional[str]
    action: str
    entity_type: Optional[str]
    entity_id: Optional[str]
    description: Optional[str]
    ip_address: Optional[str]
    extra_data: Optional[Dict[str, Any]]
    created_at: datetime

    class Config:
        from_attributes = True

# ==================== HELPER FUNCTIONS ====================

def is_valid_uuid(value: str) -> bool:
    """Check if a string is a valid UUID"""
    try:
        uuid.UUID(value)
        return True
    except (ValueError, TypeError):
        return False

async def resolve_tenant_id(tenant_id: str, db: AsyncSession) -> uuid.UUID:
    """
    Resolve tenant_id which can be either a UUID or a slug/company_code.
    Returns the actual UUID of the tenant.
    """
    # First check if it's a valid UUID
    if is_valid_uuid(tenant_id):
        return uuid.UUID(tenant_id)

    # Otherwise, try to find tenant by slug (case-insensitive)
    result = await db.execute(
        select(Tenant).where(
            or_(
                func.lower(Tenant.slug) == tenant_id.lower(),
                func.lower(Tenant.domain) == tenant_id.lower()
            )
        )
    )
    tenant = result.scalar_one_or_none()

    if tenant:
        return tenant.id

    # Auto-create tenant for the company_code if it doesn't exist
    quotas = get_plan_quotas("starter")
    new_tenant = Tenant(
        name=f"Organization {tenant_id}",
        slug=tenant_id.lower(),
        owner_email=f"admin@{tenant_id.lower()}.workspace",
        plan="starter",
        max_users=quotas["max_users"],
        meet_quota_hours=quotas["meet"],
        docs_quota_mb=quotas["docs"],
        mail_quota_mb=quotas["mail"],
        recordings_quota_mb=quotas["recordings"]
    )
    db.add(new_tenant)
    await db.commit()
    await db.refresh(new_tenant)

    return new_tenant.id

def get_plan_quotas(plan: str) -> dict:
    """Get quotas based on plan type"""
    quotas = {
        "free": {"max_users": 5, "meet": 10, "docs": 1024, "mail": 512, "recordings": 1024},
        "starter": {"max_users": 25, "meet": 100, "docs": 10240, "mail": 5120, "recordings": 10240},
        "business": {"max_users": 100, "meet": 500, "docs": 102400, "mail": 51200, "recordings": 204800},
        "enterprise": {"max_users": 10000, "meet": 10000, "docs": 1048576, "mail": 524288, "recordings": 2097152}
    }
    return quotas.get(plan, quotas["free"])

async def log_activity(
    db: AsyncSession,
    action: str,
    tenant_id: str = None,
    user_id: str = None,
    entity_type: str = None,
    entity_id: str = None,
    description: str = None,
    ip_address: str = None,
    metadata: dict = None
):
    """Log an activity to the audit log"""
    log_entry = ActivityLogModel(
        tenant_id=uuid.UUID(tenant_id) if tenant_id else None,
        user_id=uuid.UUID(user_id) if user_id else None,
        action=action,
        entity_type=entity_type,
        entity_id=uuid.UUID(entity_id) if entity_id else None,
        description=description,
        ip_address=ip_address,
        extra_data=metadata or {}
    )
    db.add(log_entry)
    await db.commit()

# ==================== TENANT ENDPOINTS ====================

@router.get("/tenants", response_model=List[TenantResponse])
async def list_tenants(
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(require_superadmin()),
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=100),
    search: Optional[str] = None,
    plan: Optional[PlanType] = None,
    is_active: Optional[bool] = None
):
    """List all tenants/organizations (SuperAdmin only)"""
    query = select(Tenant)

    if search:
        query = query.where(
            or_(
                Tenant.name.ilike(f"%{search}%"),
                Tenant.slug.ilike(f"%{search}%")
            )
        )
    if plan:
        query = query.where(Tenant.plan == plan.value)
    if is_active is not None:
        query = query.where(Tenant.is_active == is_active)

    query = query.offset(skip).limit(limit).order_by(Tenant.created_at.desc())

    result = await db.execute(query)
    tenants = result.scalars().all()

    # Get user counts for each tenant
    responses = []
    for tenant in tenants:
        user_count_query = select(func.count(TenantUser.id)).where(
            TenantUser.tenant_id == tenant.id
        )
        user_count_result = await db.execute(user_count_query)
        user_count = user_count_result.scalar() or 0

        responses.append(TenantResponse(
            id=str(tenant.id),
            name=tenant.name,
            slug=tenant.slug,
            domain=tenant.domain,
            owner_email=tenant.owner_email,
            plan=tenant.plan,
            is_active=tenant.is_active,
            is_suspended=tenant.is_suspended or False,
            settings=tenant.settings or {},
            max_users=tenant.max_users,
            meet_quota_hours=tenant.meet_quota_hours,
            docs_quota_mb=tenant.docs_quota_mb,
            mail_quota_mb=tenant.mail_quota_mb,
            recordings_quota_mb=tenant.recordings_quota_mb,
            meet_used_hours=float(tenant.meet_used_hours or 0),
            docs_used_mb=float(tenant.docs_used_mb or 0),
            mail_used_mb=float(tenant.mail_used_mb or 0),
            recordings_used_mb=float(tenant.recordings_used_mb or 0),
            created_at=tenant.created_at,
            user_count=user_count
        ))

    return responses

@router.post("/tenants", response_model=TenantResponse)
async def create_tenant(
    tenant: TenantCreate,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(require_superadmin())
):
    """Create a new tenant/organization (SuperAdmin only)"""
    # Check if slug already exists
    existing = await db.execute(
        select(Tenant).where(Tenant.slug == tenant.slug)
    )
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="Tenant slug already exists")

    quotas = get_plan_quotas(tenant.plan.value)

    new_tenant = Tenant(
        name=tenant.name,
        slug=tenant.slug,
        domain=tenant.domain,
        owner_email=tenant.owner_email,
        plan=tenant.plan.value,
        max_users=quotas["max_users"],
        meet_quota_hours=quotas["meet"],
        docs_quota_mb=quotas["docs"],
        mail_quota_mb=quotas["mail"],
        recordings_quota_mb=quotas["recordings"]
    )

    db.add(new_tenant)
    await db.commit()
    await db.refresh(new_tenant)

    await log_activity(
        db,
        action="tenant_created",
        tenant_id=str(new_tenant.id),
        entity_type="tenant",
        entity_id=str(new_tenant.id),
        description=f"Created tenant: {tenant.name}"
    )

    return TenantResponse(
        id=str(new_tenant.id),
        name=new_tenant.name,
        slug=new_tenant.slug,
        domain=new_tenant.domain,
        owner_email=new_tenant.owner_email,
        plan=new_tenant.plan,
        is_active=new_tenant.is_active,
        is_suspended=new_tenant.is_suspended or False,
        settings=new_tenant.settings or {},
        max_users=new_tenant.max_users,
        meet_quota_hours=new_tenant.meet_quota_hours,
        docs_quota_mb=new_tenant.docs_quota_mb,
        mail_quota_mb=new_tenant.mail_quota_mb,
        recordings_quota_mb=new_tenant.recordings_quota_mb,
        meet_used_hours=0,
        docs_used_mb=0,
        mail_used_mb=0,
        recordings_used_mb=0,
        created_at=new_tenant.created_at,
        user_count=0
    )

@router.get("/tenants/{tenant_id}", response_model=TenantResponse)
async def get_tenant(
    tenant_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    """Get tenant details (authenticated users can access their own tenant)"""
    # Check access: SuperAdmin can access any, others only their own
    if current_user.get("role") != "SuperAdmin":
        user_company = current_user.get("company_code") or current_user.get("company_id")
        if user_company and str(tenant_id).lower() != str(user_company).lower():
            raise HTTPException(status_code=403, detail="Access denied to this tenant")
    resolved_id = await resolve_tenant_id(tenant_id, db)
    result = await db.execute(
        select(Tenant).where(Tenant.id == resolved_id)
    )
    tenant = result.scalar_one_or_none()

    if not tenant:
        raise HTTPException(status_code=404, detail="Tenant not found")

    user_count_result = await db.execute(
        select(func.count(TenantUser.id)).where(TenantUser.tenant_id == tenant.id)
    )
    user_count = user_count_result.scalar() or 0

    return TenantResponse(
        id=str(tenant.id),
        name=tenant.name,
        slug=tenant.slug,
        domain=tenant.domain,
        owner_email=tenant.owner_email,
        plan=tenant.plan,
        is_active=tenant.is_active,
        is_suspended=tenant.is_suspended or False,
        settings=tenant.settings or {},
        max_users=tenant.max_users,
        meet_quota_hours=tenant.meet_quota_hours,
        docs_quota_mb=tenant.docs_quota_mb,
        mail_quota_mb=tenant.mail_quota_mb,
        recordings_quota_mb=tenant.recordings_quota_mb,
        meet_used_hours=float(tenant.meet_used_hours or 0),
        docs_used_mb=float(tenant.docs_used_mb or 0),
        mail_used_mb=float(tenant.mail_used_mb or 0),
        recordings_used_mb=float(tenant.recordings_used_mb or 0),
        created_at=tenant.created_at,
        user_count=user_count
    )

@router.patch("/tenants/{tenant_id}", response_model=TenantResponse)
async def update_tenant(
    tenant_id: str,
    update: TenantUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(require_admin())
):
    """Update tenant settings (Admin or SuperAdmin)"""
    resolved_id = await resolve_tenant_id(tenant_id, db)
    result = await db.execute(
        select(Tenant).where(Tenant.id == resolved_id)
    )
    tenant = result.scalar_one_or_none()

    if not tenant:
        raise HTTPException(status_code=404, detail="Tenant not found")

    update_data = update.model_dump(exclude_unset=True)

    # If plan is being updated, update quotas too
    if "plan" in update_data:
        quotas = get_plan_quotas(update_data["plan"])
        update_data["max_users"] = quotas["max_users"]
        update_data["meet_quota_hours"] = quotas["meet"]
        update_data["docs_quota_mb"] = quotas["docs"]
        update_data["mail_quota_mb"] = quotas["mail"]
        update_data["recordings_quota_mb"] = quotas["recordings"]

    for field, value in update_data.items():
        setattr(tenant, field, value)

    tenant.updated_at = datetime.utcnow()
    await db.commit()
    await db.refresh(tenant)

    await log_activity(
        db,
        action="tenant_updated",
        tenant_id=tenant_id,
        entity_type="tenant",
        entity_id=tenant_id,
        description=f"Updated tenant: {tenant.name}",
        metadata=update_data
    )

    # Get user count for response
    user_count_result = await db.execute(
        select(func.count(TenantUser.id)).where(TenantUser.tenant_id == tenant.id)
    )
    user_count = user_count_result.scalar() or 0

    return TenantResponse(
        id=str(tenant.id),
        name=tenant.name,
        slug=tenant.slug,
        domain=tenant.domain,
        owner_email=tenant.owner_email,
        plan=tenant.plan,
        is_active=tenant.is_active,
        is_suspended=tenant.is_suspended or False,
        settings=tenant.settings or {},
        max_users=tenant.max_users,
        meet_quota_hours=tenant.meet_quota_hours,
        docs_quota_mb=tenant.docs_quota_mb,
        mail_quota_mb=tenant.mail_quota_mb,
        recordings_quota_mb=tenant.recordings_quota_mb,
        meet_used_hours=float(tenant.meet_used_hours or 0),
        docs_used_mb=float(tenant.docs_used_mb or 0),
        mail_used_mb=float(tenant.mail_used_mb or 0),
        recordings_used_mb=float(tenant.recordings_used_mb or 0),
        created_at=tenant.created_at,
        user_count=user_count
    )

@router.delete("/tenants/{tenant_id}")
async def delete_tenant(
    tenant_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(require_superadmin())
):
    """Delete a tenant (soft delete) - SuperAdmin only"""
    resolved_id = await resolve_tenant_id(tenant_id, db)
    result = await db.execute(
        select(Tenant).where(Tenant.id == resolved_id)
    )
    tenant = result.scalar_one_or_none()

    if not tenant:
        raise HTTPException(status_code=404, detail="Tenant not found")

    tenant.is_active = False
    tenant.updated_at = datetime.utcnow()
    await db.commit()

    await log_activity(
        db,
        action="tenant_deactivated",
        tenant_id=tenant_id,
        entity_type="tenant",
        entity_id=tenant_id,
        description=f"Deactivated tenant: {tenant.name}"
    )

    return {"message": "Tenant deactivated", "tenant_id": tenant_id}

# ==================== TENANT USER ENDPOINTS ====================

@router.get("/tenants/{tenant_id}/users", response_model=List[UserResponse])
async def list_tenant_users(
    tenant_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user),
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=100),
    role: Optional[UserRole] = None
):
    """List users in a tenant (requires authentication)"""
    resolved_id = await resolve_tenant_id(tenant_id, db)
    query = select(TenantUser).where(
        TenantUser.tenant_id == resolved_id
    )

    if role:
        query = query.where(TenantUser.role == role.value)

    query = query.offset(skip).limit(limit).order_by(TenantUser.created_at.desc())

    result = await db.execute(query)
    users = result.scalars().all()

    return [
        UserResponse(
            id=str(u.id),
            tenant_id=str(u.tenant_id),
            user_id=str(u.user_id),
            email=u.email,
            name=u.name,
            role=u.role,
            is_active=u.is_active,
            permissions=u.permissions or {},
            invited_at=u.invited_at,
            joined_at=u.joined_at,
            created_at=u.created_at
        )
        for u in users
    ]

@router.post("/tenants/{tenant_id}/users", response_model=UserResponse)
async def add_tenant_user(
    tenant_id: str,
    user: UserCreate,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(require_admin())
):
    """Add a user to tenant (Admin or SuperAdmin)"""
    # Resolve tenant ID (supports UUID or slug)
    resolved_id = await resolve_tenant_id(tenant_id, db)

    # Check tenant exists
    tenant_result = await db.execute(
        select(Tenant).where(Tenant.id == resolved_id)
    )
    tenant = tenant_result.scalar_one_or_none()
    if not tenant:
        raise HTTPException(status_code=404, detail="Tenant not found")

    # Check user limit
    user_count_result = await db.execute(
        select(func.count(TenantUser.id)).where(
            TenantUser.tenant_id == resolved_id
        )
    )
    user_count = user_count_result.scalar() or 0

    if user_count >= tenant.max_users:
        raise HTTPException(
            status_code=400,
            detail=f"User limit reached ({tenant.max_users}). Upgrade plan for more users."
        )

    # Get or generate user_id
    if user.user_id and user.user_id.strip():
        try:
            target_user_id = uuid.UUID(user.user_id)
        except ValueError:
            raise HTTPException(status_code=400, detail="Invalid user_id format")
    else:
        # For invitations, generate a placeholder UUID
        # In production, this would lookup/create user in Passport
        target_user_id = uuid.uuid4()

    # Check if user already in tenant by email
    existing = await db.execute(
        select(TenantUser).where(
            and_(
                TenantUser.tenant_id == resolved_id,
                TenantUser.email == user.email
            )
        )
    )
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="User with this email already in tenant")

    new_user = TenantUser(
        tenant_id=resolved_id,
        user_id=target_user_id,
        email=user.email,
        name=user.name,
        role=user.role.value,
        invited_at=datetime.utcnow()
    )

    db.add(new_user)
    await db.commit()
    await db.refresh(new_user)

    await log_activity(
        db,
        action="user_added",
        tenant_id=tenant_id,
        user_id=str(target_user_id),
        entity_type="tenant_user",
        entity_id=str(new_user.id),
        description=f"Added user {user.email} to tenant with role: {user.role.value}"
    )

    return UserResponse(
        id=str(new_user.id),
        tenant_id=str(new_user.tenant_id),
        user_id=str(new_user.user_id),
        email=new_user.email,
        name=new_user.name,
        role=new_user.role,
        is_active=new_user.is_active,
        permissions=new_user.permissions or {},
        invited_at=new_user.invited_at,
        joined_at=new_user.joined_at,
        created_at=new_user.created_at
    )

@router.patch("/tenants/{tenant_id}/users/{user_id}", response_model=UserResponse)
async def update_tenant_user(
    tenant_id: str,
    user_id: str,
    update: UserUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(require_admin())
):
    """Update user in tenant (Admin or SuperAdmin)"""
    resolved_id = await resolve_tenant_id(tenant_id, db)
    result = await db.execute(
        select(TenantUser).where(
            and_(
                TenantUser.tenant_id == resolved_id,
                TenantUser.user_id == uuid.UUID(user_id)
            )
        )
    )
    user = result.scalar_one_or_none()

    if not user:
        raise HTTPException(status_code=404, detail="User not found in tenant")

    update_data = update.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        if field == "role" and value:
            setattr(user, field, value.value if isinstance(value, UserRole) else value)
        else:
            setattr(user, field, value)

    user.updated_at = datetime.utcnow()
    await db.commit()
    await db.refresh(user)

    return UserResponse(
        id=str(user.id),
        tenant_id=str(user.tenant_id),
        user_id=str(user.user_id),
        role=user.role,
        is_active=user.is_active,
        permissions=user.permissions or {},
        invited_at=user.invited_at,
        joined_at=user.joined_at,
        created_at=user.created_at
    )

@router.delete("/tenants/{tenant_id}/users/{user_id}")
async def remove_tenant_user(
    tenant_id: str,
    user_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(require_admin())
):
    """Remove user from tenant (Admin or SuperAdmin)"""
    resolved_id = await resolve_tenant_id(tenant_id, db)
    result = await db.execute(
        select(TenantUser).where(
            and_(
                TenantUser.tenant_id == resolved_id,
                TenantUser.user_id == uuid.UUID(user_id)
            )
        )
    )
    user = result.scalar_one_or_none()

    if not user:
        raise HTTPException(status_code=404, detail="User not found in tenant")

    user.is_active = False
    user.updated_at = datetime.utcnow()
    await db.commit()

    return {"message": "User removed from tenant", "user_id": user_id}

# ==================== DOMAIN ENDPOINTS ====================

@router.get("/tenants/{tenant_id}/domains", response_model=List[DomainResponse])
async def list_domains(
    tenant_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    """List domains for tenant (requires authentication)"""
    resolved_id = await resolve_tenant_id(tenant_id, db)

    result = await db.execute(
        select(Domain).where(
            and_(
                Domain.tenant_id == resolved_id,
                Domain.is_active == True
            )
        )
    )
    domains = result.scalars().all()

    def get_verification_status(d):
        if d.ownership_verified:
            return "verified"
        return "pending"

    return [
        DomainResponse(
            id=str(d.id),
            tenant_id=str(d.tenant_id),
            domain=d.domain,
            domain_type=d.domain_type,
            is_primary=d.is_primary,
            is_active=d.is_active,
            verification_status=get_verification_status(d),
            mail_enabled=d.mailgun_domain_id is not None,
            meet_enabled=False,
            spf_verified=d.spf_verified or False,
            dkim_verified=d.dkim_verified or False,
            mx_verified=d.mx_verified or False,
            ownership_verified=d.ownership_verified or False,
            mailgun_domain_id=d.mailgun_domain_id,
            cloudflare_zone_id=d.cloudflare_zone_id,
            created_at=d.created_at,
            verified_at=d.verified_at
        )
        for d in domains
    ]

@router.post("/tenants/{tenant_id}/domains", response_model=DomainResponse)
async def add_domain(
    tenant_id: str,
    domain_data: DomainCreate,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(require_admin())
):
    """Add a domain to tenant with Mailgun and Cloudflare setup (Admin or SuperAdmin)"""
    resolved_id = await resolve_tenant_id(tenant_id, db)

    # Check tenant exists
    tenant_result = await db.execute(
        select(Tenant).where(Tenant.id == resolved_id)
    )
    tenant = tenant_result.scalar_one_or_none()
    if not tenant:
        raise HTTPException(status_code=404, detail="Tenant not found")

    # Check domain doesn't already exist
    existing = await db.execute(
        select(Domain).where(Domain.domain == domain_data.domain)
    )
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="Domain already registered")

    # Generate verification token
    verification_token = f"bheem-verify-{uuid.uuid4().hex[:16]}"

    # Create domain in database
    new_domain = Domain(
        tenant_id=resolved_id,
        domain=domain_data.domain,
        domain_type=domain_data.domain_type.value,
        is_primary=domain_data.is_primary,
        verification_token=verification_token
    )

    db.add(new_domain)
    await db.commit()
    await db.refresh(new_domain)

    # Secondary operations - don't fail the request if these fail
    try:
        # Add to Mailgun for email domains
        if domain_data.domain_type == DomainType.EMAIL:
            mailgun_result = await mailgun_service.add_domain(domain_data.domain)

            # Check if domain was added successfully OR already exists in Mailgun
            domain_in_mailgun = False
            if "error" not in mailgun_result:
                domain_in_mailgun = True
            elif "already exists" in str(mailgun_result.get("error", "")).lower() or \
                 "already been taken" in str(mailgun_result.get("error", "")).lower():
                # Domain already exists in Mailgun - that's fine, we can still use it
                domain_in_mailgun = True
                print(f"Domain {domain_data.domain} already exists in Mailgun, using existing")

            if domain_in_mailgun:
                new_domain.mailgun_domain_id = domain_data.domain

                # Get DNS records from Mailgun
                dns_records = await mailgun_service.get_dns_records(domain_data.domain)

                # Save sending DNS records (SPF, DKIM)
                if "sending_dns_records" in dns_records:
                    for record in dns_records["sending_dns_records"]:
                        dns_record = DomainDNSRecord(
                            domain_id=new_domain.id,
                            record_type=record.get("record_type", "TXT"),
                            name=record.get("name", domain_data.domain),
                            value=record.get("value", ""),
                            priority=record.get("priority")
                        )
                        db.add(dns_record)

                # Save receiving DNS records (MX)
                if "receiving_dns_records" in dns_records:
                    for record in dns_records["receiving_dns_records"]:
                        dns_record = DomainDNSRecord(
                            domain_id=new_domain.id,
                            record_type=record.get("record_type", "MX"),
                            name=record.get("name", domain_data.domain),
                            value=record.get("value", ""),
                            priority=record.get("priority")
                        )
                        db.add(dns_record)

                await db.commit()

        # Check Cloudflare zone
        zone = await cloudflare_service.get_zone_by_name(domain_data.domain)
        if zone:
            new_domain.cloudflare_zone_id = zone.get("id")
            await db.commit()

        await db.refresh(new_domain)

        await log_activity(
            db,
            action="domain_added",
            tenant_id=tenant_id,
            entity_type="domain",
            entity_id=str(new_domain.id),
            description=f"Added domain: {domain_data.domain}"
        )
    except Exception as e:
        # Log error but don't fail - domain was already added successfully
        import traceback
        print(f"Warning: Secondary domain setup failed: {e}")
        print(traceback.format_exc())

    # Determine verification status
    verification_status = "pending"
    if new_domain.ownership_verified:
        verification_status = "verified"

    return DomainResponse(
        id=str(new_domain.id),
        tenant_id=str(new_domain.tenant_id),
        domain=new_domain.domain,
        domain_type=new_domain.domain_type,
        is_primary=new_domain.is_primary,
        is_active=new_domain.is_active,
        verification_status=verification_status,
        mail_enabled=new_domain.mailgun_domain_id is not None,
        meet_enabled=False,
        spf_verified=new_domain.spf_verified or False,
        dkim_verified=new_domain.dkim_verified or False,
        mx_verified=new_domain.mx_verified or False,
        ownership_verified=new_domain.ownership_verified or False,
        mailgun_domain_id=new_domain.mailgun_domain_id,
        cloudflare_zone_id=new_domain.cloudflare_zone_id,
        created_at=new_domain.created_at,
        verified_at=new_domain.verified_at
    )

@router.get("/tenants/{tenant_id}/domains/{domain_id}/dns-records")
async def get_domain_dns_records(
    tenant_id: str,
    domain_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    """Get required DNS records for domain verification (requires authentication)"""
    resolved_id = await resolve_tenant_id(tenant_id, db)
    result = await db.execute(
        select(Domain).where(
            and_(
                Domain.id == uuid.UUID(domain_id),
                Domain.tenant_id == resolved_id
            )
        )
    )
    domain = result.scalar_one_or_none()

    if not domain:
        raise HTTPException(status_code=404, detail="Domain not found")

    # Get stored DNS records
    records_result = await db.execute(
        select(DomainDNSRecord).where(DomainDNSRecord.domain_id == domain.id)
    )
    records = records_result.scalars().all()

    # Also add ownership verification record
    verification_record = {
        "record_type": "TXT",
        "name": domain.domain,
        "value": domain.verification_token,
        "purpose": "ownership_verification"
    }

    def get_record_purpose(record):
        """Determine the purpose of a DNS record"""
        if "domainkey" in record.name.lower():
            return "DKIM (Email Authentication)"
        elif "spf" in record.value.lower():
            return "SPF (Email Authentication)"
        elif record.record_type == "MX":
            return "Mail Exchange"
        elif record.record_type == "CNAME":
            return "Email Tracking"
        else:
            return "Email Configuration"

    return {
        "domain": domain.domain,
        "verification_record": verification_record,
        "email_records": [
            {
                "id": str(r.id),
                "record_type": r.record_type,
                "name": r.name,
                "value": r.value,
                "priority": r.priority,
                "purpose": get_record_purpose(r),
                "is_verified": r.is_verified
            }
            for r in records
        ]
    }

@router.post("/tenants/{tenant_id}/domains/{domain_id}/verify")
async def verify_domain(
    tenant_id: str,
    domain_id: str,
    auto_setup: bool = True,  # Auto-add missing DNS records via Cloudflare
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(require_admin())
):
    """Verify domain DNS records (Admin or SuperAdmin)"""
    resolved_id = await resolve_tenant_id(tenant_id, db)
    result = await db.execute(
        select(Domain).where(
            and_(
                Domain.id == uuid.UUID(domain_id),
                Domain.tenant_id == resolved_id
            )
        )
    )
    domain = result.scalar_one_or_none()

    if not domain:
        raise HTTPException(status_code=404, detail="Domain not found")

    verification_results = {
        "domain": domain.domain,
        "ownership_verified": False,
        "spf_verified": False,
        "dkim_verified": False,
        "mx_verified": False,
        "dns_records_added": []
    }

    # Auto-setup DNS records in Cloudflare if zone is managed
    if auto_setup and domain.cloudflare_zone_id:
        try:
            # Add ownership verification TXT record
            existing_records = await cloudflare_service.list_dns_records(
                zone_id=domain.cloudflare_zone_id,
                record_type="TXT",
                name=domain.domain
            )
            has_verification_token = any(
                domain.verification_token in r.get("content", "")
                for r in existing_records
            )

            if not has_verification_token and domain.verification_token:
                result = await cloudflare_service.create_dns_record(
                    zone_id=domain.cloudflare_zone_id,
                    record_type="TXT",
                    name=domain.domain,
                    content=domain.verification_token,
                    ttl=3600,
                    proxied=False
                )
                if result.get("success"):
                    verification_results["dns_records_added"].append("Ownership verification TXT")

            # Get Mailgun DNS records and add missing ones
            if domain.mailgun_domain_id:
                mailgun_dns = await mailgun_service.get_dns_records(domain.domain)

                # Add DKIM record if missing
                for record in mailgun_dns.get("sending_dns_records", []):
                    if "_domainkey" in record.get("name", "") and record.get("record_type") == "TXT":
                        dkim_name = record.get("name")
                        dkim_value = record.get("value")

                        # Check if DKIM exists
                        existing_dkim = await cloudflare_service.list_dns_records(
                            zone_id=domain.cloudflare_zone_id,
                            record_type="TXT",
                            name=dkim_name
                        )

                        if not existing_dkim:
                            result = await cloudflare_service.create_dns_record(
                                zone_id=domain.cloudflare_zone_id,
                                record_type="TXT",
                                name=dkim_name,
                                content=dkim_value,
                                ttl=3600,
                                proxied=False
                            )
                            if result.get("success"):
                                verification_results["dns_records_added"].append(f"DKIM TXT ({dkim_name})")

        except Exception as e:
            print(f"Auto-setup DNS failed: {e}")

    # Verify with Mailgun
    if domain.mailgun_domain_id:
        mailgun_result = await mailgun_service.verify_domain(domain.domain)
        if "error" not in mailgun_result:
            # Parse sending_dns_records for SPF and DKIM
            spf_valid = False
            dkim_valid = False
            for record in mailgun_result.get("sending_dns_records", []):
                # SPF record check
                if record.get("record_type") == "TXT" and "spf" in record.get("value", "").lower():
                    spf_valid = record.get("valid") == "valid"
                # DKIM record check
                if "_domainkey" in record.get("name", "") and record.get("record_type") == "TXT":
                    dkim_valid = record.get("valid") == "valid"

            # Parse receiving_dns_records for MX
            mx_valid = False
            for record in mailgun_result.get("receiving_dns_records", []):
                if record.get("record_type") == "MX":
                    cached = record.get("cached", [])
                    for c in cached:
                        if "mailgun" in c.lower():
                            mx_valid = True
                            break

            verification_results["spf_verified"] = spf_valid
            verification_results["dkim_verified"] = dkim_valid
            verification_results["mx_verified"] = mx_valid

            domain.spf_verified = spf_valid
            domain.dkim_verified = dkim_valid
            domain.mx_verified = mx_valid

    # Check ownership via Cloudflare (if configured)
    if domain.cloudflare_zone_id:
        ownership_check = await cloudflare_service.verify_dns_record(
            zone_id=domain.cloudflare_zone_id,
            record_type="TXT",
            name=domain.domain,
            expected_content=domain.verification_token
        )
        verification_results["ownership_verified"] = ownership_check
        domain.ownership_verified = ownership_check
    else:
        # Fallback: Direct DNS lookup for ownership verification
        import dns.resolver
        try:
            answers = dns.resolver.resolve(domain.domain, 'TXT')
            for rdata in answers:
                txt_value = str(rdata).strip('"')
                if domain.verification_token and domain.verification_token in txt_value:
                    verification_results["ownership_verified"] = True
                    domain.ownership_verified = True
                    break
        except Exception:
            # DNS lookup failed, ownership not verified
            pass

    # Update verified_at if all checks pass
    if all([
        domain.ownership_verified,
        domain.spf_verified,
        domain.dkim_verified,
        domain.mx_verified
    ]):
        domain.verified_at = datetime.utcnow()

    await db.commit()

    return verification_results

@router.delete("/tenants/{tenant_id}/domains/{domain_id}")
async def remove_domain(
    tenant_id: str,
    domain_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(require_admin())
):
    """Remove a domain from tenant (Admin or SuperAdmin)"""
    resolved_id = await resolve_tenant_id(tenant_id, db)
    result = await db.execute(
        select(Domain).where(
            and_(
                Domain.id == uuid.UUID(domain_id),
                Domain.tenant_id == resolved_id
            )
        )
    )
    domain = result.scalar_one_or_none()

    if not domain:
        raise HTTPException(status_code=404, detail="Domain not found")

    # Remove from Mailgun
    if domain.mailgun_domain_id:
        await mailgun_service.delete_domain(domain.domain)

    domain.is_active = False
    await db.commit()

    return {"message": "Domain removed", "domain": domain.domain}

# ==================== MAIL ADMIN ENDPOINTS ====================

@router.get("/tenants/{tenant_id}/mail/domains")
async def list_mail_domains(
    tenant_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    """List mail domains from Mailcow (requires authentication)"""
    raw_domains = await mailcow_service.get_domains()

    def safe_int(val, default=0):
        """Safely convert value to int"""
        try:
            return int(val) if val else default
        except (ValueError, TypeError):
            return default

    # Transform Mailcow response to frontend expected format
    domains = []
    for d in raw_domains:
        domain_name = d.get("domain_name", "")
        if domain_name:
            max_quota = safe_int(d.get("max_quota_for_domain", 0))
            bytes_total = safe_int(d.get("bytes_total", 0))
            domains.append({
                "id": domain_name,
                "domain": domain_name,
                "is_active": d.get("active", 0) == 1 or d.get("active") == "1",
                "mailboxes": safe_int(d.get("mboxes_in_domain", 0)),
                "max_mailboxes": safe_int(d.get("max_num_mboxes_for_domain", 0)),
                "quota_mb": max_quota / (1024 * 1024) if max_quota else 0,
                "used_quota_mb": bytes_total / (1024 * 1024) if bytes_total else 0,
            })

    return domains

@router.get("/tenants/{tenant_id}/mail/mailboxes")
async def list_mailboxes(
    tenant_id: str,
    domain: Optional[str] = None,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    """List mailboxes via Mailcow (requires authentication)"""
    raw_mailboxes = await mailcow_service.get_mailboxes()

    if domain:
        raw_mailboxes = [m for m in raw_mailboxes if m.get("domain") == domain]

    # Transform Mailcow response to frontend expected format
    mailboxes = []
    for m in raw_mailboxes:
        mailboxes.append({
            "id": m.get("username", ""),
            "email": m.get("username", ""),
            "display_name": m.get("name", ""),
            "is_active": m.get("active", 0) == 1,
            "storage_quota_mb": (m.get("quota", 0) or 0) / (1024 * 1024),
            "storage_used_mb": (m.get("quota_used", 0) or 0) / (1024 * 1024),
            "created_at": m.get("created", ""),
            "domain": m.get("domain", ""),
            "messages": m.get("messages", 0),
        })

    return mailboxes

@router.post("/tenants/{tenant_id}/mail/mailboxes")
async def create_mailbox(
    tenant_id: str,
    mailbox: MailboxCreate,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(require_admin())
):
    """Create a mailbox via Mailcow (Admin or SuperAdmin)"""
    import logging
    logger = logging.getLogger(__name__)

    # Resolve tenant_id (supports UUID or slug)
    resolved_id = await resolve_tenant_id(tenant_id, db)

    email = f"{mailbox.local_part}@{mailbox.domain}"
    logger.info(f"Creating mailbox: {email}")

    result = await mailcow_service.create_mailbox(
        local_part=mailbox.local_part,
        password=mailbox.password,
        name=mailbox.name,
        domain=mailbox.domain,
        quota=mailbox.quota_mb
    )

    logger.info(f"Mailcow response: {result}")

    # Check for errors in result
    if isinstance(result, list):
        for item in result:
            if item.get("type") == "error":
                error_msg = item.get("msg", ["Unknown error"])
                raise HTTPException(status_code=400, detail=f"Mailcow error: {error_msg}")
    elif isinstance(result, dict) and result.get("type") == "error":
        raise HTTPException(status_code=400, detail=f"Mailcow error: {result.get('msg')}")

    await log_activity(
        db,
        action="mailbox_created",
        tenant_id=str(resolved_id),
        entity_type="mailbox",
        description=f"Created mailbox: {email}"
    )

    return {
        "email": email,
        "name": mailbox.name,
        "quota_mb": mailbox.quota_mb,
        "result": result
    }

@router.delete("/tenants/{tenant_id}/mail/mailboxes/{email}")
async def delete_mailbox(
    tenant_id: str,
    email: str,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(require_admin())
):
    """Delete a mailbox (Admin or SuperAdmin)"""
    # Resolve tenant_id (supports UUID or slug)
    resolved_id = await resolve_tenant_id(tenant_id, db)

    await log_activity(
        db,
        action="mailbox_deleted",
        tenant_id=str(resolved_id),
        entity_type="mailbox",
        description=f"Deleted mailbox: {email}"
    )

    return {"message": "Mailbox deleted", "email": email}

@router.get("/tenants/{tenant_id}/mail/stats")
async def get_mail_stats(
    tenant_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    """Get mail usage statistics (requires authentication)"""
    resolved_id = await resolve_tenant_id(tenant_id, db)
    tenant_result = await db.execute(
        select(Tenant).where(Tenant.id == resolved_id)
    )
    tenant = tenant_result.scalar_one_or_none()

    if not tenant:
        raise HTTPException(status_code=404, detail="Tenant not found")

    domains_result = await db.execute(
        select(func.count(Domain.id)).where(
            and_(
                Domain.tenant_id == resolved_id,
                Domain.domain_type == "email"
            )
        )
    )
    domain_count = domains_result.scalar() or 0

    # Get mailbox stats from Mailcow
    try:
        raw_mailboxes = await mailcow_service.get_mailboxes()
        total_mailboxes = len(raw_mailboxes)
        total_storage_used_mb = sum((m.get("quota_used", 0) or 0) / (1024 * 1024) for m in raw_mailboxes)
    except Exception:
        total_mailboxes = 0
        total_storage_used_mb = 0

    return {
        "domains": domain_count,
        "total_mailboxes": total_mailboxes,
        "total_storage_used_mb": total_storage_used_mb,
        "storage_quota_mb": tenant.mail_quota_mb,
        "storage_used_mb": float(tenant.mail_used_mb or 0),
        "usage_percent": (float(tenant.mail_used_mb or 0) / tenant.mail_quota_mb * 100) if tenant.mail_quota_mb else 0,
        "emails_sent_today": 0,  # Would need Mailcow stats API
        "emails_received_today": 0,  # Would need Mailcow stats API
    }

# ==================== MEET ADMIN ENDPOINTS ====================

@router.get("/tenants/{tenant_id}/meet/stats")
async def get_meet_stats(
    tenant_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    """Get meeting statistics (requires authentication)"""
    resolved_id = await resolve_tenant_id(tenant_id, db)
    tenant_result = await db.execute(
        select(Tenant).where(Tenant.id == resolved_id)
    )
    tenant = tenant_result.scalar_one_or_none()

    if not tenant:
        raise HTTPException(status_code=404, detail="Tenant not found")

    return {
        "hours_quota": tenant.meet_quota_hours,
        "hours_used": float(tenant.meet_used_hours or 0),
        "usage_percent": (float(tenant.meet_used_hours or 0) / tenant.meet_quota_hours * 100) if tenant.meet_quota_hours else 0,
        "recordings_quota_mb": tenant.recordings_quota_mb,
        "recordings_used_mb": float(tenant.recordings_used_mb or 0)
    }

@router.get("/tenants/{tenant_id}/meet/settings")
async def get_meeting_settings(
    tenant_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    """Get tenant meeting settings (requires authentication)"""
    resolved_id = await resolve_tenant_id(tenant_id, db)
    tenant_result = await db.execute(
        select(Tenant).where(Tenant.id == resolved_id)
    )
    tenant = tenant_result.scalar_one_or_none()

    if not tenant:
        raise HTTPException(status_code=404, detail="Tenant not found")

    settings = tenant.settings or {}
    meet_settings = settings.get("meet", {})

    return MeetingSettingsUpdate(
        max_participants=meet_settings.get("max_participants", 100),
        max_duration_minutes=meet_settings.get("max_duration_minutes", 480),
        enable_recording=meet_settings.get("enable_recording", True),
        enable_waiting_room=meet_settings.get("enable_waiting_room", True),
        enable_chat=meet_settings.get("enable_chat", True),
        enable_screen_share=meet_settings.get("enable_screen_share", True)
    )

@router.patch("/tenants/{tenant_id}/meet/settings")
async def update_meeting_settings(
    tenant_id: str,
    settings: MeetingSettingsUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(require_admin())
):
    """Update tenant meeting settings (Admin or SuperAdmin)"""
    resolved_id = await resolve_tenant_id(tenant_id, db)
    tenant_result = await db.execute(
        select(Tenant).where(Tenant.id == resolved_id)
    )
    tenant = tenant_result.scalar_one_or_none()

    if not tenant:
        raise HTTPException(status_code=404, detail="Tenant not found")

    current_settings = tenant.settings or {}
    current_settings["meet"] = settings.model_dump()
    tenant.settings = current_settings
    tenant.updated_at = datetime.utcnow()

    await db.commit()

    return {"message": "Settings updated", **settings.model_dump()}

# ==================== DOCS ADMIN ENDPOINTS ====================

@router.get("/tenants/{tenant_id}/docs/stats")
async def get_docs_stats(
    tenant_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    """Get document storage statistics (requires authentication)"""
    resolved_id = await resolve_tenant_id(tenant_id, db)
    tenant_result = await db.execute(
        select(Tenant).where(Tenant.id == resolved_id)
    )
    tenant = tenant_result.scalar_one_or_none()

    if not tenant:
        raise HTTPException(status_code=404, detail="Tenant not found")

    return {
        "storage_quota_mb": tenant.docs_quota_mb,
        "storage_used_mb": float(tenant.docs_used_mb or 0),
        "usage_percent": (float(tenant.docs_used_mb or 0) / tenant.docs_quota_mb * 100) if tenant.docs_quota_mb else 0
    }

# ==================== DEVELOPER ENDPOINTS ====================

@router.get("/developers")
async def list_developers(
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(require_superadmin()),
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=100)
):
    """List all developers (SuperAdmin only)"""
    result = await db.execute(
        select(Developer)
        .where(Developer.is_active == True)
        .offset(skip)
        .limit(limit)
        .order_by(Developer.created_at.desc())
    )
    developers = result.scalars().all()

    return [
        {
            "id": str(d.id),
            "user_id": str(d.user_id),
            "role": d.role,
            "github_username": d.github_username,
            "is_active": d.is_active,
            "created_at": d.created_at
        }
        for d in developers
    ]

@router.post("/developers")
async def create_developer(
    developer: DeveloperCreate,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(require_superadmin())
):
    """Add a developer (SuperAdmin only)"""
    new_dev = Developer(
        user_id=uuid.UUID(developer.user_id),
        role=developer.role,
        ssh_public_key=developer.ssh_public_key,
        github_username=developer.github_username
    )

    db.add(new_dev)
    await db.commit()
    await db.refresh(new_dev)

    await log_activity(
        db,
        action="developer_created",
        user_id=developer.user_id,
        entity_type="developer",
        entity_id=str(new_dev.id),
        description=f"Added developer with role: {developer.role}"
    )

    return {
        "id": str(new_dev.id),
        "user_id": str(new_dev.user_id),
        "role": new_dev.role,
        "created_at": new_dev.created_at
    }

@router.post("/developers/{developer_id}/projects")
async def grant_project_access(
    developer_id: str,
    access: DeveloperProjectAccess,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(require_superadmin())
):
    """Grant project access to developer (SuperAdmin only)"""
    dev_result = await db.execute(
        select(Developer).where(Developer.id == uuid.UUID(developer_id))
    )
    developer = dev_result.scalar_one_or_none()

    if not developer:
        raise HTTPException(status_code=404, detail="Developer not found")

    project_access = DeveloperProject(
        developer_id=developer.id,
        project_name=access.project_name,
        access_level=access.access_level,
        git_branch_pattern=access.git_branch_pattern,
        can_push_to_main=access.can_push_to_main,
        can_deploy_staging=access.can_deploy_staging,
        can_deploy_production=access.can_deploy_production
    )

    db.add(project_access)
    await db.commit()

    return {
        "message": "Project access granted",
        "developer_id": developer_id,
        "project": access.project_name,
        "access_level": access.access_level
    }

# ==================== ACTIVITY LOG ENDPOINTS ====================

@router.get("/tenants/{tenant_id}/activity", response_model=List[ActivityLogResponse])
async def get_activity_log(
    tenant_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user),
    user_id: Optional[str] = None,
    action: Optional[str] = None,
    limit: int = Query(50, ge=1, le=200)
):
    """Get activity log for tenant (requires authentication)"""
    resolved_id = await resolve_tenant_id(tenant_id, db)
    query = select(ActivityLogModel).where(
        ActivityLogModel.tenant_id == resolved_id
    )

    if user_id:
        query = query.where(ActivityLogModel.user_id == uuid.UUID(user_id))
    if action:
        query = query.where(ActivityLogModel.action == action)

    query = query.order_by(ActivityLogModel.created_at.desc()).limit(limit)

    result = await db.execute(query)
    logs = result.scalars().all()

    return [
        ActivityLogResponse(
            id=str(log.id),
            tenant_id=str(log.tenant_id) if log.tenant_id else None,
            user_id=str(log.user_id) if log.user_id else None,
            action=log.action,
            entity_type=log.entity_type,
            entity_id=str(log.entity_id) if log.entity_id else None,
            description=log.description,
            ip_address=str(log.ip_address) if log.ip_address else None,
            extra_data=log.extra_data,
            created_at=log.created_at
        )
        for log in logs
    ]

# ==================== DASHBOARD ENDPOINT ====================

@router.get("/tenants/{tenant_id}/dashboard")
async def get_admin_dashboard(
    tenant_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    """Get complete admin dashboard data (requires authentication)"""
    # Check access: SuperAdmin can access any, others only their own
    if current_user.get("role") != "SuperAdmin":
        user_company = current_user.get("company_code") or current_user.get("company_id")
        if user_company and str(tenant_id).lower() != str(user_company).lower():
            raise HTTPException(status_code=403, detail="Access denied to this tenant")

    resolved_id = await resolve_tenant_id(tenant_id, db)

    # Get tenant directly
    tenant_result = await db.execute(
        select(Tenant).where(Tenant.id == resolved_id)
    )
    tenant_obj = tenant_result.scalar_one_or_none()
    if not tenant_obj:
        raise HTTPException(status_code=404, detail="Tenant not found")

    # Get user stats
    user_count_result = await db.execute(
        select(func.count(TenantUser.id)).where(
            TenantUser.tenant_id == resolved_id
        )
    )
    total_users = user_count_result.scalar() or 0

    # Get users by role
    role_counts = {}
    for role in ["admin", "manager", "member"]:
        count_result = await db.execute(
            select(func.count(TenantUser.id)).where(
                and_(
                    TenantUser.tenant_id == resolved_id,
                    TenantUser.role == role
                )
            )
        )
        role_counts[role] = count_result.scalar() or 0

    # Get domain count
    domain_count_result = await db.execute(
        select(func.count(Domain.id)).where(
            Domain.tenant_id == resolved_id
        )
    )
    domain_count = domain_count_result.scalar() or 0

    # Get recent activity
    recent_logs_result = await db.execute(
        select(ActivityLogModel)
        .where(ActivityLogModel.tenant_id == resolved_id)
        .order_by(ActivityLogModel.created_at.desc())
        .limit(10)
    )
    recent_logs = recent_logs_result.scalars().all()

    return {
        "tenant": {
            "id": str(tenant_obj.id),
            "name": tenant_obj.name,
            "slug": tenant_obj.slug,
            "domain": tenant_obj.domain,
            "owner_email": tenant_obj.owner_email,
            "plan": tenant_obj.plan,
            "is_active": tenant_obj.is_active,
            "is_suspended": tenant_obj.is_suspended or False,
            "max_users": tenant_obj.max_users,
            "created_at": tenant_obj.created_at.isoformat() if tenant_obj.created_at else None
        },
        "users": {
            "total": total_users,
            "max": tenant_obj.max_users,
            "by_role": role_counts
        },
        "domains": domain_count,
        "mail": {
            "storage_used_mb": float(tenant_obj.mail_used_mb or 0),
            "storage_quota_mb": tenant_obj.mail_quota_mb,
            "usage_percent": (float(tenant_obj.mail_used_mb or 0) / tenant_obj.mail_quota_mb * 100) if tenant_obj.mail_quota_mb else 0
        },
        "docs": {
            "storage_used_mb": float(tenant_obj.docs_used_mb or 0),
            "storage_quota_mb": tenant_obj.docs_quota_mb,
            "usage_percent": (float(tenant_obj.docs_used_mb or 0) / tenant_obj.docs_quota_mb * 100) if tenant_obj.docs_quota_mb else 0
        },
        "meet": {
            "hours_used": float(tenant_obj.meet_used_hours or 0),
            "hours_quota": tenant_obj.meet_quota_hours,
            "usage_percent": (float(tenant_obj.meet_used_hours or 0) / tenant_obj.meet_quota_hours * 100) if tenant_obj.meet_quota_hours else 0,
            "recordings_used_mb": float(tenant_obj.recordings_used_mb or 0),
            "recordings_quota_mb": tenant_obj.recordings_quota_mb
        },
        "recent_activity": [
            {
                "action": log.action,
                "description": log.description,
                "created_at": log.created_at.isoformat()
            }
            for log in recent_logs
        ]
    }
