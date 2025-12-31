"""
Bheem Workspace - External Workspace Service
Handles external commercial customers with subscription billing via BheemPay
All external customer revenue is tracked under BHM001 (Bheemverse Innovation)
"""
from typing import Optional, Dict, Any, List
from uuid import UUID
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import text

from core.config import settings
from services.bheempay_client import bheempay_client
from services.erp_client import erp_client


class ExternalWorkspaceService:
    """Service for external commercial tenants with billing"""

    def __init__(self, db: AsyncSession):
        self.db = db
        self.bheempay = bheempay_client
        self.erp = erp_client

    # ═══════════════════════════════════════════════════════════════════
    # SUBSCRIPTION PLANS
    # ═══════════════════════════════════════════════════════════════════

    async def get_available_plans(self) -> list:
        """
        Get available workspace subscription plans from ERP.

        Returns:
            List of plans with pricing and features
        """
        plans = await self.erp.get_workspace_plans("WORKSPACE-")
        return plans

    async def get_plan_details(self, plan_id: str) -> dict:
        """
        Get detailed plan information including tiers.

        Args:
            plan_id: SKU ID (e.g., WORKSPACE-PROFESSIONAL)

        Returns:
            Plan details with tiers and features
        """
        return await self.erp.get_plan_details(plan_id)

    # ═══════════════════════════════════════════════════════════════════
    # CHECKOUT & BILLING
    # ═══════════════════════════════════════════════════════════════════

    async def create_checkout_session(
        self,
        tenant_id: UUID,
        plan_id: str,
        billing_cycle: str = "monthly"
    ) -> dict:
        """
        Create subscription checkout session for external tenant.

        Flow:
        1. Get tenant details
        2. Create/get CRM contact for invoicing
        3. Create checkout via BheemPay
        4. Update tenant with pending subscription reference

        Args:
            tenant_id: Workspace tenant ID
            plan_id: SKU ID (e.g., WORKSPACE-PROFESSIONAL)
            billing_cycle: 'monthly' or 'annual'

        Returns:
            Checkout session details for frontend
        """
        # Get tenant
        tenant = await self._get_tenant(tenant_id)
        if not tenant:
            raise ValueError(f"Tenant {tenant_id} not found")

        if tenant.tenant_mode == "internal":
            raise ValueError("Internal tenants cannot purchase subscriptions")

        # Try to create CRM contact for billing (optional for self-service)
        if not tenant.erp_customer_id:
            try:
                crm_contact = await self.erp.create_crm_contact(
                    name=tenant.name,
                    email=tenant.billing_email or tenant.owner_email,
                    company=tenant.name
                )
                await self._update_tenant_erp_customer(tenant_id, crm_contact["id"])
            except Exception as e:
                # CRM creation is optional for self-service customers
                # They can still checkout - CRM contact can be created later
                import logging
                logging.warning(f"CRM contact creation skipped for tenant {tenant_id}: {e}")

        # Get auth user ID for the tenant owner
        user_id = await self._get_owner_user_id(tenant_id)

        # Get billing email
        billing_email = tenant.billing_email or tenant.owner_email

        # Look up plan UUID from SKU code
        plan_uuid = plan_id  # Default to input if already a UUID
        if not self._is_uuid(plan_id):
            # Look up the plan by SKU code to get the UUID
            plan_info = await self.erp.get_plan_by_sku_code(plan_id)
            if plan_info:
                plan_uuid = plan_info.get("plan_id", plan_id)
            else:
                raise ValueError(f"Plan {plan_id} not found in catalog")

        # Create checkout via BheemPay
        checkout = await self.bheempay.create_subscription_checkout(
            user_id=str(user_id),
            plan_id=plan_uuid,
            customer_email=billing_email,
            company_code=settings.BHEEMVERSE_PARENT_COMPANY_CODE,  # Revenue to BHM001
            metadata={
                "tenant_id": str(tenant_id),
                "billing_cycle": billing_cycle,
                "source": "workspace"
            }
        )

        return {
            "checkout_id": checkout.get("checkout_id"),
            "order_id": checkout.get("order_id"),
            "amount": checkout.get("amount"),
            "currency": checkout.get("currency", "INR"),
            "plan_name": checkout.get("plan_name"),
            "key_id": checkout.get("key_id"),  # Razorpay public key for frontend
            "gateway_response": checkout.get("gateway_response")
        }

    async def get_checkout_status(self, order_id: str) -> dict:
        """
        Get checkout status for polling.

        Args:
            order_id: Razorpay order ID

        Returns:
            Checkout status
        """
        return await self.bheempay.get_checkout_status(order_id)

    # ═══════════════════════════════════════════════════════════════════
    # WEBHOOK HANDLING
    # ═══════════════════════════════════════════════════════════════════

    async def handle_payment_webhook(self, event_type: str, payload: dict) -> dict:
        """
        Handle BheemPay webhook events.

        Note: Most processing is done by BheemPay service itself.
        This is for workspace-specific actions like:
        - Updating tenant subscription status
        - Applying plan quotas
        - Enabling/disabling features

        Args:
            event_type: Webhook event type
            payload: Event payload

        Returns:
            Processing result
        """
        metadata = payload.get("metadata", {})
        tenant_id = metadata.get("tenant_id")

        if not tenant_id:
            return {"status": "ignored", "reason": "no_tenant_id"}

        if event_type == "payment.captured":
            # Payment successful - activate tenant subscription
            subscription_id = payload.get("subscription_id")
            plan_id = payload.get("plan_id")

            await self._activate_tenant_subscription(
                tenant_id=tenant_id,
                subscription_id=subscription_id,
                plan_id=plan_id
            )

            return {"status": "success", "action": "subscription_activated"}

        elif event_type == "subscription.charged":
            # Recurring payment successful
            subscription_id = payload.get("subscription_id")

            await self._renew_tenant_subscription(
                tenant_id=tenant_id,
                subscription_id=subscription_id
            )

            return {"status": "success", "action": "subscription_renewed"}

        elif event_type == "subscription.cancelled":
            await self._deactivate_tenant_subscription(tenant_id)
            return {"status": "success", "action": "subscription_cancelled"}

        elif event_type == "subscription.halted":
            await self._suspend_tenant(tenant_id, "Payment failed")
            return {"status": "success", "action": "tenant_suspended"}

        elif event_type == "payment.failed":
            # Mark subscription as past due
            await self._mark_payment_failed(tenant_id)
            return {"status": "success", "action": "payment_failed_recorded"}

        return {"status": "ignored", "reason": f"unhandled_event: {event_type}"}

    def verify_webhook_signature(self, payload: bytes, signature: str) -> bool:
        """
        Verify webhook signature.

        Args:
            payload: Raw request body
            signature: X-BheemPay-Signature header

        Returns:
            True if valid
        """
        return self.bheempay.verify_webhook(payload, signature)

    # ═══════════════════════════════════════════════════════════════════
    # SUBSCRIPTION MANAGEMENT
    # ═══════════════════════════════════════════════════════════════════

    async def get_subscription_status(self, tenant_id: UUID) -> dict:
        """
        Get current subscription status for tenant.

        Args:
            tenant_id: Tenant ID

        Returns:
            Subscription details
        """
        query = text("""
            SELECT
                t.erp_subscription_id,
                t.subscription_status,
                t.subscription_plan,
                t.subscription_period_end,
                t.plan,
                t.max_users,
                t.docs_quota_mb,
                t.meet_quota_hours
            FROM workspace.tenants t
            WHERE t.id = CAST(:tenant_id AS uuid)
        """)

        result = await self.db.execute(query, {"tenant_id": str(tenant_id)})
        row = result.fetchone()

        if not row:
            return {"status": "not_found"}

        return {
            "subscription_id": str(row.erp_subscription_id) if row.erp_subscription_id else None,
            "status": row.subscription_status or "inactive",
            "plan": row.subscription_plan or row.plan,
            "period_end": row.subscription_period_end.isoformat() if row.subscription_period_end else None,
            "limits": {
                "max_users": row.max_users,
                "docs_quota_mb": row.docs_quota_mb,
                "meet_quota_hours": row.meet_quota_hours
            }
        }

    async def cancel_subscription(
        self,
        tenant_id: UUID,
        reason: Optional[str] = None,
        immediate: bool = False
    ) -> dict:
        """
        Cancel tenant subscription.

        Args:
            tenant_id: Tenant ID
            reason: Cancellation reason
            immediate: If True, cancel immediately

        Returns:
            Cancellation confirmation
        """
        tenant = await self._get_tenant(tenant_id)
        if not tenant or not tenant.erp_subscription_id:
            raise ValueError("No active subscription found")

        # Cancel via BheemPay
        result = await self.bheempay.cancel_subscription(
            subscription_id=str(tenant.erp_subscription_id),
            reason=reason,
            immediate=immediate
        )

        if immediate:
            await self._deactivate_tenant_subscription(str(tenant_id))

        return {
            "status": "cancellation_scheduled" if not immediate else "cancelled",
            "effective_date": result.get("effective_date")
        }

    async def get_invoices(self, tenant_id: UUID, limit: int = 50) -> list:
        """
        Get invoices for a tenant.

        Args:
            tenant_id: Tenant ID
            limit: Maximum invoices to return

        Returns:
            List of invoices
        """
        tenant = await self._get_tenant(tenant_id)
        if not tenant or not tenant.erp_customer_id:
            return []

        return await self.bheempay.get_invoices(
            customer_id=str(tenant.erp_customer_id),
            limit=limit
        )

    async def get_billing_history(self, tenant_id: UUID) -> dict:
        """
        Get complete billing history.

        Args:
            tenant_id: Tenant ID

        Returns:
            Billing history with payments and invoices
        """
        tenant = await self._get_tenant(tenant_id)
        if not tenant:
            return {"invoices": [], "payments": []}

        invoices = []
        if tenant.erp_customer_id:
            invoices = await self.bheempay.get_invoices(
                customer_id=str(tenant.erp_customer_id)
            )

        return {
            "invoices": invoices,
            "subscription": {
                "id": str(tenant.erp_subscription_id) if tenant.erp_subscription_id else None,
                "status": tenant.subscription_status,
                "plan": tenant.subscription_plan,
                "period_end": tenant.subscription_period_end.isoformat() if tenant.subscription_period_end else None
            }
        }

    # ═══════════════════════════════════════════════════════════════════
    # PRIVATE METHODS
    # ═══════════════════════════════════════════════════════════════════

    def _is_uuid(self, value: str) -> bool:
        """Check if string is a valid UUID"""
        try:
            UUID(value)
            return True
        except (ValueError, TypeError):
            return False

    async def _get_tenant(self, tenant_id: UUID):
        """Get tenant by ID"""
        query = text("""
            SELECT * FROM workspace.tenants WHERE id = CAST(:tenant_id AS uuid)
        """)
        result = await self.db.execute(query, {"tenant_id": str(tenant_id)})
        return result.fetchone()

    async def _get_owner_user_id(self, tenant_id: UUID) -> UUID:
        """Get auth user ID for tenant owner"""
        query = text("""
            SELECT tu.user_id
            FROM workspace.tenant_users tu
            JOIN workspace.tenants t ON tu.tenant_id = t.id
            WHERE t.id = CAST(:tenant_id AS uuid)
              AND tu.role = 'admin'
            ORDER BY tu.created_at ASC
            LIMIT 1
        """)
        result = await self.db.execute(query, {"tenant_id": str(tenant_id)})
        row = result.fetchone()

        if not row:
            # Fallback: try to get from owner email
            owner_query = text("""
                SELECT tu.user_id
                FROM workspace.tenant_users tu
                JOIN workspace.tenants t ON tu.tenant_id = t.id
                WHERE t.id = CAST(:tenant_id AS uuid)
                  AND tu.email = t.owner_email
                LIMIT 1
            """)
            result = await self.db.execute(owner_query, {"tenant_id": str(tenant_id)})
            row = result.fetchone()

        if not row:
            raise ValueError("Tenant owner not found")

        return row.user_id

    async def _update_tenant_erp_customer(self, tenant_id: UUID, crm_id: str):
        """Update tenant with CRM customer ID"""
        query = text("""
            UPDATE workspace.tenants
            SET erp_customer_id = CAST(:crm_id AS uuid), updated_at = NOW()
            WHERE id = CAST(:tenant_id AS uuid)
        """)
        await self.db.execute(query, {"tenant_id": str(tenant_id), "crm_id": crm_id})
        await self.db.commit()

    async def _activate_tenant_subscription(
        self,
        tenant_id: str,
        subscription_id: str,
        plan_id: str
    ):
        """Activate subscription for tenant"""
        # Get plan limits from ERP
        plan = await self.erp.get_plan_details(plan_id)
        tiers = plan.get("tiers", [])
        tier = tiers[0] if tiers else {}

        # Extract limits
        max_users = tier.get("max_users", 5)
        storage_gb = tier.get("max_storage_gb", 5)
        features = tier.get("features_included", {})

        query = text("""
            UPDATE workspace.tenants SET
                erp_subscription_id = CAST(:subscription_id AS uuid),
                subscription_status = 'active',
                subscription_plan = :plan_name,
                max_users = COALESCE(:max_users, max_users),
                docs_quota_mb = COALESCE(:storage_mb, docs_quota_mb),
                is_suspended = false,
                suspended_reason = NULL,
                updated_at = NOW()
            WHERE id = CAST(:tenant_id AS uuid)
        """)

        await self.db.execute(query, {
            "tenant_id": tenant_id,
            "subscription_id": subscription_id,
            "plan_name": plan.get("name", plan_id),
            "max_users": max_users if max_users > 0 else None,
            "storage_mb": storage_gb * 1024 if storage_gb > 0 else None
        })
        await self.db.commit()

    async def _renew_tenant_subscription(self, tenant_id: str, subscription_id: str):
        """Renew subscription (update period end)"""
        query = text("""
            UPDATE workspace.tenants SET
                subscription_status = 'active',
                is_suspended = false,
                suspended_reason = NULL,
                updated_at = NOW()
            WHERE id = CAST(:tenant_id AS uuid)
        """)
        await self.db.execute(query, {"tenant_id": tenant_id})
        await self.db.commit()

    async def _deactivate_tenant_subscription(self, tenant_id: str):
        """Deactivate tenant subscription"""
        query = text("""
            UPDATE workspace.tenants SET
                subscription_status = 'cancelled',
                updated_at = NOW()
            WHERE id = CAST(:tenant_id AS uuid)
        """)
        await self.db.execute(query, {"tenant_id": tenant_id})
        await self.db.commit()

    async def _suspend_tenant(self, tenant_id: str, reason: str):
        """Suspend tenant due to payment failure"""
        query = text("""
            UPDATE workspace.tenants SET
                subscription_status = 'suspended',
                is_suspended = true,
                suspended_reason = :reason,
                updated_at = NOW()
            WHERE id = CAST(:tenant_id AS uuid)
        """)
        await self.db.execute(query, {"tenant_id": tenant_id, "reason": reason})
        await self.db.commit()

    async def _mark_payment_failed(self, tenant_id: str):
        """Mark subscription as payment failed"""
        query = text("""
            UPDATE workspace.tenants SET
                subscription_status = 'past_due',
                updated_at = NOW()
            WHERE id = CAST(:tenant_id AS uuid)
        """)
        await self.db.execute(query, {"tenant_id": tenant_id})
        await self.db.commit()
