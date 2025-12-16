"""
Bheem Workspace Admin API - Complete Administration Module
"""
from fastapi import APIRouter, HTTPException, Depends, Query, Body
from pydantic import BaseModel, EmailStr
from typing import Optional, List, Dict, Any
from datetime import datetime, timedelta
from enum import Enum
import uuid

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

# ==================== MODELS ====================

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
    settings: Dict[str, Any]
    # Quotas
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

# User Models
class UserCreate(BaseModel):
    email: EmailStr
    name: str
    role: UserRole = UserRole.MEMBER
    password: Optional[str] = None

class UserUpdate(BaseModel):
    name: Optional[str] = None
    role: Optional[UserRole] = None
    is_active: Optional[bool] = None
    avatar_url: Optional[str] = None

class UserResponse(BaseModel):
    id: str
    tenant_id: str
    email: str
    name: str
    role: str
    avatar_url: Optional[str]
    is_active: bool
    last_login: Optional[datetime]
    created_at: datetime

# Mail Admin Models
class MailDomainCreate(BaseModel):
    domain: str
    max_mailboxes: int = 100

class MailboxCreate(BaseModel):
    local_part: str  # username part before @
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
    permissions: str = "read"  # read, write, admin

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

# Analytics Models
class UsageStats(BaseModel):
    service: str
    period: str
    total_usage: float
    quota: float
    usage_percent: float
    trend: str  # up, down, stable

class ActivityLog(BaseModel):
    id: str
    user_id: str
    user_email: str
    action: str
    service: str
    details: Dict[str, Any]
    ip_address: str
    timestamp: datetime

# ==================== IN-MEMORY STORAGE (Demo) ====================
# In production, these would be database queries

tenants_db = {}
users_db = {}
mail_domains_db = {}
mailboxes_db = {}
activity_logs_db = []

# Initialize demo data
def init_demo_data():
    tenant_id = str(uuid.uuid4())
    tenants_db[tenant_id] = {
        "id": tenant_id,
        "name": "Demo Organization",
        "slug": "demo",
        "domain": "demo.bheem.cloud",
        "owner_email": "admin@demo.bheem.cloud",
        "plan": "business",
        "is_active": True,
        "settings": {"theme": "light", "language": "en"},
        "meet_quota_hours": 500,
        "docs_quota_mb": 102400,
        "mail_quota_mb": 51200,
        "recordings_quota_mb": 204800,
        "meet_used_hours": 45.5,
        "docs_used_mb": 2048,
        "mail_used_mb": 512,
        "recordings_used_mb": 8192,
        "created_at": datetime.utcnow() - timedelta(days=30),
        "user_count": 5
    }
    
    # Demo users
    for i, (email, name, role) in enumerate([
        ("admin@demo.bheem.cloud", "Admin User", "admin"),
        ("john@demo.bheem.cloud", "John Smith", "manager"),
        ("sarah@demo.bheem.cloud", "Sarah Chen", "member"),
        ("mike@demo.bheem.cloud", "Mike Johnson", "member"),
        ("lisa@demo.bheem.cloud", "Lisa Wang", "member"),
    ]):
        user_id = str(uuid.uuid4())
        users_db[user_id] = {
            "id": user_id,
            "tenant_id": tenant_id,
            "email": email,
            "name": name,
            "role": role,
            "avatar_url": None,
            "is_active": True,
            "last_login": datetime.utcnow() - timedelta(hours=i*2),
            "created_at": datetime.utcnow() - timedelta(days=30-i)
        }
    
    # Demo mail domain
    mail_domains_db["demo.bheem.cloud"] = {
        "domain": "demo.bheem.cloud",
        "tenant_id": tenant_id,
        "active": True,
        "max_mailboxes": 100,
        "created_at": datetime.utcnow() - timedelta(days=30)
    }
    
    return tenant_id

DEMO_TENANT_ID = init_demo_data()

# ==================== TENANT ENDPOINTS ====================

@router.get("/tenants", response_model=List[TenantResponse])
async def list_tenants(
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=100),
    search: Optional[str] = None,
    plan: Optional[PlanType] = None,
    is_active: Optional[bool] = None
):
    """List all tenants/organizations"""
    results = list(tenants_db.values())
    
    if search:
        results = [t for t in results if search.lower() in t["name"].lower() or search.lower() in t["slug"].lower()]
    if plan:
        results = [t for t in results if t["plan"] == plan]
    if is_active is not None:
        results = [t for t in results if t["is_active"] == is_active]
    
    return results[skip:skip+limit]

@router.post("/tenants", response_model=TenantResponse)
async def create_tenant(tenant: TenantCreate):
    """Create a new tenant/organization"""
    tenant_id = str(uuid.uuid4())
    
    # Set quotas based on plan
    quotas = {
        "free": {"meet": 10, "docs": 1024, "mail": 512, "recordings": 1024},
        "starter": {"meet": 100, "docs": 10240, "mail": 5120, "recordings": 10240},
        "business": {"meet": 500, "docs": 102400, "mail": 51200, "recordings": 204800},
        "enterprise": {"meet": 10000, "docs": 1048576, "mail": 524288, "recordings": 2097152}
    }
    plan_quotas = quotas.get(tenant.plan, quotas["free"])
    
    tenant_data = {
        "id": tenant_id,
        "name": tenant.name,
        "slug": tenant.slug,
        "domain": tenant.domain,
        "owner_email": tenant.owner_email,
        "plan": tenant.plan,
        "is_active": True,
        "settings": {},
        "meet_quota_hours": plan_quotas["meet"],
        "docs_quota_mb": plan_quotas["docs"],
        "mail_quota_mb": plan_quotas["mail"],
        "recordings_quota_mb": plan_quotas["recordings"],
        "meet_used_hours": 0,
        "docs_used_mb": 0,
        "mail_used_mb": 0,
        "recordings_used_mb": 0,
        "created_at": datetime.utcnow(),
        "user_count": 0
    }
    tenants_db[tenant_id] = tenant_data
    return tenant_data

@router.get("/tenants/{tenant_id}", response_model=TenantResponse)
async def get_tenant(tenant_id: str):
    """Get tenant details"""
    if tenant_id not in tenants_db:
        raise HTTPException(status_code=404, detail="Tenant not found")
    return tenants_db[tenant_id]

@router.patch("/tenants/{tenant_id}", response_model=TenantResponse)
async def update_tenant(tenant_id: str, update: TenantUpdate):
    """Update tenant settings"""
    if tenant_id not in tenants_db:
        raise HTTPException(status_code=404, detail="Tenant not found")
    
    tenant = tenants_db[tenant_id]
    for field, value in update.dict(exclude_unset=True).items():
        tenant[field] = value
    
    return tenant

@router.delete("/tenants/{tenant_id}")
async def delete_tenant(tenant_id: str):
    """Delete a tenant (soft delete)"""
    if tenant_id not in tenants_db:
        raise HTTPException(status_code=404, detail="Tenant not found")
    
    tenants_db[tenant_id]["is_active"] = False
    return {"message": "Tenant deactivated", "tenant_id": tenant_id}

# ==================== USER ENDPOINTS ====================

@router.get("/tenants/{tenant_id}/users", response_model=List[UserResponse])
async def list_users(
    tenant_id: str,
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=100),
    role: Optional[UserRole] = None,
    search: Optional[str] = None
):
    """List users in a tenant"""
    results = [u for u in users_db.values() if u["tenant_id"] == tenant_id]
    
    if role:
        results = [u for u in results if u["role"] == role]
    if search:
        results = [u for u in results if search.lower() in u["email"].lower() or search.lower() in u["name"].lower()]
    
    return results[skip:skip+limit]

@router.post("/tenants/{tenant_id}/users", response_model=UserResponse)
async def create_user(tenant_id: str, user: UserCreate):
    """Create a new user in tenant"""
    if tenant_id not in tenants_db:
        raise HTTPException(status_code=404, detail="Tenant not found")
    
    user_id = str(uuid.uuid4())
    user_data = {
        "id": user_id,
        "tenant_id": tenant_id,
        "email": user.email,
        "name": user.name,
        "role": user.role,
        "avatar_url": None,
        "is_active": True,
        "last_login": None,
        "created_at": datetime.utcnow()
    }
    users_db[user_id] = user_data
    tenants_db[tenant_id]["user_count"] += 1
    
    return user_data

@router.patch("/tenants/{tenant_id}/users/{user_id}", response_model=UserResponse)
async def update_user(tenant_id: str, user_id: str, update: UserUpdate):
    """Update user details"""
    if user_id not in users_db:
        raise HTTPException(status_code=404, detail="User not found")
    
    user = users_db[user_id]
    for field, value in update.dict(exclude_unset=True).items():
        user[field] = value
    
    return user

@router.delete("/tenants/{tenant_id}/users/{user_id}")
async def delete_user(tenant_id: str, user_id: str):
    """Delete/deactivate a user"""
    if user_id not in users_db:
        raise HTTPException(status_code=404, detail="User not found")
    
    users_db[user_id]["is_active"] = False
    return {"message": "User deactivated", "user_id": user_id}

# ==================== MAIL ADMIN ENDPOINTS ====================

@router.get("/tenants/{tenant_id}/mail/domains")
async def list_mail_domains(tenant_id: str):
    """List mail domains for tenant"""
    return [d for d in mail_domains_db.values() if d.get("tenant_id") == tenant_id]

@router.post("/tenants/{tenant_id}/mail/domains")
async def create_mail_domain(tenant_id: str, domain: MailDomainCreate):
    """Add a mail domain"""
    domain_data = {
        "domain": domain.domain,
        "tenant_id": tenant_id,
        "active": True,
        "max_mailboxes": domain.max_mailboxes,
        "created_at": datetime.utcnow()
    }
    mail_domains_db[domain.domain] = domain_data
    return domain_data

@router.get("/tenants/{tenant_id}/mail/mailboxes")
async def list_mailboxes(tenant_id: str, domain: Optional[str] = None):
    """List mailboxes"""
    results = [
        MailboxResponse(
            id=str(uuid.uuid4()),
            email="admin@demo.bheem.cloud",
            name="Admin",
            active=True,
            quota_mb=1024,
            used_mb=156.5,
            created_at=datetime.utcnow() - timedelta(days=30)
        ),
        MailboxResponse(
            id=str(uuid.uuid4()),
            email="john@demo.bheem.cloud",
            name="John Smith",
            active=True,
            quota_mb=1024,
            used_mb=423.2,
            created_at=datetime.utcnow() - timedelta(days=25)
        ),
        MailboxResponse(
            id=str(uuid.uuid4()),
            email="sarah@demo.bheem.cloud",
            name="Sarah Chen",
            active=True,
            quota_mb=1024,
            used_mb=89.7,
            created_at=datetime.utcnow() - timedelta(days=20)
        )
    ]
    return results

@router.post("/tenants/{tenant_id}/mail/mailboxes")
async def create_mailbox(tenant_id: str, mailbox: MailboxCreate):
    """Create a new mailbox"""
    email = f"{mailbox.local_part}@{mailbox.domain}"
    return MailboxResponse(
        id=str(uuid.uuid4()),
        email=email,
        name=mailbox.name,
        active=True,
        quota_mb=mailbox.quota_mb,
        used_mb=0,
        created_at=datetime.utcnow()
    )

@router.delete("/tenants/{tenant_id}/mail/mailboxes/{email}")
async def delete_mailbox(tenant_id: str, email: str):
    """Delete a mailbox"""
    return {"message": "Mailbox deleted", "email": email}

@router.get("/tenants/{tenant_id}/mail/stats")
async def get_mail_stats(tenant_id: str):
    """Get mail usage statistics"""
    return {
        "total_mailboxes": 5,
        "active_mailboxes": 5,
        "total_storage_mb": 5120,
        "used_storage_mb": 1234.5,
        "emails_sent_today": 45,
        "emails_received_today": 128,
        "spam_blocked_today": 23
    }

# ==================== DOCS ADMIN ENDPOINTS ====================

@router.get("/tenants/{tenant_id}/docs/stats")
async def get_docs_stats(tenant_id: str):
    """Get document storage statistics"""
    return {
        "total_files": 1234,
        "total_folders": 89,
        "total_storage_mb": 102400,
        "used_storage_mb": 45678,
        "files_created_today": 12,
        "files_shared": 234,
        "active_collaborations": 8
    }

@router.get("/tenants/{tenant_id}/docs/users")
async def list_docs_users(tenant_id: str):
    """List users with docs access and their usage"""
    return [
        {"user_id": "1", "email": "admin@demo.bheem.cloud", "name": "Admin", "quota_mb": 10240, "used_mb": 4567, "files_count": 234},
        {"user_id": "2", "email": "john@demo.bheem.cloud", "name": "John Smith", "quota_mb": 10240, "used_mb": 2345, "files_count": 123},
        {"user_id": "3", "email": "sarah@demo.bheem.cloud", "name": "Sarah Chen", "quota_mb": 10240, "used_mb": 890, "files_count": 45}
    ]

@router.post("/tenants/{tenant_id}/docs/shared-folders")
async def create_shared_folder(tenant_id: str, folder: SharedFolderCreate):
    """Create a shared folder"""
    return {
        "id": str(uuid.uuid4()),
        "name": folder.name,
        "path": folder.path,
        "allowed_users": folder.allowed_users,
        "permissions": folder.permissions,
        "created_at": datetime.utcnow()
    }

@router.patch("/tenants/{tenant_id}/docs/users/{user_id}/quota")
async def update_user_storage_quota(tenant_id: str, user_id: str, quota: StorageQuotaUpdate):
    """Update user storage quota"""
    return {"message": "Quota updated", "user_id": user_id, "new_quota_mb": quota.quota_mb}

# ==================== MEET ADMIN ENDPOINTS ====================

@router.get("/tenants/{tenant_id}/meet/stats")
async def get_meet_stats(tenant_id: str):
    """Get meeting statistics"""
    return {
        "meetings_today": 12,
        "meetings_this_week": 45,
        "meetings_this_month": 156,
        "total_participants_today": 89,
        "avg_duration_minutes": 34,
        "hours_used_this_month": 87.5,
        "hours_quota": 500,
        "recordings_count": 23,
        "recordings_storage_mb": 8192
    }

@router.get("/tenants/{tenant_id}/meet/meetings")
async def list_meetings_admin(
    tenant_id: str,
    status: Optional[str] = None,
    start_date: Optional[datetime] = None,
    end_date: Optional[datetime] = None
):
    """List all meetings (admin view)"""
    return [
        {
            "id": str(uuid.uuid4()),
            "title": "Team Standup",
            "room_name": "team-standup-abc123",
            "host": "admin@demo.bheem.cloud",
            "status": "completed",
            "participants_count": 5,
            "duration_minutes": 15,
            "started_at": datetime.utcnow() - timedelta(hours=2),
            "ended_at": datetime.utcnow() - timedelta(hours=2) + timedelta(minutes=15),
            "recorded": True
        },
        {
            "id": str(uuid.uuid4()),
            "title": "Client Presentation",
            "room_name": "client-presentation-xyz789",
            "host": "john@demo.bheem.cloud",
            "status": "scheduled",
            "participants_count": 0,
            "duration_minutes": 60,
            "scheduled_at": datetime.utcnow() + timedelta(hours=3),
            "recorded": False
        }
    ]

@router.get("/tenants/{tenant_id}/meet/settings")
async def get_meeting_settings(tenant_id: str):
    """Get tenant meeting settings"""
    return MeetingSettingsUpdate(
        max_participants=100,
        max_duration_minutes=480,
        enable_recording=True,
        enable_waiting_room=True,
        enable_chat=True,
        enable_screen_share=True
    )

@router.patch("/tenants/{tenant_id}/meet/settings")
async def update_meeting_settings(tenant_id: str, settings: MeetingSettingsUpdate):
    """Update tenant meeting settings"""
    return {"message": "Settings updated", **settings.dict()}

@router.get("/tenants/{tenant_id}/meet/recording-policy")
async def get_recording_policy(tenant_id: str):
    """Get recording policy"""
    return RecordingPolicy(
        auto_record=False,
        retention_days=90,
        drm_enabled=True,
        watermark_enabled=True
    )

@router.patch("/tenants/{tenant_id}/meet/recording-policy")
async def update_recording_policy(tenant_id: str, policy: RecordingPolicy):
    """Update recording policy"""
    return {"message": "Recording policy updated", **policy.dict()}

# ==================== ANALYTICS ENDPOINTS ====================

@router.get("/tenants/{tenant_id}/analytics/usage")
async def get_usage_analytics(
    tenant_id: str,
    service: Optional[ServiceType] = None,
    period: str = Query("month", regex="^(day|week|month|year)$")
):
    """Get usage analytics"""
    stats = []
    
    if service is None or service == ServiceType.MAIL:
        stats.append(UsageStats(
            service="mail",
            period=period,
            total_usage=512,
            quota=5120,
            usage_percent=10.0,
            trend="up"
        ))
    
    if service is None or service == ServiceType.DOCS:
        stats.append(UsageStats(
            service="docs",
            period=period,
            total_usage=2048,
            quota=102400,
            usage_percent=2.0,
            trend="stable"
        ))
    
    if service is None or service == ServiceType.MEET:
        stats.append(UsageStats(
            service="meet",
            period=period,
            total_usage=45.5,
            quota=500,
            usage_percent=9.1,
            trend="up"
        ))
    
    return stats

@router.get("/tenants/{tenant_id}/analytics/activity")
async def get_activity_log(
    tenant_id: str,
    user_id: Optional[str] = None,
    service: Optional[ServiceType] = None,
    limit: int = Query(50, ge=1, le=200)
):
    """Get activity log"""
    activities = [
        ActivityLog(
            id=str(uuid.uuid4()),
            user_id="1",
            user_email="admin@demo.bheem.cloud",
            action="file_upload",
            service="docs",
            details={"filename": "Q4_Report.docx", "size_mb": 2.5},
            ip_address="192.168.1.100",
            timestamp=datetime.utcnow() - timedelta(minutes=5)
        ),
        ActivityLog(
            id=str(uuid.uuid4()),
            user_id="2",
            user_email="john@demo.bheem.cloud",
            action="meeting_started",
            service="meet",
            details={"room_name": "team-standup-abc123", "participants": 5},
            ip_address="192.168.1.101",
            timestamp=datetime.utcnow() - timedelta(minutes=30)
        ),
        ActivityLog(
            id=str(uuid.uuid4()),
            user_id="3",
            user_email="sarah@demo.bheem.cloud",
            action="email_sent",
            service="mail",
            details={"to": "client@example.com", "subject": "Project Update"},
            ip_address="192.168.1.102",
            timestamp=datetime.utcnow() - timedelta(hours=1)
        )
    ]
    return activities[:limit]

# ==================== DASHBOARD ENDPOINTS ====================

@router.get("/tenants/{tenant_id}/dashboard")
async def get_admin_dashboard(tenant_id: str):
    """Get complete admin dashboard data"""
    tenant = tenants_db.get(tenant_id) or tenants_db.get(DEMO_TENANT_ID)
    
    return {
        "tenant": tenant,
        "users": {
            "total": tenant["user_count"],
            "active": tenant["user_count"],
            "by_role": {"admin": 1, "manager": 1, "member": 3}
        },
        "mail": {
            "domains": 1,
            "mailboxes": 5,
            "storage_used_mb": tenant["mail_used_mb"],
            "storage_quota_mb": tenant["mail_quota_mb"],
            "emails_today": 173
        },
        "docs": {
            "files": 1234,
            "folders": 89,
            "storage_used_mb": tenant["docs_used_mb"],
            "storage_quota_mb": tenant["docs_quota_mb"],
            "active_collaborations": 8
        },
        "meet": {
            "meetings_today": 12,
            "hours_used": tenant["meet_used_hours"],
            "hours_quota": tenant["meet_quota_hours"],
            "recordings": 23,
            "recordings_storage_mb": tenant["recordings_used_mb"]
        },
        "recent_activity": [
            {"user": "Sarah Chen", "action": "uploaded", "target": "Q4_Report.docx", "time": "5 min ago"},
            {"user": "John Smith", "action": "started meeting", "target": "Team Standup", "time": "30 min ago"},
            {"user": "Admin", "action": "sent email", "target": "to client@example.com", "time": "1 hour ago"}
        ]
    }
