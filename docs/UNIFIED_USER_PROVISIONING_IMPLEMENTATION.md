# Bheem Workspace - Unified User Provisioning Implementation Plan

## Overview

This document outlines the step-by-step implementation plan to transform Bheem Workspace from a fragmented system (separate user, mailbox, and service creation) to a unified workspace system following industry best practices (Google Workspace, Microsoft 365 pattern).

**Goal**: ONE action to create user = ALL services provisioned automatically

---

## Current State vs Target State

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           CURRENT STATE (FRAGMENTED)                         │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│   Admin creates user ───► Workspace DB only                                 │
│   Admin creates mailbox ───► Mailcow only                                   │
│   No welcome email sent                                                      │
│   No automatic service provisioning                                          │
│   Manual setup required for each service                                     │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘

                                    ▼

┌─────────────────────────────────────────────────────────────────────────────┐
│                           TARGET STATE (UNIFIED)                             │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│   Admin creates user ───► ONE ACTION triggers:                              │
│                           ├── Bheem Passport (SSO identity)                 │
│                           ├── Workspace DB (tenant user)                    │
│                           ├── Mailcow (email mailbox)                       │
│                           ├── Nextcloud (docs access)                       │
│                           └── Bheem Notify (welcome email)                  │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Implementation Phases

| Phase | Description | Priority | Dependencies |
|-------|-------------|----------|--------------|
| **Phase 1** | Bheem Notify Integration | HIGH | None |
| **Phase 2** | User Provisioning Service | HIGH | Phase 1 |
| **Phase 3** | Passport User Sync | MEDIUM | Phase 2 |
| **Phase 4** | Nextcloud Integration | MEDIUM | Phase 2 |
| **Phase 5** | User Deprovisioning | LOW | Phase 2, 3, 4 |
| **Phase 6** | Frontend Updates | LOW | All Phases |

---

## Phase 1: Bheem Notify Integration

### 1.1 Overview

Integrate Bheem Notify service (Port 8005) for all workspace notifications following the bheem-core pattern.

### 1.2 Files to Create

```
/backend/
├── integrations/
│   └── notify/
│       ├── __init__.py
│       └── notify_client.py      # Main NotifyClient class
└── templates/
    └── emails/                    # Email template definitions
        ├── workspace_welcome.json
        ├── workspace_invite.json
        └── password_reset.json
```

### 1.3 Environment Variables

Add to `/backend/.env`:

```bash
# Bheem Notify Configuration
NOTIFY_SERVICE_URL=http://bheem-notify:8005
NOTIFY_API_KEY=your-notify-api-key
NOTIFY_TIMEOUT=30.0
NOTIFY_SENDER_EMAIL=noreply@bheem.cloud
NOTIFY_SENDER_NAME=Bheem Workspace
```

### 1.4 NotifyClient Implementation

**File**: `/backend/integrations/notify/notify_client.py`

```python
"""
Bheem Notify Client for Workspace
==================================
Aligned with bheem-core implementation pattern.
Reference: /bheem-core/apps/backend/app/integrations/notify/notify_client.py
"""

import os
import httpx
import logging
from typing import Dict, Any, List, Optional

logger = logging.getLogger(__name__)


class NotifyClient:
    """Client for Bheem Notify Service (Port 8005)"""

    def __init__(self):
        self.notify_url = os.getenv("NOTIFY_SERVICE_URL", "http://bheem-notify:8005")
        self.api_key = os.getenv("NOTIFY_API_KEY", "")
        self.timeout = float(os.getenv("NOTIFY_TIMEOUT", "30.0"))
        self.sender_email = os.getenv("NOTIFY_SENDER_EMAIL", "noreply@bheem.cloud")
        self.sender_name = os.getenv("NOTIFY_SENDER_NAME", "Bheem Workspace")

    def _headers(self) -> Dict[str, str]:
        """Get request headers with X-API-Key authentication"""
        headers = {"Content-Type": "application/json"}
        if self.api_key:
            headers["X-API-Key"] = self.api_key
        return headers

    # ═══════════════════════════════════════════════════════════════
    # EMAIL METHODS
    # ═══════════════════════════════════════════════════════════════

    async def send_email(
        self,
        to: str,
        subject: str,
        html_body: str,
        text_body: Optional[str] = None,
        cc: Optional[List[str]] = None,
        bcc: Optional[List[str]] = None
    ) -> Dict[str, Any]:
        """Send a direct email"""
        async with httpx.AsyncClient(timeout=self.timeout) as client:
            response = await client.post(
                f"{self.notify_url}/api/v1/email/send",
                json={
                    "to": to,
                    "subject": subject,
                    "html_body": html_body,
                    "text_body": text_body,
                    "cc": cc,
                    "bcc": bcc,
                    "from_email": self.sender_email,
                    "from_name": self.sender_name
                },
                headers=self._headers()
            )
            return response.json()

    async def send_template_email(
        self,
        to: str,
        template_name: str,
        template_vars: Dict[str, Any],
        subject: Optional[str] = None,
        cc: Optional[List[str]] = None,
        bcc: Optional[List[str]] = None
    ) -> Dict[str, Any]:
        """Send email using a predefined template"""
        async with httpx.AsyncClient(timeout=self.timeout) as client:
            response = await client.post(
                f"{self.notify_url}/api/v1/email/send/template",
                json={
                    "to": to,
                    "template_name": template_name,
                    "template_vars": template_vars,
                    "subject": subject,
                    "cc": cc,
                    "bcc": bcc
                },
                headers=self._headers()
            )
            return response.json()

    async def send_welcome_email(
        self,
        to: str,
        name: str,
        workspace_name: str,
        login_url: str,
        temp_password: Optional[str] = None
    ) -> Dict[str, Any]:
        """Send welcome email to new user"""
        return await self.send_template_email(
            to=to,
            template_name="workspace_welcome",
            template_vars={
                "user_name": name,
                "workspace_name": workspace_name,
                "login_url": login_url,
                "temp_password": temp_password,
                "support_email": "support@bheem.cloud"
            }
        )

    async def send_invite_email(
        self,
        to: str,
        invitee_name: str,
        inviter_name: str,
        workspace_name: str,
        invite_url: str,
        role: str = "member"
    ) -> Dict[str, Any]:
        """Send invitation email to join workspace"""
        return await self.send_template_email(
            to=to,
            template_name="workspace_invite",
            template_vars={
                "invitee_name": invitee_name,
                "inviter_name": inviter_name,
                "workspace_name": workspace_name,
                "invite_url": invite_url,
                "role": role
            }
        )

    async def send_password_reset_email(
        self,
        to: str,
        name: str,
        reset_url: str,
        expires_in: str = "24 hours"
    ) -> Dict[str, Any]:
        """Send password reset email"""
        return await self.send_template_email(
            to=to,
            template_name="password_reset",
            template_vars={
                "user_name": name,
                "reset_url": reset_url,
                "expires_in": expires_in
            }
        )

    # ═══════════════════════════════════════════════════════════════
    # MEETING METHODS
    # ═══════════════════════════════════════════════════════════════

    async def send_meeting_invite(
        self,
        to: str,
        meeting_title: str,
        meeting_time: str,
        meeting_url: str,
        host_name: Optional[str] = None,
        attendees: Optional[List[str]] = None
    ) -> Dict[str, Any]:
        """Send meeting invitation email"""
        async with httpx.AsyncClient(timeout=self.timeout) as client:
            response = await client.post(
                f"{self.notify_url}/api/v1/mail/bheem-tele/meeting-invite",
                json={
                    "to": to,
                    "meeting_title": meeting_title,
                    "meeting_time": meeting_time,
                    "meeting_url": meeting_url,
                    "host_name": host_name,
                    "attendees": attendees
                },
                headers=self._headers()
            )
            return response.json()

    # ═══════════════════════════════════════════════════════════════
    # SMS METHODS
    # ═══════════════════════════════════════════════════════════════

    async def send_sms(
        self,
        to: str,
        message: str,
        sender_id: Optional[str] = None
    ) -> Dict[str, Any]:
        """Send SMS message"""
        async with httpx.AsyncClient(timeout=self.timeout) as client:
            response = await client.post(
                f"{self.notify_url}/api/v1/bheem-tele/sms/send",
                json={
                    "to": to,
                    "message": message,
                    "sender_id": sender_id
                },
                headers=self._headers()
            )
            return response.json()

    async def send_otp(
        self,
        to: str,
        otp_length: int = 6
    ) -> Dict[str, Any]:
        """Send OTP via SMS"""
        async with httpx.AsyncClient(timeout=self.timeout) as client:
            response = await client.post(
                f"{self.notify_url}/api/v1/bheem-tele/otp/send",
                json={
                    "to": to,
                    "otp_length": otp_length
                },
                headers=self._headers()
            )
            return response.json()

    async def verify_otp(
        self,
        to: str,
        otp: str
    ) -> Dict[str, Any]:
        """Verify OTP"""
        async with httpx.AsyncClient(timeout=self.timeout) as client:
            response = await client.post(
                f"{self.notify_url}/api/v1/bheem-tele/otp/verify",
                json={
                    "to": to,
                    "otp": otp
                },
                headers=self._headers()
            )
            return response.json()

    # ═══════════════════════════════════════════════════════════════
    # WHATSAPP METHODS
    # ═══════════════════════════════════════════════════════════════

    async def send_whatsapp_template(
        self,
        to: str,
        template_name: str,
        template_variables: Dict[str, str]
    ) -> Dict[str, Any]:
        """Send WhatsApp template message"""
        async with httpx.AsyncClient(timeout=self.timeout) as client:
            response = await client.post(
                f"{self.notify_url}/api/v1/whatsapp/template",
                json={
                    "to": to,
                    "template_name": template_name,
                    "template_variables": template_variables
                },
                headers=self._headers()
            )
            return response.json()

    async def send_whatsapp_text(
        self,
        to: str,
        message: str
    ) -> Dict[str, Any]:
        """Send WhatsApp text message (within 24h session)"""
        async with httpx.AsyncClient(timeout=self.timeout) as client:
            response = await client.post(
                f"{self.notify_url}/api/v1/whatsapp/text",
                json={
                    "to": to,
                    "message": message
                },
                headers=self._headers()
            )
            return response.json()

    # ═══════════════════════════════════════════════════════════════
    # HEALTH CHECK
    # ═══════════════════════════════════════════════════════════════

    async def health_check(self) -> bool:
        """Check if Notify service is available"""
        try:
            async with httpx.AsyncClient(timeout=5.0) as client:
                response = await client.get(f"{self.notify_url}/health")
                return response.status_code == 200
        except Exception:
            return False


# Singleton instance
notify_client = NotifyClient()
```

### 1.5 Integration Points

Update these files to use NotifyClient:

1. **User Registration** (`/api/auth.py`):
   - Send welcome email on registration
   - Send OTP for phone verification

2. **User Invitation** (`/api/admin.py`):
   - Send invite email when adding user to workspace

3. **Password Reset** (`/api/auth.py`):
   - Send password reset email

4. **Meeting Invites** (`/api/meet.py`):
   - Send meeting invitation emails

### 1.6 Testing Checklist

- [ ] NotifyClient connects to Bheem Notify service
- [ ] Welcome email sends successfully
- [ ] Invite email sends successfully
- [ ] Meeting invite email sends successfully
- [ ] SMS OTP sends successfully
- [ ] Health check works

---

## Phase 2: User Provisioning Service

### 2.1 Overview

Create a unified service that orchestrates user creation across all services with a single action.

### 2.2 Files to Create

```
/backend/
└── services/
    └── user_provisioning.py    # Main orchestration service
```

### 2.3 UserProvisioningService Implementation

**File**: `/backend/services/user_provisioning.py`

```python
"""
Unified User Provisioning Service
==================================
Orchestrates user creation across all Bheem services.
ONE action = ALL services provisioned.
"""

import logging
import secrets
import string
from typing import Dict, Any, Optional, List
from datetime import datetime
from dataclasses import dataclass
from enum import Enum

from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from models.admin_models import Tenant, TenantUser, Domain
from services.mailcow_service import mailcow_service
from services.passport_client import get_passport_client
from integrations.notify.notify_client import notify_client
from core.config import settings

logger = logging.getLogger(__name__)


class ProvisioningStatus(str, Enum):
    SUCCESS = "success"
    PARTIAL = "partial"
    FAILED = "failed"


@dataclass
class ProvisioningResult:
    """Result of user provisioning operation"""
    status: ProvisioningStatus
    user_id: Optional[str] = None
    email: str = ""
    services: Dict[str, Dict[str, Any]] = None
    errors: List[str] = None

    def __post_init__(self):
        if self.services is None:
            self.services = {}
        if self.errors is None:
            self.errors = []


class UserProvisioningService:
    """
    Unified User Provisioning Service

    Handles complete user lifecycle:
    - Create user in Passport (SSO)
    - Create TenantUser in Workspace DB
    - Create Mailbox in Mailcow (if workspace domain)
    - Create Nextcloud account (future)
    - Send welcome/invite email via Notify
    """

    def __init__(self, db: AsyncSession):
        self.db = db
        self.passport = get_passport_client()

    def _generate_temp_password(self, length: int = 12) -> str:
        """Generate a secure temporary password"""
        alphabet = string.ascii_letters + string.digits + "!@#$%"
        return ''.join(secrets.choice(alphabet) for _ in range(length))

    async def _get_tenant(self, tenant_id: str) -> Optional[Tenant]:
        """Get tenant by ID or slug"""
        # Try UUID first
        try:
            import uuid
            tenant_uuid = uuid.UUID(tenant_id)
            result = await self.db.execute(
                select(Tenant).where(Tenant.id == tenant_uuid)
            )
        except ValueError:
            # Try slug
            result = await self.db.execute(
                select(Tenant).where(Tenant.slug == tenant_id.lower())
            )
        return result.scalar_one_or_none()

    async def _get_tenant_domain(self, tenant_id) -> Optional[str]:
        """Get primary verified domain for tenant"""
        result = await self.db.execute(
            select(Domain).where(
                Domain.tenant_id == tenant_id,
                Domain.is_primary == True,
                Domain.ownership_verified == True
            )
        )
        domain = result.scalar_one_or_none()
        return domain.domain if domain else None

    async def _check_user_exists(self, tenant_id, email: str) -> bool:
        """Check if user already exists in tenant"""
        result = await self.db.execute(
            select(TenantUser).where(
                TenantUser.tenant_id == tenant_id,
                TenantUser.email == email
            )
        )
        return result.scalar_one_or_none() is not None

    # ═══════════════════════════════════════════════════════════════
    # MAIN PROVISIONING METHOD
    # ═══════════════════════════════════════════════════════════════

    async def provision_user(
        self,
        tenant_id: str,
        email: str,
        name: str,
        role: str = "member",
        create_mailbox: bool = True,
        send_welcome_email: bool = True,
        inviter_name: Optional[str] = None,
        inviter_email: Optional[str] = None
    ) -> ProvisioningResult:
        """
        Provision a new user with all services.

        Args:
            tenant_id: Tenant ID or slug
            email: User's email address
            name: User's display name
            role: Role in workspace (admin, manager, member)
            create_mailbox: Auto-create mailbox if email matches tenant domain
            send_welcome_email: Send welcome/invite email
            inviter_name: Name of person who invited (for invite email)
            inviter_email: Email of inviter

        Returns:
            ProvisioningResult with status and details
        """
        result = ProvisioningResult(
            status=ProvisioningStatus.SUCCESS,
            email=email
        )

        try:
            # ─────────────────────────────────────────────────────────
            # Step 1: Validate tenant
            # ─────────────────────────────────────────────────────────
            tenant = await self._get_tenant(tenant_id)
            if not tenant:
                result.status = ProvisioningStatus.FAILED
                result.errors.append(f"Tenant not found: {tenant_id}")
                return result

            # ─────────────────────────────────────────────────────────
            # Step 2: Check if user already exists
            # ─────────────────────────────────────────────────────────
            if await self._check_user_exists(tenant.id, email):
                result.status = ProvisioningStatus.FAILED
                result.errors.append(f"User {email} already exists in workspace")
                return result

            # ─────────────────────────────────────────────────────────
            # Step 3: Create user in Bheem Passport (SSO)
            # ─────────────────────────────────────────────────────────
            temp_password = self._generate_temp_password()
            passport_result = await self._provision_passport_user(
                email=email,
                name=name,
                password=temp_password,
                company_code=tenant.erp_company_code or tenant.slug.upper()
            )
            result.services["passport"] = passport_result

            if passport_result.get("error"):
                # Passport creation failed - continue with local user only
                logger.warning(f"Passport user creation failed: {passport_result.get('error')}")
                result.errors.append(f"Passport: {passport_result.get('error')}")
                passport_user_id = None
            else:
                passport_user_id = passport_result.get("user_id")

            # ─────────────────────────────────────────────────────────
            # Step 4: Create TenantUser in Workspace DB
            # ─────────────────────────────────────────────────────────
            import uuid
            user_id = uuid.UUID(passport_user_id) if passport_user_id else uuid.uuid4()

            workspace_result = await self._provision_workspace_user(
                tenant_id=tenant.id,
                user_id=user_id,
                email=email,
                name=name,
                role=role
            )
            result.services["workspace"] = workspace_result
            result.user_id = str(workspace_result.get("user_id"))

            if workspace_result.get("error"):
                result.status = ProvisioningStatus.FAILED
                result.errors.append(f"Workspace: {workspace_result.get('error')}")
                return result

            # ─────────────────────────────────────────────────────────
            # Step 5: Create Mailbox (if applicable)
            # ─────────────────────────────────────────────────────────
            if create_mailbox:
                mailbox_result = await self._provision_mailbox(
                    tenant=tenant,
                    email=email,
                    name=name,
                    password=temp_password
                )
                result.services["mailbox"] = mailbox_result

                if mailbox_result.get("error"):
                    result.errors.append(f"Mailbox: {mailbox_result.get('error')}")
                    if result.status == ProvisioningStatus.SUCCESS:
                        result.status = ProvisioningStatus.PARTIAL

            # ─────────────────────────────────────────────────────────
            # Step 6: Send Welcome/Invite Email
            # ─────────────────────────────────────────────────────────
            if send_welcome_email:
                notify_result = await self._send_welcome_notification(
                    email=email,
                    name=name,
                    workspace_name=tenant.name,
                    temp_password=temp_password,
                    inviter_name=inviter_name
                )
                result.services["notification"] = notify_result

                if notify_result.get("error"):
                    result.errors.append(f"Notification: {notify_result.get('error')}")
                    if result.status == ProvisioningStatus.SUCCESS:
                        result.status = ProvisioningStatus.PARTIAL

            # ─────────────────────────────────────────────────────────
            # Final status check
            # ─────────────────────────────────────────────────────────
            if result.errors and result.status == ProvisioningStatus.SUCCESS:
                result.status = ProvisioningStatus.PARTIAL

            logger.info(
                f"User provisioning completed: email={email}, status={result.status}, "
                f"services={list(result.services.keys())}"
            )

            return result

        except Exception as e:
            logger.error(f"User provisioning failed: {e}")
            result.status = ProvisioningStatus.FAILED
            result.errors.append(str(e))
            return result

    # ═══════════════════════════════════════════════════════════════
    # SERVICE-SPECIFIC PROVISIONING METHODS
    # ═══════════════════════════════════════════════════════════════

    async def _provision_passport_user(
        self,
        email: str,
        name: str,
        password: str,
        company_code: str
    ) -> Dict[str, Any]:
        """Create user in Bheem Passport SSO"""
        try:
            result = await self.passport.register(
                username=email,
                password=password,
                role="Member",
                company_code=company_code
            )
            return {
                "status": "created",
                "user_id": result.get("id"),
                "username": result.get("username")
            }
        except Exception as e:
            logger.error(f"Passport provisioning failed: {e}")
            return {"error": str(e)}

    async def _provision_workspace_user(
        self,
        tenant_id,
        user_id,
        email: str,
        name: str,
        role: str
    ) -> Dict[str, Any]:
        """Create TenantUser in Workspace database"""
        try:
            new_user = TenantUser(
                tenant_id=tenant_id,
                user_id=user_id,
                email=email,
                name=name,
                role=role,
                is_active=True,
                invited_at=datetime.utcnow()
            )
            self.db.add(new_user)
            await self.db.commit()
            await self.db.refresh(new_user)

            return {
                "status": "created",
                "id": str(new_user.id),
                "user_id": str(new_user.user_id),
                "email": new_user.email
            }
        except Exception as e:
            logger.error(f"Workspace user provisioning failed: {e}")
            await self.db.rollback()
            return {"error": str(e)}

    async def _provision_mailbox(
        self,
        tenant: Tenant,
        email: str,
        name: str,
        password: str
    ) -> Dict[str, Any]:
        """Create mailbox in Mailcow if email matches tenant domain"""
        try:
            # Check if email domain matches tenant's mail domain
            email_domain = email.split("@")[1] if "@" in email else None

            if not email_domain:
                return {"status": "skipped", "reason": "Invalid email format"}

            # Get tenant's configured mail domains
            tenant_domains = await self._get_tenant_mail_domains(tenant.id)

            if email_domain.lower() not in [d.lower() for d in tenant_domains]:
                return {
                    "status": "skipped",
                    "reason": f"Email domain {email_domain} not in tenant domains"
                }

            # Create mailbox in Mailcow
            local_part = email.split("@")[0]
            result = await mailcow_service.create_mailbox(
                local_part=local_part,
                domain=email_domain,
                name=name,
                password=password,
                quota=1024  # 1GB default
            )

            if result.get("type") == "success" or "success" in str(result).lower():
                return {
                    "status": "created",
                    "email": email,
                    "domain": email_domain
                }
            else:
                return {
                    "status": "failed",
                    "error": result.get("msg", str(result))
                }

        except Exception as e:
            logger.error(f"Mailbox provisioning failed: {e}")
            return {"error": str(e)}

    async def _get_tenant_mail_domains(self, tenant_id) -> List[str]:
        """Get list of mail domains for tenant"""
        # From Mailcow domains
        try:
            mailcow_domains = await mailcow_service.get_domains()
            return [d.get("domain_name", d.get("domain", "")) for d in mailcow_domains]
        except Exception:
            return []

    async def _send_welcome_notification(
        self,
        email: str,
        name: str,
        workspace_name: str,
        temp_password: str,
        inviter_name: Optional[str] = None
    ) -> Dict[str, Any]:
        """Send welcome/invite email via Bheem Notify"""
        try:
            login_url = f"{settings.WORKSPACE_FRONTEND_URL}/login"

            if inviter_name:
                # Send invite email
                result = await notify_client.send_invite_email(
                    to=email,
                    invitee_name=name,
                    inviter_name=inviter_name,
                    workspace_name=workspace_name,
                    invite_url=login_url,
                    role="member"
                )
            else:
                # Send welcome email
                result = await notify_client.send_welcome_email(
                    to=email,
                    name=name,
                    workspace_name=workspace_name,
                    login_url=login_url,
                    temp_password=temp_password
                )

            return {
                "status": "sent",
                "type": "invite" if inviter_name else "welcome",
                "response": result
            }

        except Exception as e:
            logger.error(f"Welcome notification failed: {e}")
            return {"error": str(e)}

    # ═══════════════════════════════════════════════════════════════
    # DEPROVISIONING METHODS (Phase 5)
    # ═══════════════════════════════════════════════════════════════

    async def deprovision_user(
        self,
        tenant_id: str,
        user_id: str,
        delete_mailbox: bool = False,
        delete_passport: bool = False
    ) -> ProvisioningResult:
        """
        Deprovision user from all services.

        Args:
            tenant_id: Tenant ID or slug
            user_id: User ID to deprovision
            delete_mailbox: Also delete mailbox (default: just disable)
            delete_passport: Also delete from Passport (default: just disable)
        """
        result = ProvisioningResult(
            status=ProvisioningStatus.SUCCESS,
            user_id=user_id
        )

        # TODO: Implement in Phase 5
        # - Disable/delete TenantUser
        # - Disable/delete Mailbox
        # - Disable/delete Passport user
        # - Disable/delete Nextcloud account

        return result


# Factory function
def get_provisioning_service(db: AsyncSession) -> UserProvisioningService:
    """Get UserProvisioningService instance"""
    return UserProvisioningService(db)
```

### 2.4 Update Admin API

**File**: `/backend/api/admin.py`

Update `add_tenant_user` endpoint:

```python
from services.user_provisioning import get_provisioning_service, ProvisioningStatus

@router.post("/tenants/{tenant_id}/users", response_model=UserResponse)
async def add_tenant_user(
    tenant_id: str,
    user: UserCreate,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(require_admin())
):
    """Add a user to tenant with full provisioning"""

    provisioner = get_provisioning_service(db)

    result = await provisioner.provision_user(
        tenant_id=tenant_id,
        email=user.email,
        name=user.name,
        role=user.role.value,
        create_mailbox=True,
        send_welcome_email=True,
        inviter_name=current_user.get("username"),
        inviter_email=current_user.get("email")
    )

    if result.status == ProvisioningStatus.FAILED:
        raise HTTPException(
            status_code=400,
            detail=result.errors[0] if result.errors else "User provisioning failed"
        )

    # Log activity
    await log_activity(
        db,
        action="user_provisioned",
        tenant_id=tenant_id,
        user_id=result.user_id,
        entity_type="tenant_user",
        entity_id=result.user_id,
        description=f"Provisioned user {user.email} with services: {list(result.services.keys())}"
    )

    # Return user response
    return UserResponse(
        id=result.user_id,
        tenant_id=tenant_id,
        user_id=result.user_id,
        email=user.email,
        name=user.name,
        role=user.role.value,
        is_active=True,
        permissions={},
        invited_at=datetime.utcnow(),
        joined_at=None,
        created_at=datetime.utcnow(),
        provisioning_status=result.status.value,
        services_provisioned=list(result.services.keys())
    )
```

### 2.5 Testing Checklist

- [ ] User provisioning creates TenantUser record
- [ ] User provisioning creates Passport account (if enabled)
- [ ] User provisioning creates Mailbox for matching domain
- [ ] User provisioning sends welcome email
- [ ] Partial success handled correctly (some services fail)
- [ ] Rollback on complete failure

---

## Phase 3: Passport User Sync

### 3.1 Overview

Enhance Passport integration for user creation and password synchronization.

### 3.2 Update Passport Client

**File**: `/backend/services/passport_client.py`

Add these methods:

```python
async def register(
    self,
    username: str,
    password: str,
    role: str = "Member",
    company_code: str = "BHM001"
) -> Dict[str, Any]:
    """Register new user in Bheem Passport"""
    url = f"{self.base_url}/api/v1/auth/register"

    async with httpx.AsyncClient(timeout=self.timeout) as client:
        response = await client.post(
            url,
            json={
                "username": username,
                "password": password,
                "role": role,
                "company_code": company_code
            }
        )

        if response.status_code == 201:
            return response.json()
        elif response.status_code == 409:
            raise HTTPException(
                status_code=409,
                detail="User already exists in Passport"
            )
        else:
            raise HTTPException(
                status_code=response.status_code,
                detail=response.json().get("detail", "Registration failed")
            )

async def create_user(
    self,
    email: str,
    password: str,
    role: str = "Member",
    company_code: str = "BHM001",
    name: Optional[str] = None
) -> Dict[str, Any]:
    """Create user via admin API (requires admin token)"""
    # For admin-initiated user creation
    return await self.register(
        username=email,
        password=password,
        role=role,
        company_code=company_code
    )

async def disable_user(self, user_id: str) -> Dict[str, Any]:
    """Disable user in Passport"""
    # TODO: Implement when Passport supports this
    pass

async def delete_user(self, user_id: str) -> Dict[str, Any]:
    """Delete user from Passport"""
    # TODO: Implement when Passport supports this
    pass
```

---

## Phase 4: Nextcloud Integration

### 4.1 Overview

Auto-provision Nextcloud accounts for document access.

### 4.2 Files to Create

```
/backend/
└── services/
    └── nextcloud_user_service.py
```

### 4.3 Implementation

**File**: `/backend/services/nextcloud_user_service.py`

```python
"""
Nextcloud User Provisioning Service
====================================
Manages user accounts in Nextcloud for Docs access.
"""

import httpx
import logging
from typing import Dict, Any, Optional
import base64

from core.config import settings

logger = logging.getLogger(__name__)


class NextcloudUserService:
    """Service for Nextcloud user management"""

    def __init__(self):
        self.base_url = settings.NEXTCLOUD_URL
        self.admin_user = settings.NEXTCLOUD_ADMIN_USER
        self.admin_password = settings.NEXTCLOUD_ADMIN_PASSWORD
        self.timeout = 30.0

    def _headers(self) -> Dict[str, str]:
        """Get request headers with basic auth"""
        credentials = base64.b64encode(
            f"{self.admin_user}:{self.admin_password}".encode()
        ).decode()
        return {
            "Authorization": f"Basic {credentials}",
            "OCS-APIREQUEST": "true",
            "Content-Type": "application/json"
        }

    async def create_user(
        self,
        user_id: str,
        email: str,
        display_name: str,
        password: str,
        quota: str = "1 GB"
    ) -> Dict[str, Any]:
        """Create user in Nextcloud"""
        try:
            async with httpx.AsyncClient(timeout=self.timeout) as client:
                response = await client.post(
                    f"{self.base_url}/ocs/v1.php/cloud/users",
                    json={
                        "userid": user_id,
                        "email": email,
                        "displayName": display_name,
                        "password": password,
                        "quota": quota
                    },
                    headers=self._headers()
                )

                if response.status_code in [100, 200, 201]:
                    return {"status": "created", "user_id": user_id}
                else:
                    return {"error": f"Failed: {response.text}"}

        except Exception as e:
            logger.error(f"Nextcloud user creation failed: {e}")
            return {"error": str(e)}

    async def add_to_group(
        self,
        user_id: str,
        group_id: str
    ) -> Dict[str, Any]:
        """Add user to Nextcloud group"""
        try:
            async with httpx.AsyncClient(timeout=self.timeout) as client:
                response = await client.post(
                    f"{self.base_url}/ocs/v1.php/cloud/users/{user_id}/groups",
                    json={"groupid": group_id},
                    headers=self._headers()
                )
                return {"status": "added", "group": group_id}
        except Exception as e:
            return {"error": str(e)}

    async def disable_user(self, user_id: str) -> Dict[str, Any]:
        """Disable user in Nextcloud"""
        try:
            async with httpx.AsyncClient(timeout=self.timeout) as client:
                response = await client.put(
                    f"{self.base_url}/ocs/v1.php/cloud/users/{user_id}/disable",
                    headers=self._headers()
                )
                return {"status": "disabled"}
        except Exception as e:
            return {"error": str(e)}

    async def delete_user(self, user_id: str) -> Dict[str, Any]:
        """Delete user from Nextcloud"""
        try:
            async with httpx.AsyncClient(timeout=self.timeout) as client:
                response = await client.delete(
                    f"{self.base_url}/ocs/v1.php/cloud/users/{user_id}",
                    headers=self._headers()
                )
                return {"status": "deleted"}
        except Exception as e:
            return {"error": str(e)}


nextcloud_user_service = NextcloudUserService()
```

---

## Phase 5: User Deprovisioning

### 5.1 Overview

Implement user removal that cleans up all services.

### 5.2 Add to UserProvisioningService

```python
async def deprovision_user(
    self,
    tenant_id: str,
    user_id: str,
    delete_data: bool = False
) -> ProvisioningResult:
    """
    Deprovision user from all services.

    Args:
        tenant_id: Tenant ID
        user_id: User ID to deprovision
        delete_data: True = delete, False = just disable
    """
    result = ProvisioningResult(
        status=ProvisioningStatus.SUCCESS,
        user_id=user_id
    )

    # Get user details
    user = await self._get_tenant_user(tenant_id, user_id)
    if not user:
        result.status = ProvisioningStatus.FAILED
        result.errors.append("User not found")
        return result

    # 1. Disable/Delete in Workspace DB
    workspace_result = await self._deprovision_workspace_user(
        user=user,
        delete=delete_data
    )
    result.services["workspace"] = workspace_result

    # 2. Disable/Delete Mailbox
    if user.email:
        mailbox_result = await self._deprovision_mailbox(
            email=user.email,
            delete=delete_data
        )
        result.services["mailbox"] = mailbox_result

    # 3. Disable/Delete in Passport
    if user.user_id:
        passport_result = await self._deprovision_passport_user(
            user_id=str(user.user_id),
            delete=delete_data
        )
        result.services["passport"] = passport_result

    # 4. Disable/Delete in Nextcloud
    nextcloud_result = await self._deprovision_nextcloud_user(
        email=user.email,
        delete=delete_data
    )
    result.services["nextcloud"] = nextcloud_result

    return result
```

---

## Phase 6: Frontend Updates

### 6.1 Overview

Update frontend to show provisioning status and handle unified user creation.

### 6.2 Updates Required

1. **Users Page** (`/pages/admin/users/index.tsx`):
   - Show provisioning status for each user
   - Show which services are provisioned (icons)
   - Loading state during provisioning

2. **Invite Modal** (`/components/admin/forms/UserForm.tsx`):
   - Add "Create mailbox" checkbox
   - Add "Send welcome email" checkbox
   - Show provisioning progress

3. **Types** (`/types/admin.ts`):
   ```typescript
   interface TenantUser {
     // ... existing fields
     provisioning_status?: 'success' | 'partial' | 'failed';
     services_provisioned?: string[];
   }
   ```

---

## Configuration Summary

### Environment Variables

Add to `/backend/.env`:

```bash
# ═══════════════════════════════════════════════════════════════
# UNIFIED USER PROVISIONING CONFIGURATION
# ═══════════════════════════════════════════════════════════════

# Bheem Notify Service
NOTIFY_SERVICE_URL=http://bheem-notify:8005
NOTIFY_API_KEY=your-notify-api-key
NOTIFY_TIMEOUT=30.0
NOTIFY_SENDER_EMAIL=noreply@bheem.cloud
NOTIFY_SENDER_NAME=Bheem Workspace

# Provisioning Settings
PROVISIONING_AUTO_MAILBOX=true
PROVISIONING_SEND_WELCOME=true
PROVISIONING_SYNC_PASSPORT=true
PROVISIONING_SYNC_NEXTCLOUD=true

# Frontend URL (for email links)
WORKSPACE_FRONTEND_URL=https://workspace.bheem.cloud
```

---

## Testing Checklist

### Phase 1: Notify Integration
- [ ] NotifyClient initializes correctly
- [ ] Email sending works
- [ ] SMS sending works
- [ ] Template emails work
- [ ] Error handling works

### Phase 2: User Provisioning
- [ ] Single user creation provisions all services
- [ ] Mailbox created for matching domain
- [ ] Welcome email sent
- [ ] Partial failure handled
- [ ] Complete failure rolled back

### Phase 3: Passport Sync
- [ ] User created in Passport
- [ ] Password synced
- [ ] User can login via SSO

### Phase 4: Nextcloud
- [ ] User created in Nextcloud
- [ ] Correct group assigned
- [ ] Quota set correctly

### Phase 5: Deprovisioning
- [ ] User disabled in all services
- [ ] User deleted from all services
- [ ] Data export before delete

### Phase 6: Frontend
- [ ] Provisioning status displayed
- [ ] Service icons shown
- [ ] Progress indicators work

---

## Implementation Order

```
Week 1:
├── Phase 1.1: Create NotifyClient
├── Phase 1.2: Add to environment config
└── Phase 1.3: Test email sending

Week 2:
├── Phase 2.1: Create UserProvisioningService
├── Phase 2.2: Update admin API
└── Phase 2.3: Test unified provisioning

Week 3:
├── Phase 3: Passport integration
├── Phase 4: Nextcloud integration
└── Testing all phases together

Week 4:
├── Phase 5: Deprovisioning
├── Phase 6: Frontend updates
└── End-to-end testing
```

---

## References

- **Bheem Core NotifyClient**: `/bheem-core/apps/backend/app/integrations/notify/notify_client.py`
- **Bheem Notify API**: Port 8005
- **Bheem Passport API**: Port 8003
- **Mailcow API**: `https://mail.bheem.cloud/api/v1`
- **Nextcloud OCS API**: `https://docs.bheem.cloud/ocs/v1.php`
