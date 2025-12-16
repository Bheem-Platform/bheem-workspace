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
        user_id: str
    ) -> Dict[str, Any]:
        """
        Get all workspace resources for a user
        Returns: email config, file access, meeting rooms, calendar
        """
        # Get user from ERP
        result = await db.execute(text("""
            SELECT u.id, u.username, u.email, u.company_id, u.role,
                   p.first_name, p.last_name, c.name as company_name, c.domain
            FROM auth.users u
            LEFT JOIN contact_management.persons p ON u.person_id = p.id
            LEFT JOIN public.companies c ON u.company_id = c.id
            WHERE u.id = :user_id AND u.is_active = true
        """), {"user_id": user_id})

        user = result.fetchone()
        if not user:
            return None

        email = self._get_user_email(user._asdict())

        return {
            "user": {
                "id": str(user.id),
                "username": user.username,
                "email": email,
                "name": f"{user.first_name or ''} {user.last_name or ''}".strip() or user.username,
                "company": user.company_name,
                "company_domain": user.domain,
                "role": user.role
            },
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
                    "can_create": user.role in ['SuperAdmin', 'Admin', 'Manager', 'Employee'],
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
