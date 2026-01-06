#!/usr/bin/env python3
"""
Test script for sending email
Run: python test_send_email.py <password>
"""
import sys
import os
sys.path.insert(0, os.path.dirname(__file__))

from services.mailcow_service import MailcowService

def test_send_email(password: str):
    service = MailcowService()

    from_email = "jishnu.developer@bheem.co.uk"
    to_email = ["jishnuaswin025@gmail.com"]
    subject = "Test Email from Bheem Mail"
    body = """
    <h1>Test Email</h1>
    <p>This is a test email sent from Bheem Workspace Mail.</p>
    <p>If you received this, the mail sending is working!</p>
    <br>
    <p>Best regards,<br>Bheem Workspace</p>
    """

    print(f"Sending email from {from_email} to {to_email}...")
    print(f"SMTP Host: {service.smtp_host}:{service.smtp_port}")

    result = service.send_email(
        from_email=from_email,
        password=password,
        to=to_email,
        subject=subject,
        body=body,
        is_html=True
    )

    if result:
        print("✅ Email sent successfully!")
    else:
        print("❌ Failed to send email")

    return result

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: python test_send_email.py <password>")
        sys.exit(1)

    password = sys.argv[1]
    test_send_email(password)
