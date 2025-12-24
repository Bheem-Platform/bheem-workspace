#!/usr/bin/env python3
"""
Test script for Bheem Notify Client
Tests the centralized notification service integration
"""
import asyncio
from services.notify_client import notify_client


async def test_health():
    """Test Notify service health"""
    print("\n" + "="*50)
    print("Testing Notify Service Health")
    print("="*50)

    result = await notify_client.health_check()
    print(f"Health: {result}")
    return result


async def test_provider_status():
    """Test BheemTele provider status"""
    print("\n" + "="*50)
    print("Testing BheemTele Provider Status")
    print("="*50)

    result = await notify_client.get_provider_status()
    print(f"Provider Status: {result}")
    return result


async def test_send_otp():
    """Test OTP sending"""
    print("\n" + "="*50)
    print("Testing OTP Send")
    print("="*50)

    phone = "919876543210"  # Test phone number
    result = await notify_client.send_otp(phone=phone)
    print(f"OTP Result: {result}")
    return result


async def test_send_email():
    """Test email sending"""
    print("\n" + "="*50)
    print("Testing Email Send")
    print("="*50)

    result = await notify_client.send_email(
        to="test@bheem.cloud",
        subject="Test from NotifyClient",
        body="<h1>Hello from Bheem Workspace!</h1><p>This email was sent via the centralized Notify service.</p>"
    )
    print(f"Email Result: {result}")
    return result


async def test_backward_compatibility():
    """Test backward compatibility with msg91_service interface"""
    print("\n" + "="*50)
    print("Testing Backward Compatibility")
    print("="*50)

    from services.notify_client import msg91_service

    # Test properties
    print(f"sender_email: {msg91_service.sender_email}")
    print(f"sender_name: {msg91_service.sender_name}")
    print(f"sms_sender_id: {msg91_service.sms_sender_id}")

    # Test domain DNS records
    dns_records = msg91_service.get_domain_dns_records("example.com")
    print(f"DNS Records: {dns_records['domain']} - {len(dns_records['records'])} records")

    return True


async def main():
    print("\n" + "="*60)
    print("     Bheem Notify Client Test Suite")
    print("="*60)

    results = {}

    # Test backward compatibility (sync methods)
    try:
        results['backward_compat'] = await test_backward_compatibility()
    except Exception as e:
        print(f"Backward compatibility test failed: {e}")
        results['backward_compat'] = False

    # Test health check
    try:
        results['health'] = await test_health()
    except Exception as e:
        print(f"Health check failed: {e}")
        results['health'] = {"success": False, "error": str(e)}

    # Test provider status
    try:
        results['provider'] = await test_provider_status()
    except Exception as e:
        print(f"Provider status failed: {e}")
        results['provider'] = {"success": False, "error": str(e)}

    # Close client
    await notify_client.close()

    print("\n" + "="*60)
    print("     Test Summary")
    print("="*60)
    for test, result in results.items():
        status = "PASS" if result else "FAIL"
        print(f"  {test}: {status}")


if __name__ == "__main__":
    asyncio.run(main())
