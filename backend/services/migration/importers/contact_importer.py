"""
Contact importer for Workspace database.
Stores contacts in the contacts table.
"""

import logging
from typing import AsyncIterator
from uuid import UUID
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import text

from services.migration.providers.base import Contact

logger = logging.getLogger(__name__)


class ContactImporter:
    """Import contacts to Workspace database"""

    def __init__(self, db: AsyncSession, tenant_id: UUID, user_id: UUID):
        self.db = db
        self.tenant_id = tenant_id
        self.user_id = user_id

    async def import_contact(self, contact: Contact, source: str) -> bool:
        """Import a single contact"""
        try:
            # Build full name for existing 'name' column
            full_name = contact.display_name or f"{contact.first_name} {contact.last_name}".strip()

            await self.db.execute(
                text("""
                    INSERT INTO workspace.contacts (
                        tenant_id, user_id, email, name, first_name, last_name,
                        display_name, phone, mobile, company, organization, job_title,
                        photo_url, avatar_url, source, source_id, external_id
                    ) VALUES (
                        :tenant_id, :user_id, :email, :name, :first_name, :last_name,
                        :display_name, :phone, :mobile, :company, :organization, :job_title,
                        :photo_url, :avatar_url, :source, :source_id, :external_id
                    )
                    ON CONFLICT (tenant_id, user_id, email) WHERE email IS NOT NULL
                    DO UPDATE SET
                        name = EXCLUDED.name,
                        first_name = EXCLUDED.first_name,
                        last_name = EXCLUDED.last_name,
                        display_name = EXCLUDED.display_name,
                        phone = EXCLUDED.phone,
                        mobile = EXCLUDED.mobile,
                        company = EXCLUDED.company,
                        organization = EXCLUDED.organization,
                        job_title = EXCLUDED.job_title,
                        photo_url = EXCLUDED.photo_url,
                        avatar_url = EXCLUDED.avatar_url,
                        source_id = EXCLUDED.source_id,
                        updated_at = NOW()
                """),
                {
                    "tenant_id": str(self.tenant_id),
                    "user_id": str(self.user_id),
                    "email": contact.email,
                    "name": full_name,
                    "first_name": contact.first_name,
                    "last_name": contact.last_name,
                    "display_name": contact.display_name,
                    "phone": contact.phone,
                    "mobile": contact.mobile,
                    "company": contact.company,
                    "organization": contact.company,  # Map company to organization
                    "job_title": contact.job_title,
                    "photo_url": contact.photo_url,
                    "avatar_url": contact.photo_url,  # Map photo_url to avatar_url
                    "source": source,
                    "source_id": contact.id,
                    "external_id": contact.id,  # Map source_id to external_id
                }
            )
            return True
        except Exception as e:
            logger.error(f"Failed to import contact {contact.email}: {e}")
            return False

    async def import_batch(
        self,
        contacts: AsyncIterator[Contact],
        source: str,
        progress_callback=None
    ) -> dict:
        """Import multiple contacts"""
        stats = {
            "total": 0,
            "success": 0,
            "failed": 0
        }

        batch = []

        async for contact in contacts:
            stats["total"] += 1

            success = await self.import_contact(contact, source)

            if success:
                stats["success"] += 1
            else:
                stats["failed"] += 1

            # Commit in batches
            batch.append(contact)
            if len(batch) >= 50:
                await self.db.commit()
                batch = []

                if progress_callback:
                    await progress_callback(stats)

        # Final commit
        if batch:
            await self.db.commit()

        return stats
