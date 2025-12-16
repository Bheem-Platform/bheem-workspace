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

# Singleton instance
nextcloud_service = NextcloudService()
