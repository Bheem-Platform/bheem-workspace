"""
Unified User Provisioning Service
==================================
Orchestrates user creation across all Bheem services.
ONE action = ALL services provisioned.

This follows the Google Workspace / Microsoft 365 pattern:
When admin adds a user → ALL services are provisioned automatically
"""

import logging
import secrets
import string
from typing import Dict, Any, Optional, List
from datetime import datetime
from dataclasses import dataclass, field
from enum import Enum
import uuid

from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_

from models.admin_models import Tenant, TenantUser, Domain
from services.mailcow_service import mailcow_service
from services.passport_client import get_passport_client
from services.nextcloud_user_service import nextcloud_user_service
from integrations.notify.notify_client import notify_client
from core.config import settings

logger = logging.getLogger(__name__)


class ProvisioningStatus(str, Enum):
    """Status of user provisioning operation"""
    SUCCESS = "success"
    PARTIAL = "partial"
    FAILED = "failed"


@dataclass
class ProvisioningResult:
    """Result of user provisioning operation"""
    status: ProvisioningStatus
    user_id: Optional[str] = None
    email: str = ""
    services: Dict[str, Dict[str, Any]] = field(default_factory=dict)
    errors: List[str] = field(default_factory=list)
    temp_password: Optional[str] = None


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

    async def _get_tenant_by_uuid(self, tenant_uuid: uuid.UUID) -> Optional[Tenant]:
        """Get tenant by UUID directly"""
        result = await self.db.execute(
            select(Tenant).where(Tenant.id == tenant_uuid)
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

    async def _get_tenant_mail_domains(self, tenant_id) -> List[str]:
        """Get list of mail domains available for tenant"""
        # From Mailcow - get all configured domains
        try:
            mailcow_domains = await mailcow_service.get_domains()
            return [d.get("domain_name", d.get("domain", "")) for d in mailcow_domains if d.get("domain_name") or d.get("domain")]
        except Exception as e:
            logger.warning(f"Failed to get Mailcow domains: {e}")
            return []

    # ═══════════════════════════════════════════════════════════════
    # MAIN PROVISIONING METHOD
    # ═══════════════════════════════════════════════════════════════

    async def provision_user(
        self,
        tenant_id: uuid.UUID,
        username: str,
        name: str,
        role: str = "member",
        personal_email: Optional[str] = None,
        create_mailbox: bool = True,
        send_welcome_email: bool = True,
        sync_passport: bool = None,
        inviter_name: Optional[str] = None,
        inviter_email: Optional[str] = None
    ) -> ProvisioningResult:
        """
        Provision a new user with all services (Industry-standard pattern).

        This follows Google Workspace / Microsoft 365 pattern:
        - Username is used to generate workspace email: username@tenant-domain.com
        - Workspace email becomes the LOGIN credential
        - Personal email is only used for sending the invite

        Args:
            tenant_id: Tenant UUID
            username: Username (will become workspace email: username@domain)
            name: User's display name
            role: Role in workspace (admin, manager, member)
            personal_email: Personal email for sending invite (e.g., user's gmail)
            create_mailbox: Create mailbox with workspace email (default: True)
            send_welcome_email: Send welcome email to personal_email (default: True)
            sync_passport: Create user in Passport SSO (default from settings)
            inviter_name: Name of person who invited (for invite email)
            inviter_email: Email of inviter

        Returns:
            ProvisioningResult with status and details
        """
        # Use settings defaults if not specified
        if sync_passport is None:
            sync_passport = settings.PROVISIONING_SYNC_PASSPORT

        result = ProvisioningResult(
            status=ProvisioningStatus.SUCCESS,
            email=""  # Will be set after generating workspace email
        )

        try:
            # ─────────────────────────────────────────────────────────
            # Step 1: Validate tenant and get primary domain
            # ─────────────────────────────────────────────────────────
            tenant = await self._get_tenant_by_uuid(tenant_id)
            if not tenant:
                result.status = ProvisioningStatus.FAILED
                result.errors.append(f"Tenant not found: {tenant_id}")
                return result

            # Get tenant's primary domain for generating workspace email
            primary_domain = await self._get_tenant_domain(tenant.id)
            if not primary_domain:
                # Fallback: try to get any mail domain from Mailcow
                mail_domains = await self._get_tenant_mail_domains(tenant.id)
                if mail_domains:
                    primary_domain = mail_domains[0]
                else:
                    # Last fallback: use tenant slug + default domain
                    primary_domain = f"{tenant.slug}.bheem.cloud"

            # ─────────────────────────────────────────────────────────
            # Step 2: Generate workspace email from username + domain
            # ─────────────────────────────────────────────────────────
            # Sanitize username (lowercase, remove special chars)
            clean_username = username.lower().strip()
            clean_username = ''.join(c for c in clean_username if c.isalnum() or c in '._-')

            workspace_email = f"{clean_username}@{primary_domain}"
            result.email = workspace_email

            logger.info(f"Provisioning user: username={username}, workspace_email={workspace_email}, tenant={tenant.name}")

            # ─────────────────────────────────────────────────────────
            # Step 3: Check if user already exists
            # ─────────────────────────────────────────────────────────
            if await self._check_user_exists(tenant.id, workspace_email):
                result.status = ProvisioningStatus.FAILED
                result.errors.append(f"User {workspace_email} already exists in workspace")
                return result

            # ─────────────────────────────────────────────────────────
            # Step 4: Generate temp password (used for all services)
            # ─────────────────────────────────────────────────────────
            temp_password = self._generate_temp_password()
            result.temp_password = temp_password

            # ─────────────────────────────────────────────────────────
            # Step 5: Create user in Bheem Passport (SSO) - Optional
            # ─────────────────────────────────────────────────────────
            passport_user_id = None
            if sync_passport:
                passport_result = await self._provision_passport_user(
                    email=workspace_email,  # Use workspace email for SSO
                    name=name,
                    password=temp_password,
                    company_code=tenant.erp_company_code or tenant.slug.upper()
                )
                result.services["passport"] = passport_result

                if passport_result.get("error"):
                    # Passport creation failed - continue with local user only
                    logger.warning(f"Passport user creation failed: {passport_result.get('error')}")
                    result.errors.append(f"Passport: {passport_result.get('error')}")
                else:
                    passport_user_id = passport_result.get("user_id")
                    logger.info(f"Created Passport user: {passport_user_id}")

            # ─────────────────────────────────────────────────────────
            # Step 6: Create TenantUser in Workspace DB
            # ─────────────────────────────────────────────────────────
            user_id = uuid.UUID(passport_user_id) if passport_user_id else uuid.uuid4()

            workspace_result = await self._provision_workspace_user(
                tenant_id=tenant.id,
                user_id=user_id,
                email=workspace_email,  # Workspace email (login email)
                personal_email=personal_email,  # Personal email (for notifications)
                name=name,
                role=role
            )
            result.services["workspace"] = workspace_result
            result.user_id = str(workspace_result.get("user_id"))

            if workspace_result.get("error"):
                result.status = ProvisioningStatus.FAILED
                result.errors.append(f"Workspace: {workspace_result.get('error')}")
                return result

            logger.info(f"Created workspace user: {result.user_id}")

            # ─────────────────────────────────────────────────────────
            # Step 7: Create Mailbox with workspace email (industry standard)
            # ─────────────────────────────────────────────────────────
            mailbox_created = False
            if create_mailbox:
                # Always create mailbox with workspace email
                mailbox_result = await self._provision_mailbox_direct(
                    username=clean_username,
                    domain=primary_domain,
                    name=name,
                    password=temp_password
                )
                result.services["mailbox"] = mailbox_result

                if mailbox_result.get("error"):
                    result.errors.append(f"Mailbox: {mailbox_result.get('error')}")
                    if result.status == ProvisioningStatus.SUCCESS:
                        result.status = ProvisioningStatus.PARTIAL
                elif mailbox_result.get("status") == "created":
                    mailbox_created = True
                    logger.info(f"Created mailbox: {workspace_email}")

            # ─────────────────────────────────────────────────────────
            # Step 8: Create Nextcloud Account (if enabled)
            # ─────────────────────────────────────────────────────────
            if settings.PROVISIONING_SYNC_NEXTCLOUD:
                nextcloud_result = await self._provision_nextcloud_user(
                    user_id=str(user_id),
                    email=workspace_email,
                    name=name,
                    password=temp_password,
                    tenant_slug=tenant.slug
                )
                result.services["nextcloud"] = nextcloud_result

                if nextcloud_result.get("error"):
                    result.errors.append(f"Nextcloud: {nextcloud_result.get('error')}")
                    if result.status == ProvisioningStatus.SUCCESS:
                        result.status = ProvisioningStatus.PARTIAL
                elif nextcloud_result.get("status") in ["created", "exists"]:
                    logger.info(f"Nextcloud user ready: {workspace_email}")

            # ─────────────────────────────────────────────────────────
            # Step 9: Send Welcome/Invite Email (to personal email)
            # ─────────────────────────────────────────────────────────
            if send_welcome_email:
                # Send to personal email, but show workspace email in the template
                notification_target = personal_email or workspace_email

                notify_result = await self._send_welcome_notification(
                    send_to_email=notification_target,  # Where to send
                    workspace_email=workspace_email,    # User's new login email
                    name=name,
                    workspace_name=tenant.name,
                    temp_password=temp_password,
                    inviter_name=inviter_name,
                    mailbox_created=mailbox_created,
                    role=role
                )
                result.services["notification"] = notify_result

                if notify_result.get("error"):
                    result.errors.append(f"Notification: {notify_result.get('error')}")
                    if result.status == ProvisioningStatus.SUCCESS:
                        result.status = ProvisioningStatus.PARTIAL
                else:
                    logger.info(f"Sent welcome email to: {notification_target}")

            # ─────────────────────────────────────────────────────────
            # Final status check
            # ─────────────────────────────────────────────────────────
            if result.errors and result.status == ProvisioningStatus.SUCCESS:
                result.status = ProvisioningStatus.PARTIAL

            logger.info(
                f"User provisioning completed: workspace_email={workspace_email}, "
                f"personal_email={personal_email}, status={result.status}, "
                f"services={list(result.services.keys())}"
            )

            return result

        except Exception as e:
            logger.error(f"User provisioning failed: {e}", exc_info=True)
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
                role="Employee",  # Workspace users are employees
                company_code=company_code
            )
            return {
                "status": "created",
                "user_id": result.get("id"),
                "username": result.get("username")
            }
        except Exception as e:
            error_msg = str(e)
            # Check for common errors
            if "already exists" in error_msg.lower() or "duplicate" in error_msg.lower():
                return {"status": "exists", "error": "User already exists in Passport"}
            logger.error(f"Passport provisioning failed: {e}")
            return {"error": error_msg}

    async def _provision_workspace_user(
        self,
        tenant_id,
        user_id,
        email: str,
        name: str,
        role: str,
        personal_email: Optional[str] = None
    ) -> Dict[str, Any]:
        """Create TenantUser in Workspace database"""
        try:
            new_user = TenantUser(
                tenant_id=tenant_id,
                user_id=user_id,
                email=email,  # Workspace email (login email)
                personal_email=personal_email,  # Personal email (for notifications)
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
                "email": new_user.email,
                "personal_email": new_user.personal_email
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

            # Get tenant's configured mail domains from Mailcow
            tenant_domains = await self._get_tenant_mail_domains(tenant.id)

            if not tenant_domains:
                return {
                    "status": "skipped",
                    "reason": "No mail domains configured"
                }

            if email_domain.lower() not in [d.lower() for d in tenant_domains]:
                return {
                    "status": "skipped",
                    "reason": f"Email domain {email_domain} not in available domains: {tenant_domains}"
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

            # Check result for success
            if isinstance(result, list):
                for item in result:
                    if item.get("type") == "success":
                        return {
                            "status": "created",
                            "email": email,
                            "domain": email_domain
                        }
                    elif item.get("type") == "error":
                        error_msg = item.get("msg", "Unknown error")
                        if "already exists" in str(error_msg).lower():
                            return {"status": "exists", "email": email}
                        return {"status": "failed", "error": str(error_msg)}

            if isinstance(result, dict):
                if result.get("type") == "success" or "success" in str(result).lower():
                    return {
                        "status": "created",
                        "email": email,
                        "domain": email_domain
                    }
                elif result.get("type") == "error":
                    return {"status": "failed", "error": result.get("msg", str(result))}

            return {"status": "created", "email": email, "domain": email_domain}

        except Exception as e:
            logger.error(f"Mailbox provisioning failed: {e}")
            return {"error": str(e)}

    async def _provision_mailbox_direct(
        self,
        username: str,
        domain: str,
        name: str,
        password: str,
        quota: int = 1024
    ) -> Dict[str, Any]:
        """
        Create mailbox directly with username and domain (industry-standard pattern).
        No domain validation - assumes domain is already validated.
        """
        try:
            email = f"{username}@{domain}"

            # Create mailbox in Mailcow
            result = await mailcow_service.create_mailbox(
                local_part=username,
                domain=domain,
                name=name,
                password=password,
                quota=quota
            )

            # Check result for success
            if isinstance(result, list):
                for item in result:
                    if item.get("type") == "success":
                        return {
                            "status": "created",
                            "email": email,
                            "domain": domain
                        }
                    elif item.get("type") == "error":
                        error_msg = item.get("msg", "Unknown error")
                        if "already exists" in str(error_msg).lower():
                            return {"status": "exists", "email": email}
                        return {"status": "failed", "error": str(error_msg)}

            if isinstance(result, dict):
                if result.get("type") == "success" or "success" in str(result).lower():
                    return {
                        "status": "created",
                        "email": email,
                        "domain": domain
                    }
                elif result.get("type") == "error":
                    return {"status": "failed", "error": result.get("msg", str(result))}

            return {"status": "created", "email": email, "domain": domain}

        except Exception as e:
            logger.error(f"Direct mailbox provisioning failed: {e}")
            return {"error": str(e)}

    async def _get_tenant_domain(self, tenant_id: uuid.UUID) -> Optional[str]:
        """Get tenant's primary domain for generating workspace emails"""
        try:
            from models.admin_models import Domain
            result = await self.db.execute(
                select(Domain).where(
                    and_(
                        Domain.tenant_id == tenant_id,
                        Domain.is_active == True,
                        Domain.is_primary == True
                    )
                )
            )
            domain = result.scalar_one_or_none()
            if domain:
                return domain.domain

            # Fallback: get any active domain
            result = await self.db.execute(
                select(Domain).where(
                    and_(
                        Domain.tenant_id == tenant_id,
                        Domain.is_active == True
                    )
                ).limit(1)
            )
            domain = result.scalar_one_or_none()
            return domain.domain if domain else None

        except Exception as e:
            logger.error(f"Failed to get tenant domain: {e}")
            return None

    async def _provision_nextcloud_user(
        self,
        user_id: str,
        email: str,
        name: str,
        password: str,
        tenant_slug: str
    ) -> Dict[str, Any]:
        """Create user in Nextcloud for docs access"""
        try:
            # Use email as user ID for consistency across services
            nc_user_id = email.split("@")[0] if "@" in email else user_id

            result = await nextcloud_user_service.create_user(
                user_id=nc_user_id,
                email=email,
                display_name=name,
                password=password,
                quota="1 GB"  # Default quota
            )

            if result.get("error"):
                return result

            # Try to add user to tenant group
            group_name = f"workspace-{tenant_slug}"
            group_result = await nextcloud_user_service.create_group(group_name)

            if group_result.get("status") in ["created", "exists"]:
                await nextcloud_user_service.add_to_group(nc_user_id, group_name)

            return {
                "status": result.get("status", "created"),
                "user_id": nc_user_id,
                "group": group_name
            }

        except Exception as e:
            logger.error(f"Nextcloud provisioning failed: {e}")
            return {"error": str(e)}

    async def _send_welcome_notification(
        self,
        send_to_email: str,
        workspace_email: str,
        name: str,
        workspace_name: str,
        temp_password: str,
        inviter_name: Optional[str] = None,
        mailbox_created: bool = False,
        role: str = "member"
    ) -> Dict[str, Any]:
        """
        Send welcome/invite email via Bheem Notify (industry-standard pattern).

        Args:
            send_to_email: Where to send the email (personal email or workspace email)
            workspace_email: User's new workspace email (LOGIN email)
            name: User's display name
            workspace_name: Name of the workspace/organization
            temp_password: Temporary password for first login
            inviter_name: Admin who invited the user
            mailbox_created: Whether mailbox was created
            role: User's role in workspace
        """
        try:
            login_url = f"{settings.WORKSPACE_FRONTEND_URL}/login"

            if inviter_name:
                # Send user added notification (admin added the user)
                result = await notify_client.send_user_added_email(
                    to=send_to_email,  # Send to personal email
                    name=name,
                    workspace_name=workspace_name,
                    admin_name=inviter_name,
                    role=role,
                    login_url=login_url,
                    workspace_email=workspace_email,  # Show workspace email as login
                    temp_password=temp_password,
                    mailbox_created=mailbox_created
                )
            else:
                # Send generic welcome email
                result = await notify_client.send_welcome_email(
                    to=send_to_email,  # Send to personal email
                    name=name,
                    workspace_name=workspace_name,
                    login_url=login_url,
                    workspace_email=workspace_email,  # Show workspace email as login
                    temp_password=temp_password
                )

            # Log the actual response for debugging
            logger.info(f"Email send response: {result}")

            if result.get("error"):
                logger.error(f"Email send failed: {result.get('error')}")
                return {"error": result.get("error")}

            return {
                "status": "sent",
                "type": "user_added" if inviter_name else "welcome",
                "sent_to": send_to_email,
                "workspace_email": workspace_email,
                "message_id": result.get("message_id"),
                "provider": result.get("provider"),
                "response": result
            }

        except Exception as e:
            logger.error(f"Welcome notification failed: {e}", exc_info=True)
            return {"error": str(e)}

    # ═══════════════════════════════════════════════════════════════
    # DEPROVISIONING METHODS (Phase 5)
    # ═══════════════════════════════════════════════════════════════

    async def deprovision_user(
        self,
        tenant_id: uuid.UUID,
        user_id: str,
        delete_mailbox: bool = False,
        delete_passport: bool = False
    ) -> ProvisioningResult:
        """
        Deprovision user from all services.

        Args:
            tenant_id: Tenant UUID
            user_id: User ID to deprovision
            delete_mailbox: Also delete mailbox (default: just disable)
            delete_passport: Also delete from Passport (default: just disable)
        """
        result = ProvisioningResult(
            status=ProvisioningStatus.SUCCESS,
            user_id=user_id
        )

        try:
            # Get user details
            user = await self._get_tenant_user(tenant_id, user_id)
            if not user:
                result.status = ProvisioningStatus.FAILED
                result.errors.append("User not found")
                return result

            result.email = user.email or ""

            # 1. Disable/Delete in Workspace DB
            workspace_result = await self._deprovision_workspace_user(
                user=user,
                delete=False  # Always soft delete in workspace
            )
            result.services["workspace"] = workspace_result

            # 2. Disable/Delete Mailbox (if email exists and mailbox deletion requested)
            if user.email and delete_mailbox:
                mailbox_result = await self._deprovision_mailbox(
                    email=user.email,
                    delete=delete_mailbox
                )
                result.services["mailbox"] = mailbox_result

            logger.info(f"User deprovisioning completed: {user_id}")
            return result

        except Exception as e:
            logger.error(f"User deprovisioning failed: {e}")
            result.status = ProvisioningStatus.FAILED
            result.errors.append(str(e))
            return result

    async def _get_tenant_user(self, tenant_id: uuid.UUID, user_id: str) -> Optional[TenantUser]:
        """Get tenant user by ID (TenantUser.id, not TenantUser.user_id)"""
        try:
            # First try to find by TenantUser.id (the primary key)
            result = await self.db.execute(
                select(TenantUser).where(
                    TenantUser.tenant_id == tenant_id,
                    TenantUser.id == uuid.UUID(user_id)
                )
            )
            user = result.scalar_one_or_none()
            if user:
                return user

            # Fallback: try to find by TenantUser.user_id (external user reference)
            result = await self.db.execute(
                select(TenantUser).where(
                    TenantUser.tenant_id == tenant_id,
                    TenantUser.user_id == uuid.UUID(user_id)
                )
            )
            return result.scalar_one_or_none()
        except Exception:
            return None

    async def _deprovision_workspace_user(
        self,
        user: TenantUser,
        delete: bool = False
    ) -> Dict[str, Any]:
        """Disable or delete user in workspace"""
        try:
            user.is_active = False
            user.updated_at = datetime.utcnow()
            await self.db.commit()
            return {"status": "disabled"}
        except Exception as e:
            return {"error": str(e)}

    async def _deprovision_mailbox(
        self,
        email: str,
        delete: bool = False
    ) -> Dict[str, Any]:
        """Disable or delete mailbox"""
        try:
            # TODO: Implement mailbox deletion via Mailcow API
            # For now, just log it
            logger.info(f"Would delete mailbox: {email}")
            return {"status": "pending", "email": email}
        except Exception as e:
            return {"error": str(e)}


# Factory function
def get_provisioning_service(db: AsyncSession) -> UserProvisioningService:
    """Get UserProvisioningService instance"""
    return UserProvisioningService(db)
