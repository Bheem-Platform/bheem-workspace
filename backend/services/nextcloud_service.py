"""
Bheem Workspace - Nextcloud Service
Document storage and file management via WebDAV
"""
import httpx
from typing import List, Dict, Any, Optional
import xml.etree.ElementTree as ET
from datetime import datetime
from core.config import settings

class NextcloudService:
    def __init__(self):
        self.base_url = settings.NEXTCLOUD_URL
        self.admin_user = settings.NEXTCLOUD_ADMIN_USER
        self.admin_pass = settings.NEXTCLOUD_ADMIN_PASSWORD
    
    def _get_webdav_url(self, username: str) -> str:
        return f"{self.base_url}/remote.php/dav/files/{username}"
    
    def _get_ocs_url(self) -> str:
        return f"{self.base_url}/ocs/v2.php"
    
    async def list_files(self, username: str, password: str, path: str = "/") -> List[Dict[str, Any]]:
        """List files and folders via WebDAV PROPFIND"""
        webdav_url = f"{self._get_webdav_url(username)}{path}"
        
        propfind_body = '''<?xml version="1.0"?>
        <d:propfind xmlns:d="DAV:" xmlns:oc="http://owncloud.org/ns" xmlns:nc="http://nextcloud.org/ns">
            <d:prop>
                <d:getlastmodified/>
                <d:getcontentlength/>
                <d:getcontenttype/>
                <d:resourcetype/>
                <oc:fileid/>
                <oc:size/>
                <d:displayname/>
            </d:prop>
        </d:propfind>'''
        
        async with httpx.AsyncClient(verify=False) as client:
            response = await client.request(
                method="PROPFIND",
                url=webdav_url,
                content=propfind_body,
                auth=(username, password),
                headers={"Depth": "1", "Content-Type": "application/xml"}
            )
            
            if response.status_code != 207:
                return []
            
            # Parse XML response
            files = []
            root = ET.fromstring(response.content)
            ns = {
                "d": "DAV:",
                "oc": "http://owncloud.org/ns",
                "nc": "http://nextcloud.org/ns"
            }
            
            for response_elem in root.findall(".//d:response", ns):
                href = response_elem.find("d:href", ns).text
                props = response_elem.find(".//d:prop", ns)
                
                # Skip the root path itself
                if href.rstrip("/").endswith(path.rstrip("/")) and path != "/":
                    continue
                
                is_folder = props.find(".//d:resourcetype/d:collection", ns) is not None
                
                name = href.rstrip("/").split("/")[-1]
                if not name:
                    continue
                
                size_elem = props.find("oc:size", ns)
                if size_elem is None:
                    size_elem = props.find("d:getcontentlength", ns)
                
                modified_elem = props.find("d:getlastmodified", ns)
                content_type_elem = props.find("d:getcontenttype", ns)
                fileid_elem = props.find("oc:fileid", ns)
                
                files.append({
                    "name": name,
                    "path": href.replace(f"/remote.php/dav/files/{username}", "") or "/",
                    "type": "folder" if is_folder else "file",
                    "size": int(size_elem.text) if size_elem is not None and size_elem.text else 0,
                    "modified": modified_elem.text if modified_elem is not None else None,
                    "content_type": content_type_elem.text if content_type_elem is not None else None,
                    "id": fileid_elem.text if fileid_elem is not None else None
                })
            
            return files
    
    async def create_folder(self, username: str, password: str, path: str) -> bool:
        """Create a folder via WebDAV MKCOL"""
        webdav_url = f"{self._get_webdav_url(username)}{path}"
        
        async with httpx.AsyncClient(verify=False) as client:
            response = await client.request(
                method="MKCOL",
                url=webdav_url,
                auth=(username, password)
            )
            return response.status_code in [201, 204]
    
    async def upload_file(self, username: str, password: str, path: str, content: bytes) -> bool:
        """Upload a file via WebDAV PUT"""
        webdav_url = f"{self._get_webdav_url(username)}{path}"
        
        async with httpx.AsyncClient(verify=False) as client:
            response = await client.put(
                url=webdav_url,
                content=content,
                auth=(username, password)
            )
            return response.status_code in [201, 204]
    
    async def download_file(self, username: str, password: str, path: str) -> Optional[bytes]:
        """Download a file via WebDAV GET"""
        webdav_url = f"{self._get_webdav_url(username)}{path}"
        
        async with httpx.AsyncClient(verify=False) as client:
            response = await client.get(
                url=webdav_url,
                auth=(username, password)
            )
            if response.status_code == 200:
                return response.content
            return None
    
    async def delete_file(self, username: str, password: str, path: str) -> bool:
        """Delete a file or folder via WebDAV DELETE"""
        webdav_url = f"{self._get_webdav_url(username)}{path}"
        
        async with httpx.AsyncClient(verify=False) as client:
            response = await client.delete(
                url=webdav_url,
                auth=(username, password)
            )
            return response.status_code in [204, 200]
    
    async def move_file(self, username: str, password: str, source: str, destination: str) -> bool:
        """Move/rename a file via WebDAV MOVE"""
        source_url = f"{self._get_webdav_url(username)}{source}"
        dest_url = f"{self._get_webdav_url(username)}{destination}"
        
        async with httpx.AsyncClient(verify=False) as client:
            response = await client.request(
                method="MOVE",
                url=source_url,
                auth=(username, password),
                headers={"Destination": dest_url}
            )
            return response.status_code in [201, 204]
    
    async def copy_file(self, username: str, password: str, source: str, destination: str) -> bool:
        """Copy a file via WebDAV COPY"""
        source_url = f"{self._get_webdav_url(username)}{source}"
        dest_url = f"{self._get_webdav_url(username)}{destination}"
        
        async with httpx.AsyncClient(verify=False) as client:
            response = await client.request(
                method="COPY",
                url=source_url,
                auth=(username, password),
                headers={"Destination": dest_url}
            )
            return response.status_code in [201, 204]
    
    async def create_share_link(self, username: str, password: str, path: str, expires_days: int = 7) -> Optional[str]:
        """Create a public share link via OCS API"""
        ocs_url = f"{self._get_ocs_url()}/apps/files_sharing/api/v1/shares"
        
        async with httpx.AsyncClient(verify=False) as client:
            response = await client.post(
                url=ocs_url,
                auth=(username, password),
                headers={"OCS-APIREQUEST": "true"},
                data={
                    "path": path,
                    "shareType": 3,  # Public link
                    "permissions": 1  # Read only
                }
            )
            
            if response.status_code == 200:
                # Parse OCS response
                try:
                    root = ET.fromstring(response.content)
                    url_elem = root.find(".//url")
                    if url_elem is not None:
                        return url_elem.text
                except:
                    pass
            return None
    
    async def create_user(self, username: str, password: str, email: str = None) -> bool:
        """Create a new Nextcloud user via OCS API"""
        ocs_url = f"{self._get_ocs_url()}/cloud/users"

        data = {
            "userid": username,
            "password": password
        }
        if email:
            data["email"] = email

        async with httpx.AsyncClient(verify=False) as client:
            response = await client.post(
                url=ocs_url,
                auth=(self.admin_user, self.admin_pass),
                headers={"OCS-APIREQUEST": "true"},
                data=data
            )
            return response.status_code == 200

    async def sync_password(self, username: str, new_password: str) -> bool:
        """
        Sync user password to Nextcloud.
        Called after login to ensure Nextcloud password matches Bheem Passport password.
        """
        ocs_url = f"{self._get_ocs_url()}/cloud/users/{username}"

        async with httpx.AsyncClient(verify=False) as client:
            response = await client.put(
                url=ocs_url,
                auth=(self.admin_user, self.admin_pass),
                headers={"OCS-APIREQUEST": "true"},
                data={"key": "password", "value": new_password}
            )

            if response.status_code == 200:
                print(f"[Nextcloud] Password synced for user: {username}")
                return True
            else:
                print(f"[Nextcloud] Password sync failed for {username}: {response.status_code}")
                return False
    
    async def user_exists(self, username: str) -> bool:
        """Check if a user exists"""
        ocs_url = f"{self._get_ocs_url()}/cloud/users/{username}"

        async with httpx.AsyncClient(verify=False) as client:
            response = await client.get(
                url=ocs_url,
                auth=(self.admin_user, self.admin_pass),
                headers={"OCS-APIREQUEST": "true"}
            )
            return response.status_code == 200

    # ==================== ADMIN FUNCTIONS ====================

    async def get_user_quota(self, username: str) -> Dict[str, Any]:
        """Get user storage quota and usage via OCS API"""
        ocs_url = f"{self._get_ocs_url()}/cloud/users/{username}"

        async with httpx.AsyncClient(verify=False) as client:
            response = await client.get(
                url=ocs_url,
                auth=(self.admin_user, self.admin_pass),
                headers={"OCS-APIREQUEST": "true", "Accept": "application/json"}
            )

            if response.status_code == 200:
                try:
                    data = response.json()
                    user_data = data.get("ocs", {}).get("data", {})
                    quota = user_data.get("quota", {})
                    return {
                        "username": username,
                        "quota_bytes": quota.get("quota", -1),  # -1 = unlimited
                        "used_bytes": quota.get("used", 0),
                        "free_bytes": quota.get("free", 0),
                        "relative": quota.get("relative", 0),  # percentage used
                        "display_name": user_data.get("displayname"),
                        "email": user_data.get("email")
                    }
                except Exception as e:
                    return {"error": str(e)}
            return {"error": f"Failed to get quota: {response.status_code}"}

    async def set_user_quota(self, username: str, quota_bytes: int) -> bool:
        """Set user storage quota via OCS API"""
        ocs_url = f"{self._get_ocs_url()}/cloud/users/{username}"

        # Quota value: number of bytes, or 'none' for unlimited
        quota_value = str(quota_bytes) if quota_bytes > 0 else "none"

        async with httpx.AsyncClient(verify=False) as client:
            response = await client.put(
                url=ocs_url,
                auth=(self.admin_user, self.admin_pass),
                headers={"OCS-APIREQUEST": "true"},
                data={"key": "quota", "value": quota_value}
            )
            return response.status_code == 200

    async def list_users(self, search: str = "", limit: int = 100, offset: int = 0) -> List[Dict[str, Any]]:
        """List all Nextcloud users via OCS API"""
        ocs_url = f"{self._get_ocs_url()}/cloud/users"
        params = {"limit": limit, "offset": offset}
        if search:
            params["search"] = search

        async with httpx.AsyncClient(verify=False) as client:
            response = await client.get(
                url=ocs_url,
                auth=(self.admin_user, self.admin_pass),
                headers={"OCS-APIREQUEST": "true", "Accept": "application/json"},
                params=params
            )

            if response.status_code == 200:
                try:
                    data = response.json()
                    users = data.get("ocs", {}).get("data", {}).get("users", [])
                    return [{"username": u} for u in users]
                except:
                    return []
            return []

    async def get_user_details(self, username: str) -> Dict[str, Any]:
        """Get detailed user information"""
        ocs_url = f"{self._get_ocs_url()}/cloud/users/{username}"

        async with httpx.AsyncClient(verify=False) as client:
            response = await client.get(
                url=ocs_url,
                auth=(self.admin_user, self.admin_pass),
                headers={"OCS-APIREQUEST": "true", "Accept": "application/json"}
            )

            if response.status_code == 200:
                try:
                    data = response.json()
                    user_data = data.get("ocs", {}).get("data", {})
                    return {
                        "username": user_data.get("id"),
                        "display_name": user_data.get("displayname"),
                        "email": user_data.get("email"),
                        "enabled": user_data.get("enabled", True),
                        "groups": user_data.get("groups", []),
                        "quota": user_data.get("quota", {}),
                        "language": user_data.get("language"),
                        "last_login": user_data.get("lastLogin")
                    }
                except Exception as e:
                    return {"error": str(e)}
            return {"error": f"User not found: {response.status_code}"}

    async def disable_user(self, username: str) -> bool:
        """Disable a Nextcloud user"""
        ocs_url = f"{self._get_ocs_url()}/cloud/users/{username}/disable"

        async with httpx.AsyncClient(verify=False) as client:
            response = await client.put(
                url=ocs_url,
                auth=(self.admin_user, self.admin_pass),
                headers={"OCS-APIREQUEST": "true"}
            )
            return response.status_code == 200

    async def enable_user(self, username: str) -> bool:
        """Enable a Nextcloud user"""
        ocs_url = f"{self._get_ocs_url()}/cloud/users/{username}/enable"

        async with httpx.AsyncClient(verify=False) as client:
            response = await client.put(
                url=ocs_url,
                auth=(self.admin_user, self.admin_pass),
                headers={"OCS-APIREQUEST": "true"}
            )
            return response.status_code == 200

    async def delete_user(self, username: str) -> bool:
        """Delete a Nextcloud user"""
        ocs_url = f"{self._get_ocs_url()}/cloud/users/{username}"

        async with httpx.AsyncClient(verify=False) as client:
            response = await client.delete(
                url=ocs_url,
                auth=(self.admin_user, self.admin_pass),
                headers={"OCS-APIREQUEST": "true"}
            )
            return response.status_code == 200

    # ==================== SHARE ADMINISTRATION ====================

    async def list_shares(self, path: str = None, shared_with_me: bool = False) -> List[Dict[str, Any]]:
        """List all shares via OCS API"""
        ocs_url = f"{self._get_ocs_url()}/apps/files_sharing/api/v1/shares"
        params = {}
        if path:
            params["path"] = path
        if shared_with_me:
            params["shared_with_me"] = "true"

        async with httpx.AsyncClient(verify=False) as client:
            response = await client.get(
                url=ocs_url,
                auth=(self.admin_user, self.admin_pass),
                headers={"OCS-APIREQUEST": "true", "Accept": "application/json"},
                params=params
            )

            if response.status_code == 200:
                try:
                    data = response.json()
                    shares = data.get("ocs", {}).get("data", [])
                    return [{
                        "id": s.get("id"),
                        "share_type": s.get("share_type"),
                        "share_type_name": self._get_share_type_name(s.get("share_type")),
                        "path": s.get("path"),
                        "file_target": s.get("file_target"),
                        "permissions": s.get("permissions"),
                        "uid_owner": s.get("uid_owner"),
                        "displayname_owner": s.get("displayname_owner"),
                        "share_with": s.get("share_with"),
                        "share_with_displayname": s.get("share_with_displayname"),
                        "token": s.get("token"),
                        "url": s.get("url"),
                        "expiration": s.get("expiration"),
                        "stime": s.get("stime")
                    } for s in shares]
                except:
                    return []
            return []

    def _get_share_type_name(self, share_type: int) -> str:
        """Convert share type number to name"""
        types = {
            0: "user",
            1: "group",
            3: "public_link",
            4: "email",
            6: "federated",
            7: "circle",
            10: "room"
        }
        return types.get(share_type, "unknown")

    async def get_share(self, share_id: str) -> Dict[str, Any]:
        """Get details of a specific share"""
        ocs_url = f"{self._get_ocs_url()}/apps/files_sharing/api/v1/shares/{share_id}"

        async with httpx.AsyncClient(verify=False) as client:
            response = await client.get(
                url=ocs_url,
                auth=(self.admin_user, self.admin_pass),
                headers={"OCS-APIREQUEST": "true", "Accept": "application/json"}
            )

            if response.status_code == 200:
                try:
                    data = response.json()
                    share = data.get("ocs", {}).get("data", [{}])[0]
                    return {
                        "id": share.get("id"),
                        "share_type": share.get("share_type"),
                        "path": share.get("path"),
                        "permissions": share.get("permissions"),
                        "uid_owner": share.get("uid_owner"),
                        "share_with": share.get("share_with"),
                        "token": share.get("token"),
                        "url": share.get("url"),
                        "expiration": share.get("expiration")
                    }
                except:
                    return {}
            return {}

    async def delete_share(self, share_id: str) -> bool:
        """Delete a share"""
        ocs_url = f"{self._get_ocs_url()}/apps/files_sharing/api/v1/shares/{share_id}"

        async with httpx.AsyncClient(verify=False) as client:
            response = await client.delete(
                url=ocs_url,
                auth=(self.admin_user, self.admin_pass),
                headers={"OCS-APIREQUEST": "true"}
            )
            return response.status_code == 200

    async def update_share(self, share_id: str, permissions: int = None,
                          expiration: str = None, password: str = None) -> bool:
        """Update share settings"""
        ocs_url = f"{self._get_ocs_url()}/apps/files_sharing/api/v1/shares/{share_id}"
        data = {}
        if permissions is not None:
            data["permissions"] = permissions
        if expiration:
            data["expireDate"] = expiration
        if password:
            data["password"] = password

        async with httpx.AsyncClient(verify=False) as client:
            response = await client.put(
                url=ocs_url,
                auth=(self.admin_user, self.admin_pass),
                headers={"OCS-APIREQUEST": "true"},
                data=data
            )
            return response.status_code == 200

    # ==================== GROUP MANAGEMENT ====================

    async def list_groups(self) -> List[str]:
        """List all groups"""
        ocs_url = f"{self._get_ocs_url()}/cloud/groups"

        async with httpx.AsyncClient(verify=False) as client:
            response = await client.get(
                url=ocs_url,
                auth=(self.admin_user, self.admin_pass),
                headers={"OCS-APIREQUEST": "true", "Accept": "application/json"}
            )

            if response.status_code == 200:
                try:
                    data = response.json()
                    return data.get("ocs", {}).get("data", {}).get("groups", [])
                except:
                    return []
            return []

    async def create_group(self, group_name: str) -> bool:
        """Create a new group"""
        ocs_url = f"{self._get_ocs_url()}/cloud/groups"

        async with httpx.AsyncClient(verify=False) as client:
            response = await client.post(
                url=ocs_url,
                auth=(self.admin_user, self.admin_pass),
                headers={"OCS-APIREQUEST": "true"},
                data={"groupid": group_name}
            )
            return response.status_code == 200

    async def add_user_to_group(self, username: str, group_name: str) -> bool:
        """Add user to a group"""
        ocs_url = f"{self._get_ocs_url()}/cloud/users/{username}/groups"

        async with httpx.AsyncClient(verify=False) as client:
            response = await client.post(
                url=ocs_url,
                auth=(self.admin_user, self.admin_pass),
                headers={"OCS-APIREQUEST": "true"},
                data={"groupid": group_name}
            )
            return response.status_code == 200

    async def remove_user_from_group(self, username: str, group_name: str) -> bool:
        """Remove user from a group"""
        ocs_url = f"{self._get_ocs_url()}/cloud/users/{username}/groups"

        async with httpx.AsyncClient(verify=False) as client:
            response = await client.delete(
                url=ocs_url,
                auth=(self.admin_user, self.admin_pass),
                headers={"OCS-APIREQUEST": "true"},
                data={"groupid": group_name}
            )
            return response.status_code == 200

    # ==================== STORAGE STATISTICS ====================

    async def get_storage_stats(self) -> Dict[str, Any]:
        """Get overall storage statistics (admin)"""
        # Get all users and aggregate their usage
        users = await self.list_users(limit=1000)
        total_used = 0
        total_quota = 0
        user_stats = []

        for user in users:
            quota_info = await self.get_user_quota(user["username"])
            if "error" not in quota_info:
                used = quota_info.get("used_bytes", 0)
                quota = quota_info.get("quota_bytes", -1)
                total_used += used
                if quota > 0:
                    total_quota += quota
                user_stats.append({
                    "username": user["username"],
                    "used_bytes": used,
                    "quota_bytes": quota,
                    "usage_percent": quota_info.get("relative", 0)
                })

        # Sort by usage
        user_stats.sort(key=lambda x: x["used_bytes"], reverse=True)

        return {
            "total_users": len(users),
            "total_used_bytes": total_used,
            "total_used_mb": round(total_used / (1024 * 1024), 2),
            "total_used_gb": round(total_used / (1024 * 1024 * 1024), 2),
            "total_quota_bytes": total_quota if total_quota > 0 else None,
            "top_users": user_stats[:10]
        }


# Singleton instance
nextcloud_service = NextcloudService()
