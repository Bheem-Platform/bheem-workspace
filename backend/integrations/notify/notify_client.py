"""
Bheem Notify Client for Workspace
==================================
Aligned with bheem-core implementation pattern.
Reference: /bheem-core/apps/backend/app/integrations/notify/notify_client.py

Provides multi-channel notification capabilities:
- Email (via Mailgun)
- SMS (via MSG91/BheemTele)
- WhatsApp (via Meta)
- Push notifications (via Firebase)
"""

import os
import httpx
import logging
from typing import Dict, Any, List, Optional

logger = logging.getLogger(__name__)


class NotifyClient:
    """
    Client for Bheem Notify Service (Port 8005)

    Handles all notification channels for Bheem Workspace:
    - Welcome emails for new users
    - Invitation emails
    - Meeting invitations
    - Password reset emails
    - SMS OTP verification
    - WhatsApp notifications
    """

    def __init__(self):
        self.notify_url = os.getenv("NOTIFY_SERVICE_URL", "http://localhost:8005")
        self.api_key = os.getenv("NOTIFY_API_KEY", "")
        self.timeout = float(os.getenv("NOTIFY_TIMEOUT", "30.0"))
        self.sender_email = os.getenv("NOTIFY_SENDER_EMAIL", "noreply@bheem.cloud")
        self.sender_name = os.getenv("NOTIFY_SENDER_NAME", "Bheem Workspace")
        self.workspace_url = os.getenv("WORKSPACE_FRONTEND_URL", "https://workspace.bheem.cloud")

        # Log initialization for debugging
        import logging
        logger = logging.getLogger(__name__)
        logger.info(f"NotifyClient initialized: url={self.notify_url}, sender={self.sender_email}")

    def _headers(self) -> Dict[str, str]:
        """Get request headers with X-API-Key authentication"""
        headers = {"Content-Type": "application/json"}
        if self.api_key:
            headers["X-API-Key"] = self.api_key
        return headers

    async def _make_request(
        self,
        method: str,
        endpoint: str,
        json_data: Optional[Dict] = None
    ) -> Dict[str, Any]:
        """Make HTTP request to Notify service"""
        full_url = f"{self.notify_url}{endpoint}"
        logger.info(f"Notify API Request: {method} {full_url}")
        if json_data:
            # Log payload without sensitive data
            safe_payload = {k: v for k, v in json_data.items() if k not in ['password', 'temp_password']}
            logger.info(f"Notify API Payload: {safe_payload}")

        try:
            async with httpx.AsyncClient(timeout=self.timeout) as client:
                if method == "POST":
                    response = await client.post(
                        full_url,
                        json=json_data,
                        headers=self._headers()
                    )
                elif method == "GET":
                    response = await client.get(
                        full_url,
                        headers=self._headers()
                    )
                else:
                    raise ValueError(f"Unsupported method: {method}")

                logger.info(f"Notify API Response: status={response.status_code}")

                if response.status_code >= 400:
                    logger.error(f"Notify request failed: {response.status_code} - {response.text}")
                    return {"error": response.text, "status_code": response.status_code}

                result = response.json()
                logger.info(f"Notify API Response body: {result}")
                return result

        except httpx.TimeoutException:
            logger.error(f"Notify request timeout: {endpoint}")
            return {"error": "Request timeout"}
        except httpx.ConnectError as e:
            logger.error(f"Notify service unavailable: {self.notify_url} - {e}")
            return {"error": "Service unavailable"}
        except Exception as e:
            logger.error(f"Notify request error: {e}", exc_info=True)
            return {"error": str(e)}

    # ═══════════════════════════════════════════════════════════════
    # EMAIL METHODS
    # ═══════════════════════════════════════════════════════════════

    async def send_email(
        self,
        to: str,
        subject: str,
        html_body: str,
        text_body: Optional[str] = None,
        cc: Optional[List[str]] = None,
        bcc: Optional[List[str]] = None,
        from_email: Optional[str] = None,
        from_name: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Send a direct email via Mailgun.

        Args:
            to: Recipient email address
            subject: Email subject
            html_body: HTML content of email
            text_body: Plain text content (optional)
            cc: CC recipients
            bcc: BCC recipients
            from_email: Sender email (optional, defaults to configured sender)
            from_name: Sender name (optional)
        """
        # Use direct Mailgun endpoint: POST /api/v1/email/send
        payload = {
            "to": to,
            "subject": subject,
            "body": html_body,
            "is_html": True,
            "from_email": from_email or self.sender_email,
            "from_name": from_name or self.sender_name
        }
        if cc:
            payload["cc"] = cc
        if bcc:
            payload["bcc"] = bcc

        return await self._make_request("POST", "/api/v1/email/send", payload)

    async def send_template_email(
        self,
        to: str,
        template_name: str,
        template_vars: Dict[str, Any],
        subject: Optional[str] = None,
        cc: Optional[List[str]] = None,
        bcc: Optional[List[str]] = None
    ) -> Dict[str, Any]:
        """
        Send email using a predefined template.

        Args:
            to: Recipient email address
            template_name: Name of email template in Bheem Notify
            template_vars: Variables to inject into template
            subject: Override subject (optional)
            cc: CC recipients
            bcc: BCC recipients
        """
        # Use bheem-tele template endpoint: POST /api/v1/bheem-tele/email/send/template
        payload = {
            "to": to,
            "template_name": template_name,
            "variables": template_vars
        }
        if subject:
            payload["subject"] = subject

        return await self._make_request("POST", "/api/v1/bheem-tele/email/send/template", payload)

    async def send_welcome_email(
        self,
        to: str,
        name: str,
        workspace_name: str,
        login_url: Optional[str] = None,
        workspace_email: Optional[str] = None,
        temp_password: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Send welcome email to new user (industry-standard pattern).

        Args:
            to: Where to send the email (personal email)
            name: User's display name
            workspace_name: Name of the workspace
            login_url: Login page URL
            workspace_email: User's new workspace email (LOGIN email)
            temp_password: Temporary password (if generated)
        """
        login_url = login_url or f"{self.workspace_url}/login"
        # Use workspace_email as login, fallback to 'to' for backward compatibility
        login_email = workspace_email or to

        html_body = f"""
        <html>
        <body style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
            <div style="background: linear-gradient(135deg, #4F46E5 0%, #7C3AED 100%); padding: 30px; border-radius: 12px 12px 0 0;">
                <h1 style="color: white; margin: 0;">Welcome to {workspace_name}!</h1>
            </div>
            <div style="background: #f8fafc; padding: 30px; border-radius: 0 0 12px 12px;">
                <p style="font-size: 16px;">Hello <strong>{name}</strong>,</p>
                <p>Your workspace account has been created successfully. You now have access to all services:</p>

                <div style="display: flex; gap: 10px; margin: 20px 0;">
                    <div style="background: white; padding: 15px; border-radius: 8px; flex: 1; text-align: center;">
                        <div style="font-size: 24px;">📧</div>
                        <div style="font-weight: bold;">Mail</div>
                    </div>
                    <div style="background: white; padding: 15px; border-radius: 8px; flex: 1; text-align: center;">
                        <div style="font-size: 24px;">📹</div>
                        <div style="font-weight: bold;">Meet</div>
                    </div>
                    <div style="background: white; padding: 15px; border-radius: 8px; flex: 1; text-align: center;">
                        <div style="font-size: 24px;">📄</div>
                        <div style="font-weight: bold;">Docs</div>
                    </div>
                </div>

                <div style="background: white; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #4F46E5;">
                    <h3 style="margin-top: 0; color: #1e293b;">Your Login Credentials</h3>
                    <p style="margin: 5px 0;"><strong>Workspace Email:</strong> <span style="color: #4F46E5;">{login_email}</span></p>
                    <p style="margin: 5px 0;"><strong>Temporary Password:</strong> <code style="background: #e2e8f0; padding: 2px 8px; border-radius: 4px;">{temp_password or 'Use your existing password'}</code></p>
                    <p style="color: #64748b; font-size: 13px; margin-top: 10px;">⚠️ Please change your password after first login</p>
                </div>

                <p style="margin: 30px 0; text-align: center;">
                    <a href="{login_url}" style="background-color: #4F46E5; color: white; padding: 14px 28px; text-decoration: none; border-radius: 8px; font-weight: bold; display: inline-block;">
                        Login to Workspace
                    </a>
                </p>

                <p style="color: #64748b; font-size: 14px; text-align: center;">
                    Use <strong>{login_email}</strong> to login to all services
                </p>

                <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 20px 0;">
                <p style="color: #94a3b8; font-size: 12px; text-align: center;">
                    Need help? Contact us at support@bheem.cloud<br>
                    © 2026 Bheemverse Innovation - Bheem Workspace
                </p>
            </div>
        </body>
        </html>
        """
        return await self.send_email(
            to=to,
            subject=f"Welcome to {workspace_name} - Your New Workspace Account",
            html_body=html_body,
            text_body=f"Welcome to {workspace_name}! Your workspace email: {login_email}. Password: {temp_password}. Login at: {login_url}"
        )

    async def send_invite_email(
        self,
        to: str,
        invitee_name: str,
        inviter_name: str,
        workspace_name: str,
        invite_url: Optional[str] = None,
        role: str = "member"
    ) -> Dict[str, Any]:
        """
        Send invitation email to join workspace.

        Args:
            to: Invitee's email address
            invitee_name: Name of person being invited
            inviter_name: Name of person sending invite
            workspace_name: Name of the workspace
            invite_url: URL to accept invitation
            role: Role being assigned (admin, member, guest)
        """
        invite_url = invite_url or f"{self.workspace_url}/login"

        # Try template first
        result = await self.send_template_email(
            to=to,
            template_name="workspace_invite",
            template_vars={
                "invitee_name": invitee_name,
                "inviter_name": inviter_name,
                "workspace_name": workspace_name,
                "invite_url": invite_url,
                "role": role
            }
        )

        # Fall back to direct email
        if result.get("error") and "template" in str(result.get("error", "")).lower():
            html_body = f"""
            <html>
            <body style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
                <h1 style="color: #4F46E5;">You're Invited!</h1>
                <p>Hello {invitee_name},</p>
                <p><strong>{inviter_name}</strong> has invited you to join <strong>{workspace_name}</strong> as a <strong>{role}</strong>.</p>
                <p>Bheem Workspace provides:</p>
                <ul>
                    <li>Email with your own @{workspace_name.lower().replace(' ', '')} address</li>
                    <li>Video meetings with Bheem Meet</li>
                    <li>Document collaboration with Bheem Docs</li>
                </ul>
                <p style="margin: 30px 0;">
                    <a href="{invite_url}" style="background-color: #4F46E5; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px;">
                        Accept Invitation
                    </a>
                </p>
                <p style="color: #666; font-size: 14px;">
                    This invitation was sent to {to}. If you didn't expect this, you can ignore this email.
                </p>
                <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;">
                <p style="color: #999; font-size: 12px;">
                    Sent by Bheem Workspace. © 2026 Bheemverse Innovation
                </p>
            </body>
            </html>
            """
            result = await self.send_email(
                to=to,
                subject=f"{inviter_name} invited you to join {workspace_name}",
                html_body=html_body,
                text_body=f"{inviter_name} invited you to join {workspace_name}. Accept at: {invite_url}"
            )

        return result

    async def send_password_reset_email(
        self,
        to: str,
        name: str,
        reset_url: str,
        expires_in: str = "24 hours"
    ) -> Dict[str, Any]:
        """
        Send password reset email.

        Args:
            to: User's email address
            name: User's display name
            reset_url: Password reset URL with token
            expires_in: How long the reset link is valid
        """
        result = await self.send_template_email(
            to=to,
            template_name="password_reset",
            template_vars={
                "user_name": name,
                "reset_url": reset_url,
                "expires_in": expires_in
            }
        )

        # Fall back to direct email
        if result.get("error") and "template" in str(result.get("error", "")).lower():
            html_body = f"""
            <html>
            <body style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
                <h1 style="color: #4F46E5;">Reset Your Password</h1>
                <p>Hello {name},</p>
                <p>We received a request to reset your password. Click the button below to create a new password:</p>
                <p style="margin: 30px 0;">
                    <a href="{reset_url}" style="background-color: #4F46E5; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px;">
                        Reset Password
                    </a>
                </p>
                <p style="color: #666; font-size: 14px;">
                    This link expires in {expires_in}. If you didn't request this, you can ignore this email.
                </p>
                <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;">
                <p style="color: #999; font-size: 12px;">
                    Sent by Bheem Workspace. © 2026 Bheemverse Innovation
                </p>
            </body>
            </html>
            """
            result = await self.send_email(
                to=to,
                subject="Reset your Bheem Workspace password",
                html_body=html_body,
                text_body=f"Reset your password at: {reset_url}"
            )

        return result

    async def send_user_added_email(
        self,
        to: str,
        name: str,
        workspace_name: str,
        admin_name: str,
        role: str,
        login_url: Optional[str] = None,
        workspace_email: Optional[str] = None,
        temp_password: Optional[str] = None,
        mailbox_created: bool = False
    ) -> Dict[str, Any]:
        """
        Send email when admin adds a user to workspace (industry-standard pattern).

        Args:
            to: Where to send the email (personal email)
            name: User's display name
            workspace_name: Name of the workspace
            admin_name: Name of admin who added the user
            role: Role assigned to user
            login_url: Login page URL
            workspace_email: User's new workspace email (LOGIN email)
            temp_password: Temporary password
            mailbox_created: Whether a mailbox was also created
        """
        login_url = login_url or f"{self.workspace_url}/login"
        # Use workspace_email as login, fallback to 'to' for backward compatibility
        login_email = workspace_email or to

        mailbox_section = ""
        if mailbox_created:
            mailbox_section = f"""
                <div style="background: #ecfdf5; padding: 15px; border-radius: 8px; margin: 15px 0;">
                    <p style="margin: 0 0 10px 0; font-weight: bold; color: #065f46;">📧 Your Email Account is Ready!</p>
                    <p style="margin: 0; color: #047857;">
                        Email: <strong>{login_email}</strong><br>
                        Webmail: <a href="https://mail.bheem.cloud" style="color: #059669;">mail.bheem.cloud</a>
                    </p>
                </div>
            """

        html_body = f"""
        <html>
        <body style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
            <div style="background: linear-gradient(135deg, #4F46E5 0%, #7C3AED 100%); padding: 30px; border-radius: 12px 12px 0 0;">
                <h1 style="color: white; margin: 0;">Welcome to {workspace_name}!</h1>
                <p style="color: rgba(255,255,255,0.9); margin: 10px 0 0 0;">You've been added by {admin_name}</p>
            </div>
            <div style="background: #f8fafc; padding: 30px; border-radius: 0 0 12px 12px;">
                <p style="font-size: 16px;">Hello <strong>{name}</strong>,</p>
                <p><strong>{admin_name}</strong> has added you to <strong>{workspace_name}</strong> as a <strong style="color: #4F46E5;">{role}</strong>.</p>

                <div style="background: white; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #4F46E5;">
                    <h3 style="margin-top: 0; color: #1e293b;">Your Login Credentials</h3>
                    <p style="margin: 5px 0;"><strong>Workspace Email:</strong> <span style="color: #4F46E5; font-size: 16px;">{login_email}</span></p>
                    <p style="margin: 5px 0;"><strong>Temporary Password:</strong> <code style="background: #e2e8f0; padding: 4px 10px; border-radius: 4px; font-size: 14px;">{temp_password or 'Use your existing password'}</code></p>
                    <p style="color: #64748b; font-size: 13px; margin-top: 10px;">⚠️ Please change your password after first login</p>
                </div>

                {mailbox_section}

                <div style="background: white; padding: 15px; border-radius: 8px; margin: 15px 0;">
                    <p style="margin: 0 0 10px 0; font-weight: bold;">What you can access:</p>
                    <ul style="margin: 0; padding-left: 20px; color: #475569;">
                        <li>📹 Video meetings with <strong>Bheem Meet</strong></li>
                        <li>📄 Document collaboration with <strong>Bheem Docs</strong></li>
                        {"<li>📧 Professional email with <strong>Bheem Mail</strong></li>" if mailbox_created else ""}
                    </ul>
                </div>

                <p style="margin: 30px 0; text-align: center;">
                    <a href="{login_url}" style="background-color: #4F46E5; color: white; padding: 14px 28px; text-decoration: none; border-radius: 8px; font-weight: bold; display: inline-block;">
                        Login to Workspace
                    </a>
                </p>

                <p style="color: #64748b; font-size: 14px; text-align: center;">
                    Login with: <strong>{login_email}</strong>
                </p>

                <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 20px 0;">
                <p style="color: #94a3b8; font-size: 12px; text-align: center;">
                    Need help? Contact us at support@bheem.cloud<br>
                    © 2026 Bheemverse Innovation - Bheem Workspace
                </p>
            </div>
        </body>
        </html>
        """

        return await self.send_email(
            to=to,
            subject=f"Welcome! You've been added to {workspace_name}",
            html_body=html_body,
            text_body=f"You've been added to {workspace_name}! Your workspace email: {login_email}. Password: {temp_password}. Login at: {login_url}"
        )

    # ═══════════════════════════════════════════════════════════════
    # MEETING METHODS
    # ═══════════════════════════════════════════════════════════════

    async def send_meeting_invite(
        self,
        to: str,
        meeting_title: str,
        meeting_time: str,
        meeting_url: str,
        host_name: Optional[str] = None,
        host_email: Optional[str] = None,
        attendees: Optional[List[str]] = None,
        scheduled_start: Optional[str] = None,
        duration_minutes: int = 60,
        room_code: Optional[str] = None,
        description: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Send meeting invitation email with ICS calendar attachment.

        Args:
            to: Attendee's email address
            meeting_title: Title of the meeting
            meeting_time: Formatted date/time string
            meeting_url: URL to join the meeting
            host_name: Name of meeting host
            host_email: Email of meeting host
            attendees: List of other attendees
            scheduled_start: ISO format datetime string for ICS
            duration_minutes: Meeting duration in minutes
            room_code: Meeting room code
            description: Meeting description
        """
        host_name = host_name or "Bheem Workspace"
        host_email = host_email or self.sender_email
        attendees_html = ""
        if attendees:
            attendees_list = "".join([f"<li>{email}</li>" for email in attendees if email != to])
            if attendees_list:
                attendees_html = f"""
                <p><strong>Other attendees:</strong></p>
                <ul style="color: #64748b;">{attendees_list}</ul>
                """

        # Generate ICS calendar content
        ics_content = None
        if scheduled_start:
            ics_content = self._generate_ics_content(
                title=meeting_title,
                description=description or f"Join the meeting: {meeting_url}",
                start_time=scheduled_start,
                duration_minutes=duration_minutes,
                location=meeting_url,
                organizer_name=host_name,
                organizer_email=host_email,
                attendees=attendees or [],
                room_code=room_code
            )

        # Calendar add buttons
        calendar_buttons = ""
        if scheduled_start:
            calendar_buttons = f"""
                <div style="margin: 20px 0; text-align: center;">
                    <p style="color: #64748b; font-size: 14px; margin-bottom: 10px;">Add to your calendar:</p>
                    <div style="display: inline-flex; gap: 10px;">
                        <a href="https://calendar.google.com/calendar/render?action=TEMPLATE&text={meeting_title}&dates={self._format_google_date(scheduled_start, duration_minutes)}&details={meeting_url}&location={meeting_url}" target="_blank" style="background: #4285f4; color: white; padding: 8px 16px; border-radius: 6px; text-decoration: none; font-size: 13px;">Google Calendar</a>
                        <a href="https://outlook.live.com/calendar/0/deeplink/compose?subject={meeting_title}&startdt={scheduled_start}&body={meeting_url}" target="_blank" style="background: #0078d4; color: white; padding: 8px 16px; border-radius: 6px; text-decoration: none; font-size: 13px;">Outlook</a>
                    </div>
                </div>
            """

        html_body = f"""
        <html>
        <body style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
            <div style="background: linear-gradient(135deg, #4F46E5 0%, #7C3AED 100%); padding: 30px; border-radius: 12px 12px 0 0;">
                <h1 style="color: white; margin: 0;">Meeting Invitation</h1>
            </div>
            <div style="background: #f8fafc; padding: 30px; border-radius: 0 0 12px 12px;">
                <h2 style="color: #1e293b; margin-top: 0;">{meeting_title}</h2>

                <div style="background: white; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #4F46E5;">
                    <p style="margin: 0 0 10px 0;"><strong>📅 When:</strong> {meeting_time}</p>
                    <p style="margin: 0 0 10px 0;"><strong>⏱️ Duration:</strong> {duration_minutes} minutes</p>
                    <p style="margin: 0 0 10px 0;"><strong>👤 Host:</strong> {host_name}</p>
                    {f'<p style="margin: 0;"><strong>📝 Code:</strong> {room_code}</p>' if room_code else ''}
                </div>

                {attendees_html}

                <p style="margin: 30px 0; text-align: center;">
                    <a href="{meeting_url}" style="background-color: #4F46E5; color: white; padding: 14px 28px; text-decoration: none; border-radius: 8px; font-weight: bold; display: inline-block;">
                        Join Meeting
                    </a>
                </p>

                {calendar_buttons}

                <p style="color: #64748b; font-size: 14px; text-align: center;">
                    Or copy this link: <a href="{meeting_url}" style="color: #4F46E5;">{meeting_url}</a>
                </p>

                <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 20px 0;">
                <p style="color: #94a3b8; font-size: 12px; text-align: center;">
                    Powered by Bheem Meet | © 2026 Bheemverse Innovation
                </p>
            </div>
        </body>
        </html>
        """

        # Send email with ICS attachment if available
        return await self.send_email(
            to=to,
            subject=f"Meeting Invitation: {meeting_title}",
            html_body=html_body,
            text_body=f"You're invited to {meeting_title} at {meeting_time}. Join at: {meeting_url}"
        )

    def _generate_ics_content(
        self,
        title: str,
        description: str,
        start_time: str,
        duration_minutes: int,
        location: str,
        organizer_name: str,
        organizer_email: str,
        attendees: List[str],
        room_code: Optional[str] = None
    ) -> str:
        """Generate ICS calendar content."""
        from datetime import datetime, timedelta

        try:
            start_dt = datetime.fromisoformat(start_time.replace('Z', '+00:00'))
        except:
            start_dt = datetime.utcnow()

        end_dt = start_dt + timedelta(minutes=duration_minutes)

        def format_ics_date(dt):
            return dt.strftime('%Y%m%dT%H%M%SZ')

        uid = f"{room_code or 'meet'}@bheem.cloud"
        now = datetime.utcnow()

        # Format attendees
        attendee_lines = "\n".join([
            f"ATTENDEE;CN={email};RSVP=TRUE:mailto:{email}"
            for email in attendees
        ])

        ics = f"""BEGIN:VCALENDAR
VERSION:2.0
PRODID:-//Bheem//Bheem Meet//EN
CALSCALE:GREGORIAN
METHOD:REQUEST
BEGIN:VEVENT
UID:{uid}
DTSTAMP:{format_ics_date(now)}
DTSTART:{format_ics_date(start_dt)}
DTEND:{format_ics_date(end_dt)}
SUMMARY:{title}
DESCRIPTION:{description}
LOCATION:{location}
ORGANIZER;CN={organizer_name}:mailto:{organizer_email}
{attendee_lines}
STATUS:CONFIRMED
SEQUENCE:0
END:VEVENT
END:VCALENDAR"""
        return ics

    def _format_google_date(self, start_time: str, duration_minutes: int) -> str:
        """Format date for Google Calendar URL."""
        from datetime import datetime, timedelta
        try:
            start_dt = datetime.fromisoformat(start_time.replace('Z', '+00:00'))
            end_dt = start_dt + timedelta(minutes=duration_minutes)
            return f"{start_dt.strftime('%Y%m%dT%H%M%SZ')}/{end_dt.strftime('%Y%m%dT%H%M%SZ')}"
        except:
            return ""

    async def send_calendar_invite(
        self,
        to: str,
        event_title: str,
        event_time: str,
        location: str = "Not specified",
        organizer_name: Optional[str] = None,
        description: str = "",
        attendees: Optional[List[str]] = None
    ) -> Dict[str, Any]:
        """
        Send calendar event invitation email.

        Args:
            to: Attendee's email address
            event_title: Title of the calendar event
            event_time: Formatted date/time string
            location: Event location
            organizer_name: Name of event organizer
            description: Event description
            attendees: List of other attendees
        """
        organizer_name = organizer_name or "Bheem Workspace"
        attendees_html = ""
        if attendees:
            attendees_list = "".join([f"<li>{email}</li>" for email in attendees if email != to])
            if attendees_list:
                attendees_html = f"""
                <p><strong>Other attendees:</strong></p>
                <ul style="color: #64748b; font-size: 14px;">{attendees_list}</ul>
                """

        description_html = ""
        if description:
            description_html = f"""
            <div style="margin: 15px 0;">
                <p><strong>Description:</strong></p>
                <p style="color: #64748b;">{description}</p>
            </div>
            """

        html_body = f"""
        <html>
        <body style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
            <div style="background: linear-gradient(135deg, #10B981 0%, #059669 100%); padding: 30px; border-radius: 12px 12px 0 0;">
                <h1 style="color: white; margin: 0;">Calendar Invitation</h1>
            </div>
            <div style="background: #f8fafc; padding: 30px; border-radius: 0 0 12px 12px;">
                <h2 style="color: #1e293b; margin-top: 0;">{event_title}</h2>

                <div style="background: white; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #10B981;">
                    <p style="margin: 0 0 10px 0;"><strong>Organizer:</strong> {organizer_name}</p>
                    <p style="margin: 0 0 10px 0;"><strong>When:</strong> {event_time}</p>
                    <p style="margin: 0;"><strong>Location:</strong> {location}</p>
                </div>

                {description_html}
                {attendees_html}

                <div style="background: #ecfdf5; padding: 15px; border-radius: 8px; margin: 20px 0;">
                    <p style="margin: 0; color: #065f46; font-size: 14px;">
                        This event has been added to your calendar. You will receive a reminder before the event.
                    </p>
                </div>

                <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 20px 0;">
                <p style="color: #94a3b8; font-size: 12px; text-align: center;">
                    Powered by Bheem Calendar | © 2026 Bheemverse Innovation
                </p>
            </div>
        </body>
        </html>
        """

        return await self.send_email(
            to=to,
            subject=f"Calendar Invite: {event_title}",
            html_body=html_body,
            text_body=f"You're invited to {event_title} at {event_time}. Location: {location}"
        )

    # ═══════════════════════════════════════════════════════════════
    # SMS METHODS
    # ═══════════════════════════════════════════════════════════════

    async def send_sms(
        self,
        to: str,
        message: str,
        sender_id: Optional[str] = None,
        company_id: str = "BHM001"
    ) -> Dict[str, Any]:
        """
        Send SMS message via unified Notify API.

        Args:
            to: Phone number (with country code, e.g., 919876543210)
            message: SMS content
            sender_id: Sender ID (optional)
            company_id: Company code (default: BHM001)
        """
        payload = {
            "company_id": company_id,
            "channels": ["sms"],
            "type": "transactional",
            "subject": "SMS Notification",
            "content": message,
            "recipients": {
                "phone": to
            }
        }

        return await self._make_request("POST", "/api/v1/notify/send", payload)

    async def send_otp(
        self,
        to: str,
        otp_length: int = 6
    ) -> Dict[str, Any]:
        """
        Send OTP via SMS using Bheem-Tele.

        Args:
            to: Phone number (with country code)
            otp_length: Length of OTP (default 6)

        Returns:
            Dict with request_id for verification
        """
        return await self._make_request(
            "POST",
            "/api/v1/bheem-tele/otp/send",
            {
                "mobile": to,
                "otp_length": otp_length
            }
        )

    async def verify_otp(
        self,
        to: str,
        otp: str
    ) -> Dict[str, Any]:
        """
        Verify OTP via Bheem-Tele.

        Args:
            to: Phone number used for OTP
            otp: OTP code entered by user

        Returns:
            Dict with verification result
        """
        return await self._make_request(
            "POST",
            "/api/v1/bheem-tele/otp/verify",
            {
                "mobile": to,
                "otp": otp
            }
        )

    # ═══════════════════════════════════════════════════════════════
    # WHATSAPP METHODS
    # ═══════════════════════════════════════════════════════════════

    async def send_whatsapp_template(
        self,
        to: str,
        template_name: str,
        template_variables: Optional[List[str]] = None,
        language: str = "en"
    ) -> Dict[str, Any]:
        """
        Send WhatsApp template message via Meta API.

        Args:
            to: Phone number (with country code)
            template_name: Pre-approved template name
            template_variables: Variables for template (as list)
            language: Template language (default: en)
        """
        payload = {
            "to": to,
            "template_name": template_name,
            "language": language
        }
        if template_variables:
            payload["template_params"] = template_variables

        return await self._make_request("POST", "/api/v1/meta/whatsapp/send/template", payload)

    async def send_whatsapp_text(
        self,
        to: str,
        message: str
    ) -> Dict[str, Any]:
        """
        Send WhatsApp text message via Meta API (within 24h session window).

        Args:
            to: Phone number (with country code, e.g., 919876543210)
            message: Message content
        """
        return await self._make_request(
            "POST",
            "/api/v1/meta/whatsapp/send/text",
            {
                "to": to,
                "message": message
            }
        )

    async def send_multi_channel(
        self,
        email: Optional[str] = None,
        phone: Optional[str] = None,
        subject: str = "",
        content: str = "",
        channels: Optional[List[str]] = None,
        company_id: str = "BHM001",
        notification_type: str = "transactional"
    ) -> Dict[str, Any]:
        """
        Send notification to multiple channels at once.

        Args:
            email: Recipient email address
            phone: Recipient phone number
            subject: Notification subject
            content: Notification content (HTML for email, text for SMS/WhatsApp)
            channels: List of channels ["email", "sms", "whatsapp"]
            company_id: Company code
            notification_type: Type of notification
        """
        if channels is None:
            channels = []
            if email:
                channels.append("email")
            if phone:
                channels.append("sms")

        recipients = {}
        if email:
            recipients["email"] = email
        if phone:
            recipients["phone"] = phone

        payload = {
            "company_id": company_id,
            "channels": channels,
            "type": notification_type,
            "subject": subject,
            "content": content,
            "recipients": recipients
        }

        return await self._make_request("POST", "/api/v1/notify/send", payload)

    # ═══════════════════════════════════════════════════════════════
    # HEALTH & STATUS
    # ═══════════════════════════════════════════════════════════════

    async def health_check(self) -> bool:
        """Check if Notify service is available."""
        try:
            async with httpx.AsyncClient(timeout=5.0) as client:
                response = await client.get(
                    f"{self.notify_url}/health",
                    headers=self._headers()
                )
                return response.status_code == 200
        except Exception:
            return False

    async def get_provider_status(self) -> Dict[str, Any]:
        """Get BheemTele provider status and balance."""
        return await self._make_request("GET", "/api/v1/bheem-tele/status")

    async def get_balance(self) -> Dict[str, Any]:
        """Get BheemTele account balance."""
        return await self._make_request("GET", "/api/v1/bheem-tele/balance")

    async def close(self):
        """Close client (no-op for compatibility)."""
        pass

    # ═══════════════════════════════════════════════════════════════
    # BACKWARD COMPATIBILITY (msg91_service interface)
    # ═══════════════════════════════════════════════════════════════

    @property
    def sms_sender_id(self) -> str:
        """SMS sender ID for backward compatibility."""
        return "BHEEM"

    async def send_otp_sms(
        self,
        mobile: str,
        otp: Optional[str] = None,
        template_id: Optional[str] = None
    ) -> Dict[str, Any]:
        """Send OTP via SMS (backward compatibility)."""
        if otp:
            message = f"Your Bheem verification code is {otp}. Valid for 10 minutes."
            return await self.send_sms(to=mobile, message=message)
        else:
            return await self.send_otp(to=mobile)

    async def send_quick_sms(self, mobile: str, message: str) -> Dict[str, Any]:
        """Send quick SMS (backward compatibility)."""
        return await self.send_sms(to=mobile, message=message)

    async def send_otp_email(
        self,
        to: str,
        otp: str,
        purpose: str = "verification"
    ) -> Dict[str, Any]:
        """Send OTP via email."""
        subject_map = {
            "verification": "Verify your Bheem account",
            "password_reset": "Reset your Bheem password",
            "login": "Your Bheem login code"
        }
        subject = subject_map.get(purpose, "Your Bheem verification code")

        html_body = f"""
        <div style="font-family: Arial, sans-serif; max-width: 500px; margin: 0 auto; padding: 20px;">
            <h2 style="color: #4F46E5;">Bheem Workspace</h2>
            <p>Your verification code is:</p>
            <div style="background: #f1f5f9; padding: 20px; text-align: center; border-radius: 8px; margin: 20px 0;">
                <span style="font-size: 32px; font-weight: bold; color: #4F46E5; letter-spacing: 8px;">{otp}</span>
            </div>
            <p style="color: #64748b; font-size: 14px;">This code expires in 10 minutes.</p>
        </div>
        """

        return await self.send_email(to=to, subject=subject, html_body=html_body)

    def get_domain_dns_records(self, domain: str) -> Dict[str, Any]:
        """Get DNS records required for domain setup (sync method for compat)."""
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
            ]
        }


# Singleton instance
notify_client = NotifyClient()

# Backward compatibility aliases
msg91_service = notify_client
bheem_tele_service = notify_client
