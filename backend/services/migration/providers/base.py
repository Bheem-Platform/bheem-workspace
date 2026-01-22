"""
Base provider interface for migration providers.
All providers (Google, Microsoft, IMAP) implement this interface.
"""

from abc import ABC, abstractmethod
from typing import List, Optional, AsyncIterator
from dataclasses import dataclass
from datetime import datetime


@dataclass
class EmailMessage:
    """Standardized email format across providers"""
    id: str
    subject: str
    from_email: str
    from_name: str
    to: List[str]
    cc: List[str]
    bcc: List[str]
    date: datetime
    body_text: str
    body_html: str
    attachments: List[dict]
    labels: List[str]
    is_read: bool
    is_starred: bool
    raw_mime: bytes  # Full RFC822 message for IMAP import


@dataclass
class Contact:
    """Standardized contact format"""
    id: str
    email: str
    first_name: str
    last_name: str
    display_name: str
    phone: Optional[str]
    mobile: Optional[str]
    company: Optional[str]
    job_title: Optional[str]
    photo_url: Optional[str]
    notes: Optional[str]


@dataclass
class DriveFile:
    """Standardized file format"""
    id: str
    name: str
    mime_type: str
    size: int
    path: str  # Full path including folders
    modified_at: datetime
    is_folder: bool
    download_url: Optional[str]


@dataclass
class MigrationStats:
    """Statistics for migration preview"""
    email_count: int
    email_size_bytes: int
    contact_count: int
    drive_file_count: int
    drive_size_bytes: int
    folders: List[str]


class BaseMigrationProvider(ABC):
    """Abstract base class for migration providers"""

    @abstractmethod
    async def get_user_info(self) -> dict:
        """Get connected user's info (email, name)"""
        pass

    @abstractmethod
    async def get_migration_stats(self) -> MigrationStats:
        """Get counts and sizes for preview"""
        pass

    @abstractmethod
    async def list_email_folders(self) -> List[str]:
        """List available email folders/labels"""
        pass

    @abstractmethod
    async def fetch_emails(
        self,
        folders: List[str] = None,
        since: datetime = None,
        batch_size: int = 50
    ) -> AsyncIterator[EmailMessage]:
        """Yield emails in batches"""
        pass

    @abstractmethod
    async def fetch_contacts(self) -> AsyncIterator[Contact]:
        """Yield contacts"""
        pass

    @abstractmethod
    async def list_drive_folders(self) -> List[dict]:
        """List drive folders for selection"""
        pass

    @abstractmethod
    async def fetch_drive_files(
        self,
        folder_ids: List[str] = None
    ) -> AsyncIterator[DriveFile]:
        """Yield files with download info"""
        pass

    @abstractmethod
    async def download_file(self, file: DriveFile) -> bytes:
        """Download file content"""
        pass

    @abstractmethod
    async def close(self):
        """Clean up resources"""
        pass
