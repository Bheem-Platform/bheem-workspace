# Bheem Workspace - Admin Module Implementation Plan

## Executive Summary

This document provides a comprehensive end-to-end implementation plan for completing the Admin Module of Bheem Workspace. Based on thorough analysis of the codebase, documentation, and integration points, this plan outlines what exists, what's missing, and the detailed steps to achieve a production-ready admin system.

---

## Table of Contents

1. [Current State Analysis](#1-current-state-analysis)
2. [Architecture Overview](#2-architecture-overview)
3. [Implementation Status Matrix](#3-implementation-status-matrix)
4. [Gap Analysis](#4-gap-analysis)
5. [Implementation Phases](#5-implementation-phases)
6. [Detailed Task Breakdown](#6-detailed-task-breakdown)
7. [API Endpoints Reference](#7-api-endpoints-reference)
8. [Database Schema](#8-database-schema)
9. [Integration Points](#9-integration-points)
10. [Security Considerations](#10-security-considerations)
11. [Testing Strategy](#11-testing-strategy)
12. [Deployment Checklist](#12-deployment-checklist)

---

## 1. Current State Analysis

### What's Working (Production Ready)

| Module | Status | Description |
|--------|--------|-------------|
| **Authentication** | ✅ 95% | Bheem Passport SSO with local fallback |
| **Tenant Management** | ✅ 100% | Full CRUD operations |
| **User Management** | ✅ 100% | Invite, roles, permissions |
| **Domain Management** | ✅ 95% | Add, verify with Mailgun/Cloudflare |
| **Mail Admin** | ✅ 100% | Mailbox CRUD via Mailcow |
| **Meet Settings** | ✅ 100% | Configuration and stats |
| **Activity Logging** | ✅ 100% | Full audit trail |
| **Frontend Admin UI** | ✅ 85% | All major pages built |

### What's Partially Implemented

| Module | Status | Missing Items |
|--------|--------|---------------|
| **Billing/Plans** | ✅ External | Handled by Bheem Pay service |
| **Docs Admin** | ⚠️ 40% | Management UI, quota controls |
| **Developer Portal** | ⚠️ 70% | Detail pages, project management |
| **Super Admin** | ⚠️ 70% | Tenant/developer detail pages |
| **SSO Provider** | ⚠️ 60% | Client management, token refresh |

### What's Missing

| Module | Status | Required Work |
|--------|--------|---------------|
| **Health Monitoring** | ❌ 0% | Service health, uptime tracking |
| **Reporting/Analytics** | ❌ 0% | Usage reports, trend analysis |
| **Notifications** | ✅ External | Handled by Bheem Notify service |
| **Backup/Recovery** | ❌ 0% | Data export, restore |
| **API Rate Limiting** | ❌ 0% | Quota enforcement |

---

## 2. Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                     BHEEM WORKSPACE                              │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐          │
│  │   Frontend   │  │   Backend    │  │   Services   │          │
│  │   (Next.js)  │  │  (FastAPI)   │  │    Layer     │          │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘          │
│         │                  │                  │                  │
│         └────────┬─────────┴─────────┬───────┘                  │
│                  │                   │                           │
│         ┌────────▼───────────────────▼────────┐                 │
│         │           PostgreSQL                 │                 │
│         │      (workspace schema)              │                 │
│         └─────────────────────────────────────┘                 │
│                                                                  │
├─────────────────────────────────────────────────────────────────┤
│                   EXTERNAL SERVICES                              │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌────────────┐ ┌────────────┐ ┌────────────┐ ┌────────────┐   │
│  │   Bheem    │ │  LiveKit   │ │  Nextcloud │ │  Mailcow   │   │
│  │  Passport  │ │  (Video)   │ │   (Docs)   │ │  (Email)   │   │
│  └────────────┘ └────────────┘ └────────────┘ └────────────┘   │
│                                                                  │
│  ┌────────────┐ ┌────────────┐ ┌────────────┐ ┌────────────┐   │
│  │  Mailgun   │ │ Cloudflare │ │    S3      │ │   Bheem    │   │
│  │ (Trans.E.) │ │   (DNS)    │ │ (Storage)  │ │  Notify    │   │
│  └────────────┘ └────────────┘ └────────────┘ └────────────┘   │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### Technology Stack

| Layer | Technology |
|-------|------------|
| Frontend | Next.js 14, React 18, TypeScript, Tailwind CSS, Zustand |
| Backend | FastAPI, Python 3.11, SQLAlchemy 2.0, Pydantic |
| Database | PostgreSQL 15 (workspace schema) |
| Auth | JWT, OAuth2/OIDC, Bheem Passport |
| Video | LiveKit |
| Docs | Nextcloud WebDAV, OnlyOffice |
| Email | Mailcow (IMAP/SMTP), Mailgun (transactional) |
| DNS | Cloudflare API |
| Storage | S3-compatible (recordings, files) |

---

## 3. Implementation Status Matrix

### Backend API Endpoints

| Endpoint Group | Total | Implemented | Working | Missing |
|----------------|-------|-------------|---------|---------|
| `/auth/*` | 8 | 8 | 8 | 0 |
| `/admin/tenants/*` | 5 | 5 | 5 | 0 |
| `/admin/tenants/{id}/users/*` | 4 | 4 | 4 | 0 |
| `/admin/tenants/{id}/domains/*` | 5 | 5 | 5 | 0 |
| `/admin/tenants/{id}/mail/*` | 4 | 4 | 4 | 0 |
| `/admin/tenants/{id}/meet/*` | 3 | 3 | 3 | 0 |
| `/admin/tenants/{id}/docs/*` | 1 | 1 | 1 | 3 |
| `/admin/developers/*` | 3 | 3 | 3 | 0 |
| `/admin/billing/*` | 0 | 0 | 0 | 5 |
| `/admin/health/*` | 0 | 0 | 0 | 3 |
| **TOTAL** | 33 | 33 | 33 | 11 |

### Frontend Pages

| Page | Route | Status | Notes |
|------|-------|--------|-------|
| Admin Dashboard | `/admin` | ✅ Complete | Stats, activity, quick actions |
| User Management | `/admin/users` | ✅ Complete | List, invite, manage |
| User Invite | `/admin/users/invite` | ✅ Complete | Invitation form |
| Domain List | `/admin/domains` | ✅ Complete | List with verification |
| Add Domain | `/admin/domains/new` | ✅ Complete | Domain addition form |
| Domain Detail | `/admin/domains/[id]` | ⚠️ Partial | DNS records display incomplete |
| Mail Settings | `/admin/mail` | ✅ Complete | Mailbox management |
| Meet Settings | `/admin/meet` | ✅ Complete | Configuration options |
| Billing | `/admin/billing` | ⚠️ Partial | Uses hardcoded data |
| Activity Log | `/admin/activity` | ✅ Complete | Filtering, export |
| Super Admin Dashboard | `/super-admin` | ✅ Complete | Platform overview |
| Tenant List | `/super-admin/tenants` | ✅ Complete | All tenants |
| Tenant Detail | `/super-admin/tenants/[id]` | ⚠️ Stub | Not implemented |
| Developer List | `/super-admin/developers` | ⚠️ Stub | Basic list only |
| Developer Detail | `/super-admin/developers/[id]` | ⚠️ Stub | Not implemented |

### Services Integration

| Service | Integration Status | API Methods |
|---------|-------------------|-------------|
| Bheem Passport | ✅ Complete | login, verify, refresh, userinfo |
| LiveKit | ✅ Complete | createToken, generateRoom |
| Mailcow | ✅ Complete | CRUD mailboxes, IMAP/SMTP |
| Mailgun | ✅ Complete | domains, DNS, send |
| Cloudflare | ✅ Complete | zones, DNS records |
| Nextcloud | ⚠️ Partial | WebDAV basics |
| Bheem Notify | ✅ External | email, SMS, OTP, push notifications (external service) |
| S3 Storage | ⚠️ Partial | upload, download |

---

## 4. Gap Analysis

### Critical Gaps (Must Fix)

#### 4.1 Security Issues
```
Location: /backend/services/mailcow_service.py

ISSUES:
- Line 24: Hardcoded IP address (135.181.25.62)
- Line 102: Hardcoded SSH key path (/root/.ssh/sundeep)
- Line 111: Hardcoded MySQL credentials in SSH command

RISK: High - Credentials exposed in code
FIX: Move to environment variables
```

#### 4.2 Missing Authentication on Admin API
```
Location: /backend/api/admin.py

ISSUE: No authentication/authorization middleware
RISK: High - Any request can access admin endpoints
FIX: Add dependency injection for auth verification
```

#### 4.3 No Rate Limiting
```
Location: All API endpoints

ISSUE: No request throttling
RISK: Medium - DoS vulnerability
FIX: Implement FastAPI rate limiting middleware
```

### Functional Gaps

#### 4.4 Billing Module
```
Current State:
- Frontend: Hardcoded plan data, no API calls
- Backend: No billing endpoints exist

Required:
- Stripe/payment integration
- Invoice generation
- Subscription management
- Usage-based billing
```

#### 4.5 Docs Administration
```
Current State:
- Backend: Only stats endpoint
- Frontend: No admin UI

Required:
- Storage quota management per user
- Shared folder administration
- Access control management
- Version history access
```

#### 4.6 Platform Monitoring
```
Current State:
- No health check endpoints
- Hardcoded "99.9% uptime" in UI

Required:
- Service health endpoints
- Uptime tracking
- Error rate monitoring
- Performance metrics
```

### Frontend-Backend Mismatches

| Issue | Frontend Expects | Backend Returns | Fix |
|-------|-----------------|-----------------|-----|
| User details | email, name, last_login | user_id only | Fetch from Passport |
| Domain status | verification_status | separate flags | Add computed field |
| Billing data | Full billing object | Nothing | Implement billing API |

---

## 5. Implementation Phases

### Phase 1: Security & Stability (Week 1)
**Priority: CRITICAL**

```
Tasks:
├── 1.1 Fix hardcoded credentials in mailcow_service.py
├── 1.2 Add authentication middleware to admin API
├── 1.3 Implement role-based access control (RBAC)
├── 1.4 Add request validation and sanitization
├── 1.5 Set up structured logging
└── 1.6 Add error tracking (Sentry integration)

Deliverables:
- Secure admin API with proper auth
- No hardcoded secrets in code
- Audit logging for all admin actions
```

### Phase 2: Complete Frontend Pages (Week 2)
**Priority: HIGH**

```
Tasks:
├── 2.1 Complete domain detail page (/admin/domains/[id])
├── 2.2 Implement tenant detail page (/super-admin/tenants/[id])
├── 2.3 Build developer list page (/super-admin/developers)
├── 2.4 Build developer detail page (/super-admin/developers/[id])
├── 2.5 Add form validation to all admin forms
└── 2.6 Implement loading states and error handling

Deliverables:
- All admin pages functional
- Consistent UX across admin panel
- Proper error messages
```

### Phase 3: Billing Integration (Week 3)
**Priority: HIGH**

```
Tasks:
├── 3.1 Create Stripe service (/services/stripe_service.py)
├── 3.2 Implement billing API endpoints (/api/billing.py)
│   ├── GET /billing/subscription
│   ├── POST /billing/subscribe
│   ├── POST /billing/cancel
│   ├── GET /billing/invoices
│   └── POST /billing/payment-method
├── 3.3 Create invoice generation service
├── 3.4 Connect frontend billing page to API
├── 3.5 Implement plan upgrade/downgrade flow
└── 3.6 Add webhook handlers for Stripe events

Deliverables:
- Working subscription management
- Invoice generation and history
- Payment method management
```

### Phase 4: Docs Administration (Week 4)
**Priority: MEDIUM**

```
Tasks:
├── 4.1 Extend Nextcloud service with admin methods
├── 4.2 Add docs admin API endpoints
│   ├── GET /admin/tenants/{id}/docs/quotas
│   ├── PATCH /admin/tenants/{id}/docs/quotas
│   ├── GET /admin/tenants/{id}/docs/shares
│   ├── DELETE /admin/tenants/{id}/docs/shares/{id}
│   └── GET /admin/tenants/{id}/docs/activity
├── 4.3 Create docs admin page (/admin/docs)
├── 4.4 Implement storage quota management UI
└── 4.5 Add shared folder administration

Deliverables:
- Docs storage management
- Quota controls per user
- Share management UI
```

### Phase 5: Monitoring & Health (Week 5)
**Priority: MEDIUM**

```
Tasks:
├── 5.1 Create health check API (/api/health.py)
│   ├── GET /health - Overall health
│   ├── GET /health/services - Service status
│   └── GET /health/database - DB connection
├── 5.2 Implement service monitoring
│   ├── Passport connectivity
│   ├── LiveKit status
│   ├── Mailcow health
│   ├── Nextcloud availability
│   └── Database connections
├── 5.3 Create health dashboard page (/super-admin/health)
├── 5.4 Add uptime tracking
└── 5.5 Connect alerting to Bheem Notify (external service already available)

Deliverables:
- Real-time service health dashboard
- Automated health checks
- Alert notifications
```

### Phase 6: Advanced Features (Week 6+)
**Priority: LOW**

```
Tasks:
├── 6.1 Reporting & Analytics
│   ├── Usage reports generation
│   ├── Trend analysis
│   └── Export functionality (PDF, Excel)
├── 6.2 Bulk Operations
│   ├── Bulk user import (CSV)
│   ├── Bulk domain verification
│   └── Batch mailbox creation
├── 6.3 Bheem Notify Integration (External Service)
│   ├── Connect admin events to Bheem Notify API
│   ├── Configure notification templates for admin alerts
│   └── Set up webhook callbacks from Bheem Notify
├── 6.4 Customization
│   ├── Custom branding per tenant
│   ├── White-label options
│   └── Custom email templates
└── 6.5 API Management
    ├── API key generation
    ├── Rate limit configuration
    └── Usage tracking per API key

Deliverables:
- Advanced admin capabilities
- Self-service options for tenants
- Full API management
```

---

## 6. Detailed Task Breakdown

### Phase 1: Security & Stability

#### Task 1.1: Fix Hardcoded Credentials
**File:** `/backend/services/mailcow_service.py`

```python
# BEFORE (Lines 24, 102, 111):
MAIL_HOST = "135.181.25.62"
SSH_KEY_PATH = "/root/.ssh/sundeep"
command = f"mysql -u root -p'{password}' mailcow..."

# AFTER:
MAIL_HOST = os.getenv("MAILCOW_HOST", "mail.bheem.cloud")
SSH_KEY_PATH = os.getenv("SSH_KEY_PATH", "/home/user/.ssh/id_rsa")
# Move MySQL credentials to environment variables
```

**Environment Variables to Add:**
```bash
# .env
MAILCOW_HOST=135.181.25.62
MAILCOW_SSH_HOST=135.181.25.62
MAILCOW_SSH_USER=root
MAILCOW_SSH_KEY_PATH=/path/to/key
MAILCOW_MYSQL_USER=root
MAILCOW_MYSQL_PASSWORD=secure_password
```

---

#### Task 1.2: Add Authentication Middleware
**File:** `/backend/api/admin.py`

```python
# Add at top of file:
from core.security import get_current_user, require_role

# Add dependency to all admin endpoints:
@router.get("/tenants")
async def list_tenants(
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    # Verify user has admin role
    if current_user.get("role") not in ["SuperAdmin", "Admin"]:
        raise HTTPException(status_code=403, detail="Admin access required")
    # ... rest of implementation
```

**New Security Functions:**
```python
# /backend/core/security.py

async def require_role(allowed_roles: List[str]):
    """Dependency to check user role"""
    async def role_checker(current_user: dict = Depends(get_current_user)):
        if current_user.get("role") not in allowed_roles:
            raise HTTPException(
                status_code=403,
                detail=f"Required role: {', '.join(allowed_roles)}"
            )
        return current_user
    return role_checker

def require_tenant_access(tenant_id: str, user: dict) -> bool:
    """Check if user has access to tenant"""
    if user.get("role") == "SuperAdmin":
        return True
    return user.get("company_id") == tenant_id
```

---

#### Task 1.3: Implement RBAC
**New File:** `/backend/core/rbac.py`

```python
"""Role-Based Access Control"""
from enum import Enum
from typing import List

class Role(str, Enum):
    SUPER_ADMIN = "SuperAdmin"
    TENANT_ADMIN = "Admin"
    MANAGER = "Manager"
    MEMBER = "Member"

class Permission(str, Enum):
    # Tenant permissions
    TENANT_READ = "tenant:read"
    TENANT_WRITE = "tenant:write"
    TENANT_DELETE = "tenant:delete"

    # User permissions
    USER_READ = "user:read"
    USER_INVITE = "user:invite"
    USER_MANAGE = "user:manage"

    # Domain permissions
    DOMAIN_READ = "domain:read"
    DOMAIN_ADD = "domain:add"
    DOMAIN_VERIFY = "domain:verify"

    # ... more permissions

ROLE_PERMISSIONS = {
    Role.SUPER_ADMIN: ["*"],  # All permissions
    Role.TENANT_ADMIN: [
        Permission.TENANT_READ,
        Permission.USER_READ,
        Permission.USER_INVITE,
        Permission.USER_MANAGE,
        Permission.DOMAIN_READ,
        Permission.DOMAIN_ADD,
        Permission.DOMAIN_VERIFY,
    ],
    Role.MANAGER: [
        Permission.TENANT_READ,
        Permission.USER_READ,
        Permission.USER_INVITE,
    ],
    Role.MEMBER: [
        Permission.TENANT_READ,
    ],
}

def has_permission(role: str, permission: Permission) -> bool:
    """Check if role has permission"""
    role_perms = ROLE_PERMISSIONS.get(Role(role), [])
    return "*" in role_perms or permission in role_perms
```

---

### Phase 2: Complete Frontend Pages

#### Task 2.1: Domain Detail Page
**File:** `/frontend/src/pages/admin/domains/[id].tsx`

```typescript
// Key components needed:
// 1. Domain header with status
// 2. DNS records table with copy functionality
// 3. Verification button and status
// 4. Services toggle (mail, meet enabled)
// 5. Delete domain option

// API calls:
// - GET /admin/tenants/{tenant_id}/domains/{domain_id}
// - GET /admin/tenants/{tenant_id}/domains/{domain_id}/dns-records
// - POST /admin/tenants/{tenant_id}/domains/{domain_id}/verify
// - DELETE /admin/tenants/{tenant_id}/domains/{domain_id}
```

#### Task 2.2: Tenant Detail Page (Super Admin)
**File:** `/frontend/src/pages/super-admin/tenants/[id].tsx`

```typescript
// Components:
// 1. Tenant info header (name, slug, plan)
// 2. Usage stats (users, storage, meetings)
// 3. User list with management
// 4. Domain list
// 5. Activity log
// 6. Plan management (upgrade/downgrade)
// 7. Suspend/activate tenant
// 8. Delete tenant

// API calls:
// - GET /admin/tenants/{tenant_id}
// - GET /admin/tenants/{tenant_id}/users
// - GET /admin/tenants/{tenant_id}/domains
// - GET /admin/tenants/{tenant_id}/activity
// - PATCH /admin/tenants/{tenant_id}
// - DELETE /admin/tenants/{tenant_id}
```

---

### Phase 3: Billing Integration

#### Task 3.1: Stripe Service
**New File:** `/backend/services/stripe_service.py`

```python
"""Stripe Payment Integration"""
import stripe
from typing import Optional, Dict, Any
from core.config import settings

stripe.api_key = settings.STRIPE_SECRET_KEY

class StripeService:

    async def create_customer(
        self,
        email: str,
        name: str,
        tenant_id: str
    ) -> Dict[str, Any]:
        """Create Stripe customer for tenant"""
        customer = stripe.Customer.create(
            email=email,
            name=name,
            metadata={"tenant_id": tenant_id}
        )
        return customer

    async def create_subscription(
        self,
        customer_id: str,
        price_id: str
    ) -> Dict[str, Any]:
        """Create subscription for customer"""
        subscription = stripe.Subscription.create(
            customer=customer_id,
            items=[{"price": price_id}],
            payment_behavior="default_incomplete",
            expand=["latest_invoice.payment_intent"]
        )
        return subscription

    async def cancel_subscription(
        self,
        subscription_id: str,
        immediately: bool = False
    ) -> Dict[str, Any]:
        """Cancel subscription"""
        if immediately:
            return stripe.Subscription.delete(subscription_id)
        return stripe.Subscription.modify(
            subscription_id,
            cancel_at_period_end=True
        )

    async def get_invoices(
        self,
        customer_id: str,
        limit: int = 10
    ) -> list:
        """Get customer invoices"""
        invoices = stripe.Invoice.list(
            customer=customer_id,
            limit=limit
        )
        return invoices.data

    async def update_payment_method(
        self,
        customer_id: str,
        payment_method_id: str
    ) -> Dict[str, Any]:
        """Update default payment method"""
        stripe.Customer.modify(
            customer_id,
            invoice_settings={
                "default_payment_method": payment_method_id
            }
        )
        return {"success": True}

stripe_service = StripeService()
```

#### Task 3.2: Billing API Endpoints
**New File:** `/backend/api/billing.py`

```python
"""Billing API Endpoints"""
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from typing import Optional, List
from services.stripe_service import stripe_service
from core.security import get_current_user

router = APIRouter(prefix="/billing", tags=["Billing"])

class SubscribeRequest(BaseModel):
    plan: str  # free, starter, business, enterprise
    payment_method_id: Optional[str] = None

class SubscriptionResponse(BaseModel):
    id: str
    plan: str
    status: str
    current_period_end: str
    cancel_at_period_end: bool

@router.get("/subscription", response_model=SubscriptionResponse)
async def get_subscription(
    current_user: dict = Depends(get_current_user)
):
    """Get current subscription"""
    # Implementation
    pass

@router.post("/subscribe")
async def subscribe(
    request: SubscribeRequest,
    current_user: dict = Depends(get_current_user)
):
    """Create or update subscription"""
    # Implementation
    pass

@router.post("/cancel")
async def cancel_subscription(
    current_user: dict = Depends(get_current_user)
):
    """Cancel subscription"""
    # Implementation
    pass

@router.get("/invoices")
async def get_invoices(
    current_user: dict = Depends(get_current_user)
):
    """Get invoice history"""
    # Implementation
    pass

@router.post("/payment-method")
async def update_payment_method(
    payment_method_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Update payment method"""
    # Implementation
    pass

@router.post("/webhook")
async def stripe_webhook(request: Request):
    """Handle Stripe webhooks"""
    # Implementation
    pass
```

---

### Phase 4: Docs Administration

#### Task 4.2: Docs Admin API Endpoints
**Add to:** `/backend/api/admin.py`

```python
# ==================== DOCS ADMIN ENDPOINTS ====================

@router.get("/tenants/{tenant_id}/docs/quotas")
async def get_docs_quotas(
    tenant_id: str,
    db: AsyncSession = Depends(get_db)
):
    """Get storage quotas for all users in tenant"""
    resolved_id = await resolve_tenant_id(tenant_id, db)
    # Get quotas from Nextcloud
    # Return per-user quota allocation
    pass

@router.patch("/tenants/{tenant_id}/docs/quotas/{user_id}")
async def update_user_quota(
    tenant_id: str,
    user_id: str,
    quota_mb: int,
    db: AsyncSession = Depends(get_db)
):
    """Update storage quota for specific user"""
    # Update quota in Nextcloud
    pass

@router.get("/tenants/{tenant_id}/docs/shares")
async def list_shares(
    tenant_id: str,
    db: AsyncSession = Depends(get_db)
):
    """List all shared files/folders in tenant"""
    # Get shares from Nextcloud
    pass

@router.delete("/tenants/{tenant_id}/docs/shares/{share_id}")
async def delete_share(
    tenant_id: str,
    share_id: str,
    db: AsyncSession = Depends(get_db)
):
    """Remove a share"""
    # Delete share in Nextcloud
    pass

@router.get("/tenants/{tenant_id}/docs/activity")
async def get_docs_activity(
    tenant_id: str,
    limit: int = 50,
    db: AsyncSession = Depends(get_db)
):
    """Get document activity log"""
    # Get activity from Nextcloud
    pass
```

---

### Phase 5: Monitoring & Health

#### Task 5.1: Health Check API
**New File:** `/backend/api/health.py`

```python
"""Health Check API"""
from fastapi import APIRouter
from typing import Dict, Any
import asyncio
from datetime import datetime

from services.passport_client import get_passport_client
from services.mailcow_service import mailcow_service
from services.livekit_service import livekit_service
from core.database import engine

router = APIRouter(prefix="/health", tags=["Health"])

@router.get("")
async def health_check() -> Dict[str, Any]:
    """Overall system health"""
    return {
        "status": "healthy",
        "timestamp": datetime.utcnow().isoformat(),
        "version": "1.0.0"
    }

@router.get("/services")
async def services_health() -> Dict[str, Any]:
    """Check all service connections"""
    results = {}

    # Check Passport
    try:
        passport = get_passport_client()
        healthy = await passport.health_check()
        results["passport"] = {
            "status": "healthy" if healthy else "unhealthy",
            "latency_ms": None
        }
    except Exception as e:
        results["passport"] = {"status": "error", "error": str(e)}

    # Check Mailcow
    try:
        # Implement mailcow health check
        results["mailcow"] = {"status": "healthy"}
    except Exception as e:
        results["mailcow"] = {"status": "error", "error": str(e)}

    # Check LiveKit
    try:
        # Implement livekit health check
        results["livekit"] = {"status": "healthy"}
    except Exception as e:
        results["livekit"] = {"status": "error", "error": str(e)}

    # Overall status
    all_healthy = all(
        s.get("status") == "healthy"
        for s in results.values()
    )

    return {
        "status": "healthy" if all_healthy else "degraded",
        "services": results,
        "timestamp": datetime.utcnow().isoformat()
    }

@router.get("/database")
async def database_health() -> Dict[str, Any]:
    """Check database connection"""
    try:
        async with engine.begin() as conn:
            await conn.execute("SELECT 1")
        return {
            "status": "healthy",
            "database": "postgresql",
            "timestamp": datetime.utcnow().isoformat()
        }
    except Exception as e:
        return {
            "status": "unhealthy",
            "error": str(e),
            "timestamp": datetime.utcnow().isoformat()
        }
```

---

## 7. API Endpoints Reference

### Complete Admin API

```
Authentication:
POST   /api/v1/auth/login              # Login
POST   /api/v1/auth/logout             # Logout
POST   /api/v1/auth/refresh            # Refresh token
GET    /api/v1/auth/me                 # Current user

Tenant Management (Admin):
GET    /api/v1/admin/tenants                        # List tenants
POST   /api/v1/admin/tenants                        # Create tenant
GET    /api/v1/admin/tenants/{id}                   # Get tenant
PATCH  /api/v1/admin/tenants/{id}                   # Update tenant
DELETE /api/v1/admin/tenants/{id}                   # Delete tenant
GET    /api/v1/admin/tenants/{id}/dashboard         # Dashboard data

User Management:
GET    /api/v1/admin/tenants/{id}/users             # List users
POST   /api/v1/admin/tenants/{id}/users             # Add user
PATCH  /api/v1/admin/tenants/{id}/users/{uid}       # Update user
DELETE /api/v1/admin/tenants/{id}/users/{uid}       # Remove user

Domain Management:
GET    /api/v1/admin/tenants/{id}/domains           # List domains
POST   /api/v1/admin/tenants/{id}/domains           # Add domain
GET    /api/v1/admin/tenants/{id}/domains/{did}/dns # DNS records
POST   /api/v1/admin/tenants/{id}/domains/{did}/verify # Verify
DELETE /api/v1/admin/tenants/{id}/domains/{did}     # Remove domain

Mail Administration:
GET    /api/v1/admin/tenants/{id}/mail/mailboxes    # List mailboxes
POST   /api/v1/admin/tenants/{id}/mail/mailboxes    # Create mailbox
DELETE /api/v1/admin/tenants/{id}/mail/mailboxes/{e} # Delete mailbox
GET    /api/v1/admin/tenants/{id}/mail/stats        # Mail stats

Meet Administration:
GET    /api/v1/admin/tenants/{id}/meet/stats        # Meet stats
GET    /api/v1/admin/tenants/{id}/meet/settings     # Get settings
PATCH  /api/v1/admin/tenants/{id}/meet/settings     # Update settings

Docs Administration (TO IMPLEMENT):
GET    /api/v1/admin/tenants/{id}/docs/stats        # Docs stats
GET    /api/v1/admin/tenants/{id}/docs/quotas       # User quotas
PATCH  /api/v1/admin/tenants/{id}/docs/quotas/{uid} # Update quota
GET    /api/v1/admin/tenants/{id}/docs/shares       # List shares
DELETE /api/v1/admin/tenants/{id}/docs/shares/{sid} # Delete share

Billing (TO IMPLEMENT):
GET    /api/v1/billing/subscription                 # Get subscription
POST   /api/v1/billing/subscribe                    # Subscribe
POST   /api/v1/billing/cancel                       # Cancel
GET    /api/v1/billing/invoices                     # Invoice history
POST   /api/v1/billing/payment-method               # Update payment

Developer Management:
GET    /api/v1/admin/developers                     # List developers
POST   /api/v1/admin/developers                     # Add developer
POST   /api/v1/admin/developers/{id}/projects       # Grant access

Activity & Audit:
GET    /api/v1/admin/tenants/{id}/activity          # Activity log

Health (TO IMPLEMENT):
GET    /api/v1/health                               # Overall health
GET    /api/v1/health/services                      # Service status
GET    /api/v1/health/database                      # Database status
```

---

## 8. Database Schema

### Workspace Schema (PostgreSQL)

```sql
-- Schema
CREATE SCHEMA IF NOT EXISTS workspace;

-- Tenants
CREATE TABLE workspace.tenants (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    slug VARCHAR(100) NOT NULL UNIQUE,
    domain VARCHAR(255),
    owner_email VARCHAR(320) NOT NULL,
    plan VARCHAR(50) DEFAULT 'free',
    billing_email VARCHAR(320),
    stripe_customer_id VARCHAR(100),
    stripe_subscription_id VARCHAR(100),
    is_active BOOLEAN DEFAULT TRUE,
    is_suspended BOOLEAN DEFAULT FALSE,
    suspended_reason TEXT,
    max_users INTEGER DEFAULT 5,
    meet_quota_hours INTEGER DEFAULT 10,
    docs_quota_mb INTEGER DEFAULT 1024,
    mail_quota_mb INTEGER DEFAULT 512,
    recordings_quota_mb INTEGER DEFAULT 1024,
    meet_used_hours NUMERIC(10,2) DEFAULT 0,
    docs_used_mb NUMERIC(10,2) DEFAULT 0,
    mail_used_mb NUMERIC(10,2) DEFAULT 0,
    recordings_used_mb NUMERIC(10,2) DEFAULT 0,
    settings JSONB DEFAULT '{}',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    trial_ends_at TIMESTAMP,
    created_by UUID
);

-- Tenant Users
CREATE TABLE workspace.tenant_users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID REFERENCES workspace.tenants(id) ON DELETE CASCADE,
    user_id UUID NOT NULL,
    role VARCHAR(50) DEFAULT 'member',
    is_active BOOLEAN DEFAULT TRUE,
    invited_at TIMESTAMP,
    joined_at TIMESTAMP,
    invited_by UUID,
    permissions JSONB DEFAULT '{}',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(tenant_id, user_id)
);

-- Domains
CREATE TABLE workspace.domains (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID REFERENCES workspace.tenants(id) ON DELETE CASCADE,
    domain VARCHAR(255) NOT NULL UNIQUE,
    domain_type VARCHAR(20) DEFAULT 'email',
    mailgun_domain_id VARCHAR(100),
    cloudflare_zone_id VARCHAR(50),
    spf_verified BOOLEAN DEFAULT FALSE,
    dkim_verified BOOLEAN DEFAULT FALSE,
    mx_verified BOOLEAN DEFAULT FALSE,
    ownership_verified BOOLEAN DEFAULT FALSE,
    verification_token VARCHAR(100),
    is_primary BOOLEAN DEFAULT FALSE,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    verified_at TIMESTAMP,
    created_by UUID
);

-- DNS Records
CREATE TABLE workspace.domain_dns_records (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    domain_id UUID REFERENCES workspace.domains(id) ON DELETE CASCADE,
    record_type VARCHAR(10) NOT NULL,
    name VARCHAR(255) NOT NULL,
    value TEXT NOT NULL,
    priority INTEGER,
    ttl INTEGER DEFAULT 3600,
    is_verified BOOLEAN DEFAULT FALSE,
    last_checked_at TIMESTAMP,
    verified_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Developers
CREATE TABLE workspace.developers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,
    role VARCHAR(30) NOT NULL,
    ssh_public_key TEXT,
    github_username VARCHAR(100),
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_by UUID
);

-- Developer Projects
CREATE TABLE workspace.developer_projects (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    developer_id UUID REFERENCES workspace.developers(id) ON DELETE CASCADE,
    project_name VARCHAR(100) NOT NULL,
    access_level VARCHAR(20) NOT NULL,
    git_branch_pattern VARCHAR(100),
    can_push_to_main BOOLEAN DEFAULT FALSE,
    can_deploy_staging BOOLEAN DEFAULT FALSE,
    can_deploy_production BOOLEAN DEFAULT FALSE,
    granted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    granted_by UUID
);

-- Activity Log
CREATE TABLE workspace.activity_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID,
    user_id UUID,
    action VARCHAR(100) NOT NULL,
    entity_type VARCHAR(50),
    entity_id UUID,
    description TEXT,
    ip_address INET,
    user_agent VARCHAR(500),
    extra_data JSONB,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Indexes
CREATE INDEX idx_tenants_slug ON workspace.tenants(slug);
CREATE INDEX idx_tenants_owner ON workspace.tenants(owner_email);
CREATE INDEX idx_tenant_users_tenant ON workspace.tenant_users(tenant_id);
CREATE INDEX idx_tenant_users_user ON workspace.tenant_users(user_id);
CREATE INDEX idx_domains_tenant ON workspace.domains(tenant_id);
CREATE INDEX idx_domains_domain ON workspace.domains(domain);
CREATE INDEX idx_activity_tenant ON workspace.activity_log(tenant_id);
CREATE INDEX idx_activity_user ON workspace.activity_log(user_id);
CREATE INDEX idx_activity_created ON workspace.activity_log(created_at);
```

---

## 9. Integration Points

### External Service Configuration

```bash
# .env configuration for all integrations

# === DATABASE ===
DATABASE_URL=postgresql+asyncpg://user:pass@host:5432/bheem_workspace

# === AUTHENTICATION ===
SECRET_KEY=your-secure-secret-key
BHEEM_PASSPORT_URL=https://platform.bheem.co.uk
USE_PASSPORT_AUTH=true

# === VIDEO CONFERENCING ===
LIVEKIT_API_KEY=your-api-key
LIVEKIT_API_SECRET=your-api-secret
LIVEKIT_URL=wss://meet.bheem.cloud

# === DOCUMENT STORAGE ===
NEXTCLOUD_URL=https://docs.bheem.cloud
NEXTCLOUD_ADMIN_USER=admin
NEXTCLOUD_ADMIN_PASSWORD=secure-password

# === EMAIL SERVER ===
MAILCOW_URL=https://mail.bheem.cloud
MAILCOW_API_KEY=your-mailcow-key
MAILCOW_HOST=mail.bheem.cloud

# === TRANSACTIONAL EMAIL ===
MAILGUN_API_KEY=your-mailgun-key
MAILGUN_DOMAIN=bheem.co.uk

# === DNS MANAGEMENT ===
CLOUDFLARE_API_TOKEN=your-cf-token
CLOUDFLARE_ZONE_ID=your-zone-id

# === OBJECT STORAGE ===
S3_ENDPOINT=https://s3.bheem.cloud
S3_ACCESS_KEY=your-access-key
S3_SECRET_KEY=your-secret-key
S3_BUCKET=workspace
S3_REGION=us-east-1

# === PAYMENT PROCESSING ===
STRIPE_SECRET_KEY=sk_live_xxx
STRIPE_PUBLISHABLE_KEY=pk_live_xxx
STRIPE_WEBHOOK_SECRET=whsec_xxx

# === NOTIFICATIONS ===
BHEEM_NOTIFY_URL=https://notify.bheem.co.uk
BHEEM_NOTIFY_API_KEY=your-notify-key
```

---

## 10. Security Considerations

### Authentication & Authorization

1. **JWT Token Security**
   - Use RS256 signing (asymmetric) for production
   - Implement token refresh rotation
   - Store refresh tokens securely (HttpOnly cookies)

2. **RBAC Implementation**
   - Define clear role hierarchy
   - Implement permission checking middleware
   - Log all authorization failures

3. **API Security**
   - Implement rate limiting (e.g., 100 req/min per user)
   - Add request signing for inter-service calls
   - Use HTTPS only
   - Implement CORS properly

4. **Input Validation**
   - Validate all input with Pydantic
   - Sanitize HTML content
   - Prevent SQL injection (use parameterized queries)

5. **Secrets Management**
   - Use environment variables (not hardcoded)
   - Consider HashiCorp Vault for production
   - Rotate secrets regularly

---

## 11. Testing Strategy

### Unit Tests

```python
# tests/test_admin_api.py

import pytest
from httpx import AsyncClient
from main import app

@pytest.mark.asyncio
async def test_list_tenants():
    async with AsyncClient(app=app, base_url="http://test") as client:
        response = await client.get(
            "/api/v1/admin/tenants",
            headers={"Authorization": "Bearer test-token"}
        )
        assert response.status_code == 200
        assert "tenants" in response.json()

@pytest.mark.asyncio
async def test_create_tenant():
    async with AsyncClient(app=app, base_url="http://test") as client:
        response = await client.post(
            "/api/v1/admin/tenants",
            json={
                "name": "Test Tenant",
                "slug": "test-tenant",
                "owner_email": "test@example.com",
                "plan": "starter"
            },
            headers={"Authorization": "Bearer test-token"}
        )
        assert response.status_code == 200
        assert response.json()["name"] == "Test Tenant"
```

### Integration Tests

```python
# tests/test_integrations.py

@pytest.mark.asyncio
async def test_mailgun_domain_add():
    """Test Mailgun domain addition"""
    result = await mailgun_service.add_domain("test.example.com")
    assert "error" not in result

@pytest.mark.asyncio
async def test_mailcow_mailbox_create():
    """Test Mailcow mailbox creation"""
    result = await mailcow_service.create_mailbox(
        local_part="test",
        domain="example.com",
        password="SecurePass123!",
        name="Test User"
    )
    assert result is not None
```

---

## 12. Deployment Checklist

### Pre-Deployment

- [ ] All environment variables configured
- [ ] Database migrations run successfully
- [ ] External service credentials verified
- [ ] SSL certificates valid
- [ ] Rate limiting configured
- [ ] Logging enabled
- [ ] Error tracking (Sentry) configured

### Deployment Steps

1. **Database**
   ```bash
   # Run migrations
   python migrations/run_migrations.py
   ```

2. **Backend**
   ```bash
   # Build and deploy
   docker build -t bheem-workspace-api -f Dockerfile.backend .
   docker push registry/bheem-workspace-api:latest
   ```

3. **Frontend**
   ```bash
   # Build and deploy
   npm run build
   docker build -t bheem-workspace-frontend -f Dockerfile.frontend .
   docker push registry/bheem-workspace-frontend:latest
   ```

4. **Verify**
   ```bash
   # Health check
   curl https://workspace.bheem.cloud/api/v1/health
   ```

### Post-Deployment

- [ ] Verify all services responding
- [ ] Test login flow end-to-end
- [ ] Test admin operations
- [ ] Monitor error rates
- [ ] Check performance metrics

---

## Summary

This implementation plan provides a comprehensive roadmap to complete the Bheem Workspace Admin Module. The estimated timeline is 6 weeks for full implementation:

| Phase | Focus | Duration |
|-------|-------|----------|
| 1 | Security & Stability | Week 1 |
| 2 | Complete Frontend | Week 2 |
| 3 | Billing Integration | Week 3 |
| 4 | Docs Administration | Week 4 |
| 5 | Monitoring & Health | Week 5 |
| 6 | Advanced Features | Week 6+ |

**Key Success Metrics:**
- All admin pages functional
- Zero security vulnerabilities
- < 500ms API response times
- 99.9% uptime for admin panel
- Full audit logging enabled

---

*Document Version: 1.0*
*Last Updated: December 30, 2025*
*Author: Claude Code Assistant*
