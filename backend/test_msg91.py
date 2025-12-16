#!/usr/bin/env python3
"""
Test script for MSG91 Email and SMS
"""
import asyncio
import httpx

# MSG91 Configuration
AUTH_KEY = "475330A7UGUSvo693b0497P1"
SENDER_EMAIL = "noreply@bheem.cloud"
SENDER_NAME = "Bheem Workspace"

# Test recipients
TEST_EMAIL = "sundeep@bheem.co.uk"
TEST_MOBILE = None  # Skip SMS test


async def test_send_email():
    """Test sending email via MSG91"""
    print("\n" + "="*50)
    print("Testing MSG91 Email API")
    print("="*50)

    url = "https://api.msg91.com/api/v5/email/send"

    payload = {
        "recipients": [
            {
                "to": [{"email": TEST_EMAIL}]
            }
        ],
        "from": {
            "email": SENDER_EMAIL,
            "name": SENDER_NAME
        },
        "subject": "Test Email from Bheem Workspace",
        "content_type": "text/html",
        "body": """
        <!DOCTYPE html>
        <html>
        <head>
            <style>
                body { font-family: 'Segoe UI', Tahoma, sans-serif; background: #f5f7fa; padding: 20px; }
                .container { max-width: 500px; margin: 0 auto; background: white; border-radius: 12px; padding: 40px; box-shadow: 0 4px 20px rgba(0,0,0,0.1); }
                .logo { text-align: center; margin-bottom: 30px; }
                .logo-icon { width: 60px; height: 60px; background: linear-gradient(135deg, #2563eb, #7c3aed); border-radius: 12px; margin: 0 auto 10px; }
                h1 { color: #1e293b; text-align: center; }
                p { color: #64748b; line-height: 1.6; }
                .success { background: #dcfce7; color: #16a34a; padding: 15px; border-radius: 8px; text-align: center; margin: 20px 0; }
            </style>
        </head>
        <body>
            <div class="container">
                <div class="logo">
                    <div class="logo-icon"></div>
                </div>
                <h1>MSG91 Integration Test</h1>
                <div class="success">✓ Email sent successfully!</div>
                <p>This is a test email from Bheem Workspace using MSG91 Email API.</p>
                <p>If you received this email, the MSG91 integration is working correctly.</p>
                <p style="color: #94a3b8; font-size: 12px; margin-top: 30px; text-align: center;">
                    Sent via MSG91 API | Bheem Workspace
                </p>
            </div>
        </body>
        </html>
        """
    }

    headers = {
        "authkey": AUTH_KEY,
        "Content-Type": "application/json"
    }

    try:
        async with httpx.AsyncClient() as client:
            print(f"\nSending email to: {TEST_EMAIL}")
            response = await client.post(url, json=payload, headers=headers, timeout=30.0)

            print(f"Status Code: {response.status_code}")
            print(f"Response: {response.text}")

            if response.status_code == 200:
                print("\n✅ Email sent successfully!")
            else:
                print("\n❌ Email sending failed!")

            return response.json()
    except Exception as e:
        print(f"\n❌ Error: {e}")
        return {"error": str(e)}


async def test_send_sms():
    """Test sending SMS via MSG91"""
    print("\n" + "="*50)
    print("Testing MSG91 SMS API")
    print("="*50)

    # Using the SendOTP API for testing (doesn't require DLT template)
    url = "https://control.msg91.com/api/v5/otp"

    params = {
        "authkey": AUTH_KEY,
        "mobile": TEST_MOBILE,
        "otp": "123456"  # Test OTP
    }

    try:
        async with httpx.AsyncClient() as client:
            print(f"\nSending OTP SMS to: {TEST_MOBILE}")
            response = await client.get(url, params=params, timeout=30.0)

            print(f"Status Code: {response.status_code}")
            print(f"Response: {response.text}")

            result = response.json()
            if result.get("type") == "success":
                print("\n✅ OTP SMS sent successfully!")
            else:
                print(f"\n❌ SMS sending failed: {result.get('message', 'Unknown error')}")

            return result
    except Exception as e:
        print(f"\n❌ Error: {e}")
        return {"error": str(e)}


async def check_balance():
    """Check MSG91 account balance"""
    print("\n" + "="*50)
    print("Checking MSG91 Account Balance")
    print("="*50)

    url = "https://control.msg91.com/api/balance.php"
    params = {
        "authkey": AUTH_KEY,
        "type": "1"  # SMS balance
    }

    try:
        async with httpx.AsyncClient() as client:
            response = await client.get(url, params=params, timeout=30.0)
            print(f"SMS Balance Response: {response.text}")

            # Check email balance
            params["type"] = "106"  # Email balance
            response = await client.get(url, params=params, timeout=30.0)
            print(f"Email Balance Response: {response.text}")

            return response.text
    except Exception as e:
        print(f"\n❌ Error: {e}")
        return {"error": str(e)}


async def main():
    print("\n" + "="*60)
    print("     MSG91 Integration Test - Bheem Workspace")
    print("="*60)

    # Check balance first
    await check_balance()

    # Test email
    email_result = await test_send_email()

    # Test SMS
    sms_result = await test_send_sms()

    print("\n" + "="*60)
    print("     Test Summary")
    print("="*60)
    print(f"\nEmail Result: {email_result}")
    print(f"SMS Result: {sms_result}")


if __name__ == "__main__":
    asyncio.run(main())
