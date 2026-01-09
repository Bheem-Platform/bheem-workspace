"""
Bheem Workspace - User Workspace Service
Links ERP users to their Email, Files, and Meetings
"""
from typing import Optional, Dict, Any, List
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import text
from datetime import datetime
import httpx

from core.config import settings
from services.mailcow_service import mailcow_service
from services.nextcloud_service import nextcloud_service
from services.caldav_service import caldav_service
from services.livekit_service import livekit_service


class UserWorkspaceService:
    """
    Service to manage user workspace resources:
    - Email (Mailcow)
    - Files (Nextcloud)
    - Meetings (LiveKit)
    - Calendar (CalDAV)

    Each ERP user's email is used as the primary identifier across all services.
    """

    def __init__(self):
        self.mailcow_api = f"{settings.MAILCOW_URL}/api/v1"
        self.mailcow_key = settings.MAILCOW_API_KEY

    def _get_user_email(self, user: Dict) -> str:
        """Get user's email - check email field first, then username if it looks like email"""
        if user.get('email'):
            return user['email']
        username = user.get('username', '')
        if '@' in username:
            return username
        return None

    async def get_user_workspace(
        self,
        db: AsyncSession,
        user_id: str,
        current_user: Dict = None
    ) -> Dict[str, Any]:
        """
        Get all workspace resources for a user
        Returns: email config, file access, meeting rooms, calendar
        """
        user = None
        email = None

        # Try to get user from ERP database (auth.users)
        # Note: auth.users may not exist in this database - skip if not available
        try:
            result = await db.execute(text("""
                SELECT u.id, u.username, u.email, u.company_id, u.role,
                       p.first_name, p.last_name, c.name as company_name, c.domain
                FROM auth.users u
                LEFT JOIN contact_management.persons p ON u.person_id = p.id
                LEFT JOIN public.companies c ON u.company_id = c.id
                WHERE u.id = :user_id AND u.is_active = true
            """), {"user_id": user_id})
            user = result.fetchone()
            if user:
                email = self._get_user_email(user._asdict())
        except Exception as e:
            # Database query failed - table might not exist
            # IMPORTANT: Rollback to clear failed transaction state
            print(f"[UserWorkspace] Database query failed (auth.users not in this db): {e}")
            await db.rollback()
            user = None

        # If database query failed, use current_user from JWT token
        if not user and current_user:
            email = current_user.get('email') or current_user.get('username')
            if email and '@' not in email:
                email = None

        # Also get workspace role from TenantUser (if user belongs to a workspace)
        workspace_role = None
        tenant_info = None
        try:
            print(f"[UserWorkspace] Looking up tenant_user for user_id: {user_id}, email: {email}")
            # Query includes tenant owner check - if user's email matches owner_email, treat as admin
            tenant_result = await db.execute(text("""
                SELECT tu.role, tu.tenant_id, t.name as tenant_name, t.slug as tenant_slug, t.owner_email,
                       CASE WHEN LOWER(tu.email) = LOWER(t.owner_email) OR LOWER(:user_email) = LOWER(t.owner_email)
                            THEN 'admin'
                            ELSE tu.role
                       END as effective_role
                FROM workspace.tenant_users tu
                JOIN workspace.tenants t ON tu.tenant_id = t.id
                WHERE tu.user_id = :user_id AND tu.is_active = true
                LIMIT 1
            """), {"user_id": user_id, "user_email": email or ""})
            tenant_user = tenant_result.fetchone()
            print(f"[UserWorkspace] tenant_user result: {tenant_user}")
            if tenant_user:
                # Use effective_role which considers owner_email match
                workspace_role = tenant_user.effective_role
                tenant_info = {
                    "id": str(tenant_user.tenant_id),
                    "name": tenant_user.tenant_name,
                    "slug": tenant_user.tenant_slug
                }
                print(f"[UserWorkspace] Found workspace_role: {workspace_role} (db role: {tenant_user.role}), tenant: {tenant_info}")
            else:
                print(f"[UserWorkspace] No tenant_user found for user_id: {user_id}")
        except Exception as e:
            print(f"[UserWorkspace] Error looking up tenant_user: {e}")
            pass  # Workspace tables might not exist

        # Build user info from database or JWT token
        if user:
            user_info = {
                "id": str(user.id),
                "username": user.username,
                "email": email,
                "name": f"{user.first_name or ''} {user.last_name or ''}".strip() or user.username,
                "company": user.company_name,
                "company_domain": user.domain,
                "role": user.role,
                "workspace_role": workspace_role,
                "tenant": tenant_info
            }
            user_role = user.role
        elif current_user:
            user_info = {
                "id": str(current_user.get("id", current_user.get("user_id", ""))),
                "username": current_user.get("username", ""),
                "email": email,
                "name": current_user.get("username", "User"),
                "company": current_user.get("company_code", ""),
                "company_domain": None,
                "role": current_user.get("role", "User"),
                "workspace_role": workspace_role,
                "tenant": tenant_info
            }
            user_role = current_user.get("role", "User")
        else:
            return None

        return {
            "user": user_info,
            "workspace": {
                "email": {
                    "enabled": email is not None,
                    "address": email,
                    "imap_server": "mail.bheem.cloud",
                    "imap_port": 993,
                    "smtp_server": "mail.bheem.cloud",
                    "smtp_port": 465,
                    "webmail_url": f"https://mail.bheem.cloud/SOGo"
                },
                "files": {
                    "enabled": email is not None,
                    "username": email,
                    "webdav_url": f"https://docs.bheem.cloud/remote.php/dav/files/{email}/",
                    "web_url": "https://docs.bheem.cloud"
                },
                "calendar": {
                    "enabled": email is not None,
                    "caldav_url": f"https://docs.bheem.cloud/remote.php/dav/calendars/{email}/",
                    "web_url": "https://docs.bheem.cloud/apps/calendar"
                },
                "meetings": {
                    "enabled": True,
                    "can_create": user_role in ['SuperAdmin', 'Admin', 'Manager', 'Employee'],
                    "server_url": "wss://meet.bheem.cloud"
                }
            }
        }

    async def get_user_inbox(
        self,
        email: str,
        password: str,
        folder: str = "INBOX",
        limit: int = 50
    ) -> List[Dict]:
        """Get user's email inbox"""
        return mailcow_service.get_inbox(email, password, folder, limit)

    async def get_user_email(
        self,
        email: str,
        password: str,
        message_id: str,
        folder: str = "INBOX"
    ) -> Optional[Dict]:
        """Get a specific email"""
        return mailcow_service.get_email(email, password, message_id, folder)

    async def send_user_email(
        self,
        from_email: str,
        password: str,
        to: List[str],
        subject: str,
        body: str,
        cc: List[str] = None,
        is_html: bool = True
    ) -> bool:
        """Send email from user's account"""
        return mailcow_service.send_email(
            from_email=from_email,
            password=password,
            to=to,
            subject=subject,
            body=body,
            cc=cc,
            is_html=is_html
        )

    async def get_user_files(
        self,
        email: str,
        password: str,
        path: str = "/"
    ) -> List[Dict]:
        """Get user's files from Nextcloud"""
        return await nextcloud_service.list_files(email, password, path)

    async def get_user_calendars(
        self,
        email: str,
        password: str
    ) -> List[Dict]:
        """Get user's calendars"""
        return await caldav_service.get_calendars(email, password)

    async def get_user_events(
        self,
        email: str,
        password: str,
        calendar_id: str,
        start: datetime,
        end: datetime
    ) -> List[Dict]:
        """Get user's calendar events"""
        return await caldav_service.get_events(email, password, calendar_id, start, end)

    async def create_meeting_token(
        self,
        user_id: str,
        user_name: str,
        room_name: str,
        is_host: bool = False
    ) -> str:
        """Create a meeting token for user"""
        return livekit_service.create_token(
            room_name=room_name,
            participant_identity=user_id,
            participant_name=user_name,
            is_host=is_host
        )

    async def provision_user_workspace(
        self,
        db: AsyncSession,
        user_id: str,
        password: str
    ) -> Dict[str, bool]:
        """
        Provision all workspace resources for a new user
        Creates: Mailbox, Nextcloud account, default calendar
        """
        # Get user details
        result = await db.execute(text("""
            SELECT u.id, u.username, u.email, u.company_id,
                   p.first_name, p.last_name,
                   c.domain as company_domain
            FROM auth.users u
            LEFT JOIN contact_management.persons p ON u.person_id = p.id
            LEFT JOIN public.companies c ON u.company_id = c.id
            WHERE u.id = :user_id
        """), {"user_id": user_id})

        user = result.fetchone()
        if not user:
            return {"success": False, "error": "User not found"}

        email = self._get_user_email(user._asdict())
        if not email:
            return {"success": False, "error": "User has no email"}

        name = f"{user.first_name or ''} {user.last_name or ''}".strip() or user.username
        local_part, domain = email.split('@')

        results = {
            "email": False,
            "files": False,
            "calendar": False
        }

        # 1. Create Mailbox
        try:
            mailbox_result = await self._create_mailbox_api(
                local_part=local_part,
                domain=domain,
                name=name,
                password=password
            )
            results["email"] = mailbox_result
        except Exception as e:
            print(f"Mailbox creation error: {e}")

        # 2. Create Nextcloud account
        try:
            nc_result = await nextcloud_service.create_user(
                username=email,
                password=password,
                email=email
            )
            results["files"] = nc_result
        except Exception as e:
            print(f"Nextcloud creation error: {e}")

        # 3. Calendar is auto-created with Nextcloud account
        results["calendar"] = results["files"]

        return results

    async def _create_mailbox_api(
        self,
        local_part: str,
        domain: str,
        name: str,
        password: str,
        quota: int = 5120
    ) -> bool:
        """Create mailbox via Mailcow API"""
        async with httpx.AsyncClient(verify=False) as client:
            response = await client.post(
                f"{self.mailcow_api}/add/mailbox",
                headers={
                    "X-API-Key": self.mailcow_key,
                    "Content-Type": "application/json"
                },
                json={
                    "local_part": local_part,
                    "domain": domain,
                    "name": name,
                    "password": password,
                    "password2": password,
                    "quota": quota,
                    "active": 1,
                    "force_pw_update": 0,
                    "tls_enforce_in": 1,
                    "tls_enforce_out": 1
                }
            )
            return response.status_code == 200


# Singleton instance
user_workspace_service = UserWorkspaceService()
