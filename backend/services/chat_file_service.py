"""
Bheem Workspace - Chat File Service
Handles file uploads for chat attachments (images, documents, etc.)
Uses S3-compatible object storage (MinIO/Hetzner)
"""

import os
import uuid
import mimetypes
from typing import Optional, Tuple, Dict, Any
from datetime import datetime
import io

try:
    from PIL import Image
    PIL_AVAILABLE = True
except ImportError:
    PIL_AVAILABLE = False

import boto3
from botocore.config import Config
from botocore.exceptions import ClientError

from core.config import settings


class ChatFileService:
    """
    Service for handling chat file attachments.

    Features:
    - Upload files to S3-compatible storage
    - Generate thumbnails for images
    - Support for various file types
    - Organized folder structure per conversation
    """

    # Allowed file types
    ALLOWED_IMAGE_TYPES = {'image/jpeg', 'image/png', 'image/gif', 'image/webp'}
    ALLOWED_AUDIO_TYPES = {
        'audio/webm', 'audio/mp4', 'audio/mpeg', 'audio/ogg',
        'audio/wav', 'audio/x-wav', 'audio/aac', 'audio/mp3',
    }
    ALLOWED_VIDEO_TYPES = {
        'video/mp4', 'video/webm', 'video/ogg', 'video/quicktime',
        'video/x-msvideo', 'video/mpeg',
    }
    ALLOWED_FILE_TYPES = {
        'application/pdf',
        'application/msword',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'application/vnd.ms-excel',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'application/vnd.ms-powerpoint',
        'application/vnd.openxmlformats-officedocument.presentationml.presentation',
        'text/plain',
        'text/csv',
        'application/zip',
        'application/x-rar-compressed',
        'application/octet-stream',  # Allow generic binary files
    }

    # Size limits
    MAX_FILE_SIZE = 50 * 1024 * 1024  # 50MB
    MAX_IMAGE_SIZE = 10 * 1024 * 1024  # 10MB for images
    THUMBNAIL_SIZE = (300, 300)

    def __init__(self):
        """Initialize S3 client."""
        self.s3_client = boto3.client(
            's3',
            endpoint_url=settings.S3_ENDPOINT,
            aws_access_key_id=settings.S3_ACCESS_KEY,
            aws_secret_access_key=settings.S3_SECRET_KEY,
            config=Config(signature_version='s3v4'),
            region_name=settings.S3_REGION,
        )
        self.bucket = settings.S3_BUCKET
        self.base_url = f"{settings.S3_ENDPOINT}/{settings.S3_BUCKET}"

    def _get_file_path(
        self,
        conversation_id: str,
        file_name: str,
        is_thumbnail: bool = False
    ) -> str:
        """
        Generate S3 file path.

        Structure: chat/{conversation_id}/{unique_name}
        Thumbnails: chat/{conversation_id}/thumbs/{unique_name}
        """
        file_ext = os.path.splitext(file_name)[1].lower()
        unique_name = f"{uuid.uuid4()}{file_ext}"

        if is_thumbnail:
            return f"chat/{conversation_id}/thumbs/{unique_name}"
        return f"chat/{conversation_id}/{unique_name}"

    def _get_public_url(self, file_path: str) -> str:
        """Get public URL for a file."""
        return f"{self.base_url}/{file_path}"

    async def upload_chat_attachment(
        self,
        file_content: bytes,
        file_name: str,
        content_type: str,
        conversation_id: str,
        user_id: str,
    ) -> Dict[str, Any]:
        """
        Upload a file attachment for chat.

        Args:
            file_content: File bytes
            file_name: Original file name
            content_type: MIME type
            conversation_id: Conversation UUID
            user_id: Uploader's user ID

        Returns:
            Dict with:
                - file_name: Original name
                - file_type: MIME type
                - file_size: Size in bytes
                - file_url: Public URL
                - thumbnail_url: Thumbnail URL (for images)
                - width: Image width (for images)
                - height: Image height (for images)

        Raises:
            ValueError: If file type not allowed or file too large
        """
        file_size = len(file_content)

        # Validate file size
        if content_type in self.ALLOWED_IMAGE_TYPES:
            if file_size > self.MAX_IMAGE_SIZE:
                raise ValueError(f"Image too large (max {self.MAX_IMAGE_SIZE // 1024 // 1024}MB)")
        else:
            if file_size > self.MAX_FILE_SIZE:
                raise ValueError(f"File too large (max {self.MAX_FILE_SIZE // 1024 // 1024}MB)")

        # Validate file type
        all_allowed = (
            self.ALLOWED_IMAGE_TYPES |
            self.ALLOWED_AUDIO_TYPES |
            self.ALLOWED_VIDEO_TYPES |
            self.ALLOWED_FILE_TYPES
        )
        if content_type not in all_allowed:
            # Allow common types that might have different MIME types
            if not (content_type.startswith('image/') or
                    content_type.startswith('audio/') or
                    content_type.startswith('video/') or
                    self._is_allowed_extension(file_name)):
                raise ValueError(f"File type not allowed: {content_type}")

        # Generate file path
        file_path = self._get_file_path(conversation_id, file_name)

        # Upload main file
        try:
            self.s3_client.put_object(
                Bucket=self.bucket,
                Key=file_path,
                Body=file_content,
                ContentType=content_type,
                ACL='public-read',  # Make publicly accessible
            )
        except ClientError as e:
            raise ValueError(f"Failed to upload file: {str(e)}")

        file_url = self._get_public_url(file_path)

        result = {
            'file_name': file_name,
            'file_type': content_type,
            'file_size': file_size,
            'file_url': file_url,
            'thumbnail_url': None,
            'width': None,
            'height': None,
        }

        # Process images
        if content_type in self.ALLOWED_IMAGE_TYPES or content_type.startswith('image/'):
            thumbnail_result = await self._process_image(
                file_content=file_content,
                conversation_id=conversation_id,
                file_name=file_name,
                content_type=content_type,
            )
            if thumbnail_result:
                result['thumbnail_url'] = thumbnail_result.get('thumbnail_url')
                result['width'] = thumbnail_result.get('width')
                result['height'] = thumbnail_result.get('height')

        return result

    async def _process_image(
        self,
        file_content: bytes,
        conversation_id: str,
        file_name: str,
        content_type: str,
    ) -> Optional[Dict[str, Any]]:
        """
        Process image: get dimensions and generate thumbnail.

        Args:
            file_content: Image bytes
            conversation_id: Conversation UUID
            file_name: Original file name
            content_type: MIME type

        Returns:
            Dict with thumbnail_url, width, height or None if failed
        """
        if not PIL_AVAILABLE:
            return None

        try:
            # Open image
            image = Image.open(io.BytesIO(file_content))
            width, height = image.size

            # Convert RGBA to RGB for JPEG
            if image.mode in ('RGBA', 'LA', 'P'):
                background = Image.new('RGB', image.size, (255, 255, 255))
                if image.mode == 'P':
                    image = image.convert('RGBA')
                background.paste(image, mask=image.split()[-1] if image.mode == 'RGBA' else None)
                image = background

            # Generate thumbnail
            image.thumbnail(self.THUMBNAIL_SIZE, Image.Resampling.LANCZOS)

            # Save thumbnail to bytes
            thumb_buffer = io.BytesIO()
            image_format = 'JPEG'
            image.save(thumb_buffer, format=image_format, quality=85)
            thumb_buffer.seek(0)

            # Upload thumbnail
            thumb_path = self._get_file_path(conversation_id, file_name, is_thumbnail=True)

            self.s3_client.put_object(
                Bucket=self.bucket,
                Key=thumb_path,
                Body=thumb_buffer.getvalue(),
                ContentType='image/jpeg',
                ACL='public-read',
            )

            thumbnail_url = self._get_public_url(thumb_path)

            return {
                'thumbnail_url': thumbnail_url,
                'width': width,
                'height': height,
            }

        except Exception as e:
            print(f"Failed to process image: {e}")
            return None

    def _is_allowed_extension(self, file_name: str) -> bool:
        """Check if file extension is allowed."""
        allowed_extensions = {
            '.jpg', '.jpeg', '.png', '.gif', '.webp',  # Images
            '.pdf',  # Documents
            '.doc', '.docx',  # Word
            '.xls', '.xlsx',  # Excel
            '.ppt', '.pptx',  # PowerPoint
            '.txt', '.csv',  # Text
            '.zip', '.rar',  # Archives
            '.mp3', '.wav', '.ogg', '.m4a', '.aac', '.webm',  # Audio
            '.mp4', '.mov', '.avi', '.mkv',  # Video
        }
        ext = os.path.splitext(file_name)[1].lower()
        return ext in allowed_extensions

    async def delete_attachment(
        self,
        file_url: str,
        thumbnail_url: str = None,
    ) -> bool:
        """
        Delete an attachment and its thumbnail.

        Args:
            file_url: Main file URL
            thumbnail_url: Optional thumbnail URL

        Returns:
            True if deleted successfully
        """
        try:
            # Extract key from URL
            file_key = file_url.replace(f"{self.base_url}/", "")
            self.s3_client.delete_object(Bucket=self.bucket, Key=file_key)

            # Delete thumbnail if exists
            if thumbnail_url:
                thumb_key = thumbnail_url.replace(f"{self.base_url}/", "")
                self.s3_client.delete_object(Bucket=self.bucket, Key=thumb_key)

            return True
        except ClientError as e:
            print(f"Failed to delete attachment: {e}")
            return False

    async def get_presigned_upload_url(
        self,
        conversation_id: str,
        file_name: str,
        content_type: str,
        expires_in: int = 3600,
    ) -> Dict[str, str]:
        """
        Generate a presigned URL for direct client upload.
        Useful for large files to avoid server memory issues.

        Args:
            conversation_id: Conversation UUID
            file_name: File name
            content_type: MIME type
            expires_in: URL validity in seconds

        Returns:
            Dict with upload_url and file_url
        """
        file_path = self._get_file_path(conversation_id, file_name)

        try:
            upload_url = self.s3_client.generate_presigned_url(
                'put_object',
                Params={
                    'Bucket': self.bucket,
                    'Key': file_path,
                    'ContentType': content_type,
                },
                ExpiresIn=expires_in,
            )

            return {
                'upload_url': upload_url,
                'file_url': self._get_public_url(file_path),
                'file_path': file_path,
            }
        except ClientError as e:
            raise ValueError(f"Failed to generate upload URL: {str(e)}")


# Singleton instance
chat_file_service = ChatFileService()
