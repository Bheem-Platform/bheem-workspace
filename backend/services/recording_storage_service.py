"""
Bheem Meet - Recording Storage Service
Saves recordings to Bheem Workspace (Nextcloud) and manages storage
"""
import os
import aiofiles
from typing import Optional, Dict, Any, List
from datetime import datetime
from services.nextcloud_service import nextcloud_service
from core.config import settings


class RecordingStorageService:
    """
    Service for storing and managing meeting recordings.

    Storage locations:
    - Primary: Nextcloud (Bheem Workspace Docs)
    - Fallback: Local filesystem

    Features:
    - Async file operations
    - Automatic folder structure
    - Quota management
    - Access URL generation
    """

    def __init__(self):
        self.recordings_folder = "/Bheem Meet Recordings"
        self.temp_dir = "/tmp/recordings"
        self.local_storage = getattr(settings, 'LOCAL_RECORDING_STORAGE', '/tmp/bheem/recordings')

        # Ensure directories exist
        try:
            os.makedirs(self.temp_dir, exist_ok=True)
            os.makedirs(self.local_storage, exist_ok=True)
        except PermissionError:
            # Use temp directory if default is not writable
            self.local_storage = "/tmp/bheem/recordings"
            os.makedirs(self.local_storage, exist_ok=True)

    async def save_recording(
        self,
        recording_id: str,
        room_code: str,
        local_file_path: str,
        user_id: str,
        username: str,
        options: Dict[str, Any] = None
    ) -> Dict[str, Any]:
        """
        Save recording to Bheem Workspace (Nextcloud).

        Args:
            recording_id: Internal recording ID
            room_code: Meeting room code
            local_file_path: Path to local recording file
            user_id: User ID who made the recording
            username: Username for Nextcloud
            options: Additional options:
                - folder_path: Custom folder path
                - filename: Custom filename

        Returns:
            Dict with storage info
        """
        options = options or {}

        try:
            # Verify local file exists
            if not os.path.exists(local_file_path):
                return {
                    "success": False,
                    "error": f"Recording file not found: {local_file_path}"
                }

            # Get file info
            file_size = os.path.getsize(local_file_path)
            timestamp = datetime.utcnow().strftime("%Y%m%d_%H%M%S")

            # Build storage path
            folder_path = options.get("folder_path") or f"{self.recordings_folder}/{room_code}"
            filename = options.get("filename") or f"recording_{timestamp}.mp4"
            full_path = f"{folder_path}/{filename}"

            # Read file content
            async with aiofiles.open(local_file_path, 'rb') as f:
                content = await f.read()

            # Create folder structure in Nextcloud
            await self._ensure_folder_exists(username, folder_path)

            # Upload to Nextcloud
            upload_success = await nextcloud_service.upload_file(
                username=username,
                password="",  # Uses admin/service account
                path=full_path,
                content=content
            )

            if upload_success:
                # Generate shareable URL
                share_url = await self._create_share_link(username, full_path)

                # Clean up local file
                await self._cleanup_local_file(local_file_path)

                return {
                    "success": True,
                    "storage_type": "nextcloud",
                    "storage_path": full_path,
                    "file_size_bytes": file_size,
                    "filename": filename,
                    "share_url": share_url,
                    "uploaded_at": datetime.utcnow().isoformat()
                }
            else:
                # Fall back to local storage
                return await self._save_to_local_storage(
                    recording_id, room_code, local_file_path, file_size
                )

        except Exception as e:
            print(f"Recording storage error: {e}")
            # Try local storage as fallback
            try:
                file_size = os.path.getsize(local_file_path)
                return await self._save_to_local_storage(
                    recording_id, room_code, local_file_path, file_size
                )
            except Exception as e2:
                return {
                    "success": False,
                    "error": f"Storage failed: {str(e)} | Fallback failed: {str(e2)}"
                }

    async def _ensure_folder_exists(self, username: str, folder_path: str) -> bool:
        """Ensure folder structure exists in Nextcloud"""
        try:
            # Split path and create each level
            parts = folder_path.strip("/").split("/")
            current_path = ""

            for part in parts:
                current_path = f"{current_path}/{part}"
                await nextcloud_service.create_folder(
                    username=username,
                    password="",
                    path=current_path
                )

            return True
        except Exception as e:
            print(f"Folder creation error: {e}")
            return False

    async def _create_share_link(
        self,
        username: str,
        file_path: str,
        expire_days: int = 30
    ) -> Optional[str]:
        """Create a shareable link for the recording"""
        try:
            share_url = await nextcloud_service.create_share_link(
                username=username,
                password="",
                path=file_path,
                expire_days=expire_days
            )
            return share_url
        except Exception:
            return None

    async def _save_to_local_storage(
        self,
        recording_id: str,
        room_code: str,
        source_path: str,
        file_size: int
    ) -> Dict[str, Any]:
        """Save recording to local filesystem as fallback"""
        try:
            import shutil

            # Create folder structure
            local_folder = f"{self.local_storage}/{room_code}"
            os.makedirs(local_folder, exist_ok=True)

            # Generate filename
            timestamp = datetime.utcnow().strftime("%Y%m%d_%H%M%S")
            filename = f"recording_{timestamp}.mp4"
            dest_path = f"{local_folder}/{filename}"

            # Copy file
            shutil.copy2(source_path, dest_path)

            # Clean up original if different
            if source_path != dest_path:
                await self._cleanup_local_file(source_path)

            return {
                "success": True,
                "storage_type": "local",
                "storage_path": dest_path,
                "file_size_bytes": file_size,
                "filename": filename,
                "uploaded_at": datetime.utcnow().isoformat()
            }

        except Exception as e:
            return {
                "success": False,
                "error": f"Local storage failed: {str(e)}"
            }

    async def _cleanup_local_file(self, file_path: str) -> bool:
        """Delete local temp file after successful upload"""
        try:
            if os.path.exists(file_path) and self.temp_dir in file_path:
                os.remove(file_path)
                return True
            return False
        except Exception:
            return False

    async def get_recording_url(
        self,
        storage_type: str,
        storage_path: str,
        username: str = None
    ) -> Optional[str]:
        """
        Get download/stream URL for a recording.

        Args:
            storage_type: 'nextcloud' or 'local'
            storage_path: Full path to the file
            username: Nextcloud username (if nextcloud storage)

        Returns:
            Download URL or None
        """
        try:
            if storage_type == "nextcloud":
                return await nextcloud_service.get_download_url(
                    username=username or settings.NEXTCLOUD_ADMIN_USER,
                    password=settings.NEXTCLOUD_ADMIN_PASSWORD,
                    path=storage_path
                )
            elif storage_type == "local":
                # Return API endpoint for local files
                recording_id = storage_path.split("/")[-1].replace(".mp4", "")
                return f"/api/v1/recordings/{recording_id}/stream"
            else:
                return None

        except Exception:
            return None

    async def delete_recording(
        self,
        storage_type: str,
        storage_path: str,
        username: str = None
    ) -> bool:
        """
        Delete a recording from storage.

        Args:
            storage_type: 'nextcloud' or 'local'
            storage_path: Full path to the file
            username: Nextcloud username (if nextcloud storage)

        Returns:
            True if deleted successfully
        """
        try:
            if storage_type == "nextcloud":
                return await nextcloud_service.delete_file(
                    username=username or settings.NEXTCLOUD_ADMIN_USER,
                    password=settings.NEXTCLOUD_ADMIN_PASSWORD,
                    path=storage_path
                )
            elif storage_type == "local":
                if os.path.exists(storage_path):
                    os.remove(storage_path)
                    return True
                return False
            else:
                return False

        except Exception as e:
            print(f"Delete recording error: {e}")
            return False

    async def get_storage_stats(
        self,
        user_id: str = None,
        company_id: str = None
    ) -> Dict[str, Any]:
        """
        Get storage usage statistics.

        Args:
            user_id: Filter by user
            company_id: Filter by company

        Returns:
            Dict with storage stats
        """
        # This would query the database for recording sizes
        # For now, return placeholder
        return {
            "total_recordings": 0,
            "total_size_bytes": 0,
            "total_size_gb": 0,
            "quota_gb": 50,
            "usage_percent": 0
        }

    async def check_quota(
        self,
        company_id: str,
        required_bytes: int
    ) -> Dict[str, Any]:
        """
        Check if there's enough storage quota.

        Args:
            company_id: Company to check quota for
            required_bytes: Estimated file size needed

        Returns:
            Dict with quota info and availability
        """
        stats = await self.get_storage_stats(company_id=company_id)
        quota_bytes = stats["quota_gb"] * 1024 * 1024 * 1024
        used_bytes = stats["total_size_bytes"]
        available_bytes = quota_bytes - used_bytes

        return {
            "has_quota": available_bytes >= required_bytes,
            "available_bytes": available_bytes,
            "available_gb": round(available_bytes / (1024 * 1024 * 1024), 2),
            "quota_gb": stats["quota_gb"],
            "used_gb": round(used_bytes / (1024 * 1024 * 1024), 2)
        }

    def get_temp_path(self, recording_id: str) -> str:
        """Get temporary file path for a recording"""
        return f"{self.temp_dir}/{recording_id}.mp4"

    def temp_file_exists(self, recording_id: str) -> bool:
        """Check if temp file exists"""
        return os.path.exists(self.get_temp_path(recording_id))


# Singleton instance
recording_storage_service = RecordingStorageService()
