"""
Bheem Workspace - Mailcow Service
Email integration via IMAP/SMTP and Mailcow API
"""
import httpx
import imaplib
import smtplib
import email as email_lib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from email.mime.base import MIMEBase
from email import encoders
from typing import List, Dict, Any, Optional
from datetime import datetime
import asyncio
from core.config import settings

class MailcowService:
    def __init__(self):
        self.api_url = settings.MAILCOW_URL
        self.api_key = settings.MAILCOW_API_KEY
        self.mail_domain = settings.MAIL_DOMAIN
        # Mail server connection settings (from environment)
        self.imap_host = settings.MAILCOW_IMAP_HOST
        self.smtp_host = settings.MAILCOW_SMTP_HOST
        self.imap_port = settings.MAILCOW_IMAP_PORT
        self.smtp_port = settings.MAILCOW_SMTP_PORT
        # SSH settings for direct sync fallback
        self.ssh_host = settings.MAILCOW_SSH_HOST
        self.ssh_user = settings.MAILCOW_SSH_USER
        self.ssh_key_path = settings.MAILCOW_SSH_KEY_PATH
        self.mysql_user = settings.MAILCOW_MYSQL_USER
        self.mysql_password = settings.MAILCOW_MYSQL_PASSWORD
    
    async def _api_request(self, method: str, endpoint: str, data: dict = None) -> dict:
        """Make API request to Mailcow"""
        async with httpx.AsyncClient(verify=False) as client:
            headers = {"X-API-Key": self.api_key, "Content-Type": "application/json"}
            url = f"{self.api_url}/api/v1/{endpoint}"
            
            if method == "GET":
                response = await client.get(url, headers=headers)
            elif method == "POST":
                response = await client.post(url, headers=headers, json=data)
            elif method == "DELETE":
                response = await client.delete(url, headers=headers, json=data)
            
            return response.json() if response.status_code == 200 else {}
    
    async def create_mailbox(self, local_part: str, password: str, name: str, domain: str = None, quota: int = 1024) -> dict:
        """Create a new mailbox"""
        data = {
            "local_part": local_part,
            "domain": domain or self.mail_domain,
            "password": password,
            "password2": password,
            "name": name,
            "quota": quota,
            "active": "1",
            "force_pw_update": "0",
            "tls_enforce_in": "1",
            "tls_enforce_out": "1"
        }
        return await self._api_request("POST", "add/mailbox", data)
    
    async def get_mailboxes(self) -> List[dict]:
        """Get all mailboxes"""
        result = await self._api_request("GET", "get/mailbox/all")
        # Ensure we always return a list, even if API fails or returns wrong type
        if isinstance(result, list):
            return result
        return []

    async def get_mailbox_info(self, email: str) -> dict:
        """Get specific mailbox info including message counts"""
        result = await self._api_request("GET", f"get/mailbox/{email}")
        if isinstance(result, dict):
            return result
        elif isinstance(result, list) and len(result) > 0:
            return result[0]
        return None

    async def get_domains(self) -> List[dict]:
        """Get all domains from Mailcow"""
        result = await self._api_request("GET", "get/domain/all")
        # Ensure we always return a list, even if API fails or returns wrong type
        if isinstance(result, list):
            return result
        return []

    async def delete_mailbox(self, email: str) -> dict:
        """Delete a mailbox from Mailcow"""
        data = [email]  # Mailcow expects an array of emails to delete
        return await self._api_request("POST", "delete/mailbox", data)

    async def update_mailbox(self, email: str, name: str = None, quota_mb: int = None, active: bool = None) -> dict:
        """Update mailbox settings (name, quota, active status)"""
        attr = {}
        if name is not None:
            attr["name"] = name
        if quota_mb is not None:
            attr["quota"] = quota_mb
        if active is not None:
            attr["active"] = "1" if active else "0"

        if not attr:
            return {"error": "No attributes to update"}

        data = {
            "items": [email],
            "attr": attr
        }
        return await self._api_request("POST", "edit/mailbox", data)

    async def update_mailbox_password(self, email: str, new_password: str) -> dict:
        """Update mailbox password - syncs with Bheem Core password"""
        data = {
            "items": [email],
            "attr": {
                "password": new_password,
                "password2": new_password
            }
        }
        return await self._api_request("POST", "edit/mailbox", data)

    async def sync_password_to_mailcow(self, email: str, password: str) -> bool:
        """
        Sync password from Bheem Core to Mailcow.
        Called when user changes password in Bheem Core.
        Returns True if sync successful, False otherwise.
        """
        try:
            result = await self.update_mailbox_password(email, password)
            if result:
                return True
            # If API fails, try direct database update via SSH
            return await self._sync_password_direct(email, password)
        except Exception as e:
            print(f"Failed to sync password to Mailcow: {e}")
            return False

    async def _sync_password_direct(self, email: str, password: str) -> bool:
        """
        Direct password sync via Dovecot password hash.
        Fallback when Mailcow API is unavailable.
        """
        import subprocess
        import shlex

        # Check if SSH credentials are configured
        if not self.ssh_host or not self.ssh_key_path or not self.mysql_password:
            print("Direct password sync not configured - SSH credentials missing")
            return False

        try:
            # Generate Dovecot-compatible password hash
            hash_cmd = f"docker exec mailcowdockerized-dovecot-mailcow-1 doveadm pw -s SSHA256 -p {shlex.quote(password)}"
            ssh_cmd = f"ssh -i {shlex.quote(self.ssh_key_path)} -o StrictHostKeyChecking=no {self.ssh_user}@{self.ssh_host} {shlex.quote(hash_cmd)}"

            result = subprocess.run(ssh_cmd, shell=True, capture_output=True, text=True, timeout=30)
            if result.returncode != 0:
                return False

            password_hash = result.stdout.strip()

            # Update password in Mailcow database
            update_cmd = f"docker exec mailcowdockerized-mysql-mailcow-1 mysql -u{self.mysql_user} -p{shlex.quote(self.mysql_password)} mailcow -e \"UPDATE mailbox SET password = '{password_hash}' WHERE username = '{email}';\""
            ssh_update = f"ssh -i {shlex.quote(self.ssh_key_path)} -o StrictHostKeyChecking=no {self.ssh_user}@{self.ssh_host} {shlex.quote(update_cmd)}"

            result = subprocess.run(ssh_update, shell=True, capture_output=True, text=True, timeout=30)
            return result.returncode == 0

        except Exception as e:
            print(f"Direct password sync failed: {e}")
            return False

    def get_inbox(self, email: str, password: str, folder: str = "INBOX", limit: int = 50) -> List[Dict[str, Any]]:
        """Get emails from inbox via IMAP (sync for simplicity)"""
        messages = []

        try:
            mail = imaplib.IMAP4_SSL(self.imap_host, self.imap_port, timeout=30)
            mail.login(email, password)
            mail.select(folder)
            
            # Search for all emails
            _, message_numbers = mail.search(None, "ALL")
            message_list = message_numbers[0].split()
            
            # Get latest emails (reversed order)
            for num in reversed(message_list[-limit:]):
                _, msg_data = mail.fetch(num, "(RFC822)")
                
                for response_part in msg_data:
                    if isinstance(response_part, tuple):
                        msg = email_lib.message_from_bytes(response_part[1])

                        # Decode subject
                        subject = ""
                        if msg["Subject"]:
                            decoded = email_lib.header.decode_header(msg["Subject"])[0]
                            subject = decoded[0] if isinstance(decoded[0], str) else decoded[0].decode(decoded[1] or "utf-8")
                        
                        # Decode from
                        from_addr = msg.get("From", "")
                        
                        # Get date
                        date_str = msg.get("Date", "")
                        
                        # Get body preview and check for attachments
                        body = ""
                        has_attachments = False
                        if msg.is_multipart():
                            for part in msg.walk():
                                if part.get_content_type() == "text/plain" and not body:
                                    body = part.get_payload(decode=True).decode("utf-8", errors="ignore")[:200]
                                elif part.get_filename():
                                    has_attachments = True
                        else:
                            body = msg.get_payload(decode=True).decode("utf-8", errors="ignore")[:200]

                        # Extract threading headers
                        message_id_header = msg.get("Message-ID", "")
                        in_reply_to = msg.get("In-Reply-To", "")
                        references = msg.get("References", "")

                        messages.append({
                            "id": num.decode(),
                            "subject": subject,
                            "from": from_addr,
                            "to": msg.get("To", ""),
                            "date": date_str,
                            "preview": body.strip(),
                            "read": True,  # TODO: Check flags
                            "has_attachments": has_attachments,
                            # Threading headers
                            "message_id": message_id_header,
                            "in_reply_to": in_reply_to,
                            "references": references
                        })
            
            mail.logout()
        except Exception as e:
            print(f"IMAP Error: {e}")
        
        return messages
    
    def get_email(self, email_addr: str, password: str, message_id: str, folder: str = "INBOX") -> Optional[Dict[str, Any]]:
        """Get a single email by ID"""
        try:
            mail = imaplib.IMAP4_SSL(self.imap_host, self.imap_port, timeout=30)
            mail.login(email_addr, password)
            mail.select(folder)
            
            _, msg_data = mail.fetch(message_id.encode(), "(RFC822)")
            
            for response_part in msg_data:
                if isinstance(response_part, tuple):
                    msg = email_lib.message_from_bytes(response_part[1])

                    # Decode subject
                    subject = ""
                    if msg["Subject"]:
                        decoded = email_lib.header.decode_header(msg["Subject"])[0]
                        subject = decoded[0] if isinstance(decoded[0], str) else decoded[0].decode(decoded[1] or "utf-8")

                    # Get full body
                    body_html = ""
                    body_text = ""
                    attachments = []
                    
                    if msg.is_multipart():
                        for part in msg.walk():
                            content_type = part.get_content_type()
                            content_disposition = str(part.get("Content-Disposition") or "")
                            filename = part.get_filename()

                            # Check if this is an attachment
                            is_attachment = (
                                filename or
                                "attachment" in content_disposition.lower() or
                                (content_type and not content_type.startswith("text/") and
                                 not content_type.startswith("multipart/"))
                            )

                            if content_type == "text/plain" and not is_attachment:
                                payload = part.get_payload(decode=True)
                                if payload:
                                    body_text = payload.decode("utf-8", errors="ignore")
                            elif content_type == "text/html" and not is_attachment:
                                payload = part.get_payload(decode=True)
                                if payload:
                                    body_html = payload.decode("utf-8", errors="ignore")
                            elif is_attachment:
                                payload = part.get_payload(decode=True)
                                attachments.append({
                                    "id": str(len(attachments)),
                                    "filename": filename or f"attachment_{len(attachments)}",
                                    "contentType": content_type,
                                    "size": len(payload) if payload else 0,
                                    "contentId": part.get("Content-ID", "")
                                })
                    else:
                        body_text = msg.get_payload(decode=True).decode("utf-8", errors="ignore")
                    
                    mail.logout()

                    # Debug: Log attachments found
                    if attachments:
                        print(f"DEBUG: Found {len(attachments)} attachments in message {message_id}: {[a['filename'] for a in attachments]}")
                    else:
                        print(f"DEBUG: No attachments found in message {message_id}")

                    return {
                        "id": message_id,
                        "subject": subject,
                        "from": msg.get("From", ""),
                        "to": msg.get("To", ""),
                        "cc": msg.get("Cc", ""),
                        "date": msg.get("Date", ""),
                        "body_html": body_html,
                        "body_text": body_text,
                        "attachments": attachments,
                        # Threading headers
                        "message_id": msg.get("Message-ID", ""),
                        "in_reply_to": msg.get("In-Reply-To", ""),
                        "references": msg.get("References", "")
                    }
            
            mail.logout()
        except Exception as e:
            print(f"IMAP Error: {e}")

        return None

    async def get_message(self, email_addr: str, password: str, folder: str, message_id: str) -> Optional[Dict[str, Any]]:
        """
        Async wrapper for get_email. Used by mail_attachments.py.
        Runs the synchronous IMAP operation in a thread pool.
        """
        loop = asyncio.get_event_loop()
        return await loop.run_in_executor(
            None,
            lambda: self.get_email(email_addr, password, message_id, folder)
        )

    async def get_attachment(self, email_addr: str, password: str, folder: str, message_id: str, attachment_index: int) -> Optional[bytes]:
        """
        Get a single attachment's content by index.
        Returns the binary content of the attachment.
        """
        loop = asyncio.get_event_loop()

        def fetch_attachment():
            try:
                mail = imaplib.IMAP4_SSL(self.imap_host, self.imap_port, timeout=30)
                mail.login(email_addr, password)
                mail.select(folder)

                _, msg_data = mail.fetch(message_id.encode(), "(RFC822)")

                for response_part in msg_data:
                    if isinstance(response_part, tuple):
                        msg = email_lib.message_from_bytes(response_part[1])

                        attachment_count = 0
                        if msg.is_multipart():
                            for part in msg.walk():
                                content_type = part.get_content_type()
                                content_disposition = str(part.get("Content-Disposition") or "")
                                filename = part.get_filename()

                                is_attachment = (
                                    filename or
                                    "attachment" in content_disposition.lower() or
                                    (content_type and not content_type.startswith("text/") and
                                     not content_type.startswith("multipart/"))
                                )

                                if is_attachment:
                                    if attachment_count == attachment_index:
                                        payload = part.get_payload(decode=True)
                                        mail.logout()
                                        return payload
                                    attachment_count += 1

                mail.logout()
            except Exception as e:
                print(f"IMAP Error in get_attachment: {e}")

            return None

        return await loop.run_in_executor(None, fetch_attachment)

    def get_email_with_attachments(self, email_addr: str, password: str, message_id: str, folder: str = "INBOX") -> Optional[Dict[str, Any]]:
        """Get a single email with full attachment content (binary)"""
        try:
            mail = imaplib.IMAP4_SSL(self.imap_host, self.imap_port, timeout=30)
            mail.login(email_addr, password)
            mail.select(folder)

            _, msg_data = mail.fetch(message_id.encode(), "(RFC822)")

            for response_part in msg_data:
                if isinstance(response_part, tuple):
                    msg = email_lib.message_from_bytes(response_part[1])

                    # Decode subject
                    subject = ""
                    if msg["Subject"]:
                        decoded = email_lib.header.decode_header(msg["Subject"])[0]
                        subject = decoded[0] if isinstance(decoded[0], str) else decoded[0].decode(decoded[1] or "utf-8")

                    # Get body and attachments with content
                    body_html = ""
                    body_text = ""
                    attachments = []

                    if msg.is_multipart():
                        for part in msg.walk():
                            content_type = part.get_content_type()
                            content_disposition = str(part.get("Content-Disposition") or "")
                            filename = part.get_filename()

                            is_attachment = (
                                filename or
                                "attachment" in content_disposition.lower() or
                                (content_type and not content_type.startswith("text/") and
                                 not content_type.startswith("multipart/"))
                            )

                            if content_type == "text/plain" and not is_attachment:
                                payload = part.get_payload(decode=True)
                                if payload:
                                    body_text = payload.decode("utf-8", errors="ignore")
                            elif content_type == "text/html" and not is_attachment:
                                payload = part.get_payload(decode=True)
                                if payload:
                                    body_html = payload.decode("utf-8", errors="ignore")
                            elif is_attachment:
                                payload = part.get_payload(decode=True)
                                if payload:
                                    attachments.append({
                                        "id": str(len(attachments)),
                                        "filename": filename or f"attachment_{len(attachments)}",
                                        "contentType": content_type,
                                        "size": len(payload),
                                        "content": payload,  # Binary content
                                        "contentId": part.get("Content-ID", "")
                                    })
                    else:
                        body_text = msg.get_payload(decode=True).decode("utf-8", errors="ignore")

                    mail.logout()

                    return {
                        "id": message_id,
                        "subject": subject,
                        "from": msg.get("From", ""),
                        "to": msg.get("To", ""),
                        "cc": msg.get("Cc", ""),
                        "date": msg.get("Date", ""),
                        "body_html": body_html,
                        "body_text": body_text,
                        "attachments": attachments,
                        "message_id": msg.get("Message-ID", ""),
                        "in_reply_to": msg.get("In-Reply-To", ""),
                        "references": msg.get("References", "")
                    }

            mail.logout()
        except Exception as e:
            print(f"IMAP Error in get_email_with_attachments: {e}")

        return None

    def send_email(
        self,
        from_email: str,
        password: str,
        to: List[str],
        subject: str,
        body: str,
        cc: List[str] = None,
        bcc: List[str] = None,
        is_html: bool = True,
        save_to_sent: bool = True,
        attachments: List[dict] = None
    ) -> bool:
        """Send email via SMTP (supports both port 465 SSL and port 587 STARTTLS)

        Args:
            attachments: List of dicts with keys: filename, content_type, content (base64 encoded)
        """
        try:
            import base64
            from email.mime.base import MIMEBase
            from email import encoders

            # Use "mixed" when we have attachments, "alternative" otherwise
            if attachments and len(attachments) > 0:
                msg = MIMEMultipart("mixed")
                # Create alternative part for body
                body_part = MIMEMultipart("alternative")
                if is_html:
                    body_part.attach(MIMEText(body, "html"))
                else:
                    body_part.attach(MIMEText(body, "plain"))
                msg.attach(body_part)
            else:
                msg = MIMEMultipart("alternative")
                if is_html:
                    msg.attach(MIMEText(body, "html"))
                else:
                    msg.attach(MIMEText(body, "plain"))

            msg["Subject"] = subject
            msg["From"] = from_email
            msg["To"] = ", ".join(to)
            msg["Date"] = email_lib.utils.formatdate(localtime=True)
            msg["Message-ID"] = email_lib.utils.make_msgid(domain=from_email.split("@")[1])
            if cc:
                msg["Cc"] = ", ".join(cc)

            # Add attachments
            if attachments:
                print(f"DEBUG: Processing {len(attachments)} attachments")
                for attachment in attachments:
                    filename = attachment.get("filename", "attachment")
                    content_type = attachment.get("content_type", "application/octet-stream")
                    content_b64 = attachment.get("content", "")

                    print(f"DEBUG: Attachment '{filename}' - content_type: {content_type}, content_b64 length: {len(content_b64) if content_b64 else 'None/Empty'}")

                    # Decode base64 content
                    try:
                        content = base64.b64decode(content_b64)
                        print(f"DEBUG: Successfully decoded attachment '{filename}' - {len(content)} bytes")
                    except Exception as e:
                        print(f"Failed to decode attachment: {filename} - Error: {e}")
                        print(f"DEBUG: First 100 chars of content_b64: {content_b64[:100] if content_b64 else 'EMPTY'}")
                        continue

                    maintype, subtype = content_type.split("/", 1) if "/" in content_type else ("application", "octet-stream")

                    part = MIMEBase(maintype, subtype)
                    part.set_payload(content)
                    encoders.encode_base64(part)
                    part.add_header(
                        "Content-Disposition",
                        f"attachment; filename=\"{filename}\""
                    )
                    msg.attach(part)

            recipients = to + (cc or []) + (bcc or [])
            # Use as_bytes() to properly handle binary attachments in Python 3
            msg_bytes = msg.as_bytes()

            # Use STARTTLS for port 587, SSL for port 465
            if self.smtp_port == 587:
                with smtplib.SMTP(self.smtp_host, self.smtp_port, timeout=30) as server:
                    server.starttls()
                    server.login(from_email, password)
                    server.sendmail(from_email, recipients, msg_bytes)
            else:
                with smtplib.SMTP_SSL(self.smtp_host, self.smtp_port, timeout=30) as server:
                    server.login(from_email, password)
                    server.sendmail(from_email, recipients, msg_bytes)

            # Save a copy to the Sent folder via IMAP
            if save_to_sent:
                self._save_to_sent_folder(from_email, password, msg_bytes)

            return True
        except Exception as e:
            print(f"SMTP Error: {e}")
            return False

    def _save_to_sent_folder(self, email: str, password: str, msg_bytes: bytes) -> bool:
        """Save sent email to the Sent folder via IMAP"""
        try:
            mail = imaplib.IMAP4_SSL(self.imap_host, self.imap_port, timeout=30)
            mail.login(email, password)

            # Try different Sent folder names (varies by mail server)
            sent_folders = ["Sent", "INBOX.Sent", "Sent Items", "Sent Messages"]

            # Use timezone-aware datetime for IMAP
            import time
            date_time = imaplib.Time2Internaldate(time.time())

            for sent_folder in sent_folders:
                try:
                    result = mail.append(
                        sent_folder,
                        "\\Seen",  # Mark as read
                        date_time,
                        msg_bytes  # Already bytes, no need to encode
                    )
                    if result[0] == "OK":
                        print(f"Saved email to {sent_folder}")
                        mail.logout()
                        return True
                except Exception as e:
                    print(f"Failed to save to {sent_folder}: {e}")
                    continue

            mail.logout()
            print("Could not save to Sent folder - no valid folder found")
            return False
        except Exception as e:
            print(f"Error saving to Sent folder: {e}")
            return False
    
    def get_folders(self, email: str, password: str) -> List[str]:
        """Get list of mail folders"""
        folders = []
        try:
            mail = imaplib.IMAP4_SSL(self.imap_host, self.imap_port, timeout=30)
            mail.login(email, password)
            
            _, folder_list = mail.list()
            for folder in folder_list:
                # Parse folder name from IMAP response
                folder_name = folder.decode().split(' "/" ')[-1].strip('"')
                folders.append(folder_name)
            
            mail.logout()
        except Exception as e:
            print(f"IMAP Error: {e}")
            folders = ["INBOX", "Sent", "Drafts", "Trash", "Spam"]
        
        return folders
    
    def move_email(self, email: str, password: str, message_id: str, from_folder: str, to_folder: str) -> bool:
        """Move email to another folder"""
        try:
            mail = imaplib.IMAP4_SSL(self.imap_host, self.imap_port, timeout=30)
            mail.login(email, password)
            mail.select(from_folder)

            mail.copy(message_id.encode(), to_folder)
            mail.store(message_id.encode(), "+FLAGS", "\\Deleted")
            mail.expunge()

            mail.logout()
            return True
        except Exception as e:
            print(f"IMAP Error: {e}")
            return False

    def search_emails(
        self,
        email: str,
        password: str,
        query: str,
        folder: str = "INBOX",
        search_in: List[str] = None,
        limit: int = 50
    ) -> List[Dict[str, Any]]:
        """
        Search emails using IMAP SEARCH command.

        Args:
            email: User email address
            password: User password
            query: Search query string
            folder: Folder to search in (default: INBOX)
            search_in: Fields to search ['subject', 'from', 'to', 'body', 'all']
            limit: Maximum results to return

        Returns:
            List of matching email previews
        """
        if search_in is None:
            search_in = ['all']

        messages = []

        try:
            mail = imaplib.IMAP4_SSL(self.imap_host, self.imap_port, timeout=30)
            mail.login(email, password)
            mail.select(folder)

            # Build IMAP search criteria
            search_criteria = self._build_search_criteria(query, search_in)

            _, message_numbers = mail.search(None, search_criteria)
            message_list = message_numbers[0].split()

            # Get latest matching emails (reversed order)
            for num in reversed(message_list[-limit:]):
                _, msg_data = mail.fetch(num, "(RFC822)")

                for response_part in msg_data:
                    if isinstance(response_part, tuple):
                        msg = email_lib.message_from_bytes(response_part[1])

                        # Decode subject
                        subject = ""
                        if msg["Subject"]:
                            decoded = email_lib.header.decode_header(msg["Subject"])[0]
                            subject = decoded[0] if isinstance(decoded[0], str) else decoded[0].decode(decoded[1] or "utf-8")

                        # Decode from
                        from_addr = msg.get("From", "")

                        # Get date
                        date_str = msg.get("Date", "")

                        # Get body preview
                        body = ""
                        if msg.is_multipart():
                            for part in msg.walk():
                                if part.get_content_type() == "text/plain":
                                    body = part.get_payload(decode=True).decode("utf-8", errors="ignore")[:200]
                                    break
                        else:
                            body = msg.get_payload(decode=True).decode("utf-8", errors="ignore")[:200]

                        # Extract threading headers
                        message_id_header = msg.get("Message-ID", "")
                        in_reply_to = msg.get("In-Reply-To", "")
                        references = msg.get("References", "")

                        messages.append({
                            "id": num.decode(),
                            "subject": subject,
                            "from": from_addr,
                            "to": msg.get("To", ""),
                            "date": date_str,
                            "preview": body.strip(),
                            "read": True,
                            "message_id": message_id_header,
                            "in_reply_to": in_reply_to,
                            "references": references,
                            "folder": folder
                        })

            mail.logout()
        except Exception as e:
            print(f"IMAP Search Error: {e}")

        return messages

    def _build_search_criteria(self, query: str, search_in: List[str]) -> str:
        """Build IMAP search criteria string."""
        # Escape special characters and quotes
        safe_query = query.replace('"', '\\"')

        if 'all' in search_in:
            # Search in all common fields using OR
            return f'(OR OR OR SUBJECT "{safe_query}" FROM "{safe_query}" TO "{safe_query}" BODY "{safe_query}")'

        criteria_parts = []

        if 'subject' in search_in:
            criteria_parts.append(f'SUBJECT "{safe_query}"')

        if 'from' in search_in:
            criteria_parts.append(f'FROM "{safe_query}"')

        if 'to' in search_in:
            criteria_parts.append(f'TO "{safe_query}"')

        if 'body' in search_in:
            criteria_parts.append(f'BODY "{safe_query}"')

        if len(criteria_parts) == 1:
            return criteria_parts[0]
        elif len(criteria_parts) > 1:
            # Combine with OR
            result = criteria_parts[0]
            for part in criteria_parts[1:]:
                result = f'(OR {result} {part})'
            return result

        # Default: search subject
        return f'SUBJECT "{safe_query}"'

    def search_all_folders(
        self,
        email: str,
        password: str,
        query: str,
        search_in: List[str] = None,
        limit: int = 50
    ) -> Dict[str, List[Dict[str, Any]]]:
        """
        Search emails across all folders.

        Returns:
            Dict mapping folder names to lists of matching emails
        """
        results = {}

        try:
            folders = self.get_folders(email, password)

            for folder in folders:
                folder_results = self.search_emails(
                    email, password, query, folder, search_in, limit
                )
                if folder_results:
                    results[folder] = folder_results

        except Exception as e:
            print(f"IMAP Search All Error: {e}")

        return results


# Singleton instance
mailcow_service = MailcowService()
