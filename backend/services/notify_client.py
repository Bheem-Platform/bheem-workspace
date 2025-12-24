"""
Bheem Notify Client - Unified Notification Service Client
Replaces direct MSG91 calls with centralized Bheem Notify API

Usage:
    from services.notify_client import notify_client

    # Send email
    await notify_client.send_email(
        to="user@example.com",
        subject="Welcome!",
        body="<h1>Hello</h1>"
    )

    # Send OTP
    await notify_client.send_otp(phone="919876543210")

    # Verify OTP
    result = await notify_client.verify_otp(phone="919876543210", otp="123456")
"""

import httpx
import logging
from typing import Dict, Any, Optional, List
from datetime import datetime

logger = logging.getLogger(__name__)

# Bheem Notify Service Configuration
NOTIFY_BASE_URL = "http://bheem.co.uk:8005/api/v1"
NOTIFY_INTERNAL_URL = "http://bheem-notify:8005/api/v1"  # For Docker internal calls


class NotifyClient:
    """
    Bheem Notify API Client
    Provides unified interface for all notification channels
    """

    def __init__(
        self,
        base_url: str = None,
        api_key: str = None,
        timeout: float = 30.0
    ):
        """
        Initialize NotifyClient

        Args:
            base_url: Notify service URL (defaults to internal Docker URL)
            api_key: Optional API key for authentication
            timeout: Request timeout in seconds
        """
        self.base_url = base_url or NOTIFY_INTERNAL_URL
        self.api_key = api_key
        self.timeout = timeout
        self._client = None

    async def _get_client(self) -> httpx.AsyncClient:
        """Get or create HTTP client"""
        if self._client is None or self._client.is_closed:
            self._client = httpx.AsyncClient(timeout=self.timeout)
        return self._client

    async def close(self):
        """Close the HTTP client"""
        if self._client and not self._client.is_closed:
            await self._client.aclose()

    def _get_headers(self) -> Dict[str, str]:
        """Get request headers"""
        headers = {"Content-Type": "application/json"}
        if self.api_key:
            headers["Authorization"] = f"Bearer {self.api_key}"
        return headers

    async def _request(
        self,
        method: str,
        endpoint: str,
        json_data: Dict = None,
        params: Dict = None
    ) -> Dict[str, Any]:
        """Make HTTP request to Notify service"""
        client = await self._get_client()
        url = f"{self.base_url}{endpoint}"

        try:
            response = await client.request(
                method=method,
                url=url,
                json=json_data,
                params=params,
                headers=self._get_headers()
            )

            result = response.json()

            if response.status_code >= 400:
                logger.error(f"Notify API error: {response.status_code} - {result}")
                return {
                    "success": False,
                    "error": result.get("detail", str(result)),
                    "status_code": response.status_code
                }

            return result

        except httpx.TimeoutException:
            logger.error(f"Notify API timeout: {endpoint}")
            return {"success": False, "error": "Request timed out"}
        except httpx.ConnectError as e:
            logger.error(f"Notify API connection error: {e}")
            return {"success": False, "error": f"Connection error: {str(e)}"}
        except Exception as e:
            logger.error(f"Notify API error: {e}")
            return {"success": False, "error": str(e)}

    # =========================================
    # Email Methods
    # =========================================

    async def send_email(
        self,
        to: str,
        subject: str,
        body: str,
        from_email: Optional[str] = None,
        from_name: Optional[str] = None,
        is_html: bool = True,
        cc: Optional[List[str]] = None,
        bcc: Optional[List[str]] = None
    ) -> Dict[str, Any]:
        """
        Send email via Bheem Notify

        Args:
            to: Recipient email address
            subject: Email subject
            body: Email body (HTML or plain text)
            from_email: Sender email (optional)
            from_name: Sender name (optional)
            is_html: Whether body is HTML (default: True)
            cc: CC recipients (optional)
            bcc: BCC recipients (optional)

        Returns:
            API response dict
        """
        payload = {
            "to": to,
            "subject": subject,
            "body": body,
            "is_html": is_html
        }

        if from_email:
            payload["from_email"] = from_email
        if from_name:
            payload["from_name"] = from_name
        if cc:
            payload["cc"] = cc
        if bcc:
            payload["bcc"] = bcc

        result = await self._request("POST", "/bheem-tele/email/send", json_data=payload)

        if result.get("success"):
            logger.info(f"Email sent to {to}")
        else:
            logger.error(f"Email to {to} failed: {result.get('error')}")

        return result

    async def send_bulk_email(
        self,
        recipients: List[Dict[str, str]],
        subject: str,
        body: str,
        is_html: bool = True
    ) -> Dict[str, Any]:
        """
        Send bulk email via Bheem Notify

        Args:
            recipients: List of {"email": "...", "name": "..."} dicts
            subject: Email subject
            body: Email body
            is_html: Whether body is HTML

        Returns:
            API response dict
        """
        payload = {
            "recipients": recipients,
            "subject": subject,
            "body": body,
            "is_html": is_html
        }

        return await self._request("POST", "/bheem-tele/email/send/bulk", json_data=payload)

    async def send_template_email(
        self,
        to: str,
        template_code: str,
        variables: Dict[str, Any]
    ) -> Dict[str, Any]:
        """
        Send templated email via Bheem Notify

        Args:
            to: Recipient email
            template_code: Template code/ID
            variables: Template variables

        Returns:
            API response dict
        """
        payload = {
            "to": to,
            "template_code": template_code,
            "variables": variables
        }

        return await self._request("POST", "/bheem-tele/email/send/template", json_data=payload)

    # =========================================
    # SMS Methods
    # =========================================

    async def send_sms(
        self,
        to: str,
        message: str,
        template_id: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Send SMS via Bheem Notify

        Args:
            to: Recipient phone number (with country code)
            message: SMS message
            template_id: DLT template ID (required for India)

        Returns:
            API response dict
        """
        payload = {
            "to": to,
            "message": message
        }

        if template_id:
            payload["template_id"] = template_id

        result = await self._request("POST", "/bheem-tele/sms/send", json_data=payload)

        if result.get("success"):
            logger.info(f"SMS sent to {to}")
        else:
            logger.error(f"SMS to {to} failed: {result.get('error')}")

        return result

    async def send_bulk_sms(
        self,
        recipients: List[str],
        message: str,
        template_id: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Send bulk SMS via Bheem Notify

        Args:
            recipients: List of phone numbers
            message: SMS message
            template_id: DLT template ID

        Returns:
            API response dict
        """
        payload = {
            "recipients": recipients,
            "message": message
        }

        if template_id:
            payload["template_id"] = template_id

        return await self._request("POST", "/bheem-tele/sms/bulk", json_data=payload)

    # =========================================
    # OTP Methods
    # =========================================

    async def send_otp(
        self,
        phone: str,
        otp_length: int = 6
    ) -> Dict[str, Any]:
        """
        Send OTP via Bheem Notify

        Args:
            phone: Phone number with country code
            otp_length: Length of OTP (4 or 6)

        Returns:
            API response dict with request_id
        """
        payload = {
            "phone": phone,
            "otp_length": otp_length
        }

        result = await self._request("POST", "/bheem-tele/otp/send", json_data=payload)

        if result.get("success"):
            logger.info(f"OTP sent to {phone}")
        else:
            logger.error(f"OTP to {phone} failed: {result.get('error')}")

        return result

    async def verify_otp(
        self,
        phone: str,
        otp: str
    ) -> Dict[str, Any]:
        """
        Verify OTP via Bheem Notify

        Args:
            phone: Phone number with country code
            otp: OTP code to verify

        Returns:
            API response dict with verification status
        """
        payload = {
            "phone": phone,
            "otp": otp
        }

        result = await self._request("POST", "/bheem-tele/otp/verify", json_data=payload)

        if result.get("success"):
            logger.info(f"OTP verified for {phone}")
        else:
            logger.warning(f"OTP verification failed for {phone}")

        return result

    async def resend_otp(
        self,
        phone: str,
        retry_type: str = "text"
    ) -> Dict[str, Any]:
        """
        Resend OTP via Bheem Notify

        Args:
            phone: Phone number with country code
            retry_type: "text" for SMS, "voice" for voice call

        Returns:
            API response dict
        """
        payload = {
            "phone": phone,
            "retry_type": retry_type
        }

        return await self._request("POST", "/bheem-tele/otp/resend", json_data=payload)

    # =========================================
    # Voice Methods
    # =========================================

    async def make_voice_call(
        self,
        to: str,
        template: str,
        variables: Optional[Dict[str, Any]] = None,
        caller_id: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Make voice call via Bheem Notify

        Args:
            to: Recipient phone number
            template: Voice template/flow name from MSG91
            variables: Template variables (optional)
            caller_id: Caller ID to display (optional)

        Returns:
            API response dict
        """
        payload = {
            "to": to,
            "template": template
        }

        if variables:
            payload["variables"] = variables
        if caller_id:
            payload["caller_id"] = caller_id

        return await self._request("POST", "/bheem-tele/voice/call", json_data=payload)

    # =========================================
    # WhatsApp Methods
    # =========================================

    async def send_whatsapp_template(
        self,
        to: str,
        template_name: str,
        template_params: Optional[List[str]] = None,
        language: str = "en"
    ) -> Dict[str, Any]:
        """
        Send WhatsApp template message via Bheem Notify

        Args:
            to: Recipient phone number
            template_name: WhatsApp template name
            template_params: Template parameters
            language: Template language code

        Returns:
            API response dict
        """
        payload = {
            "to": to,
            "template_name": template_name,
            "language": language
        }

        if template_params:
            payload["template_params"] = template_params

        return await self._request("POST", "/bheem-tele/whatsapp/send/template", json_data=payload)

    async def send_whatsapp_text(
        self,
        to: str,
        message: str
    ) -> Dict[str, Any]:
        """
        Send WhatsApp text message via Bheem Notify

        Args:
            to: Recipient phone number
            message: Text message

        Returns:
            API response dict
        """
        payload = {
            "to": to,
            "message": message
        }

        return await self._request("POST", "/bheem-tele/whatsapp/send/text", json_data=payload)

    # =========================================
    # Unified Notification (Multi-channel)
    # =========================================

    async def send_notification(
        self,
        notification_type: str,
        recipient_email: Optional[str] = None,
        recipient_phone: Optional[str] = None,
        subject: Optional[str] = None,
        body: Optional[str] = None,
        template_code: Optional[str] = None,
        template_variables: Optional[Dict] = None,
        entity_type: Optional[str] = None,
        entity_id: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Send notification via unified Notify API

        Args:
            notification_type: EMAIL, SMS, PUSH, IN_APP, WEBHOOK
            recipient_email: Email address (for EMAIL type)
            recipient_phone: Phone number (for SMS type)
            subject: Notification subject
            body: Notification body
            template_code: Template code to use
            template_variables: Variables for template
            entity_type: Related entity type (e.g., MEETING, DOCUMENT)
            entity_id: Related entity ID

        Returns:
            API response dict
        """
        payload = {
            "notification_type": notification_type
        }

        if recipient_email:
            payload["recipient_email"] = recipient_email
        if recipient_phone:
            payload["recipient_phone"] = recipient_phone
        if subject:
            payload["subject"] = subject
        if body:
            payload["body"] = body
        if template_code:
            payload["template_code"] = template_code
        if template_variables:
            payload["template_variables"] = template_variables
        if entity_type:
            payload["entity_type"] = entity_type
        if entity_id:
            payload["entity_id"] = entity_id

        return await self._request("POST", "/notify/send", json_data=payload)

    # =========================================
    # Health & Status
    # =========================================

    async def health_check(self) -> Dict[str, Any]:
        """Check Notify service health"""
        return await self._request("GET", "/../health")

    async def get_provider_status(self) -> Dict[str, Any]:
        """Get BheemTele provider status"""
        return await self._request("GET", "/bheem-tele/status")

    # =========================================
    # Convenience Methods (Workspace-specific)
    # =========================================

    async def send_otp_email(
        self,
        to: str,
        otp: str,
        purpose: str = "verification"
    ) -> Dict[str, Any]:
        """
        Send OTP via email (Workspace convenience method)

        Args:
            to: Recipient email
            otp: OTP code
            purpose: Purpose (verification, password_reset, login)

        Returns:
            API response dict
        """
        subject_map = {
            "verification": "Verify your Bheem account",
            "password_reset": "Reset your Bheem password",
            "login": "Your Bheem login code"
        }

        subject = subject_map.get(purpose, "Your Bheem verification code")

        body = f"""
        <div style="font-family: Arial, sans-serif; max-width: 500px; margin: 0 auto; padding: 20px;">
            <h2 style="color: #2563eb;">Bheem Workspace</h2>
            <p>Your verification code is:</p>
            <div style="background: #f1f5f9; padding: 20px; text-align: center; border-radius: 8px; margin: 20px 0;">
                <span style="font-size: 32px; font-weight: bold; color: #2563eb; letter-spacing: 8px;">{otp}</span>
            </div>
            <p style="color: #64748b; font-size: 14px;">This code expires in 10 minutes.</p>
        </div>
        """

        return await self.send_email(to=to, subject=subject, body=body, is_html=True)

    async def send_welcome_email(
        self,
        to: str,
        username: str
    ) -> Dict[str, Any]:
        """
        Send welcome email to new user

        Args:
            to: Recipient email
            username: User's name

        Returns:
            API response dict
        """
        return await self.send_notification(
            notification_type="EMAIL",
            recipient_email=to,
            template_code="WORKSPACE_WELCOME",
            template_variables={"username": username, "dashboard_url": "https://workspace.bheem.cloud/dashboard"}
        )

    async def send_meeting_invite(
        self,
        to: List[str],
        meeting_name: str,
        host_name: str,
        meeting_url: str,
        scheduled_time: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Send meeting invitation email

        Args:
            to: List of recipient emails
            meeting_name: Meeting name
            host_name: Host name
            meeting_url: Join URL
            scheduled_time: Scheduled time (optional)

        Returns:
            API response dict
        """
        # Send to each recipient
        results = []
        for email in to:
            result = await self.send_notification(
                notification_type="EMAIL",
                recipient_email=email,
                template_code="WORKSPACE_MEETING_INVITE",
                template_variables={
                    "meeting_name": meeting_name,
                    "host_name": host_name,
                    "meeting_url": meeting_url,
                    "scheduled_time": scheduled_time or "Now"
                },
                entity_type="MEETING"
            )
            results.append(result)

        success_count = sum(1 for r in results if r.get("success"))
        return {
            "success": success_count == len(to),
            "sent": success_count,
            "total": len(to),
            "results": results
        }

    async def send_document_shared_notification(
        self,
        to: str,
        document_name: str,
        shared_by: str,
        document_url: str
    ) -> Dict[str, Any]:
        """
        Send document shared notification

        Args:
            to: Recipient email
            document_name: Document name
            shared_by: Name of person sharing
            document_url: Document URL

        Returns:
            API response dict
        """
        return await self.send_notification(
            notification_type="EMAIL",
            recipient_email=to,
            template_code="WORKSPACE_DOCUMENT_SHARED",
            template_variables={
                "document_name": document_name,
                "shared_by": shared_by,
                "document_url": document_url
            },
            entity_type="DOCUMENT"
        )


    # =========================================
    # Backward Compatibility Methods (msg91_service interface)
    # =========================================

    # Properties for backward compatibility
    @property
    def sender_email(self) -> str:
        return "noreply@bheem.cloud"

    @property
    def sender_name(self) -> str:
        return "Bheem Workspace"

    @property
    def sms_sender_id(self) -> str:
        return "BHEEM"

    async def send_otp_sms(
        self,
        mobile: str,
        otp: Optional[str] = None,
        template_id: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Send OTP via SMS (Backward compatibility for msg91_service)

        Args:
            mobile: Phone number
            otp: OTP code (if None, will be auto-generated by Notify)
            template_id: DLT template ID

        Returns:
            API response dict
        """
        if otp:
            # If OTP is provided, send as regular SMS with OTP in message
            message = f"Your Bheem verification code is {otp}. Valid for 10 minutes."
            return await self.send_sms(to=mobile, message=message, template_id=template_id)
        else:
            # Use Notify's OTP generation
            return await self.send_otp(phone=mobile)

    async def send_quick_sms(
        self,
        mobile: str,
        message: str
    ) -> Dict[str, Any]:
        """
        Send quick SMS (Backward compatibility)

        Args:
            mobile: Phone number
            message: SMS message

        Returns:
            API response dict
        """
        return await self.send_sms(to=mobile, message=message)

    def get_domain_dns_records(self, domain: str) -> Dict[str, Any]:
        """
        Get DNS records required for domain setup

        Args:
            domain: Domain name

        Returns:
            Dict with DNS records and instructions
        """
        return {
            "domain": domain,
            "status": "pending_verification",
            "records": [
                {
                    "type": "CNAME",
                    "host": f"em._domainkey.{domain}",
                    "value": "em._domainkey.bheem.cloud",
                    "purpose": "DKIM signing"
                },
                {
                    "type": "TXT",
                    "host": domain,
                    "value": "v=spf1 include:spf.bheem.cloud ~all",
                    "purpose": "SPF record"
                },
                {
                    "type": "TXT",
                    "host": f"_dmarc.{domain}",
                    "value": "v=DMARC1; p=quarantine; rua=mailto:dmarc@bheem.cloud",
                    "purpose": "DMARC policy"
                }
            ],
            "instructions": [
                "Add the DNS records above to your domain's DNS settings",
                "Wait 24-48 hours for DNS propagation",
                "Use the domain check endpoint to verify configuration",
                "Once verified, emails can be sent from this domain"
            ],
            "manual_steps": [
                "1. Go to MSG91/BheemTele dashboard",
                "2. Navigate to Settings > Domains",
                "3. Add your domain and follow verification steps"
            ]
        }

    async def check_domain_dns(self, domain: str) -> Dict[str, Any]:
        """
        Check if DNS records are properly configured for a domain

        Args:
            domain: Domain name

        Returns:
            Dict with verification status
        """
        import socket

        results = {
            "domain": domain,
            "status": "checking",
            "checks": {}
        }

        # Check DKIM CNAME
        try:
            dkim_host = f"em._domainkey.{domain}"
            socket.gethostbyname(dkim_host)
            results["checks"]["dkim"] = {"status": "found", "host": dkim_host}
        except socket.gaierror:
            results["checks"]["dkim"] = {"status": "not_found", "host": dkim_host}

        # Overall status
        all_found = all(c.get("status") == "found" for c in results["checks"].values())
        results["status"] = "verified" if all_found else "pending"
        results["message"] = "Domain verified!" if all_found else "Some DNS records are missing. Please add them and wait for propagation."

        return results


# Singleton instance
notify_client = NotifyClient()

# Backward compatibility aliases
bheem_tele_service = notify_client
msg91_service = notify_client
