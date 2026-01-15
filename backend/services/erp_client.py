"""
Bheem Workspace - ERP API Client
Handles communication with Bheem Core ERP for subscriptions, CRM, HR, and PM integration
Authenticates via Bheem Passport - no hardcoded tokens
"""
from typing import Optional, Dict, Any, List
from uuid import UUID
from datetime import datetime, timedelta
import httpx
import jwt
import logging

from core.config import settings

logger = logging.getLogger(__name__)

# ═══════════════════════════════════════════════════════════════════
# FALLBACK PLANS (Used when ERP is unavailable)
# ═══════════════════════════════════════════════════════════════════
FALLBACK_PLANS = {
    "WORKSPACE-STARTER": {
        "plan_id": "00000000-0000-0000-0000-000000000001",
        "sku_code": "WORKSPACE-STARTER",
        "name": "Starter",
        "description": "For small teams getting started",
        "base_price": 0,
        "currency": "INR",
        "billing_cycle": "monthly",
        "features": {
            "max_users": 5,
            "storage_gb": 5,
            "meet_hours": 10,
            "mail_enabled": True,
            "docs_enabled": True,
            "meet_enabled": True
        },
        "tiers": [{
            "tier_id": "starter-tier-1",
            "tier_name": "Starter",
            "max_users": 5,
            "max_storage_gb": 5,
            "price": 0,
            "features_included": {
                "mail": True,
                "docs": True,
                "meet": True,
                "calendar": True
            }
        }]
    },
    "WORKSPACE-PROFESSIONAL": {
        "plan_id": "00000000-0000-0000-0000-000000000002",
        "sku_code": "WORKSPACE-PROFESSIONAL",
        "name": "Professional",
        "description": "For growing teams",
        "base_price": 2499,
        "currency": "INR",
        "billing_cycle": "monthly",
        "features": {
            "max_users": 25,
            "storage_gb": 50,
            "meet_hours": 100,
            "mail_enabled": True,
            "docs_enabled": True,
            "meet_enabled": True,
            "chat_enabled": True
        },
        "tiers": [{
            "tier_id": "professional-tier-1",
            "tier_name": "Professional",
            "max_users": 25,
            "max_storage_gb": 50,
            "price": 2499,
            "features_included": {
                "mail": True,
                "docs": True,
                "meet": True,
                "calendar": True,
                "chat": True,
                "custom_domain": True
            }
        }]
    },
    "WORKSPACE-ENTERPRISE": {
        "plan_id": "00000000-0000-0000-0000-000000000003",
        "sku_code": "WORKSPACE-ENTERPRISE",
        "name": "Enterprise",
        "description": "For large organizations",
        "base_price": 9999,
        "currency": "INR",
        "billing_cycle": "monthly",
        "features": {
            "max_users": -1,  # Unlimited
            "storage_gb": 500,
            "meet_hours": -1,  # Unlimited
            "mail_enabled": True,
            "docs_enabled": True,
            "meet_enabled": True,
            "chat_enabled": True,
            "sso_enabled": True,
            "audit_logs": True
        },
        "tiers": [{
            "tier_id": "enterprise-tier-1",
            "tier_name": "Enterprise",
            "max_users": -1,
            "max_storage_gb": 500,
            "price": 9999,
            "features_included": {
                "mail": True,
                "docs": True,
                "meet": True,
                "calendar": True,
                "chat": True,
                "custom_domain": True,
                "sso": True,
                "audit_logs": True,
                "priority_support": True
            }
        }]
    }
}


class ERPClient:
    """Client for Bheem Core ERP API interactions"""

    def __init__(self):
        self.base_url = settings.ERP_SERVICE_URL
        self.passport_url = getattr(settings, 'BHEEM_PASSPORT_URL', 'https://platform.bheem.co.uk')
        self._cached_token: Optional[str] = None
        self._token_expiry: Optional[datetime] = None

    async def _get_service_token(self) -> str:
        """
        Get a valid service token for ERP API calls.
        Uses Bheem Passport to authenticate with service account credentials.
        Caches token and refreshes when expired.
        """
        # Check if we have a valid cached token
        if self._cached_token and self._token_expiry:
            # Refresh if less than 5 minutes remaining
            if datetime.utcnow() < (self._token_expiry - timedelta(minutes=5)):
                return self._cached_token

        # Get service account credentials from settings
        service_username = getattr(settings, 'ERP_SERVICE_USERNAME', None)
        service_password = getattr(settings, 'ERP_SERVICE_PASSWORD', None)

        if service_username and service_password:
            # Authenticate via Bheem Passport
            try:
                async with httpx.AsyncClient(timeout=15.0) as client:
                    response = await client.post(
                        f"{self.passport_url}/api/v1/auth/login",
                        data={
                            "username": service_username,
                            "password": service_password
                        },
                        headers={"X-Company-Code": settings.BHEEMVERSE_PARENT_COMPANY_CODE}
                    )
                    response.raise_for_status()
                    data = response.json()

                    self._cached_token = data.get("access_token")

                    # Decode token to get expiry (without verification - just for expiry time)
                    try:
                        payload = jwt.decode(self._cached_token, options={"verify_signature": False})
                        exp = payload.get("exp")
                        if exp:
                            self._token_expiry = datetime.fromtimestamp(exp)
                    except Exception:
                        # Default to 1 hour if can't decode
                        self._token_expiry = datetime.utcnow() + timedelta(hours=1)

                    logger.info(f"ERP service token obtained via Passport, expires: {self._token_expiry}")
                    return self._cached_token

            except Exception as e:
                logger.error(f"Failed to get service token via Passport: {e}")
                # Fall through to JWT generation

        # Fallback: Generate token locally using shared JWT secret
        # Both Workspace and ERP use the same BHEEM_JWT_SECRET
        jwt_secret = getattr(settings, 'BHEEM_JWT_SECRET', None)
        if jwt_secret:
            payload = {
                "user_id": "service-workspace",
                "username": "workspace-service@bheem.internal",
                "role": "Service",
                "company_id": settings.BHEEMVERSE_PARENT_COMPANY_ID,
                "company_code": settings.BHEEMVERSE_PARENT_COMPANY_CODE,
                "companies": [settings.BHEEMVERSE_PARENT_COMPANY_CODE],
                "exp": datetime.utcnow() + timedelta(hours=1),
                "type": "access",
                "source": "workspace-service"
            }
            self._cached_token = jwt.encode(payload, jwt_secret, algorithm="HS256")
            self._token_expiry = datetime.utcnow() + timedelta(hours=1)
            logger.info("ERP service token generated using shared JWT secret")
            return self._cached_token

        raise ValueError("No authentication method available for ERP API - configure ERP_SERVICE_USERNAME/PASSWORD or BHEEM_JWT_SECRET")

    async def _request(
        self,
        method: str,
        endpoint: str,
        source: str = "workspace",
        **kwargs
    ) -> dict:
        """Make authenticated request to ERP using dynamic token"""
        # Get fresh token (cached if valid)
        token = await self._get_service_token()

        headers = {
            "Authorization": f"Bearer {token}",
            "X-Source": f"workspace-{source}",
            "Content-Type": "application/json"
        }

        # ERP API uses /api prefix without /v1
        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.request(
                method=method,
                url=f"{self.base_url}/api{endpoint}",
                headers=headers,
                **kwargs
            )
            response.raise_for_status()
            return response.json()

    # ═══════════════════════════════════════════════════════════════════
    # SUBSCRIPTION / SKU ENDPOINTS
    # ═══════════════════════════════════════════════════════════════════

    async def get_workspace_plans(self, plan_prefix: str = "WORKSPACE-") -> list:
        """
        Get available workspace subscription plans from ERP.
        Uses the UserSubscriptionService.get_available_plans() method.
        Falls back to local FALLBACK_PLANS if ERP is unavailable.

        Args:
            plan_prefix: SKU prefix to filter (default: WORKSPACE-)

        Returns:
            List of available plans with tiers
        """
        try:
            result = await self._request(
                "GET",
                "/shared/sku-subscription",
                params={"plan_prefix": plan_prefix}
            )
            plans = result.get("data", [])
            if plans:
                return plans
        except Exception as e:
            logger.warning(f"ERP plans fetch failed, using fallback: {e}")

        # Return fallback plans if ERP unavailable or no plans found
        return [
            plan for sku_code, plan in FALLBACK_PLANS.items()
            if sku_code.startswith(plan_prefix)
        ]

    async def get_plan_details(self, sku_id: str) -> dict:
        """
        Get plan details with tiers.
        Falls back to local FALLBACK_PLANS if ERP is unavailable.

        Args:
            sku_id: SKU ID (UUID or SKU code like WORKSPACE-PROFESSIONAL)

        Returns:
            Plan details including tiers and features
        """
        try:
            result = await self._request("GET", f"/shared/sku-subscription/sku/{sku_id}")
            if result:
                return result
        except Exception as e:
            logger.warning(f"ERP plan details fetch failed, using fallback: {e}")

        # Try fallback by SKU code
        if sku_id in FALLBACK_PLANS:
            return FALLBACK_PLANS[sku_id]

        # Try matching by plan_id in fallback plans
        for plan in FALLBACK_PLANS.values():
            if plan.get("plan_id") == sku_id:
                return plan

        # Return empty dict if nothing found
        return {}

    async def get_plan_by_sku_code(self, sku_code: str) -> Optional[dict]:
        """
        Look up plan by SKU code (e.g., WORKSPACE-STARTER) and return the plan_id (UUID).
        Falls back to local FALLBACK_PLANS if ERP is unavailable.

        Args:
            sku_code: SKU code string (e.g., WORKSPACE-STARTER)

        Returns:
            Plan details with plan_id (UUID) or None if not found
        """
        try:
            result = await self._request("GET", "/subscriptions/plans")
            plans = result.get("plans", [])
            for plan in plans:
                if plan.get("sku_code") == sku_code:
                    return plan
        except Exception as e:
            logger.warning(f"ERP plan lookup failed, using fallback: {e}")

        # Return fallback plan if ERP unavailable or plan not found
        return FALLBACK_PLANS.get(sku_code)

    async def get_user_subscription(self, user_id: str) -> Optional[dict]:
        """
        Get user's active subscription from ERP.

        Args:
            user_id: Auth user ID

        Returns:
            Subscription details or None if not found
        """
        try:
            return await self._request("GET", f"/subscriptions/user/{user_id}")
        except httpx.HTTPStatusError as e:
            if e.response.status_code == 404:
                return None
            raise

    async def create_subscription(
        self,
        user_id: str,
        plan_id: str,
        company_id: str,
        tier_id: Optional[str] = None,
        payment_reference: Optional[str] = None
    ) -> dict:
        """
        Create a new subscription in ERP.

        Args:
            user_id: Auth user ID
            plan_id: SKU ID
            company_id: Company ID (BHM001 for external)
            tier_id: Optional tier ID
            payment_reference: Payment reference

        Returns:
            Created subscription details
        """
        return await self._request(
            "POST",
            "/subscriptions",
            json={
                "user_id": user_id,
                "plan_id": plan_id,
                "company_id": company_id,
                "tier_id": tier_id,
                "payment_reference": payment_reference
            }
        )

    async def activate_subscription(
        self,
        subscription_id: str,
        payment_reference: str
    ) -> dict:
        """
        Activate a subscription after payment.

        Args:
            subscription_id: Subscription ID
            payment_reference: Payment reference from gateway

        Returns:
            Updated subscription
        """
        return await self._request(
            "POST",
            f"/subscriptions/{subscription_id}/activate",
            json={"payment_reference": payment_reference}
        )

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
            immediate: Cancel immediately or at period end

        Returns:
            Cancellation confirmation
        """
        return await self._request(
            "POST",
            f"/subscriptions/{subscription_id}/cancel",
            json={"reason": reason, "immediate": immediate}
        )

    # ═══════════════════════════════════════════════════════════════════
    # CRM ENDPOINTS (for external customers)
    # ═══════════════════════════════════════════════════════════════════

    async def create_crm_contact(
        self,
        name: str,
        email: str,
        company: Optional[str] = None,
        phone: Optional[str] = None,
        company_id: str = None
    ) -> dict:
        """
        Create CRM contact for external customer.
        Used for billing/invoicing integration.
        All external customers are created under BHM001.

        Args:
            name: Contact full name
            email: Contact email
            company: Company/organization name
            phone: Phone number
            company_id: Company ID (default: BHM001)

        Returns:
            Created contact details
        """
        # Parse name into first/last
        name_parts = name.split() if name else [""]
        first_name = name_parts[0]
        last_name = " ".join(name_parts[1:]) if len(name_parts) > 1 else ""

        # Use /api/sales/crm/contacts endpoint (not /api/v1)
        async with httpx.AsyncClient(timeout=30.0) as client:
            headers = {
                "Authorization": f"Bearer {self.api_key}" if self.api_key else "",
                "X-Source": "workspace-external",
                "Content-Type": "application/json"
            }
            response = await client.post(
                f"{self.base_url}/api/sales/crm/contacts",
                headers=headers,
                json={
                    "first_name": first_name,
                    "last_name": last_name,
                    "email": email,
                    "company_name": company,
                    "phone": phone,
                    "contact_type": "CUSTOMER",
                    "source": "WORKSPACE",
                    "company_id": company_id or settings.BHEEMVERSE_PARENT_COMPANY_ID
                }
            )
            response.raise_for_status()
            return response.json()

    async def get_crm_contact(self, contact_id: str) -> Optional[dict]:
        """
        Get CRM contact by ID.

        Args:
            contact_id: CRM contact ID

        Returns:
            Contact details or None
        """
        try:
            return await self._request("GET", f"/crm/contacts/{contact_id}")
        except httpx.HTTPStatusError as e:
            if e.response.status_code == 404:
                return None
            raise

    async def get_crm_contact_by_email(
        self,
        email: str,
        company_id: str = None
    ) -> Optional[dict]:
        """
        Find CRM contact by email.

        Args:
            email: Contact email
            company_id: Filter by company

        Returns:
            Contact details or None
        """
        params = {"email": email}
        if company_id:
            params["company_id"] = company_id

        try:
            result = await self._request("GET", "/crm/contacts/search", params=params)
            contacts = result.get("items", [])
            return contacts[0] if contacts else None
        except httpx.HTTPStatusError as e:
            if e.response.status_code == 404:
                return None
            raise

    async def update_crm_contact(
        self,
        contact_id: str,
        **updates
    ) -> dict:
        """
        Update CRM contact.

        Args:
            contact_id: Contact ID
            **updates: Fields to update

        Returns:
            Updated contact
        """
        return await self._request(
            "PATCH",
            f"/crm/contacts/{contact_id}",
            json=updates
        )

    async def create_crm_lead(
        self,
        name: str,
        email: str,
        company_name: Optional[str] = None,
        phone: Optional[str] = None,
        source: str = "WORKSPACE",
        company_id: str = None,
        notes: Optional[str] = None,
        **kwargs
    ) -> dict:
        """
        Create a CRM lead for external customer tracking.
        Used when external customers sign up for workspace.

        Args:
            name: Lead/contact full name
            email: Lead email
            company_name: Company/organization name
            phone: Phone number
            source: Lead source (WORKSPACE, WEBSITE, REFERRAL, etc.)
            company_id: Company ID (default: BHM001 - Bheemverse)
            notes: Additional notes

        Returns:
            Created lead details with id
        """
        # Parse name into first/last
        name_parts = name.split() if name else [""]
        first_name = name_parts[0]
        last_name = " ".join(name_parts[1:]) if len(name_parts) > 1 else ""

        payload = {
            "first_name": first_name,
            "last_name": last_name,
            "email": email,
            "company_name": company_name,
            "phone": phone,
            "source": source,
            "status": "NEW",
            "company_id": company_id or settings.BHEEMVERSE_PARENT_COMPANY_ID,
            "lead_type": "WORKSPACE_CUSTOMER"
        }

        if notes:
            payload["notes"] = notes

        payload.update(kwargs)

        try:
            return await self._request(
                "POST",
                "/crm/leads/",
                source="external",
                json=payload
            )
        except httpx.HTTPStatusError as e:
            logger.error(f"Failed to create CRM lead: {e}")
            # Return a minimal response so signup can continue
            return {"id": None, "error": str(e)}

    async def get_crm_lead(self, lead_id: str) -> Optional[dict]:
        """Get CRM lead by ID."""
        try:
            return await self._request(
                "GET",
                f"/crm/leads/{lead_id}",
                source="external"
            )
        except httpx.HTTPStatusError as e:
            if e.response.status_code == 404:
                return None
            raise

    async def update_crm_lead(
        self,
        lead_id: str,
        status: Optional[str] = None,
        **updates
    ) -> dict:
        """
        Update CRM lead status or details.

        Args:
            lead_id: Lead ID
            status: New status (NEW, CONTACTED, QUALIFIED, CONVERTED, LOST)
            **updates: Other fields to update

        Returns:
            Updated lead
        """
        payload = {}
        if status:
            payload["status"] = status
        payload.update(updates)

        return await self._request(
            "PATCH",
            f"/crm/leads/{lead_id}",
            source="external",
            json=payload
        )

    async def convert_lead_to_customer(self, lead_id: str) -> dict:
        """
        Convert a CRM lead to a customer (when they purchase).

        Args:
            lead_id: Lead ID to convert

        Returns:
            Conversion result with customer_id
        """
        return await self._request(
            "POST",
            f"/crm/leads/{lead_id}/convert",
            source="external"
        )

    # ═══════════════════════════════════════════════════════════════════
    # AUTH / USER ENDPOINTS (for syncing users to ERP)
    # ═══════════════════════════════════════════════════════════════════

    async def create_erp_user(
        self,
        email: str,
        name: str,
        password: Optional[str] = None,
        role: str = "Customer",
        company_id: str = None,
        company_code: str = None,
        passport_user_id: Optional[str] = None,
        metadata: Optional[dict] = None
    ) -> dict:
        """
        Create a user in ERP auth system.
        Syncs user credentials from Bheem Passport to ERP.

        Args:
            email: User email (used as username)
            name: User full name
            password: User password (if creating new, otherwise synced from Passport)
            role: User role (Customer, Employee, Admin)
            company_id: Company UUID
            company_code: Company code (e.g., BHM001)
            passport_user_id: Bheem Passport user ID for linking
            metadata: Additional metadata

        Returns:
            Created user details with id
        """
        # Parse name
        name_parts = name.split() if name else [""]
        first_name = name_parts[0]
        last_name = " ".join(name_parts[1:]) if len(name_parts) > 1 else ""

        payload = {
            "username": email,
            "email": email,
            "first_name": first_name,
            "last_name": last_name,
            "role": role,
            "company_id": company_id or settings.BHEEMVERSE_PARENT_COMPANY_ID,
            "company_code": company_code or settings.BHEEMVERSE_PARENT_COMPANY_CODE,
            "is_active": True,
            "source": "WORKSPACE"
        }

        if password:
            payload["password"] = password
        if passport_user_id:
            payload["passport_user_id"] = passport_user_id
            payload["auth_provider"] = "bheem_passport"
        if metadata:
            payload["metadata"] = metadata

        try:
            return await self._request(
                "POST",
                "/auth/users/",
                source="external",
                json=payload
            )
        except httpx.HTTPStatusError as e:
            logger.error(f"Failed to create ERP user: {e}")
            # Check if user already exists
            if e.response.status_code == 409:
                # Try to get existing user
                existing = await self.get_user_by_email(email)
                if existing:
                    return existing
            return {"id": None, "error": str(e)}

    async def sync_user_from_passport(
        self,
        passport_user_id: str,
        email: str,
        name: str,
        role: str = "Customer",
        company_id: str = None
    ) -> dict:
        """
        Sync/link a Bheem Passport user to ERP.
        Creates ERP user record linked to Passport for SSO.

        Args:
            passport_user_id: Bheem Passport user ID
            email: User email
            name: User full name
            role: User role
            company_id: Company UUID

        Returns:
            Synced user details
        """
        # Check if user already exists in ERP
        existing_user = await self.get_user_by_email(email)
        if existing_user:
            # Update with Passport link if not already linked
            if not existing_user.get("passport_user_id"):
                return await self._request(
                    "PATCH",
                    f"/auth/users/{existing_user['id']}",
                    source="external",
                    json={
                        "passport_user_id": passport_user_id,
                        "auth_provider": "bheem_passport"
                    }
                )
            return existing_user

        # Create new user linked to Passport
        return await self.create_erp_user(
            email=email,
            name=name,
            role=role,
            company_id=company_id,
            passport_user_id=passport_user_id
        )

    # ═══════════════════════════════════════════════════════════════════
    # HR ENDPOINTS (for internal mode - employee sync)
    # ═══════════════════════════════════════════════════════════════════

    async def get_employees(
        self,
        company_id: str,
        status: str = "ACTIVE",
        limit: int = 100
    ) -> list:
        """
        Get employees from ERP HR module.

        Args:
            company_id: Company UUID
            status: Employee status filter
            limit: Maximum results

        Returns:
            List of employees
        """
        result = await self._request(
            "GET",
            "/hr/employees",
            source="internal",
            params={
                "company_id": company_id,
                "status": status,
                "limit": limit
            }
        )
        return result.get("items", [])

    async def get_employee(self, employee_id: str) -> Optional[dict]:
        """
        Get employee details from ERP.

        Args:
            employee_id: Employee ID

        Returns:
            Employee details or None
        """
        try:
            return await self._request(
                "GET",
                f"/hr/employees/{employee_id}",
                source="internal"
            )
        except httpx.HTTPStatusError as e:
            if e.response.status_code == 404:
                return None
            raise

    async def get_departments(self, company_id: str) -> list:
        """
        Get departments for a company.

        Args:
            company_id: Company UUID

        Returns:
            List of departments
        """
        result = await self._request(
            "GET",
            "/hr/departments",
            source="internal",
            params={"company_id": company_id}
        )
        return result.get("items", [])

    async def create_employee(
        self,
        user_id: str,
        company_id: str,
        first_name: str,
        last_name: str,
        email: str,
        employee_code: Optional[str] = None,
        job_title: str = "Customer",
        department_id: Optional[str] = None,
        phone: Optional[str] = None,
        personal_email: Optional[str] = None,
        employment_type: str = "EXTERNAL",
        metadata: Optional[dict] = None
    ) -> dict:
        """
        Create an employee record in ERP HR module.
        Used for external customers who need to be tracked as employees.

        Args:
            user_id: ERP user ID (from create_erp_user)
            company_id: Company UUID
            first_name: Employee first name
            last_name: Employee last name
            email: Work email
            employee_code: Optional employee code (auto-generated if not provided)
            job_title: Job title (default: Customer)
            department_id: Department ID
            phone: Phone number
            personal_email: Personal email for notifications
            employment_type: INTERNAL, EXTERNAL, CONTRACTOR
            metadata: Additional metadata

        Returns:
            Created employee record with id
        """
        payload = {
            "user_id": user_id,
            "company_id": company_id or settings.BHEEMVERSE_PARENT_COMPANY_ID,
            "first_name": first_name,
            "last_name": last_name,
            "work_email": email,
            "job_title": job_title,
            "employment_type": employment_type,
            "status": "ACTIVE",
            "source": "WORKSPACE"
        }

        if employee_code:
            payload["employee_code"] = employee_code
        if department_id:
            payload["department_id"] = department_id
        if phone:
            payload["phone"] = phone
        if personal_email:
            payload["personal_email"] = personal_email
        if metadata:
            payload["metadata"] = metadata

        try:
            return await self._request(
                "POST",
                "/hr/employees/",
                source="external",
                json=payload
            )
        except httpx.HTTPStatusError as e:
            logger.error(f"Failed to create employee: {e}")
            # Check if employee already exists
            if e.response.status_code == 409:
                # Try to find by email
                employees = await self.get_employees(company_id, status="ACTIVE")
                for emp in employees:
                    if emp.get("work_email") == email:
                        return emp
            return {"id": None, "error": str(e)}

    async def update_employee(
        self,
        employee_id: str,
        **updates
    ) -> dict:
        """
        Update employee record.

        Args:
            employee_id: Employee ID
            **updates: Fields to update

        Returns:
            Updated employee
        """
        return await self._request(
            "PATCH",
            f"/hr/employees/{employee_id}",
            source="external",
            json=updates
        )

    # ═══════════════════════════════════════════════════════════════════
    # PROJECT MANAGEMENT ENDPOINTS (for internal mode - project sync)
    # ═══════════════════════════════════════════════════════════════════

    async def get_projects(
        self,
        company_id: str,
        status: str = "active",
        limit: int = 100
    ) -> list:
        """
        Get projects from ERP PM module.

        Args:
            company_id: Company UUID
            status: Project status filter
            limit: Maximum results

        Returns:
            List of projects
        """
        result = await self._request(
            "GET",
            "/projects",
            source="internal",
            params={
                "company_id": company_id,
                "status": status,
                "limit": limit
            }
        )
        return result.get("items", [])

    async def get_project(self, project_id: str) -> Optional[dict]:
        """
        Get project details.

        Args:
            project_id: Project ID

        Returns:
            Project details or None
        """
        try:
            return await self._request(
                "GET",
                f"/projects/{project_id}",
                source="internal"
            )
        except httpx.HTTPStatusError as e:
            if e.response.status_code == 404:
                return None
            raise

    async def get_project_team(self, project_id: str) -> list:
        """
        Get project team members.

        Args:
            project_id: Project ID

        Returns:
            List of team members
        """
        result = await self._request(
            "GET",
            f"/projects/{project_id}/team",
            source="internal"
        )
        return result.get("members", [])

    async def get_project_tasks(
        self,
        project_id: str,
        status: Optional[str] = None,
        assigned_to: Optional[str] = None,
        limit: int = 100
    ) -> list:
        """
        Get tasks for a project.

        Args:
            project_id: Project UUID
            status: Filter by status (TODO, IN_PROGRESS, UNDER_REVIEW, COMPLETED)
            assigned_to: Filter by assignee employee ID
            limit: Maximum results

        Returns:
            List of tasks
        """
        params = {"limit": limit}
        if status:
            params["status"] = status
        if assigned_to:
            params["assigned_to"] = assigned_to

        result = await self._request(
            "GET",
            f"/project-management/projects/{project_id}/tasks",
            source="pm",
            params=params
        )
        return result.get("tasks", result.get("items", []))

    async def get_task(self, task_id: str) -> Optional[dict]:
        """
        Get task details.

        Args:
            task_id: Task UUID

        Returns:
            Task details or None
        """
        try:
            return await self._request(
                "GET",
                f"/project-management/tasks/{task_id}",
                source="pm"
            )
        except httpx.HTTPStatusError as e:
            if e.response.status_code == 404:
                return None
            raise

    async def get_my_tasks(
        self,
        employee_id: str,
        status: Optional[str] = None,
        limit: int = 100
    ) -> list:
        """
        Get tasks assigned to an employee.

        Args:
            employee_id: Employee UUID
            status: Filter by status
            limit: Maximum results

        Returns:
            List of tasks
        """
        params = {"assigned_to": employee_id, "limit": limit}
        if status:
            params["status"] = status

        try:
            result = await self._request(
                "GET",
                "/project-management/tasks",
                source="pm",
                params=params
            )
            return result.get("tasks", result.get("items", []))
        except Exception:
            return []

    async def update_task_status(
        self,
        task_id: str,
        status: str,
        completion_percentage: Optional[int] = None
    ) -> dict:
        """
        Update task status.

        Args:
            task_id: Task UUID
            status: New status (TODO, IN_PROGRESS, UNDER_REVIEW, COMPLETED)
            completion_percentage: Optional completion percentage (0-100)

        Returns:
            Updated task
        """
        payload = {"status": status}
        if completion_percentage is not None:
            payload["completion_percentage"] = completion_percentage

        return await self._request(
            "PATCH",
            f"/project-management/tasks/{task_id}",
            source="pm",
            json=payload
        )

    async def get_project_milestones(self, project_id: str) -> list:
        """
        Get milestones for a project.

        Args:
            project_id: Project UUID

        Returns:
            List of milestones
        """
        result = await self._request(
            "GET",
            f"/project-management/projects/{project_id}/milestones",
            source="pm"
        )
        return result.get("milestones", result.get("items", []))

    async def get_project_phases(self, project_id: str) -> list:
        """
        Get phases for a project.

        Args:
            project_id: Project UUID

        Returns:
            List of phases
        """
        result = await self._request(
            "GET",
            f"/project-management/projects/{project_id}/phases",
            source="pm"
        )
        return result.get("phases", result.get("items", []))

    async def log_time(
        self,
        task_id: str,
        employee_id: str,
        hours: float,
        description: Optional[str] = None,
        log_date: Optional[str] = None
    ) -> dict:
        """
        Log time against a task.

        Args:
            task_id: Task UUID
            employee_id: Employee UUID
            hours: Hours worked
            description: Work description
            log_date: Date of work (ISO format, defaults to today)

        Returns:
            Created time log
        """
        from datetime import date
        payload = {
            "task_id": task_id,
            "employee_id": employee_id,
            "hours": hours,
            "log_date": log_date or date.today().isoformat()
        }
        if description:
            payload["description"] = description

        return await self._request(
            "POST",
            "/project-management/time-logs",
            source="pm",
            json=payload
        )

    async def get_task_time_logs(self, task_id: str) -> list:
        """
        Get time logs for a task.

        Args:
            task_id: Task UUID

        Returns:
            List of time logs
        """
        result = await self._request(
            "GET",
            f"/project-management/tasks/{task_id}/time-logs",
            source="pm"
        )
        return result.get("time_logs", result.get("items", []))

    async def add_task_comment(
        self,
        task_id: str,
        user_id: str,
        content: str
    ) -> dict:
        """
        Add a comment to a task.

        Args:
            task_id: Task UUID
            user_id: User UUID
            content: Comment text

        Returns:
            Created comment
        """
        return await self._request(
            "POST",
            f"/project-management/tasks/{task_id}/comments",
            source="pm",
            json={"user_id": user_id, "content": content}
        )

    async def get_task_comments(self, task_id: str) -> list:
        """
        Get comments for a task.

        Args:
            task_id: Task UUID

        Returns:
            List of comments
        """
        result = await self._request(
            "GET",
            f"/project-management/tasks/{task_id}/comments",
            source="pm"
        )
        return result.get("comments", result.get("items", []))

    async def get_pm_dashboard(
        self,
        company_id: Optional[str] = None,
        employee_id: Optional[str] = None
    ) -> dict:
        """
        Get PM dashboard summary.

        Args:
            company_id: Filter by company
            employee_id: Filter by employee (for personal dashboard)

        Returns:
            Dashboard data with project/task counts and stats
        """
        params = {}
        if company_id:
            params["company_id"] = company_id
        if employee_id:
            params["employee_id"] = employee_id

        try:
            return await self._request(
                "GET",
                "/project-management/dashboard",
                source="pm",
                params=params
            )
        except Exception:
            # Return empty dashboard on error
            return {
                "total_projects": 0,
                "active_projects": 0,
                "total_tasks": 0,
                "tasks_by_status": {},
                "my_tasks": 0,
                "overdue_tasks": 0
            }

    # ═══════════════════════════════════════════════════════════════════
    # COMPANY ENDPOINTS
    # ═══════════════════════════════════════════════════════════════════

    async def get_company(self, company_id: str) -> Optional[dict]:
        """
        Get company details from ERP.

        Args:
            company_id: Company UUID

        Returns:
            Company details or None
        """
        try:
            return await self._request("GET", f"/companies/{company_id}")
        except httpx.HTTPStatusError as e:
            if e.response.status_code == 404:
                return None
            raise

    async def get_company_by_code(self, company_code: str) -> Optional[dict]:
        """
        Get company by code (e.g., BHM001).

        Args:
            company_code: Company code

        Returns:
            Company details or None
        """
        try:
            result = await self._request(
                "GET",
                "/companies/search",
                params={"code": company_code}
            )
            companies = result.get("items", [])
            return companies[0] if companies else None
        except httpx.HTTPStatusError as e:
            if e.response.status_code == 404:
                return None
            raise

    # ═══════════════════════════════════════════════════════════════════
    # USER ENDPOINTS
    # ═══════════════════════════════════════════════════════════════════

    async def get_user(self, user_id: str) -> Optional[dict]:
        """
        Get auth user from ERP.

        Args:
            user_id: User ID

        Returns:
            User details or None
        """
        try:
            return await self._request("GET", f"/users/{user_id}")
        except httpx.HTTPStatusError as e:
            if e.response.status_code == 404:
                return None
            raise

    async def get_user_by_email(self, email: str) -> Optional[dict]:
        """
        Find user by email.

        Args:
            email: User email

        Returns:
            User details or None
        """
        try:
            result = await self._request(
                "GET",
                "/users/search",
                params={"email": email}
            )
            users = result.get("items", [])
            return users[0] if users else None
        except httpx.HTTPStatusError as e:
            if e.response.status_code == 404:
                return None
            raise

    # ═══════════════════════════════════════════════════════════════════
    # CREDITS ENDPOINTS
    # ═══════════════════════════════════════════════════════════════════

    async def get_user_credits(self, user_id: str) -> dict:
        """
        Get user's credit balance.

        Args:
            user_id: User ID

        Returns:
            Credit balance info
        """
        try:
            return await self._request("GET", f"/credits/balance/{user_id}")
        except httpx.HTTPStatusError as e:
            if e.response.status_code == 404:
                return {"balance": 0, "currency": "credits"}
            raise

    async def add_credits(
        self,
        user_id: str,
        amount: int,
        reason: str,
        reference: Optional[str] = None
    ) -> dict:
        """
        Add credits to user account.

        Args:
            user_id: User ID
            amount: Credits to add
            reason: Reason for credit addition
            reference: Optional reference (e.g., subscription ID)

        Returns:
            Updated balance
        """
        return await self._request(
            "POST",
            "/credits/add",
            json={
                "user_id": user_id,
                "amount": amount,
                "reason": reason,
                "reference": reference
            }
        )

    # ═══════════════════════════════════════════════════════════════════
    # WORKFLOW & APPROVAL ENDPOINTS (for Document Workflows)
    # ═══════════════════════════════════════════════════════════════════

    async def submit_for_approval(
        self,
        company_id: str,
        document_type: str,
        document_id: str,
        document_number: str,
        requested_by: str,
        amount: Optional[float] = None,
        notes: Optional[str] = None
    ) -> dict:
        """
        Submit a document for approval using ERP workflow system.

        Args:
            company_id: Company UUID
            document_type: Type (DOCUMENT, INVOICE, PO, etc.)
            document_id: Document UUID
            document_number: Document reference number
            requested_by: User ID submitting
            amount: Amount for threshold-based routing
            notes: Submission notes

        Returns:
            Created approval request
        """
        return await self._request(
            "POST",
            "/approvals/requests",
            source="docs",
            json={
                "company_id": company_id,
                "document_type": document_type,
                "document_id": document_id,
                "document_number": document_number,
                "requested_by": requested_by,
                "amount": amount,
                "notes": notes
            }
        )

    async def get_approval_request(self, request_id: str) -> Optional[dict]:
        """
        Get approval request details.

        Args:
            request_id: Approval request UUID

        Returns:
            Approval request with history
        """
        try:
            return await self._request(
                "GET",
                f"/approvals/requests/{request_id}",
                source="docs"
            )
        except httpx.HTTPStatusError as e:
            if e.response.status_code == 404:
                return None
            raise

    async def get_pending_approvals(
        self,
        user_id: str,
        company_id: Optional[str] = None,
        document_type: Optional[str] = None,
        limit: int = 50
    ) -> list:
        """
        Get documents pending user's approval.

        Args:
            user_id: Approver user ID
            company_id: Filter by company
            document_type: Filter by type
            limit: Max results

        Returns:
            List of pending approval requests
        """
        params = {"approver_id": user_id, "limit": limit}
        if company_id:
            params["company_id"] = company_id
        if document_type:
            params["document_type"] = document_type

        result = await self._request(
            "GET",
            "/approvals/pending",
            source="docs",
            params=params
        )
        return result.get("items", [])

    async def approve_document(
        self,
        request_id: str,
        approver_id: str,
        comments: Optional[str] = None
    ) -> dict:
        """
        Approve a document.

        Args:
            request_id: Approval request UUID
            approver_id: Approving user ID
            comments: Approval comments

        Returns:
            Updated approval status
        """
        return await self._request(
            "POST",
            f"/approvals/requests/{request_id}/approve",
            source="docs",
            json={
                "approver_id": approver_id,
                "comments": comments
            }
        )

    async def reject_document(
        self,
        request_id: str,
        approver_id: str,
        comments: str
    ) -> dict:
        """
        Reject a document.

        Args:
            request_id: Approval request UUID
            approver_id: Rejecting user ID
            comments: Rejection reason (required)

        Returns:
            Updated approval status
        """
        return await self._request(
            "POST",
            f"/approvals/requests/{request_id}/reject",
            source="docs",
            json={
                "approver_id": approver_id,
                "comments": comments
            }
        )

    async def get_approval_history(
        self,
        document_id: str,
        document_type: str = "DOCUMENT"
    ) -> list:
        """
        Get approval history for a document.

        Args:
            document_id: Document UUID
            document_type: Document type

        Returns:
            List of approval actions
        """
        result = await self._request(
            "GET",
            "/approvals/history",
            source="docs",
            params={
                "document_id": document_id,
                "document_type": document_type
            }
        )
        return result.get("items", [])

    async def get_workflow_definition(
        self,
        workflow_code: str
    ) -> Optional[dict]:
        """
        Get workflow definition by code.

        Args:
            workflow_code: Workflow code (e.g., DOC_APPROVAL)

        Returns:
            Workflow definition with states and transitions
        """
        try:
            return await self._request(
                "GET",
                f"/workflows/definitions/{workflow_code}",
                source="docs"
            )
        except httpx.HTTPStatusError as e:
            if e.response.status_code == 404:
                return None
            raise

    async def create_workflow_instance(
        self,
        workflow_code: str,
        entity_type: str,
        entity_id: str,
        created_by: str,
        initial_data: Optional[dict] = None
    ) -> dict:
        """
        Create a workflow instance for an entity.

        Args:
            workflow_code: Workflow definition code
            entity_type: Entity type (DOCUMENT, etc.)
            entity_id: Entity UUID
            created_by: Creating user ID
            initial_data: Initial workflow data

        Returns:
            Created workflow instance
        """
        return await self._request(
            "POST",
            "/workflows/instances",
            source="docs",
            json={
                "workflow_code": workflow_code,
                "entity_type": entity_type,
                "entity_id": entity_id,
                "created_by": created_by,
                "initial_data": initial_data or {}
            }
        )

    async def transition_workflow(
        self,
        instance_id: str,
        to_state: str,
        transitioned_by: str,
        notes: Optional[str] = None
    ) -> dict:
        """
        Transition workflow to a new state.

        Args:
            instance_id: Workflow instance UUID
            to_state: Target state
            transitioned_by: User performing transition
            notes: Transition notes

        Returns:
            Updated workflow instance
        """
        return await self._request(
            "POST",
            f"/workflows/instances/{instance_id}/transition",
            source="docs",
            json={
                "to_state": to_state,
                "transitioned_by": transitioned_by,
                "notes": notes
            }
        )

    async def get_workflow_instance(
        self,
        entity_type: str,
        entity_id: str
    ) -> Optional[dict]:
        """
        Get workflow instance for an entity.

        Args:
            entity_type: Entity type
            entity_id: Entity UUID

        Returns:
            Workflow instance with transitions
        """
        try:
            return await self._request(
                "GET",
                "/workflows/instances/by-entity",
                source="docs",
                params={
                    "entity_type": entity_type,
                    "entity_id": entity_id
                }
            )
        except httpx.HTTPStatusError as e:
            if e.response.status_code == 404:
                return None
            raise


    # ═══════════════════════════════════════════════════════════════════
    # CALENDAR / PROJECT MANAGEMENT ENDPOINTS
    # ═══════════════════════════════════════════════════════════════════

    async def get_calendar_events(
        self,
        user_id: str,
        start: str,
        end: str,
        project_id: Optional[str] = None
    ) -> list:
        """
        Get calendar events from ERP Project Management.

        Args:
            user_id: User ID for filtering
            start: Start date ISO format
            end: End date ISO format
            project_id: Optional project filter

        Returns:
            List of calendar events
        """
        params = {
            "start_date": start,
            "end_date": end
        }
        if project_id:
            params["project_id"] = project_id

        try:
            result = await self._request(
                "GET",
                "/project-management/calendar/events",
                source="calendar",
                params=params
            )
            return result.get("events", result.get("items", []))
        except Exception as e:
            # Return empty list if ERP is unavailable
            print(f"ERP calendar fetch failed: {e}")
            return []

    async def get_calendar_event(self, event_id: str) -> Optional[dict]:
        """
        Get single calendar event from ERP.

        Args:
            event_id: Event UUID

        Returns:
            Event details or None
        """
        try:
            return await self._request(
                "GET",
                f"/project-management/calendar/events/{event_id}",
                source="calendar"
            )
        except httpx.HTTPStatusError as e:
            if e.response.status_code == 404:
                return None
            raise

    async def create_calendar_event(
        self,
        title: str,
        start: str,
        end: str,
        description: Optional[str] = None,
        location: Optional[str] = None,
        project_id: Optional[str] = None,
        task_id: Optional[str] = None,
        attendees: Optional[list] = None,
        event_type: str = "meeting",
        all_day: bool = False,
        created_by: Optional[str] = None
    ) -> dict:
        """
        Create calendar event in ERP Project Management.

        Args:
            title: Event title
            start: Start datetime ISO format
            end: End datetime ISO format
            description: Event description
            location: Event location
            project_id: Link to project (optional)
            task_id: Link to task (optional)
            attendees: List of attendee user IDs
            event_type: meeting, task, milestone, reminder
            all_day: Is all-day event
            created_by: Creator user ID

        Returns:
            Created event details
        """
        payload = {
            "title": title,
            "start_time": start,
            "end_time": end,
            "description": description or "",
            "location": location or "",
            "event_type": event_type,
            "is_all_day": all_day,
            "attendees": attendees or []
        }

        if project_id:
            payload["project_id"] = project_id
        if task_id:
            payload["task_id"] = task_id
        if created_by:
            payload["created_by"] = created_by

        return await self._request(
            "POST",
            "/project-management/calendar/events",
            source="calendar",
            json=payload
        )

    async def update_calendar_event(
        self,
        event_id: str,
        **updates
    ) -> dict:
        """
        Update calendar event in ERP.

        Args:
            event_id: Event UUID
            **updates: Fields to update

        Returns:
            Updated event
        """
        # Map frontend field names to ERP field names
        field_mapping = {
            "start": "start_time",
            "end": "end_time",
            "all_day": "is_all_day"
        }

        payload = {}
        for key, value in updates.items():
            mapped_key = field_mapping.get(key, key)
            if value is not None:
                payload[mapped_key] = value

        return await self._request(
            "PUT",
            f"/project-management/calendar/events/{event_id}",
            source="calendar",
            json=payload
        )

    async def delete_calendar_event(self, event_id: str) -> dict:
        """
        Delete calendar event from ERP.

        Args:
            event_id: Event UUID

        Returns:
            Deletion confirmation
        """
        return await self._request(
            "DELETE",
            f"/project-management/calendar/events/{event_id}",
            source="calendar"
        )

    async def get_user_projects(self, user_id: str) -> list:
        """
        Get projects the user is a member of.

        Args:
            user_id: User ID

        Returns:
            List of projects
        """
        try:
            result = await self._request(
                "GET",
                "/project-management/projects",
                source="calendar",
                params={"member_id": user_id, "status": "active"}
            )
            return result.get("projects", result.get("items", []))
        except Exception:
            return []

    # =========================================================================
    # SALES MODULE - Orders, Invoices, Quotes, Customers
    # =========================================================================

    async def get_sales_customers(
        self,
        company_id: Optional[str] = None,
        skip: int = 0,
        limit: int = 100
    ) -> list:
        """
        Get sales customers from ERP.

        Args:
            company_id: Optional company filter
            skip: Pagination offset
            limit: Page size

        Returns:
            List of customers
        """
        params = {"skip": skip, "limit": limit}
        if company_id:
            params["company_id"] = company_id

        result = await self._request(
            "GET",
            "/sales/customers/",
            source="sales",
            params=params
        )
        return result.get("items", result.get("customers", []))

    async def get_sales_customer(self, customer_id: str) -> Optional[dict]:
        """Get single sales customer by ID."""
        try:
            return await self._request(
                "GET",
                f"/sales/customers/{customer_id}",
                source="sales"
            )
        except httpx.HTTPStatusError as e:
            if e.response.status_code == 404:
                return None
            raise

    async def create_sales_customer(
        self,
        name: str,
        email: str,
        company_id: str,
        phone: Optional[str] = None,
        address: Optional[dict] = None,
        tax_id: Optional[str] = None,
        payment_terms: int = 30,
        credit_limit: Optional[float] = None,
        **kwargs
    ) -> dict:
        """
        Create a sales customer in ERP.

        Args:
            name: Customer name
            email: Customer email
            company_id: Company ID
            phone: Phone number
            address: Address dict with street, city, state, country, postal_code
            tax_id: Tax identification number
            payment_terms: Payment terms in days
            credit_limit: Credit limit amount

        Returns:
            Created customer
        """
        payload = {
            "name": name,
            "email": email,
            "company_id": company_id,
            "payment_terms_days": payment_terms,
        }

        if phone:
            payload["phone"] = phone
        if address:
            payload["billing_address"] = address
            payload["shipping_address"] = address
        if tax_id:
            payload["tax_id"] = tax_id
        if credit_limit:
            payload["credit_limit"] = credit_limit

        payload.update(kwargs)

        return await self._request(
            "POST",
            "/sales/customers/",
            source="sales",
            json=payload
        )

    async def create_sales_quote(
        self,
        customer_id: str,
        company_id: str,
        items: list,
        valid_until: Optional[str] = None,
        notes: Optional[str] = None,
        **kwargs
    ) -> dict:
        """
        Create a sales quote in ERP.

        Args:
            customer_id: Customer ID
            company_id: Company ID
            items: List of line items [{sku_id, quantity, unit_price}]
            valid_until: Quote validity date (ISO format)
            notes: Quote notes

        Returns:
            Created quote
        """
        payload = {
            "customer_id": customer_id,
            "company_id": company_id,
            "line_items": items,
        }

        if valid_until:
            payload["valid_until"] = valid_until
        if notes:
            payload["notes"] = notes

        payload.update(kwargs)

        return await self._request(
            "POST",
            "/sales/quotes/",
            source="sales",
            json=payload
        )

    async def get_sales_quote(self, quote_id: str) -> Optional[dict]:
        """Get single sales quote by ID."""
        try:
            return await self._request(
                "GET",
                f"/sales/quotes/{quote_id}",
                source="sales"
            )
        except httpx.HTTPStatusError as e:
            if e.response.status_code == 404:
                return None
            raise

    async def convert_quote_to_order(self, quote_id: str) -> dict:
        """Convert a quote to a sales order."""
        return await self._request(
            "POST",
            f"/sales/quotes/{quote_id}/convert-to-order",
            source="sales"
        )

    async def create_sales_order(
        self,
        customer_id: str,
        company_id: str,
        items: list,
        order_date: Optional[str] = None,
        delivery_date: Optional[str] = None,
        shipping_address: Optional[dict] = None,
        billing_address: Optional[dict] = None,
        notes: Optional[str] = None,
        reference: Optional[str] = None,
        **kwargs
    ) -> dict:
        """
        Create a sales order in ERP.

        Args:
            customer_id: Customer ID
            company_id: Company ID
            items: List of line items [{sku_id, quantity, unit_price, description}]
            order_date: Order date (ISO format)
            delivery_date: Expected delivery date
            shipping_address: Shipping address dict
            billing_address: Billing address dict
            notes: Order notes
            reference: External reference (e.g., payment reference)

        Returns:
            Created sales order
        """
        payload = {
            "customer_id": customer_id,
            "company_id": company_id,
            "line_items": items,
        }

        if order_date:
            payload["order_date"] = order_date
        if delivery_date:
            payload["delivery_date"] = delivery_date
        if shipping_address:
            payload["shipping_address"] = shipping_address
        if billing_address:
            payload["billing_address"] = billing_address
        if notes:
            payload["notes"] = notes
        if reference:
            payload["external_reference"] = reference

        payload.update(kwargs)

        return await self._request(
            "POST",
            "/sales/orders/",
            source="sales",
            json=payload
        )

    async def get_sales_order(self, order_id: str) -> Optional[dict]:
        """Get single sales order by ID."""
        try:
            return await self._request(
                "GET",
                f"/sales/orders/{order_id}",
                source="sales"
            )
        except httpx.HTTPStatusError as e:
            if e.response.status_code == 404:
                return None
            raise

    async def get_sales_orders(
        self,
        customer_id: Optional[str] = None,
        company_id: Optional[str] = None,
        status: Optional[str] = None,
        skip: int = 0,
        limit: int = 100
    ) -> list:
        """Get sales orders with optional filters."""
        params = {"skip": skip, "limit": limit}
        if customer_id:
            params["customer_id"] = customer_id
        if company_id:
            params["company_id"] = company_id
        if status:
            params["status"] = status

        result = await self._request(
            "GET",
            "/sales/orders/",
            source="sales",
            params=params
        )
        return result.get("items", result.get("orders", []))

    async def confirm_sales_order(self, order_id: str) -> dict:
        """Confirm a sales order."""
        return await self._request(
            "POST",
            f"/sales/orders/{order_id}/confirm",
            source="sales"
        )

    async def cancel_sales_order(self, order_id: str, reason: Optional[str] = None) -> dict:
        """Cancel a sales order."""
        payload = {}
        if reason:
            payload["reason"] = reason

        return await self._request(
            "POST",
            f"/sales/orders/{order_id}/cancel",
            source="sales",
            json=payload if payload else None
        )

    async def create_sales_invoice(
        self,
        customer_id: str,
        company_id: str,
        items: list,
        sales_order_id: Optional[str] = None,
        invoice_date: Optional[str] = None,
        due_date: Optional[str] = None,
        payment_terms: int = 30,
        notes: Optional[str] = None,
        reference: Optional[str] = None,
        **kwargs
    ) -> dict:
        """
        Create a sales invoice in ERP.

        Args:
            customer_id: Customer ID
            company_id: Company ID
            items: List of line items [{sku_id, quantity, unit_price, description}]
            sales_order_id: Link to sales order
            invoice_date: Invoice date (ISO format)
            due_date: Due date (ISO format)
            payment_terms: Payment terms in days
            notes: Invoice notes
            reference: External reference (e.g., payment reference)

        Returns:
            Created invoice
        """
        payload = {
            "customer_id": customer_id,
            "company_id": company_id,
            "line_items": items,
            "payment_terms_days": payment_terms,
        }

        if sales_order_id:
            payload["sales_order_id"] = sales_order_id
        if invoice_date:
            payload["invoice_date"] = invoice_date
        if due_date:
            payload["due_date"] = due_date
        if notes:
            payload["notes"] = notes
        if reference:
            payload["external_reference"] = reference

        payload.update(kwargs)

        return await self._request(
            "POST",
            "/sales/invoices/",
            source="sales",
            json=payload
        )

    async def get_sales_invoice(self, invoice_id: str) -> Optional[dict]:
        """Get single sales invoice by ID."""
        try:
            return await self._request(
                "GET",
                f"/sales/invoices/{invoice_id}",
                source="sales"
            )
        except httpx.HTTPStatusError as e:
            if e.response.status_code == 404:
                return None
            raise

    async def get_sales_invoices(
        self,
        customer_id: Optional[str] = None,
        company_id: Optional[str] = None,
        status: Optional[str] = None,
        skip: int = 0,
        limit: int = 100
    ) -> list:
        """Get sales invoices with optional filters."""
        params = {"skip": skip, "limit": limit}
        if customer_id:
            params["customer_id"] = customer_id
        if company_id:
            params["company_id"] = company_id
        if status:
            params["status"] = status

        result = await self._request(
            "GET",
            "/sales/invoices/",
            source="sales",
            params=params
        )
        return result.get("items", result.get("invoices", []))

    async def issue_sales_invoice(self, invoice_id: str) -> dict:
        """Issue/finalize a sales invoice."""
        return await self._request(
            "POST",
            f"/sales/invoices/{invoice_id}/issue",
            source="sales"
        )

    async def mark_invoice_paid(
        self,
        invoice_id: str,
        payment_date: Optional[str] = None,
        payment_reference: Optional[str] = None,
        payment_method: Optional[str] = None
    ) -> dict:
        """Mark a sales invoice as paid."""
        payload = {}
        if payment_date:
            payload["payment_date"] = payment_date
        if payment_reference:
            payload["payment_reference"] = payment_reference
        if payment_method:
            payload["payment_method"] = payment_method

        return await self._request(
            "POST",
            f"/sales/invoices/{invoice_id}/mark-paid",
            source="sales",
            json=payload if payload else None
        )

    async def void_sales_invoice(self, invoice_id: str, reason: Optional[str] = None) -> dict:
        """Void a sales invoice."""
        payload = {}
        if reason:
            payload["reason"] = reason

        return await self._request(
            "POST",
            f"/sales/invoices/{invoice_id}/void",
            source="sales",
            json=payload if payload else None
        )

    async def get_invoice_pdf(self, invoice_id: str) -> bytes:
        """Get invoice PDF."""
        return await self._request(
            "GET",
            f"/sales/invoices/{invoice_id}/pdf",
            source="sales"
        )

    async def send_invoice_email(self, invoice_id: str, email: Optional[str] = None) -> dict:
        """Send invoice via email."""
        payload = {}
        if email:
            payload["email"] = email

        return await self._request(
            "POST",
            f"/sales/invoices/{invoice_id}/send",
            source="sales",
            json=payload if payload else None
        )

    async def create_sales_payment(
        self,
        invoice_id: str,
        amount: float,
        payment_method: str,
        payment_date: Optional[str] = None,
        reference: Optional[str] = None,
        notes: Optional[str] = None,
        **kwargs
    ) -> dict:
        """
        Record a payment against an invoice.

        Args:
            invoice_id: Invoice ID to pay
            amount: Payment amount
            payment_method: Payment method (bank_transfer, credit_card, etc.)
            payment_date: Payment date (ISO format)
            reference: Payment reference
            notes: Payment notes

        Returns:
            Created payment record
        """
        payload = {
            "invoice_id": invoice_id,
            "amount": amount,
            "payment_method": payment_method,
        }

        if payment_date:
            payload["payment_date"] = payment_date
        if reference:
            payload["reference"] = reference
        if notes:
            payload["notes"] = notes

        payload.update(kwargs)

        return await self._request(
            "POST",
            "/sales/payments/",
            source="sales",
            json=payload
        )

    async def get_sales_payments(
        self,
        invoice_id: Optional[str] = None,
        customer_id: Optional[str] = None,
        skip: int = 0,
        limit: int = 100
    ) -> list:
        """Get sales payments with optional filters."""
        params = {"skip": skip, "limit": limit}
        if invoice_id:
            params["invoice_id"] = invoice_id
        if customer_id:
            params["customer_id"] = customer_id

        result = await self._request(
            "GET",
            "/sales/payments/",
            source="sales",
            params=params
        )
        return result.get("items", result.get("payments", []))

    # =========================================================================
    # ACCOUNTING MODULE - Journal Entries, Accounts, Reports
    # =========================================================================

    async def get_chart_of_accounts(
        self,
        company_id: Optional[str] = None,
        account_type: Optional[str] = None,
        skip: int = 0,
        limit: int = 100
    ) -> list:
        """
        Get chart of accounts from ERP.

        Args:
            company_id: Optional company filter
            account_type: Filter by type (asset, liability, equity, revenue, expense)
            skip: Pagination offset
            limit: Page size

        Returns:
            List of accounts
        """
        params = {"skip": skip, "limit": limit}
        if company_id:
            params["company_id"] = company_id
        if account_type:
            params["account_type"] = account_type

        result = await self._request(
            "GET",
            "/accounting/accounts/",
            source="accounting",
            params=params
        )
        return result.get("items", result.get("accounts", []))

    async def get_account(self, account_id: str) -> Optional[dict]:
        """Get single account by ID."""
        try:
            return await self._request(
                "GET",
                f"/accounting/accounts/{account_id}",
                source="accounting"
            )
        except httpx.HTTPStatusError as e:
            if e.response.status_code == 404:
                return None
            raise

    async def find_account_by_code(
        self,
        company_id: str,
        account_code: str
    ) -> Optional[dict]:
        """
        Find an account by its code for a specific company.

        Args:
            company_id: Company UUID
            account_code: Account code (e.g., "1020", "4001")

        Returns:
            Account dict or None if not found
        """
        accounts = await self.get_chart_of_accounts(company_id=company_id, limit=500)
        for account in accounts:
            if account.get("code") == account_code or account.get("account_code") == account_code:
                return account
        return None

    async def find_accounts_by_type(
        self,
        company_id: str,
        account_type: str,
        name_contains: Optional[str] = None
    ) -> list:
        """
        Find accounts by type and optionally filter by name.

        Args:
            company_id: Company UUID
            account_type: Account type (asset, liability, equity, revenue, expense)
            name_contains: Optional name filter (case-insensitive)

        Returns:
            List of matching accounts
        """
        accounts = await self.get_chart_of_accounts(
            company_id=company_id,
            account_type=account_type,
            limit=500
        )
        if name_contains:
            name_lower = name_contains.lower()
            accounts = [
                a for a in accounts
                if name_lower in a.get("name", "").lower() or name_lower in a.get("account_name", "").lower()
            ]
        return accounts

    async def get_subscription_accounts(self, company_id: str) -> dict:
        """
        Get the standard accounts needed for subscription revenue entries.
        Finds Cash/Bank account (asset) and Subscription Revenue account (revenue).

        Args:
            company_id: Company UUID

        Returns:
            Dict with cash_account_id and revenue_account_id
        """
        result = {
            "cash_account_id": None,
            "cash_account_name": None,
            "revenue_account_id": None,
            "revenue_account_name": None
        }

        # Find Cash/Bank account (asset type, look for "cash" or "bank" in name)
        asset_accounts = await self.find_accounts_by_type(company_id, "asset")
        for account in asset_accounts:
            name = (account.get("name") or account.get("account_name") or "").lower()
            code = account.get("code") or account.get("account_code") or ""
            # Look for cash/bank accounts - typically codes starting with 10xx or 11xx
            if "cash" in name or "bank" in name or code.startswith("10") or code.startswith("11"):
                result["cash_account_id"] = account.get("id")
                result["cash_account_name"] = account.get("name") or account.get("account_name")
                break

        # Find Revenue account (revenue type, look for "subscription" or "revenue" in name)
        revenue_accounts = await self.find_accounts_by_type(company_id, "revenue")
        for account in revenue_accounts:
            name = (account.get("name") or account.get("account_name") or "").lower()
            code = account.get("code") or account.get("account_code") or ""
            # Prefer subscription-specific revenue, fallback to general revenue
            if "subscription" in name:
                result["revenue_account_id"] = account.get("id")
                result["revenue_account_name"] = account.get("name") or account.get("account_name")
                break
            elif "revenue" in name or "sales" in name or code.startswith("40"):
                # Store as fallback if no subscription-specific account found
                if not result["revenue_account_id"]:
                    result["revenue_account_id"] = account.get("id")
                    result["revenue_account_name"] = account.get("name") or account.get("account_name")

        return result

    async def create_journal_entry(
        self,
        company_id: str,
        entry_date: str,
        lines: list,
        description: Optional[str] = None,
        reference: Optional[str] = None,
        auto_post: bool = False,
        **kwargs
    ) -> dict:
        """
        Create a journal entry in ERP.

        Args:
            company_id: Company ID (UUID format)
            entry_date: Entry date (ISO format YYYY-MM-DD)
            lines: List of journal lines [{account_id, debit_amount, credit_amount, description}]
            description: Entry description
            reference: External reference
            auto_post: Whether to auto-post the entry

        Returns:
            Created journal entry
        """
        # Calculate totals from lines
        total_debit = sum(float(line.get("debit_amount", 0)) for line in lines)
        total_credit = sum(float(line.get("credit_amount", 0)) for line in lines)

        # Format lines for ERP API
        formatted_lines = []
        for line in lines:
            formatted_lines.append({
                "account_id": line["account_id"],
                "description": line.get("description", ""),
                "debit_amount": float(line.get("debit_amount", 0)),
                "credit_amount": float(line.get("credit_amount", 0)),
                "amount": float(line.get("debit_amount", 0)) or float(line.get("credit_amount", 0))
            })

        payload = {
            "company_id": company_id,
            "date": entry_date,
            "total_debit": total_debit,
            "total_credit": total_credit,
            "lines": formatted_lines,
        }

        if description:
            payload["description"] = description
        if reference:
            payload["reference"] = reference

        payload.update(kwargs)

        result = await self._request(
            "POST",
            "/accounting/journal-entries/journal-entries/",
            source="accounting",
            json=payload
        )

        # Auto-post if requested
        if auto_post and result.get("id"):
            try:
                await self.post_journal_entry(result["id"])
                result["status"] = "POSTED"
            except Exception as e:
                result["post_error"] = str(e)

        return result

    async def create_subscription_revenue_entry(
        self,
        company_id: str,
        amount: float,
        description: str,
        reference: str,
        cash_account_id: str,
        revenue_account_id: str,
        entry_date: Optional[str] = None,
        auto_post: bool = True
    ) -> dict:
        """
        Create a journal entry for subscription revenue.

        This creates a simple 2-line journal entry:
        - Debit: Cash/Bank (payment received)
        - Credit: Subscription Revenue

        Args:
            company_id: Company ID (UUID)
            amount: Total amount including tax
            description: Entry description (e.g., "Workspace Professional Subscription")
            reference: Payment reference (e.g., "WS-PAY-12345")
            cash_account_id: Cash/Bank account ID (fetched dynamically)
            revenue_account_id: Revenue account ID (fetched dynamically)
            entry_date: Entry date (defaults to today)
            auto_post: Whether to auto-post (default True)

        Returns:
            Created and posted journal entry
        """
        from datetime import date as date_type

        if not entry_date:
            entry_date = date_type.today().isoformat()

        lines = [
            {
                "account_id": cash_account_id,
                "description": f"Cash received via BheemPay - {reference}",
                "debit_amount": amount,
                "credit_amount": 0
            },
            {
                "account_id": revenue_account_id,
                "description": description,
                "debit_amount": 0,
                "credit_amount": amount
            }
        ]

        return await self.create_journal_entry(
            company_id=company_id,
            entry_date=entry_date,
            lines=lines,
            description=description,
            reference=reference,
            auto_post=auto_post
        )

    async def get_journal_entry(self, entry_id: str) -> Optional[dict]:
        """Get single journal entry by ID."""
        try:
            return await self._request(
                "GET",
                f"/accounting/journal-entries/journal-entries/{entry_id}",
                source="accounting"
            )
        except httpx.HTTPStatusError as e:
            if e.response.status_code == 404:
                return None
            raise

    async def get_journal_entries(
        self,
        company_id: Optional[str] = None,
        start_date: Optional[str] = None,
        end_date: Optional[str] = None,
        status: Optional[str] = None,
        skip: int = 0,
        limit: int = 100
    ) -> list:
        """Get journal entries with optional filters."""
        params = {"skip": skip, "limit": limit}
        if company_id:
            params["company_id"] = company_id
        if start_date:
            params["start_date"] = start_date
        if end_date:
            params["end_date"] = end_date
        if status:
            params["status"] = status

        result = await self._request(
            "GET",
            "/accounting/journal-entries/journal-entries/",
            source="accounting",
            params=params
        )
        return result.get("items", result.get("entries", []))

    async def post_journal_entry(self, entry_id: str) -> dict:
        """Post/finalize a journal entry."""
        return await self._request(
            "POST",
            f"/accounting/journal-entries/journal-entries/{entry_id}/post",
            source="accounting"
        )

    async def delete_journal_entry(self, entry_id: str) -> dict:
        """Delete a journal entry (only if not posted)."""
        return await self._request(
            "DELETE",
            f"/accounting/journal-entries/journal-entries/{entry_id}",
            source="accounting"
        )

    async def get_trial_balance(
        self,
        company_id: str,
        as_of_date: Optional[str] = None
    ) -> dict:
        """
        Get trial balance report.

        Args:
            company_id: Company ID
            as_of_date: Report date (ISO format)

        Returns:
            Trial balance data
        """
        params = {"company_id": company_id}
        if as_of_date:
            params["as_of_date"] = as_of_date

        return await self._request(
            "GET",
            "/accounting/reports/trial-balance",
            source="accounting",
            params=params
        )

    async def get_income_statement(
        self,
        company_id: str,
        start_date: str,
        end_date: str
    ) -> dict:
        """
        Get income statement (P&L) report.

        Args:
            company_id: Company ID
            start_date: Period start date
            end_date: Period end date

        Returns:
            Income statement data
        """
        return await self._request(
            "GET",
            "/accounting/reports/income-statement",
            source="accounting",
            params={
                "company_id": company_id,
                "start_date": start_date,
                "end_date": end_date
            }
        )

    async def get_balance_sheet(
        self,
        company_id: str,
        as_of_date: Optional[str] = None
    ) -> dict:
        """
        Get balance sheet report.

        Args:
            company_id: Company ID
            as_of_date: Report date

        Returns:
            Balance sheet data
        """
        params = {"company_id": company_id}
        if as_of_date:
            params["as_of_date"] = as_of_date

        return await self._request(
            "GET",
            "/accounting/reports/balance-sheet",
            source="accounting",
            params=params
        )

    async def get_cash_flow_report(
        self,
        company_id: str,
        start_date: str,
        end_date: str
    ) -> dict:
        """
        Get cash flow report.

        Args:
            company_id: Company ID
            start_date: Period start date
            end_date: Period end date

        Returns:
            Cash flow data
        """
        return await self._request(
            "GET",
            "/accounting/reports/cash-flow",
            source="accounting",
            params={
                "company_id": company_id,
                "start_date": start_date,
                "end_date": end_date
            }
        )

    async def get_accounting_dashboard(self, company_id: str) -> dict:
        """
        Get comprehensive accounting dashboard.

        Args:
            company_id: Company ID

        Returns:
            Dashboard metrics and charts
        """
        return await self._request(
            "GET",
            "/accounting/analytics/dashboard/comprehensive",
            source="accounting",
            params={"company_id": company_id}
        )

    # =========================================================================
    # AR/AP MODULE - Receivables, Payables, Bank
    # =========================================================================

    async def create_ar_invoice(
        self,
        customer_id: str,
        company_id: str,
        items: list,
        invoice_date: Optional[str] = None,
        due_date: Optional[str] = None,
        **kwargs
    ) -> dict:
        """
        Create an AR (Accounts Receivable) invoice.

        Args:
            customer_id: Customer ID
            company_id: Company ID
            items: List of line items
            invoice_date: Invoice date
            due_date: Due date

        Returns:
            Created AR invoice
        """
        payload = {
            "customer_id": customer_id,
            "company_id": company_id,
            "line_items": items,
        }

        if invoice_date:
            payload["invoice_date"] = invoice_date
        if due_date:
            payload["due_date"] = due_date

        payload.update(kwargs)

        return await self._request(
            "POST",
            "/accounting/ar-ap-bank/invoices",
            source="accounting",
            json=payload
        )

    async def post_ar_invoice(self, invoice_id: str) -> dict:
        """
        Post an AR invoice to accounting, creating journal entries.

        This creates the accounting entries:
        - Debit: Accounts Receivable
        - Credit: Revenue account
        - Credit: Tax Payable (if applicable)

        Args:
            invoice_id: AR Invoice ID to post

        Returns:
            Posted invoice with journal entry reference
        """
        return await self._request(
            "POST",
            f"/accounting/ar-ap-bank/invoices/{invoice_id}/post",
            source="accounting"
        )

    async def apply_ar_payment(
        self,
        payment_id: str,
        invoice_id: str,
        amount: Optional[float] = None
    ) -> dict:
        """
        Apply an AR payment to an invoice.

        This creates the accounting entries:
        - Debit: Cash/Bank
        - Credit: Accounts Receivable

        Args:
            payment_id: Payment ID
            invoice_id: Invoice ID to apply payment to
            amount: Amount to apply (defaults to full payment)

        Returns:
            Application result
        """
        payload = {"invoice_id": invoice_id}
        if amount:
            payload["amount"] = amount

        return await self._request(
            "POST",
            f"/accounting/ar-ap-bank/payments/{payment_id}/apply",
            source="accounting",
            json=payload
        )

    async def create_ar_payment(
        self,
        customer_id: str,
        amount: float,
        payment_date: str,
        payment_method: str,
        reference: Optional[str] = None,
        invoice_id: Optional[str] = None,
        **kwargs
    ) -> dict:
        """
        Record an AR payment.

        This creates the accounting entries when applied:
        - Debit: Cash/Bank account
        - Credit: Accounts Receivable

        Args:
            customer_id: Customer ID
            amount: Payment amount
            payment_date: Payment date
            payment_method: Payment method
            reference: Payment reference
            invoice_id: Invoice to apply payment to (optional)

        Returns:
            Created payment record
        """
        payload = {
            "customer_id": customer_id,
            "amount": amount,
            "payment_date": payment_date,
            "payment_method": payment_method,
        }

        if reference:
            payload["reference"] = reference
        if invoice_id:
            payload["invoice_id"] = invoice_id

        payload.update(kwargs)

        return await self._request(
            "POST",
            "/accounting/ar-ap-bank/payments",
            source="accounting",
            json=payload
        )

    async def get_aging_report(
        self,
        company_id: str,
        report_type: str = "receivables"
    ) -> dict:
        """
        Get AR/AP aging report.

        Args:
            company_id: Company ID
            report_type: 'receivables' or 'payables'

        Returns:
            Aging report data
        """
        return await self._request(
            "GET",
            "/accounting/ar-ap-bank/reports/aging",
            source="accounting",
            params={"company_id": company_id, "type": report_type}
        )


# Singleton instance
erp_client = ERPClient()
