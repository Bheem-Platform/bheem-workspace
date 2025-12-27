# Mail Integration - Implementation Guide

## Overview

This guide covers integrating email functionality across Bheem platform services using Mailgun (transactional email), Mailcow (mailboxes), and Bheem Notify (notification service).

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                     MAIL INTEGRATION                             │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │              APPLICATION LAYER                             │  │
│  │                                                            │  │
│  │  ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐          │  │
│  │  │bheem-core│ │workspace│ │ academy │ │  other  │          │  │
│  │  └────┬────┘ └────┬────┘ └────┬────┘ └────┬────┘          │  │
│  │       │           │           │           │                │  │
│  │       └───────────┴─────┬─────┴───────────┘                │  │
│  │                         │                                  │  │
│  │                         ▼                                  │  │
│  │  ┌─────────────────────────────────────────────────────┐  │  │
│  │  │              BHEEM NOTIFY SERVICE                    │  │  │
│  │  │                   (Port 8040)                        │  │  │
│  │  │                                                      │  │  │
│  │  │  POST /email/send        → Send single email        │  │  │
│  │  │  POST /email/batch       → Send batch emails        │  │  │
│  │  │  POST /email/template    → Send with template       │  │  │
│  │  │  GET  /email/status/{id} → Check delivery status    │  │  │
│  │  └─────────────────────────────────────────────────────┘  │  │
│  └───────────────────────────────────────────────────────────┘  │
│                         │                                        │
│          ┌──────────────┼──────────────┐                        │
│          ▼              ▼              ▼                        │
│  ┌──────────────┐ ┌──────────────┐ ┌──────────────┐            │
│  │   MAILGUN    │ │   MAILCOW    │ │   MSG91      │            │
│  │ (Transact.)  │ │  (Mailbox)   │ │  (SMS/OTP)   │            │
│  │              │ │              │ │              │            │
│  │ • Send email │ │ • Mailboxes  │ │ • SMS        │            │
│  │ • Templates  │ │ • Webmail    │ │ • OTP        │            │
│  │ • Analytics  │ │ • IMAP/SMTP  │ │ • WhatsApp   │            │
│  │ • Webhooks   │ │ • Aliases    │ │              │            │
│  └──────────────┘ └──────────────┘ └──────────────┘            │
└─────────────────────────────────────────────────────────────────┘
```

---

## Bheem Notify Service

### Email Provider Configuration

```python
# /root/bheem-platform/services/bheem-notify/app/providers/mailgun.py

import httpx
import os
from typing import Optional, List, Dict, Any
import base64

class MailgunProvider:
    def __init__(self):
        self.api_key = os.getenv("MAILGUN_API_KEY")
        self.domain = os.getenv("MAILGUN_DOMAIN", "bheem.co.uk")
        self.base_url = f"https://api.mailgun.net/v3/{self.domain}"
        self.from_name = os.getenv("MAILGUN_FROM_NAME", "Bheem Platform")
        self.from_email = os.getenv("MAILGUN_FROM_EMAIL", f"noreply@{self.domain}")

    async def send_email(
        self,
        to: str,
        subject: str,
        body: str,
        html: str = None,
        from_email: str = None,
        from_name: str = None,
        cc: List[str] = None,
        bcc: List[str] = None,
        reply_to: str = None,
        attachments: List[Dict[str, Any]] = None,
        tags: List[str] = None,
        tracking: bool = True
    ) -> Dict[str, Any]:
        """
        Send email via Mailgun

        Args:
            to: Recipient email
            subject: Email subject
            body: Plain text body
            html: HTML body (optional)
            from_email: Sender email
            from_name: Sender name
            cc: CC recipients
            bcc: BCC recipients
            reply_to: Reply-to address
            attachments: List of attachments [{filename, content, content_type}]
            tags: Tags for tracking
            tracking: Enable open/click tracking
        """
        sender = f"{from_name or self.from_name} <{from_email or self.from_email}>"

        data = {
            "from": sender,
            "to": to,
            "subject": subject,
            "text": body
        }

        if html:
            data["html"] = html

        if cc:
            data["cc"] = ",".join(cc)

        if bcc:
            data["bcc"] = ",".join(bcc)

        if reply_to:
            data["h:Reply-To"] = reply_to

        if tags:
            data["o:tag"] = tags

        data["o:tracking"] = "yes" if tracking else "no"

        # Handle attachments
        files = []
        if attachments:
            for att in attachments:
                files.append(
                    ("attachment", (att["filename"], att["content"], att.get("content_type", "application/octet-stream")))
                )

        async with httpx.AsyncClient() as client:
            response = await client.post(
                f"{self.base_url}/messages",
                auth=("api", self.api_key),
                data=data,
                files=files if files else None
            )

            if response.status_code == 200:
                result = response.json()
                return {
                    "success": True,
                    "message_id": result.get("id"),
                    "message": result.get("message")
                }
            else:
                return {
                    "success": False,
                    "error": response.text
                }

    async def send_batch(
        self,
        recipients: List[Dict[str, Any]],
        subject: str,
        body: str,
        html: str = None,
        from_email: str = None,
        from_name: str = None
    ) -> Dict[str, Any]:
        """
        Send batch emails with recipient variables

        Args:
            recipients: List of {email, variables: {name, company, etc.}}
            subject: Subject with variables like %recipient.name%
            body: Body with variables
        """
        to_list = [r["email"] for r in recipients]
        recipient_vars = {r["email"]: r.get("variables", {}) for r in recipients}

        data = {
            "from": f"{from_name or self.from_name} <{from_email or self.from_email}>",
            "to": ",".join(to_list),
            "subject": subject,
            "text": body,
            "recipient-variables": json.dumps(recipient_vars)
        }

        if html:
            data["html"] = html

        async with httpx.AsyncClient() as client:
            response = await client.post(
                f"{self.base_url}/messages",
                auth=("api", self.api_key),
                data=data
            )

            return {
                "success": response.status_code == 200,
                "data": response.json() if response.status_code == 200 else response.text
            }

    async def send_template(
        self,
        to: str,
        template_name: str,
        template_vars: Dict[str, Any],
        subject: str = None
    ) -> Dict[str, Any]:
        """Send email using stored Mailgun template"""
        data = {
            "from": f"{self.from_name} <{self.from_email}>",
            "to": to,
            "template": template_name,
            "h:X-Mailgun-Variables": json.dumps(template_vars)
        }

        if subject:
            data["subject"] = subject

        async with httpx.AsyncClient() as client:
            response = await client.post(
                f"{self.base_url}/messages",
                auth=("api", self.api_key),
                data=data
            )

            return {
                "success": response.status_code == 200,
                "data": response.json() if response.status_code == 200 else response.text
            }

    async def get_events(
        self,
        message_id: str = None,
        event_type: str = None,
        limit: int = 100
    ) -> List[Dict[str, Any]]:
        """Get email events (delivered, opened, clicked, etc.)"""
        params = {"limit": limit}

        if message_id:
            params["message-id"] = message_id

        if event_type:
            params["event"] = event_type

        async with httpx.AsyncClient() as client:
            response = await client.get(
                f"{self.base_url}/events",
                auth=("api", self.api_key),
                params=params
            )

            if response.status_code == 200:
                return response.json().get("items", [])
            return []

mailgun_provider = MailgunProvider()
```

### Notification Service API

```python
# /root/bheem-platform/services/bheem-notify/app/api/email.py

from fastapi import APIRouter, HTTPException, BackgroundTasks
from pydantic import BaseModel, EmailStr
from typing import Optional, List, Dict, Any
from uuid import uuid4

from providers.mailgun import mailgun_provider

router = APIRouter(prefix="/email", tags=["Email"])

class EmailRequest(BaseModel):
    to: EmailStr
    subject: str
    body: str
    html: Optional[str] = None
    from_email: Optional[str] = None
    from_name: Optional[str] = None
    cc: Optional[List[EmailStr]] = None
    bcc: Optional[List[EmailStr]] = None
    reply_to: Optional[str] = None
    tags: Optional[List[str]] = None

class BatchEmailRequest(BaseModel):
    recipients: List[Dict[str, Any]]  # [{email, variables: {name, etc.}}]
    subject: str
    body: str
    html: Optional[str] = None

class TemplateEmailRequest(BaseModel):
    to: EmailStr
    template_name: str
    template_vars: Dict[str, Any]
    subject: Optional[str] = None

@router.post("/send")
async def send_email(request: EmailRequest):
    """
    Send a single email

    Example:
    ```json
    {
        "to": "user@example.com",
        "subject": "Welcome to Bheem",
        "body": "Hello, welcome to our platform!",
        "html": "<h1>Welcome!</h1><p>Hello, welcome to our platform!</p>"
    }
    ```
    """
    result = await mailgun_provider.send_email(
        to=request.to,
        subject=request.subject,
        body=request.body,
        html=request.html,
        from_email=request.from_email,
        from_name=request.from_name,
        cc=request.cc,
        bcc=request.bcc,
        reply_to=request.reply_to,
        tags=request.tags
    )

    if not result["success"]:
        raise HTTPException(500, detail=result.get("error"))

    return result

@router.post("/batch")
async def send_batch_email(
    request: BatchEmailRequest,
    background_tasks: BackgroundTasks
):
    """
    Send batch emails with personalization

    Example:
    ```json
    {
        "recipients": [
            {"email": "user1@example.com", "variables": {"name": "John"}},
            {"email": "user2@example.com", "variables": {"name": "Jane"}}
        ],
        "subject": "Hello %recipient.name%",
        "body": "Hi %recipient.name%, thanks for joining!"
    }
    ```
    """
    # Queue for background processing
    job_id = str(uuid4())

    background_tasks.add_task(
        process_batch_email,
        job_id,
        request.recipients,
        request.subject,
        request.body,
        request.html
    )

    return {"job_id": job_id, "status": "queued", "recipient_count": len(request.recipients)}

@router.post("/template")
async def send_template_email(request: TemplateEmailRequest):
    """
    Send email using Mailgun template

    Example:
    ```json
    {
        "to": "user@example.com",
        "template_name": "welcome",
        "template_vars": {"name": "John", "company": "Acme Inc"}
    }
    ```
    """
    result = await mailgun_provider.send_template(
        to=request.to,
        template_name=request.template_name,
        template_vars=request.template_vars,
        subject=request.subject
    )

    if not result["success"]:
        raise HTTPException(500, detail=result.get("data"))

    return result

@router.get("/status/{message_id}")
async def get_email_status(message_id: str):
    """Get email delivery status"""
    events = await mailgun_provider.get_events(message_id=message_id)

    if not events:
        return {"status": "unknown", "events": []}

    # Get latest event
    latest = events[0]

    return {
        "status": latest.get("event"),
        "timestamp": latest.get("timestamp"),
        "events": events
    }

async def process_batch_email(
    job_id: str,
    recipients: List[Dict],
    subject: str,
    body: str,
    html: str = None
):
    """Background task to process batch emails"""
    result = await mailgun_provider.send_batch(
        recipients=recipients,
        subject=subject,
        body=body,
        html=html
    )
    # Store result in Redis/DB for status checking
    # redis.set(f"email_job:{job_id}", json.dumps(result))
```

---

## Integration with bheem-core

### Notification Client

```python
# /root/bheem-core/apps/backend/app/core/notify_client.py

import httpx
import os
from typing import Optional, List, Dict, Any

class NotifyClient:
    def __init__(self):
        self.base_url = os.getenv("NOTIFY_SERVICE_URL", "http://localhost:8040")
        self.api_key = os.getenv("NOTIFY_API_KEY")

    async def send_email(
        self,
        to: str,
        subject: str,
        body: str,
        html: str = None,
        **kwargs
    ) -> Dict[str, Any]:
        """Send email via Notify service"""
        async with httpx.AsyncClient() as client:
            response = await client.post(
                f"{self.base_url}/email/send",
                json={
                    "to": to,
                    "subject": subject,
                    "body": body,
                    "html": html,
                    **kwargs
                },
                headers={"X-API-Key": self.api_key}
            )

            return response.json()

    async def send_batch_email(
        self,
        recipients: List[Dict],
        subject: str,
        body: str,
        html: str = None
    ) -> Dict[str, Any]:
        """Send batch emails"""
        async with httpx.AsyncClient() as client:
            response = await client.post(
                f"{self.base_url}/email/batch",
                json={
                    "recipients": recipients,
                    "subject": subject,
                    "body": body,
                    "html": html
                },
                headers={"X-API-Key": self.api_key}
            )

            return response.json()

    async def send_template_email(
        self,
        to: str,
        template_name: str,
        template_vars: Dict[str, Any]
    ) -> Dict[str, Any]:
        """Send template email"""
        async with httpx.AsyncClient() as client:
            response = await client.post(
                f"{self.base_url}/email/template",
                json={
                    "to": to,
                    "template_name": template_name,
                    "template_vars": template_vars
                },
                headers={"X-API-Key": self.api_key}
            )

            return response.json()

notify_client = NotifyClient()
```

### Usage in bheem-core Modules

```python
# Example: Password Reset Email
# /root/bheem-core/apps/backend/app/modules/auth/core/services/password_service.py

from core.notify_client import notify_client

async def send_password_reset_email(
    email: str,
    reset_token: str,
    user_name: str
):
    """Send password reset email"""
    reset_url = f"https://erp.bheem.cloud/reset-password?token={reset_token}"

    await notify_client.send_email(
        to=email,
        subject="Password Reset Request - Bheem ERP",
        body=f"""
Hi {user_name},

You requested a password reset. Click the link below to reset your password:

{reset_url}

This link expires in 1 hour.

If you didn't request this, please ignore this email.

Best regards,
Bheem Platform
        """,
        html=f"""
<h2>Password Reset Request</h2>
<p>Hi {user_name},</p>
<p>You requested a password reset. Click the button below to reset your password:</p>
<p><a href="{reset_url}" style="background: #4CAF50; color: white; padding: 12px 24px; text-decoration: none; border-radius: 4px;">Reset Password</a></p>
<p>This link expires in 1 hour.</p>
<p>If you didn't request this, please ignore this email.</p>
        """,
        tags=["password-reset", "auth"]
    )
```

```python
# Example: Invoice Email
# /root/bheem-core/apps/backend/app/modules/accounting/core/services/invoice_service.py

from core.notify_client import notify_client

async def send_invoice_email(
    customer_email: str,
    customer_name: str,
    invoice_number: str,
    invoice_amount: float,
    due_date: str,
    pdf_content: bytes
):
    """Send invoice to customer"""
    await notify_client.send_email(
        to=customer_email,
        subject=f"Invoice {invoice_number} from Bheem",
        body=f"""
Dear {customer_name},

Please find attached invoice {invoice_number} for ${invoice_amount:.2f}.

Due Date: {due_date}

Thank you for your business.

Best regards,
Bheem Platform
        """,
        html=f"""
<h2>Invoice {invoice_number}</h2>
<p>Dear {customer_name},</p>
<p>Please find attached your invoice:</p>
<table>
    <tr><td>Invoice Number:</td><td><strong>{invoice_number}</strong></td></tr>
    <tr><td>Amount:</td><td><strong>${invoice_amount:.2f}</strong></td></tr>
    <tr><td>Due Date:</td><td><strong>{due_date}</strong></td></tr>
</table>
<p>Thank you for your business.</p>
        """,
        attachments=[{
            "filename": f"Invoice_{invoice_number}.pdf",
            "content": pdf_content,
            "content_type": "application/pdf"
        }],
        tags=["invoice", "accounting"]
    )
```

---

## Mailcow Integration (Mailboxes)

### Creating Mailboxes for Users

```python
# /root/bheem-workspace/backend/services/mailcow_service.py

import httpx
import os
from typing import Optional, Dict, Any

class MailcowService:
    def __init__(self):
        self.api_url = os.getenv("MAILCOW_API_URL")
        self.api_key = os.getenv("MAILCOW_API_KEY")

    def _headers(self):
        return {
            "X-API-Key": self.api_key,
            "Content-Type": "application/json"
        }

    async def create_mailbox(
        self,
        email: str,
        password: str,
        name: str,
        quota_mb: int = 1024
    ) -> Dict[str, Any]:
        """Create a new mailbox"""
        local_part, domain = email.split("@")

        async with httpx.AsyncClient() as client:
            response = await client.post(
                f"{self.api_url}/add/mailbox",
                headers=self._headers(),
                json={
                    "local_part": local_part,
                    "domain": domain,
                    "password": password,
                    "password2": password,
                    "name": name,
                    "quota": quota_mb,
                    "active": 1
                }
            )

            return response.json()

    async def create_alias(
        self,
        alias_email: str,
        target_email: str
    ) -> Dict[str, Any]:
        """Create email alias"""
        async with httpx.AsyncClient() as client:
            response = await client.post(
                f"{self.api_url}/add/alias",
                headers=self._headers(),
                json={
                    "address": alias_email,
                    "goto": target_email,
                    "active": 1
                }
            )

            return response.json()

    async def update_quota(
        self,
        email: str,
        quota_mb: int
    ) -> Dict[str, Any]:
        """Update mailbox quota"""
        async with httpx.AsyncClient() as client:
            response = await client.post(
                f"{self.api_url}/edit/mailbox",
                headers=self._headers(),
                json={
                    "items": [email],
                    "attr": {"quota": quota_mb}
                }
            )

            return response.json()

    async def get_mailbox_info(self, email: str) -> Optional[Dict[str, Any]]:
        """Get mailbox information"""
        async with httpx.AsyncClient() as client:
            response = await client.get(
                f"{self.api_url}/get/mailbox/{email}",
                headers=self._headers()
            )

            if response.status_code == 200:
                return response.json()
            return None

    async def delete_mailbox(self, email: str) -> bool:
        """Delete a mailbox"""
        async with httpx.AsyncClient() as client:
            response = await client.post(
                f"{self.api_url}/delete/mailbox",
                headers=self._headers(),
                json={"items": [email]}
            )

            return response.status_code == 200

mailcow_service = MailcowService()
```

---

## Email Templates

### Template Structure

```
/root/bheem-platform/services/bheem-notify/templates/
├── welcome.html
├── password_reset.html
├── invoice.html
├── order_confirmation.html
├── notification.html
└── base.html
```

### Base Template

```html
<!-- /templates/base.html -->
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: #4CAF50; color: white; padding: 20px; text-align: center; }
        .content { padding: 20px; background: #f9f9f9; }
        .footer { padding: 20px; text-align: center; font-size: 12px; color: #666; }
        .button { display: inline-block; background: #4CAF50; color: white; padding: 12px 24px; text-decoration: none; border-radius: 4px; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>Bheem Platform</h1>
        </div>
        <div class="content">
            {% block content %}{% endblock %}
        </div>
        <div class="footer">
            <p>&copy; {{ year }} Bheem Platform. All rights reserved.</p>
            <p><a href="https://bheem.cloud">bheem.cloud</a></p>
        </div>
    </div>
</body>
</html>
```

### Welcome Template

```html
<!-- /templates/welcome.html -->
{% extends "base.html" %}

{% block content %}
<h2>Welcome to Bheem, {{ name }}!</h2>

<p>Thank you for joining Bheem Platform. Your account has been created successfully.</p>

<p><strong>Your login details:</strong></p>
<ul>
    <li>Email: {{ email }}</li>
    <li>Company: {{ company_name }}</li>
</ul>

<p>
    <a href="{{ login_url }}" class="button">Login to Your Account</a>
</p>

<p>If you have any questions, feel free to contact our support team.</p>
{% endblock %}
```

---

## Environment Variables

```bash
# Bheem Notify Service
NOTIFICATION_PROVIDER=mailgun

# Mailgun
MAILGUN_API_KEY=your-api-key
MAILGUN_DOMAIN=bheem.co.uk
MAILGUN_FROM_NAME=Bheem Platform
MAILGUN_FROM_EMAIL=noreply@bheem.co.uk

# Mailcow
MAILCOW_API_URL=https://mail.bheem.cloud/api/v1
MAILCOW_API_KEY=your-api-key

# MSG91 (SMS)
MSG91_AUTH_KEY=your-auth-key

# bheem-core
NOTIFY_SERVICE_URL=http://localhost:8040
NOTIFY_API_KEY=your-api-key
```

---

## Webhooks (Email Events)

```python
# /root/bheem-platform/services/bheem-notify/app/api/webhooks.py

from fastapi import APIRouter, Request, BackgroundTasks
from datetime import datetime

router = APIRouter(prefix="/webhooks", tags=["Webhooks"])

@router.post("/mailgun")
async def mailgun_webhook(
    request: Request,
    background_tasks: BackgroundTasks
):
    """
    Handle Mailgun webhook events

    Events: delivered, opened, clicked, bounced, complained, unsubscribed
    """
    data = await request.json()
    event_data = data.get("event-data", {})

    event_type = event_data.get("event")
    message_id = event_data.get("message", {}).get("headers", {}).get("message-id")
    recipient = event_data.get("recipient")

    # Log event
    await log_email_event(
        message_id=message_id,
        event_type=event_type,
        recipient=recipient,
        timestamp=datetime.utcnow(),
        raw_data=event_data
    )

    # Handle specific events
    if event_type == "bounced":
        background_tasks.add_task(handle_bounce, recipient, event_data)

    elif event_type == "complained":
        background_tasks.add_task(handle_complaint, recipient, event_data)

    return {"status": "ok"}

async def handle_bounce(email: str, event_data: dict):
    """Handle bounced email - mark as invalid"""
    # Update user record, remove from mailing lists, etc.
    pass

async def handle_complaint(email: str, event_data: dict):
    """Handle spam complaint - unsubscribe user"""
    # Unsubscribe from all lists
    pass
```

---

*Document Version: 1.0*
*Last Updated: December 26, 2025*
