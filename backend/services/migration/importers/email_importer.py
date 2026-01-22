"""
Email importer for Mailcow via IMAP.
Appends migrated emails to user's Mailcow mailbox.
"""

import imaplib
import logging
from typing import AsyncIterator, Optional
from dataclasses import dataclass

from services.migration.providers.base import EmailMessage
from core.config import settings

logger = logging.getLogger(__name__)


@dataclass
class ImportResult:
    success: bool
    message_id: str
    error: Optional[str] = None


class EmailImporter:
    """Import emails to Mailcow via IMAP"""

    def __init__(self, mailbox_email: str, mailbox_password: str):
        self.email = mailbox_email
        self.password = mailbox_password
        self.imap: Optional[imaplib.IMAP4_SSL] = None

    def connect(self):
        """Connect to Mailcow IMAP"""
        self.imap = imaplib.IMAP4_SSL(
            settings.MAILCOW_IMAP_HOST,
            settings.MAILCOW_IMAP_PORT
        )
        self.imap.login(self.email, self.password)
        logger.info(f"Connected to Mailcow IMAP for {self.email}")

    def disconnect(self):
        """Disconnect from IMAP"""
        if self.imap:
            try:
                self.imap.logout()
            except Exception:
                pass
            self.imap = None

    def _ensure_folder(self, folder_name: str) -> str:
        """Create folder if it doesn't exist"""
        # Map common Gmail labels to IMAP folders
        folder_mapping = {
            "INBOX": "INBOX",
            "SENT": "Sent",
            "STARRED": "Starred",
            "IMPORTANT": "Important",
            "DRAFT": "Drafts",
            "TRASH": "Trash",
        }

        target_folder = folder_mapping.get(folder_name, folder_name)

        # Try to create folder (will fail silently if exists)
        try:
            self.imap.create(target_folder)
        except Exception:
            pass

        return target_folder

    def import_email(self, email_msg: EmailMessage) -> ImportResult:
        """Import a single email to Mailcow"""
        try:
            # Determine target folder based on labels
            target_folder = "INBOX"
            for label in email_msg.labels:
                if label == "SENT":
                    target_folder = "Sent"
                    break
                elif label == "STARRED":
                    target_folder = "Starred"
                    break

            # Ensure folder exists
            folder = self._ensure_folder(target_folder)

            # Select folder
            self.imap.select(folder)

            # Build flags
            flags = []
            if email_msg.is_read:
                flags.append("\\Seen")
            if email_msg.is_starred:
                flags.append("\\Flagged")

            flags_str = f"({' '.join(flags)})" if flags else "()"

            # Append message
            result = self.imap.append(
                folder,
                flags_str,
                email_msg.date,
                email_msg.raw_mime
            )

            if result[0] == "OK":
                return ImportResult(
                    success=True,
                    message_id=email_msg.id
                )
            else:
                return ImportResult(
                    success=False,
                    message_id=email_msg.id,
                    error=str(result)
                )

        except Exception as e:
            logger.error(f"Failed to import email {email_msg.id}: {e}")
            return ImportResult(
                success=False,
                message_id=email_msg.id,
                error=str(e)
            )

    async def import_batch(
        self,
        emails: AsyncIterator[EmailMessage],
        progress_callback=None
    ) -> dict:
        """Import multiple emails with progress tracking"""
        self.connect()

        stats = {
            "total": 0,
            "success": 0,
            "failed": 0,
            "errors": []
        }

        try:
            async for email_msg in emails:
                stats["total"] += 1

                result = self.import_email(email_msg)

                if result.success:
                    stats["success"] += 1
                else:
                    stats["failed"] += 1
                    stats["errors"].append({
                        "message_id": result.message_id,
                        "error": result.error
                    })

                # Report progress
                if progress_callback:
                    await progress_callback(stats)

        finally:
            self.disconnect()

        return stats
