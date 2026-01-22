# One-Click Migration Implementation Plan

> **Goal:** Easy one-click migration from Google Workspace / Microsoft 365 to Bheem Workspace
> **Features:** Email, Contacts, Drive sync with minimal user effort

---

## Table of Contents

1. [Overview](#1-overview)
2. [Architecture](#2-architecture)
3. [Database Schema](#3-database-schema)
4. [Backend Implementation](#4-backend-implementation)
5. [Frontend Implementation](#5-frontend-implementation)
6. [Google OAuth Setup](#6-google-oauth-setup)
7. [Microsoft OAuth Setup](#7-microsoft-oauth-setup)
8. [API Reference](#8-api-reference)
9. [Testing](#9-testing)
10. [Deployment Checklist](#10-deployment-checklist)

---

## 1. Overview

### 1.1 User Journey (One-Click Flow)

```
User visits /admin/migration
        ↓
Clicks "Connect Google Account"
        ↓
Google OAuth popup → User approves
        ↓
Back to Bheem → Sees connected account
        ↓
Clicks "Start Migration" button
        ↓
Selects: ☑️ Email ☑️ Contacts ☑️ Drive
        ↓
Clicks "Migrate Now" (ONE CLICK)
        ↓
Progress bar shows real-time status
        ↓
Done! All data in Bheem Workspace
```

### 1.2 Supported Sources

| Source | Email | Contacts | Drive |
|--------|-------|----------|-------|
| Google Workspace | ✅ Gmail API | ✅ People API | ✅ Drive API |
| Microsoft 365 | ✅ Graph API | ✅ Graph API | ✅ OneDrive API |
| IMAP (fallback) | ✅ IMAP | ❌ | ❌ |

### 1.3 Target Systems

| Data Type | Target System | Method |
|-----------|---------------|--------|
| Email | Mailcow | IMAP append |
| Contacts | Workspace DB | Direct insert |
| Drive | Nextcloud | WebDAV upload |

---

## 2. Architecture

### 2.1 System Flow

```
┌──────────────────────────────────────────────────────────────────────┐
│                           FRONTEND                                    │
│  /admin/migration                                                     │
│  ┌────────────────┐  ┌────────────────┐  ┌────────────────┐         │
│  │ Connect Google │  │ Connect Microsoft│ │ Connect IMAP  │         │
│  └───────┬────────┘  └───────┬─────────┘ └───────┬────────┘         │
│          │                   │                   │                   │
│          └───────────────────┴───────────────────┘                   │
│                              │                                        │
│                    ┌─────────▼─────────┐                             │
│                    │  Migration Modal   │                             │
│                    │  [Start Migration] │                             │
│                    └─────────┬─────────┘                             │
│                              │                                        │
│                    ┌─────────▼─────────┐                             │
│                    │  Progress Tracker  │                             │
│                    │  ████████░░ 80%    │                             │
│                    └───────────────────┘                             │
└──────────────────────────────────────────────────────────────────────┘
                               │
                               ▼
┌──────────────────────────────────────────────────────────────────────┐
│                           BACKEND API                                 │
│                                                                       │
│  POST /migration/connect/google     ──► OAuth URL                    │
│  GET  /migration/callback/google    ◄── OAuth callback               │
│  POST /migration/start              ──► Start migration job          │
│  GET  /migration/jobs/{id}          ──► Job progress (polling)       │
│  WS   /migration/jobs/{id}/stream   ──► Real-time updates            │
└──────────────────────────────────────────────────────────────────────┘
                               │
                               ▼
┌──────────────────────────────────────────────────────────────────────┐
│                      MIGRATION ORCHESTRATOR                           │
│                                                                       │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐                  │
│  │   Google    │  │  Microsoft  │  │    IMAP     │                  │
│  │  Provider   │  │  Provider   │  │  Provider   │                  │
│  └──────┬──────┘  └──────┬──────┘  └──────┬──────┘                  │
│         │                │                │                          │
│         └────────────────┼────────────────┘                          │
│                          ▼                                            │
│  ┌──────────────────────────────────────────────────────────────┐   │
│  │                    IMPORT WORKERS                             │   │
│  │  ┌────────────┐  ┌────────────┐  ┌────────────┐              │   │
│  │  │   Email    │  │  Contact   │  │   Drive    │              │   │
│  │  │  Importer  │  │  Importer  │  │  Importer  │              │   │
│  │  └─────┬──────┘  └─────┬──────┘  └─────┬──────┘              │   │
│  └────────┼───────────────┼───────────────┼─────────────────────┘   │
│           │               │               │                          │
│           ▼               ▼               ▼                          │
│       Mailcow        Workspace DB     Nextcloud                      │
│       (IMAP)         (PostgreSQL)     (WebDAV)                       │
└──────────────────────────────────────────────────────────────────────┘
```

### 2.2 File Structure

```
backend/
├── api/
│   └── migration_v2.py                 # Migration API endpoints
├── services/
│   └── migration/
│       ├── __init__.py
│       ├── orchestrator.py             # Main orchestrator
│       ├── oauth_service.py            # OAuth token management
│       ├── providers/
│       │   ├── __init__.py
│       │   ├── base.py                 # Abstract base provider
│       │   ├── google_provider.py      # Google APIs
│       │   ├── microsoft_provider.py   # Microsoft Graph
│       │   └── imap_provider.py        # IMAP fallback
│       ├── importers/
│       │   ├── __init__.py
│       │   ├── email_importer.py       # → Mailcow
│       │   ├── contact_importer.py     # → Workspace DB
│       │   └── drive_importer.py       # → Nextcloud
│       └── encryption.py               # Token encryption

frontend/
├── src/
│   ├── pages/admin/migration/
│   │   └── index.tsx                   # Main migration page
│   ├── components/migration/
│   │   ├── ProviderCard.tsx            # Google/Microsoft cards
│   │   ├── ConnectionList.tsx          # Connected accounts
│   │   ├── MigrationModal.tsx          # Start migration modal
│   │   ├── DataSelector.tsx            # Select what to migrate
│   │   └── ProgressTracker.tsx         # Real-time progress
│   └── lib/
│       └── migrationApi.ts             # API client
```

---

## 3. Database Schema

### 3.1 Migration Tables

```sql
-- File: backend/migrations/add_migration_tables.sql

-- Store OAuth connections for migration
CREATE TABLE IF NOT EXISTS workspace.migration_connections (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES workspace.tenants(id) ON DELETE CASCADE,
    user_id UUID NOT NULL,

    -- Provider info
    provider VARCHAR(50) NOT NULL,  -- 'google', 'microsoft', 'imap'
    provider_email VARCHAR(255),     -- user@gmail.com
    provider_name VARCHAR(255),      -- "John Doe"

    -- OAuth tokens (encrypted)
    access_token TEXT,               -- Fernet encrypted
    refresh_token TEXT,              -- Fernet encrypted
    token_expiry TIMESTAMP,
    scopes TEXT[],

    -- IMAP credentials (for non-OAuth)
    imap_host VARCHAR(255),
    imap_port INTEGER,
    imap_username VARCHAR(255),
    imap_password TEXT,              -- Fernet encrypted
    imap_use_ssl BOOLEAN DEFAULT true,

    -- Status
    is_active BOOLEAN DEFAULT true,
    last_used_at TIMESTAMP,

    -- Timestamps
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),

    UNIQUE(tenant_id, provider, provider_email)
);

-- Track migration jobs
CREATE TABLE IF NOT EXISTS workspace.migration_jobs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES workspace.tenants(id) ON DELETE CASCADE,
    user_id UUID NOT NULL,
    connection_id UUID REFERENCES workspace.migration_connections(id) ON DELETE SET NULL,

    -- Job configuration
    job_type VARCHAR(50) NOT NULL,   -- 'full', 'email', 'contacts', 'drive'
    config JSONB DEFAULT '{}',       -- Selected folders, date range, etc.

    -- Status
    status VARCHAR(50) DEFAULT 'pending',  -- pending, running, completed, failed, cancelled

    -- Progress tracking
    progress_percent INTEGER DEFAULT 0,
    current_task VARCHAR(255),

    -- Item counts
    items_total INTEGER DEFAULT 0,
    items_processed INTEGER DEFAULT 0,
    items_failed INTEGER DEFAULT 0,

    -- Sub-task progress
    email_status VARCHAR(50) DEFAULT 'pending',
    email_progress INTEGER DEFAULT 0,
    email_total INTEGER DEFAULT 0,
    email_processed INTEGER DEFAULT 0,

    contacts_status VARCHAR(50) DEFAULT 'pending',
    contacts_progress INTEGER DEFAULT 0,
    contacts_total INTEGER DEFAULT 0,
    contacts_processed INTEGER DEFAULT 0,

    drive_status VARCHAR(50) DEFAULT 'pending',
    drive_progress INTEGER DEFAULT 0,
    drive_total INTEGER DEFAULT 0,
    drive_processed INTEGER DEFAULT 0,
    bytes_transferred BIGINT DEFAULT 0,

    -- Error tracking
    errors JSONB DEFAULT '[]',

    -- Timestamps
    started_at TIMESTAMP,
    completed_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Store imported contacts
CREATE TABLE IF NOT EXISTS workspace.contacts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES workspace.tenants(id) ON DELETE CASCADE,
    user_id UUID NOT NULL,

    -- Contact info
    email VARCHAR(255),
    first_name VARCHAR(255),
    last_name VARCHAR(255),
    display_name VARCHAR(255),
    phone VARCHAR(50),
    mobile VARCHAR(50),
    company VARCHAR(255),
    job_title VARCHAR(255),

    -- Additional data
    photo_url TEXT,
    notes TEXT,
    metadata JSONB DEFAULT '{}',

    -- Source tracking
    source VARCHAR(50),              -- 'google', 'microsoft', 'csv', 'manual'
    source_id VARCHAR(255),          -- External ID for deduplication

    -- Timestamps
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),

    UNIQUE(tenant_id, user_id, source, source_id)
);

-- Indexes for performance
CREATE INDEX idx_migration_connections_tenant ON workspace.migration_connections(tenant_id);
CREATE INDEX idx_migration_jobs_tenant ON workspace.migration_jobs(tenant_id);
CREATE INDEX idx_migration_jobs_status ON workspace.migration_jobs(status);
CREATE INDEX idx_contacts_tenant_user ON workspace.contacts(tenant_id, user_id);
CREATE INDEX idx_contacts_email ON workspace.contacts(email);
```

---

## 4. Backend Implementation

### 4.1 Step 1: Create Base Provider Interface

```python
# File: backend/services/migration/providers/base.py

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
```

### 4.2 Step 2: Google Provider Implementation

```python
# File: backend/services/migration/providers/google_provider.py

import asyncio
import aiohttp
from typing import List, AsyncIterator, Optional
from datetime import datetime
import base64
import email
from email import policy

from .base import (
    BaseMigrationProvider,
    EmailMessage,
    Contact,
    DriveFile,
    MigrationStats
)


class GoogleMigrationProvider(BaseMigrationProvider):
    """Google Workspace migration provider using Gmail, People, and Drive APIs"""

    GMAIL_API = "https://gmail.googleapis.com/gmail/v1"
    PEOPLE_API = "https://people.googleapis.com/v1"
    DRIVE_API = "https://www.googleapis.com/drive/v3"

    def __init__(self, access_token: str, refresh_token: str = None):
        self.access_token = access_token
        self.refresh_token = refresh_token
        self._session: Optional[aiohttp.ClientSession] = None

    async def _get_session(self) -> aiohttp.ClientSession:
        if self._session is None or self._session.closed:
            self._session = aiohttp.ClientSession(
                headers={"Authorization": f"Bearer {self.access_token}"}
            )
        return self._session

    async def _request(self, url: str, method: str = "GET", **kwargs) -> dict:
        session = await self._get_session()
        async with session.request(method, url, **kwargs) as resp:
            if resp.status == 401:
                # Token expired - would need refresh logic here
                raise Exception("Token expired")
            resp.raise_for_status()
            return await resp.json()

    async def get_user_info(self) -> dict:
        """Get Google user profile"""
        data = await self._request(f"{self.GMAIL_API}/users/me/profile")
        return {
            "email": data.get("emailAddress"),
            "messages_total": data.get("messagesTotal", 0),
            "threads_total": data.get("threadsTotal", 0)
        }

    async def get_migration_stats(self) -> MigrationStats:
        """Get counts for migration preview"""
        # Get email count
        profile = await self.get_user_info()
        email_count = profile.get("messages_total", 0)

        # Get contact count
        contacts_resp = await self._request(
            f"{self.PEOPLE_API}/people/me/connections",
            params={"pageSize": 1, "personFields": "names"}
        )
        contact_count = contacts_resp.get("totalPeople", 0)

        # Get drive stats
        drive_resp = await self._request(
            f"{self.DRIVE_API}/about",
            params={"fields": "storageQuota"}
        )
        quota = drive_resp.get("storageQuota", {})
        drive_size = int(quota.get("usageInDrive", 0))

        # Get folder list
        folders = await self.list_email_folders()

        return MigrationStats(
            email_count=email_count,
            email_size_bytes=0,  # Gmail doesn't provide this easily
            contact_count=contact_count,
            drive_file_count=0,  # Would need to count
            drive_size_bytes=drive_size,
            folders=folders
        )

    async def list_email_folders(self) -> List[str]:
        """List Gmail labels"""
        data = await self._request(f"{self.GMAIL_API}/users/me/labels")
        labels = data.get("labels", [])
        # Filter to user-visible labels
        return [
            label["name"] for label in labels
            if label.get("type") in ["user", "system"]
            and label["name"] not in ["SPAM", "TRASH", "DRAFT"]
        ]

    async def fetch_emails(
        self,
        folders: List[str] = None,
        since: datetime = None,
        batch_size: int = 50
    ) -> AsyncIterator[EmailMessage]:
        """Fetch emails from Gmail"""

        # Build query
        query_parts = []
        if folders:
            label_query = " OR ".join([f"label:{f}" for f in folders])
            query_parts.append(f"({label_query})")
        if since:
            query_parts.append(f"after:{since.strftime('%Y/%m/%d')}")

        query = " ".join(query_parts) if query_parts else None

        # Paginate through messages
        page_token = None
        while True:
            params = {"maxResults": batch_size}
            if query:
                params["q"] = query
            if page_token:
                params["pageToken"] = page_token

            list_resp = await self._request(
                f"{self.GMAIL_API}/users/me/messages",
                params=params
            )

            messages = list_resp.get("messages", [])
            if not messages:
                break

            # Fetch full message details in parallel
            tasks = [
                self._fetch_single_email(msg["id"])
                for msg in messages
            ]
            results = await asyncio.gather(*tasks, return_exceptions=True)

            for result in results:
                if isinstance(result, EmailMessage):
                    yield result

            page_token = list_resp.get("nextPageToken")
            if not page_token:
                break

    async def _fetch_single_email(self, message_id: str) -> EmailMessage:
        """Fetch a single email with full RFC822 content"""
        # Get raw format for IMAP import
        data = await self._request(
            f"{self.GMAIL_API}/users/me/messages/{message_id}",
            params={"format": "raw"}
        )

        raw_bytes = base64.urlsafe_b64decode(data["raw"])
        msg = email.message_from_bytes(raw_bytes, policy=policy.default)

        # Parse headers
        labels = data.get("labelIds", [])

        return EmailMessage(
            id=message_id,
            subject=msg.get("Subject", "(No Subject)"),
            from_email=msg.get("From", ""),
            from_name="",
            to=[msg.get("To", "")],
            cc=[msg.get("Cc", "")] if msg.get("Cc") else [],
            bcc=[],
            date=datetime.now(),  # Would parse from headers
            body_text=self._get_body(msg, "text/plain"),
            body_html=self._get_body(msg, "text/html"),
            attachments=[],
            labels=labels,
            is_read="UNREAD" not in labels,
            is_starred="STARRED" in labels,
            raw_mime=raw_bytes
        )

    def _get_body(self, msg, content_type: str) -> str:
        """Extract body from email message"""
        if msg.is_multipart():
            for part in msg.walk():
                if part.get_content_type() == content_type:
                    return part.get_content()
        elif msg.get_content_type() == content_type:
            return msg.get_content()
        return ""

    async def fetch_contacts(self) -> AsyncIterator[Contact]:
        """Fetch Google contacts"""
        page_token = None

        while True:
            params = {
                "pageSize": 100,
                "personFields": "names,emailAddresses,phoneNumbers,organizations,photos,biographies"
            }
            if page_token:
                params["pageToken"] = page_token

            data = await self._request(
                f"{self.PEOPLE_API}/people/me/connections",
                params=params
            )

            connections = data.get("connections", [])

            for person in connections:
                # Extract primary email
                emails = person.get("emailAddresses", [])
                primary_email = next(
                    (e["value"] for e in emails if e.get("metadata", {}).get("primary")),
                    emails[0]["value"] if emails else None
                )

                if not primary_email:
                    continue

                # Extract name
                names = person.get("names", [{}])
                name = names[0] if names else {}

                # Extract phone
                phones = person.get("phoneNumbers", [])
                phone = phones[0]["value"] if phones else None

                # Extract organization
                orgs = person.get("organizations", [{}])
                org = orgs[0] if orgs else {}

                # Extract photo
                photos = person.get("photos", [])
                photo_url = photos[0]["url"] if photos else None

                yield Contact(
                    id=person["resourceName"],
                    email=primary_email,
                    first_name=name.get("givenName", ""),
                    last_name=name.get("familyName", ""),
                    display_name=name.get("displayName", primary_email),
                    phone=phone,
                    mobile=None,
                    company=org.get("name"),
                    job_title=org.get("title"),
                    photo_url=photo_url,
                    notes=None
                )

            page_token = data.get("nextPageToken")
            if not page_token:
                break

    async def list_drive_folders(self) -> List[dict]:
        """List Drive folders"""
        folders = []
        page_token = None

        while True:
            params = {
                "q": "mimeType='application/vnd.google-apps.folder' and trashed=false",
                "fields": "files(id,name,parents),nextPageToken",
                "pageSize": 100
            }
            if page_token:
                params["pageToken"] = page_token

            data = await self._request(f"{self.DRIVE_API}/files", params=params)

            for file in data.get("files", []):
                folders.append({
                    "id": file["id"],
                    "name": file["name"],
                    "parent_id": file.get("parents", [None])[0]
                })

            page_token = data.get("nextPageToken")
            if not page_token:
                break

        return folders

    async def fetch_drive_files(
        self,
        folder_ids: List[str] = None
    ) -> AsyncIterator[DriveFile]:
        """Fetch Drive files"""

        # Build query
        query_parts = ["trashed=false"]
        if folder_ids:
            parent_query = " or ".join([f"'{fid}' in parents" for fid in folder_ids])
            query_parts.append(f"({parent_query})")

        query = " and ".join(query_parts)
        page_token = None

        while True:
            params = {
                "q": query,
                "fields": "files(id,name,mimeType,size,modifiedTime,parents),nextPageToken",
                "pageSize": 100
            }
            if page_token:
                params["pageToken"] = page_token

            data = await self._request(f"{self.DRIVE_API}/files", params=params)

            for file in data.get("files", []):
                is_folder = file["mimeType"] == "application/vnd.google-apps.folder"

                yield DriveFile(
                    id=file["id"],
                    name=file["name"],
                    mime_type=file["mimeType"],
                    size=int(file.get("size", 0)),
                    path=f"/{file['name']}",  # Would need to build full path
                    modified_at=datetime.fromisoformat(
                        file["modifiedTime"].replace("Z", "+00:00")
                    ),
                    is_folder=is_folder,
                    download_url=None  # Use download_file method
                )

            page_token = data.get("nextPageToken")
            if not page_token:
                break

    async def download_file(self, file: DriveFile) -> bytes:
        """Download file from Drive"""
        # Handle Google Docs export
        if file.mime_type.startswith("application/vnd.google-apps."):
            export_mime = self._get_export_mime(file.mime_type)
            url = f"{self.DRIVE_API}/files/{file.id}/export"
            params = {"mimeType": export_mime}
        else:
            url = f"{self.DRIVE_API}/files/{file.id}"
            params = {"alt": "media"}

        session = await self._get_session()
        async with session.get(url, params=params) as resp:
            resp.raise_for_status()
            return await resp.read()

    def _get_export_mime(self, google_mime: str) -> str:
        """Map Google Docs MIME types to export formats"""
        mapping = {
            "application/vnd.google-apps.document": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
            "application/vnd.google-apps.spreadsheet": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            "application/vnd.google-apps.presentation": "application/vnd.openxmlformats-officedocument.presentationml.presentation",
        }
        return mapping.get(google_mime, "application/pdf")

    async def close(self):
        """Close HTTP session"""
        if self._session and not self._session.closed:
            await self._session.close()
```

### 4.3 Step 3: OAuth Service

```python
# File: backend/services/migration/oauth_service.py

import secrets
from typing import Optional, Dict, Any
from datetime import datetime, timedelta
from urllib.parse import urlencode
import aiohttp
from cryptography.fernet import Fernet

from core.config import settings


class OAuthService:
    """Handle OAuth flows for migration providers"""

    # Google OAuth endpoints
    GOOGLE_AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth"
    GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token"
    GOOGLE_SCOPES = [
        "https://www.googleapis.com/auth/gmail.readonly",
        "https://www.googleapis.com/auth/contacts.readonly",
        "https://www.googleapis.com/auth/drive.readonly",
        "https://www.googleapis.com/auth/userinfo.email",
        "https://www.googleapis.com/auth/userinfo.profile",
    ]

    # Microsoft OAuth endpoints
    MICROSOFT_AUTH_URL = "https://login.microsoftonline.com/common/oauth2/v2.0/authorize"
    MICROSOFT_TOKEN_URL = "https://login.microsoftonline.com/common/oauth2/v2.0/token"
    MICROSOFT_SCOPES = [
        "Mail.Read",
        "Contacts.Read",
        "Files.Read.All",
        "User.Read",
        "offline_access",
    ]

    def __init__(self):
        self.fernet = Fernet(settings.ENCRYPTION_KEY.encode())
        self._state_store: Dict[str, dict] = {}  # In production, use Redis

    def encrypt_token(self, token: str) -> str:
        """Encrypt token for storage"""
        return self.fernet.encrypt(token.encode()).decode()

    def decrypt_token(self, encrypted: str) -> str:
        """Decrypt stored token"""
        return self.fernet.decrypt(encrypted.encode()).decode()

    def generate_state(self, tenant_id: str, user_id: str, provider: str) -> str:
        """Generate OAuth state parameter"""
        state = secrets.token_urlsafe(32)
        self._state_store[state] = {
            "tenant_id": tenant_id,
            "user_id": user_id,
            "provider": provider,
            "created_at": datetime.utcnow()
        }
        return state

    def validate_state(self, state: str) -> Optional[dict]:
        """Validate and consume state parameter"""
        data = self._state_store.pop(state, None)
        if not data:
            return None
        # Check expiry (10 minutes)
        if datetime.utcnow() - data["created_at"] > timedelta(minutes=10):
            return None
        return data

    def get_google_auth_url(
        self,
        tenant_id: str,
        user_id: str,
        redirect_uri: str
    ) -> str:
        """Generate Google OAuth authorization URL"""
        state = self.generate_state(tenant_id, user_id, "google")

        params = {
            "client_id": settings.GOOGLE_CLIENT_ID,
            "redirect_uri": redirect_uri,
            "response_type": "code",
            "scope": " ".join(self.GOOGLE_SCOPES),
            "state": state,
            "access_type": "offline",  # Get refresh token
            "prompt": "consent",  # Force consent to get refresh token
        }

        return f"{self.GOOGLE_AUTH_URL}?{urlencode(params)}"

    async def exchange_google_code(
        self,
        code: str,
        redirect_uri: str
    ) -> Dict[str, Any]:
        """Exchange authorization code for tokens"""
        async with aiohttp.ClientSession() as session:
            async with session.post(
                self.GOOGLE_TOKEN_URL,
                data={
                    "client_id": settings.GOOGLE_CLIENT_ID,
                    "client_secret": settings.GOOGLE_CLIENT_SECRET,
                    "code": code,
                    "grant_type": "authorization_code",
                    "redirect_uri": redirect_uri,
                }
            ) as resp:
                resp.raise_for_status()
                data = await resp.json()

                return {
                    "access_token": data["access_token"],
                    "refresh_token": data.get("refresh_token"),
                    "expires_in": data.get("expires_in", 3600),
                    "token_type": data.get("token_type", "Bearer"),
                    "scope": data.get("scope", "").split(),
                }

    async def refresh_google_token(self, refresh_token: str) -> Dict[str, Any]:
        """Refresh expired Google access token"""
        async with aiohttp.ClientSession() as session:
            async with session.post(
                self.GOOGLE_TOKEN_URL,
                data={
                    "client_id": settings.GOOGLE_CLIENT_ID,
                    "client_secret": settings.GOOGLE_CLIENT_SECRET,
                    "refresh_token": refresh_token,
                    "grant_type": "refresh_token",
                }
            ) as resp:
                resp.raise_for_status()
                data = await resp.json()

                return {
                    "access_token": data["access_token"],
                    "expires_in": data.get("expires_in", 3600),
                }

    def get_microsoft_auth_url(
        self,
        tenant_id: str,
        user_id: str,
        redirect_uri: str
    ) -> str:
        """Generate Microsoft OAuth authorization URL"""
        state = self.generate_state(tenant_id, user_id, "microsoft")

        params = {
            "client_id": settings.MICROSOFT_CLIENT_ID,
            "redirect_uri": redirect_uri,
            "response_type": "code",
            "scope": " ".join(self.MICROSOFT_SCOPES),
            "state": state,
            "response_mode": "query",
        }

        return f"{self.MICROSOFT_AUTH_URL}?{urlencode(params)}"

    async def exchange_microsoft_code(
        self,
        code: str,
        redirect_uri: str
    ) -> Dict[str, Any]:
        """Exchange Microsoft authorization code for tokens"""
        async with aiohttp.ClientSession() as session:
            async with session.post(
                self.MICROSOFT_TOKEN_URL,
                data={
                    "client_id": settings.MICROSOFT_CLIENT_ID,
                    "client_secret": settings.MICROSOFT_CLIENT_SECRET,
                    "code": code,
                    "grant_type": "authorization_code",
                    "redirect_uri": redirect_uri,
                }
            ) as resp:
                resp.raise_for_status()
                return await resp.json()


# Singleton
oauth_service = OAuthService()
```

### 4.4 Step 4: Email Importer (to Mailcow)

```python
# File: backend/services/migration/importers/email_importer.py

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
            except:
                pass
            self.imap = None

    def _ensure_folder(self, folder_name: str):
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
        except:
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
```

### 4.5 Step 5: Contact Importer

```python
# File: backend/services/migration/importers/contact_importer.py

import logging
from typing import AsyncIterator, List
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
            await self.db.execute(
                text("""
                    INSERT INTO workspace.contacts (
                        tenant_id, user_id, email, first_name, last_name,
                        display_name, phone, mobile, company, job_title,
                        photo_url, source, source_id
                    ) VALUES (
                        :tenant_id, :user_id, :email, :first_name, :last_name,
                        :display_name, :phone, :mobile, :company, :job_title,
                        :photo_url, :source, :source_id
                    )
                    ON CONFLICT (tenant_id, user_id, source, source_id)
                    DO UPDATE SET
                        email = EXCLUDED.email,
                        first_name = EXCLUDED.first_name,
                        last_name = EXCLUDED.last_name,
                        display_name = EXCLUDED.display_name,
                        phone = EXCLUDED.phone,
                        mobile = EXCLUDED.mobile,
                        company = EXCLUDED.company,
                        job_title = EXCLUDED.job_title,
                        photo_url = EXCLUDED.photo_url,
                        updated_at = NOW()
                """),
                {
                    "tenant_id": str(self.tenant_id),
                    "user_id": str(self.user_id),
                    "email": contact.email,
                    "first_name": contact.first_name,
                    "last_name": contact.last_name,
                    "display_name": contact.display_name,
                    "phone": contact.phone,
                    "mobile": contact.mobile,
                    "company": contact.company,
                    "job_title": contact.job_title,
                    "photo_url": contact.photo_url,
                    "source": source,
                    "source_id": contact.id,
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
```

### 4.6 Step 6: Drive Importer (to Nextcloud)

```python
# File: backend/services/migration/importers/drive_importer.py

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
```

### 4.7 Step 7: Migration Orchestrator

```python
# File: backend/services/migration/orchestrator.py

import asyncio
import logging
from uuid import UUID, uuid4
from datetime import datetime
from typing import Optional, Dict, Any, List
from dataclasses import dataclass, field

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

        await self.db.execute(
            text("""
                INSERT INTO workspace.migration_jobs (
                    id, tenant_id, user_id, connection_id, job_type, config, status
                ) VALUES (
                    :id, :tenant_id, :user_id, :connection_id, :job_type, :config, 'pending'
                )
            """),
            {
                "id": str(job_id),
                "tenant_id": str(tenant_id),
                "user_id": str(user_id),
                "connection_id": str(connection_id),
                "job_type": "full",
                "config": {
                    "migrate_email": config.migrate_email,
                    "migrate_contacts": config.migrate_contacts,
                    "migrate_drive": config.migrate_drive,
                    "email_folders": config.email_folders,
                    "drive_folders": config.drive_folders,
                }
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
                if config.migrate_email:
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

                # ========== DRIVE MIGRATION ==========
                if config.migrate_drive:
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
                    errors = :errors,
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
                "errors": progress.errors if progress else [],
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
```

### 4.8 Step 8: API Endpoints

```python
# File: backend/api/migration_v2.py

from uuid import UUID
from typing import Optional, List
from fastapi import APIRouter, Depends, HTTPException, Query, BackgroundTasks
from fastapi.responses import RedirectResponse
from pydantic import BaseModel, EmailStr
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import text

from core.database import get_db
from core.security import get_current_user
from services.migration.oauth_service import oauth_service
from services.migration.orchestrator import MigrationOrchestrator, MigrationConfig
from core.config import settings


router = APIRouter(prefix="/migration", tags=["Migration"])


# ==================== REQUEST/RESPONSE MODELS ====================

class ConnectGoogleRequest(BaseModel):
    """Request to start Google OAuth"""
    redirect_uri: Optional[str] = None


class ConnectIMAPRequest(BaseModel):
    """Request to connect via IMAP"""
    host: str
    port: int = 993
    username: str
    password: str
    use_ssl: bool = True


class StartMigrationRequest(BaseModel):
    """Request to start migration"""
    connection_id: UUID
    migrate_email: bool = True
    migrate_contacts: bool = True
    migrate_drive: bool = True
    email_folders: List[str] = []
    drive_folders: List[str] = []


class MigrationConnectionResponse(BaseModel):
    """Migration connection info"""
    id: UUID
    provider: str
    email: str
    name: Optional[str]
    created_at: str


class MigrationPreviewResponse(BaseModel):
    """Migration preview with counts"""
    email_count: int
    contact_count: int
    drive_file_count: int
    drive_size_bytes: int
    email_folders: List[str]


class MigrationJobResponse(BaseModel):
    """Migration job status"""
    id: UUID
    status: str
    progress_percent: int
    current_task: str

    email_status: str
    email_progress: int
    email_total: int
    email_processed: int

    contacts_status: str
    contacts_progress: int
    contacts_total: int
    contacts_processed: int

    drive_status: str
    drive_progress: int
    drive_total: int
    drive_processed: int
    bytes_transferred: int

    errors: List[dict]


# ==================== HELPER FUNCTIONS ====================

async def get_user_tenant_id(current_user: dict, db: AsyncSession) -> UUID:
    """Get tenant ID for current user"""
    user_id = current_user.get("user_id") or current_user.get("sub")

    result = await db.execute(
        text("""
            SELECT tenant_id FROM workspace.tenant_users
            WHERE user_id = CAST(:user_id AS uuid)
            LIMIT 1
        """),
        {"user_id": user_id}
    )
    row = result.fetchone()
    if not row:
        raise HTTPException(status_code=400, detail="User not in any tenant")
    return row[0]


# ==================== OAUTH ENDPOINTS ====================

@router.post("/connect/google")
async def connect_google(
    request: ConnectGoogleRequest,
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Get Google OAuth URL to connect account for migration.
    Redirects user to Google consent screen.
    """
    tenant_id = await get_user_tenant_id(current_user, db)
    user_id = current_user.get("user_id") or current_user.get("sub")

    redirect_uri = request.redirect_uri or f"{settings.WORKSPACE_URL}/api/v1/migration/callback/google"

    auth_url = oauth_service.get_google_auth_url(
        tenant_id=str(tenant_id),
        user_id=user_id,
        redirect_uri=redirect_uri
    )

    return {"auth_url": auth_url}


@router.get("/callback/google")
async def google_callback(
    code: str,
    state: str,
    db: AsyncSession = Depends(get_db)
):
    """
    Handle Google OAuth callback.
    Stores tokens and redirects to frontend.
    """
    # Validate state
    state_data = oauth_service.validate_state(state)
    if not state_data:
        raise HTTPException(status_code=400, detail="Invalid or expired state")

    tenant_id = state_data["tenant_id"]
    user_id = state_data["user_id"]

    # Exchange code for tokens
    redirect_uri = f"{settings.WORKSPACE_URL}/api/v1/migration/callback/google"
    tokens = await oauth_service.exchange_google_code(code, redirect_uri)

    # Get user info from Google
    from services.migration.providers.google_provider import GoogleMigrationProvider
    provider = GoogleMigrationProvider(tokens["access_token"])
    user_info = await provider.get_user_info()
    await provider.close()

    # Store connection
    await db.execute(
        text("""
            INSERT INTO workspace.migration_connections (
                tenant_id, user_id, provider, provider_email,
                access_token, refresh_token, token_expiry, scopes
            ) VALUES (
                CAST(:tenant_id AS uuid), CAST(:user_id AS uuid), 'google', :email,
                :access_token, :refresh_token, :token_expiry, :scopes
            )
            ON CONFLICT (tenant_id, provider, provider_email) DO UPDATE SET
                access_token = EXCLUDED.access_token,
                refresh_token = COALESCE(EXCLUDED.refresh_token, workspace.migration_connections.refresh_token),
                token_expiry = EXCLUDED.token_expiry,
                updated_at = NOW()
        """),
        {
            "tenant_id": tenant_id,
            "user_id": user_id,
            "email": user_info["email"],
            "access_token": oauth_service.encrypt_token(tokens["access_token"]),
            "refresh_token": oauth_service.encrypt_token(tokens["refresh_token"]) if tokens.get("refresh_token") else None,
            "token_expiry": None,  # Would calculate from expires_in
            "scopes": tokens.get("scope", []),
        }
    )
    await db.commit()

    # Redirect to frontend
    return RedirectResponse(
        url=f"{settings.WORKSPACE_URL}/admin/migration?connected=google&email={user_info['email']}"
    )


@router.post("/connect/imap")
async def connect_imap(
    request: ConnectIMAPRequest,
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Connect via IMAP (for non-Google/Microsoft accounts)"""
    tenant_id = await get_user_tenant_id(current_user, db)
    user_id = current_user.get("user_id") or current_user.get("sub")

    # Test IMAP connection
    import imaplib
    try:
        if request.use_ssl:
            imap = imaplib.IMAP4_SSL(request.host, request.port)
        else:
            imap = imaplib.IMAP4(request.host, request.port)
        imap.login(request.username, request.password)
        imap.logout()
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"IMAP connection failed: {str(e)}")

    # Store connection
    await db.execute(
        text("""
            INSERT INTO workspace.migration_connections (
                tenant_id, user_id, provider, provider_email,
                imap_host, imap_port, imap_username, imap_password, imap_use_ssl
            ) VALUES (
                CAST(:tenant_id AS uuid), CAST(:user_id AS uuid), 'imap', :email,
                :host, :port, :username, :password, :use_ssl
            )
            ON CONFLICT (tenant_id, provider, provider_email) DO UPDATE SET
                imap_host = EXCLUDED.imap_host,
                imap_port = EXCLUDED.imap_port,
                imap_password = EXCLUDED.imap_password,
                updated_at = NOW()
        """),
        {
            "tenant_id": str(tenant_id),
            "user_id": user_id,
            "email": request.username,
            "host": request.host,
            "port": request.port,
            "username": request.username,
            "password": oauth_service.encrypt_token(request.password),
            "use_ssl": request.use_ssl,
        }
    )
    await db.commit()

    return {"status": "connected", "email": request.username}


# ==================== CONNECTION MANAGEMENT ====================

@router.get("/connections", response_model=List[MigrationConnectionResponse])
async def list_connections(
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """List connected accounts for migration"""
    tenant_id = await get_user_tenant_id(current_user, db)

    result = await db.execute(
        text("""
            SELECT id, provider, provider_email, provider_name, created_at
            FROM workspace.migration_connections
            WHERE tenant_id = :tenant_id AND is_active = true
            ORDER BY created_at DESC
        """),
        {"tenant_id": str(tenant_id)}
    )

    connections = []
    for row in result.fetchall():
        connections.append(MigrationConnectionResponse(
            id=row.id,
            provider=row.provider,
            email=row.provider_email,
            name=row.provider_name,
            created_at=row.created_at.isoformat()
        ))

    return connections


@router.delete("/connections/{connection_id}")
async def delete_connection(
    connection_id: UUID,
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Disconnect an account"""
    tenant_id = await get_user_tenant_id(current_user, db)

    await db.execute(
        text("""
            UPDATE workspace.migration_connections
            SET is_active = false, updated_at = NOW()
            WHERE id = :id AND tenant_id = :tenant_id
        """),
        {"id": str(connection_id), "tenant_id": str(tenant_id)}
    )
    await db.commit()

    return {"status": "disconnected"}


# ==================== MIGRATION PREVIEW ====================

@router.get("/preview/{connection_id}", response_model=MigrationPreviewResponse)
async def preview_migration(
    connection_id: UUID,
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Get migration preview with item counts"""
    orchestrator = MigrationOrchestrator(db)

    try:
        stats = await orchestrator.preview_migration(connection_id)

        return MigrationPreviewResponse(
            email_count=stats.email_count,
            contact_count=stats.contact_count,
            drive_file_count=stats.drive_file_count,
            drive_size_bytes=stats.drive_size_bytes,
            email_folders=stats.folders
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ==================== MIGRATION EXECUTION ====================

@router.post("/start")
async def start_migration(
    request: StartMigrationRequest,
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Start one-click migration.
    Returns job ID for progress tracking.
    """
    tenant_id = await get_user_tenant_id(current_user, db)
    user_id = current_user.get("user_id") or current_user.get("sub")

    # Get user's Mailcow credentials for email import
    # In production, would fetch from tenant_users or generate
    mailbox_email = current_user.get("email", "")
    mailbox_password = "temp_password"  # Would be stored encrypted

    # Get Nextcloud credentials for drive import
    nextcloud_user = current_user.get("email", "").split("@")[0]
    nextcloud_password = "temp_password"  # Would be stored encrypted

    config = MigrationConfig(
        migrate_email=request.migrate_email,
        migrate_contacts=request.migrate_contacts,
        migrate_drive=request.migrate_drive,
        email_folders=request.email_folders,
        drive_folders=request.drive_folders,
    )

    orchestrator = MigrationOrchestrator(db)

    job_id = await orchestrator.start_migration(
        tenant_id=tenant_id,
        user_id=UUID(user_id),
        connection_id=request.connection_id,
        config=config,
        mailbox_email=mailbox_email,
        mailbox_password=mailbox_password,
        nextcloud_user=nextcloud_user,
        nextcloud_password=nextcloud_password
    )

    return {"job_id": job_id, "status": "started"}


@router.get("/jobs/{job_id}", response_model=MigrationJobResponse)
async def get_job_status(
    job_id: UUID,
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Get migration job progress (for polling)"""
    orchestrator = MigrationOrchestrator(db)

    # Try in-memory first (for real-time progress)
    progress = orchestrator.get_job_progress(job_id)

    if progress:
        return MigrationJobResponse(
            id=progress.job_id,
            status=progress.status,
            progress_percent=progress.progress_percent,
            current_task=progress.current_task,
            email_status=progress.email_status,
            email_progress=progress.email_progress,
            email_total=progress.email_total,
            email_processed=progress.email_processed,
            contacts_status=progress.contacts_status,
            contacts_progress=progress.contacts_progress,
            contacts_total=progress.contacts_total,
            contacts_processed=progress.contacts_processed,
            drive_status=progress.drive_status,
            drive_progress=progress.drive_progress,
            drive_total=progress.drive_total,
            drive_processed=progress.drive_processed,
            bytes_transferred=progress.bytes_transferred,
            errors=progress.errors
        )

    # Fall back to database
    result = await db.execute(
        text("SELECT * FROM workspace.migration_jobs WHERE id = :id"),
        {"id": str(job_id)}
    )
    row = result.fetchone()

    if not row:
        raise HTTPException(status_code=404, detail="Job not found")

    return MigrationJobResponse(
        id=row.id,
        status=row.status,
        progress_percent=row.progress_percent,
        current_task=row.current_task or "",
        email_status=row.email_status,
        email_progress=row.email_progress,
        email_total=row.email_total,
        email_processed=row.email_processed,
        contacts_status=row.contacts_status,
        contacts_progress=row.contacts_progress,
        contacts_total=row.contacts_total,
        contacts_processed=row.contacts_processed,
        drive_status=row.drive_status,
        drive_progress=row.drive_progress,
        drive_total=row.drive_total,
        drive_processed=row.drive_processed,
        bytes_transferred=row.bytes_transferred,
        errors=row.errors or []
    )


@router.post("/jobs/{job_id}/cancel")
async def cancel_job(
    job_id: UUID,
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Cancel a running migration job"""
    orchestrator = MigrationOrchestrator(db)

    cancelled = await orchestrator.cancel_job(job_id)

    if cancelled:
        return {"status": "cancelled"}
    else:
        raise HTTPException(status_code=400, detail="Cannot cancel job")


# ==================== LIST JOBS ====================

@router.get("/jobs")
async def list_jobs(
    status: Optional[str] = None,
    limit: int = Query(default=10, le=50),
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """List migration jobs for current user"""
    tenant_id = await get_user_tenant_id(current_user, db)

    query = """
        SELECT id, status, progress_percent, current_task, created_at, completed_at
        FROM workspace.migration_jobs
        WHERE tenant_id = :tenant_id
    """
    params = {"tenant_id": str(tenant_id)}

    if status:
        query += " AND status = :status"
        params["status"] = status

    query += " ORDER BY created_at DESC LIMIT :limit"
    params["limit"] = limit

    result = await db.execute(text(query), params)

    jobs = []
    for row in result.fetchall():
        jobs.append({
            "id": row.id,
            "status": row.status,
            "progress_percent": row.progress_percent,
            "current_task": row.current_task,
            "created_at": row.created_at.isoformat(),
            "completed_at": row.completed_at.isoformat() if row.completed_at else None
        })

    return {"jobs": jobs}
```

---

## 5. Frontend Implementation

### 5.1 Step 1: Migration API Client

```typescript
// File: frontend/src/lib/migrationApi.ts

import { api } from './api';

export interface MigrationConnection {
  id: string;
  provider: 'google' | 'microsoft' | 'imap';
  email: string;
  name?: string;
  created_at: string;
}

export interface MigrationPreview {
  email_count: number;
  contact_count: number;
  drive_file_count: number;
  drive_size_bytes: number;
  email_folders: string[];
}

export interface MigrationJob {
  id: string;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';
  progress_percent: number;
  current_task: string;

  email_status: string;
  email_progress: number;
  email_total: number;
  email_processed: number;

  contacts_status: string;
  contacts_progress: number;
  contacts_total: number;
  contacts_processed: number;

  drive_status: string;
  drive_progress: number;
  drive_total: number;
  drive_processed: number;
  bytes_transferred: number;

  errors: Array<{ error: string }>;
}

export interface StartMigrationRequest {
  connection_id: string;
  migrate_email: boolean;
  migrate_contacts: boolean;
  migrate_drive: boolean;
  email_folders?: string[];
  drive_folders?: string[];
}

// ==================== API FUNCTIONS ====================

export const connectGoogle = async () => {
  const response = await api.post<{ auth_url: string }>('/migration/connect/google');
  return response.data.auth_url;
};

export const connectMicrosoft = async () => {
  const response = await api.post<{ auth_url: string }>('/migration/connect/microsoft');
  return response.data.auth_url;
};

export const connectIMAP = async (data: {
  host: string;
  port: number;
  username: string;
  password: string;
  use_ssl: boolean;
}) => {
  const response = await api.post('/migration/connect/imap', data);
  return response.data;
};

export const getConnections = async () => {
  const response = await api.get<MigrationConnection[]>('/migration/connections');
  return response.data;
};

export const deleteConnection = async (connectionId: string) => {
  await api.delete(`/migration/connections/${connectionId}`);
};

export const getPreview = async (connectionId: string) => {
  const response = await api.get<MigrationPreview>(`/migration/preview/${connectionId}`);
  return response.data;
};

export const startMigration = async (data: StartMigrationRequest) => {
  const response = await api.post<{ job_id: string }>('/migration/start', data);
  return response.data;
};

export const getJobStatus = async (jobId: string) => {
  const response = await api.get<MigrationJob>(`/migration/jobs/${jobId}`);
  return response.data;
};

export const cancelJob = async (jobId: string) => {
  await api.post(`/migration/jobs/${jobId}/cancel`);
};

export const getJobs = async (status?: string) => {
  const params = status ? { status } : {};
  const response = await api.get<{ jobs: MigrationJob[] }>('/migration/jobs', { params });
  return response.data.jobs;
};
```

### 5.2 Step 2: Migration Page

```tsx
// File: frontend/src/pages/admin/migration/index.tsx

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/router';
import {
  Cloud,
  Mail,
  Users,
  HardDrive,
  Check,
  X,
  Loader2,
  AlertCircle,
  RefreshCw,
  Trash2,
  Play,
  ArrowRight,
} from 'lucide-react';
import AdminLayout from '@/components/admin/AdminLayout';
import * as migrationApi from '@/lib/migrationApi';
import type { MigrationConnection, MigrationPreview, MigrationJob } from '@/lib/migrationApi';

// ==================== PROVIDER CARD COMPONENT ====================

interface ProviderCardProps {
  provider: 'google' | 'microsoft' | 'imap';
  title: string;
  description: string;
  icon: React.ReactNode;
  color: string;
  onConnect: () => void;
  loading?: boolean;
}

function ProviderCard({ provider, title, description, icon, color, onConnect, loading }: ProviderCardProps) {
  return (
    <div className={`bg-white rounded-xl border-2 border-gray-100 p-6 hover:border-${color}-200 hover:shadow-lg transition-all`}>
      <div className={`w-14 h-14 rounded-xl bg-${color}-100 flex items-center justify-center mb-4`}>
        {icon}
      </div>
      <h3 className="text-lg font-semibold text-gray-900 mb-2">{title}</h3>
      <p className="text-gray-500 text-sm mb-4">{description}</p>
      <button
        onClick={onConnect}
        disabled={loading}
        className={`w-full py-2.5 px-4 rounded-lg bg-${color}-600 hover:bg-${color}-700 text-white font-medium transition-colors flex items-center justify-center gap-2 disabled:opacity-50`}
      >
        {loading ? (
          <Loader2 className="h-5 w-5 animate-spin" />
        ) : (
          <>
            Connect
            <ArrowRight className="h-4 w-4" />
          </>
        )}
      </button>
    </div>
  );
}

// ==================== CONNECTION ITEM COMPONENT ====================

interface ConnectionItemProps {
  connection: MigrationConnection;
  onMigrate: () => void;
  onDelete: () => void;
}

function ConnectionItem({ connection, onMigrate, onDelete }: ConnectionItemProps) {
  const providerColors = {
    google: 'red',
    microsoft: 'blue',
    imap: 'gray',
  };
  const color = providerColors[connection.provider];

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4 flex items-center justify-between">
      <div className="flex items-center gap-4">
        <div className={`w-10 h-10 rounded-lg bg-${color}-100 flex items-center justify-center`}>
          {connection.provider === 'google' && (
            <svg className="w-6 h-6" viewBox="0 0 24 24">
              <path fill="#EA4335" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
              <path fill="#FBBC04" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
              <path fill="#4285F4" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
            </svg>
          )}
          {connection.provider === 'microsoft' && (
            <svg className="w-6 h-6" viewBox="0 0 24 24">
              <path fill="#F25022" d="M1 1h10v10H1z"/>
              <path fill="#7FBA00" d="M13 1h10v10H13z"/>
              <path fill="#00A4EF" d="M1 13h10v10H1z"/>
              <path fill="#FFB900" d="M13 13h10v10H13z"/>
            </svg>
          )}
          {connection.provider === 'imap' && <Mail className="h-6 w-6 text-gray-600" />}
        </div>
        <div>
          <p className="font-medium text-gray-900">{connection.email}</p>
          <p className="text-sm text-gray-500 capitalize">{connection.provider}</p>
        </div>
      </div>
      <div className="flex items-center gap-2">
        <button
          onClick={onMigrate}
          className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg font-medium flex items-center gap-2 transition-colors"
        >
          <Play className="h-4 w-4" />
          Migrate
        </button>
        <button
          onClick={onDelete}
          className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
        >
          <Trash2 className="h-5 w-5" />
        </button>
      </div>
    </div>
  );
}

// ==================== MIGRATION MODAL COMPONENT ====================

interface MigrationModalProps {
  connection: MigrationConnection;
  onClose: () => void;
  onStart: (config: migrationApi.StartMigrationRequest) => void;
}

function MigrationModal({ connection, onClose, onStart }: MigrationModalProps) {
  const [loading, setLoading] = useState(true);
  const [preview, setPreview] = useState<MigrationPreview | null>(null);
  const [migrateEmail, setMigrateEmail] = useState(true);
  const [migrateContacts, setMigrateContacts] = useState(true);
  const [migrateDrive, setMigrateDrive] = useState(true);

  useEffect(() => {
    const loadPreview = async () => {
      try {
        const data = await migrationApi.getPreview(connection.id);
        setPreview(data);
      } catch (error) {
        console.error('Failed to load preview:', error);
      } finally {
        setLoading(false);
      }
    };
    loadPreview();
  }, [connection.id]);

  const handleStart = () => {
    onStart({
      connection_id: connection.id,
      migrate_email: migrateEmail,
      migrate_contacts: migrateContacts,
      migrate_drive: migrateDrive,
    });
  };

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-2xl w-full max-w-lg mx-4 overflow-hidden">
        <div className="p-6 border-b border-gray-100">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold text-gray-900">
              Migrate from {connection.email}
            </h2>
            <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-lg">
              <X className="h-5 w-5 text-gray-500" />
            </button>
          </div>
        </div>

        <div className="p-6">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
            </div>
          ) : preview ? (
            <div className="space-y-4">
              <p className="text-gray-600">What would you like to import?</p>

              {/* Email Option */}
              <label className="flex items-center justify-between p-4 bg-gray-50 rounded-xl cursor-pointer hover:bg-gray-100 transition-colors">
                <div className="flex items-center gap-3">
                  <input
                    type="checkbox"
                    checked={migrateEmail}
                    onChange={(e) => setMigrateEmail(e.target.checked)}
                    className="w-5 h-5 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                  <Mail className="h-5 w-5 text-gray-600" />
                  <span className="font-medium text-gray-900">Emails</span>
                </div>
                <span className="text-gray-500">{preview.email_count.toLocaleString()} messages</span>
              </label>

              {/* Contacts Option */}
              <label className="flex items-center justify-between p-4 bg-gray-50 rounded-xl cursor-pointer hover:bg-gray-100 transition-colors">
                <div className="flex items-center gap-3">
                  <input
                    type="checkbox"
                    checked={migrateContacts}
                    onChange={(e) => setMigrateContacts(e.target.checked)}
                    className="w-5 h-5 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                  <Users className="h-5 w-5 text-gray-600" />
                  <span className="font-medium text-gray-900">Contacts</span>
                </div>
                <span className="text-gray-500">{preview.contact_count.toLocaleString()} contacts</span>
              </label>

              {/* Drive Option */}
              <label className="flex items-center justify-between p-4 bg-gray-50 rounded-xl cursor-pointer hover:bg-gray-100 transition-colors">
                <div className="flex items-center gap-3">
                  <input
                    type="checkbox"
                    checked={migrateDrive}
                    onChange={(e) => setMigrateDrive(e.target.checked)}
                    className="w-5 h-5 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                  <HardDrive className="h-5 w-5 text-gray-600" />
                  <span className="font-medium text-gray-900">Drive Files</span>
                </div>
                <span className="text-gray-500">{formatBytes(preview.drive_size_bytes)}</span>
              </label>
            </div>
          ) : (
            <div className="text-center py-8 text-gray-500">
              <AlertCircle className="h-12 w-12 mx-auto mb-4 text-yellow-500" />
              <p>Failed to load preview. Please try again.</p>
            </div>
          )}
        </div>

        <div className="p-6 border-t border-gray-100 flex justify-end gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg font-medium transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleStart}
            disabled={loading || (!migrateEmail && !migrateContacts && !migrateDrive)}
            className="px-6 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg font-medium flex items-center gap-2 disabled:opacity-50 transition-colors"
          >
            <Play className="h-4 w-4" />
            Start Migration
          </button>
        </div>
      </div>
    </div>
  );
}

// ==================== PROGRESS MODAL COMPONENT ====================

interface ProgressModalProps {
  jobId: string;
  onClose: () => void;
}

function ProgressModal({ jobId, onClose }: ProgressModalProps) {
  const [job, setJob] = useState<MigrationJob | null>(null);

  useEffect(() => {
    let interval: NodeJS.Timeout;

    const pollStatus = async () => {
      try {
        const status = await migrationApi.getJobStatus(jobId);
        setJob(status);

        if (status.status === 'completed' || status.status === 'failed') {
          clearInterval(interval);
        }
      } catch (error) {
        console.error('Failed to get job status:', error);
      }
    };

    pollStatus();
    interval = setInterval(pollStatus, 1000);

    return () => clearInterval(interval);
  }, [jobId]);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed': return 'text-green-600';
      case 'running': return 'text-blue-600';
      case 'failed': return 'text-red-600';
      default: return 'text-gray-400';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed': return <Check className="h-5 w-5" />;
      case 'running': return <Loader2 className="h-5 w-5 animate-spin" />;
      case 'failed': return <X className="h-5 w-5" />;
      default: return <div className="h-5 w-5" />;
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-2xl w-full max-w-lg mx-4 overflow-hidden">
        <div className="p-6 border-b border-gray-100">
          <h2 className="text-xl font-semibold text-gray-900">Migration Progress</h2>
        </div>

        <div className="p-6">
          {job ? (
            <div className="space-y-6">
              {/* Overall Progress */}
              <div>
                <div className="flex justify-between mb-2">
                  <span className="font-medium text-gray-900">{job.current_task}</span>
                  <span className="text-gray-500">{job.progress_percent}%</span>
                </div>
                <div className="h-3 bg-gray-100 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-blue-600 rounded-full transition-all duration-500"
                    style={{ width: `${job.progress_percent}%` }}
                  />
                </div>
              </div>

              {/* Sub-tasks */}
              <div className="space-y-4">
                {/* Email */}
                <div className="flex items-center gap-4">
                  <div className={`${getStatusColor(job.email_status)}`}>
                    {getStatusIcon(job.email_status)}
                  </div>
                  <div className="flex-1">
                    <div className="flex justify-between mb-1">
                      <span className="text-gray-700">Emails</span>
                      <span className="text-gray-500 text-sm">
                        {job.email_processed.toLocaleString()} / {job.email_total.toLocaleString()}
                      </span>
                    </div>
                    <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-blue-500 rounded-full transition-all"
                        style={{ width: `${job.email_progress}%` }}
                      />
                    </div>
                  </div>
                </div>

                {/* Contacts */}
                <div className="flex items-center gap-4">
                  <div className={`${getStatusColor(job.contacts_status)}`}>
                    {getStatusIcon(job.contacts_status)}
                  </div>
                  <div className="flex-1">
                    <div className="flex justify-between mb-1">
                      <span className="text-gray-700">Contacts</span>
                      <span className="text-gray-500 text-sm">
                        {job.contacts_processed.toLocaleString()} / {job.contacts_total.toLocaleString()}
                      </span>
                    </div>
                    <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-green-500 rounded-full transition-all"
                        style={{ width: `${job.contacts_progress}%` }}
                      />
                    </div>
                  </div>
                </div>

                {/* Drive */}
                <div className="flex items-center gap-4">
                  <div className={`${getStatusColor(job.drive_status)}`}>
                    {getStatusIcon(job.drive_status)}
                  </div>
                  <div className="flex-1">
                    <div className="flex justify-between mb-1">
                      <span className="text-gray-700">Drive Files</span>
                      <span className="text-gray-500 text-sm">
                        {job.drive_processed.toLocaleString()} / {job.drive_total.toLocaleString()}
                      </span>
                    </div>
                    <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-yellow-500 rounded-full transition-all"
                        style={{ width: `${job.drive_progress}%` }}
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Errors */}
              {job.errors.length > 0 && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                  <p className="text-red-700 font-medium mb-2">Errors ({job.errors.length})</p>
                  <ul className="text-sm text-red-600 space-y-1">
                    {job.errors.slice(0, 3).map((err, i) => (
                      <li key={i}>{err.error}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          ) : (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
            </div>
          )}
        </div>

        <div className="p-6 border-t border-gray-100 flex justify-end">
          {job?.status === 'completed' || job?.status === 'failed' ? (
            <button
              onClick={onClose}
              className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors"
            >
              Done
            </button>
          ) : (
            <button
              onClick={onClose}
              className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg font-medium transition-colors"
            >
              Run in Background
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ==================== MAIN PAGE COMPONENT ====================

export default function MigrationPage() {
  const router = useRouter();
  const [connections, setConnections] = useState<MigrationConnection[]>([]);
  const [loading, setLoading] = useState(true);
  const [connectingGoogle, setConnectingGoogle] = useState(false);
  const [selectedConnection, setSelectedConnection] = useState<MigrationConnection | null>(null);
  const [activeJobId, setActiveJobId] = useState<string | null>(null);

  // Load connections
  const loadConnections = useCallback(async () => {
    try {
      const data = await migrationApi.getConnections();
      setConnections(data);
    } catch (error) {
      console.error('Failed to load connections:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadConnections();
  }, [loadConnections]);

  // Handle OAuth callback
  useEffect(() => {
    if (router.query.connected) {
      loadConnections();
      // Clear query params
      router.replace('/admin/migration', undefined, { shallow: true });
    }
  }, [router.query.connected, loadConnections, router]);

  // Connect to Google
  const handleConnectGoogle = async () => {
    setConnectingGoogle(true);
    try {
      const authUrl = await migrationApi.connectGoogle();
      window.location.href = authUrl;
    } catch (error) {
      console.error('Failed to connect Google:', error);
      setConnectingGoogle(false);
    }
  };

  // Delete connection
  const handleDeleteConnection = async (connectionId: string) => {
    if (!confirm('Are you sure you want to disconnect this account?')) return;

    try {
      await migrationApi.deleteConnection(connectionId);
      setConnections(connections.filter(c => c.id !== connectionId));
    } catch (error) {
      console.error('Failed to delete connection:', error);
    }
  };

  // Start migration
  const handleStartMigration = async (config: migrationApi.StartMigrationRequest) => {
    try {
      const { job_id } = await migrationApi.startMigration(config);
      setSelectedConnection(null);
      setActiveJobId(job_id);
    } catch (error) {
      console.error('Failed to start migration:', error);
    }
  };

  return (
    <AdminLayout title="Data Migration">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-gray-900 mb-2">
            Migrate Your Data
          </h1>
          <p className="text-gray-600">
            Import your emails, contacts, and files from your existing workspace with just one click.
          </p>
        </div>

        {/* Provider Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <ProviderCard
            provider="google"
            title="Google Workspace"
            description="Gmail, Contacts, Drive"
            icon={
              <svg className="w-8 h-8" viewBox="0 0 24 24">
                <path fill="#EA4335" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                <path fill="#FBBC04" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                <path fill="#4285F4" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
              </svg>
            }
            color="red"
            onConnect={handleConnectGoogle}
            loading={connectingGoogle}
          />

          <ProviderCard
            provider="microsoft"
            title="Microsoft 365"
            description="Outlook, Contacts, OneDrive"
            icon={
              <svg className="w-8 h-8" viewBox="0 0 24 24">
                <path fill="#F25022" d="M1 1h10v10H1z"/>
                <path fill="#7FBA00" d="M13 1h10v10H13z"/>
                <path fill="#00A4EF" d="M1 13h10v10H1z"/>
                <path fill="#FFB900" d="M13 13h10v10H13z"/>
              </svg>
            }
            color="blue"
            onConnect={() => alert('Microsoft coming soon!')}
          />

          <ProviderCard
            provider="imap"
            title="Other Email"
            description="IMAP connection"
            icon={<Mail className="h-8 w-8 text-gray-600" />}
            color="gray"
            onConnect={() => alert('IMAP coming soon!')}
          />
        </div>

        {/* Connected Accounts */}
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="p-4 border-b border-gray-100 flex items-center justify-between">
            <h2 className="font-semibold text-gray-900">Connected Accounts</h2>
            <button
              onClick={loadConnections}
              className="p-2 hover:bg-gray-100 rounded-lg text-gray-500"
            >
              <RefreshCw className="h-5 w-5" />
            </button>
          </div>

          <div className="p-4">
            {loading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
              </div>
            ) : connections.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                <Cloud className="h-12 w-12 mx-auto mb-4 text-gray-300" />
                <p>No accounts connected yet.</p>
                <p className="text-sm">Connect an account above to start migrating.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {connections.map((connection) => (
                  <ConnectionItem
                    key={connection.id}
                    connection={connection}
                    onMigrate={() => setSelectedConnection(connection)}
                    onDelete={() => handleDeleteConnection(connection.id)}
                  />
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Migration Modal */}
      {selectedConnection && (
        <MigrationModal
          connection={selectedConnection}
          onClose={() => setSelectedConnection(null)}
          onStart={handleStartMigration}
        />
      )}

      {/* Progress Modal */}
      {activeJobId && (
        <ProgressModal
          jobId={activeJobId}
          onClose={() => setActiveJobId(null)}
        />
      )}
    </AdminLayout>
  );
}
```

---

## 6. Google OAuth Setup

### 6.1 Create Google Cloud Project

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project: "Bheem Workspace Migration"
3. Enable APIs:
   - Gmail API
   - Google People API
   - Google Drive API

### 6.2 Configure OAuth Consent Screen

1. Go to **APIs & Services > OAuth consent screen**
2. Select **External** user type
3. Fill in:
   - App name: "Bheem Workspace"
   - User support email: your email
   - Developer contact: your email
4. Add scopes:
   - `https://www.googleapis.com/auth/gmail.readonly`
   - `https://www.googleapis.com/auth/contacts.readonly`
   - `https://www.googleapis.com/auth/drive.readonly`
   - `https://www.googleapis.com/auth/userinfo.email`
   - `https://www.googleapis.com/auth/userinfo.profile`

### 6.3 Create OAuth Credentials

1. Go to **APIs & Services > Credentials**
2. Click **Create Credentials > OAuth client ID**
3. Application type: **Web application**
4. Name: "Bheem Workspace Migration"
5. Authorized redirect URIs:
   - `https://workspace.bheem.cloud/api/v1/migration/callback/google`
   - `http://localhost:3000/api/v1/migration/callback/google` (for dev)
6. Save **Client ID** and **Client Secret**

### 6.4 Add to Environment

```bash
# Add to backend/.env
GOOGLE_CLIENT_ID=your-client-id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=your-client-secret
```

---

## 7. Microsoft OAuth Setup

### 7.1 Register Azure AD Application

1. Go to [Azure Portal](https://portal.azure.com/)
2. Navigate to **Azure Active Directory > App registrations**
3. Click **New registration**
4. Fill in:
   - Name: "Bheem Workspace Migration"
   - Supported account types: **Accounts in any organizational directory and personal Microsoft accounts**
   - Redirect URI: `https://workspace.bheem.cloud/api/v1/migration/callback/microsoft`

### 7.2 Configure API Permissions

1. Go to **API permissions**
2. Add permissions:
   - Microsoft Graph:
     - `Mail.Read` (Delegated)
     - `Contacts.Read` (Delegated)
     - `Files.Read.All` (Delegated)
     - `User.Read` (Delegated)
     - `offline_access` (Delegated)

### 7.3 Create Client Secret

1. Go to **Certificates & secrets**
2. Click **New client secret**
3. Save the **Value** (shown only once)

### 7.4 Add to Environment

```bash
# Add to backend/.env
MICROSOFT_CLIENT_ID=your-application-id
MICROSOFT_CLIENT_SECRET=your-client-secret
```

---

## 8. API Reference

### 8.1 Endpoints Summary

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/migration/connect/google` | Get Google OAuth URL |
| GET | `/migration/callback/google` | Handle Google OAuth callback |
| POST | `/migration/connect/microsoft` | Get Microsoft OAuth URL |
| GET | `/migration/callback/microsoft` | Handle Microsoft OAuth callback |
| POST | `/migration/connect/imap` | Connect via IMAP |
| GET | `/migration/connections` | List connected accounts |
| DELETE | `/migration/connections/{id}` | Disconnect account |
| GET | `/migration/preview/{connection_id}` | Get migration preview |
| POST | `/migration/start` | Start migration |
| GET | `/migration/jobs/{job_id}` | Get job progress |
| POST | `/migration/jobs/{job_id}/cancel` | Cancel job |
| GET | `/migration/jobs` | List all jobs |

---

## 9. Testing

### 9.1 Test OAuth Flow

```bash
# 1. Get Google OAuth URL
curl -X POST "http://localhost:8000/api/v1/migration/connect/google" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json"

# 2. Open auth_url in browser, complete OAuth

# 3. List connections
curl "http://localhost:8000/api/v1/migration/connections" \
  -H "Authorization: Bearer $TOKEN"
```

### 9.2 Test Migration

```bash
# 1. Get preview
curl "http://localhost:8000/api/v1/migration/preview/{connection_id}" \
  -H "Authorization: Bearer $TOKEN"

# 2. Start migration
curl -X POST "http://localhost:8000/api/v1/migration/start" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "connection_id": "uuid",
    "migrate_email": true,
    "migrate_contacts": true,
    "migrate_drive": true
  }'

# 3. Poll progress
curl "http://localhost:8000/api/v1/migration/jobs/{job_id}" \
  -H "Authorization: Bearer $TOKEN"
```

---

## 10. Deployment Checklist

### 10.1 Backend

- [ ] Run database migrations
- [ ] Set Google OAuth credentials in `.env`
- [ ] Set Microsoft OAuth credentials in `.env`
- [ ] Set `ENCRYPTION_KEY` for token encryption
- [ ] Configure Mailcow IMAP settings
- [ ] Configure Nextcloud WebDAV settings
- [ ] Register migration router in `main.py`

### 10.2 Frontend

- [ ] Add migration page to admin routes
- [ ] Build and deploy frontend
- [ ] Test OAuth popup flow

### 10.3 Google Cloud

- [ ] Verify OAuth consent screen
- [ ] Add production redirect URI
- [ ] Submit for verification (if needed)

### 10.4 Microsoft Azure

- [ ] Add production redirect URI
- [ ] Grant admin consent (if needed)

---

## Summary

This implementation provides:

1. **One-Click OAuth Connection** - User clicks "Connect Google", completes OAuth, done
2. **Migration Preview** - Shows counts before starting
3. **One-Click Migration** - Select what to migrate, click "Start"
4. **Real-time Progress** - Live progress bar with per-task status
5. **Background Processing** - Migration runs in background
6. **Error Handling** - Tracks and displays errors

The user journey is:
1. Visit `/admin/migration`
2. Click "Connect Google Account" → OAuth popup → Approve
3. Click "Migrate" on connected account
4. Select Email/Contacts/Drive → Click "Start Migration"
5. Watch progress bar → Done!
