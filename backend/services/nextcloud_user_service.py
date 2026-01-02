"""
Nextcloud User Provisioning Service
====================================
Manages user accounts in Nextcloud for Docs access.

Nextcloud OCS API Reference:
https://docs.nextcloud.com/server/latest/admin_manual/configuration_user/user_provisioning_api.html
"""

import httpx
import logging
import base64
from typing import Dict, Any, Optional, List
from xml.etree import ElementTree

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
            "OCS-APIRequest": "true",
            "Content-Type": "application/x-www-form-urlencoded"
        }

    def _parse_ocs_response(self, xml_text: str) -> Dict[str, Any]:
        """Parse OCS API XML response"""
        try:
            root = ElementTree.fromstring(xml_text)
            meta = root.find("meta")
            if meta is not None:
                status = meta.find("status")
                statuscode = meta.find("statuscode")
                message = meta.find("message")
                return {
                    "success": status is not None and status.text == "ok",
                    "status": status.text if status is not None else None,
                    "statuscode": int(statuscode.text) if statuscode is not None else None,
                    "message": message.text if message is not None else None
                }
            return {"success": False, "error": "Invalid response format"}
        except Exception as e:
            logger.error(f"Failed to parse OCS response: {e}")
            return {"success": False, "error": str(e)}

    async def create_user(
        self,
        user_id: str,
        email: str,
        display_name: str,
        password: str,
        quota: str = "1 GB",
        groups: Optional[List[str]] = None
    ) -> Dict[str, Any]:
        """
        Create user in Nextcloud

        Args:
            user_id: Unique user ID (usually email without domain or UUID)
            email: User's email address
            display_name: Display name
            password: User password
            quota: Storage quota (e.g., "1 GB", "5 GB", "unlimited")
            groups: List of groups to add user to

        Returns:
            Dict with status and details
        """
        try:
            # Prepare form data
            data = {
                "userid": user_id,
                "password": password,
                "displayName": display_name,
                "email": email,
                "quota": quota
            }

            if groups:
                data["groups[]"] = groups

            async with httpx.AsyncClient(timeout=self.timeout, verify=False) as client:
                response = await client.post(
                    f"{self.base_url}/ocs/v1.php/cloud/users",
                    data=data,
                    headers=self._headers()
                )

                result = self._parse_ocs_response(response.text)

                if result.get("success") or result.get("statuscode") == 100:
                    logger.info(f"Created Nextcloud user: {user_id}")
                    return {"status": "created", "user_id": user_id}
                elif result.get("statuscode") == 102:
                    # User already exists
                    logger.info(f"Nextcloud user already exists: {user_id}")
                    return {"status": "exists", "user_id": user_id}
                else:
                    logger.error(f"Nextcloud user creation failed: {result}")
                    return {"error": result.get("message", "Failed to create user")}

        except Exception as e:
            logger.error(f"Nextcloud user creation failed: {e}")
            return {"error": str(e)}

    async def get_user(self, user_id: str) -> Dict[str, Any]:
        """Get user info from Nextcloud"""
        try:
            async with httpx.AsyncClient(timeout=self.timeout, verify=False) as client:
                response = await client.get(
                    f"{self.base_url}/ocs/v1.php/cloud/users/{user_id}",
                    headers=self._headers()
                )

                if response.status_code == 200:
                    result = self._parse_ocs_response(response.text)
                    if result.get("success"):
                        return {"status": "found", "user_id": user_id}
                    return {"status": "not_found"}
                return {"status": "not_found"}

        except Exception as e:
            logger.error(f"Failed to get Nextcloud user: {e}")
            return {"error": str(e)}

    async def update_user(
        self,
        user_id: str,
        key: str,
        value: str
    ) -> Dict[str, Any]:
        """
        Update user attribute in Nextcloud

        Args:
            user_id: User ID
            key: Attribute to update (email, displayname, password, quota)
            value: New value
        """
        try:
            async with httpx.AsyncClient(timeout=self.timeout, verify=False) as client:
                response = await client.put(
                    f"{self.base_url}/ocs/v1.php/cloud/users/{user_id}",
                    data={"key": key, "value": value},
                    headers=self._headers()
                )

                result = self._parse_ocs_response(response.text)
                if result.get("success"):
                    return {"status": "updated", "key": key}
                return {"error": result.get("message", "Failed to update user")}

        except Exception as e:
            return {"error": str(e)}

    async def add_to_group(
        self,
        user_id: str,
        group_id: str
    ) -> Dict[str, Any]:
        """Add user to Nextcloud group"""
        try:
            async with httpx.AsyncClient(timeout=self.timeout, verify=False) as client:
                response = await client.post(
                    f"{self.base_url}/ocs/v1.php/cloud/users/{user_id}/groups",
                    data={"groupid": group_id},
                    headers=self._headers()
                )

                result = self._parse_ocs_response(response.text)
                if result.get("success") or result.get("statuscode") == 100:
                    return {"status": "added", "group": group_id}
                return {"error": result.get("message", "Failed to add to group")}

        except Exception as e:
            return {"error": str(e)}

    async def remove_from_group(
        self,
        user_id: str,
        group_id: str
    ) -> Dict[str, Any]:
        """Remove user from Nextcloud group"""
        try:
            async with httpx.AsyncClient(timeout=self.timeout, verify=False) as client:
                response = await client.delete(
                    f"{self.base_url}/ocs/v1.php/cloud/users/{user_id}/groups",
                    params={"groupid": group_id},
                    headers=self._headers()
                )

                result = self._parse_ocs_response(response.text)
                if result.get("success"):
                    return {"status": "removed", "group": group_id}
                return {"error": result.get("message", "Failed to remove from group")}

        except Exception as e:
            return {"error": str(e)}

    async def create_group(self, group_id: str) -> Dict[str, Any]:
        """Create a group in Nextcloud"""
        try:
            async with httpx.AsyncClient(timeout=self.timeout, verify=False) as client:
                response = await client.post(
                    f"{self.base_url}/ocs/v1.php/cloud/groups",
                    data={"groupid": group_id},
                    headers=self._headers()
                )

                result = self._parse_ocs_response(response.text)
                if result.get("success") or result.get("statuscode") == 100:
                    return {"status": "created", "group_id": group_id}
                elif result.get("statuscode") == 102:
                    return {"status": "exists", "group_id": group_id}
                return {"error": result.get("message", "Failed to create group")}

        except Exception as e:
            return {"error": str(e)}

    async def enable_user(self, user_id: str) -> Dict[str, Any]:
        """Enable user in Nextcloud"""
        try:
            async with httpx.AsyncClient(timeout=self.timeout, verify=False) as client:
                response = await client.put(
                    f"{self.base_url}/ocs/v1.php/cloud/users/{user_id}/enable",
                    headers=self._headers()
                )

                result = self._parse_ocs_response(response.text)
                if result.get("success"):
                    return {"status": "enabled"}
                return {"error": result.get("message", "Failed to enable user")}

        except Exception as e:
            return {"error": str(e)}

    async def disable_user(self, user_id: str) -> Dict[str, Any]:
        """Disable user in Nextcloud"""
        try:
            async with httpx.AsyncClient(timeout=self.timeout, verify=False) as client:
                response = await client.put(
                    f"{self.base_url}/ocs/v1.php/cloud/users/{user_id}/disable",
                    headers=self._headers()
                )

                result = self._parse_ocs_response(response.text)
                if result.get("success"):
                    logger.info(f"Disabled Nextcloud user: {user_id}")
                    return {"status": "disabled"}
                return {"error": result.get("message", "Failed to disable user")}

        except Exception as e:
            return {"error": str(e)}

    async def delete_user(self, user_id: str) -> Dict[str, Any]:
        """Delete user from Nextcloud"""
        try:
            async with httpx.AsyncClient(timeout=self.timeout, verify=False) as client:
                response = await client.delete(
                    f"{self.base_url}/ocs/v1.php/cloud/users/{user_id}",
                    headers=self._headers()
                )

                result = self._parse_ocs_response(response.text)
                if result.get("success"):
                    logger.info(f"Deleted Nextcloud user: {user_id}")
                    return {"status": "deleted"}
                return {"error": result.get("message", "Failed to delete user")}

        except Exception as e:
            return {"error": str(e)}

    async def set_quota(self, user_id: str, quota: str) -> Dict[str, Any]:
        """
        Set user's storage quota

        Args:
            user_id: User ID
            quota: Quota string (e.g., "1 GB", "5 GB", "unlimited")
        """
        return await self.update_user(user_id, "quota", quota)

    async def health_check(self) -> bool:
        """Check if Nextcloud service is available"""
        try:
            async with httpx.AsyncClient(timeout=5.0, verify=False) as client:
                response = await client.get(
                    f"{self.base_url}/status.php",
                    headers={"OCS-APIRequest": "true"}
                )
                return response.status_code == 200
        except Exception:
            return False


# Singleton instance
nextcloud_user_service = NextcloudUserService()
