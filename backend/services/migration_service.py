"""
Bheem Workspace - Data Migration Service
Handles importing data from Google Workspace and Outlook/Microsoft 365.
"""
import asyncio
import json
import zipfile
import io
import uuid
import mbox
from datetime import datetime
from typing import Optional, Dict, Any, List, AsyncGenerator
from pathlib import Path
import tempfile

from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import text

from core.logging import get_logger
from core.config import settings

logger = get_logger("bheem.migration")


class MigrationJob:
    """Represents a migration job."""

    def __init__(
        self,
        job_id: str,
        tenant_id: str,
        user_id: str,
        source: str,
        data_type: str
    ):
        self.job_id = job_id
        self.tenant_id = tenant_id
        self.user_id = user_id
        self.source = source  # 'google', 'outlook', 'csv'
        self.data_type = data_type  # 'email', 'calendar', 'contacts', 'documents'
        self.status = "pending"
        self.progress = 0
        self.total_items = 0
        self.processed_items = 0
        self.errors: List[str] = []
        self.created_at = datetime.utcnow()
        self.started_at: Optional[datetime] = None
        self.completed_at: Optional[datetime] = None

    def to_dict(self) -> dict:
        return {
            "job_id": self.job_id,
            "tenant_id": self.tenant_id,
            "user_id": self.user_id,
            "source": self.source,
            "data_type": self.data_type,
            "status": self.status,
            "progress": self.progress,
            "total_items": self.total_items,
            "processed_items": self.processed_items,
            "errors": self.errors[:10],  # Limit to 10 errors
            "error_count": len(self.errors),
            "created_at": self.created_at.isoformat(),
            "started_at": self.started_at.isoformat() if self.started_at else None,
            "completed_at": self.completed_at.isoformat() if self.completed_at else None
        }


class MigrationService:
    """
    Data Migration Service.
    Handles importing data from various sources.
    """

    def __init__(self):
        self._jobs: Dict[str, MigrationJob] = {}

    def create_job(
        self,
        tenant_id: str,
        user_id: str,
        source: str,
        data_type: str
    ) -> MigrationJob:
        """Create a new migration job."""
        job_id = str(uuid.uuid4())
        job = MigrationJob(
            job_id=job_id,
            tenant_id=tenant_id,
            user_id=user_id,
            source=source,
            data_type=data_type
        )
        self._jobs[job_id] = job
        return job

    def get_job(self, job_id: str) -> Optional[MigrationJob]:
        """Get migration job by ID."""
        return self._jobs.get(job_id)

    def get_user_jobs(self, user_id: str) -> List[MigrationJob]:
        """Get all jobs for a user."""
        return [job for job in self._jobs.values() if job.user_id == user_id]

    async def import_google_takeout(
        self,
        job: MigrationJob,
        file_content: bytes,
        db: AsyncSession
    ) -> Dict[str, Any]:
        """
        Import data from Google Takeout export.

        Supports:
        - Mail (mbox format)
        - Calendar (ICS format)
        - Contacts (CSV/VCF format)
        - Drive files (various formats)
        """
        job.status = "processing"
        job.started_at = datetime.utcnow()
        results = {"imported": 0, "skipped": 0, "errors": []}

        try:
            # Google Takeout is a ZIP file
            with zipfile.ZipFile(io.BytesIO(file_content)) as zf:
                file_list = zf.namelist()
                job.total_items = len(file_list)

                for file_path in file_list:
                    job.processed_items += 1
                    job.progress = int((job.processed_items / job.total_items) * 100)

                    try:
                        if job.data_type == "email" and file_path.endswith(".mbox"):
                            count = await self._import_mbox(
                                zf.read(file_path),
                                job.user_id,
                                job.tenant_id,
                                db
                            )
                            results["imported"] += count

                        elif job.data_type == "calendar" and file_path.endswith(".ics"):
                            count = await self._import_ics(
                                zf.read(file_path).decode("utf-8"),
                                job.user_id,
                                job.tenant_id,
                                db
                            )
                            results["imported"] += count

                        elif job.data_type == "contacts" and (
                            file_path.endswith(".csv") or file_path.endswith(".vcf")
                        ):
                            count = await self._import_contacts(
                                zf.read(file_path),
                                file_path.endswith(".vcf"),
                                job.user_id,
                                job.tenant_id,
                                db
                            )
                            results["imported"] += count

                        elif job.data_type == "documents":
                            if self._is_document_file(file_path):
                                await self._import_document(
                                    zf.read(file_path),
                                    file_path,
                                    job.user_id,
                                    job.tenant_id,
                                    db
                                )
                                results["imported"] += 1
                        else:
                            results["skipped"] += 1

                    except Exception as e:
                        job.errors.append(f"Error processing {file_path}: {str(e)}")
                        results["errors"].append(str(e))

            job.status = "completed"
            job.completed_at = datetime.utcnow()

        except Exception as e:
            logger.error(f"Migration job {job.job_id} failed: {e}")
            job.status = "failed"
            job.errors.append(str(e))
            results["errors"].append(str(e))

        return results

    async def import_outlook_export(
        self,
        job: MigrationJob,
        file_content: bytes,
        db: AsyncSession
    ) -> Dict[str, Any]:
        """
        Import data from Outlook/Microsoft 365 export.

        Supports:
        - Mail (PST converted to mbox, or EML files)
        - Calendar (ICS format)
        - Contacts (CSV format)
        """
        job.status = "processing"
        job.started_at = datetime.utcnow()
        results = {"imported": 0, "skipped": 0, "errors": []}

        try:
            # Check if it's a ZIP file
            if file_content[:4] == b'PK\x03\x04':
                with zipfile.ZipFile(io.BytesIO(file_content)) as zf:
                    file_list = zf.namelist()
                    job.total_items = len(file_list)

                    for file_path in file_list:
                        job.processed_items += 1
                        job.progress = int((job.processed_items / job.total_items) * 100)

                        try:
                            if job.data_type == "email" and file_path.endswith(".eml"):
                                await self._import_eml(
                                    zf.read(file_path),
                                    job.user_id,
                                    job.tenant_id,
                                    db
                                )
                                results["imported"] += 1

                            elif job.data_type == "calendar" and file_path.endswith(".ics"):
                                count = await self._import_ics(
                                    zf.read(file_path).decode("utf-8"),
                                    job.user_id,
                                    job.tenant_id,
                                    db
                                )
                                results["imported"] += count

                            elif job.data_type == "contacts" and file_path.endswith(".csv"):
                                count = await self._import_outlook_contacts(
                                    zf.read(file_path).decode("utf-8"),
                                    job.user_id,
                                    job.tenant_id,
                                    db
                                )
                                results["imported"] += count
                            else:
                                results["skipped"] += 1

                        except Exception as e:
                            job.errors.append(f"Error processing {file_path}: {str(e)}")
                            results["errors"].append(str(e))

            else:
                # Single file (ICS or CSV)
                job.total_items = 1
                job.processed_items = 1
                job.progress = 100

                try:
                    content = file_content.decode("utf-8")

                    if job.data_type == "calendar":
                        count = await self._import_ics(
                            content,
                            job.user_id,
                            job.tenant_id,
                            db
                        )
                        results["imported"] = count

                    elif job.data_type == "contacts":
                        count = await self._import_outlook_contacts(
                            content,
                            job.user_id,
                            job.tenant_id,
                            db
                        )
                        results["imported"] = count

                except Exception as e:
                    job.errors.append(str(e))
                    results["errors"].append(str(e))

            job.status = "completed"
            job.completed_at = datetime.utcnow()

        except Exception as e:
            logger.error(f"Migration job {job.job_id} failed: {e}")
            job.status = "failed"
            job.errors.append(str(e))
            results["errors"].append(str(e))

        return results

    async def import_csv(
        self,
        job: MigrationJob,
        file_content: bytes,
        mapping: Dict[str, str],
        db: AsyncSession
    ) -> Dict[str, Any]:
        """
        Import data from a generic CSV file with custom column mapping.
        """
        import csv

        job.status = "processing"
        job.started_at = datetime.utcnow()
        results = {"imported": 0, "skipped": 0, "errors": []}

        try:
            content = file_content.decode("utf-8")
            reader = csv.DictReader(io.StringIO(content))
            rows = list(reader)
            job.total_items = len(rows)

            for row in rows:
                job.processed_items += 1
                job.progress = int((job.processed_items / job.total_items) * 100)

                try:
                    # Map columns based on provided mapping
                    mapped_data = {}
                    for target_field, source_column in mapping.items():
                        if source_column in row:
                            mapped_data[target_field] = row[source_column]

                    if job.data_type == "contacts":
                        await self._create_contact(
                            mapped_data,
                            job.user_id,
                            job.tenant_id,
                            db
                        )
                        results["imported"] += 1

                except Exception as e:
                    job.errors.append(f"Row {job.processed_items}: {str(e)}")
                    results["errors"].append(str(e))

            job.status = "completed"
            job.completed_at = datetime.utcnow()

        except Exception as e:
            logger.error(f"Migration job {job.job_id} failed: {e}")
            job.status = "failed"
            job.errors.append(str(e))

        return results

    async def _import_mbox(
        self,
        content: bytes,
        user_id: str,
        tenant_id: str,
        db: AsyncSession
    ) -> int:
        """Import emails from mbox format."""
        import mailbox

        imported = 0
        with tempfile.NamedTemporaryFile(delete=False, suffix=".mbox") as f:
            f.write(content)
            f.flush()

            mbox_file = mailbox.mbox(f.name)
            for message in mbox_file:
                try:
                    # Extract email data
                    email_data = {
                        "message_id": message.get("Message-ID", str(uuid.uuid4())),
                        "subject": message.get("Subject", "(No Subject)"),
                        "from_address": message.get("From", ""),
                        "to_addresses": message.get("To", ""),
                        "cc_addresses": message.get("Cc", ""),
                        "date": message.get("Date", ""),
                        "body": self._get_email_body(message)
                    }

                    # Store in import queue for Mailcow processing
                    await self._queue_email_import(
                        email_data,
                        user_id,
                        tenant_id,
                        db
                    )
                    imported += 1

                except Exception as e:
                    logger.warning(f"Failed to import email: {e}")

        return imported

    async def _import_eml(
        self,
        content: bytes,
        user_id: str,
        tenant_id: str,
        db: AsyncSession
    ) -> None:
        """Import a single email from EML format."""
        import email

        message = email.message_from_bytes(content)
        email_data = {
            "message_id": message.get("Message-ID", str(uuid.uuid4())),
            "subject": message.get("Subject", "(No Subject)"),
            "from_address": message.get("From", ""),
            "to_addresses": message.get("To", ""),
            "cc_addresses": message.get("Cc", ""),
            "date": message.get("Date", ""),
            "body": self._get_email_body(message)
        }

        await self._queue_email_import(email_data, user_id, tenant_id, db)

    def _get_email_body(self, message) -> str:
        """Extract body from email message."""
        if message.is_multipart():
            for part in message.walk():
                content_type = part.get_content_type()
                if content_type == "text/plain":
                    try:
                        return part.get_payload(decode=True).decode("utf-8", errors="ignore")
                    except Exception:
                        pass
                elif content_type == "text/html":
                    try:
                        return part.get_payload(decode=True).decode("utf-8", errors="ignore")
                    except Exception:
                        pass
        else:
            try:
                return message.get_payload(decode=True).decode("utf-8", errors="ignore")
            except Exception:
                pass
        return ""

    async def _queue_email_import(
        self,
        email_data: dict,
        user_id: str,
        tenant_id: str,
        db: AsyncSession
    ) -> None:
        """Queue email for import to Mailcow."""
        await db.execute(
            text("""
                INSERT INTO workspace.import_queue
                (id, tenant_id, user_id, import_type, data, status, created_at)
                VALUES (gen_random_uuid(), CAST(:tenant_id AS uuid),
                        CAST(:user_id AS uuid), 'email',
                        :data::jsonb, 'pending', NOW())
            """),
            {
                "tenant_id": tenant_id,
                "user_id": user_id,
                "data": json.dumps(email_data)
            }
        )
        await db.commit()

    async def _import_ics(
        self,
        content: str,
        user_id: str,
        tenant_id: str,
        db: AsyncSession
    ) -> int:
        """Import calendar events from ICS format."""
        from icalendar import Calendar

        imported = 0
        cal = Calendar.from_ical(content)

        for component in cal.walk():
            if component.name == "VEVENT":
                try:
                    event_data = {
                        "uid": str(component.get("uid", uuid.uuid4())),
                        "summary": str(component.get("summary", "Untitled Event")),
                        "description": str(component.get("description", "")),
                        "location": str(component.get("location", "")),
                        "start": component.get("dtstart").dt.isoformat() if component.get("dtstart") else None,
                        "end": component.get("dtend").dt.isoformat() if component.get("dtend") else None,
                        "all_day": not hasattr(component.get("dtstart").dt, "hour") if component.get("dtstart") else False
                    }

                    # Queue for CalDAV import
                    await self._queue_calendar_import(
                        event_data,
                        user_id,
                        tenant_id,
                        db
                    )
                    imported += 1

                except Exception as e:
                    logger.warning(f"Failed to import calendar event: {e}")

        return imported

    async def _queue_calendar_import(
        self,
        event_data: dict,
        user_id: str,
        tenant_id: str,
        db: AsyncSession
    ) -> None:
        """Queue calendar event for import to Nextcloud CalDAV."""
        await db.execute(
            text("""
                INSERT INTO workspace.import_queue
                (id, tenant_id, user_id, import_type, data, status, created_at)
                VALUES (gen_random_uuid(), CAST(:tenant_id AS uuid),
                        CAST(:user_id AS uuid), 'calendar',
                        :data::jsonb, 'pending', NOW())
            """),
            {
                "tenant_id": tenant_id,
                "user_id": user_id,
                "data": json.dumps(event_data)
            }
        )
        await db.commit()

    async def _import_contacts(
        self,
        content: bytes,
        is_vcf: bool,
        user_id: str,
        tenant_id: str,
        db: AsyncSession
    ) -> int:
        """Import contacts from CSV or VCF format."""
        imported = 0

        if is_vcf:
            # Parse VCF (vCard format)
            try:
                import vobject
                vcards = vobject.readComponents(content.decode("utf-8"))

                for vcard in vcards:
                    try:
                        contact_data = {
                            "name": str(vcard.fn.value) if hasattr(vcard, "fn") else "",
                            "email": str(vcard.email.value) if hasattr(vcard, "email") else "",
                            "phone": str(vcard.tel.value) if hasattr(vcard, "tel") else "",
                            "organization": str(vcard.org.value[0]) if hasattr(vcard, "org") else ""
                        }
                        await self._create_contact(contact_data, user_id, tenant_id, db)
                        imported += 1
                    except Exception as e:
                        logger.warning(f"Failed to import vCard contact: {e}")

            except ImportError:
                logger.warning("vobject not installed, using basic VCF parsing")
                # Basic VCF parsing fallback
                vcf_text = content.decode("utf-8")
                for block in vcf_text.split("BEGIN:VCARD"):
                    if "END:VCARD" in block:
                        contact_data = self._parse_vcf_block(block)
                        if contact_data.get("email") or contact_data.get("name"):
                            await self._create_contact(contact_data, user_id, tenant_id, db)
                            imported += 1

        else:
            # Parse CSV (Google Contacts format)
            import csv
            csv_text = content.decode("utf-8")
            reader = csv.DictReader(io.StringIO(csv_text))

            for row in reader:
                try:
                    contact_data = {
                        "name": row.get("Name", row.get("First Name", "") + " " + row.get("Last Name", "")).strip(),
                        "email": row.get("E-mail 1 - Value", row.get("Email", "")),
                        "phone": row.get("Phone 1 - Value", row.get("Phone", "")),
                        "organization": row.get("Organization 1 - Name", row.get("Company", ""))
                    }
                    if contact_data.get("email") or contact_data.get("name"):
                        await self._create_contact(contact_data, user_id, tenant_id, db)
                        imported += 1
                except Exception as e:
                    logger.warning(f"Failed to import CSV contact: {e}")

        return imported

    def _parse_vcf_block(self, block: str) -> dict:
        """Basic VCF block parser."""
        data = {"name": "", "email": "", "phone": "", "organization": ""}

        for line in block.split("\n"):
            line = line.strip()
            if line.startswith("FN:"):
                data["name"] = line[3:]
            elif line.startswith("EMAIL"):
                parts = line.split(":")
                if len(parts) > 1:
                    data["email"] = parts[-1]
            elif line.startswith("TEL"):
                parts = line.split(":")
                if len(parts) > 1:
                    data["phone"] = parts[-1]
            elif line.startswith("ORG:"):
                data["organization"] = line[4:].split(";")[0]

        return data

    async def _import_outlook_contacts(
        self,
        content: str,
        user_id: str,
        tenant_id: str,
        db: AsyncSession
    ) -> int:
        """Import contacts from Outlook CSV format."""
        import csv

        imported = 0
        reader = csv.DictReader(io.StringIO(content))

        for row in reader:
            try:
                # Outlook contact CSV columns
                contact_data = {
                    "name": f"{row.get('First Name', '')} {row.get('Last Name', '')}".strip(),
                    "email": row.get("E-mail Address", row.get("Email Address", "")),
                    "phone": row.get("Primary Phone", row.get("Mobile Phone", "")),
                    "organization": row.get("Company", ""),
                    "job_title": row.get("Job Title", "")
                }

                if contact_data.get("email") or contact_data.get("name"):
                    await self._create_contact(contact_data, user_id, tenant_id, db)
                    imported += 1

            except Exception as e:
                logger.warning(f"Failed to import Outlook contact: {e}")

        return imported

    async def _create_contact(
        self,
        data: dict,
        user_id: str,
        tenant_id: str,
        db: AsyncSession
    ) -> None:
        """Create a contact in the contacts table."""
        await db.execute(
            text("""
                INSERT INTO workspace.contacts
                (id, tenant_id, user_id, name, email, phone, organization, job_title, created_at)
                VALUES (gen_random_uuid(), CAST(:tenant_id AS uuid),
                        CAST(:user_id AS uuid), :name, :email, :phone,
                        :organization, :job_title, NOW())
                ON CONFLICT (tenant_id, user_id, email) DO UPDATE SET
                    name = EXCLUDED.name,
                    phone = EXCLUDED.phone,
                    organization = EXCLUDED.organization,
                    job_title = EXCLUDED.job_title
            """),
            {
                "tenant_id": tenant_id,
                "user_id": user_id,
                "name": data.get("name", ""),
                "email": data.get("email", ""),
                "phone": data.get("phone", ""),
                "organization": data.get("organization", ""),
                "job_title": data.get("job_title", "")
            }
        )
        await db.commit()

    async def _import_document(
        self,
        content: bytes,
        file_path: str,
        user_id: str,
        tenant_id: str,
        db: AsyncSession
    ) -> None:
        """Queue document for upload to Nextcloud."""
        file_name = Path(file_path).name

        await db.execute(
            text("""
                INSERT INTO workspace.import_queue
                (id, tenant_id, user_id, import_type, data, file_content, status, created_at)
                VALUES (gen_random_uuid(), CAST(:tenant_id AS uuid),
                        CAST(:user_id AS uuid), 'document',
                        :data::jsonb, :file_content, 'pending', NOW())
            """),
            {
                "tenant_id": tenant_id,
                "user_id": user_id,
                "data": json.dumps({"file_name": file_name, "original_path": file_path}),
                "file_content": content
            }
        )
        await db.commit()

    def _is_document_file(self, file_path: str) -> bool:
        """Check if file is a document type we can import."""
        doc_extensions = {
            ".pdf", ".doc", ".docx", ".xls", ".xlsx", ".ppt", ".pptx",
            ".txt", ".rtf", ".odt", ".ods", ".odp", ".csv", ".md"
        }
        return Path(file_path).suffix.lower() in doc_extensions


# Singleton instance
migration_service = MigrationService()


# FastAPI dependency
async def get_migration_service() -> MigrationService:
    """FastAPI dependency for migration service."""
    return migration_service
