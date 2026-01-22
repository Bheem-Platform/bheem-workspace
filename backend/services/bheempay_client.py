"""
Bheem Workspace - BheemPay Payment Gateway Client
Handles subscription checkout and payment processing via BheemPay service
"""
import hmac
import hashlib
import logging
from typing import Optional, Dict, Any
import httpx

from core.config import settings

logger = logging.getLogger(__name__)


class BheemPayClient:
    """Client for BheemPay payment gateway service"""

    def __init__(self):
        self.base_url = settings.BHEEMPAY_URL
        self.api_key = settings.BHEEMPAY_API_KEY
        self.webhook_secret = settings.BHEEMPAY_WEBHOOK_SECRET

    async def _request(self, method: str, endpoint: str, **kwargs) -> dict:
        """Make authenticated request to BheemPay"""
        headers = {
            "X-API-Key": self.api_key or "",
            "Content-Type": "application/json"
        }

        url = f"{self.base_url}/api/v1{endpoint}"
        logger.info(f"[BheemPay] {method} {url}")

        try:
            async with httpx.AsyncClient(timeout=30.0) as client:
                response = await client.request(
                    method=method,
                    url=url,
                    headers=headers,
                    **kwargs
                )
                logger.info(f"[BheemPay] Response: {response.status_code}")
                if response.status_code >= 400:
                    logger.error(f"[BheemPay] Error {response.status_code}: {response.text}")
                response.raise_for_status()
                return response.json()
        except httpx.ConnectError as e:
            logger.error(f"[BheemPay] Connection failed to {url}: {e}")
            raise
        except Exception as e:
            logger.error(f"[BheemPay] Request failed: {type(e).__name__}: {e}")
            raise

    async def create_subscription_checkout(
        self,
        user_id: str,
        plan_id: str,
        customer_email: str,
        customer_phone: Optional[str] = None,
        company_code: str = "BHM001",
        success_url: Optional[str] = None,
        cancel_url: Optional[str] = None,
        metadata: Optional[Dict[str, Any]] = None
    ) -> dict:
        """
        Create subscription checkout session via BheemPay.

        BheemPay will:
        1. Fetch plan details from public.sku_subscriptions
        2. Create Razorpay order
        3. Create pending subscription in public.subscriptions
        4. Return checkout details for frontend

        Args:
            user_id: Auth user ID
            plan_id: SKU ID (e.g., WORKSPACE-STARTER)
            customer_email: Customer email for receipt
            customer_phone: Customer phone (optional)
            company_code: Company code for revenue tracking (default: BHM001)
            success_url: Redirect URL on success
            cancel_url: Redirect URL on cancel
            metadata: Additional metadata (e.g., tenant_id)

        Returns:
            Checkout session details with order_id, key_id, amount
        """
        return await self._request(
            "POST",
            "/pay/checkout/subscription",
            json={
                "user_id": user_id,
                "plan_id": plan_id,
                "customer_email": customer_email,
                "customer_phone": customer_phone,
                "company_code": company_code,
                "currency": "INR",  # Force INR for Indian payments
                "success_url": success_url or f"{settings.WORKSPACE_URL}/billing/success",
                "cancel_url": cancel_url or f"{settings.WORKSPACE_URL}/billing/cancel",
                "metadata": {
                    "source": "workspace",
                    **(metadata or {})
                }
            }
        )

    async def get_checkout_status(self, order_id: str) -> dict:
        """
        Get checkout/payment status.

        Args:
            order_id: Razorpay order ID

        Returns:
            Status information including payment state
        """
        return await self._request("GET", f"/pay/checkout/{order_id}")

    async def get_subscription(self, subscription_id: str) -> dict:
        """
        Get subscription details.

        Args:
            subscription_id: Subscription ID from ERP

        Returns:
            Subscription details
        """
        return await self._request("GET", f"/pay/subscriptions/{subscription_id}")

    async def cancel_subscription(
        self,
        subscription_id: str,
        reason: Optional[str] = None,
        immediate: bool = False
    ) -> dict:
        """
        Cancel a subscription.

        Args:
            subscription_id: Subscription ID
            reason: Cancellation reason
            immediate: If True, cancel immediately; else cancel at period end

        Returns:
            Cancellation confirmation
        """
        return await self._request(
            "POST",
            f"/pay/subscriptions/{subscription_id}/cancel",
            json={
                "reason": reason,
                "immediate": immediate
            }
        )

    async def create_payment(
        self,
        amount: int,
        currency: str = "INR",
        customer_email: str = None,
        description: str = None,
        metadata: Dict[str, Any] = None
    ) -> dict:
        """
        Create a one-time payment order.

        Args:
            amount: Amount in smallest currency unit (paise for INR)
            currency: Currency code
            customer_email: Customer email
            description: Payment description
            metadata: Additional metadata

        Returns:
            Payment order details
        """
        return await self._request(
            "POST",
            "/pay/create",
            json={
                "amount": amount,
                "currency": currency,
                "customer_email": customer_email,
                "description": description,
                "metadata": metadata or {}
            }
        )

    async def verify_payment(
        self,
        order_id: str,
        payment_id: str,
        signature: str
    ) -> dict:
        """
        Verify payment signature from Razorpay.

        Args:
            order_id: Razorpay order ID
            payment_id: Razorpay payment ID
            signature: Razorpay signature

        Returns:
            Verification result
        """
        return await self._request(
            "POST",
            "/pay/verify",
            json={
                "order_id": order_id,
                "payment_id": payment_id,
                "signature": signature
            }
        )

    def verify_webhook(self, payload: bytes, signature: str) -> bool:
        """
        Verify webhook signature from BheemPay.

        Args:
            payload: Raw request body bytes
            signature: X-BheemPay-Signature header value

        Returns:
            True if signature is valid
        """
        if not self.webhook_secret or not signature:
            return False

        expected = hmac.new(
            self.webhook_secret.encode(),
            payload,
            hashlib.sha256
        ).hexdigest()

        return hmac.compare_digest(signature, expected)

    async def get_invoices(
        self,
        customer_id: Optional[str] = None,
        subscription_id: Optional[str] = None,
        limit: int = 50
    ) -> list:
        """
        Get invoices for a customer or subscription.

        Args:
            customer_id: CRM customer ID
            subscription_id: Subscription ID
            limit: Maximum number of invoices

        Returns:
            List of invoices
        """
        params = {"limit": limit}
        if customer_id:
            params["customer_id"] = customer_id
        if subscription_id:
            params["subscription_id"] = subscription_id

        result = await self._request("GET", "/pay/invoices", params=params)
        return result.get("invoices", [])

    async def get_payment_methods(self, customer_id: str) -> list:
        """
        Get saved payment methods for a customer.

        Args:
            customer_id: CRM customer ID

        Returns:
            List of payment methods
        """
        result = await self._request(
            "GET",
            f"/pay/customers/{customer_id}/payment-methods"
        )
        return result.get("payment_methods", [])


# Singleton instance
bheempay_client = BheemPayClient()
