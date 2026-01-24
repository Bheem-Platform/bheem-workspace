#!/usr/bin/env python3
"""
Sync S3 Documents to Nextcloud
================================
This script migrates existing documents from S3 storage to Nextcloud.

Usage:
    python scripts/sync_s3_to_nextcloud.py [--dry-run] [--limit N]

Options:
    --dry-run   Show what would be synced without actually syncing
    --limit N   Only sync first N documents
"""

import sys
import os
import asyncio
import argparse
import logging
from datetime import datetime

# Add parent directory to path for imports
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import boto3
from botocore.config import Config
import httpx
import psycopg2
from psycopg2.extras import RealDictCursor

from core.config import settings

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)


class S3ToNextcloudSync:
    """Sync documents from S3 to Nextcloud."""

    def __init__(self):
        # S3 client
        s3_endpoint = settings.DOCS_S3_ENDPOINT or settings.S3_ENDPOINT
        s3_access_key = settings.DOCS_S3_ACCESS_KEY or settings.S3_ACCESS_KEY
        s3_secret_key = settings.DOCS_S3_SECRET_KEY or settings.S3_SECRET_KEY
        s3_region = settings.DOCS_S3_REGION or settings.S3_REGION

        self.s3_client = boto3.client(
            's3',
            endpoint_url=s3_endpoint,
            aws_access_key_id=s3_access_key,
            aws_secret_access_key=s3_secret_key,
            config=Config(signature_version='s3v4'),
            region_name=s3_region
        )
        self.s3_bucket = settings.DOCS_S3_BUCKET or settings.S3_BUCKET

        # Nextcloud settings
        self.nextcloud_url = settings.NEXTCLOUD_URL
        self.nextcloud_user = settings.NEXTCLOUD_ADMIN_USER
        self.nextcloud_pass = settings.NEXTCLOUD_ADMIN_PASSWORD

        # Database connection
        self.db_config = {
            'host': settings.ERP_DB_HOST,
            'port': settings.ERP_DB_PORT,
            'database': settings.ERP_DB_NAME,
            'user': settings.ERP_DB_USER,
            'password': settings.ERP_DB_PASSWORD,
        }

        # Stats
        self.synced = 0
        self.failed = 0
        self.skipped = 0

    def get_documents_from_db(self, limit: int = None):
        """Get all documents from database."""
        conn = psycopg2.connect(**self.db_config)
        cur = conn.cursor(cursor_factory=RealDictCursor)

        query = """
            SELECT id, title, storage_path, file_size, created_at
            FROM dms.documents
            WHERE storage_path IS NOT NULL
            ORDER BY created_at DESC
        """
        if limit:
            query += f" LIMIT {limit}"

        cur.execute(query)
        documents = cur.fetchall()

        cur.close()
        conn.close()

        return documents

    def download_from_s3(self, storage_path: str) -> bytes:
        """Download file content from S3."""
        try:
            response = self.s3_client.get_object(
                Bucket=self.s3_bucket,
                Key=storage_path
            )
            return response['Body'].read()
        except Exception as e:
            logger.error(f"Failed to download from S3 {storage_path}: {e}")
            raise

    async def ensure_folder_exists(self, path: str):
        """Create folder hierarchy in Nextcloud."""
        parts = path.strip('/').split('/')
        current_path = ""

        async with httpx.AsyncClient(verify=False, timeout=30.0) as client:
            for part in parts:
                current_path = f"{current_path}/{part}"
                folder_url = f"{self.nextcloud_url}/remote.php/dav/files/{self.nextcloud_user}{current_path}"

                # Check if exists
                try:
                    response = await client.request(
                        method="PROPFIND",
                        url=folder_url,
                        auth=(self.nextcloud_user, self.nextcloud_pass),
                        headers={"Depth": "0"}
                    )
                    if response.status_code == 207:
                        continue
                except:
                    pass

                # Create folder
                try:
                    await client.request(
                        method="MKCOL",
                        url=folder_url,
                        auth=(self.nextcloud_user, self.nextcloud_pass)
                    )
                    logger.info(f"Created folder: {current_path}")
                except Exception as e:
                    logger.warning(f"Error creating folder {current_path}: {e}")

    async def upload_to_nextcloud(self, storage_path: str, content: bytes, content_type: str = None) -> bool:
        """Upload file to Nextcloud."""
        webdav_url = f"{self.nextcloud_url}/remote.php/dav/files/{self.nextcloud_user}{storage_path}"

        # Ensure parent folder exists
        parent_path = '/'.join(storage_path.split('/')[:-1])
        if parent_path:
            await self.ensure_folder_exists(parent_path)

        headers = {}
        if content_type:
            headers["Content-Type"] = content_type

        try:
            async with httpx.AsyncClient(verify=False, timeout=120.0) as client:
                response = await client.put(
                    url=webdav_url,
                    content=content,
                    auth=(self.nextcloud_user, self.nextcloud_pass),
                    headers=headers
                )

                if response.status_code in [201, 204]:
                    return True
                else:
                    logger.error(f"Upload failed: {response.status_code} {response.text}")
                    return False
        except Exception as e:
            logger.error(f"Failed to upload to Nextcloud {storage_path}: {e}")
            return False

    async def check_exists_in_nextcloud(self, storage_path: str) -> bool:
        """Check if file already exists in Nextcloud."""
        webdav_url = f"{self.nextcloud_url}/remote.php/dav/files/{self.nextcloud_user}{storage_path}"

        try:
            async with httpx.AsyncClient(verify=False, timeout=15.0) as client:
                response = await client.request(
                    method="PROPFIND",
                    url=webdav_url,
                    auth=(self.nextcloud_user, self.nextcloud_pass),
                    headers={"Depth": "0"}
                )
                return response.status_code == 207
        except:
            return False

    def update_storage_path(self, doc_id: str, new_path: str):
        """Update document storage path in database."""
        conn = psycopg2.connect(**self.db_config)
        cur = conn.cursor()

        cur.execute("""
            UPDATE dms.documents
            SET storage_path = %s, updated_at = NOW()
            WHERE id = %s
        """, (new_path, doc_id))

        conn.commit()
        cur.close()
        conn.close()

    async def sync_document(self, doc: dict, dry_run: bool = False) -> bool:
        """Sync a single document from S3 to Nextcloud."""
        doc_id = str(doc['id'])
        old_path = doc['storage_path']
        title = doc['title']

        # Guess content type from filename
        import mimetypes
        content_type, _ = mimetypes.guess_type(old_path)
        content_type = content_type or 'application/octet-stream'

        # Convert S3 path to Nextcloud path
        # Old: internal/{company_id}/{filename} or bheem-docs/{company_id}/{doc_id}.docx
        # New: /Documents/internal/{company_id}/{filename}
        if old_path.startswith('/'):
            new_path = old_path
        elif old_path.startswith('bheem-docs/'):
            # Convert bheem-docs/xxx to /Documents/xxx
            new_path = '/Documents/' + old_path.replace('bheem-docs/', '')
        elif old_path.startswith('internal/') or old_path.startswith('external/'):
            new_path = '/Documents/' + old_path
        else:
            new_path = '/Documents/shared/' + old_path

        logger.info(f"[{doc_id}] {title}")
        logger.info(f"  S3 path: {old_path}")
        logger.info(f"  NC path: {new_path}")

        if dry_run:
            logger.info(f"  [DRY RUN] Would sync to {new_path}")
            return True

        # Check if already exists in Nextcloud
        if await self.check_exists_in_nextcloud(new_path):
            logger.info(f"  [SKIP] Already exists in Nextcloud")
            self.skipped += 1
            return True

        try:
            # Download from S3
            logger.info(f"  Downloading from S3...")
            content = self.download_from_s3(old_path)
            logger.info(f"  Downloaded {len(content)} bytes")

            # Upload to Nextcloud
            logger.info(f"  Uploading to Nextcloud...")
            success = await self.upload_to_nextcloud(new_path, content, content_type)

            if success:
                # Update database with new path
                self.update_storage_path(doc_id, new_path)
                logger.info(f"  [OK] Synced successfully")
                self.synced += 1
                return True
            else:
                logger.error(f"  [FAIL] Upload failed")
                self.failed += 1
                return False

        except Exception as e:
            logger.error(f"  [FAIL] Error: {e}")
            self.failed += 1
            return False

    async def run(self, dry_run: bool = False, limit: int = None):
        """Run the sync process."""
        logger.info("=" * 60)
        logger.info("S3 to Nextcloud Document Sync")
        logger.info("=" * 60)
        logger.info(f"S3 Bucket: {self.s3_bucket}")
        logger.info(f"Nextcloud: {self.nextcloud_url}")
        logger.info(f"Dry Run: {dry_run}")
        logger.info(f"Limit: {limit or 'None'}")
        logger.info("=" * 60)

        # Get documents from database
        documents = self.get_documents_from_db(limit)
        logger.info(f"Found {len(documents)} documents to sync")
        logger.info("")

        # Sync each document
        for i, doc in enumerate(documents, 1):
            logger.info(f"[{i}/{len(documents)}] Processing...")
            await self.sync_document(doc, dry_run)
            logger.info("")

        # Print summary
        logger.info("=" * 60)
        logger.info("SYNC COMPLETE")
        logger.info("=" * 60)
        logger.info(f"Synced:  {self.synced}")
        logger.info(f"Skipped: {self.skipped}")
        logger.info(f"Failed:  {self.failed}")
        logger.info("=" * 60)


def main():
    parser = argparse.ArgumentParser(description='Sync S3 documents to Nextcloud')
    parser.add_argument('--dry-run', action='store_true', help='Show what would be synced')
    parser.add_argument('--limit', type=int, help='Limit number of documents to sync')
    args = parser.parse_args()

    sync = S3ToNextcloudSync()
    asyncio.run(sync.run(dry_run=args.dry_run, limit=args.limit))


if __name__ == '__main__':
    main()
