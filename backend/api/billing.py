"""
Bheem Workspace - Billing API
Handles subscription management for external commercial customers
Revenue flows to BHM001 (Bheemverse Innovation)
"""
from typing import Optional
from uuid import UUID
from fastapi import APIRouter, Depends, HTTPException, Request, BackgroundTasks
from pydantic import BaseModel, Field, field_validator
from sqlalchemy.ext.asyncio import AsyncSession

from core.database import get_db
from core.security import get_current_user
from services.external_workspace_service import ExternalWorkspaceService


router = APIRouter(prefix="/billing", tags=["Billing"])


# ═══════════════════════════════════════════════════════════════════
# REQUEST/RESPONSE MODELS
# ═══════════════════════════════════════════════════════════════════

class CheckoutRequest(BaseModel):
    """Request to create checkout session"""
    plan_id: str = Field(..., description="SKU ID (e.g., WORKSPACE-PROFESSIONAL)")
    billing_cycle: str = Field("monthly", description="'monthly' or 'annual'")


class CheckoutResponse(BaseModel):
    """Checkout session response"""
    checkout_id: Optional[str] = None
    order_id: str
    amount: float  # BheemPay returns amount as string, converted to float
    currency: str = "INR"
    plan_name: str
    key_id: str  # Razorpay public key for frontend
    gateway_response: Optional[dict] = None

    @field_validator('amount', mode='before')
    @classmethod
    def parse_amount(cls, v):
        """Convert string amount to float"""
        if isinstance(v, str):
            return float(v)
        return v


class CancelRequest(BaseModel):
    """Request to cancel subscription"""
    reason: Optional[str] = None
    immediate: bool = False


class SubscriptionStatus(BaseModel):
    """Subscription status response"""
    subscription_id: Optional[str] = None
    status: str
    plan: Optional[str] = None
    period_end: Optional[str] = None
    limits: Optional[dict] = None


class PlanTier(BaseModel):
    """Subscription plan tier"""
    tier_id: str
    tier_name: str
    price: float
    max_users: int
    max_storage_gb: int
    features: dict


class PlanResponse(BaseModel):
    """Subscription plan details"""
    sku_id: str
    name: str
    description: Optional[str] = None
    base_price: float
    billing_cycle: str
    tiers: list = []


# ═══════════════════════════════════════════════════════════════════
# HELPER FUNCTIONS
# ═══════════════════════════════════════════════════════════════════

async def get_billing_service(db: AsyncSession = Depends(get_db)) -> ExternalWorkspaceService:
    """Dependency to get billing service"""
    return ExternalWorkspaceService(db)


async def get_current_tenant_id(
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
) -> UUID:
    """
    Get tenant ID for the current user.
    Users must be associated with a tenant to use billing.

    Priority:
    1. Find tenant via tenant_users table (works for external customers)
    2. Fall back to company_code/company_id match (for internal employees)
    """
    from sqlalchemy import text

    # Priority 1: Find tenant where user is a member (works for external customers)
    user_id = current_user.get("user_id") or current_user.get("sub")
    if user_id:
        query = text("""
            SELECT tenant_id FROM workspace.tenant_users
            WHERE user_id = CAST(:user_id AS uuid)
            LIMIT 1
        """)
        result = await db.execute(query, {"user_id": user_id})
        row = result.fetchone()
        if row:
            return row[0]

    # Priority 2: Find tenant by ERP company code or ID (for internal employees)
    company_id = current_user.get("company_id")
    if company_id:
        query = text("""
            SELECT id FROM workspace.tenants
            WHERE erp_company_code = :company_code
               OR erp_company_id = CAST(:company_id AS uuid)
               OR id = CAST(:company_id AS uuid)
            LIMIT 1
        """)
        result = await db.execute(query, {
            "company_code": current_user.get("company_code", ""),
            "company_id": company_id
        })
        row = result.fetchone()
        if row:
            return row[0]

    raise HTTPException(
        status_code=400,
        detail="User not associated with any tenant. Please join or create a workspace first."
    )


# ═══════════════════════════════════════════════════════════════════
# PLANS ENDPOINTS (Public)
# ═══════════════════════════════════════════════════════════════════

@router.get("/plans")
async def list_plans(
    service: ExternalWorkspaceService = Depends(get_billing_service)
):
    """
    List available subscription plans.
    This endpoint is public - no authentication required.
    """
    try:
        plans = await service.get_available_plans()
        return {"plans": plans}
    except Exception as e:
        # Return default plans if ERP is unavailable
        return {
            "plans": [
                {
                    "sku_id": "WORKSPACE-STARTER",
                    "name": "Starter",
                    "description": "For small teams getting started",
                    "base_price": 0,
                    "billing_cycle": "monthly",
                    "features": ["5 users", "5GB storage", "10 hours video"]
                },
                {
                    "sku_id": "WORKSPACE-PROFESSIONAL",
                    "name": "Professional",
                    "description": "For growing teams",
                    "base_price": 2499,
                    "billing_cycle": "monthly",
                    "features": ["25 users", "50GB storage", "100 hours video"]
                },
                {
                    "sku_id": "WORKSPACE-ENTERPRISE",
                    "name": "Enterprise",
                    "description": "For large organizations",
                    "base_price": 9999,
                    "billing_cycle": "monthly",
                    "features": ["Unlimited users", "500GB storage", "Unlimited video"]
                }
            ],
            "source": "fallback"
        }


@router.get("/plans/{plan_id}")
async def get_plan_details(
    plan_id: str,
    service: ExternalWorkspaceService = Depends(get_billing_service)
):
    """Get detailed information about a specific plan."""
    try:
        plan = await service.get_plan_details(plan_id)
        return plan
    except Exception as e:
        raise HTTPException(status_code=404, detail=f"Plan {plan_id} not found")


# ═══════════════════════════════════════════════════════════════════
# CHECKOUT ENDPOINTS (Authenticated)
# ═══════════════════════════════════════════════════════════════════

@router.post("/checkout", response_model=CheckoutResponse)
async def create_checkout(
    request: CheckoutRequest,
    tenant_id: UUID = Depends(get_current_tenant_id),
    service: ExternalWorkspaceService = Depends(get_billing_service),
    current_user: dict = Depends(get_current_user)
):
    """
    Create a subscription checkout session.
    Returns Razorpay order details for the frontend to initiate payment.
    """
    import logging
    logger = logging.getLogger(__name__)

    try:
        logger.info(f"Creating checkout for tenant {tenant_id}, plan {request.plan_id}")
        result = await service.create_checkout_session(
            tenant_id=tenant_id,
            plan_id=request.plan_id,
            billing_cycle=request.billing_cycle
        )
        logger.info(f"Checkout created successfully: {result.get('order_id')}")
        return CheckoutResponse(**result)
    except ValueError as e:
        logger.error(f"Checkout validation error: {e}")
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        import traceback
        logger.error(f"Checkout failed: {type(e).__name__}: {e}")
        logger.error(f"Traceback: {traceback.format_exc()}")
        raise HTTPException(status_code=500, detail=f"Failed to create checkout: {str(e)}")


@router.get("/checkout/{order_id}")
async def get_checkout_status(
    order_id: str,
    service: ExternalWorkspaceService = Depends(get_billing_service),
    current_user: dict = Depends(get_current_user)
):
    """
    Get checkout/payment status.
    Used for polling after payment to check completion.
    """
    try:
        return await service.get_checkout_status(order_id)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to get checkout status: {str(e)}")


# ═══════════════════════════════════════════════════════════════════
# SUBSCRIPTION ENDPOINTS (Authenticated)
# ═══════════════════════════════════════════════════════════════════

@router.get("/subscription", response_model=SubscriptionStatus)
async def get_subscription(
    tenant_id: UUID = Depends(get_current_tenant_id),
    service: ExternalWorkspaceService = Depends(get_billing_service),
    current_user: dict = Depends(get_current_user)
):
    """Get current subscription status for the tenant."""
    result = await service.get_subscription_status(tenant_id)

    if result.get("status") == "not_found":
        raise HTTPException(status_code=404, detail="Subscription not found")

    return SubscriptionStatus(**result)


@router.post("/subscription/cancel")
async def cancel_subscription(
    request: CancelRequest,
    tenant_id: UUID = Depends(get_current_tenant_id),
    service: ExternalWorkspaceService = Depends(get_billing_service),
    current_user: dict = Depends(get_current_user)
):
    """
    Cancel the current subscription.
    By default, cancels at the end of the billing period.
    Set immediate=true to cancel immediately.
    """
    try:
        return await service.cancel_subscription(
            tenant_id=tenant_id,
            reason=request.reason,
            immediate=request.immediate
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to cancel subscription: {str(e)}")


# ═══════════════════════════════════════════════════════════════════
# INVOICES ENDPOINTS (Authenticated)
# ═══════════════════════════════════════════════════════════════════

@router.get("/invoices")
async def list_invoices(
    limit: int = 50,
    tenant_id: UUID = Depends(get_current_tenant_id),
    service: ExternalWorkspaceService = Depends(get_billing_service),
    current_user: dict = Depends(get_current_user)
):
    """Get invoices for the current tenant."""
    invoices = await service.get_invoices(tenant_id, limit=limit)
    return {"invoices": invoices}


@router.get("/history")
async def get_billing_history(
    tenant_id: UUID = Depends(get_current_tenant_id),
    service: ExternalWorkspaceService = Depends(get_billing_service),
    current_user: dict = Depends(get_current_user)
):
    """Get complete billing history including invoices and subscription details."""
    return await service.get_billing_history(tenant_id)


# ═══════════════════════════════════════════════════════════════════
# WEBHOOK ENDPOINT (No Auth - Signature Verified)
# ═══════════════════════════════════════════════════════════════════

@router.post("/webhook")
async def handle_webhook(
    request: Request,
    background_tasks: BackgroundTasks,
    db: AsyncSession = Depends(get_db)
):
    """
    Handle BheemPay webhooks.
    Verifies signature and processes payment events.
    """
    # Get raw body for signature verification
    payload = await request.body()
    signature = request.headers.get("X-BheemPay-Signature", "")

    service = ExternalWorkspaceService(db)

    # Verify signature
    if not service.verify_webhook_signature(payload, signature):
        raise HTTPException(status_code=400, detail="Invalid webhook signature")

    # Parse payload
    try:
        data = await request.json()
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid JSON payload")

    event_type = data.get("event")
    event_payload = data.get("payload", {})

    if not event_type:
        raise HTTPException(status_code=400, detail="Missing event type")

    # Process webhook
    result = await service.handle_payment_webhook(event_type, event_payload)

    return {"status": "received", "result": result}
