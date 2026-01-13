"""
Bheem Workspace - Mattermost Integration Service
Auto-provisions users and teams for team chat functionality.
"""
import httpx
from typing import Optional, Dict, Any, List
from core.config import settings
from core.logging import get_logger

logger = get_logger("bheem.chat.mattermost")


class MattermostService:
    """
    Mattermost Integration Service.
    Handles team and user provisioning for workspace chat.
    """

    def __init__(self):
        self.base_url = getattr(settings, 'MATTERMOST_URL', None)
        self.admin_token = getattr(settings, 'MATTERMOST_ADMIN_TOKEN', None)
        self.enabled = getattr(settings, 'MATTERMOST_ENABLED', False)

    def _get_headers(self) -> dict:
        """Get authentication headers."""
        return {
            "Authorization": f"Bearer {self.admin_token}",
            "Content-Type": "application/json"
        }

    async def health_check(self) -> bool:
        """Check if Mattermost is available."""
        if not self.enabled or not self.base_url:
            return False

        try:
            async with httpx.AsyncClient(timeout=5.0) as client:
                response = await client.get(
                    f"{self.base_url}/api/v4/system/ping"
                )
                return response.status_code == 200
        except Exception as e:
            logger.warning(f"Mattermost health check failed: {e}")
            return False

    async def create_team(
        self,
        tenant_slug: str,
        tenant_name: str,
        tenant_id: str
    ) -> Optional[Dict[str, Any]]:
        """
        Create a Mattermost team for a workspace tenant.

        Args:
            tenant_slug: Unique tenant slug (used as team name)
            tenant_name: Display name for the team
            tenant_id: Tenant UUID for reference

        Returns:
            Team data dict or None if failed
        """
        if not self.enabled:
            return {"status": "disabled", "message": "Mattermost integration disabled"}

        try:
            async with httpx.AsyncClient(timeout=30.0) as client:
                response = await client.post(
                    f"{self.base_url}/api/v4/teams",
                    headers=self._get_headers(),
                    json={
                        "name": tenant_slug[:64],  # Mattermost limit
                        "display_name": tenant_name[:64],
                        "type": "I",  # Invite-only team
                        "description": f"Bheem Workspace team for {tenant_name}"
                    }
                )

                if response.status_code == 201:
                    team_data = response.json()
                    logger.info(
                        f"Created Mattermost team: {team_data.get('id')}",
                        action="mattermost_team_created",
                        tenant_id=tenant_id
                    )
                    return team_data
                elif response.status_code == 400:
                    # Team might already exist
                    existing = await self.get_team_by_name(tenant_slug)
                    if existing:
                        return existing
                    logger.error(f"Failed to create team: {response.text}")
                    return None
                else:
                    logger.error(f"Mattermost team creation failed: {response.status_code} - {response.text}")
                    return None

        except Exception as e:
            logger.error(f"Mattermost team creation error: {e}")
            return None

    async def get_team_by_name(self, team_name: str) -> Optional[Dict[str, Any]]:
        """Get a team by its name."""
        if not self.enabled:
            return None

        try:
            async with httpx.AsyncClient(timeout=10.0) as client:
                response = await client.get(
                    f"{self.base_url}/api/v4/teams/name/{team_name}",
                    headers=self._get_headers()
                )
                if response.status_code == 200:
                    return response.json()
                return None
        except Exception as e:
            logger.error(f"Failed to get team by name: {e}")
            return None

    async def create_user(
        self,
        email: str,
        username: str,
        password: str,
        display_name: Optional[str] = None
    ) -> Optional[Dict[str, Any]]:
        """
        Create a Mattermost user.

        Args:
            email: User's email
            username: Username (alphanumeric, will be sanitized)
            password: User's password
            display_name: Display name

        Returns:
            User data dict or None if failed
        """
        if not self.enabled:
            return {"status": "disabled", "message": "Mattermost integration disabled"}

        # Sanitize username for Mattermost (alphanumeric + . - _)
        mm_username = username.replace("@", "_").replace("+", "_")[:64]

        try:
            async with httpx.AsyncClient(timeout=30.0) as client:
                response = await client.post(
                    f"{self.base_url}/api/v4/users",
                    headers=self._get_headers(),
                    json={
                        "email": email,
                        "username": mm_username,
                        "password": password,
                        "first_name": display_name or username.split("@")[0] if "@" in username else username,
                        "auth_service": ""  # Local auth
                    }
                )

                if response.status_code == 201:
                    user_data = response.json()
                    logger.info(
                        f"Created Mattermost user: {user_data.get('id')}",
                        action="mattermost_user_created",
                        email=email
                    )
                    return user_data
                elif response.status_code == 400:
                    # User might already exist
                    existing = await self.get_user_by_email(email)
                    if existing:
                        return existing
                    logger.error(f"Failed to create user: {response.text}")
                    return None
                else:
                    logger.error(f"Mattermost user creation failed: {response.status_code} - {response.text}")
                    return None

        except Exception as e:
            logger.error(f"Mattermost user creation error: {e}")
            return None

    async def get_user_by_email(self, email: str) -> Optional[Dict[str, Any]]:
        """Get a user by email."""
        if not self.enabled:
            return None

        try:
            async with httpx.AsyncClient(timeout=10.0) as client:
                response = await client.get(
                    f"{self.base_url}/api/v4/users/email/{email}",
                    headers=self._get_headers()
                )
                if response.status_code == 200:
                    return response.json()
                return None
        except Exception as e:
            logger.error(f"Failed to get user by email: {e}")
            return None

    async def add_user_to_team(
        self,
        user_id: str,
        team_id: str
    ) -> bool:
        """
        Add a user to a team.

        Args:
            user_id: Mattermost user ID
            team_id: Mattermost team ID

        Returns:
            True if successful
        """
        if not self.enabled:
            return False

        try:
            async with httpx.AsyncClient(timeout=10.0) as client:
                response = await client.post(
                    f"{self.base_url}/api/v4/teams/{team_id}/members",
                    headers=self._get_headers(),
                    json={
                        "user_id": user_id,
                        "team_id": team_id
                    }
                )

                if response.status_code in [200, 201]:
                    logger.info(
                        f"Added user {user_id} to team {team_id}",
                        action="mattermost_team_member_added"
                    )
                    return True
                else:
                    logger.error(f"Failed to add user to team: {response.text}")
                    return False

        except Exception as e:
            logger.error(f"Failed to add user to team: {e}")
            return False

    async def create_channel(
        self,
        team_id: str,
        name: str,
        display_name: str,
        channel_type: str = "O",  # O=public, P=private
        purpose: Optional[str] = None
    ) -> Optional[Dict[str, Any]]:
        """
        Create a channel in a team.

        Args:
            team_id: Mattermost team ID
            name: Channel name (lowercase, no spaces)
            display_name: Display name
            channel_type: O for public, P for private
            purpose: Channel description

        Returns:
            Channel data dict or None if failed
        """
        if not self.enabled:
            return None

        try:
            async with httpx.AsyncClient(timeout=10.0) as client:
                response = await client.post(
                    f"{self.base_url}/api/v4/channels",
                    headers=self._get_headers(),
                    json={
                        "team_id": team_id,
                        "name": name.lower().replace(" ", "-")[:64],
                        "display_name": display_name[:64],
                        "type": channel_type,
                        "purpose": purpose or ""
                    }
                )

                if response.status_code == 201:
                    return response.json()
                elif response.status_code == 400:
                    # Channel might exist, try to get it
                    return await self.get_channel_by_name(team_id, name)
                return None

        except Exception as e:
            logger.error(f"Failed to create channel: {e}")
            return None

    async def get_channel_by_name(
        self,
        team_id: str,
        channel_name: str
    ) -> Optional[Dict[str, Any]]:
        """Get a channel by name."""
        if not self.enabled:
            return None

        try:
            async with httpx.AsyncClient(timeout=10.0) as client:
                response = await client.get(
                    f"{self.base_url}/api/v4/teams/{team_id}/channels/name/{channel_name}",
                    headers=self._get_headers()
                )
                if response.status_code == 200:
                    return response.json()
                return None
        except Exception as e:
            logger.error(f"Failed to get channel: {e}")
            return None

    async def create_user_access_token(
        self,
        user_id: str,
        description: str = "Bheem Workspace SSO"
    ) -> Optional[str]:
        """
        Create a personal access token for a user (for SSO).

        Args:
            user_id: Mattermost user ID
            description: Token description

        Returns:
            Access token string or None
        """
        if not self.enabled:
            return None

        try:
            async with httpx.AsyncClient(timeout=10.0) as client:
                response = await client.post(
                    f"{self.base_url}/api/v4/users/{user_id}/tokens",
                    headers=self._get_headers(),
                    json={"description": description}
                )

                if response.status_code == 200:
                    return response.json().get("token")
                return None

        except Exception as e:
            logger.error(f"Failed to create user token: {e}")
            return None

    async def provision_workspace_chat(
        self,
        tenant_slug: str,
        tenant_name: str,
        tenant_id: str,
        owner_email: str,
        owner_name: str,
        owner_password: str
    ) -> Dict[str, Any]:
        """
        Full provisioning for a new workspace.
        Creates team, owner user, and default channels.

        Returns:
            Dict with team_id, user_id, and status
        """
        result = {
            "status": "pending",
            "team_id": None,
            "user_id": None,
            "channels": []
        }

        if not self.enabled:
            result["status"] = "disabled"
            return result

        # 1. Create team
        team = await self.create_team(tenant_slug, tenant_name, tenant_id)
        if not team or not team.get("id"):
            result["status"] = "team_failed"
            return result

        result["team_id"] = team["id"]

        # 2. Create owner user
        user = await self.create_user(
            email=owner_email,
            username=owner_email,
            password=owner_password,
            display_name=owner_name
        )
        if user and user.get("id"):
            result["user_id"] = user["id"]

            # 3. Add owner to team
            await self.add_user_to_team(user["id"], team["id"])

        # 4. Create default channels
        default_channels = [
            ("general", "General", "O"),
            ("announcements", "Announcements", "O"),
            ("random", "Random", "O")
        ]

        for name, display, ch_type in default_channels:
            channel = await self.create_channel(team["id"], name, display, ch_type)
            if channel:
                result["channels"].append(channel.get("id"))

        result["status"] = "success"
        logger.info(
            f"Provisioned Mattermost for workspace {tenant_slug}",
            action="mattermost_workspace_provisioned",
            tenant_id=tenant_id
        )

        return result


# Singleton instance
mattermost_service = MattermostService()


# FastAPI dependency
async def get_mattermost_service() -> MattermostService:
    """FastAPI dependency for Mattermost service."""
    return mattermost_service
