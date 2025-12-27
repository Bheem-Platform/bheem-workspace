# Bheem Workspace - Developer Guide

## Table of Contents
1. [Architecture Overview](#1-architecture-overview)
2. [Workspace Integration Guide](#2-workspace-integration-guide)
3. [Admin Module Implementation](#3-admin-module-implementation)
4. [API Reference](#4-api-reference)
5. [Database Schema](#5-database-schema)
6. [Authentication & Authorization](#6-authentication--authorization)
7. [Service Integrations](#7-service-integrations)

---

## 1. Architecture Overview

### System Architecture

```
┌─────────────────────────────────────────────────────────────────────────┐
│                          BHEEM WORKSPACE                                │
│                      https://workspace.bheem.cloud                      │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │                        FRONTEND LAYER                            │   │
│  │  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐            │   │
│  │  │   Meet   │ │   Docs   │ │   Mail   │ │  Admin   │            │   │
│  │  │  (HTML)  │ │  (HTML)  │ │  (HTML)  │ │  (HTML)  │            │   │
│  │  └──────────┘ └──────────┘ └──────────┘ └──────────┘            │   │
│  └─────────────────────────────────────────────────────────────────┘   │
│                                    │                                    │
│                                    ▼                                    │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │                     FASTAPI BACKEND (Port 8500)                  │   │
│  │                                                                  │   │
│  │  /api/v1/meet      → LiveKit room management                    │   │
│  │  /api/v1/docs      → Nextcloud WebDAV                           │   │
│  │  /api/v1/mail      → Mailcow integration                        │   │
│  │  /api/v1/calendar  → Nextcloud CalDAV                           │   │
│  │  /api/v1/admin     → Tenant/User/Domain management              │   │
│  │  /api/v1/auth      → ERP-based authentication                   │   │
│  │  /api/v1/sso       → OAuth2/OIDC provider                       │   │
│  └─────────────────────────────────────────────────────────────────┘   │
│                                    │                                    │
│                                    ▼                                    │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │                        SERVICES LAYER                            │   │
│  │                                                                  │   │
│  │  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐                │   │
│  │  │   SSO       │ │  Nextcloud  │ │   Mailcow   │                │   │
│  │  │  Service    │ │   Service   │ │   Service   │                │   │
│  │  └─────────────┘ └─────────────┘ └─────────────┘                │   │
│  │                                                                  │   │
│  │  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐                │   │
│  │  │  CalDAV     │ │   Mailgun   │ │ Cloudflare  │                │   │
│  │  │  Service    │ │   Service   │ │   Service   │                │   │
│  │  └─────────────┘ └─────────────┘ └─────────────┘                │   │
│  └─────────────────────────────────────────────────────────────────┘   │
│                                    │                                    │
└────────────────────────────────────┼────────────────────────────────────┘
                                     │
                                     ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                         EXTERNAL SERVICES                               │
├─────────────────────────────────────────────────────────────────────────┤
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐      │
│  │ LiveKit  │ │Nextcloud │ │ Mailcow  │ │ Mailgun  │ │Cloudflare│      │
│  │ (Meet)   │ │(Docs/Cal)│ │ (Mail)   │ │ (Email)  │ │  (DNS)   │      │
│  └──────────┘ └──────────┘ └──────────┘ └──────────┘ └──────────┘      │
│                                                                         │
│  ┌──────────────────────────────────────────────────────────────┐      │
│  │              PostgreSQL (erp_staging database)                │      │
│  │  - auth.users (user accounts)                                 │      │
│  │  - public.companies (tenants)                                 │      │
│  │  - workspace.* (workspace-specific tables)                    │      │
│  └──────────────────────────────────────────────────────────────┘      │
└─────────────────────────────────────────────────────────────────────────┘
```

### Directory Structure

```
/root/bheem-workspace/
├── backend/
│   ├── main.py                 # FastAPI application entry
│   ├── api/                    # API routes
│   │   ├── auth.py             # Authentication endpoints
│   │   ├── meet.py             # Video conferencing
│   │   ├── docs.py             # Document management
│   │   ├── mail.py             # Email integration
│   │   ├── calendar.py         # Calendar/events
│   │   ├── admin.py            # Admin panel APIs
│   │   ├── tenants.py          # Tenant management
│   │   ├── sso.py              # OAuth2/OIDC provider
│   │   └── recordings.py       # Meeting recordings
│   ├── services/               # Business logic
│   │   ├── sso_service.py      # SSO token management
│   │   ├── nextcloud_service.py # WebDAV client
│   │   ├── caldav_service.py   # CalDAV client
│   │   ├── mailcow_service.py  # Mail server API
│   │   ├── mailgun_service.py  # Email provider (NEW)
│   │   ├── cloudflare_service.py # DNS management (NEW)
│   │   └── notify_client.py    # Notification service
│   └── core/                   # Core utilities
│       ├── config.py           # Environment config
│       ├── database.py         # Database connection
│       └── security.py         # JWT/auth utilities
├── frontend/                   # HTML/JS frontend
│   └── dist/                   # Static files
└── docs/                       # Documentation
```

---

## 2. Workspace Integration Guide

### 2.1 Integrating Workspace with External Applications

#### Method 1: SSO Integration (OAuth2/OIDC)

Use Workspace as an identity provider for other Bheem services:

```python
# In your external application (e.g., bheem-academy)

from authlib.integrations.httpx_client import AsyncOAuth2Client

class WorkspaceSSO:
    def __init__(self):
        self.client_id = "your-app-client-id"
        self.client_secret = "your-app-client-secret"
        self.authorize_url = "https://workspace.bheem.cloud/api/v1/sso/authorize"
        self.token_url = "https://workspace.bheem.cloud/api/v1/sso/token"
        self.userinfo_url = "https://workspace.bheem.cloud/api/v1/sso/userinfo"

    async def get_authorization_url(self, redirect_uri: str, state: str) -> str:
        """Generate OAuth2 authorization URL"""
        return (
            f"{self.authorize_url}"
            f"?client_id={self.client_id}"
            f"&redirect_uri={redirect_uri}"
            f"&response_type=code"
            f"&scope=openid profile email"
            f"&state={state}"
        )

    async def exchange_code_for_token(self, code: str, redirect_uri: str) -> dict:
        """Exchange authorization code for tokens"""
        async with AsyncOAuth2Client(
            client_id=self.client_id,
            client_secret=self.client_secret
        ) as client:
            token = await client.fetch_token(
                self.token_url,
                grant_type="authorization_code",
                code=code,
                redirect_uri=redirect_uri
            )
            return token

    async def get_user_info(self, access_token: str) -> dict:
        """Get user information from Workspace"""
        async with httpx.AsyncClient() as client:
            response = await client.get(
                self.userinfo_url,
                headers={"Authorization": f"Bearer {access_token}"}
            )
            return response.json()
```

#### Method 2: API Integration

Call Workspace APIs directly from other services:

```python
# workspace_client.py - Reusable client for any Bheem service

import httpx
from typing import Optional, Dict, Any

class WorkspaceClient:
    def __init__(self, base_url: str = "https://workspace.bheem.cloud"):
        self.base_url = base_url
        self.api_url = f"{base_url}/api/v1"

    # ==================== MEET APIs ====================

    async def create_meeting_room(
        self,
        room_name: str,
        title: str,
        access_token: str
    ) -> Dict[str, Any]:
        """Create a new meeting room"""
        async with httpx.AsyncClient() as client:
            response = await client.post(
                f"{self.api_url}/meet/rooms",
                json={
                    "room_name": room_name,
                    "title": title
                },
                headers={"Authorization": f"Bearer {access_token}"}
            )
            return response.json()

    async def get_meeting_token(
        self,
        room_name: str,
        participant_name: str,
        access_token: str
    ) -> str:
        """Get LiveKit token for joining a meeting"""
        async with httpx.AsyncClient() as client:
            response = await client.post(
                f"{self.api_url}/meet/token",
                json={
                    "room_name": room_name,
                    "participant_name": participant_name
                },
                headers={"Authorization": f"Bearer {access_token}"}
            )
            return response.json().get("token")

    # ==================== DOCS APIs ====================

    async def upload_file(
        self,
        file_content: bytes,
        filename: str,
        path: str,
        nc_user: str,
        nc_pass: str
    ) -> Dict[str, Any]:
        """Upload file to Nextcloud"""
        async with httpx.AsyncClient() as client:
            response = await client.post(
                f"{self.api_url}/docs/upload",
                files={"file": (filename, file_content)},
                data={"path": path, "nc_user": nc_user, "nc_pass": nc_pass}
            )
            return response.json()

    async def list_files(
        self,
        path: str,
        nc_user: str,
        nc_pass: str
    ) -> Dict[str, Any]:
        """List files in a directory"""
        async with httpx.AsyncClient() as client:
            response = await client.get(
                f"{self.api_url}/docs/files",
                params={"path": path, "nc_user": nc_user, "nc_pass": nc_pass}
            )
            return response.json()

    async def get_share_link(
        self,
        path: str,
        nc_user: str,
        nc_pass: str,
        expires_days: int = 7
    ) -> Optional[str]:
        """Create public share link for a file"""
        async with httpx.AsyncClient() as client:
            response = await client.post(
                f"{self.api_url}/docs/share",
                json={"path": path, "expires_days": expires_days},
                params={"nc_user": nc_user, "nc_pass": nc_pass}
            )
            if response.status_code == 200:
                return response.json().get("share_url")
            return None

    # ==================== CALENDAR APIs ====================

    async def create_event(
        self,
        calendar_id: str,
        title: str,
        start: str,  # ISO format
        end: str,
        nc_user: str,
        nc_pass: str,
        location: str = "",
        description: str = ""
    ) -> Dict[str, Any]:
        """Create calendar event"""
        async with httpx.AsyncClient() as client:
            response = await client.post(
                f"{self.api_url}/calendar/events",
                json={
                    "calendar_id": calendar_id,
                    "title": title,
                    "start": start,
                    "end": end,
                    "location": location,
                    "description": description
                },
                params={"nc_user": nc_user, "nc_pass": nc_pass}
            )
            return response.json()

    async def get_events(
        self,
        calendar_id: str,
        start: str,
        end: str,
        nc_user: str,
        nc_pass: str
    ) -> Dict[str, Any]:
        """Get calendar events in date range"""
        async with httpx.AsyncClient() as client:
            response = await client.get(
                f"{self.api_url}/calendar/events",
                params={
                    "calendar_id": calendar_id,
                    "start": start,
                    "end": end,
                    "nc_user": nc_user,
                    "nc_pass": nc_pass
                }
            )
            return response.json()

    # ==================== ADMIN APIs ====================

    async def create_tenant(
        self,
        name: str,
        slug: str,
        owner_email: str,
        plan: str,
        access_token: str
    ) -> Dict[str, Any]:
        """Create a new tenant/organization"""
        async with httpx.AsyncClient() as client:
            response = await client.post(
                f"{self.api_url}/admin/tenants",
                json={
                    "name": name,
                    "slug": slug,
                    "owner_email": owner_email,
                    "plan": plan
                },
                headers={"Authorization": f"Bearer {access_token}"}
            )
            return response.json()

    async def add_domain(
        self,
        tenant_id: str,
        domain: str,
        access_token: str
    ) -> Dict[str, Any]:
        """Add a domain to a tenant"""
        async with httpx.AsyncClient() as client:
            response = await client.post(
                f"{self.api_url}/admin/tenants/{tenant_id}/domains",
                json={"domain": domain},
                headers={"Authorization": f"Bearer {access_token}"}
            )
            return response.json()
```

### 2.2 Using Workspace Client in Other Modules

#### Example: bheem-core Integration

```python
# In bheem-core/apps/backend/app/modules/project_management/services/

from workspace_client import WorkspaceClient

workspace = WorkspaceClient()

async def schedule_project_meeting(
    project_id: str,
    title: str,
    participants: list,
    user_token: str
):
    """Schedule a meeting for a project"""

    # Create meeting room
    room = await workspace.create_meeting_room(
        room_name=f"project-{project_id}-meeting",
        title=title,
        access_token=user_token
    )

    # Create calendar event for all participants
    for participant in participants:
        await workspace.create_event(
            calendar_id="work",
            title=f"Project Meeting: {title}",
            start=meeting_time.isoformat(),
            end=(meeting_time + timedelta(hours=1)).isoformat(),
            nc_user=participant.username,
            nc_pass=participant.nc_password,
            location=room["join_url"]
        )

    return room
```

#### Example: bheem-academy Integration

```python
# In bheem-academy/backend/services/

from workspace_client import WorkspaceClient

workspace = WorkspaceClient()

async def create_live_class(
    course_id: int,
    course_name: str,
    teacher_token: str
):
    """Create a live class for a course"""

    # Create meeting room
    room = await workspace.create_meeting_room(
        room_name=f"class-{course_id}",
        title=f"Live Class: {course_name}",
        access_token=teacher_token
    )

    return {
        "room_name": room["room_name"],
        "join_url": f"https://meet.bheem.cloud/room/{room['room_name']}"
    }

async def upload_course_material(
    course_id: int,
    file_content: bytes,
    filename: str,
    teacher_credentials: dict
):
    """Upload course material"""

    result = await workspace.upload_file(
        file_content=file_content,
        filename=filename,
        path=f"/Academy/Courses/{course_id}/Materials",
        nc_user=teacher_credentials["username"],
        nc_pass=teacher_credentials["password"]
    )

    return result
```

---

## 3. Admin Module Implementation

### 3.1 Current Admin Module Structure

The admin module in `/root/bheem-workspace/backend/api/admin.py` currently uses **in-memory storage**. This needs to be migrated to **PostgreSQL**.

### 3.2 Database Schema for Admin Module

Create these tables in the `workspace` schema:

```sql
-- Create workspace schema
CREATE SCHEMA IF NOT EXISTS workspace;

-- =====================================================
-- TENANT/ORGANIZATION MANAGEMENT
-- =====================================================

CREATE TABLE workspace.tenants (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    slug VARCHAR(100) NOT NULL UNIQUE,
    domain VARCHAR(255),
    owner_email VARCHAR(320) NOT NULL,

    -- Plan & Billing
    plan VARCHAR(50) NOT NULL DEFAULT 'free',
    billing_email VARCHAR(320),
    stripe_customer_id VARCHAR(100),

    -- Status
    is_active BOOLEAN DEFAULT TRUE,
    is_suspended BOOLEAN DEFAULT FALSE,
    suspended_reason TEXT,

    -- Quotas (based on plan)
    meet_quota_hours INTEGER DEFAULT 10,
    docs_quota_mb INTEGER DEFAULT 1024,
    mail_quota_mb INTEGER DEFAULT 512,
    recordings_quota_mb INTEGER DEFAULT 1024,
    max_users INTEGER DEFAULT 5,

    -- Current Usage
    meet_used_hours DECIMAL(10,2) DEFAULT 0,
    docs_used_mb DECIMAL(10,2) DEFAULT 0,
    mail_used_mb DECIMAL(10,2) DEFAULT 0,
    recordings_used_mb DECIMAL(10,2) DEFAULT 0,

    -- Settings (JSON)
    settings JSONB DEFAULT '{}',

    -- Timestamps
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    trial_ends_at TIMESTAMP,

    -- Audit
    created_by UUID REFERENCES auth.users(id)
);

CREATE INDEX idx_tenants_slug ON workspace.tenants(slug);
CREATE INDEX idx_tenants_owner ON workspace.tenants(owner_email);

-- =====================================================
-- TENANT USERS (linking auth.users to tenants)
-- =====================================================

CREATE TABLE workspace.tenant_users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES workspace.tenants(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

    -- Role within tenant
    role VARCHAR(50) NOT NULL DEFAULT 'member',  -- admin, manager, member

    -- Status
    is_active BOOLEAN DEFAULT TRUE,
    invited_at TIMESTAMP,
    joined_at TIMESTAMP,
    invited_by UUID REFERENCES auth.users(id),

    -- Permissions (JSON - granular permissions)
    permissions JSONB DEFAULT '{}',

    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),

    UNIQUE(tenant_id, user_id)
);

CREATE INDEX idx_tenant_users_tenant ON workspace.tenant_users(tenant_id);
CREATE INDEX idx_tenant_users_user ON workspace.tenant_users(user_id);

-- =====================================================
-- DOMAIN MANAGEMENT
-- =====================================================

CREATE TABLE workspace.domains (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES workspace.tenants(id) ON DELETE CASCADE,
    domain VARCHAR(255) NOT NULL UNIQUE,

    -- Domain type
    domain_type VARCHAR(20) NOT NULL DEFAULT 'email',  -- email, workspace, custom

    -- Provider references
    mailgun_domain_id VARCHAR(100),
    cloudflare_zone_id VARCHAR(50),

    -- Verification status
    spf_verified BOOLEAN DEFAULT FALSE,
    dkim_verified BOOLEAN DEFAULT FALSE,
    mx_verified BOOLEAN DEFAULT FALSE,
    ownership_verified BOOLEAN DEFAULT FALSE,

    -- Verification token (for DNS TXT record)
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
-- DOMAIN DNS RECORDS
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
-- DEVELOPER ACCESS
-- =====================================================

CREATE TABLE workspace.developers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

    -- Role
    role VARCHAR(30) NOT NULL,  -- lead_developer, developer, junior_developer

    -- Access credentials
    ssh_public_key TEXT,
    github_username VARCHAR(100),

    -- Status
    is_active BOOLEAN DEFAULT TRUE,

    -- Timestamps
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    created_by UUID REFERENCES auth.users(id)
);

CREATE INDEX idx_developers_user ON workspace.developers(user_id);

-- =====================================================
-- DEVELOPER PROJECT ACCESS
-- =====================================================

CREATE TABLE workspace.developer_projects (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    developer_id UUID NOT NULL REFERENCES workspace.developers(id) ON DELETE CASCADE,

    project_name VARCHAR(100) NOT NULL,  -- e.g., 'bheem-workspace', 'bheem-core'
    access_level VARCHAR(20) NOT NULL,   -- read, write, admin

    -- Git access control
    git_branch_pattern VARCHAR(100),     -- e.g., 'feature/*', 'develop'
    can_push_to_main BOOLEAN DEFAULT FALSE,
    can_deploy_staging BOOLEAN DEFAULT FALSE,
    can_deploy_production BOOLEAN DEFAULT FALSE,

    granted_at TIMESTAMP DEFAULT NOW(),
    granted_by UUID REFERENCES auth.users(id)
);

CREATE INDEX idx_dev_projects_developer ON workspace.developer_projects(developer_id);

-- =====================================================
-- ACTIVITY LOG
-- =====================================================

CREATE TABLE workspace.activity_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID REFERENCES workspace.tenants(id) ON DELETE SET NULL,
    user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,

    -- Action info
    action VARCHAR(100) NOT NULL,
    entity_type VARCHAR(50),
    entity_id UUID,
    description TEXT,

    -- Request info
    ip_address INET,
    user_agent VARCHAR(500),

    -- Additional data
    metadata JSONB,

    created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_activity_tenant ON workspace.activity_log(tenant_id);
CREATE INDEX idx_activity_user ON workspace.activity_log(user_id);
CREATE INDEX idx_activity_created ON workspace.activity_log(created_at);
```

### 3.3 Admin API Implementation

Replace the in-memory admin.py with database-backed implementation:

```python
# /root/bheem-workspace/backend/api/admin.py

"""
Bheem Workspace Admin API - Database-backed Implementation
"""
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

router = APIRouter()

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

class UserInvite(BaseModel):
    email: EmailStr
    name: str
    role: str = "member"

# ==================== PLAN CONFIGURATIONS ====================

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
    """List all tenants (SuperAdmin only)"""
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

    return tenants

@router.post("/tenants", response_model=TenantResponse)
async def create_tenant(
    tenant: TenantCreate,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(require_role(["SuperAdmin"]))
):
    """Create a new tenant (SuperAdmin only)"""
    # Check if slug exists
    existing = await db.execute(
        select(Tenant).where(Tenant.slug == tenant.slug)
    )
    if existing.scalar():
        raise HTTPException(status_code=400, detail="Slug already exists")

    # Get plan config
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

    return new_tenant

@router.get("/tenants/{tenant_id}", response_model=TenantResponse)
async def get_tenant(
    tenant_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    """Get tenant details"""
    result = await db.execute(
        select(Tenant).where(Tenant.id == tenant_id)
    )
    tenant = result.scalar()

    if not tenant:
        raise HTTPException(status_code=404, detail="Tenant not found")

    # Check access (SuperAdmin or tenant member)
    if current_user["role"] != "SuperAdmin":
        member = await db.execute(
            select(TenantUser).where(
                TenantUser.tenant_id == tenant_id,
                TenantUser.user_id == UUID(current_user["id"])
            )
        )
        if not member.scalar():
            raise HTTPException(status_code=403, detail="Access denied")

    return tenant

@router.patch("/tenants/{tenant_id}", response_model=TenantResponse)
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

    # Update fields
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

# ==================== DOMAIN ENDPOINTS ====================

@router.get("/tenants/{tenant_id}/domains", response_model=List[DomainResponse])
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

    # Include DNS records for each domain
    response = []
    for domain in domains:
        dns_result = await db.execute(
            select(DomainDNSRecord).where(DomainDNSRecord.domain_id == domain.id)
        )
        dns_records = dns_result.scalars().all()

        response.append({
            **domain.__dict__,
            "dns_records": [r.__dict__ for r in dns_records]
        })

    return response

@router.post("/tenants/{tenant_id}/domains", response_model=DomainResponse)
async def add_domain(
    tenant_id: UUID,
    domain_data: DomainCreate,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(require_role(["SuperAdmin", "Admin"]))
):
    """Add a domain to a tenant"""
    from services.mailgun_service import mailgun_service
    from services.cloudflare_service import cloudflare_service

    # Check if domain already exists
    existing = await db.execute(
        select(Domain).where(Domain.domain == domain_data.domain)
    )
    if existing.scalar():
        raise HTTPException(status_code=400, detail="Domain already exists")

    # 1. Add domain to Mailgun
    mailgun_result = await mailgun_service.add_domain(domain_data.domain)
    if not mailgun_result:
        raise HTTPException(status_code=500, detail="Failed to add domain to Mailgun")

    # 2. Create domain record
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

    # 3. Get DNS records from Mailgun and save them
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

    # 4. Try to auto-add DNS records to Cloudflare (if zone exists)
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

# ==================== USER MANAGEMENT ====================

@router.get("/tenants/{tenant_id}/users")
async def list_tenant_users(
    tenant_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    """List users in a tenant"""
    result = await db.execute(
        select(TenantUser, User)
        .join(User, TenantUser.user_id == User.id)
        .where(TenantUser.tenant_id == tenant_id)
    )
    users = result.all()

    return [
        {
            "id": tu.id,
            "user_id": tu.user_id,
            "email": user.email,
            "username": user.username,
            "role": tu.role,
            "is_active": tu.is_active,
            "joined_at": tu.joined_at
        }
        for tu, user in users
    ]

@router.post("/tenants/{tenant_id}/users/invite")
async def invite_user(
    tenant_id: UUID,
    invite: UserInvite,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(require_role(["SuperAdmin", "Admin"]))
):
    """Invite a user to a tenant"""
    # Check if user exists
    result = await db.execute(
        select(User).where(User.email == invite.email)
    )
    user = result.scalar()

    if not user:
        # Create user account (or send invite email)
        # For now, raise error
        raise HTTPException(
            status_code=400,
            detail="User not found. Please register first."
        )

    # Check if already a member
    existing = await db.execute(
        select(TenantUser).where(
            TenantUser.tenant_id == tenant_id,
            TenantUser.user_id == user.id
        )
    )
    if existing.scalar():
        raise HTTPException(status_code=400, detail="User is already a member")

    # Add to tenant
    tenant_user = TenantUser(
        tenant_id=tenant_id,
        user_id=user.id,
        role=invite.role,
        invited_at=datetime.utcnow(),
        joined_at=datetime.utcnow(),
        invited_by=UUID(current_user["id"])
    )
    db.add(tenant_user)
    await db.commit()

    # TODO: Send invitation email via Mailgun

    return {"message": "User added to tenant", "user_id": str(user.id)}

# ==================== DEVELOPER ACCESS ====================

@router.get("/developers")
async def list_developers(
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(require_role(["SuperAdmin", "LeadDeveloper"]))
):
    """List all developers"""
    result = await db.execute(
        select(Developer, User)
        .join(User, Developer.user_id == User.id)
        .where(Developer.is_active == True)
    )
    developers = result.all()

    return [
        {
            "id": dev.id,
            "user_id": dev.user_id,
            "username": user.username,
            "email": user.email,
            "role": dev.role,
            "github_username": dev.github_username,
            "created_at": dev.created_at
        }
        for dev, user in developers
    ]

@router.post("/developers")
async def add_developer(
    user_id: UUID,
    role: str,
    github_username: Optional[str] = None,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(require_role(["SuperAdmin"]))
):
    """Add a developer"""
    developer = Developer(
        user_id=user_id,
        role=role,
        github_username=github_username,
        created_by=UUID(current_user["id"])
    )
    db.add(developer)
    await db.commit()

    return {"message": "Developer added", "developer_id": str(developer.id)}

@router.post("/developers/{developer_id}/projects")
async def assign_project(
    developer_id: UUID,
    project_name: str,
    access_level: str,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(require_role(["SuperAdmin", "LeadDeveloper"]))
):
    """Assign developer to a project"""
    project_access = DeveloperProject(
        developer_id=developer_id,
        project_name=project_name,
        access_level=access_level,
        granted_by=UUID(current_user["id"])
    )
    db.add(project_access)
    await db.commit()

    return {"message": "Project access granted"}

# ==================== HELPER FUNCTIONS ====================

async def log_activity(
    db: AsyncSession,
    tenant_id: UUID,
    user_id: UUID,
    action: str,
    entity_type: str = None,
    entity_id: UUID = None,
    description: str = None,
    metadata: dict = None
):
    """Log an activity"""
    activity = ActivityLog(
        tenant_id=tenant_id,
        user_id=user_id,
        action=action,
        entity_type=entity_type,
        entity_id=entity_id,
        description=description,
        metadata=metadata
    )
    db.add(activity)
    await db.commit()

async def get_domain_with_records(domain_id: UUID, db: AsyncSession) -> dict:
    """Get domain with DNS records"""
    result = await db.execute(
        select(Domain).where(Domain.id == domain_id)
    )
    domain = result.scalar()

    dns_result = await db.execute(
        select(DomainDNSRecord).where(DomainDNSRecord.domain_id == domain_id)
    )
    dns_records = dns_result.scalars().all()

    return {
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
    }
```

### 3.4 Service Implementations

#### Mailgun Service

```python
# /root/bheem-workspace/backend/services/mailgun_service.py

"""
Mailgun API Service
"""
import httpx
import os
from typing import Optional, Dict, Any, List

class MailgunService:
    def __init__(self):
        self.api_key = os.getenv("MAILGUN_API_KEY")
        self.base_url = "https://api.mailgun.net/v3"

    async def add_domain(self, domain: str) -> Optional[Dict[str, Any]]:
        """Add a new domain to Mailgun"""
        async with httpx.AsyncClient() as client:
            response = await client.post(
                f"{self.base_url}/domains",
                auth=("api", self.api_key),
                data={"name": domain}
            )

            if response.status_code in [200, 201]:
                return response.json()
            elif response.status_code == 400 and "already exists" in response.text:
                # Domain already exists, get its info
                return await self.get_domain(domain)
            return None

    async def get_domain(self, domain: str) -> Optional[Dict[str, Any]]:
        """Get domain details including DNS records"""
        async with httpx.AsyncClient() as client:
            response = await client.get(
                f"{self.base_url}/domains/{domain}",
                auth=("api", self.api_key)
            )

            if response.status_code == 200:
                return response.json()
            return None

    async def verify_domain(self, domain: str) -> Optional[Dict[str, Any]]:
        """Verify domain DNS records"""
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

    async def send_email(
        self,
        to: str,
        subject: str,
        html: str,
        from_email: str = None,
        from_name: str = "Bheem Workspace"
    ) -> bool:
        """Send an email via Mailgun"""
        domain = os.getenv("MAILGUN_DOMAIN", "bheem.co.uk")
        sender = from_email or f"noreply@{domain}"

        async with httpx.AsyncClient() as client:
            response = await client.post(
                f"{self.base_url}/{domain}/messages",
                auth=("api", self.api_key),
                data={
                    "from": f"{from_name} <{sender}>",
                    "to": to,
                    "subject": subject,
                    "html": html
                }
            )

            return response.status_code == 200

mailgun_service = MailgunService()
```

#### Cloudflare Service

```python
# /root/bheem-workspace/backend/services/cloudflare_service.py

"""
Cloudflare DNS API Service
"""
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
        """Get Cloudflare zone ID for a domain"""
        # Extract root domain
        parts = domain.split(".")
        root_domain = ".".join(parts[-2:]) if len(parts) > 2 else domain

        async with httpx.AsyncClient() as client:
            response = await client.get(
                f"{self.base_url}/zones",
                params={"name": root_domain},
                headers=self._headers()
            )

            if response.status_code == 200:
                data = response.json()
                zones = data.get("result", [])
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
        """Add a DNS record to Cloudflare"""
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
        """List DNS records for a zone"""
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

    async def delete_dns_record(
        self,
        zone_id: str,
        record_id: str
    ) -> bool:
        """Delete a DNS record"""
        async with httpx.AsyncClient() as client:
            response = await client.delete(
                f"{self.base_url}/zones/{zone_id}/dns_records/{record_id}",
                headers=self._headers()
            )

            return response.status_code == 200

cloudflare_service = CloudflareService()
```

---

## 4. API Reference

### Authentication

All API requests require authentication via JWT token:

```
Authorization: Bearer <access_token>
```

### Base URL

```
Production: https://workspace.bheem.cloud/api/v1
Development: http://localhost:8500/api/v1
```

### Endpoints Summary

| Module | Endpoint | Description |
|--------|----------|-------------|
| **Auth** | POST /auth/login | Login and get token |
| **Auth** | GET /auth/me | Get current user |
| **SSO** | GET /sso/authorize | OAuth2 authorization |
| **SSO** | POST /sso/token | Exchange code for token |
| **Meet** | POST /meet/rooms | Create meeting room |
| **Meet** | POST /meet/token | Get LiveKit token |
| **Docs** | GET /docs/files | List files |
| **Docs** | POST /docs/upload | Upload file |
| **Calendar** | GET /calendar/events | Get events |
| **Calendar** | POST /calendar/events | Create event |
| **Admin** | GET /admin/tenants | List tenants |
| **Admin** | POST /admin/tenants | Create tenant |
| **Admin** | POST /admin/tenants/{id}/domains | Add domain |

---

## 5. Environment Configuration

```bash
# /root/bheem-workspace/backend/.env

# Database
DATABASE_URL=postgresql+asyncpg://user:pass@host:5432/erp_staging

# JWT
SECRET_KEY=your-secret-key
ACCESS_TOKEN_EXPIRE_MINUTES=1440

# Nextcloud (Docs & Calendar)
NEXTCLOUD_URL=https://docs.bheem.cloud
NEXTCLOUD_ADMIN_USER=admin
NEXTCLOUD_ADMIN_PASS=password

# LiveKit (Meet)
LIVEKIT_API_KEY=your-api-key
LIVEKIT_API_SECRET=your-api-secret
LIVEKIT_URL=wss://meet.bheem.cloud

# Mailcow (Mail)
MAILCOW_API_KEY=your-api-key
MAILCOW_API_URL=https://mail.bheem.cloud/api/v1

# Mailgun (Email Sending)
MAILGUN_API_KEY=your-api-key
MAILGUN_DOMAIN=bheem.co.uk

# Cloudflare (DNS)
CLOUDFLARE_API_TOKEN=your-api-token

# MSG91 (SMS/OTP)
MSG91_AUTH_KEY=your-auth-key
```

---

## 6. Quick Start for Developers

### 1. Clone and Setup

```bash
cd /root/bheem-workspace/backend
python -m venv venv
source venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
# Edit .env with your credentials
```

### 2. Run Database Migrations

```bash
# Create workspace schema tables
psql -h host -U user -d erp_staging -f docs/schema.sql
```

### 3. Start Development Server

```bash
uvicorn main:app --host 0.0.0.0 --port 8500 --reload
```

### 4. Access API Docs

```
Swagger UI: http://localhost:8500/docs
ReDoc: http://localhost:8500/redoc
```

---

*Document Version: 1.0*
*Last Updated: December 26, 2025*
