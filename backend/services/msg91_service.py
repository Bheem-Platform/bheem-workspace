"""
Bheem Workspace - Bheem-Tele Communication Service
Transactional email and SMS sending (Powered by Bheem-Tele)
"""
import httpx
from typing import List, Dict, Any, Optional
from core.config import settings


class BheemTeleService:
    """Bheem-Tele Communication Service for transactional emails and SMS"""

    def __init__(self):
        self.auth_key = settings.MSG91_AUTH_KEY
        self.sender_email = settings.MSG91_SENDER_EMAIL
        self.sender_name = settings.MSG91_SENDER_NAME
        # Internal API endpoints (white-labeled)
        self._base_url = "https://control.msg91.com/api/v5"
        self._email_url = "https://api.msg91.com/api/v5/email/send"
        self._sms_url = "https://control.msg91.com/api/v5/flow/"
        self._otp_url = "https://control.msg91.com/api/v5/otp"
        self.sms_sender_id = "BHEEMTL"  # 6 character sender ID for Bheem-Tele

    async def send_email(
        self,
        to: List[str],
        subject: str,
        body: str,
        from_email: Optional[str] = None,
        from_name: Optional[str] = None,
        cc: Optional[List[str]] = None,
        bcc: Optional[List[str]] = None,
        reply_to: Optional[str] = None,
        is_html: bool = True,
        attachments: Optional[List[Dict[str, Any]]] = None
    ) -> Dict[str, Any]:
        """
        Send email via Bheem-Tele

        Args:
            to: List of recipient email addresses
            subject: Email subject
            body: Email body (HTML or plain text)
            from_email: Sender email (defaults to config)
            from_name: Sender name (defaults to config)
            cc: List of CC recipients
            bcc: List of BCC recipients
            reply_to: Reply-to email address
            is_html: Whether body is HTML
            attachments: List of attachments with base64 content

        Returns:
            API response dict with success/error info
        """
        sender = from_email or self.sender_email
        name = from_name or self.sender_name

        # Build recipients list
        recipients = [{"to": [{"email": email} for email in to]}]

        # Add CC if provided
        if cc:
            recipients[0]["cc"] = [{"email": email} for email in cc]

        # Add BCC if provided
        if bcc:
            recipients[0]["bcc"] = [{"email": email} for email in bcc]

        payload = {
            "recipients": recipients,
            "from": {
                "email": sender,
                "name": name
            },
            "subject": subject,
            "content_type": "text/html" if is_html else "text/plain",
            "body": body
        }

        # Add reply-to if provided
        if reply_to:
            payload["reply_to"] = reply_to

        # Add attachments if provided
        if attachments:
            payload["attachments"] = attachments

        headers = {
            "authkey": self.auth_key,
            "Content-Type": "application/json"
        }

        try:
            async with httpx.AsyncClient() as client:
                response = await client.post(
                    self._email_url,
                    json=payload,
                    headers=headers,
                    timeout=30.0
                )

                result = response.json()

                if response.status_code == 200:
                    return {
                        "success": True,
                        "message": "Email sent successfully",
                        "data": result
                    }
                else:
                    return {
                        "success": False,
                        "message": result.get("message", "Failed to send email"),
                        "error": result
                    }

        except httpx.TimeoutException:
            return {
                "success": False,
                "message": "Request timed out",
                "error": "timeout"
            }
        except Exception as e:
            return {
                "success": False,
                "message": f"Error sending email: {str(e)}",
                "error": str(e)
            }

    async def send_template_email(
        self,
        to: List[str],
        template_id: str,
        variables: Dict[str, str],
        from_email: Optional[str] = None,
        from_name: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Send email using Bheem-Tele template

        Args:
            to: List of recipient email addresses
            template_id: Bheem-Tele template ID
            variables: Template variables to replace
            from_email: Sender email
            from_name: Sender name

        Returns:
            API response dict
        """
        sender = from_email or self.sender_email
        name = from_name or self.sender_name

        # Build recipients with variables
        recipients = []
        for email in to:
            recipient = {"to": [{"email": email}]}
            # Add variables for each recipient
            for key, value in variables.items():
                recipient[key] = value
            recipients.append(recipient)

        payload = {
            "template_id": template_id,
            "recipients": recipients,
            "from": {
                "email": sender,
                "name": name
            }
        }

        headers = {
            "authkey": self.auth_key,
            "Content-Type": "application/json"
        }

        try:
            async with httpx.AsyncClient() as client:
                response = await client.post(
                    self._email_url,
                    json=payload,
                    headers=headers,
                    timeout=30.0
                )

                result = response.json()

                if response.status_code == 200:
                    return {
                        "success": True,
                        "message": "Template email sent successfully",
                        "data": result
                    }
                else:
                    return {
                        "success": False,
                        "message": result.get("message", "Failed to send template email"),
                        "error": result
                    }

        except Exception as e:
            return {
                "success": False,
                "message": f"Error sending template email: {str(e)}",
                "error": str(e)
            }

    async def send_otp_email(
        self,
        to: str,
        otp: str,
        purpose: str = "verification"
    ) -> Dict[str, Any]:
        """
        Send OTP email for verification

        Args:
            to: Recipient email
            otp: OTP code
            purpose: Purpose of OTP (verification, password_reset, etc.)

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
        <!DOCTYPE html>
        <html>
        <head>
            <style>
                body {{ font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background: #f5f7fa; padding: 20px; }}
                .container {{ max-width: 500px; margin: 0 auto; background: white; border-radius: 12px; padding: 40px; box-shadow: 0 4px 20px rgba(0,0,0,0.1); }}
                .logo {{ text-align: center; margin-bottom: 30px; }}
                .logo-icon {{ width: 60px; height: 60px; background: linear-gradient(135deg, #2563eb, #7c3aed); border-radius: 12px; margin: 0 auto 10px; display: flex; align-items: center; justify-content: center; }}
                .logo-text {{ font-size: 24px; font-weight: 700; color: #1e293b; }}
                .otp-box {{ background: #f1f5f9; border-radius: 8px; padding: 20px; text-align: center; margin: 30px 0; }}
                .otp-code {{ font-size: 36px; font-weight: 700; color: #2563eb; letter-spacing: 8px; }}
                .message {{ color: #64748b; font-size: 14px; line-height: 1.6; }}
                .footer {{ margin-top: 30px; text-align: center; color: #94a3b8; font-size: 12px; }}
            </style>
        </head>
        <body>
            <div class="container">
                <div class="logo">
                    <div class="logo-icon">
                        <svg width="32" height="32" viewBox="0 0 24 24" fill="white"><path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/></svg>
                    </div>
                    <div class="logo-text">Bheem Workspace</div>
                </div>
                <p class="message">Your verification code is:</p>
                <div class="otp-box">
                    <div class="otp-code">{otp}</div>
                </div>
                <p class="message">This code will expire in 10 minutes. If you didn't request this code, please ignore this email.</p>
                <div class="footer">
                    <p>&copy; 2024 Bheem Workspace. All rights reserved.</p>
                </div>
            </div>
        </body>
        </html>
        """

        return await self.send_email(
            to=[to],
            subject=subject,
            body=body,
            is_html=True
        )

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
        body = f"""
        <!DOCTYPE html>
        <html>
        <head>
            <style>
                body {{ font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background: #f5f7fa; padding: 20px; }}
                .container {{ max-width: 600px; margin: 0 auto; background: white; border-radius: 12px; padding: 40px; box-shadow: 0 4px 20px rgba(0,0,0,0.1); }}
                .logo {{ text-align: center; margin-bottom: 30px; }}
                .logo-icon {{ width: 60px; height: 60px; background: linear-gradient(135deg, #2563eb, #7c3aed); border-radius: 12px; margin: 0 auto 10px; display: flex; align-items: center; justify-content: center; }}
                .logo-text {{ font-size: 24px; font-weight: 700; color: #1e293b; }}
                h1 {{ color: #1e293b; font-size: 28px; margin-bottom: 20px; }}
                .message {{ color: #64748b; font-size: 16px; line-height: 1.8; }}
                .features {{ margin: 30px 0; }}
                .feature {{ display: flex; align-items: center; margin: 15px 0; padding: 15px; background: #f8fafc; border-radius: 8px; }}
                .feature-icon {{ width: 40px; height: 40px; border-radius: 8px; display: flex; align-items: center; justify-content: center; margin-right: 15px; }}
                .feature-mail {{ background: linear-gradient(135deg, #ff6b35, #f7931e); }}
                .feature-docs {{ background: linear-gradient(135deg, #10b981, #059669); }}
                .feature-meet {{ background: linear-gradient(135deg, #3b82f6, #2563eb); }}
                .feature-text {{ color: #334155; font-weight: 500; }}
                .btn {{ display: inline-block; background: linear-gradient(135deg, #2563eb, #7c3aed); color: white; padding: 14px 28px; border-radius: 8px; text-decoration: none; font-weight: 600; margin-top: 20px; }}
                .footer {{ margin-top: 30px; text-align: center; color: #94a3b8; font-size: 12px; border-top: 1px solid #e2e8f0; padding-top: 20px; }}
            </style>
        </head>
        <body>
            <div class="container">
                <div class="logo">
                    <div class="logo-icon">
                        <svg width="32" height="32" viewBox="0 0 24 24" fill="white"><path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/></svg>
                    </div>
                    <div class="logo-text">Bheem Workspace</div>
                </div>
                <h1>Welcome to Bheem, {username}!</h1>
                <p class="message">Your unified workspace is ready. Start collaborating with your team using our integrated tools:</p>

                <div class="features">
                    <div class="feature">
                        <div class="feature-icon feature-mail">
                            <svg width="20" height="20" fill="white" viewBox="0 0 24 24"><path d="M20 4H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 4l-8 5-8-5V6l8 5 8-5v2z"/></svg>
                        </div>
                        <span class="feature-text">Bheem Mail - Professional email with your domain</span>
                    </div>
                    <div class="feature">
                        <div class="feature-icon feature-docs">
                            <svg width="20" height="20" fill="white" viewBox="0 0 24 24"><path d="M14 2H6c-1.1 0-2 .9-2 2v16c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V8l-6-6zm2 16H8v-2h8v2zm0-4H8v-2h8v2zm-3-5V3.5L18.5 9H13z"/></svg>
                        </div>
                        <span class="feature-text">Bheem Docs - Secure document management</span>
                    </div>
                    <div class="feature">
                        <div class="feature-icon feature-meet">
                            <svg width="20" height="20" fill="white" viewBox="0 0 24 24"><path d="M17 10.5V7c0-.55-.45-1-1-1H4c-.55 0-1 .45-1 1v10c0 .55.45 1 1 1h12c.55 0 1-.45 1-1v-3.5l4 4v-11l-4 4z"/></svg>
                        </div>
                        <span class="feature-text">Bheem Meet - HD video conferencing</span>
                    </div>
                </div>

                <a href="https://workspace.bheem.cloud/dashboard" class="btn">Go to Dashboard</a>

                <div class="footer">
                    <p>&copy; 2024 Bheem Workspace. All rights reserved.</p>
                    <p>Need help? Contact support@bheem.cloud</p>
                </div>
            </div>
        </body>
        </html>
        """

        return await self.send_email(
            to=[to],
            subject=f"Welcome to Bheem Workspace, {username}!",
            body=body,
            is_html=True
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
            meeting_name: Name of the meeting
            host_name: Name of the meeting host
            meeting_url: URL to join the meeting
            scheduled_time: Optional scheduled time

        Returns:
            API response dict
        """
        time_section = ""
        if scheduled_time:
            time_section = f"""
            <div class="detail">
                <span class="detail-label">When:</span>
                <span class="detail-value">{scheduled_time}</span>
            </div>
            """

        body = f"""
        <!DOCTYPE html>
        <html>
        <head>
            <style>
                body {{ font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background: #f5f7fa; padding: 20px; }}
                .container {{ max-width: 500px; margin: 0 auto; background: white; border-radius: 12px; padding: 40px; box-shadow: 0 4px 20px rgba(0,0,0,0.1); }}
                .header {{ background: linear-gradient(135deg, #3b82f6, #2563eb); color: white; margin: -40px -40px 30px; padding: 30px 40px; border-radius: 12px 12px 0 0; }}
                h1 {{ margin: 0; font-size: 24px; }}
                .detail {{ margin: 15px 0; padding: 15px; background: #f8fafc; border-radius: 8px; }}
                .detail-label {{ color: #64748b; font-size: 13px; display: block; margin-bottom: 4px; }}
                .detail-value {{ color: #1e293b; font-weight: 600; font-size: 16px; }}
                .btn {{ display: inline-block; background: linear-gradient(135deg, #3b82f6, #2563eb); color: white; padding: 16px 32px; border-radius: 8px; text-decoration: none; font-weight: 600; margin-top: 20px; }}
                .footer {{ margin-top: 30px; text-align: center; color: #94a3b8; font-size: 12px; }}
            </style>
        </head>
        <body>
            <div class="container">
                <div class="header">
                    <h1>You're Invited!</h1>
                </div>
                <p style="color: #64748b; font-size: 16px;">{host_name} has invited you to a meeting.</p>

                <div class="detail">
                    <span class="detail-label">Meeting:</span>
                    <span class="detail-value">{meeting_name}</span>
                </div>
                {time_section}
                <div class="detail">
                    <span class="detail-label">Host:</span>
                    <span class="detail-value">{host_name}</span>
                </div>

                <a href="{meeting_url}" class="btn">Join Meeting</a>

                <div class="footer">
                    <p>Powered by Bheem Meet</p>
                </div>
            </div>
        </body>
        </html>
        """

        return await self.send_email(
            to=to,
            subject=f"Meeting Invite: {meeting_name}",
            body=body,
            is_html=True
        )

    # ===========================================
    # SMS Methods
    # ===========================================

    async def send_sms(
        self,
        mobile: str,
        message: str,
        template_id: Optional[str] = None,
        sender_id: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Send SMS via Bheem-Tele

        Args:
            mobile: Mobile number with country code (e.g., 919876543210)
            message: SMS message content
            template_id: DLT registered template ID (required in India)
            sender_id: 6 character sender ID

        Returns:
            API response dict
        """
        # Clean mobile number - remove spaces, dashes, plus sign
        mobile = mobile.replace(" ", "").replace("-", "").replace("+", "")

        # Ensure country code
        if not mobile.startswith("91") and len(mobile) == 10:
            mobile = "91" + mobile

        sender = sender_id or self.sms_sender_id

        # Using the sendhttp API for simple SMS
        url = "https://control.msg91.com/api/v5/flow/"

        payload = {
            "template_id": template_id,
            "sender": sender,
            "mobiles": mobile,
            "VAR1": message  # Variable placeholder
        }

        headers = {
            "authkey": self.auth_key,
            "Content-Type": "application/json"
        }

        try:
            async with httpx.AsyncClient() as client:
                response = await client.post(
                    url,
                    json=payload,
                    headers=headers,
                    timeout=30.0
                )

                result = response.json()

                if response.status_code == 200 and result.get("type") == "success":
                    return {
                        "success": True,
                        "message": "SMS sent successfully",
                        "data": result
                    }
                else:
                    return {
                        "success": False,
                        "message": result.get("message", "Failed to send SMS"),
                        "error": result
                    }

        except Exception as e:
            return {
                "success": False,
                "message": f"Error sending SMS: {str(e)}",
                "error": str(e)
            }

    async def send_otp_sms(
        self,
        mobile: str,
        otp: Optional[str] = None,
        template_id: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Send OTP via Bheem-Tele SMS

        Args:
            mobile: Mobile number with country code
            otp: Custom OTP (if not provided, Bheem-Tele generates one)
            template_id: OTP template ID

        Returns:
            API response dict with OTP details
        """
        # Clean mobile number
        mobile = mobile.replace(" ", "").replace("-", "").replace("+", "")
        if not mobile.startswith("91") and len(mobile) == 10:
            mobile = "91" + mobile

        params = {
            "authkey": self.auth_key,
            "mobile": mobile,
        }

        if template_id:
            params["template_id"] = template_id

        if otp:
            params["otp"] = otp

        try:
            async with httpx.AsyncClient() as client:
                response = await client.get(
                    self._otp_url,
                    params=params,
                    timeout=30.0
                )

                result = response.json()

                if result.get("type") == "success":
                    return {
                        "success": True,
                        "message": "OTP sent successfully",
                        "request_id": result.get("request_id"),
                        "data": result
                    }
                else:
                    return {
                        "success": False,
                        "message": result.get("message", "Failed to send OTP"),
                        "error": result
                    }

        except Exception as e:
            return {
                "success": False,
                "message": f"Error sending OTP: {str(e)}",
                "error": str(e)
            }

    async def verify_otp(
        self,
        mobile: str,
        otp: str
    ) -> Dict[str, Any]:
        """
        Verify OTP sent via Bheem-Tele

        Args:
            mobile: Mobile number with country code
            otp: OTP to verify

        Returns:
            API response dict
        """
        # Clean mobile number
        mobile = mobile.replace(" ", "").replace("-", "").replace("+", "")
        if not mobile.startswith("91") and len(mobile) == 10:
            mobile = "91" + mobile

        params = {
            "authkey": self.auth_key,
            "mobile": mobile,
            "otp": otp
        }

        try:
            async with httpx.AsyncClient() as client:
                response = await client.get(
                    f"{self._otp_url}/verify",
                    params=params,
                    timeout=30.0
                )

                result = response.json()

                if result.get("type") == "success":
                    return {
                        "success": True,
                        "message": "OTP verified successfully",
                        "data": result
                    }
                else:
                    return {
                        "success": False,
                        "message": result.get("message", "OTP verification failed"),
                        "error": result
                    }

        except Exception as e:
            return {
                "success": False,
                "message": f"Error verifying OTP: {str(e)}",
                "error": str(e)
            }

    async def send_quick_sms(
        self,
        mobile: str,
        message: str
    ) -> Dict[str, Any]:
        """
        Send quick SMS using direct API (for testing/non-DLT messages)

        Args:
            mobile: Mobile number
            message: Message text

        Returns:
            API response dict
        """
        # Clean mobile number
        mobile = mobile.replace(" ", "").replace("-", "").replace("+", "")
        if not mobile.startswith("91") and len(mobile) == 10:
            mobile = "91" + mobile

        url = "https://control.msg91.com/api/v5/flow/"

        # For quick SMS, we'll use the promotional route
        payload = {
            "sender": self.sms_sender_id,
            "route": "4",  # Promotional route
            "country": "91",
            "sms": [
                {
                    "message": message,
                    "to": [mobile]
                }
            ]
        }

        headers = {
            "authkey": self.auth_key,
            "Content-Type": "application/json"
        }

        try:
            async with httpx.AsyncClient() as client:
                response = await client.post(
                    url,
                    json=payload,
                    headers=headers,
                    timeout=30.0
                )

                result = response.json()

                return {
                    "success": response.status_code == 200,
                    "message": "SMS request submitted",
                    "data": result
                }

        except Exception as e:
            return {
                "success": False,
                "message": f"Error sending SMS: {str(e)}",
                "error": str(e)
            }


    # ===========================================
    # Domain Setup Helper Methods
    # ===========================================

    def get_domain_dns_records(self, domain: str) -> Dict[str, Any]:
        """
        Get required DNS records for email domain setup

        Args:
            domain: Domain name (e.g., bheem.co.uk)

        Returns:
            Dict with all required DNS records
        """
        return {
            "domain": domain,
            "records": [
                {
                    "type": "TXT",
                    "name": f"bheem-tele._domainkey.{domain}",
                    "value": "k=rsa; p=MIGfMA0GCSqGSIb3DQEBAQUAA4GNADCBiQKBgQDH/c6wFPlOsmRmxoJfkeDxqmtGwzznSbJpvJVnNrqDtgM1TRH9V3s9V1qrTa1xPQHD1XdVXVR9d8PZbKQsQVmNJWqKV6JTbvL7Q2rJSbZbNT+rV8N7FMzPQPj5jKZDmhWQy8sJFD/yXdOuQW0ZmJ+Fy7F5v7QXwkN8h0FQ0y0IQIDAQAB",
                    "description": "DKIM record for email signing"
                },
                {
                    "type": "TXT",
                    "name": domain,
                    "value": "v=spf1 include:spf.msg91.com ~all",
                    "description": "SPF record (add include:spf.msg91.com to existing SPF)"
                },
                {
                    "type": "CNAME",
                    "name": f"tele-track.{domain}",
                    "value": "track.msg91.com",
                    "description": "Email tracking (enable Cloudflare proxy to hide)"
                },
                {
                    "type": "CNAME",
                    "name": f"tele-bounce.{domain}",
                    "value": "bounce.msg91.com",
                    "description": "Bounce handling (enable Cloudflare proxy to hide)"
                },
                {
                    "type": "CNAME",
                    "name": f"_dmarc.{domain}",
                    "value": f"_dmarc.{domain}.hosted-dmarc.mailer91.com",
                    "description": "DMARC policy"
                }
            ],
            "manual_steps": [
                "1. Log into MSG91 dashboard: https://control.msg91.com",
                "2. Go to Email → Domain Settings",
                "3. Click 'Add Domain' and enter your domain",
                "4. Ensure all DNS records above are configured",
                "5. Click 'Verify' to validate domain"
            ],
            "note": "MSG91 does not provide a public API for domain verification. The domain must be verified manually in the dashboard."
        }

    async def check_domain_dns(self, domain: str) -> Dict[str, Any]:
        """
        Check if DNS records are properly configured for a domain
        Uses DNS lookup to verify records

        Args:
            domain: Domain to check

        Returns:
            Dict with verification status for each record type
        """
        import socket

        results = {
            "domain": domain,
            "checks": {},
            "ready_for_verification": True
        }

        # Check DKIM
        try:
            dkim_host = f"bheem-tele._domainkey.{domain}"
            socket.gethostbyname(dkim_host)
            results["checks"]["dkim"] = {"status": "configured", "host": dkim_host}
        except socket.gaierror:
            # TXT records don't resolve via gethostbyname, this is expected
            results["checks"]["dkim"] = {"status": "check_manually", "host": f"bheem-tele._domainkey.{domain}"}

        # Check tracking CNAME
        try:
            track_host = f"tele-track.{domain}"
            socket.gethostbyname(track_host)
            results["checks"]["tracking"] = {"status": "configured", "host": track_host}
        except socket.gaierror:
            results["checks"]["tracking"] = {"status": "not_found", "host": track_host}
            results["ready_for_verification"] = False

        # Check bounce CNAME
        try:
            bounce_host = f"tele-bounce.{domain}"
            socket.gethostbyname(bounce_host)
            results["checks"]["bounce"] = {"status": "configured", "host": bounce_host}
        except socket.gaierror:
            results["checks"]["bounce"] = {"status": "not_found", "host": bounce_host}
            results["ready_for_verification"] = False

        # Check DMARC
        try:
            dmarc_host = f"_dmarc.{domain}"
            socket.gethostbyname(dmarc_host)
            results["checks"]["dmarc"] = {"status": "configured", "host": dmarc_host}
        except socket.gaierror:
            results["checks"]["dmarc"] = {"status": "check_manually", "host": dmarc_host}

        return results


# Singleton instances (both names for backward compatibility)
bheem_tele_service = BheemTeleService()
msg91_service = bheem_tele_service  # Alias for backward compatibility
