"""
Bheem Docs - Storage Service (Nextcloud with S3 Fallback)
==========================================================
Handles file storage via Nextcloud WebDAV as per developer guide.
Includes S3 fallback for backward compatibility with legacy files.

Storage Structure:
- /Documents/{tenant_id}/{document_id}.{ext}
- /Documents/internal/{company_id}/{document_id}.{ext}

Uses Nextcloud WebDAV API for all file operations.
Falls back to S3 for legacy files not yet migrated to Nextcloud.
"""

import io
import hashlib
import logging
import mimetypes
from typing import BinaryIO, Dict, Any, Optional, Tuple, List
from uuid import UUID
from datetime import datetime
import httpx
import xml.etree.ElementTree as ET

import boto3
from botocore.config import Config

from core.config import settings

logger = logging.getLogger(__name__)


class DocsStorageService:
    """
    Storage service using Nextcloud WebDAV backend.

    All files are stored in Nextcloud which uses S3 as its storage backend.
    This ensures files are visible when users login to docs.bheem.cloud.
    """

    def __init__(self):
        self.nextcloud_url = settings.NEXTCLOUD_URL
        self.admin_user = settings.NEXTCLOUD_ADMIN_USER
        self.admin_pass = settings.NEXTCLOUD_ADMIN_PASSWORD

        # Max file size from config
        self.max_file_size = getattr(settings, 'DOCS_MAX_FILE_SIZE_BYTES', 100 * 1024 * 1024)

        # Allowed extensions
        allowed = getattr(settings, 'DOCS_ALLOWED_EXTENSIONS', 'pdf,doc,docx,xls,xlsx,ppt,pptx,txt,rtf,odt,ods,odp,csv,jpg,jpeg,png,gif,bmp,svg,zip,rar,7z,tar,gz')
        self.allowed_extensions = set(allowed.lower().split(','))

        # For compatibility with existing code
        self.bucket = "nextcloud"

        # S3 fallback for legacy files
        s3_endpoint = getattr(settings, 'DOCS_S3_ENDPOINT', None) or getattr(settings, 'S3_ENDPOINT', None)
        s3_access_key = getattr(settings, 'DOCS_S3_ACCESS_KEY', None) or getattr(settings, 'S3_ACCESS_KEY', None)
        s3_secret_key = getattr(settings, 'DOCS_S3_SECRET_KEY', None) or getattr(settings, 'S3_SECRET_KEY', None)
        s3_region = getattr(settings, 'DOCS_S3_REGION', None) or getattr(settings, 'S3_REGION', 'us-east-1')
        self.s3_bucket = getattr(settings, 'DOCS_S3_BUCKET', None) or getattr(settings, 'S3_BUCKET', 'bheem')

        if s3_endpoint and s3_access_key and s3_secret_key:
            self.s3_client = boto3.client(
                's3',
                endpoint_url=s3_endpoint,
                aws_access_key_id=s3_access_key,
                aws_secret_access_key=s3_secret_key,
                config=Config(signature_version='s3v4'),
                region_name=s3_region
            )
            logger.info(f"S3 fallback configured: {s3_endpoint}, bucket: {self.s3_bucket}")
        else:
            self.s3_client = None
            logger.warning("S3 fallback not configured - legacy files may not be accessible")

        logger.info(f"DocsStorageService initialized with Nextcloud at {self.nextcloud_url}")

    def _get_webdav_url(self, target_user: str = None) -> str:
        """
        Get WebDAV base URL for a target user's files.

        Args:
            target_user: The Nextcloud username whose files to access.
                        If None, uses admin user.

        Note: Admin credentials are used for auth, but path targets the user's folder.
        """
        user = target_user or self.admin_user
        return f"{self.nextcloud_url}/remote.php/dav/files/{user}"

    def _get_auth(self, username: str = None, password: str = None) -> Tuple[str, str]:
        """
        Get authentication credentials.
        Always use admin credentials for server-side operations.
        """
        return (username or self.admin_user, password or self.admin_pass)

    def get_nextcloud_username(self, user_email: str) -> str:
        """
        Convert user email to Nextcloud username.
        Nextcloud usernames are typically the email address.
        """
        return user_email.lower() if user_email else self.admin_user

    def get_storage_path(
        self,
        company_id: Optional[UUID] = None,
        tenant_id: Optional[UUID] = None,
        folder_path: str = ""
    ) -> str:
        """
        Generate Nextcloud storage path within user's folder.

        Structure (all paths are relative to user's Nextcloud home):
        - /BheemDocs/  - All Bheem documents go here
        - Files are organized by document, not by company (since each user has their own folder)
        """
        base = "/BheemDocs"
        folder_path = folder_path.strip('/') if folder_path else ""

        if folder_path:
            path = f"{base}/{folder_path}"
        else:
            path = base

        return path

    def validate_file(self, filename: str, file_size: int) -> Tuple[bool, str]:
        """Validate file before upload."""
        # Check file size
        if file_size > self.max_file_size:
            max_mb = self.max_file_size / (1024 * 1024)
            return False, f"File size exceeds maximum allowed ({max_mb}MB)"

        # Check extension
        ext = filename.rsplit('.', 1)[-1].lower() if '.' in filename else ''
        if ext and ext not in self.allowed_extensions:
            return False, f"File type .{ext} is not allowed"

        return True, ""

    async def ensure_folder_exists(
        self,
        path: str,
        username: str = None,
        password: str = None,
        target_user: str = None
    ) -> bool:
        """Create folder hierarchy if it doesn't exist"""
        auth = self._get_auth(username, password)
        webdav_url = self._get_webdav_url(target_user)

        # Split path and create each level
        parts = path.strip('/').split('/')
        current_path = ""

        async with httpx.AsyncClient(verify=False, timeout=30.0) as client:
            for part in parts:
                current_path = f"{current_path}/{part}"
                folder_url = f"{webdav_url}{current_path}"

                # Check if exists first
                try:
                    response = await client.request(
                        method="PROPFIND",
                        url=folder_url,
                        auth=auth,
                        headers={"Depth": "0"}
                    )
                    if response.status_code == 207:
                        continue  # Already exists
                except:
                    pass

                # Create folder
                try:
                    response = await client.request(
                        method="MKCOL",
                        url=folder_url,
                        auth=auth
                    )
                    if response.status_code in [201, 204]:
                        logger.info(f"Created folder: {current_path}")
                    elif response.status_code != 405:  # 405 = already exists
                        logger.warning(f"Failed to create folder {current_path}: {response.status_code}")
                except Exception as e:
                    logger.warning(f"Error creating folder {current_path}: {e}")

        return True

    async def upload_file(
        self,
        file: BinaryIO,
        filename: str,
        company_id: Optional[UUID] = None,
        tenant_id: Optional[UUID] = None,
        folder_path: str = "",
        content_type: Optional[str] = None,
        metadata: Optional[Dict[str, str]] = None,
        username: str = None,
        password: str = None,
        nextcloud_user: str = None
    ) -> Dict[str, Any]:
        """
        Upload file to Nextcloud via WebDAV.

        Args:
            file: File-like object to upload
            filename: Original filename
            company_id: ERP company ID (for internal mode)
            tenant_id: SaaS tenant ID (for external mode)
            folder_path: Path within storage
            content_type: MIME type
            metadata: Additional metadata
            username: Auth username (defaults to admin)
            password: Auth password (defaults to admin)
            nextcloud_user: Target user's Nextcloud folder (e.g., user's email)

        Returns:
            Dict with storage details
        """
        # Read file content
        file_content = file.read() if hasattr(file, 'read') else file
        if isinstance(file_content, str):
            file_content = file_content.encode('utf-8')

        file_size = len(file_content)

        # Validate
        is_valid, error = self.validate_file(filename, file_size)
        if not is_valid:
            raise ValueError(error)

        # Generate storage path
        storage_prefix = self.get_storage_path(company_id, tenant_id, folder_path)
        storage_path = f"{storage_prefix}/{filename}"

        # Auto-detect content type
        if not content_type:
            content_type, _ = mimetypes.guess_type(filename)
            content_type = content_type or "application/octet-stream"

        # Calculate checksum
        checksum = hashlib.sha256(file_content).hexdigest()

        # Ensure folder exists in the target user's folder
        target_user = nextcloud_user or self.admin_user
        await self.ensure_folder_exists(storage_prefix, username, password, target_user)

        # Upload to Nextcloud (target user's folder, admin auth)
        auth = self._get_auth(username, password)
        webdav_url = f"{self._get_webdav_url(target_user)}{storage_path}"

        try:
            async with httpx.AsyncClient(verify=False, timeout=120.0) as client:
                headers = {"Content-Type": content_type} if content_type else {}

                response = await client.put(
                    url=webdav_url,
                    content=file_content,
                    auth=auth,
                    headers=headers
                )

                if response.status_code not in [201, 204]:
                    raise Exception(f"Upload failed with status {response.status_code}: {response.text}")

            logger.info(f"Uploaded file to Nextcloud: {target_user}:{storage_path} ({file_size} bytes)")

            return {
                'storage_path': storage_path,
                'storage_bucket': 'nextcloud',
                'checksum': checksum,
                'file_size': file_size,
                'content_type': content_type,
                'nextcloud_user': target_user
            }
        except Exception as e:
            logger.error(f"Failed to upload to Nextcloud: {e}")
            raise

    async def download_file(
        self,
        storage_path: str,
        username: str = None,
        password: str = None,
        nextcloud_user: str = None
    ) -> Tuple[BinaryIO, Dict[str, Any]]:
        """
        Download file from Nextcloud.

        Args:
            storage_path: Path to file within user's folder
            username: Auth username (defaults to admin)
            password: Auth password (defaults to admin)
            nextcloud_user: Target user's Nextcloud folder

        Returns:
            Tuple of (file stream, metadata dict)
        """
        target_user = nextcloud_user or self.admin_user
        auth = self._get_auth(username, password)

        # Build list of paths to try (handle legacy S3-style paths)
        paths_to_try = [storage_path]
        if not storage_path.startswith('/'):
            # Legacy S3 path without leading slash - try with /Documents/ prefix
            paths_to_try.append(f"/Documents/{storage_path}")

        # Try user's folder first, then admin folder for backward compatibility
        users_to_try = [target_user]
        if target_user != self.admin_user:
            users_to_try.append(self.admin_user)

        last_error = None
        for user in users_to_try:
            for path in paths_to_try:
                webdav_url = f"{self._get_webdav_url(user)}{path}"

                try:
                    async with httpx.AsyncClient(verify=False, timeout=120.0) as client:
                        response = await client.get(
                            url=webdav_url,
                            auth=auth
                        )

                        if response.status_code == 200:
                            content = response.content
                            metadata = {
                                'content_type': response.headers.get('content-type'),
                                'content_length': len(content),
                                'last_modified': response.headers.get('last-modified'),
                                'metadata': {}
                            }
                            logger.info(f"Downloaded file from {user}'s folder: {path}")
                            return io.BytesIO(content), metadata
                        elif response.status_code == 404:
                            logger.debug(f"File not found at {webdav_url}, trying next...")
                            last_error = FileNotFoundError(f"File not found: {storage_path}")
                            continue
                        else:
                            last_error = Exception(f"Download failed with status {response.status_code}")
                            continue
                except Exception as e:
                    last_error = e
                    continue

        # Try S3 fallback for legacy files
        if self.s3_client:
            # Try original path and without leading slash
            s3_paths = [storage_path.lstrip('/'), storage_path]
            for s3_path in s3_paths:
                try:
                    logger.info(f"Trying S3 fallback: {self.s3_bucket}/{s3_path}")
                    response = self.s3_client.get_object(
                        Bucket=self.s3_bucket,
                        Key=s3_path
                    )
                    content = response['Body'].read()
                    metadata = {
                        'content_type': response.get('ContentType', 'application/octet-stream'),
                        'content_length': len(content),
                        'last_modified': str(response.get('LastModified', '')),
                        'metadata': response.get('Metadata', {})
                    }
                    logger.info(f"Downloaded file from S3 fallback: {s3_path}")
                    return io.BytesIO(content), metadata
                except self.s3_client.exceptions.NoSuchKey:
                    logger.debug(f"File not found in S3: {s3_path}")
                    continue
                except Exception as e:
                    logger.debug(f"S3 fallback error: {e}")
                    continue

        # If we get here, file wasn't found in any location
        logger.error(f"Failed to download from Nextcloud and S3: {storage_path}")
        raise FileNotFoundError(f"File not found: {storage_path}")

    async def delete_file(
        self,
        storage_path: str,
        username: str = None,
        password: str = None
    ) -> bool:
        """Delete file from Nextcloud."""
        auth = self._get_auth(username, password)
        webdav_url = f"{self._get_webdav_url(username)}{storage_path}"

        try:
            async with httpx.AsyncClient(verify=False, timeout=30.0) as client:
                response = await client.delete(
                    url=webdav_url,
                    auth=auth
                )

                if response.status_code in [204, 200, 404]:
                    logger.info(f"Deleted file: {storage_path}")
                    return True
                else:
                    logger.warning(f"Delete failed for {storage_path}: {response.status_code}")
                    return False
        except Exception as e:
            logger.error(f"Delete failed for {storage_path}: {e}")
            raise

    async def copy_file(
        self,
        source_path: str,
        dest_path: str,
        username: str = None,
        password: str = None
    ) -> Dict[str, Any]:
        """Copy a file within Nextcloud."""
        auth = self._get_auth(username, password)
        source_url = f"{self._get_webdav_url(username)}{source_path}"
        dest_url = f"{self._get_webdav_url(username)}{dest_path}"

        # Ensure destination folder exists
        dest_folder = '/'.join(dest_path.split('/')[:-1])
        await self.ensure_folder_exists(dest_folder, username, password)

        try:
            async with httpx.AsyncClient(verify=False, timeout=60.0) as client:
                response = await client.request(
                    method="COPY",
                    url=source_url,
                    auth=auth,
                    headers={"Destination": dest_url}
                )

                if response.status_code in [201, 204]:
                    logger.info(f"Copied file: {source_path} -> {dest_path}")
                    return {'storage_path': dest_path}
                else:
                    raise Exception(f"Copy failed with status {response.status_code}")
        except Exception as e:
            logger.error(f"Copy failed: {e}")
            raise

    async def move_file(
        self,
        source_path: str,
        dest_path: str,
        username: str = None,
        password: str = None
    ) -> Dict[str, Any]:
        """Move/rename a file within Nextcloud."""
        auth = self._get_auth(username, password)
        source_url = f"{self._get_webdav_url(username)}{source_path}"
        dest_url = f"{self._get_webdav_url(username)}{dest_path}"

        # Ensure destination folder exists
        dest_folder = '/'.join(dest_path.split('/')[:-1])
        await self.ensure_folder_exists(dest_folder, username, password)

        try:
            async with httpx.AsyncClient(verify=False, timeout=60.0) as client:
                response = await client.request(
                    method="MOVE",
                    url=source_url,
                    auth=auth,
                    headers={"Destination": dest_url}
                )

                if response.status_code in [201, 204]:
                    logger.info(f"Moved file: {source_path} -> {dest_path}")
                    return {'storage_path': dest_path}
                else:
                    raise Exception(f"Move failed with status {response.status_code}")
        except Exception as e:
            logger.error(f"Move failed: {e}")
            raise

    async def file_exists(
        self,
        storage_path: str,
        username: str = None,
        password: str = None
    ) -> bool:
        """Check if file exists in Nextcloud."""
        auth = self._get_auth(username, password)
        webdav_url = f"{self._get_webdav_url(username)}{storage_path}"

        try:
            async with httpx.AsyncClient(verify=False, timeout=15.0) as client:
                response = await client.request(
                    method="PROPFIND",
                    url=webdav_url,
                    auth=auth,
                    headers={"Depth": "0"}
                )
                return response.status_code == 207
        except:
            return False

    async def get_file_info(
        self,
        storage_path: str,
        username: str = None,
        password: str = None
    ) -> Optional[Dict[str, Any]]:
        """Get file metadata without downloading."""
        auth = self._get_auth(username, password)
        webdav_url = f"{self._get_webdav_url(username)}{storage_path}"

        propfind_body = '''<?xml version="1.0"?>
        <d:propfind xmlns:d="DAV:" xmlns:oc="http://owncloud.org/ns">
            <d:prop>
                <d:getlastmodified/>
                <d:getcontentlength/>
                <d:getcontenttype/>
                <oc:fileid/>
            </d:prop>
        </d:propfind>'''

        try:
            async with httpx.AsyncClient(verify=False, timeout=15.0) as client:
                response = await client.request(
                    method="PROPFIND",
                    url=webdav_url,
                    auth=auth,
                    content=propfind_body,
                    headers={"Depth": "0", "Content-Type": "application/xml"}
                )

                if response.status_code == 207:
                    root = ET.fromstring(response.content)
                    ns = {"d": "DAV:", "oc": "http://owncloud.org/ns"}

                    props = root.find(".//d:prop", ns)
                    if props is not None:
                        size_elem = props.find("d:getcontentlength", ns)
                        type_elem = props.find("d:getcontenttype", ns)
                        modified_elem = props.find("d:getlastmodified", ns)

                        return {
                            'content_length': int(size_elem.text) if size_elem is not None and size_elem.text else 0,
                            'content_type': type_elem.text if type_elem is not None else None,
                            'last_modified': modified_elem.text if modified_elem is not None else None,
                            'metadata': {}
                        }
                return None
        except Exception as e:
            logger.error(f"Get file info failed: {e}")
            return None

    async def list_files(
        self,
        company_id: Optional[UUID] = None,
        tenant_id: Optional[UUID] = None,
        folder_path: str = "",
        max_keys: int = 1000,
        username: str = None,
        password: str = None
    ) -> List[Dict[str, Any]]:
        """List files in a Nextcloud folder."""
        storage_path = self.get_storage_path(company_id, tenant_id, folder_path)
        auth = self._get_auth(username, password)
        webdav_url = f"{self._get_webdav_url(username)}{storage_path}"

        propfind_body = '''<?xml version="1.0"?>
        <d:propfind xmlns:d="DAV:" xmlns:oc="http://owncloud.org/ns">
            <d:prop>
                <d:getlastmodified/>
                <d:getcontentlength/>
                <d:getcontenttype/>
                <d:resourcetype/>
                <oc:fileid/>
                <d:displayname/>
            </d:prop>
        </d:propfind>'''

        try:
            async with httpx.AsyncClient(verify=False, timeout=30.0) as client:
                response = await client.request(
                    method="PROPFIND",
                    url=webdav_url,
                    auth=auth,
                    content=propfind_body,
                    headers={"Depth": "1", "Content-Type": "application/xml"}
                )

                if response.status_code != 207:
                    return []

                root = ET.fromstring(response.content)
                ns = {"d": "DAV:", "oc": "http://owncloud.org/ns"}

                files = []
                for resp_elem in root.findall(".//d:response", ns):
                    href = resp_elem.find("d:href", ns).text
                    props = resp_elem.find(".//d:prop", ns)

                    # Skip root folder
                    if href.rstrip("/").endswith(storage_path.rstrip("/")):
                        continue

                    is_folder = props.find(".//d:resourcetype/d:collection", ns) is not None
                    name = href.rstrip("/").split("/")[-1]

                    if not name:
                        continue

                    size_elem = props.find("d:getcontentlength", ns)
                    modified_elem = props.find("d:getlastmodified", ns)

                    files.append({
                        'name': name,
                        'type': 'folder' if is_folder else 'file',
                        'path': href,
                        'size': int(size_elem.text) if size_elem is not None and size_elem.text else 0,
                        'last_modified': modified_elem.text if modified_elem is not None else None
                    })

                return files[:max_keys]
        except Exception as e:
            logger.error(f"List files failed: {e}")
            return []

    async def get_storage_usage(
        self,
        company_id: Optional[UUID] = None,
        tenant_id: Optional[UUID] = None
    ) -> Dict[str, Any]:
        """Calculate storage usage for a company/tenant."""
        files = await self.list_files(company_id, tenant_id)

        total_size = sum(f.get('size', 0) for f in files if f.get('type') == 'file')
        object_count = len([f for f in files if f.get('type') == 'file'])

        return {
            'used_bytes': total_size,
            'used_mb': round(total_size / (1024 * 1024), 2),
            'used_gb': round(total_size / (1024 * 1024 * 1024), 4),
            'object_count': object_count,
            'prefix': self.get_storage_path(company_id, tenant_id)
        }

    async def generate_presigned_url(
        self,
        storage_path: str,
        expires_in: int = 3600,
        operation: str = 'get_object',
        content_type: Optional[str] = None
    ) -> str:
        """
        Generate a download URL for a file.
        For Nextcloud, we create a share link.
        """
        # Create a temporary share link
        auth = self._get_auth()
        ocs_url = f"{self.nextcloud_url}/ocs/v2.php/apps/files_sharing/api/v1/shares"

        try:
            async with httpx.AsyncClient(verify=False, timeout=30.0) as client:
                response = await client.post(
                    url=ocs_url,
                    auth=auth,
                    headers={"OCS-APIREQUEST": "true"},
                    data={
                        "path": storage_path,
                        "shareType": 3,  # Public link
                        "permissions": 1  # Read only
                    }
                )

                if response.status_code == 200:
                    root = ET.fromstring(response.content)
                    url_elem = root.find(".//url")
                    if url_elem is not None:
                        return f"{url_elem.text}/download"
        except Exception as e:
            logger.warning(f"Failed to create share link: {e}")

        # Fallback: return direct WebDAV URL (requires auth)
        return f"{self._get_webdav_url()}{storage_path}"

    async def generate_upload_url(
        self,
        filename: str,
        company_id: Optional[UUID] = None,
        tenant_id: Optional[UUID] = None,
        folder_path: str = "",
        content_type: Optional[str] = None,
        expires_in: int = 3600
    ) -> Dict[str, str]:
        """
        Generate upload info for Nextcloud.
        Note: Nextcloud doesn't support presigned upload URLs like S3.
        Returns WebDAV URL that requires authentication.
        """
        storage_prefix = self.get_storage_path(company_id, tenant_id, folder_path)
        storage_path = f"{storage_prefix}/{filename}"

        if not content_type:
            content_type, _ = mimetypes.guess_type(filename)
            content_type = content_type or "application/octet-stream"

        return {
            'upload_url': f"{self._get_webdav_url()}{storage_path}",
            'storage_path': storage_path,
            'content_type': content_type,
            'method': 'PUT',
            'requires_auth': True
        }


# Singleton instance
_storage_service: Optional[DocsStorageService] = None


def get_docs_storage_service() -> DocsStorageService:
    """Get or create storage service instance."""
    global _storage_service
    if _storage_service is None:
        _storage_service = DocsStorageService()
    return _storage_service
