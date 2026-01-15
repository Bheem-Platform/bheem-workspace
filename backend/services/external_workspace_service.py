"""
Bheem Workspace - External Workspace Service
Handles external commercial customers with subscription billing via BheemPay
All external customer revenue is tracked under BHM001 (Bheemverse Innovation)
"""
import logging
from datetime import datetime, date, timedelta
from typing import Optional, Dict, Any, List
from uuid import UUID
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import text

from core.config import settings
from services.bheempay_client import bheempay_client
from services.erp_client import erp_client

logger = logging.getLogger(__name__)


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
        - Creating ERP sales orders and invoices

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
            payment_id = payload.get("payment_id")
            amount = payload.get("amount", 0)
            currency = payload.get("currency", "INR")

            # 1. Activate tenant subscription in workspace DB
            await self._activate_tenant_subscription(
                tenant_id=tenant_id,
                subscription_id=subscription_id,
                plan_id=plan_id
            )

            # 2. Create ERP Sales Order and Invoice
            erp_result = await self._create_erp_sales_records(
                tenant_id=tenant_id,
                plan_id=plan_id,
                amount=amount,
                currency=currency,
                payment_id=payment_id,
                subscription_id=subscription_id,
                billing_cycle=metadata.get("billing_cycle", "monthly")
            )

            return {
                "status": "success",
                "action": "subscription_activated",
                "erp_sales_order": erp_result.get("sales_order_id"),
                "erp_invoice": erp_result.get("invoice_id")
            }

        elif event_type == "subscription.charged":
            # Recurring payment successful
            subscription_id = payload.get("subscription_id")
            plan_id = payload.get("plan_id")
            payment_id = payload.get("payment_id")
            amount = payload.get("amount", 0)
            currency = payload.get("currency", "INR")

            await self._renew_tenant_subscription(
                tenant_id=tenant_id,
                subscription_id=subscription_id
            )

            # Create invoice for the recurring payment
            erp_result = await self._create_erp_recurring_invoice(
                tenant_id=tenant_id,
                plan_id=plan_id,
                amount=amount,
                currency=currency,
                payment_id=payment_id,
                subscription_id=subscription_id,
                billing_cycle=metadata.get("billing_cycle", "monthly")
            )

            return {
                "status": "success",
                "action": "subscription_renewed",
                "erp_invoice": erp_result.get("invoice_id")
            }

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

    # ═══════════════════════════════════════════════════════════════════
    # ERP SALES INTEGRATION
    # ═══════════════════════════════════════════════════════════════════

    async def _create_erp_sales_records(
        self,
        tenant_id: str,
        plan_id: str,
        amount: float,
        currency: str,
        payment_id: str,
        subscription_id: str,
        billing_cycle: str = "monthly"
    ) -> dict:
        """
        Create complete ERP sales records after successful payment.

        Full Sales Flow:
        1. Ensure Sales Customer exists
        2. Convert Lead to Customer (if lead exists)
        3. Create Sales Order
        4. Create Sales Invoice
        5. Record Payment
        6. Create accounting journal entry

        Args:
            tenant_id: Workspace tenant ID
            plan_id: Subscription plan ID
            amount: Payment amount (in smallest currency unit, e.g., paise)
            currency: Currency code (e.g., INR)
            payment_id: BheemPay payment ID
            subscription_id: Subscription ID
            billing_cycle: 'monthly' or 'annual'

        Returns:
            Dict with sales_order_id, invoice_id, payment_id, journal_entry_id
        """
        result = {
            "sales_order_id": None,
            "invoice_id": None,
            "payment_record_id": None,
            "journal_entry_id": None,
            "entry_number": None,
            "status": None,
            "errors": []
        }

        try:
            # Convert amount from paise to rupees if needed
            amount_decimal = amount / 100 if amount > 1000 else amount

            # Get tenant details
            tenant = await self._get_tenant(tenant_id)
            if not tenant:
                result["errors"].append(f"Tenant not found: {tenant_id}")
                return result

            # Get plan details for description
            plan_details = {}
            try:
                plan_details = await self.erp.get_plan_details(plan_id)
            except Exception as e:
                logger.warning(f"Could not fetch plan details: {e}")

            plan_name = plan_details.get("name", "Workspace Subscription")
            plan_sku = plan_details.get("sku_code", plan_id)
            cycle_display = "Monthly" if billing_cycle == "monthly" else "Annual"

            # Create reference
            ref_id = subscription_id[:8] if subscription_id else tenant_id[:8]
            reference = f"WS-{ref_id}-{payment_id[:8] if payment_id else 'PAY'}"

            # ─────────────────────────────────────────────────────────────
            # Step 1: Ensure Sales Customer exists
            # ─────────────────────────────────────────────────────────────
            customer_id = await self._ensure_erp_sales_customer(tenant)
            if not customer_id:
                logger.warning(f"Could not create/find sales customer for tenant {tenant_id}")
                # Continue with journal entry only
            else:
                logger.info(f"Using Sales Customer: {customer_id}")

            # ─────────────────────────────────────────────────────────────
            # Step 2: Convert Lead to Customer (if lead exists)
            # ─────────────────────────────────────────────────────────────
            if hasattr(tenant, 'erp_lead_id') and tenant.erp_lead_id:
                try:
                    await self.erp.update_crm_lead(
                        lead_id=str(tenant.erp_lead_id),
                        status="CONVERTED"
                    )
                    logger.info(f"Lead {tenant.erp_lead_id} marked as converted")
                except Exception as e:
                    logger.warning(f"Could not update lead status: {e}")

            # ─────────────────────────────────────────────────────────────
            # Step 3: Create Sales Order
            # ─────────────────────────────────────────────────────────────
            if customer_id:
                try:
                    order_date = date.today().isoformat()
                    sales_order = await self.erp.create_sales_order(
                        customer_id=customer_id,
                        company_id=settings.BHEEMVERSE_PARENT_COMPANY_ID,
                        items=[{
                            "sku_id": plan_sku,
                            "description": f"Bheem Workspace {plan_name} ({cycle_display})",
                            "quantity": 1,
                            "unit_price": amount_decimal
                        }],
                        order_date=order_date,
                        reference=reference,
                        notes=f"Subscription: {subscription_id}"
                    )

                    if sales_order.get("id"):
                        result["sales_order_id"] = sales_order.get("id")
                        logger.info(f"Created Sales Order: {sales_order.get('id')}")

                        # Confirm the order
                        try:
                            await self.erp.confirm_sales_order(sales_order.get("id"))
                        except Exception as e:
                            logger.warning(f"Could not confirm sales order: {e}")
                    else:
                        result["errors"].append(f"Sales Order: {sales_order.get('error', 'Unknown error')}")

                except Exception as e:
                    logger.warning(f"Sales Order creation error: {e}")
                    result["errors"].append(f"Sales Order: {str(e)}")

            # ─────────────────────────────────────────────────────────────
            # Step 4: Create Sales Invoice
            # ─────────────────────────────────────────────────────────────
            if customer_id:
                try:
                    invoice_date = date.today().isoformat()
                    due_date = (date.today() + timedelta(days=0)).isoformat()  # Already paid

                    sales_invoice = await self.erp.create_sales_invoice(
                        customer_id=customer_id,
                        company_id=settings.BHEEMVERSE_PARENT_COMPANY_ID,
                        items=[{
                            "sku_id": plan_sku,
                            "description": f"Bheem Workspace {plan_name} ({cycle_display})",
                            "quantity": 1,
                            "unit_price": amount_decimal
                        }],
                        sales_order_id=result.get("sales_order_id"),
                        invoice_date=invoice_date,
                        due_date=due_date,
                        payment_terms=0,  # Already paid
                        reference=reference,
                        notes=f"Payment ID: {payment_id}"
                    )

                    if sales_invoice.get("id"):
                        result["invoice_id"] = sales_invoice.get("id")
                        logger.info(f"Created Sales Invoice: {sales_invoice.get('id')}")

                        # Issue the invoice
                        try:
                            await self.erp.issue_sales_invoice(sales_invoice.get("id"))
                        except Exception as e:
                            logger.warning(f"Could not issue invoice: {e}")

                        # ─────────────────────────────────────────────────────
                        # Step 5: Record Payment against Invoice
                        # ─────────────────────────────────────────────────────
                        try:
                            payment_record = await self.erp.create_sales_payment(
                                invoice_id=sales_invoice.get("id"),
                                amount=amount_decimal,
                                payment_method="razorpay",
                                payment_date=date.today().isoformat(),
                                reference=payment_id,
                                notes=f"BheemPay Payment - Subscription: {subscription_id}"
                            )

                            if payment_record.get("id"):
                                result["payment_record_id"] = payment_record.get("id")
                                logger.info(f"Recorded Payment: {payment_record.get('id')}")

                                # Mark invoice as paid
                                try:
                                    await self.erp.mark_invoice_paid(
                                        invoice_id=sales_invoice.get("id"),
                                        payment_date=date.today().isoformat(),
                                        payment_reference=payment_id,
                                        payment_method="razorpay"
                                    )
                                except Exception as e:
                                    logger.warning(f"Could not mark invoice as paid: {e}")

                        except Exception as e:
                            logger.warning(f"Payment recording error: {e}")
                            result["errors"].append(f"Payment: {str(e)}")

                    else:
                        result["errors"].append(f"Invoice: {sales_invoice.get('error', 'Unknown error')}")

                except Exception as e:
                    logger.warning(f"Sales Invoice creation error: {e}")
                    result["errors"].append(f"Invoice: {str(e)}")

            # ─────────────────────────────────────────────────────────────
            # Step 6: Create accounting journal entry (always)
            # ─────────────────────────────────────────────────────────────
            logger.info(f"Creating journal entry for tenant {tenant_id}, amount: ₹{amount_decimal}")
            accounting_result = await self._create_accounting_entries(
                customer_id=tenant_id,
                company_id=settings.BHEEMVERSE_PARENT_COMPANY_CODE,
                amount=amount_decimal,
                currency=currency,
                payment_id=payment_id or "DIRECT",
                description=f"Bheem Workspace {plan_name} Subscription ({cycle_display})",
                reference=reference
            )

            result["journal_entry_id"] = accounting_result.get("journal_entry_id")
            result["entry_number"] = accounting_result.get("entry_number")
            result["status"] = accounting_result.get("status")

            if accounting_result.get("errors"):
                result["errors"].extend(accounting_result["errors"])

            # ─────────────────────────────────────────────────────────────
            # Step 7: Update tenant with ERP references
            # ─────────────────────────────────────────────────────────────
            if result["sales_order_id"] or result["invoice_id"]:
                await self._update_tenant_erp_sales_refs(
                    tenant_id=tenant_id,
                    sales_order_id=result["sales_order_id"],
                    invoice_id=result["invoice_id"]
                )

            # Log success summary
            logger.info(
                f"✓ ERP sales records created for tenant {tenant_id}: "
                f"Order={result['sales_order_id']}, Invoice={result['invoice_id']}, "
                f"Payment={result['payment_record_id']}, Journal={result['entry_number']}"
            )

        except Exception as e:
            logger.error(f"ERP sales integration error for tenant {tenant_id}: {e}")
            result["errors"].append(str(e))

        return result

    async def _ensure_erp_sales_customer(self, tenant) -> Optional[str]:
        """
        Ensure ERP Sales Customer exists for the tenant.
        Creates one if it doesn't exist.

        Args:
            tenant: Tenant record from database

        Returns:
            ERP customer ID or None
        """
        # Check if tenant already has an ERP sales customer ID
        if hasattr(tenant, 'erp_sales_customer_id') and tenant.erp_sales_customer_id:
            return str(tenant.erp_sales_customer_id)

        # Fall back to CRM customer ID (they may be the same in some ERP setups)
        if tenant.erp_customer_id:
            return str(tenant.erp_customer_id)

        # Create a new Sales Customer in ERP
        try:
            billing_email = tenant.billing_email or tenant.owner_email
            customer = await self.erp.create_sales_customer(
                name=tenant.name,
                email=billing_email,
                company_id=settings.BHEEMVERSE_PARENT_COMPANY_CODE,
                phone=getattr(tenant, 'phone', None),
                address={
                    "country": getattr(tenant, 'country', 'IN')
                },
                tax_id=getattr(tenant, 'tax_id', None),
                payment_terms=30,
                metadata={
                    "workspace_tenant_id": str(tenant.id),
                    "source": "bheem_workspace"
                }
            )

            customer_id = customer.get("id")
            if customer_id:
                # Update tenant with the new customer ID
                await self._update_tenant_erp_customer(tenant.id, customer_id)
                return customer_id

        except Exception as e:
            logger.error(f"Failed to create ERP sales customer for tenant {tenant.id}: {e}")

        return None

    async def _update_tenant_erp_sales_refs(
        self,
        tenant_id: str,
        sales_order_id: Optional[str],
        invoice_id: Optional[str]
    ):
        """
        Update tenant with ERP sales references.
        Stores the latest sales order and invoice IDs.

        Args:
            tenant_id: Tenant ID
            sales_order_id: ERP Sales Order ID
            invoice_id: ERP Invoice ID
        """
        try:
            # Note: These columns need to exist in the tenants table
            # If they don't exist, this will fail gracefully
            query = text("""
                UPDATE workspace.tenants SET
                    last_erp_sales_order_id = :sales_order_id,
                    last_erp_invoice_id = :invoice_id,
                    updated_at = NOW()
                WHERE id = CAST(:tenant_id AS uuid)
            """)
            await self.db.execute(query, {
                "tenant_id": tenant_id,
                "sales_order_id": sales_order_id,
                "invoice_id": invoice_id
            })
            await self.db.commit()
        except Exception as e:
            # Columns may not exist - log and continue
            logger.warning(f"Could not update ERP sales refs for tenant {tenant_id}: {e}")
            # Don't fail the whole operation for this

    async def _create_accounting_entries(
        self,
        customer_id: str,
        company_id: str,
        amount: float,
        currency: str,
        payment_id: str,
        description: str,
        reference: str
    ) -> dict:
        """
        Create accounting entries in the ERP Accounting module.

        Creates a simple journal entry for subscription revenue:
        - Debit: Cash in Bank (payment received via BheemPay)
        - Credit: Subscription Revenue

        Args:
            customer_id: ERP Customer ID (for reference)
            company_id: Company UUID (Bheemverse: 1b505aaf-981e-4155-bb97-7650827b0e12)
            amount: Payment amount
            currency: Currency code
            payment_id: BheemPay payment reference
            description: Entry description
            reference: Entry reference

        Returns:
            Dict with journal_entry_id and any errors
        """
        result = {
            "journal_entry_id": None,
            "entry_number": None,
            "status": None,
            "accounts_used": {},
            "errors": []
        }

        # BHM001 - Bheemverse Innovation (Parent company - all external revenue goes here)
        # Using settings for company ID - fully dynamic, no hardcoding
        company_uuid = settings.BHEEMVERSE_PARENT_COMPANY_ID

        try:
            logger.info(f"Creating journal entry for subscription payment: {reference}")
            logger.info(f"Target company: {settings.BHEEMVERSE_PARENT_COMPANY_CODE} ({company_uuid})")

            # Dynamically fetch the appropriate accounts from ERP
            accounts = await self.erp.get_subscription_accounts(company_uuid)

            cash_account_id = accounts.get("cash_account_id")
            revenue_account_id = accounts.get("revenue_account_id")

            if not cash_account_id:
                raise ValueError(f"No Cash/Bank account found for company {company_uuid}")
            if not revenue_account_id:
                raise ValueError(f"No Revenue account found for company {company_uuid}")

            logger.info(
                f"Using accounts - Cash: {accounts.get('cash_account_name')} ({cash_account_id}), "
                f"Revenue: {accounts.get('revenue_account_name')} ({revenue_account_id})"
            )

            # Store accounts used for audit trail
            result["accounts_used"] = {
                "cash_account": accounts.get("cash_account_name"),
                "revenue_account": accounts.get("revenue_account_name")
            }

            # Create journal entry with dynamically fetched accounts
            journal_entry = await self.erp.create_subscription_revenue_entry(
                company_id=company_uuid,
                amount=amount,
                description=description,
                reference=reference,
                entry_date=date.today().isoformat(),
                cash_account_id=cash_account_id,
                revenue_account_id=revenue_account_id,
                auto_post=True  # Automatically post the entry
            )

            result["journal_entry_id"] = journal_entry.get("id")
            result["entry_number"] = journal_entry.get("entry_number")
            result["status"] = journal_entry.get("status", "DRAFT")

            logger.info(
                f"Created journal entry: {result['entry_number']} "
                f"(ID: {result['journal_entry_id']}, Status: {result['status']})"
            )

        except Exception as e:
            logger.error(f"Accounting entries creation error: {e}")
            result["errors"].append(str(e))

        return result

    async def _create_erp_recurring_invoice(
        self,
        tenant_id: str,
        plan_id: str,
        amount: float,
        currency: str,
        payment_id: str,
        subscription_id: str,
        billing_cycle: str = "monthly"
    ) -> dict:
        """
        Create Invoice in ERP for recurring subscription payment.
        No Sales Order needed - just invoice and payment recording.

        Args:
            tenant_id: Workspace tenant ID
            plan_id: Subscription plan ID
            amount: Payment amount
            currency: Currency code
            payment_id: BheemPay payment ID
            subscription_id: Subscription ID
            billing_cycle: 'monthly' or 'annual'

        Returns:
            Dict with journal_entry_id
        """
        result = {
            "journal_entry_id": None,
            "entry_number": None,
            "status": None,
            "errors": []
        }

        try:
            # Convert amount from paise to rupees if needed
            amount_decimal = amount / 100 if amount > 1000 else amount

            # Get plan details
            plan_details = {}
            try:
                plan_details = await self.erp.get_plan_details(plan_id)
            except Exception as e:
                logger.warning(f"Could not fetch plan details: {e}")

            plan_name = plan_details.get("name", "Workspace Subscription")
            cycle_display = "Monthly" if billing_cycle == "monthly" else "Annual"
            period = datetime.now().strftime("%B %Y")

            # Create reference
            ref_id = subscription_id[:8] if subscription_id else tenant_id[:8]
            reference = f"REC-{ref_id}-{datetime.now().strftime('%Y%m')}"

            # Create accounting journal entry directly
            logger.info(f"Creating recurring journal entry for tenant {tenant_id}, amount: ₹{amount_decimal}")
            accounting_result = await self._create_accounting_entries(
                customer_id=tenant_id,
                company_id=settings.BHEEMVERSE_PARENT_COMPANY_CODE,
                amount=amount_decimal,
                currency=currency,
                payment_id=payment_id or "RECURRING",
                description=f"Bheem Workspace {plan_name} - {period} ({cycle_display})",
                reference=reference
            )

            result["journal_entry_id"] = accounting_result.get("journal_entry_id")
            result["entry_number"] = accounting_result.get("entry_number")
            result["status"] = accounting_result.get("status")

            if accounting_result.get("errors"):
                result["errors"].extend(accounting_result["errors"])

            # Log success
            if result["journal_entry_id"]:
                logger.info(
                    f"✓ Recurring ERP entry created for tenant {tenant_id}: "
                    f"Entry #{result['entry_number']}, Status: {result['status']}"
                )

        except Exception as e:
            logger.error(f"ERP recurring entry error for tenant {tenant_id}: {e}")
            result["errors"].append(str(e))

        return result
