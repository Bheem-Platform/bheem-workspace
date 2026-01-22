"""
Drive importer for Nextcloud via WebDAV.
Uploads files to user's Nextcloud storage.
"""

import logging
from typing import AsyncIterator
import aiohttp
from urllib.parse import quote

from services.migration.providers.base import DriveFile, BaseMigrationProvider
from core.config import settings

logger = logging.getLogger(__name__)


class DriveImporter:
    """Import files to Nextcloud via WebDAV"""

    def __init__(self, nextcloud_user: str, nextcloud_password: str):
        self.user = nextcloud_user
        self.password = nextcloud_password
        self.base_url = f"{settings.NEXTCLOUD_URL}/remote.php/dav/files/{nextcloud_user}"
        self._session = None

    async def _get_session(self) -> aiohttp.ClientSession:
        if self._session is None or self._session.closed:
            auth = aiohttp.BasicAuth(self.user, self.password)
            self._session = aiohttp.ClientSession(auth=auth)
        return self._session

    async def ensure_folder(self, path: str):
        """Create folder structure"""
        session = await self._get_session()

        # Create each folder in path
        parts = path.strip("/").split("/")
        current_path = ""

        for part in parts:
            current_path += f"/{part}"
            url = f"{self.base_url}{quote(current_path)}"

            async with session.request("MKCOL", url) as resp:
                # 201 = created, 405 = already exists
                if resp.status not in [201, 405]:
                    logger.warning(f"Failed to create folder {current_path}: {resp.status}")

    async def upload_file(
        self,
        file: DriveFile,
        content: bytes,
        target_folder: str = "/Migration"
    ) -> bool:
        """Upload a single file to Nextcloud"""
        try:
            session = await self._get_session()

            # Ensure target folder exists
            await self.ensure_folder(target_folder)

            # Build target path
            target_path = f"{target_folder}/{file.name}"
            url = f"{self.base_url}{quote(target_path)}"

            # Upload file
            async with session.put(
                url,
                data=content,
                headers={"Content-Type": file.mime_type}
            ) as resp:
                if resp.status in [200, 201, 204]:
                    return True
                else:
                    logger.error(f"Failed to upload {file.name}: {resp.status}")
                    return False

        except Exception as e:
            logger.error(f"Failed to upload {file.name}: {e}")
            return False

    async def import_batch(
        self,
        files: AsyncIterator[DriveFile],
        provider: BaseMigrationProvider,
        target_folder: str = "/Migration",
        progress_callback=None
    ) -> dict:
        """Import multiple files"""
        stats = {
            "total": 0,
            "success": 0,
            "failed": 0,
            "bytes_transferred": 0
        }

        async for file in files:
            if file.is_folder:
                continue

            stats["total"] += 1

            try:
                # Download from source
                content = await provider.download_file(file)

                # Upload to Nextcloud
                success = await self.upload_file(file, content, target_folder)

                if success:
                    stats["success"] += 1
                    stats["bytes_transferred"] += len(content)
                else:
                    stats["failed"] += 1

            except Exception as e:
                logger.error(f"Failed to migrate file {file.name}: {e}")
                stats["failed"] += 1

            if progress_callback:
                await progress_callback(stats)

        return stats

    async def close(self):
        if self._session and not self._session.closed:
            await self._session.close()
