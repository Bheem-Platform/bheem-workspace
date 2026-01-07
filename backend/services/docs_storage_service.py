"""
Bheem Docs - Unified Storage Service
=====================================
Handles file storage for both internal (ERP) and external (SaaS) users.
Supports S3-compatible storage (existing Bheem infrastructure).

Storage Structure:
- internal/{company_id}/...  - ERP company documents
- external/{tenant_id}/...   - SaaS tenant documents
- shared/templates/...       - Global templates

Configuration:
- Uses existing S3 credentials from config
- Bucket: bheem-docs (or bheem for shared storage)
"""

import boto3
from botocore.config import Config
from botocore.exceptions import ClientError
from typing import Optional, BinaryIO, List, Dict, Any, Tuple
from uuid import UUID
import hashlib
from datetime import datetime, timedelta
import mimetypes
import logging
import io

from core.config import settings

logger = logging.getLogger(__name__)


class DocsStorageService:
    """
    Unified storage service using S3-compatible backend.

    Supports:
    - File upload with chunking for large files
    - Presigned URLs for direct browser upload/download
    - Storage usage calculation
    - File metadata extraction
    """

    def __init__(self):
        # Use Docs-specific S3 config or fall back to main S3 config
        endpoint = settings.DOCS_S3_ENDPOINT or settings.S3_ENDPOINT
        access_key = settings.DOCS_S3_ACCESS_KEY or settings.S3_ACCESS_KEY
        secret_key = settings.DOCS_S3_SECRET_KEY or settings.S3_SECRET_KEY
        region = settings.DOCS_S3_REGION or settings.S3_REGION

        self.s3_client = boto3.client(
            's3',
            endpoint_url=endpoint,
            aws_access_key_id=access_key,
            aws_secret_access_key=secret_key,
            config=Config(signature_version='s3v4'),
            region_name=region
        )

        # Primary bucket for docs
        self.bucket = settings.DOCS_S3_BUCKET or settings.S3_BUCKET

        # Ensure bucket exists
        self._ensure_bucket_exists()

        # Max file size from config
        self.max_file_size = settings.DOCS_MAX_FILE_SIZE_BYTES

        # Allowed extensions
        self.allowed_extensions = set(
            settings.DOCS_ALLOWED_EXTENSIONS.lower().split(',')
        )

    def _ensure_bucket_exists(self):
        """Create bucket if it doesn't exist"""
        try:
            self.s3_client.head_bucket(Bucket=self.bucket)
        except ClientError as e:
            error_code = e.response.get('Error', {}).get('Code')
            if error_code == '404':
                try:
                    self.s3_client.create_bucket(Bucket=self.bucket)
                    logger.info(f"Created bucket: {self.bucket}")
                except Exception as create_error:
                    logger.warning(f"Could not create bucket: {create_error}")
            else:
                logger.warning(f"Bucket check failed: {e}")

    def get_storage_path(
        self,
        company_id: Optional[UUID] = None,
        tenant_id: Optional[UUID] = None,
        folder_path: str = ""
    ) -> str:
        """
        Generate storage path based on internal/external mode.

        Args:
            company_id: ERP company ID (internal mode)
            tenant_id: SaaS tenant ID (external mode)
            folder_path: Additional path within storage

        Returns:
            Full storage path prefix
        """
        # Normalize folder path
        folder_path = folder_path.strip('/')

        if company_id:
            # Internal mode - ERP company storage
            base = f"internal/{company_id}"
        elif tenant_id:
            # External mode - SaaS tenant storage
            base = f"external/{tenant_id}"
        else:
            raise ValueError("Either company_id or tenant_id is required")

        if folder_path:
            return f"{base}/{folder_path}"
        return base

    def validate_file(self, filename: str, file_size: int) -> Tuple[bool, str]:
        """
        Validate file before upload.

        Returns:
            Tuple of (is_valid, error_message)
        """
        # Check file size
        if file_size > self.max_file_size:
            max_mb = self.max_file_size / (1024 * 1024)
            return False, f"File too large. Maximum size is {max_mb}MB"

        # Check extension
        ext = filename.rsplit('.', 1)[-1].lower() if '.' in filename else ''
        if ext and ext not in self.allowed_extensions:
            return False, f"File type '.{ext}' is not allowed"

        return True, ""

    async def upload_file(
        self,
        file: BinaryIO,
        filename: str,
        company_id: Optional[UUID] = None,
        tenant_id: Optional[UUID] = None,
        folder_path: str = "",
        content_type: Optional[str] = None,
        metadata: Optional[Dict[str, str]] = None
    ) -> Dict[str, Any]:
        """
        Upload file to storage.

        Args:
            file: File-like object to upload
            filename: Original filename
            company_id: ERP company ID (for internal mode)
            tenant_id: SaaS tenant ID (for external mode)
            folder_path: Path within storage
            content_type: MIME type (auto-detected if not provided)
            metadata: Additional metadata to store

        Returns:
            Dict with storage details
        """
        # Read file content
        file_content = file.read()
        file_size = len(file_content)
        file.seek(0)

        # Validate
        is_valid, error = self.validate_file(filename, file_size)
        if not is_valid:
            raise ValueError(error)

        # Generate storage path
        storage_prefix = self.get_storage_path(company_id, tenant_id, folder_path)
        key = f"{storage_prefix}/{filename}"

        # Auto-detect content type
        if not content_type:
            content_type, _ = mimetypes.guess_type(filename)
            content_type = content_type or "application/octet-stream"

        # Calculate checksum
        checksum = hashlib.sha256(file_content).hexdigest()

        # Prepare metadata
        upload_metadata = {
            'checksum': checksum,
            'uploaded_at': datetime.utcnow().isoformat(),
            'original_filename': filename
        }
        if metadata:
            upload_metadata.update(metadata)

        # Upload to S3
        try:
            self.s3_client.upload_fileobj(
                io.BytesIO(file_content),
                self.bucket,
                key,
                ExtraArgs={
                    'ContentType': content_type,
                    'Metadata': upload_metadata
                }
            )

            logger.info(f"Uploaded file: {key} ({file_size} bytes)")

            return {
                'storage_path': key,
                'storage_bucket': self.bucket,
                'checksum': checksum,
                'file_size': file_size,
                'content_type': content_type
            }

        except Exception as e:
            logger.error(f"Upload failed for {key}: {e}")
            raise

    async def download_file(self, storage_path: str) -> Tuple[BinaryIO, Dict[str, Any]]:
        """
        Download file from storage.

        Returns:
            Tuple of (file_content, metadata)
        """
        try:
            response = self.s3_client.get_object(
                Bucket=self.bucket,
                Key=storage_path
            )

            metadata = {
                'content_type': response.get('ContentType'),
                'content_length': response.get('ContentLength'),
                'last_modified': response.get('LastModified'),
                'metadata': response.get('Metadata', {})
            }

            return response['Body'], metadata

        except ClientError as e:
            if e.response['Error']['Code'] == 'NoSuchKey':
                raise FileNotFoundError(f"File not found: {storage_path}")
            raise

    async def delete_file(self, storage_path: str) -> bool:
        """Delete file from storage."""
        try:
            self.s3_client.delete_object(
                Bucket=self.bucket,
                Key=storage_path
            )
            logger.info(f"Deleted file: {storage_path}")
            return True
        except Exception as e:
            logger.error(f"Delete failed for {storage_path}: {e}")
            raise

    async def copy_file(
        self,
        source_path: str,
        dest_path: str
    ) -> Dict[str, Any]:
        """Copy file within storage."""
        try:
            self.s3_client.copy_object(
                Bucket=self.bucket,
                CopySource={'Bucket': self.bucket, 'Key': source_path},
                Key=dest_path
            )
            logger.info(f"Copied file: {source_path} -> {dest_path}")
            return {'storage_path': dest_path}
        except Exception as e:
            logger.error(f"Copy failed: {e}")
            raise

    async def move_file(
        self,
        source_path: str,
        dest_path: str
    ) -> Dict[str, Any]:
        """Move file (copy + delete source)."""
        result = await self.copy_file(source_path, dest_path)
        await self.delete_file(source_path)
        return result

    async def generate_presigned_url(
        self,
        storage_path: str,
        expires_in: int = 3600,
        operation: str = 'get_object',
        content_type: Optional[str] = None
    ) -> str:
        """
        Generate presigned URL for direct browser access.

        Args:
            storage_path: Path to file in storage
            expires_in: URL expiration in seconds (default 1 hour)
            operation: 'get_object' for download, 'put_object' for upload
            content_type: Required for put_object

        Returns:
            Presigned URL
        """
        params = {
            'Bucket': self.bucket,
            'Key': storage_path
        }

        if operation == 'put_object' and content_type:
            params['ContentType'] = content_type

        try:
            url = self.s3_client.generate_presigned_url(
                operation,
                Params=params,
                ExpiresIn=expires_in
            )
            return url
        except Exception as e:
            logger.error(f"Failed to generate presigned URL: {e}")
            raise

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
        Generate presigned URL for direct browser upload.

        Returns:
            Dict with upload_url and storage_path
        """
        # Generate storage path
        storage_prefix = self.get_storage_path(company_id, tenant_id, folder_path)
        key = f"{storage_prefix}/{filename}"

        # Auto-detect content type
        if not content_type:
            content_type, _ = mimetypes.guess_type(filename)
            content_type = content_type or "application/octet-stream"

        url = await self.generate_presigned_url(
            storage_path=key,
            expires_in=expires_in,
            operation='put_object',
            content_type=content_type
        )

        return {
            'upload_url': url,
            'storage_path': key,
            'content_type': content_type
        }

    async def get_storage_usage(
        self,
        company_id: Optional[UUID] = None,
        tenant_id: Optional[UUID] = None
    ) -> Dict[str, Any]:
        """
        Calculate storage usage for company/tenant.

        Returns:
            Dict with used_bytes, object_count
        """
        prefix = self.get_storage_path(company_id, tenant_id, "")

        total_size = 0
        total_objects = 0

        try:
            paginator = self.s3_client.get_paginator('list_objects_v2')
            for page in paginator.paginate(Bucket=self.bucket, Prefix=prefix):
                for obj in page.get('Contents', []):
                    total_size += obj['Size']
                    total_objects += 1

            return {
                'used_bytes': total_size,
                'used_mb': round(total_size / (1024 * 1024), 2),
                'used_gb': round(total_size / (1024 * 1024 * 1024), 2),
                'object_count': total_objects,
                'prefix': prefix
            }

        except Exception as e:
            logger.error(f"Failed to calculate storage usage: {e}")
            return {
                'used_bytes': 0,
                'object_count': 0,
                'error': str(e)
            }

    async def list_files(
        self,
        company_id: Optional[UUID] = None,
        tenant_id: Optional[UUID] = None,
        folder_path: str = "",
        max_keys: int = 1000
    ) -> List[Dict[str, Any]]:
        """
        List files in a folder.

        Returns:
            List of file metadata
        """
        prefix = self.get_storage_path(company_id, tenant_id, folder_path)
        if not prefix.endswith('/'):
            prefix += '/'

        files = []

        try:
            response = self.s3_client.list_objects_v2(
                Bucket=self.bucket,
                Prefix=prefix,
                Delimiter='/',
                MaxKeys=max_keys
            )

            # Folders (common prefixes)
            for prefix_obj in response.get('CommonPrefixes', []):
                folder_name = prefix_obj['Prefix'].rstrip('/').split('/')[-1]
                files.append({
                    'name': folder_name,
                    'type': 'folder',
                    'path': prefix_obj['Prefix']
                })

            # Files
            for obj in response.get('Contents', []):
                # Skip the folder itself
                if obj['Key'] == prefix:
                    continue

                filename = obj['Key'].split('/')[-1]
                files.append({
                    'name': filename,
                    'type': 'file',
                    'path': obj['Key'],
                    'size': obj['Size'],
                    'last_modified': obj['LastModified'].isoformat()
                })

            return files

        except Exception as e:
            logger.error(f"Failed to list files: {e}")
            return []

    async def file_exists(self, storage_path: str) -> bool:
        """Check if file exists in storage."""
        try:
            self.s3_client.head_object(Bucket=self.bucket, Key=storage_path)
            return True
        except ClientError:
            return False

    async def get_file_info(self, storage_path: str) -> Optional[Dict[str, Any]]:
        """Get file metadata without downloading."""
        try:
            response = self.s3_client.head_object(
                Bucket=self.bucket,
                Key=storage_path
            )
            return {
                'content_type': response.get('ContentType'),
                'content_length': response.get('ContentLength'),
                'last_modified': response.get('LastModified'),
                'etag': response.get('ETag'),
                'metadata': response.get('Metadata', {})
            }
        except ClientError:
            return None


# Singleton instance
_storage_service: Optional[DocsStorageService] = None


def get_docs_storage_service() -> DocsStorageService:
    """Get or create storage service instance."""
    global _storage_service
    if _storage_service is None:
        _storage_service = DocsStorageService()
    return _storage_service
