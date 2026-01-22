"""
Google Workspace migration provider.
Uses Gmail, People, and Drive APIs.
"""

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
                raise Exception("Token expired - please reconnect your Google account")
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
        try:
            contacts_resp = await self._request(
                f"{self.PEOPLE_API}/people/me/connections",
                params={"pageSize": 1, "personFields": "names"}
            )
            contact_count = contacts_resp.get("totalPeople", 0)
        except Exception:
            contact_count = 0

        # Get drive stats
        try:
            drive_resp = await self._request(
                f"{self.DRIVE_API}/about",
                params={"fields": "storageQuota"}
            )
            quota = drive_resp.get("storageQuota", {})
            drive_size = int(quota.get("usageInDrive", 0))
        except Exception:
            drive_size = 0

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

        # Parse date
        date_str = msg.get("Date", "")
        try:
            from email.utils import parsedate_to_datetime
            parsed_date = parsedate_to_datetime(date_str)
        except Exception:
            parsed_date = datetime.now()

        return EmailMessage(
            id=message_id,
            subject=msg.get("Subject", "(No Subject)"),
            from_email=msg.get("From", ""),
            from_name="",
            to=[msg.get("To", "")],
            cc=[msg.get("Cc", "")] if msg.get("Cc") else [],
            bcc=[],
            date=parsed_date,
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
        try:
            if msg.is_multipart():
                for part in msg.walk():
                    if part.get_content_type() == content_type:
                        return part.get_content()
            elif msg.get_content_type() == content_type:
                return msg.get_content()
        except Exception:
            pass
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
