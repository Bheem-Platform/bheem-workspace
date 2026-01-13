# Bheem Workspace - External Customer Implementation Plan

## Executive Summary

This document outlines the complete implementation plan to make Bheem Workspace production-ready for external commercial customers, comparable to Google Workspace and Zoho Workplace.

**Current State:** 55% ready
**Target State:** 95% ready
**Estimated Total Effort:** 8-10 weeks

---

## Phase 1: Critical Fixes (Must Have)
**Timeline: Week 1-2**

### 1.1 Fix Billing/Checkout Flow

**Problem:** Checkout fails with "Plan not found in catalog"

**Root Cause Analysis:**
- `external_workspace_service.py:114` calls `erp.get_plan_by_sku_code(plan_id)`
- ERP endpoint `/subscriptions/plans` doesn't have WORKSPACE-* plans
- Plans show as "fallback" in `/api/v1/billing/plans`

**Implementation Steps:**

#### Step 1.1.1: Create Subscription Plans in ERP
```sql
-- Run in ERP Database (erp_staging)
INSERT INTO sales.subscription_plans (id, sku_code, name, description, base_price, billing_cycle, features, is_active)
VALUES
  (gen_random_uuid(), 'WORKSPACE-STARTER', 'Workspace Starter', 'For small teams', 0, 'monthly',
   '{"max_users": 5, "storage_gb": 5, "meet_hours": 10}', true),
  (gen_random_uuid(), 'WORKSPACE-PROFESSIONAL', 'Workspace Professional', 'For growing teams', 2499, 'monthly',
   '{"max_users": 25, "storage_gb": 50, "meet_hours": 100}', true),
  (gen_random_uuid(), 'WORKSPACE-ENTERPRISE', 'Workspace Enterprise', 'For large organizations', 9999, 'monthly',
   '{"max_users": -1, "storage_gb": 500, "meet_hours": -1}', true);
```

#### Step 1.1.2: Update ERP Client to Handle Missing Plans Gracefully
**File:** `backend/services/erp_client.py`

```python
# Add fallback plan definitions
FALLBACK_PLANS = {
    "WORKSPACE-STARTER": {
        "plan_id": "00000000-0000-0000-0000-000000000001",
        "sku_code": "WORKSPACE-STARTER",
        "name": "Starter",
        "base_price": 0,
        "features": {"max_users": 5, "storage_gb": 5, "meet_hours": 10}
    },
    "WORKSPACE-PROFESSIONAL": {
        "plan_id": "00000000-0000-0000-0000-000000000002",
        "sku_code": "WORKSPACE-PROFESSIONAL",
        "name": "Professional",
        "base_price": 2499,
        "features": {"max_users": 25, "storage_gb": 50, "meet_hours": 100}
    },
    "WORKSPACE-ENTERPRISE": {
        "plan_id": "00000000-0000-0000-0000-000000000003",
        "sku_code": "WORKSPACE-ENTERPRISE",
        "name": "Enterprise",
        "base_price": 9999,
        "features": {"max_users": -1, "storage_gb": 500, "meet_hours": -1}
    }
}

async def get_plan_by_sku_code(self, sku_code: str) -> Optional[dict]:
    """Look up plan by SKU code with fallback."""
    try:
        result = await self._request("GET", "/subscriptions/plans")
        plans = result.get("plans", [])
        for plan in plans:
            if plan.get("sku_code") == sku_code:
                return plan
    except Exception:
        pass

    # Return fallback plan if ERP unavailable
    return FALLBACK_PLANS.get(sku_code)
```

#### Step 1.1.3: Test Checkout Flow
```bash
# Test plan lookup
curl -X POST /api/v1/billing/checkout \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"plan_id":"WORKSPACE-PROFESSIONAL","billing_cycle":"monthly"}'

# Expected: Returns Razorpay order details
```

---

### 1.2 Fix Admin Permissions for Workspace Owners

**Problem:** Workspace owners (role: Customer) cannot add team members

**Root Cause Analysis:**
- JWT token has `role: "Customer"` from Bheem Passport
- `require_admin()` checks for `role in ["Admin", "SuperAdmin"]`
- TenantUser has `role: "admin"` but JWT role is different

**Implementation Steps:**

#### Step 1.2.1: Create Tenant-Aware Admin Check
**File:** `backend/core/security.py`

```python
def require_tenant_admin(tenant_id_param: str = "tenant_id"):
    """
    Dependency to require tenant admin access.
    Checks both:
    1. SuperAdmin role in JWT (can access all tenants)
    2. Admin role in tenant_users table for the specific tenant
    """
    async def admin_checker(
        request: Request,
        credentials: HTTPAuthorizationCredentials = Depends(security),
        db: AsyncSession = Depends(get_db)
    ) -> Dict[str, Any]:
        # Decode token
        token = credentials.credentials
        payload = decode_token(token)

        if not payload:
            raise HTTPException(status_code=401, detail="Invalid token")

        user_id = payload.get("user_id") or payload.get("sub")
        jwt_role = payload.get("role", "")

        # SuperAdmin can access everything
        if jwt_role == "SuperAdmin":
            return payload

        # Get tenant_id from path
        tenant_id = request.path_params.get(tenant_id_param)
        if not tenant_id:
            raise HTTPException(status_code=400, detail="Tenant ID required")

        # Resolve tenant_id (could be slug or UUID)
        resolved_tenant_id = await resolve_tenant_id(tenant_id, db)

        # Check if user is admin of this tenant
        query = text("""
            SELECT role FROM workspace.tenant_users
            WHERE tenant_id = CAST(:tenant_id AS uuid)
              AND user_id = CAST(:user_id AS uuid)
              AND role IN ('admin', 'owner')
        """)
        result = await db.execute(query, {
            "tenant_id": str(resolved_tenant_id),
            "user_id": str(user_id)
        })
        row = result.fetchone()

        if not row:
            raise HTTPException(
                status_code=403,
                detail="You must be an admin of this workspace"
            )

        # Add tenant context to payload
        payload["tenant_id"] = str(resolved_tenant_id)
        payload["tenant_role"] = row.role

        return payload

    return admin_checker


async def resolve_tenant_id(tenant_id: str, db: AsyncSession) -> str:
    """Resolve tenant slug to UUID if needed."""
    # Try as UUID first
    try:
        uuid.UUID(tenant_id)
        return tenant_id
    except ValueError:
        pass

    # Look up by slug
    query = text("SELECT id FROM workspace.tenants WHERE slug = :slug")
    result = await db.execute(query, {"slug": tenant_id})
    row = result.fetchone()

    if not row:
        raise HTTPException(status_code=404, detail="Tenant not found")

    return str(row.id)
```

#### Step 1.2.2: Update Admin Endpoints to Use New Check
**File:** `backend/api/admin.py`

```python
# Replace:
current_user: dict = Depends(require_admin())

# With:
current_user: dict = Depends(require_tenant_admin("tenant_id"))
```

#### Step 1.2.3: Add Owner Role on Workspace Creation
**File:** `backend/api/tenants.py`

```python
# In create_workspace function, ensure owner gets admin role
tenant_user = TenantUser(
    tenant_id=new_tenant.id,
    user_id=user_id,
    email=request.owner_email,
    name=request.owner_name,
    role="admin",  # Owner is always admin
    provisioned_by="self",
    joined_at=datetime.utcnow()
)
```

---

### 1.3 Implement Mail SSO (Auto Session)

**Problem:** Users must login separately to mail

**Root Cause Analysis:**
- Mail uses session-based auth with encrypted credentials in Redis
- No way to auto-create session from JWT login
- Password not available after JWT login

**Implementation Steps:**

#### Step 1.3.1: Store Encrypted Password Reference on Login
**File:** `backend/api/auth.py`

```python
@router.post("/login", response_model=LoginResponse)
async def login(
    request: LoginRequest,
    db: AsyncSession = Depends(get_db)
):
    # ... existing login logic ...

    # After successful login, create mail session automatically
    # Store password hash that can be used for mail
    if result.get("access_token"):
        user_id = result["user"].get("id")
        email = result["user"].get("email") or request.username

        if "@" in email:
            try:
                # Create mail session with credentials
                from services.mail_session_service import mail_session_service
                mail_session_service.create_session(
                    user_id=user_id,
                    email=email,
                    password=request.password  # Password is available here
                )
            except Exception as e:
                logger.warning(f"Auto mail session failed: {e}")

    return LoginResponse(...)
```

#### Step 1.3.2: Add Auto-Session Flag to Login Response
**File:** `backend/api/auth.py`

```python
class LoginResponse(BaseModel):
    access_token: str
    refresh_token: Optional[str] = None
    token_type: str = "bearer"
    expires_in: int
    user: dict
    mail_session_active: bool = False  # New field
```

#### Step 1.3.3: Update Frontend to Not Require Separate Mail Login
- Remove mail login modal when `mail_session_active: true`
- Show mail directly after workspace login

---

### 1.4 Fix Calendar to Work Without Mail Session

**Problem:** Calendar requires mail session for CalDAV

**Root Cause Analysis:**
- Calendar uses Nextcloud CalDAV which requires authentication
- Currently shares credentials with mail session
- Should use stored workspace credentials

**Implementation Steps:**

#### Step 1.4.1: Create Separate Credential Storage for Workspace Services
**File:** `backend/services/workspace_credentials_service.py` (NEW)

```python
"""
Workspace Credentials Service
Stores encrypted credentials for Nextcloud (Docs/Calendar) independently from mail.
"""
from cryptography.fernet import Fernet
from core.config import settings
import redis
import json

class WorkspaceCredentialsService:
    """Manages workspace service credentials (Nextcloud)."""

    def __init__(self):
        self._cipher = Fernet(settings.MAIL_ENCRYPTION_KEY.encode())
        self._redis = redis.from_url(settings.REDIS_URL)

    def store_credentials(self, user_id: str, username: str, password: str):
        """Store encrypted Nextcloud credentials."""
        data = json.dumps({"username": username, "password": password})
        encrypted = self._cipher.encrypt(data.encode())
        key = f"workspace:creds:{user_id}"
        self._redis.setex(key, 86400 * 7, encrypted)  # 7 days

    def get_credentials(self, user_id: str) -> Optional[dict]:
        """Get decrypted Nextcloud credentials."""
        key = f"workspace:creds:{user_id}"
        encrypted = self._redis.get(key)
        if not encrypted:
            return None

        decrypted = self._cipher.decrypt(encrypted)
        return json.loads(decrypted.decode())

workspace_credentials = WorkspaceCredentialsService()
```

#### Step 1.4.2: Update Calendar to Use Workspace Credentials
**File:** `backend/api/calendar.py`

```python
async def _get_nextcloud_credentials(current_user: dict) -> tuple:
    """Get Nextcloud credentials from workspace storage."""
    from services.workspace_credentials_service import workspace_credentials

    creds = workspace_credentials.get_credentials(current_user["id"])
    if creds:
        return creds["username"], creds["password"]

    # Fallback to mail session for backwards compatibility
    from services.mail_session_service import mail_session_service
    mail_creds = mail_session_service.get_credentials(current_user["id"])
    if mail_creds:
        return mail_creds["email"], mail_creds["password"]

    raise HTTPException(
        status_code=401,
        detail="Please login to your workspace to access calendar"
    )
```

#### Step 1.4.3: Store Credentials on Login
**File:** `backend/api/auth.py`

```python
# After successful login
from services.workspace_credentials_service import workspace_credentials

workspace_credentials.store_credentials(
    user_id=user_id,
    username=email,
    password=request.password
)
```

---

### 1.5 Fix Custom Domain Setup for External Customers

**Problem:** No self-service domain setup

**Current State:**
- Domain model exists in `models/admin_models.py`
- Cloudflare and Mailgun services exist
- No self-service endpoint for customers

**Implementation Steps:**

#### Step 1.5.1: Create Domain Setup API
**File:** `backend/api/domains.py` (NEW)

```python
"""
Bheem Workspace - Domain Management API
Self-service domain setup for external customers.
"""
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from core.database import get_db
from core.security import require_tenant_admin
from services.cloudflare_service import cloudflare_service
from services.mailgun_service import mailgun_service
from models.admin_models import Domain, DomainDNSRecord

router = APIRouter(prefix="/domains", tags=["Domain Management"])


class AddDomainRequest(BaseModel):
    domain: str
    domain_type: str = "email"  # email, workspace, custom


class DomainVerificationResponse(BaseModel):
    domain: str
    status: str
    dns_records: list  # Records user needs to add
    verified: bool


@router.post("", response_model=DomainVerificationResponse)
async def add_domain(
    request: AddDomainRequest,
    tenant_id: str,
    current_user: dict = Depends(require_tenant_admin("tenant_id")),
    db: AsyncSession = Depends(get_db)
):
    """
    Add a custom domain to the workspace.
    Returns DNS records that need to be configured.
    """
    # Validate domain format
    if not _is_valid_domain(request.domain):
        raise HTTPException(status_code=400, detail="Invalid domain format")

    # Check domain not already in use
    existing = await db.execute(
        select(Domain).where(Domain.domain == request.domain)
    )
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="Domain already registered")

    # Generate verification TXT record
    verification_code = f"bheem-verify={uuid.uuid4().hex[:16]}"

    # Create domain record
    domain = Domain(
        tenant_id=tenant_id,
        domain=request.domain,
        domain_type=request.domain_type,
        verification_status="pending",
        verification_code=verification_code
    )
    db.add(domain)

    # Generate required DNS records
    dns_records = [
        {
            "type": "TXT",
            "name": "@",
            "value": verification_code,
            "purpose": "Domain ownership verification"
        }
    ]

    if request.domain_type == "email":
        dns_records.extend([
            {
                "type": "MX",
                "name": "@",
                "value": "mail.bheem.cloud",
                "priority": 10,
                "purpose": "Email routing"
            },
            {
                "type": "TXT",
                "name": "@",
                "value": "v=spf1 include:bheem.cloud ~all",
                "purpose": "SPF (Email authentication)"
            }
        ])

    # Store DNS records
    for record in dns_records:
        dns_record = DomainDNSRecord(
            domain_id=domain.id,
            record_type=record["type"],
            name=record["name"],
            value=record["value"],
            priority=record.get("priority")
        )
        db.add(dns_record)

    await db.commit()

    return DomainVerificationResponse(
        domain=request.domain,
        status="pending",
        dns_records=dns_records,
        verified=False
    )


@router.post("/{domain_id}/verify")
async def verify_domain(
    domain_id: str,
    current_user: dict = Depends(require_tenant_admin("tenant_id")),
    db: AsyncSession = Depends(get_db)
):
    """
    Verify domain DNS configuration.
    Checks TXT, MX, and SPF records.
    """
    domain = await db.get(Domain, domain_id)
    if not domain:
        raise HTTPException(status_code=404, detail="Domain not found")

    # Check DNS records
    import dns.resolver

    verification_results = {
        "ownership": False,
        "mx": False,
        "spf": False
    }

    try:
        # Check TXT record for ownership
        txt_records = dns.resolver.resolve(domain.domain, 'TXT')
        for record in txt_records:
            if domain.verification_code in str(record):
                verification_results["ownership"] = True
                break

        # Check MX record
        mx_records = dns.resolver.resolve(domain.domain, 'MX')
        for record in mx_records:
            if "bheem.cloud" in str(record.exchange):
                verification_results["mx"] = True
                break

        # Check SPF
        for record in txt_records:
            if "v=spf1" in str(record) and "bheem.cloud" in str(record):
                verification_results["spf"] = True
                break

    except Exception as e:
        pass

    # Update domain status
    all_verified = all(verification_results.values())
    domain.ownership_verified = verification_results["ownership"]
    domain.mx_verified = verification_results["mx"]
    domain.spf_verified = verification_results["spf"]
    domain.verification_status = "verified" if all_verified else "partial"

    if all_verified:
        # Setup domain in Mailcow
        await _setup_mailcow_domain(domain.domain)
        domain.mail_enabled = True

    await db.commit()

    return {
        "domain": domain.domain,
        "status": domain.verification_status,
        "results": verification_results,
        "mail_enabled": domain.mail_enabled
    }
```

#### Step 1.5.2: Register Domain Router
**File:** `backend/main.py`

```python
try:
    from api.domains import router as domains_router
    app.include_router(domains_router, prefix="/api/v1", tags=["Domains"])
except Exception as e:
    print(f"Could not load domains router: {e}")
```

---

## Phase 2: Important Features (Should Have)
**Timeline: Week 3-5**

### 2.1 Add Team Chat Integration

**Recommendation:** Integrate Mattermost (open source, self-hosted)

**Implementation Steps:**

#### Step 2.1.1: Deploy Mattermost
```yaml
# docker-compose.chat.yml
services:
  mattermost:
    image: mattermost/mattermost-team-edition:latest
    environment:
      MM_SQLSETTINGS_DRIVERNAME: postgres
      MM_SQLSETTINGS_DATASOURCE: postgres://user:pass@db:5432/mattermost
    ports:
      - "8065:8065"
```

#### Step 2.1.2: Create Chat Integration Service
**File:** `backend/services/mattermost_service.py` (NEW)

```python
"""
Mattermost Integration Service
Auto-provisions users and teams from workspace.
"""
import httpx
from core.config import settings

class MattermostService:
    def __init__(self):
        self.base_url = settings.MATTERMOST_URL
        self.admin_token = settings.MATTERMOST_ADMIN_TOKEN

    async def create_team(self, tenant_slug: str, tenant_name: str) -> dict:
        """Create Mattermost team for tenant."""
        async with httpx.AsyncClient() as client:
            response = await client.post(
                f"{self.base_url}/api/v4/teams",
                headers={"Authorization": f"Bearer {self.admin_token}"},
                json={
                    "name": tenant_slug,
                    "display_name": tenant_name,
                    "type": "I"  # Invite-only
                }
            )
            return response.json()

    async def create_user(self, email: str, username: str, password: str) -> dict:
        """Create Mattermost user."""
        async with httpx.AsyncClient() as client:
            response = await client.post(
                f"{self.base_url}/api/v4/users",
                headers={"Authorization": f"Bearer {self.admin_token}"},
                json={
                    "email": email,
                    "username": username.replace("@", "_"),
                    "password": password
                }
            )
            return response.json()

    async def add_user_to_team(self, user_id: str, team_id: str):
        """Add user to team."""
        async with httpx.AsyncClient() as client:
            await client.post(
                f"{self.base_url}/api/v4/teams/{team_id}/members",
                headers={"Authorization": f"Bearer {self.admin_token}"},
                json={"user_id": user_id, "team_id": team_id}
            )

mattermost_service = MattermostService()
```

#### Step 2.1.3: Auto-Provision on User Creation
**File:** `backend/services/user_provisioning.py`

```python
# Add to provision_user method
if settings.MATTERMOST_ENABLED:
    try:
        mm_user = await mattermost_service.create_user(
            email=workspace_email,
            username=username,
            password=temp_password
        )
        await mattermost_service.add_user_to_team(
            mm_user["id"],
            tenant.mattermost_team_id
        )
        result.services["chat"] = {"status": "success", "user_id": mm_user["id"]}
    except Exception as e:
        result.errors.append(f"Chat provisioning failed: {e}")
```

#### Step 2.1.4: Create Chat API Endpoints
**File:** `backend/api/chat.py` (NEW)

```python
router = APIRouter(prefix="/chat", tags=["Team Chat"])

@router.get("/config")
async def get_chat_config(current_user: dict = Depends(get_current_user)):
    """Get Mattermost configuration for frontend."""
    return {
        "enabled": settings.MATTERMOST_ENABLED,
        "url": settings.MATTERMOST_URL,
        "websocket_url": settings.MATTERMOST_WS_URL
    }

@router.post("/login-token")
async def get_chat_token(current_user: dict = Depends(get_current_user)):
    """Get Mattermost login token for SSO."""
    token = await mattermost_service.create_user_token(
        current_user["email"]
    )
    return {"token": token}
```

---

### 2.2 Build Onboarding Wizard

**Implementation Steps:**

#### Step 2.2.1: Create Onboarding State Tracking
**File:** `backend/models/admin_models.py`

```python
class OnboardingProgress(Base):
    __tablename__ = "onboarding_progress"
    __table_args__ = {"schema": "workspace"}

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    tenant_id = Column(UUID(as_uuid=True), ForeignKey("workspace.tenants.id"))

    # Steps
    profile_completed = Column(Boolean, default=False)
    domain_setup_completed = Column(Boolean, default=False)
    team_invited = Column(Boolean, default=False)
    first_meeting_created = Column(Boolean, default=False)
    first_document_uploaded = Column(Boolean, default=False)

    # Metadata
    current_step = Column(String, default="welcome")
    completed_at = Column(DateTime, nullable=True)
    skipped_steps = Column(ARRAY(String), default=[])
```

#### Step 2.2.2: Create Onboarding API
**File:** `backend/api/onboarding.py` (NEW)

```python
router = APIRouter(prefix="/onboarding", tags=["Onboarding"])

ONBOARDING_STEPS = [
    {"id": "welcome", "title": "Welcome", "required": True},
    {"id": "profile", "title": "Complete Your Profile", "required": True},
    {"id": "domain", "title": "Add Custom Domain", "required": False},
    {"id": "invite", "title": "Invite Team Members", "required": False},
    {"id": "tour", "title": "Quick Tour", "required": False}
]

@router.get("/progress")
async def get_onboarding_progress(
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Get onboarding progress for current tenant."""
    tenant_id = current_user.get("tenant_id")

    progress = await db.execute(
        select(OnboardingProgress).where(
            OnboardingProgress.tenant_id == tenant_id
        )
    )
    progress = progress.scalar_one_or_none()

    if not progress:
        progress = OnboardingProgress(tenant_id=tenant_id)
        db.add(progress)
        await db.commit()

    return {
        "current_step": progress.current_step,
        "steps": ONBOARDING_STEPS,
        "completed": {
            "profile": progress.profile_completed,
            "domain": progress.domain_setup_completed,
            "invite": progress.team_invited,
            "meeting": progress.first_meeting_created,
            "document": progress.first_document_uploaded
        },
        "is_complete": progress.completed_at is not None
    }

@router.post("/complete-step/{step_id}")
async def complete_step(
    step_id: str,
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Mark onboarding step as complete."""
    # Update progress based on step_id
    ...

@router.post("/skip")
async def skip_onboarding(
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Skip remaining onboarding steps."""
    ...
```

---

### 2.3 Add Resource Booking (Meeting Rooms)

**Implementation Steps:**

#### Step 2.3.1: Create Resource Model
**File:** `backend/models/admin_models.py`

```python
class Resource(Base):
    __tablename__ = "resources"
    __table_args__ = {"schema": "workspace"}

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    tenant_id = Column(UUID(as_uuid=True), ForeignKey("workspace.tenants.id"))

    name = Column(String, nullable=False)  # "Conference Room A"
    resource_type = Column(String, nullable=False)  # "room", "equipment"
    capacity = Column(Integer)  # For rooms
    location = Column(String)
    description = Column(Text)

    # Availability
    available_from = Column(Time)  # 09:00
    available_until = Column(Time)  # 18:00
    available_days = Column(ARRAY(Integer))  # [1,2,3,4,5] = Mon-Fri

    # Settings
    requires_approval = Column(Boolean, default=False)
    auto_release_minutes = Column(Integer, default=15)

    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)


class ResourceBooking(Base):
    __tablename__ = "resource_bookings"
    __table_args__ = {"schema": "workspace"}

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    resource_id = Column(UUID(as_uuid=True), ForeignKey("workspace.resources.id"))

    booked_by = Column(UUID(as_uuid=True))
    title = Column(String)
    start_time = Column(DateTime, nullable=False)
    end_time = Column(DateTime, nullable=False)

    # Link to calendar event
    calendar_event_id = Column(String)

    # Status
    status = Column(String, default="confirmed")  # confirmed, pending, cancelled

    created_at = Column(DateTime, default=datetime.utcnow)
```

#### Step 2.3.2: Create Resource API
**File:** `backend/api/resources.py` (NEW)

```python
router = APIRouter(prefix="/resources", tags=["Resource Booking"])

@router.get("")
async def list_resources(
    resource_type: Optional[str] = None,
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """List available resources for the tenant."""
    ...

@router.post("/{resource_id}/book")
async def book_resource(
    resource_id: str,
    booking: BookingRequest,
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Book a resource for a time slot."""
    # Check availability
    # Create booking
    # Optionally create calendar event
    ...

@router.get("/{resource_id}/availability")
async def get_availability(
    resource_id: str,
    date: str,
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Get available time slots for a resource."""
    ...
```

---

### 2.4 Enhanced Meeting Features

**Implementation Steps:**

#### Step 2.4.1: Add Breakout Rooms Support
**File:** `backend/services/livekit_service.py`

```python
async def create_breakout_room(
    self,
    parent_room: str,
    breakout_name: str,
    participants: List[str]
) -> dict:
    """Create a breakout room from main meeting."""
    breakout_code = f"{parent_room}-br-{uuid.uuid4().hex[:4]}"

    # Create the room
    room = await self.room_service.create_room(
        CreateRoomRequest(name=breakout_code)
    )

    # Generate tokens for participants
    tokens = []
    for participant in participants:
        token = self.create_token(
            room_name=breakout_code,
            participant_identity=participant,
            participant_name=participant
        )
        tokens.append({"participant": participant, "token": token})

    return {
        "room_code": breakout_code,
        "parent_room": parent_room,
        "tokens": tokens
    }

async def close_breakout_rooms(self, parent_room: str):
    """Close all breakout rooms and return participants to main room."""
    # List rooms with parent prefix
    # Delete breakout rooms
    # Notify participants to return
    ...
```

#### Step 2.4.2: Add API Endpoints for Breakout Rooms
**File:** `backend/api/meet.py`

```python
@router.post("/rooms/{room_code}/breakout")
async def create_breakout_rooms(
    room_code: str,
    request: BreakoutRequest,
    current_user: dict = Depends(get_current_user)
):
    """Create breakout rooms from main meeting."""
    breakouts = []
    for group in request.groups:
        breakout = await livekit_service.create_breakout_room(
            parent_room=room_code,
            breakout_name=group.name,
            participants=group.participants
        )
        breakouts.append(breakout)

    return {"breakout_rooms": breakouts}

@router.post("/rooms/{room_code}/breakout/close")
async def close_breakout_rooms(
    room_code: str,
    current_user: dict = Depends(get_current_user)
):
    """Close all breakout rooms."""
    await livekit_service.close_breakout_rooms(room_code)
    return {"status": "closed"}
```

---

## Phase 3: Nice to Have Features
**Timeline: Week 6-8**

### 3.1 Mobile App Strategy

**Option A: Progressive Web App (Recommended)**
- Convert frontend to PWA
- Add service workers for offline
- Push notifications via Web Push

**Option B: Use Nextcloud Apps**
- Nextcloud iOS/Android for Docs
- SOGo clients for Mail
- Custom Meet app using LiveKit SDK

**Implementation for PWA:**

#### Step 3.1.1: Add PWA Manifest
**File:** `frontend/public/manifest.json`

```json
{
  "name": "Bheem Workspace",
  "short_name": "Bheem",
  "description": "Unified Collaboration Platform",
  "start_url": "/",
  "display": "standalone",
  "background_color": "#ffffff",
  "theme_color": "#2563eb",
  "icons": [
    {"src": "/icons/icon-192.png", "sizes": "192x192", "type": "image/png"},
    {"src": "/icons/icon-512.png", "sizes": "512x512", "type": "image/png"}
  ]
}
```

#### Step 3.1.2: Add Service Worker
**File:** `frontend/public/sw.js`

```javascript
const CACHE_NAME = 'bheem-workspace-v1';

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll([
        '/',
        '/dashboard',
        '/mail',
        '/docs',
        '/meet'
      ]);
    })
  );
});

self.addEventListener('fetch', (event) => {
  event.respondWith(
    caches.match(event.request).then((response) => {
      return response || fetch(event.request);
    })
  );
});
```

---

### 3.2 Advanced Security Features

#### Step 3.2.1: Add Security Dashboard
**File:** `backend/api/security.py` (NEW)

```python
router = APIRouter(prefix="/security", tags=["Security"])

@router.get("/dashboard")
async def get_security_dashboard(
    current_user: dict = Depends(require_tenant_admin("tenant_id")),
    db: AsyncSession = Depends(get_db)
):
    """Get security overview for tenant."""
    return {
        "users_with_2fa": await _count_users_with_2fa(db, tenant_id),
        "recent_logins": await _get_recent_logins(db, tenant_id),
        "suspicious_activity": await _get_suspicious_activity(db, tenant_id),
        "password_health": await _check_password_health(db, tenant_id)
    }

@router.get("/audit-log")
async def get_audit_log(
    limit: int = 100,
    action_type: Optional[str] = None,
    current_user: dict = Depends(require_tenant_admin("tenant_id")),
    db: AsyncSession = Depends(get_db)
):
    """Get audit log for tenant."""
    ...
```

#### Step 3.2.2: Add Login Alerts
**File:** `backend/services/security_alerts_service.py` (NEW)

```python
class SecurityAlertsService:
    """Monitors and alerts on suspicious activity."""

    async def check_login(self, user_id: str, ip: str, user_agent: str):
        """Check login for suspicious patterns."""
        # New device detection
        # Unusual location
        # Multiple failed attempts
        ...

    async def send_login_alert(self, user_email: str, details: dict):
        """Send email alert for new login."""
        await notify_client.send_email(
            to=user_email,
            template="security_alert",
            data={
                "event": "New Login",
                "ip": details["ip"],
                "location": details["location"],
                "device": details["device"],
                "time": details["time"]
            }
        )
```

---

### 3.3 Data Migration Tools

#### Step 3.3.1: Create Migration API
**File:** `backend/api/migration.py` (NEW)

```python
router = APIRouter(prefix="/migration", tags=["Data Migration"])

@router.post("/import/google")
async def import_from_google(
    file: UploadFile,
    data_type: str,  # "email", "calendar", "contacts", "drive"
    current_user: dict = Depends(require_tenant_admin("tenant_id"))
):
    """Import data from Google Takeout export."""
    ...

@router.post("/import/outlook")
async def import_from_outlook(
    file: UploadFile,
    data_type: str,
    current_user: dict = Depends(require_tenant_admin("tenant_id"))
):
    """Import data from Outlook/Microsoft 365 export."""
    ...

@router.get("/status/{job_id}")
async def get_migration_status(
    job_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Get migration job status."""
    ...
```

---

## Implementation Checklist

### Week 1-2: Critical Fixes
- [ ] Add subscription plans to ERP database
- [ ] Update ERP client with fallback plans
- [ ] Create `require_tenant_admin` security function
- [ ] Update admin endpoints to use tenant-aware auth
- [ ] Implement auto mail session on login
- [ ] Create workspace credentials service
- [ ] Update calendar to use workspace credentials
- [ ] Test complete checkout flow
- [ ] Test team member addition

### Week 3-4: Important Features
- [ ] Create domain management API
- [ ] Add DNS verification logic
- [ ] Integrate Mailcow domain setup
- [ ] Deploy Mattermost
- [ ] Create chat integration service
- [ ] Add chat auto-provisioning
- [ ] Create onboarding progress model
- [ ] Build onboarding API endpoints

### Week 5-6: Enhanced Features
- [ ] Create resource booking models
- [ ] Build resource API
- [ ] Add breakout room support
- [ ] Implement meeting attendance tracking
- [ ] Add virtual background support (if LiveKit supports)

### Week 7-8: Polish
- [ ] Convert to PWA
- [ ] Add security dashboard
- [ ] Implement login alerts
- [ ] Create data migration tools
- [ ] Documentation and testing

---

## Database Migrations Required

```sql
-- Migration 001: Add onboarding progress
CREATE TABLE workspace.onboarding_progress (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID REFERENCES workspace.tenants(id),
    profile_completed BOOLEAN DEFAULT FALSE,
    domain_setup_completed BOOLEAN DEFAULT FALSE,
    team_invited BOOLEAN DEFAULT FALSE,
    first_meeting_created BOOLEAN DEFAULT FALSE,
    first_document_uploaded BOOLEAN DEFAULT FALSE,
    current_step VARCHAR(50) DEFAULT 'welcome',
    completed_at TIMESTAMP,
    skipped_steps VARCHAR[] DEFAULT '{}',
    created_at TIMESTAMP DEFAULT NOW()
);

-- Migration 002: Add resources
CREATE TABLE workspace.resources (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID REFERENCES workspace.tenants(id),
    name VARCHAR(255) NOT NULL,
    resource_type VARCHAR(50) NOT NULL,
    capacity INTEGER,
    location VARCHAR(255),
    description TEXT,
    available_from TIME,
    available_until TIME,
    available_days INTEGER[],
    requires_approval BOOLEAN DEFAULT FALSE,
    auto_release_minutes INTEGER DEFAULT 15,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE workspace.resource_bookings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    resource_id UUID REFERENCES workspace.resources(id),
    booked_by UUID,
    title VARCHAR(255),
    start_time TIMESTAMP NOT NULL,
    end_time TIMESTAMP NOT NULL,
    calendar_event_id VARCHAR(255),
    status VARCHAR(50) DEFAULT 'confirmed',
    created_at TIMESTAMP DEFAULT NOW()
);

-- Migration 003: Add Mattermost integration
ALTER TABLE workspace.tenants ADD COLUMN mattermost_team_id VARCHAR(255);
ALTER TABLE workspace.tenant_users ADD COLUMN mattermost_user_id VARCHAR(255);
```

---

## Configuration Changes Required

```env
# Add to .env

# Mattermost (Team Chat)
MATTERMOST_ENABLED=true
MATTERMOST_URL=https://chat.bheem.cloud
MATTERMOST_WS_URL=wss://chat.bheem.cloud
MATTERMOST_ADMIN_TOKEN=your-admin-token

# PWA
PWA_ENABLED=true
VAPID_PUBLIC_KEY=your-vapid-public-key
VAPID_PRIVATE_KEY=your-vapid-private-key
```

---

## Success Metrics

After implementation, these tests should pass:

```bash
# 1. Complete signup flow
curl -X POST /api/v1/auth/register -d '{"username":"test@company.com"...}'
curl -X POST /api/v1/auth/login -d '{"username":"test@company.com"...}'
curl -X POST /api/v1/tenants -d '{"name":"My Company"...}'  # ✅

# 2. Upgrade to paid plan
curl -X POST /api/v1/billing/checkout -d '{"plan_id":"WORKSPACE-PROFESSIONAL"}'  # ✅

# 3. Add team member (as tenant admin)
curl -X POST /api/v1/admin/tenants/my-company/users -d '{"username":"john"...}'  # ✅

# 4. Access mail without separate login
curl /api/v1/mail/inbox  # ✅ (works with auto-session)

# 5. Access calendar
curl /api/v1/calendar/events  # ✅ (works without mail session)

# 6. Add custom domain
curl -X POST /api/v1/domains -d '{"domain":"mycompany.com"}'  # ✅
```

---

## Conclusion

This implementation plan addresses all critical gaps identified in the comparison with Google Workspace and Zoho Workplace. Following this plan will bring Bheem Workspace to production-ready state for external commercial customers.

**Priority Order:**
1. Fix billing (customers can't pay = no revenue)
2. Fix admin permissions (customers can't add team = unusable)
3. Fix mail SSO (poor UX = customer churn)
4. Add domain setup (enterprise requirement)
5. Add team chat (competitive feature)
