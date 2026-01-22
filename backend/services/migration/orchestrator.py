"""
Migration orchestrator.
Coordinates the migration process across providers and importers.
"""

import asyncio
import logging
from uuid import UUID, uuid4
from datetime import datetime
from typing import Optional, Dict, Any, List
from dataclasses import dataclass, field
import json

from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import text

from .oauth_service import oauth_service
from .providers.google_provider import GoogleMigrationProvider
from .providers.base import MigrationStats
from .importers.email_importer import EmailImporter
from .importers.contact_importer import ContactImporter
from .importers.drive_importer import DriveImporter

logger = logging.getLogger(__name__)


@dataclass
class MigrationConfig:
    """Configuration for a migration job"""
    migrate_email: bool = True
    migrate_contacts: bool = True
    migrate_drive: bool = True
    email_folders: List[str] = field(default_factory=list)
    drive_folders: List[str] = field(default_factory=list)
    date_from: Optional[datetime] = None
    date_to: Optional[datetime] = None


@dataclass
class MigrationProgress:
    """Real-time migration progress"""
    job_id: UUID
    status: str
    progress_percent: int
    current_task: str

    email_status: str = "pending"
    email_progress: int = 0
    email_total: int = 0
    email_processed: int = 0

    contacts_status: str = "pending"
    contacts_progress: int = 0
    contacts_total: int = 0
    contacts_processed: int = 0

    drive_status: str = "pending"
    drive_progress: int = 0
    drive_total: int = 0
    drive_processed: int = 0
    bytes_transferred: int = 0

    errors: List[dict] = field(default_factory=list)


class MigrationOrchestrator:
    """Orchestrate the migration process"""

    def __init__(self, db: AsyncSession):
        self.db = db
        self._active_jobs: Dict[UUID, MigrationProgress] = {}

    async def get_connection(self, connection_id: UUID) -> Optional[dict]:
        """Get migration connection by ID"""
        result = await self.db.execute(
            text("""
                SELECT * FROM workspace.migration_connections
                WHERE id = :id AND is_active = true
            """),
            {"id": str(connection_id)}
        )
        row = result.fetchone()
        return dict(row._mapping) if row else None

    async def get_provider(self, connection: dict):
        """Get appropriate provider for connection"""
        provider_type = connection["provider"]

        if provider_type == "google":
            access_token = oauth_service.decrypt_token(connection["access_token"])
            refresh_token = None
            if connection.get("refresh_token"):
                refresh_token = oauth_service.decrypt_token(connection["refresh_token"])

            return GoogleMigrationProvider(access_token, refresh_token)

        # Add Microsoft and IMAP providers here
        raise ValueError(f"Unknown provider: {provider_type}")

    async def preview_migration(self, connection_id: UUID) -> MigrationStats:
        """Get migration preview (counts and sizes)"""
        connection = await self.get_connection(connection_id)
        if not connection:
            raise ValueError("Connection not found")

        provider = await self.get_provider(connection)
        try:
            return await provider.get_migration_stats()
        finally:
            await provider.close()

    async def start_migration(
        self,
        tenant_id: UUID,
        user_id: UUID,
        connection_id: UUID,
        config: MigrationConfig,
        mailbox_email: str,
        mailbox_password: str,
        nextcloud_user: str,
        nextcloud_password: str
    ) -> UUID:
        """Start a migration job"""

        # Create job record
        job_id = uuid4()

        config_dict = {
            "migrate_email": config.migrate_email,
            "migrate_contacts": config.migrate_contacts,
            "migrate_drive": config.migrate_drive,
            "email_folders": config.email_folders,
            "drive_folders": config.drive_folders,
        }

        await self.db.execute(
            text("""
                INSERT INTO workspace.migration_jobs (
                    id, tenant_id, user_id, connection_id, job_type, config, status
                ) VALUES (
                    :id, :tenant_id, :user_id, :connection_id, :job_type, :config::jsonb, 'pending'
                )
            """),
            {
                "id": str(job_id),
                "tenant_id": str(tenant_id),
                "user_id": str(user_id),
                "connection_id": str(connection_id),
                "job_type": "full",
                "config": json.dumps(config_dict)
            }
        )
        await self.db.commit()

        # Initialize progress tracking
        self._active_jobs[job_id] = MigrationProgress(
            job_id=job_id,
            status="pending",
            progress_percent=0,
            current_task="Initializing..."
        )

        # Start background task
        asyncio.create_task(
            self._run_migration(
                job_id=job_id,
                tenant_id=tenant_id,
                user_id=user_id,
                connection_id=connection_id,
                config=config,
                mailbox_email=mailbox_email,
                mailbox_password=mailbox_password,
                nextcloud_user=nextcloud_user,
                nextcloud_password=nextcloud_password
            )
        )

        return job_id

    async def _run_migration(
        self,
        job_id: UUID,
        tenant_id: UUID,
        user_id: UUID,
        connection_id: UUID,
        config: MigrationConfig,
        mailbox_email: str,
        mailbox_password: str,
        nextcloud_user: str,
        nextcloud_password: str
    ):
        """Background migration task"""
        progress = self._active_jobs[job_id]

        try:
            # Update status
            progress.status = "running"
            progress.current_task = "Connecting to source..."
            await self._update_job_status(job_id, "running")

            # Get connection and provider
            connection = await self.get_connection(connection_id)
            provider = await self.get_provider(connection)

            try:
                # Get stats for progress tracking
                stats = await provider.get_migration_stats()
                progress.email_total = stats.email_count
                progress.contacts_total = stats.contact_count
                progress.drive_total = stats.drive_file_count

                # Calculate total items for progress
                total_items = 0
                if config.migrate_email:
                    total_items += stats.email_count
                if config.migrate_contacts:
                    total_items += stats.contact_count
                if config.migrate_drive:
                    total_items += stats.drive_file_count

                processed_items = 0

                # ========== EMAIL MIGRATION ==========
                if config.migrate_email and mailbox_email and mailbox_password:
                    progress.current_task = "Migrating emails..."
                    progress.email_status = "running"

                    email_importer = EmailImporter(mailbox_email, mailbox_password)

                    async def email_progress_callback(stats):
                        nonlocal processed_items
                        progress.email_processed = stats["success"]
                        processed_items = progress.email_processed + progress.contacts_processed + progress.drive_processed
                        progress.progress_percent = int((processed_items / total_items) * 100) if total_items > 0 else 0
                        progress.email_progress = int((stats["success"] / progress.email_total) * 100) if progress.email_total > 0 else 0

                    email_stats = await email_importer.import_batch(
                        provider.fetch_emails(folders=config.email_folders, since=config.date_from),
                        progress_callback=email_progress_callback
                    )

                    progress.email_status = "completed"
                    progress.email_processed = email_stats["success"]

                    if email_stats["errors"]:
                        progress.errors.extend(email_stats["errors"][:10])  # Limit errors stored
                else:
                    progress.email_status = "skipped"

                # ========== CONTACTS MIGRATION ==========
                if config.migrate_contacts:
                    progress.current_task = "Migrating contacts..."
                    progress.contacts_status = "running"

                    contact_importer = ContactImporter(self.db, tenant_id, user_id)

                    async def contacts_progress_callback(stats):
                        nonlocal processed_items
                        progress.contacts_processed = stats["success"]
                        processed_items = progress.email_processed + progress.contacts_processed + progress.drive_processed
                        progress.progress_percent = int((processed_items / total_items) * 100) if total_items > 0 else 0
                        progress.contacts_progress = int((stats["success"] / progress.contacts_total) * 100) if progress.contacts_total > 0 else 0

                    contacts_stats = await contact_importer.import_batch(
                        provider.fetch_contacts(),
                        source=connection["provider"],
                        progress_callback=contacts_progress_callback
                    )

                    progress.contacts_status = "completed"
                    progress.contacts_processed = contacts_stats["success"]
                else:
                    progress.contacts_status = "skipped"

                # ========== DRIVE MIGRATION ==========
                if config.migrate_drive and nextcloud_user and nextcloud_password:
                    progress.current_task = "Migrating drive files..."
                    progress.drive_status = "running"

                    drive_importer = DriveImporter(nextcloud_user, nextcloud_password)

                    async def drive_progress_callback(stats):
                        nonlocal processed_items
                        progress.drive_processed = stats["success"]
                        progress.bytes_transferred = stats["bytes_transferred"]
                        processed_items = progress.email_processed + progress.contacts_processed + progress.drive_processed
                        progress.progress_percent = int((processed_items / total_items) * 100) if total_items > 0 else 0
                        progress.drive_progress = int((stats["success"] / progress.drive_total) * 100) if progress.drive_total > 0 else 0

                    drive_stats = await drive_importer.import_batch(
                        provider.fetch_drive_files(folder_ids=config.drive_folders),
                        provider=provider,
                        target_folder="/Migration",
                        progress_callback=drive_progress_callback
                    )

                    progress.drive_status = "completed"
                    progress.drive_processed = drive_stats["success"]
                    progress.bytes_transferred = drive_stats["bytes_transferred"]

                    await drive_importer.close()
                else:
                    progress.drive_status = "skipped"

                # Complete!
                progress.status = "completed"
                progress.progress_percent = 100
                progress.current_task = "Migration completed!"
                await self._update_job_status(job_id, "completed")

            finally:
                await provider.close()

        except Exception as e:
            logger.exception(f"Migration job {job_id} failed: {e}")
            progress.status = "failed"
            progress.current_task = f"Error: {str(e)}"
            progress.errors.append({"error": str(e)})
            await self._update_job_status(job_id, "failed", str(e))

    async def _update_job_status(self, job_id: UUID, status: str, error: str = None):
        """Update job status in database"""
        progress = self._active_jobs.get(job_id)

        await self.db.execute(
            text("""
                UPDATE workspace.migration_jobs SET
                    status = :status,
                    progress_percent = :progress_percent,
                    current_task = :current_task,
                    email_status = :email_status,
                    email_progress = :email_progress,
                    email_total = :email_total,
                    email_processed = :email_processed,
                    contacts_status = :contacts_status,
                    contacts_progress = :contacts_progress,
                    contacts_total = :contacts_total,
                    contacts_processed = :contacts_processed,
                    drive_status = :drive_status,
                    drive_progress = :drive_progress,
                    drive_total = :drive_total,
                    drive_processed = :drive_processed,
                    bytes_transferred = :bytes_transferred,
                    errors = :errors::jsonb,
                    updated_at = NOW(),
                    started_at = CASE WHEN started_at IS NULL AND :status = 'running' THEN NOW() ELSE started_at END,
                    completed_at = CASE WHEN :status IN ('completed', 'failed') THEN NOW() ELSE completed_at END
                WHERE id = :id
            """),
            {
                "id": str(job_id),
                "status": status,
                "progress_percent": progress.progress_percent if progress else 0,
                "current_task": progress.current_task if progress else "",
                "email_status": progress.email_status if progress else "pending",
                "email_progress": progress.email_progress if progress else 0,
                "email_total": progress.email_total if progress else 0,
                "email_processed": progress.email_processed if progress else 0,
                "contacts_status": progress.contacts_status if progress else "pending",
                "contacts_progress": progress.contacts_progress if progress else 0,
                "contacts_total": progress.contacts_total if progress else 0,
                "contacts_processed": progress.contacts_processed if progress else 0,
                "drive_status": progress.drive_status if progress else "pending",
                "drive_progress": progress.drive_progress if progress else 0,
                "drive_total": progress.drive_total if progress else 0,
                "drive_processed": progress.drive_processed if progress else 0,
                "bytes_transferred": progress.bytes_transferred if progress else 0,
                "errors": json.dumps(progress.errors if progress else []),
            }
        )
        await self.db.commit()

    def get_job_progress(self, job_id: UUID) -> Optional[MigrationProgress]:
        """Get real-time job progress"""
        return self._active_jobs.get(job_id)

    async def cancel_job(self, job_id: UUID) -> bool:
        """Cancel a running job"""
        progress = self._active_jobs.get(job_id)
        if progress and progress.status == "running":
            progress.status = "cancelled"
            await self._update_job_status(job_id, "cancelled")
            return True
        return False
