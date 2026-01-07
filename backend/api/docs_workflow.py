"""
Bheem Docs - Workflow & Approval API
=====================================
REST API endpoints for document approval workflows.
Integrates with ERP workflow system for internal tenants.
"""

from typing import Optional
from uuid import UUID
from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field

from core.security import get_current_user
from services.docs_workflow_service import (
    get_docs_workflow_service,
    DocsWorkflowService,
    ApprovalStatus
)
from services.internal_workspace_service import BHEEMVERSE_COMPANY_CODES

router = APIRouter(prefix="/docs/workflow", tags=["Bheem Docs Workflow"])


# =============================================================================
# REQUEST/RESPONSE MODELS
# =============================================================================

class SubmitApprovalRequest(BaseModel):
    """Request to submit document for approval"""
    document_id: str
    document_number: str = Field(..., min_length=1, max_length=100)
    document_title: str = Field(..., min_length=1, max_length=500)
    amount: Optional[float] = None
    notes: Optional[str] = None


class ApproveRejectRequest(BaseModel):
    """Request to approve or reject a document"""
    comments: Optional[str] = Field(None, max_length=2000)


class RejectRequest(BaseModel):
    """Request to reject a document (comments required)"""
    comments: str = Field(..., min_length=1, max_length=2000)


class CancelRequest(BaseModel):
    """Request to cancel approval request"""
    reason: Optional[str] = Field(None, max_length=1000)


class WorkflowTransitionRequest(BaseModel):
    """Request to transition workflow state"""
    transition: str = Field(..., min_length=1, max_length=100)
    notes: Optional[str] = Field(None, max_length=2000)


# =============================================================================
# HELPER FUNCTIONS
# =============================================================================

def get_workflow_service(current_user: dict = Depends(get_current_user)) -> DocsWorkflowService:
    """
    Get workflow service based on user's tenant mode.

    Internal tenants get ERP-integrated workflow.
    External tenants get simplified local workflow.
    """
    company_code = current_user.get("company_code", "").upper()
    is_internal = company_code in BHEEMVERSE_COMPANY_CODES

    company_id = None
    if is_internal:
        company_id = BHEEMVERSE_COMPANY_CODES.get(company_code)

    return get_docs_workflow_service(
        is_internal=is_internal,
        company_id=company_id
    )


# =============================================================================
# APPROVAL ENDPOINTS
# =============================================================================

@router.post("/submit")
async def submit_for_approval(
    request: SubmitApprovalRequest,
    service: DocsWorkflowService = Depends(get_workflow_service),
    current_user: dict = Depends(get_current_user)
):
    """
    Submit a document for approval.

    For internal tenants:
    - Creates approval request in ERP system
    - Routes to appropriate approvers based on approval matrix
    - Supports multi-level approval based on amount thresholds

    For external tenants:
    - Creates local approval request
    - Single-level approval by document owner or admin
    """
    user_id = UUID(current_user['id'])

    try:
        result = await service.submit_for_approval(
            document_id=UUID(request.document_id),
            document_number=request.document_number,
            document_title=request.document_title,
            requested_by=user_id,
            amount=request.amount,
            notes=request.notes
        )

        return result

    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/pending")
async def get_pending_approvals(
    document_type: str = Query("DOCUMENT", description="Document type filter"),
    limit: int = Query(50, ge=1, le=200),
    service: DocsWorkflowService = Depends(get_workflow_service),
    current_user: dict = Depends(get_current_user)
):
    """
    Get documents pending approval by the current user.

    Returns documents where the user is an approver at the current level.
    """
    user_id = UUID(current_user['id'])

    pending = await service.get_pending_approvals(
        approver_id=user_id,
        document_type=document_type,
        limit=limit
    )

    return {
        "pending": pending,
        "count": len(pending)
    }


@router.get("/requests/{request_id}")
async def get_approval_request(
    request_id: str,
    service: DocsWorkflowService = Depends(get_workflow_service),
    current_user: dict = Depends(get_current_user)
):
    """Get approval request details."""
    result = await service.get_approval_request(UUID(request_id))

    if not result:
        raise HTTPException(status_code=404, detail="Approval request not found")

    return result


@router.get("/documents/{document_id}/status")
async def get_document_approval_status(
    document_id: str,
    service: DocsWorkflowService = Depends(get_workflow_service),
    current_user: dict = Depends(get_current_user)
):
    """
    Get current approval status for a document.

    Returns:
    - NOT_SUBMITTED: Document has not been submitted for approval
    - PENDING: Awaiting approval
    - APPROVED: Fully approved
    - REJECTED: Rejected by an approver
    - CANCELLED: Cancelled by submitter
    """
    result = await service.get_document_approval_status(UUID(document_id))

    if not result:
        raise HTTPException(status_code=404, detail="Document not found")

    return result


@router.post("/requests/{request_id}/approve")
async def approve_document(
    request_id: str,
    request: ApproveRejectRequest,
    service: DocsWorkflowService = Depends(get_workflow_service),
    current_user: dict = Depends(get_current_user)
):
    """
    Approve a document at the current approval level.

    For multi-level approval:
    - If more levels remain, moves to next level
    - If final level, marks document as fully approved
    """
    user_id = UUID(current_user['id'])

    try:
        result = await service.approve_document(
            request_id=UUID(request_id),
            approver_id=user_id,
            comments=request.comments
        )

        if "error" in result:
            raise HTTPException(status_code=400, detail=result["error"])

        return result

    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/requests/{request_id}/reject")
async def reject_document(
    request_id: str,
    request: RejectRequest,
    service: DocsWorkflowService = Depends(get_workflow_service),
    current_user: dict = Depends(get_current_user)
):
    """
    Reject a document.

    Rejection comments are required.
    The document submitter will be notified.
    """
    user_id = UUID(current_user['id'])

    try:
        result = await service.reject_document(
            request_id=UUID(request_id),
            approver_id=user_id,
            comments=request.comments
        )

        if "error" in result:
            raise HTTPException(status_code=400, detail=result["error"])

        return result

    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/requests/{request_id}/cancel")
async def cancel_approval_request(
    request_id: str,
    request: CancelRequest,
    service: DocsWorkflowService = Depends(get_workflow_service),
    current_user: dict = Depends(get_current_user)
):
    """
    Cancel an approval request.

    Only the original submitter can cancel a pending request.
    """
    user_id = UUID(current_user['id'])

    try:
        result = await service.cancel_approval_request(
            request_id=UUID(request_id),
            user_id=user_id,
            reason=request.reason
        )

        if "error" in result:
            raise HTTPException(status_code=400, detail=result["error"])

        return result

    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/documents/{document_id}/history")
async def get_document_approval_history(
    document_id: str,
    service: DocsWorkflowService = Depends(get_workflow_service),
    current_user: dict = Depends(get_current_user)
):
    """
    Get approval history for a document.

    Returns all approval actions (submissions, approvals, rejections)
    across all approval requests for the document.
    """
    history = await service.get_approval_history(document_id=UUID(document_id))

    return {
        "document_id": document_id,
        "history": history
    }


# =============================================================================
# WORKFLOW STATE ENDPOINTS
# =============================================================================

@router.get("/documents/{document_id}/workflow")
async def get_document_workflow(
    document_id: str,
    service: DocsWorkflowService = Depends(get_workflow_service),
    current_user: dict = Depends(get_current_user)
):
    """
    Get workflow state for a document.

    Returns:
    - Current state and state info
    - Available transitions from current state
    - Workflow metadata
    """
    # Get or create workflow instance
    workflow = await service.get_or_create_workflow(
        document_id=UUID(document_id),
        created_by=UUID(current_user['id'])
    )

    if not workflow:
        return {
            "enabled": False,
            "message": "Workflow not available for this tenant mode"
        }

    # Get current state info
    state = await service.get_workflow_state(UUID(document_id))

    return {
        "enabled": True,
        "document_id": document_id,
        **state
    }


@router.post("/documents/{document_id}/workflow/transition")
async def transition_document_workflow(
    document_id: str,
    request: WorkflowTransitionRequest,
    service: DocsWorkflowService = Depends(get_workflow_service),
    current_user: dict = Depends(get_current_user)
):
    """
    Transition document workflow to a new state.

    Available transitions depend on the current state.
    Use GET /documents/{id}/workflow to see available transitions.
    """
    user_id = UUID(current_user['id'])

    try:
        # Ensure workflow exists
        await service.get_or_create_workflow(
            document_id=UUID(document_id),
            created_by=user_id
        )

        # Perform transition
        result = await service.transition_workflow(
            document_id=UUID(document_id),
            transition=request.transition,
            transitioned_by=user_id,
            notes=request.notes
        )

        if "error" in result:
            raise HTTPException(status_code=400, detail=result["error"])

        return result

    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


# =============================================================================
# STATS ENDPOINTS
# =============================================================================

@router.get("/stats")
async def get_workflow_stats(
    service: DocsWorkflowService = Depends(get_workflow_service),
    current_user: dict = Depends(get_current_user)
):
    """
    Get workflow statistics for the current user.

    Returns:
    - Pending approvals count
    - Recent activity
    """
    user_id = UUID(current_user['id'])

    # Get pending count
    pending = await service.get_pending_approvals(
        approver_id=user_id,
        limit=1
    )

    return {
        "pending_count": len(pending),
        "is_internal": service.is_internal,
        "workflow_enabled": service.is_internal
    }
