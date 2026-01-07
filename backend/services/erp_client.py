"""
Bheem Workspace - ERP API Client
Handles communication with Bheem Core ERP for subscriptions, CRM, HR, and PM integration
"""
from typing import Optional, Dict, Any, List
from uuid import UUID
import httpx

from core.config import settings


class ERPClient:
    """Client for Bheem Core ERP API interactions"""

    def __init__(self):
        self.base_url = settings.ERP_SERVICE_URL
        self.api_key = settings.ERP_API_KEY

    async def _request(
        self,
        method: str,
        endpoint: str,
        source: str = "workspace",
        **kwargs
    ) -> dict:
        """Make authenticated request to ERP"""
        headers = {
            "Authorization": f"Bearer {self.api_key}" if self.api_key else "",
            "X-Source": f"workspace-{source}",
            "Content-Type": "application/json"
        }

        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.request(
                method=method,
                url=f"{self.base_url}/api/v1{endpoint}",
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

        Args:
            plan_prefix: SKU prefix to filter (default: WORKSPACE-)

        Returns:
            List of available plans with tiers
        """
        result = await self._request(
            "GET",
            "/shared/sku-subscription",
            params={"plan_prefix": plan_prefix}
        )
        return result.get("data", [])

    async def get_plan_details(self, sku_id: str) -> dict:
        """
        Get plan details with tiers.

        Args:
            sku_id: SKU ID (UUID or SKU code like WORKSPACE-PROFESSIONAL)

        Returns:
            Plan details including tiers and features
        """
        return await self._request("GET", f"/shared/sku-subscription/sku/{sku_id}")

    async def get_plan_by_sku_code(self, sku_code: str) -> Optional[dict]:
        """
        Look up plan by SKU code (e.g., WORKSPACE-STARTER) and return the plan_id (UUID).

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
            return None
        except Exception:
            return None

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


# Singleton instance
erp_client = ERPClient()
