# Workspace Admin Module - Implementation Guide

## Overview

The Admin Module provides tenant management, user management, domain management, and developer access control for Bheem Workspace.

**Location**: `/root/bheem-workspace/backend/api/admin.py`
**Port**: 8500 (part of workspace backend)

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                    ADMIN MODULE                                  │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │                   API ENDPOINTS                            │  │
│  │                                                            │  │
│  │  /api/v1/admin/tenants      → Tenant CRUD                 │  │
│  │  /api/v1/admin/users        → User management             │  │
│  │  /api/v1/admin/domains      → Domain management           │  │
│  │  /api/v1/admin/developers   → Developer access            │  │
│  │  /api/v1/admin/activity     → Audit logs                  │  │
│  └───────────────────────────────────────────────────────────┘  │
│                            │                                     │
│                            ▼                                     │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │                   SERVICES                                 │  │
│  │                                                            │  │
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐        │  │
│  │  │   Mailgun   │  │ Cloudflare  │  │   Tenant    │        │  │
│  │  │   Service   │  │   Service   │  │   Service   │        │  │
│  │  └──────┬──────┘  └──────┬──────┘  └──────┬──────┘        │  │
│  └─────────┼────────────────┼────────────────┼───────────────┘  │
│            │                │                │                   │
│            ▼                ▼                ▼                   │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐          │
│  │  Mailgun     │  │  Cloudflare  │  │  PostgreSQL  │          │
│  │  API         │  │  API         │  │  (workspace  │          │
│  │              │  │              │  │   schema)    │          │
│  └──────────────┘  └──────────────┘  └──────────────┘          │
└─────────────────────────────────────────────────────────────────┘
```

---

## Database Schema

```sql
-- Create workspace schema
CREATE SCHEMA IF NOT EXISTS workspace;

-- =====================================================
-- 1. TENANTS TABLE
-- =====================================================
CREATE TABLE workspace.tenants (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    slug VARCHAR(100) NOT NULL UNIQUE,
    domain VARCHAR(255),
    owner_email VARCHAR(320) NOT NULL,

    -- Plan & Quotas
    plan VARCHAR(50) NOT NULL DEFAULT 'free',
    max_users INTEGER DEFAULT 5,
    meet_quota_hours INTEGER DEFAULT 10,
    docs_quota_mb INTEGER DEFAULT 1024,
    mail_quota_mb INTEGER DEFAULT 512,
    recordings_quota_mb INTEGER DEFAULT 1024,

    -- Current Usage
    meet_used_hours DECIMAL(10,2) DEFAULT 0,
    docs_used_mb DECIMAL(10,2) DEFAULT 0,
    mail_used_mb DECIMAL(10,2) DEFAULT 0,
    recordings_used_mb DECIMAL(10,2) DEFAULT 0,

    -- Billing
    billing_email VARCHAR(320),
    stripe_customer_id VARCHAR(100),

    -- Status
    is_active BOOLEAN DEFAULT TRUE,
    is_suspended BOOLEAN DEFAULT FALSE,
    suspended_reason TEXT,

    -- Settings
    settings JSONB DEFAULT '{}',

    -- Timestamps
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    trial_ends_at TIMESTAMP,
    created_by UUID REFERENCES auth.users(id)
);

CREATE INDEX idx_tenants_slug ON workspace.tenants(slug);
CREATE INDEX idx_tenants_owner ON workspace.tenants(owner_email);

-- =====================================================
-- 2. TENANT USERS TABLE
-- =====================================================
CREATE TABLE workspace.tenant_users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES workspace.tenants(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

    -- Role
    role VARCHAR(50) NOT NULL DEFAULT 'member',  -- admin, manager, member

    -- Status
    is_active BOOLEAN DEFAULT TRUE,
    invited_at TIMESTAMP,
    joined_at TIMESTAMP,
    invited_by UUID REFERENCES auth.users(id),

    -- Permissions
    permissions JSONB DEFAULT '{}',

    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),

    UNIQUE(tenant_id, user_id)
);

CREATE INDEX idx_tenant_users_tenant ON workspace.tenant_users(tenant_id);
CREATE INDEX idx_tenant_users_user ON workspace.tenant_users(user_id);

-- =====================================================
-- 3. DOMAINS TABLE
-- =====================================================
CREATE TABLE workspace.domains (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES workspace.tenants(id) ON DELETE CASCADE,
    domain VARCHAR(255) NOT NULL UNIQUE,

    -- Type
    domain_type VARCHAR(20) NOT NULL DEFAULT 'email',  -- email, workspace, custom

    -- Provider References
    mailgun_domain_id VARCHAR(100),
    cloudflare_zone_id VARCHAR(50),

    -- Verification Status
    spf_verified BOOLEAN DEFAULT FALSE,
    dkim_verified BOOLEAN DEFAULT FALSE,
    mx_verified BOOLEAN DEFAULT FALSE,
    ownership_verified BOOLEAN DEFAULT FALSE,
    verification_token VARCHAR(100),

    -- Status
    is_primary BOOLEAN DEFAULT FALSE,
    is_active BOOLEAN DEFAULT TRUE,

    -- Timestamps
    created_at TIMESTAMP DEFAULT NOW(),
    verified_at TIMESTAMP,
    created_by UUID REFERENCES auth.users(id)
);

CREATE INDEX idx_domains_tenant ON workspace.domains(tenant_id);
CREATE INDEX idx_domains_domain ON workspace.domains(domain);

-- =====================================================
-- 4. DNS RECORDS TABLE
-- =====================================================
CREATE TABLE workspace.domain_dns_records (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    domain_id UUID NOT NULL REFERENCES workspace.domains(id) ON DELETE CASCADE,

    record_type VARCHAR(10) NOT NULL,  -- TXT, CNAME, MX
    name VARCHAR(255) NOT NULL,
    value TEXT NOT NULL,
    priority INTEGER,  -- For MX records
    ttl INTEGER DEFAULT 3600,

    -- Verification
    is_verified BOOLEAN DEFAULT FALSE,
    last_checked_at TIMESTAMP,
    verified_at TIMESTAMP,

    created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_dns_records_domain ON workspace.domain_dns_records(domain_id);

-- =====================================================
-- 5. DEVELOPERS TABLE
-- =====================================================
CREATE TABLE workspace.developers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

    role VARCHAR(30) NOT NULL,  -- lead_developer, developer, junior_developer
    ssh_public_key TEXT,
    github_username VARCHAR(100),

    is_active BOOLEAN DEFAULT TRUE,

    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    created_by UUID REFERENCES auth.users(id)
);

CREATE INDEX idx_developers_user ON workspace.developers(user_id);

-- =====================================================
-- 6. DEVELOPER PROJECTS TABLE
-- =====================================================
CREATE TABLE workspace.developer_projects (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    developer_id UUID NOT NULL REFERENCES workspace.developers(id) ON DELETE CASCADE,

    project_name VARCHAR(100) NOT NULL,  -- bheem-workspace, bheem-core
    access_level VARCHAR(20) NOT NULL,   -- read, write, admin

    git_branch_pattern VARCHAR(100),
    can_push_to_main BOOLEAN DEFAULT FALSE,
    can_deploy_staging BOOLEAN DEFAULT FALSE,
    can_deploy_production BOOLEAN DEFAULT FALSE,

    granted_at TIMESTAMP DEFAULT NOW(),
    granted_by UUID REFERENCES auth.users(id)
);

CREATE INDEX idx_dev_projects_developer ON workspace.developer_projects(developer_id);

-- =====================================================
-- 7. ACTIVITY LOG TABLE
-- =====================================================
CREATE TABLE workspace.activity_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID REFERENCES workspace.tenants(id) ON DELETE SET NULL,
    user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,

    action VARCHAR(100) NOT NULL,
    entity_type VARCHAR(50),
    entity_id UUID,
    description TEXT,

    ip_address INET,
    user_agent VARCHAR(500),
    metadata JSONB,

    created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_activity_tenant ON workspace.activity_log(tenant_id);
CREATE INDEX idx_activity_user ON workspace.activity_log(user_id);
CREATE INDEX idx_activity_created ON workspace.activity_log(created_at);
```

---

## API Implementation

### Tenant Endpoints

```python
# /root/bheem-workspace/backend/api/admin.py

from fastapi import APIRouter, HTTPException, Depends, Query
from pydantic import BaseModel, EmailStr
from typing import Optional, List, Dict, Any
from datetime import datetime
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, update, delete, func
from uuid import UUID
import uuid

from core.database import get_db
from core.security import get_current_user, require_role

router = APIRouter(prefix="/api/v1/admin", tags=["Admin"])

# ==================== PYDANTIC MODELS ====================

class TenantCreate(BaseModel):
    name: str
    slug: str
    domain: Optional[str] = None
    owner_email: EmailStr
    plan: str = "free"

class TenantUpdate(BaseModel):
    name: Optional[str] = None
    domain: Optional[str] = None
    plan: Optional[str] = None
    is_active: Optional[bool] = None
    settings: Optional[Dict[str, Any]] = None

class TenantResponse(BaseModel):
    id: UUID
    name: str
    slug: str
    domain: Optional[str]
    owner_email: str
    plan: str
    is_active: bool
    max_users: int
    user_count: int
    created_at: datetime

# ==================== PLAN CONFIGURATION ====================

PLANS = {
    "free": {
        "max_users": 5,
        "meet_quota_hours": 10,
        "docs_quota_mb": 1024,
        "mail_quota_mb": 512,
        "recordings_quota_mb": 1024,
        "features": ["meet", "docs"]
    },
    "starter": {
        "max_users": 25,
        "meet_quota_hours": 100,
        "docs_quota_mb": 10240,
        "mail_quota_mb": 5120,
        "recordings_quota_mb": 10240,
        "features": ["meet", "docs", "mail"]
    },
    "business": {
        "max_users": 100,
        "meet_quota_hours": 500,
        "docs_quota_mb": 102400,
        "mail_quota_mb": 51200,
        "recordings_quota_mb": 102400,
        "features": ["meet", "docs", "mail", "recording", "custom_domain"]
    },
    "enterprise": {
        "max_users": 1000,
        "meet_quota_hours": 10000,
        "docs_quota_mb": 1048576,
        "mail_quota_mb": 524288,
        "recordings_quota_mb": 1048576,
        "features": ["meet", "docs", "mail", "recording", "custom_domain", "sso", "api"]
    }
}

# ==================== TENANT ENDPOINTS ====================

@router.get("/tenants", response_model=List[TenantResponse])
async def list_tenants(
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=100),
    search: Optional[str] = None,
    plan: Optional[str] = None,
    is_active: Optional[bool] = None,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(require_role(["SuperAdmin"]))
):
    """
    List all tenants (SuperAdmin only)

    Args:
        skip: Pagination offset
        limit: Number of results
        search: Search by name or slug
        plan: Filter by plan
        is_active: Filter by status
    """
    query = select(Tenant)

    if search:
        query = query.where(
            Tenant.name.ilike(f"%{search}%") |
            Tenant.slug.ilike(f"%{search}%")
        )
    if plan:
        query = query.where(Tenant.plan == plan)
    if is_active is not None:
        query = query.where(Tenant.is_active == is_active)

    query = query.offset(skip).limit(limit)
    result = await db.execute(query)
    tenants = result.scalars().all()

    # Get user counts
    response = []
    for tenant in tenants:
        count = await db.execute(
            select(func.count(TenantUser.id))
            .where(TenantUser.tenant_id == tenant.id)
        )
        response.append({
            **tenant.__dict__,
            "user_count": count.scalar() or 0
        })

    return response

@router.post("/tenants", response_model=TenantResponse)
async def create_tenant(
    tenant: TenantCreate,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(require_role(["SuperAdmin"]))
):
    """
    Create a new tenant/organization

    This will:
    1. Create the tenant record
    2. Set up quotas based on plan
    3. Log the activity
    """
    # Check slug uniqueness
    existing = await db.execute(
        select(Tenant).where(Tenant.slug == tenant.slug)
    )
    if existing.scalar():
        raise HTTPException(status_code=400, detail="Slug already exists")

    # Get plan configuration
    plan_config = PLANS.get(tenant.plan, PLANS["free"])

    # Create tenant
    new_tenant = Tenant(
        name=tenant.name,
        slug=tenant.slug,
        domain=tenant.domain,
        owner_email=tenant.owner_email,
        plan=tenant.plan,
        max_users=plan_config["max_users"],
        meet_quota_hours=plan_config["meet_quota_hours"],
        docs_quota_mb=plan_config["docs_quota_mb"],
        mail_quota_mb=plan_config["mail_quota_mb"],
        recordings_quota_mb=plan_config["recordings_quota_mb"],
        created_by=UUID(current_user["id"])
    )

    db.add(new_tenant)
    await db.commit()
    await db.refresh(new_tenant)

    # Log activity
    await log_activity(
        db=db,
        tenant_id=new_tenant.id,
        user_id=UUID(current_user["id"]),
        action="tenant.created",
        entity_type="tenant",
        entity_id=new_tenant.id,
        description=f"Created tenant: {tenant.name}"
    )

    return {**new_tenant.__dict__, "user_count": 0}

@router.get("/tenants/{tenant_id}")
async def get_tenant(
    tenant_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    """Get tenant details with usage statistics"""
    result = await db.execute(
        select(Tenant).where(Tenant.id == tenant_id)
    )
    tenant = result.scalar()

    if not tenant:
        raise HTTPException(status_code=404, detail="Tenant not found")

    # Access check
    if current_user["role"] != "SuperAdmin":
        member = await db.execute(
            select(TenantUser).where(
                TenantUser.tenant_id == tenant_id,
                TenantUser.user_id == UUID(current_user["id"])
            )
        )
        if not member.scalar():
            raise HTTPException(status_code=403, detail="Access denied")

    # Get user count
    user_count = await db.execute(
        select(func.count(TenantUser.id))
        .where(TenantUser.tenant_id == tenant_id)
    )

    # Get domain count
    domain_count = await db.execute(
        select(func.count(Domain.id))
        .where(Domain.tenant_id == tenant_id)
    )

    return {
        **tenant.__dict__,
        "user_count": user_count.scalar() or 0,
        "domain_count": domain_count.scalar() or 0,
        "usage": {
            "meet": {
                "used": float(tenant.meet_used_hours or 0),
                "quota": tenant.meet_quota_hours,
                "percentage": (float(tenant.meet_used_hours or 0) / tenant.meet_quota_hours * 100) if tenant.meet_quota_hours else 0
            },
            "docs": {
                "used": float(tenant.docs_used_mb or 0),
                "quota": tenant.docs_quota_mb,
                "percentage": (float(tenant.docs_used_mb or 0) / tenant.docs_quota_mb * 100) if tenant.docs_quota_mb else 0
            },
            "mail": {
                "used": float(tenant.mail_used_mb or 0),
                "quota": tenant.mail_quota_mb,
                "percentage": (float(tenant.mail_used_mb or 0) / tenant.mail_quota_mb * 100) if tenant.mail_quota_mb else 0
            }
        }
    }

@router.patch("/tenants/{tenant_id}")
async def update_tenant(
    tenant_id: UUID,
    update_data: TenantUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(require_role(["SuperAdmin", "Admin"]))
):
    """Update tenant settings"""
    result = await db.execute(
        select(Tenant).where(Tenant.id == tenant_id)
    )
    tenant = result.scalar()

    if not tenant:
        raise HTTPException(status_code=404, detail="Tenant not found")

    update_dict = update_data.dict(exclude_unset=True)

    # If plan changed, update quotas
    if "plan" in update_dict:
        plan_config = PLANS.get(update_dict["plan"], PLANS["free"])
        update_dict.update({
            "max_users": plan_config["max_users"],
            "meet_quota_hours": plan_config["meet_quota_hours"],
            "docs_quota_mb": plan_config["docs_quota_mb"],
            "mail_quota_mb": plan_config["mail_quota_mb"],
            "recordings_quota_mb": plan_config["recordings_quota_mb"]
        })

    for key, value in update_dict.items():
        setattr(tenant, key, value)

    tenant.updated_at = datetime.utcnow()
    await db.commit()
    await db.refresh(tenant)

    return tenant

@router.post("/tenants/{tenant_id}/suspend")
async def suspend_tenant(
    tenant_id: UUID,
    reason: str,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(require_role(["SuperAdmin"]))
):
    """Suspend a tenant"""
    result = await db.execute(
        select(Tenant).where(Tenant.id == tenant_id)
    )
    tenant = result.scalar()

    if not tenant:
        raise HTTPException(status_code=404, detail="Tenant not found")

    tenant.is_suspended = True
    tenant.suspended_reason = reason
    tenant.updated_at = datetime.utcnow()

    await db.commit()

    await log_activity(
        db=db,
        tenant_id=tenant_id,
        user_id=UUID(current_user["id"]),
        action="tenant.suspended",
        description=f"Suspended tenant: {reason}"
    )

    return {"message": "Tenant suspended"}
```

### Domain Endpoints

```python
# Domain management endpoints

class DomainCreate(BaseModel):
    domain: str
    domain_type: str = "email"

class DomainResponse(BaseModel):
    id: UUID
    domain: str
    domain_type: str
    spf_verified: bool
    dkim_verified: bool
    mx_verified: bool
    is_active: bool
    dns_records: List[Dict[str, Any]]

@router.get("/tenants/{tenant_id}/domains")
async def list_domains(
    tenant_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    """List domains for a tenant"""
    result = await db.execute(
        select(Domain).where(Domain.tenant_id == tenant_id)
    )
    domains = result.scalars().all()

    response = []
    for domain in domains:
        dns_result = await db.execute(
            select(DomainDNSRecord).where(DomainDNSRecord.domain_id == domain.id)
        )
        dns_records = dns_result.scalars().all()

        response.append({
            **domain.__dict__,
            "dns_records": [
                {
                    "type": r.record_type,
                    "name": r.name,
                    "value": r.value,
                    "priority": r.priority,
                    "verified": r.is_verified
                }
                for r in dns_records
            ]
        })

    return response

@router.post("/tenants/{tenant_id}/domains")
async def add_domain(
    tenant_id: UUID,
    domain_data: DomainCreate,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(require_role(["SuperAdmin", "Admin"]))
):
    """
    Add a domain to a tenant

    This will:
    1. Add domain to Mailgun
    2. Get required DNS records
    3. Optionally add DNS records to Cloudflare
    """
    from services.mailgun_service import mailgun_service
    from services.cloudflare_service import cloudflare_service

    # Check domain uniqueness
    existing = await db.execute(
        select(Domain).where(Domain.domain == domain_data.domain)
    )
    if existing.scalar():
        raise HTTPException(status_code=400, detail="Domain already exists")

    # Add to Mailgun
    mailgun_result = await mailgun_service.add_domain(domain_data.domain)
    if not mailgun_result:
        raise HTTPException(status_code=500, detail="Failed to add domain to Mailgun")

    # Create domain record
    new_domain = Domain(
        tenant_id=tenant_id,
        domain=domain_data.domain,
        domain_type=domain_data.domain_type,
        mailgun_domain_id=domain_data.domain,
        verification_token=str(uuid.uuid4())[:8],
        created_by=UUID(current_user["id"])
    )
    db.add(new_domain)
    await db.commit()
    await db.refresh(new_domain)

    # Save DNS records
    dns_records = mailgun_result.get("sending_dns_records", [])
    for record in dns_records:
        dns_record = DomainDNSRecord(
            domain_id=new_domain.id,
            record_type=record["record_type"],
            name=record["name"],
            value=record["value"],
            priority=record.get("priority")
        )
        db.add(dns_record)

    await db.commit()

    # Try to add to Cloudflare
    zone_id = await cloudflare_service.get_zone_id(domain_data.domain)
    if zone_id:
        new_domain.cloudflare_zone_id = zone_id
        for record in dns_records:
            await cloudflare_service.add_dns_record(
                zone_id=zone_id,
                record_type=record["record_type"],
                name=record["name"],
                content=record["value"],
                priority=record.get("priority")
            )
        await db.commit()

    return await get_domain_with_records(new_domain.id, db)

@router.post("/tenants/{tenant_id}/domains/{domain_id}/verify")
async def verify_domain(
    tenant_id: UUID,
    domain_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(require_role(["SuperAdmin", "Admin"]))
):
    """Verify domain DNS records"""
    from services.mailgun_service import mailgun_service

    result = await db.execute(
        select(Domain).where(Domain.id == domain_id)
    )
    domain = result.scalar()

    if not domain:
        raise HTTPException(status_code=404, detail="Domain not found")

    # Verify with Mailgun
    verification = await mailgun_service.verify_domain(domain.domain)

    if verification:
        domain.spf_verified = verification.get("spf_valid", False)
        domain.dkim_verified = verification.get("dkim_valid", False)
        domain.mx_verified = verification.get("mx_valid", False)

        if domain.spf_verified and domain.dkim_verified:
            domain.verified_at = datetime.utcnow()

        await db.commit()

    return {
        "domain": domain.domain,
        "spf_verified": domain.spf_verified,
        "dkim_verified": domain.dkim_verified,
        "mx_verified": domain.mx_verified,
        "fully_verified": domain.verified_at is not None
    }

@router.delete("/tenants/{tenant_id}/domains/{domain_id}")
async def remove_domain(
    tenant_id: UUID,
    domain_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(require_role(["SuperAdmin", "Admin"]))
):
    """Remove a domain"""
    from services.mailgun_service import mailgun_service

    result = await db.execute(
        select(Domain).where(Domain.id == domain_id)
    )
    domain = result.scalar()

    if not domain:
        raise HTTPException(status_code=404, detail="Domain not found")

    # Remove from Mailgun
    await mailgun_service.delete_domain(domain.domain)

    # Delete from database
    await db.delete(domain)
    await db.commit()

    return {"message": "Domain removed"}
```

---

## Services

### Mailgun Service

```python
# /root/bheem-workspace/backend/services/mailgun_service.py

import httpx
import os
from typing import Optional, Dict, Any

class MailgunService:
    def __init__(self):
        self.api_key = os.getenv("MAILGUN_API_KEY")
        self.base_url = "https://api.mailgun.net/v3"

    async def add_domain(self, domain: str) -> Optional[Dict[str, Any]]:
        """Add domain to Mailgun"""
        async with httpx.AsyncClient() as client:
            response = await client.post(
                f"{self.base_url}/domains",
                auth=("api", self.api_key),
                data={"name": domain}
            )

            if response.status_code in [200, 201]:
                return response.json()
            elif "already exists" in response.text:
                return await self.get_domain(domain)
            return None

    async def get_domain(self, domain: str) -> Optional[Dict[str, Any]]:
        """Get domain info with DNS records"""
        async with httpx.AsyncClient() as client:
            response = await client.get(
                f"{self.base_url}/domains/{domain}",
                auth=("api", self.api_key)
            )

            if response.status_code == 200:
                return response.json()
            return None

    async def verify_domain(self, domain: str) -> Optional[Dict[str, Any]]:
        """Verify domain DNS"""
        async with httpx.AsyncClient() as client:
            response = await client.put(
                f"{self.base_url}/domains/{domain}/verify",
                auth=("api", self.api_key)
            )

            if response.status_code == 200:
                data = response.json()
                domain_info = data.get("domain", {})
                return {
                    "spf_valid": domain_info.get("state") == "active",
                    "dkim_valid": any(
                        r.get("valid") == "valid"
                        for r in data.get("sending_dns_records", [])
                        if "domainkey" in r.get("name", "")
                    ),
                    "mx_valid": any(
                        r.get("valid") == "valid"
                        for r in data.get("receiving_dns_records", [])
                    )
                }
            return None

    async def delete_domain(self, domain: str) -> bool:
        """Delete domain from Mailgun"""
        async with httpx.AsyncClient() as client:
            response = await client.delete(
                f"{self.base_url}/domains/{domain}",
                auth=("api", self.api_key)
            )
            return response.status_code == 200

mailgun_service = MailgunService()
```

### Cloudflare Service

```python
# /root/bheem-workspace/backend/services/cloudflare_service.py

import httpx
import os
from typing import Optional, Dict, Any, List

class CloudflareService:
    def __init__(self):
        self.api_token = os.getenv("CLOUDFLARE_API_TOKEN")
        self.base_url = "https://api.cloudflare.com/client/v4"

    def _headers(self) -> dict:
        return {
            "Authorization": f"Bearer {self.api_token}",
            "Content-Type": "application/json"
        }

    async def get_zone_id(self, domain: str) -> Optional[str]:
        """Get zone ID for domain"""
        parts = domain.split(".")
        root_domain = ".".join(parts[-2:]) if len(parts) > 2 else domain

        async with httpx.AsyncClient() as client:
            response = await client.get(
                f"{self.base_url}/zones",
                params={"name": root_domain},
                headers=self._headers()
            )

            if response.status_code == 200:
                zones = response.json().get("result", [])
                if zones:
                    return zones[0]["id"]
            return None

    async def add_dns_record(
        self,
        zone_id: str,
        record_type: str,
        name: str,
        content: str,
        priority: int = None,
        ttl: int = 3600,
        proxied: bool = False
    ) -> bool:
        """Add DNS record"""
        data = {
            "type": record_type,
            "name": name,
            "content": content,
            "ttl": ttl,
            "proxied": proxied
        }

        if priority is not None and record_type == "MX":
            data["priority"] = priority

        async with httpx.AsyncClient() as client:
            response = await client.post(
                f"{self.base_url}/zones/{zone_id}/dns_records",
                json=data,
                headers=self._headers()
            )

            return response.status_code in [200, 201]

    async def list_dns_records(
        self,
        zone_id: str,
        record_type: str = None
    ) -> List[Dict[str, Any]]:
        """List DNS records"""
        params = {}
        if record_type:
            params["type"] = record_type

        async with httpx.AsyncClient() as client:
            response = await client.get(
                f"{self.base_url}/zones/{zone_id}/dns_records",
                params=params,
                headers=self._headers()
            )

            if response.status_code == 200:
                return response.json().get("result", [])
            return []

cloudflare_service = CloudflareService()
```

---

## Environment Variables

```bash
# Admin Module Configuration

# Database
DATABASE_URL=postgresql+asyncpg://user:pass@host:5432/erp_staging

# Mailgun (Domain Management)
MAILGUN_API_KEY=your-mailgun-api-key
MAILGUN_DOMAIN=bheem.co.uk

# Cloudflare (DNS)
CLOUDFLARE_API_TOKEN=your-cloudflare-token
```

---

## Usage Examples

### Create a Tenant

```bash
curl -X POST "https://workspace.bheem.cloud/api/v1/admin/tenants" \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Acme Corporation",
    "slug": "acme-corp",
    "owner_email": "admin@acme.com",
    "plan": "business"
  }'
```

### Add a Domain

```bash
curl -X POST "https://workspace.bheem.cloud/api/v1/admin/tenants/{tenant_id}/domains" \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "domain": "mail.acme.com",
    "domain_type": "email"
  }'
```

### Verify Domain

```bash
curl -X POST "https://workspace.bheem.cloud/api/v1/admin/tenants/{tenant_id}/domains/{domain_id}/verify" \
  -H "Authorization: Bearer <token>"
```

---

*Document Version: 1.0*
*Last Updated: December 26, 2025*
