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
    
    async def create_mailbox(self, local_part: str, password: str, name: str, quota: int = 1024) -> dict:
        """Create a new mailbox"""
        data = {
            "local_part": local_part,
            "domain": self.mail_domain,
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
            mail = imaplib.IMAP4_SSL(self.imap_host, self.imap_port)
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
                        
                        # Get body preview
                        body = ""
                        if msg.is_multipart():
                            for part in msg.walk():
                                if part.get_content_type() == "text/plain":
                                    body = part.get_payload(decode=True).decode("utf-8", errors="ignore")[:200]
                                    break
                        else:
                            body = msg.get_payload(decode=True).decode("utf-8", errors="ignore")[:200]
                        
                        messages.append({
                            "id": num.decode(),
                            "subject": subject,
                            "from": from_addr,
                            "date": date_str,
                            "preview": body.strip(),
                            "read": True  # TODO: Check flags
                        })
            
            mail.logout()
        except Exception as e:
            print(f"IMAP Error: {e}")
        
        return messages
    
    def get_email(self, email_addr: str, password: str, message_id: str, folder: str = "INBOX") -> Optional[Dict[str, Any]]:
        """Get a single email by ID"""
        try:
            mail = imaplib.IMAP4_SSL(self.imap_host, self.imap_port)
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
                            if content_type == "text/plain":
                                body_text = part.get_payload(decode=True).decode("utf-8", errors="ignore")
                            elif content_type == "text/html":
                                body_html = part.get_payload(decode=True).decode("utf-8", errors="ignore")
                            elif part.get_filename():
                                attachments.append({
                                    "filename": part.get_filename(),
                                    "content_type": content_type,
                                    "size": len(part.get_payload(decode=True))
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
                        "attachments": attachments
                    }
            
            mail.logout()
        except Exception as e:
            print(f"IMAP Error: {e}")
        
        return None
    
    def send_email(
        self, 
        from_email: str, 
        password: str, 
        to: List[str], 
        subject: str, 
        body: str,
        cc: List[str] = None,
        is_html: bool = True
    ) -> bool:
        """Send email via SMTP"""
        try:
            msg = MIMEMultipart("alternative")
            msg["Subject"] = subject
            msg["From"] = from_email
            msg["To"] = ", ".join(to)
            if cc:
                msg["Cc"] = ", ".join(cc)
            
            if is_html:
                msg.attach(MIMEText(body, "html"))
            else:
                msg.attach(MIMEText(body, "plain"))
            
            with smtplib.SMTP_SSL(self.smtp_host, self.smtp_port) as server:
                server.login(from_email, password)
                recipients = to + (cc or [])
                server.sendmail(from_email, recipients, msg.as_string())
            
            return True
        except Exception as e:
            print(f"SMTP Error: {e}")
            return False
    
    def get_folders(self, email: str, password: str) -> List[str]:
        """Get list of mail folders"""
        folders = []
        try:
            mail = imaplib.IMAP4_SSL(self.imap_host, self.imap_port)
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
            mail = imaplib.IMAP4_SSL(self.imap_host, self.imap_port)
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

# Singleton instance
mailcow_service = MailcowService()
