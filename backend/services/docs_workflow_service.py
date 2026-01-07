"""
Bheem Docs - Workflow Integration Service
==========================================
Integrates Bheem Docs with ERP workflow and approval system.
For internal mode: Uses direct database access to ERP workflow tables.
For external mode: Uses simplified local workflow (no ERP integration).
"""

from typing import Optional, List, Dict, Any
from uuid import UUID, uuid4
from datetime import datetime
import psycopg2
from psycopg2.extras import RealDictCursor
import logging

from core.config import settings

logger = logging.getLogger(__name__)


# ERP Database connection settings (for internal mode)
ERP_DB_CONFIG = {
    "host": getattr(settings, "ERP_DB_HOST", "65.109.167.218"),
    "port": getattr(settings, "ERP_DB_PORT", 5432),
    "database": getattr(settings, "ERP_DB_NAME", "erp_staging"),
    "user": getattr(settings, "ERP_DB_USER", "postgres"),
    "password": getattr(settings, "ERP_DB_PASSWORD", "Bheem924924.@"),
}


# Approval status enum (matches ERP)
class ApprovalStatus:
    PENDING = "PENDING"
    APPROVED = "APPROVED"
    REJECTED = "REJECTED"
    CANCELLED = "CANCELLED"


# Approval action enum
class ApprovalAction:
    SUBMITTED = "SUBMITTED"
    APPROVED = "APPROVED"
    REJECTED = "REJECTED"
    DELEGATED = "DELEGATED"
    ESCALATED = "ESCALATED"
    CANCELLED = "CANCELLED"


class DocsWorkflowService:
    """
    Document workflow service that integrates with ERP approval system.

    For internal tenants (BHM001-BHM008):
    - Submits documents to ERP approval workflow
    - Retrieves pending approvals from ERP
    - Records approval/rejection in ERP tables

    For external tenants:
    - Simplified approval (single-level, owner/admin approval)
    """

    def __init__(self, is_internal: bool = False, company_id: Optional[str] = None):
        """
        Initialize workflow service.

        Args:
            is_internal: True for internal Bheemverse tenants
            company_id: ERP company ID (required for internal mode)
        """
        self.is_internal = is_internal
        self.company_id = company_id
        self._erp_conn = None

    def _get_erp_connection(self):
        """Get connection to ERP database."""
        if not self.is_internal:
            raise ValueError("ERP connection only available for internal mode")

        if self._erp_conn is None or self._erp_conn.closed:
            self._erp_conn = psycopg2.connect(**ERP_DB_CONFIG)
        return self._erp_conn

    def _close_erp_connection(self):
        """Close ERP database connection."""
        if self._erp_conn and not self._erp_conn.closed:
            self._erp_conn.close()
            self._erp_conn = None

    # =========================================================================
    # APPROVAL WORKFLOW - INTERNAL MODE (ERP Integration)
    # =========================================================================

    async def submit_for_approval(
        self,
        document_id: UUID,
        document_number: str,
        document_title: str,
        requested_by: UUID,
        amount: Optional[float] = None,
        notes: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Submit a document for approval using ERP workflow.

        Args:
            document_id: Document UUID
            document_number: Document reference number
            document_title: Document title (for display)
            requested_by: User submitting the document
            amount: Optional amount for threshold-based routing
            notes: Submission notes

        Returns:
            Approval request details
        """
        if not self.is_internal:
            return await self._submit_external_approval(
                document_id, document_number, document_title,
                requested_by, notes
            )

        try:
            conn = self._get_erp_connection()
            with conn.cursor(cursor_factory=RealDictCursor) as cur:
                # Get approval matrix for documents
                cur.execute("""
                    SELECT id, level, level_name, min_amount, max_amount,
                           approver_type, approver_role, approver_user_id
                    FROM public.approval_matrices
                    WHERE company_id = %s
                    AND matrix_type = 'DOCUMENT'
                    AND is_active = true
                    AND (min_amount IS NULL OR %s >= min_amount)
                    AND (max_amount IS NULL OR %s <= max_amount)
                    ORDER BY level
                """, (self.company_id, amount or 0, amount or float('inf')))

                levels = cur.fetchall()
                total_levels = len(levels) if levels else 1
                matrix_id = levels[0]['id'] if levels else None

                # Create approval request
                request_id = uuid4()
                cur.execute("""
                    INSERT INTO public.approval_requests (
                        id, company_id, document_type, document_id,
                        document_number, matrix_id, current_level, total_levels,
                        status, amount, requested_by, requested_date, notes,
                        created_at, updated_at, is_active
                    ) VALUES (
                        %s, %s, 'DOCUMENT', %s, %s, %s, 1, %s,
                        'PENDING', %s, %s, NOW(), %s, NOW(), NOW(), true
                    )
                    RETURNING *
                """, (
                    str(request_id), self.company_id, str(document_id),
                    document_number, str(matrix_id) if matrix_id else None,
                    total_levels, amount, str(requested_by), notes
                ))

                request = dict(cur.fetchone())

                # Record submission in history
                cur.execute("""
                    INSERT INTO public.approval_history (
                        id, request_id, level_order, level_name,
                        action, action_date, approver_id, comments,
                        created_at, updated_at
                    ) VALUES (
                        %s, %s, 0, 'Submission', %s, NOW(), %s, %s, NOW(), NOW()
                    )
                """, (
                    str(uuid4()), str(request_id), ApprovalAction.SUBMITTED,
                    str(requested_by), notes
                ))

                conn.commit()

                return {
                    "request_id": str(request['id']),
                    "document_id": str(document_id),
                    "document_number": document_number,
                    "status": ApprovalStatus.PENDING,
                    "current_level": 1,
                    "total_levels": total_levels,
                    "submitted_at": datetime.now().isoformat(),
                    "submitted_by": str(requested_by)
                }

        except Exception as e:
            logger.error(f"Failed to submit for approval: {e}")
            if self._erp_conn:
                self._erp_conn.rollback()
            raise

    async def get_approval_request(
        self,
        request_id: UUID
    ) -> Optional[Dict[str, Any]]:
        """Get approval request details."""
        if not self.is_internal:
            return None

        try:
            conn = self._get_erp_connection()
            with conn.cursor(cursor_factory=RealDictCursor) as cur:
                cur.execute("""
                    SELECT ar.*,
                           ah.action as last_action,
                           ah.action_date as last_action_date,
                           ah.comments as last_comments
                    FROM public.approval_requests ar
                    LEFT JOIN public.approval_history ah ON ar.id = ah.request_id
                    WHERE ar.id = %s
                    ORDER BY ah.action_date DESC
                    LIMIT 1
                """, (str(request_id),))

                result = cur.fetchone()
                return dict(result) if result else None

        except Exception as e:
            logger.error(f"Failed to get approval request: {e}")
            return None

    async def get_document_approval_status(
        self,
        document_id: UUID
    ) -> Optional[Dict[str, Any]]:
        """Get current approval status for a document."""
        if not self.is_internal:
            return {"status": "N/A", "message": "Workflow not enabled"}

        try:
            conn = self._get_erp_connection()
            with conn.cursor(cursor_factory=RealDictCursor) as cur:
                cur.execute("""
                    SELECT id, status, current_level, total_levels,
                           requested_by, requested_date, completed_date,
                           final_approver_id, notes
                    FROM public.approval_requests
                    WHERE document_id = %s
                    AND document_type = 'DOCUMENT'
                    AND is_active = true
                    ORDER BY created_at DESC
                    LIMIT 1
                """, (str(document_id),))

                result = cur.fetchone()
                if not result:
                    return {"status": "NOT_SUBMITTED", "message": "Not submitted for approval"}

                return {
                    "request_id": str(result['id']),
                    "status": result['status'],
                    "current_level": result['current_level'],
                    "total_levels": result['total_levels'],
                    "requested_by": str(result['requested_by']) if result['requested_by'] else None,
                    "requested_date": result['requested_date'].isoformat() if result['requested_date'] else None,
                    "completed_date": result['completed_date'].isoformat() if result['completed_date'] else None,
                    "final_approver": str(result['final_approver_id']) if result['final_approver_id'] else None
                }

        except Exception as e:
            logger.error(f"Failed to get document approval status: {e}")
            return None

    async def get_pending_approvals(
        self,
        approver_id: UUID,
        document_type: str = "DOCUMENT",
        limit: int = 50
    ) -> List[Dict[str, Any]]:
        """
        Get documents pending approval by a specific user.

        Args:
            approver_id: User ID to check approvals for
            document_type: Filter by document type
            limit: Maximum results

        Returns:
            List of pending approval requests
        """
        if not self.is_internal:
            return []

        try:
            conn = self._get_erp_connection()
            with conn.cursor(cursor_factory=RealDictCursor) as cur:
                # Find pending approvals where user is the approver at current level
                cur.execute("""
                    SELECT ar.id, ar.document_id, ar.document_number,
                           ar.status, ar.current_level, ar.total_levels,
                           ar.amount, ar.requested_by, ar.requested_date, ar.notes,
                           am.level_name, am.approver_type
                    FROM public.approval_requests ar
                    JOIN public.approval_matrices am ON ar.matrix_id = am.id
                    WHERE ar.company_id = %s
                    AND ar.document_type = %s
                    AND ar.status = 'PENDING'
                    AND ar.is_active = true
                    AND am.level = ar.current_level
                    AND (
                        am.approver_user_id = %s
                        OR (am.approver_type = 'ROLE' AND EXISTS (
                            SELECT 1 FROM public.employees e
                            WHERE e.user_id = %s
                            AND e.job_title ILIKE '%%' || am.approver_role || '%%'
                        ))
                    )
                    ORDER BY ar.requested_date DESC
                    LIMIT %s
                """, (self.company_id, document_type, str(approver_id), str(approver_id), limit))

                results = cur.fetchall()
                return [dict(r) for r in results]

        except Exception as e:
            logger.error(f"Failed to get pending approvals: {e}")
            return []

    async def approve_document(
        self,
        request_id: UUID,
        approver_id: UUID,
        comments: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Approve a document at the current level.

        Args:
            request_id: Approval request ID
            approver_id: User approving
            comments: Approval comments

        Returns:
            Updated approval status
        """
        if not self.is_internal:
            return {"error": "Workflow not available for external mode"}

        try:
            conn = self._get_erp_connection()
            with conn.cursor(cursor_factory=RealDictCursor) as cur:
                # Get current request
                cur.execute("""
                    SELECT * FROM public.approval_requests
                    WHERE id = %s AND is_active = true
                    FOR UPDATE
                """, (str(request_id),))

                request = cur.fetchone()
                if not request:
                    return {"error": "Approval request not found"}

                if request['status'] != 'PENDING':
                    return {"error": f"Request is not pending (status: {request['status']})"}

                current_level = request['current_level']
                total_levels = request['total_levels']

                # Get level name
                cur.execute("""
                    SELECT level_name FROM public.approval_matrices
                    WHERE id = %s
                """, (str(request['matrix_id']),) if request['matrix_id'] else (None,))

                level_row = cur.fetchone()
                level_name = level_row['level_name'] if level_row else f"Level {current_level}"

                # Record approval in history
                cur.execute("""
                    INSERT INTO public.approval_history (
                        id, request_id, level_order, level_name,
                        action, action_date, approver_id, comments,
                        created_at, updated_at
                    ) VALUES (
                        %s, %s, %s, %s, %s, NOW(), %s, %s, NOW(), NOW()
                    )
                """, (
                    str(uuid4()), str(request_id), current_level, level_name,
                    ApprovalAction.APPROVED, str(approver_id), comments
                ))

                # Check if this was the final level
                if current_level >= total_levels:
                    # Fully approved
                    cur.execute("""
                        UPDATE public.approval_requests
                        SET status = 'APPROVED',
                            completed_date = NOW(),
                            final_approver_id = %s,
                            updated_at = NOW()
                        WHERE id = %s
                    """, (str(approver_id), str(request_id)))

                    new_status = ApprovalStatus.APPROVED
                else:
                    # Move to next level
                    cur.execute("""
                        UPDATE public.approval_requests
                        SET current_level = current_level + 1,
                            updated_at = NOW()
                        WHERE id = %s
                    """, (str(request_id),))

                    new_status = ApprovalStatus.PENDING

                conn.commit()

                return {
                    "request_id": str(request_id),
                    "document_id": str(request['document_id']),
                    "status": new_status,
                    "current_level": current_level + 1 if new_status == ApprovalStatus.PENDING else current_level,
                    "total_levels": total_levels,
                    "approved_by": str(approver_id),
                    "approved_at": datetime.now().isoformat(),
                    "is_fully_approved": new_status == ApprovalStatus.APPROVED
                }

        except Exception as e:
            logger.error(f"Failed to approve document: {e}")
            if self._erp_conn:
                self._erp_conn.rollback()
            raise

    async def reject_document(
        self,
        request_id: UUID,
        approver_id: UUID,
        comments: str
    ) -> Dict[str, Any]:
        """
        Reject a document.

        Args:
            request_id: Approval request ID
            approver_id: User rejecting
            comments: Rejection reason (required)

        Returns:
            Updated approval status
        """
        if not self.is_internal:
            return {"error": "Workflow not available for external mode"}

        if not comments:
            return {"error": "Rejection comments are required"}

        try:
            conn = self._get_erp_connection()
            with conn.cursor(cursor_factory=RealDictCursor) as cur:
                # Get current request
                cur.execute("""
                    SELECT * FROM public.approval_requests
                    WHERE id = %s AND is_active = true
                    FOR UPDATE
                """, (str(request_id),))

                request = cur.fetchone()
                if not request:
                    return {"error": "Approval request not found"}

                if request['status'] != 'PENDING':
                    return {"error": f"Request is not pending (status: {request['status']})"}

                current_level = request['current_level']

                # Record rejection in history
                cur.execute("""
                    INSERT INTO public.approval_history (
                        id, request_id, level_order, level_name,
                        action, action_date, approver_id, comments,
                        created_at, updated_at
                    ) VALUES (
                        %s, %s, %s, %s, %s, NOW(), %s, %s, NOW(), NOW()
                    )
                """, (
                    str(uuid4()), str(request_id), current_level,
                    f"Level {current_level}", ApprovalAction.REJECTED,
                    str(approver_id), comments
                ))

                # Update request status
                cur.execute("""
                    UPDATE public.approval_requests
                    SET status = 'REJECTED',
                        completed_date = NOW(),
                        final_approver_id = %s,
                        updated_at = NOW()
                    WHERE id = %s
                """, (str(approver_id), str(request_id)))

                conn.commit()

                return {
                    "request_id": str(request_id),
                    "document_id": str(request['document_id']),
                    "status": ApprovalStatus.REJECTED,
                    "rejected_by": str(approver_id),
                    "rejected_at": datetime.now().isoformat(),
                    "reason": comments
                }

        except Exception as e:
            logger.error(f"Failed to reject document: {e}")
            if self._erp_conn:
                self._erp_conn.rollback()
            raise

    async def cancel_approval_request(
        self,
        request_id: UUID,
        user_id: UUID,
        reason: Optional[str] = None
    ) -> Dict[str, Any]:
        """Cancel an approval request (by submitter only)."""
        if not self.is_internal:
            return {"error": "Workflow not available for external mode"}

        try:
            conn = self._get_erp_connection()
            with conn.cursor(cursor_factory=RealDictCursor) as cur:
                # Verify user is the submitter
                cur.execute("""
                    SELECT * FROM public.approval_requests
                    WHERE id = %s AND requested_by = %s AND is_active = true
                    FOR UPDATE
                """, (str(request_id), str(user_id)))

                request = cur.fetchone()
                if not request:
                    return {"error": "Request not found or not authorized"}

                if request['status'] != 'PENDING':
                    return {"error": "Can only cancel pending requests"}

                # Record cancellation
                cur.execute("""
                    INSERT INTO public.approval_history (
                        id, request_id, level_order, level_name,
                        action, action_date, approver_id, comments,
                        created_at, updated_at
                    ) VALUES (
                        %s, %s, %s, 'Cancellation', %s, NOW(), %s, %s, NOW(), NOW()
                    )
                """, (
                    str(uuid4()), str(request_id), request['current_level'],
                    ApprovalAction.CANCELLED, str(user_id), reason
                ))

                # Update status
                cur.execute("""
                    UPDATE public.approval_requests
                    SET status = 'CANCELLED',
                        completed_date = NOW(),
                        updated_at = NOW()
                    WHERE id = %s
                """, (str(request_id),))

                conn.commit()

                return {
                    "request_id": str(request_id),
                    "status": ApprovalStatus.CANCELLED,
                    "cancelled_at": datetime.now().isoformat()
                }

        except Exception as e:
            logger.error(f"Failed to cancel request: {e}")
            if self._erp_conn:
                self._erp_conn.rollback()
            raise

    async def get_approval_history(
        self,
        document_id: Optional[UUID] = None,
        request_id: Optional[UUID] = None
    ) -> List[Dict[str, Any]]:
        """Get approval history for a document or request."""
        if not self.is_internal:
            return []

        try:
            conn = self._get_erp_connection()
            with conn.cursor(cursor_factory=RealDictCursor) as cur:
                if request_id:
                    cur.execute("""
                        SELECT ah.*, ar.document_id, ar.document_number
                        FROM public.approval_history ah
                        JOIN public.approval_requests ar ON ah.request_id = ar.id
                        WHERE ah.request_id = %s
                        ORDER BY ah.action_date
                    """, (str(request_id),))
                elif document_id:
                    cur.execute("""
                        SELECT ah.*, ar.document_id, ar.document_number
                        FROM public.approval_history ah
                        JOIN public.approval_requests ar ON ah.request_id = ar.id
                        WHERE ar.document_id = %s AND ar.document_type = 'DOCUMENT'
                        ORDER BY ar.created_at DESC, ah.action_date
                    """, (str(document_id),))
                else:
                    return []

                return [dict(r) for r in cur.fetchall()]

        except Exception as e:
            logger.error(f"Failed to get approval history: {e}")
            return []

    # =========================================================================
    # WORKFLOW STATE MANAGEMENT (Using ERP shared_workflow tables)
    # =========================================================================

    async def get_or_create_workflow(
        self,
        document_id: UUID,
        workflow_code: str = "DOC_APPROVAL",
        created_by: UUID = None
    ) -> Optional[Dict[str, Any]]:
        """
        Get or create a workflow instance for a document.

        Args:
            document_id: Document UUID
            workflow_code: Workflow definition code
            created_by: User creating the workflow

        Returns:
            Workflow instance
        """
        if not self.is_internal:
            return None

        try:
            conn = self._get_erp_connection()
            with conn.cursor(cursor_factory=RealDictCursor) as cur:
                # Check for existing instance
                cur.execute("""
                    SELECT wi.*, wd.workflow_name, wd.states, wd.transitions
                    FROM public.shared_workflow_instances wi
                    JOIN public.shared_workflow_definitions wd ON wi.workflow_definition_id = wd.id
                    WHERE wi.entity_type = 'DOCUMENT'
                    AND wi.entity_id = %s
                    AND wi.is_active = true
                """, (str(document_id),))

                instance = cur.fetchone()
                if instance:
                    return dict(instance)

                # Get workflow definition
                cur.execute("""
                    SELECT * FROM public.shared_workflow_definitions
                    WHERE workflow_code = %s AND is_active = true
                    LIMIT 1
                """, (workflow_code,))

                definition = cur.fetchone()
                if not definition:
                    # Create default document workflow definition
                    definition = await self._create_default_doc_workflow(cur, created_by)

                if not definition:
                    return None

                # Create workflow instance
                instance_id = uuid4()
                cur.execute("""
                    INSERT INTO public.shared_workflow_instances (
                        id, workflow_definition_id, entity_type, entity_id,
                        current_state, state_entered_at, workflow_data,
                        is_completed, created_at, updated_at, created_by, is_active
                    ) VALUES (
                        %s, %s, 'DOCUMENT', %s, %s, NOW(), '{}',
                        false, NOW(), NOW(), %s, true
                    )
                    RETURNING *
                """, (
                    str(instance_id), str(definition['id']), str(document_id),
                    definition['initial_state'], str(created_by) if created_by else None
                ))

                instance = cur.fetchone()
                conn.commit()

                result = dict(instance)
                result['workflow_name'] = definition['workflow_name']
                result['states'] = definition['states']
                result['transitions'] = definition['transitions']

                return result

        except Exception as e:
            logger.error(f"Failed to get/create workflow: {e}")
            if self._erp_conn:
                self._erp_conn.rollback()
            return None

    async def _create_default_doc_workflow(self, cur, created_by: UUID) -> Optional[Dict]:
        """Create default document approval workflow definition."""
        try:
            definition_id = uuid4()
            states = {
                "DRAFT": {"label": "Draft", "color": "gray"},
                "PENDING_REVIEW": {"label": "Pending Review", "color": "yellow"},
                "PENDING_APPROVAL": {"label": "Pending Approval", "color": "orange"},
                "APPROVED": {"label": "Approved", "color": "green"},
                "REJECTED": {"label": "Rejected", "color": "red"},
                "PUBLISHED": {"label": "Published", "color": "blue"}
            }
            transitions = {
                "submit_for_review": {"from": "DRAFT", "to": "PENDING_REVIEW"},
                "approve_review": {"from": "PENDING_REVIEW", "to": "PENDING_APPROVAL"},
                "reject_review": {"from": "PENDING_REVIEW", "to": "DRAFT"},
                "approve": {"from": "PENDING_APPROVAL", "to": "APPROVED"},
                "reject": {"from": "PENDING_APPROVAL", "to": "REJECTED"},
                "publish": {"from": "APPROVED", "to": "PUBLISHED"},
                "unpublish": {"from": "PUBLISHED", "to": "APPROVED"},
                "revise": {"from": ["APPROVED", "REJECTED"], "to": "DRAFT"}
            }

            cur.execute("""
                INSERT INTO public.shared_workflow_definitions (
                    id, workflow_code, workflow_name, entity_type,
                    states, transitions, initial_state, final_states,
                    description, version, created_at, updated_at, created_by, is_active
                ) VALUES (
                    %s, 'DOC_APPROVAL', 'Document Approval Workflow', 'DOCUMENT',
                    %s, %s, 'DRAFT', %s,
                    'Standard document approval workflow', '1.0',
                    NOW(), NOW(), %s, true
                )
                RETURNING *
            """, (
                str(definition_id),
                psycopg2.extras.Json(states),
                psycopg2.extras.Json(transitions),
                psycopg2.extras.Json(["PUBLISHED", "REJECTED"]),
                str(created_by) if created_by else None
            ))

            return cur.fetchone()

        except Exception as e:
            logger.error(f"Failed to create default workflow: {e}")
            return None

    async def transition_workflow(
        self,
        document_id: UUID,
        transition: str,
        transitioned_by: UUID,
        notes: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Transition workflow to a new state.

        Args:
            document_id: Document UUID
            transition: Transition name
            transitioned_by: User performing transition
            notes: Transition notes

        Returns:
            Updated workflow state
        """
        if not self.is_internal:
            return {"error": "Workflow not available"}

        try:
            conn = self._get_erp_connection()
            with conn.cursor(cursor_factory=RealDictCursor) as cur:
                # Get workflow instance with definition
                cur.execute("""
                    SELECT wi.*, wd.transitions, wd.final_states
                    FROM public.shared_workflow_instances wi
                    JOIN public.shared_workflow_definitions wd ON wi.workflow_definition_id = wd.id
                    WHERE wi.entity_type = 'DOCUMENT'
                    AND wi.entity_id = %s
                    AND wi.is_active = true
                    FOR UPDATE
                """, (str(document_id),))

                instance = cur.fetchone()
                if not instance:
                    return {"error": "Workflow not found for document"}

                # Validate transition
                transitions = instance['transitions']
                if transition not in transitions:
                    return {"error": f"Invalid transition: {transition}"}

                trans_def = transitions[transition]
                from_states = trans_def['from']
                if isinstance(from_states, str):
                    from_states = [from_states]

                if instance['current_state'] not in from_states:
                    return {
                        "error": f"Cannot transition from {instance['current_state']} using {transition}"
                    }

                new_state = trans_def['to']
                final_states = instance['final_states'] or []
                is_completed = new_state in final_states

                # Record transition
                cur.execute("""
                    INSERT INTO public.shared_workflow_transitions (
                        id, workflow_instance_id, from_state, to_state,
                        transition_name, transitioned_by, notes,
                        created_at
                    ) VALUES (
                        %s, %s, %s, %s, %s, %s, %s, NOW()
                    )
                """, (
                    str(uuid4()), str(instance['id']),
                    instance['current_state'], new_state,
                    transition, str(transitioned_by), notes
                ))

                # Update instance
                cur.execute("""
                    UPDATE public.shared_workflow_instances
                    SET previous_state = current_state,
                        current_state = %s,
                        state_entered_at = NOW(),
                        is_completed = %s,
                        completed_at = CASE WHEN %s THEN NOW() ELSE NULL END,
                        updated_at = NOW(),
                        updated_by = %s
                    WHERE id = %s
                """, (
                    new_state, is_completed, is_completed,
                    str(transitioned_by), str(instance['id'])
                ))

                conn.commit()

                return {
                    "document_id": str(document_id),
                    "previous_state": instance['current_state'],
                    "current_state": new_state,
                    "transition": transition,
                    "is_completed": is_completed,
                    "transitioned_by": str(transitioned_by),
                    "transitioned_at": datetime.now().isoformat()
                }

        except Exception as e:
            logger.error(f"Failed to transition workflow: {e}")
            if self._erp_conn:
                self._erp_conn.rollback()
            raise

    async def get_workflow_state(
        self,
        document_id: UUID
    ) -> Optional[Dict[str, Any]]:
        """Get current workflow state for a document."""
        if not self.is_internal:
            return None

        try:
            conn = self._get_erp_connection()
            with conn.cursor(cursor_factory=RealDictCursor) as cur:
                cur.execute("""
                    SELECT wi.*, wd.workflow_name, wd.states, wd.transitions
                    FROM public.shared_workflow_instances wi
                    JOIN public.shared_workflow_definitions wd ON wi.workflow_definition_id = wd.id
                    WHERE wi.entity_type = 'DOCUMENT'
                    AND wi.entity_id = %s
                    AND wi.is_active = true
                """, (str(document_id),))

                instance = cur.fetchone()
                if not instance:
                    return None

                states = instance['states']
                current_state_info = states.get(instance['current_state'], {})

                # Get available transitions
                available = []
                for name, trans in instance['transitions'].items():
                    from_states = trans['from']
                    if isinstance(from_states, str):
                        from_states = [from_states]
                    if instance['current_state'] in from_states:
                        available.append({
                            "name": name,
                            "to_state": trans['to'],
                            "label": trans.get('label', name.replace('_', ' ').title())
                        })

                return {
                    "workflow_name": instance['workflow_name'],
                    "current_state": instance['current_state'],
                    "state_label": current_state_info.get('label', instance['current_state']),
                    "state_color": current_state_info.get('color', 'gray'),
                    "state_entered_at": instance['state_entered_at'].isoformat() if instance['state_entered_at'] else None,
                    "is_completed": instance['is_completed'],
                    "available_transitions": available
                }

        except Exception as e:
            logger.error(f"Failed to get workflow state: {e}")
            return None

    # =========================================================================
    # EXTERNAL MODE - SIMPLIFIED APPROVAL
    # =========================================================================

    async def _submit_external_approval(
        self,
        document_id: UUID,
        document_number: str,
        document_title: str,
        requested_by: UUID,
        notes: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Simplified approval for external mode (no ERP integration).
        Just marks the document as pending approval.
        """
        return {
            "request_id": str(uuid4()),
            "document_id": str(document_id),
            "document_number": document_number,
            "status": ApprovalStatus.PENDING,
            "current_level": 1,
            "total_levels": 1,
            "submitted_at": datetime.now().isoformat(),
            "submitted_by": str(requested_by),
            "mode": "external",
            "message": "Document marked for approval (external mode - no ERP workflow)"
        }

    def __del__(self):
        """Cleanup database connection on destruction."""
        self._close_erp_connection()


# Service factory
_workflow_service_cache: Dict[str, DocsWorkflowService] = {}


def get_docs_workflow_service(
    is_internal: bool = False,
    company_id: Optional[str] = None
) -> DocsWorkflowService:
    """
    Get or create a workflow service instance.

    Args:
        is_internal: True for internal Bheemverse tenants
        company_id: ERP company ID

    Returns:
        DocsWorkflowService instance
    """
    cache_key = f"{is_internal}:{company_id or 'external'}"

    if cache_key not in _workflow_service_cache:
        _workflow_service_cache[cache_key] = DocsWorkflowService(
            is_internal=is_internal,
            company_id=company_id
        )

    return _workflow_service_cache[cache_key]
