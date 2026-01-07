"""
Bheem Docs - Enterprise Features API
====================================
REST API endpoints for audit logging and electronic signatures.
"""

from typing import Optional, List
from uuid import UUID
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, Query, Response
from pydantic import BaseModel, Field, EmailStr

from core.security import get_current_user
from services.docs_audit_service import (
    get_docs_audit_service,
    DocsAuditService,
    AuditAction
)
from services.docs_signature_service import (
    get_docs_signature_service,
    DocsSignatureService,
    SignatureType,
    SignerRole
)

router = APIRouter(prefix="/docs/enterprise", tags=["Bheem Docs Enterprise"])


# =============================================================================
# REQUEST/RESPONSE MODELS
# =============================================================================

class SignerInfo(BaseModel):
    """Signer information for signature request"""
    email: EmailStr
    name: Optional[str] = None
    role: str = Field(default="SIGNER", pattern="^(SIGNER|APPROVER|WITNESS|CARBON_COPY)$")
    order: Optional[int] = None


class CreateSignatureRequest(BaseModel):
    """Request to create a signature request"""
    document_id: str
    document_hash: str
    signers: List[SignerInfo] = Field(..., min_items=1, max_items=50)
    subject: str = Field(..., min_length=1, max_length=500)
    message: Optional[str] = Field(None, max_length=5000)
    expires_in_days: int = Field(default=30, ge=1, le=365)
    signature_type: str = Field(default="ELECTRONIC", pattern="^(ELECTRONIC|ADVANCED|QUALIFIED)$")
    require_signing_order: bool = False


class SignDocumentRequest(BaseModel):
    """Request to sign a document"""
    access_token: str
    signature_data: str = Field(..., description="Base64 encoded signature or typed name")


class DeclineSignatureRequest(BaseModel):
    """Request to decline signing"""
    access_token: str
    reason: str = Field(..., min_length=1, max_length=1000)


class AuditSearchRequest(BaseModel):
    """Audit log search request"""
    search_term: Optional[str] = None
    actions: Optional[List[str]] = None
    user_ids: Optional[List[str]] = None
    document_ids: Optional[List[str]] = None
    start_date: Optional[datetime] = None
    end_date: Optional[datetime] = None
    ip_address: Optional[str] = None


# =============================================================================
# HELPER FUNCTIONS
# =============================================================================

def get_audit_service() -> DocsAuditService:
    return get_docs_audit_service()


def get_signature_service() -> DocsSignatureService:
    return get_docs_signature_service()


# =============================================================================
# AUDIT LOG ENDPOINTS
# =============================================================================

@router.get("/audit/documents/{document_id}")
async def get_document_audit_history(
    document_id: str,
    actions: Optional[str] = Query(None, description="Comma-separated action types"),
    start_date: Optional[datetime] = None,
    end_date: Optional[datetime] = None,
    limit: int = Query(100, ge=1, le=500),
    offset: int = Query(0, ge=0),
    service: DocsAuditService = Depends(get_audit_service),
    current_user: dict = Depends(get_current_user)
):
    """
    Get audit history for a specific document.

    Returns all tracked activities on the document.
    """
    action_list = None
    if actions:
        try:
            action_list = [AuditAction(a.strip()) for a in actions.split(",")]
        except ValueError:
            pass

    history = await service.get_document_history(
        document_id=UUID(document_id),
        actions=action_list,
        start_date=start_date,
        end_date=end_date,
        limit=limit,
        offset=offset
    )

    return {
        "document_id": document_id,
        "history": history,
        "count": len(history)
    }


@router.get("/audit/users/{user_id}")
async def get_user_audit_activity(
    user_id: str,
    start_date: Optional[datetime] = None,
    end_date: Optional[datetime] = None,
    limit: int = Query(100, ge=1, le=500),
    offset: int = Query(0, ge=0),
    service: DocsAuditService = Depends(get_audit_service),
    current_user: dict = Depends(get_current_user)
):
    """
    Get all document activity by a specific user.

    Admin only - requires admin role to view other users' activity.
    """
    # Check if viewing own activity or is admin
    if user_id != current_user['id']:
        if current_user.get('role') not in ['ADMIN', 'SUPER_ADMIN']:
            raise HTTPException(
                status_code=403,
                detail="Cannot view other users' activity"
            )

    activity = await service.get_user_activity(
        user_id=UUID(user_id),
        tenant_id=UUID(current_user.get('tenant_id')) if current_user.get('tenant_id') else None,
        start_date=start_date,
        end_date=end_date,
        limit=limit,
        offset=offset
    )

    return {
        "user_id": user_id,
        "activity": activity,
        "count": len(activity)
    }


@router.get("/audit/tenant")
async def get_tenant_audit_activity(
    actions: Optional[str] = Query(None, description="Comma-separated action types"),
    start_date: Optional[datetime] = None,
    end_date: Optional[datetime] = None,
    limit: int = Query(100, ge=1, le=500),
    offset: int = Query(0, ge=0),
    service: DocsAuditService = Depends(get_audit_service),
    current_user: dict = Depends(get_current_user)
):
    """
    Get all document activity for the current tenant.

    Admin only.
    """
    if current_user.get('role') not in ['ADMIN', 'SUPER_ADMIN']:
        raise HTTPException(status_code=403, detail="Admin access required")

    tenant_id = current_user.get('tenant_id')
    if not tenant_id:
        raise HTTPException(status_code=400, detail="Tenant ID not found")

    action_list = None
    if actions:
        try:
            action_list = [AuditAction(a.strip()) for a in actions.split(",")]
        except ValueError:
            pass

    activity = await service.get_tenant_activity(
        tenant_id=UUID(tenant_id),
        actions=action_list,
        start_date=start_date,
        end_date=end_date,
        limit=limit,
        offset=offset
    )

    return {
        "tenant_id": tenant_id,
        "activity": activity,
        "count": len(activity)
    }


@router.get("/audit/stats")
async def get_audit_stats(
    document_id: Optional[str] = None,
    start_date: Optional[datetime] = None,
    end_date: Optional[datetime] = None,
    service: DocsAuditService = Depends(get_audit_service),
    current_user: dict = Depends(get_current_user)
):
    """
    Get audit activity statistics.

    Returns action counts, unique users, and unique documents.
    """
    tenant_id = current_user.get('tenant_id')

    stats = await service.get_activity_stats(
        tenant_id=UUID(tenant_id) if tenant_id else None,
        document_id=UUID(document_id) if document_id else None,
        start_date=start_date,
        end_date=end_date
    )

    return stats


@router.post("/audit/search")
async def search_audit_logs(
    request: AuditSearchRequest,
    limit: int = Query(100, ge=1, le=500),
    offset: int = Query(0, ge=0),
    service: DocsAuditService = Depends(get_audit_service),
    current_user: dict = Depends(get_current_user)
):
    """
    Search audit logs with multiple filters.

    Admin only.
    """
    if current_user.get('role') not in ['ADMIN', 'SUPER_ADMIN']:
        raise HTTPException(status_code=403, detail="Admin access required")

    tenant_id = current_user.get('tenant_id')
    if not tenant_id:
        raise HTTPException(status_code=400, detail="Tenant ID not found")

    # Parse actions
    action_list = None
    if request.actions:
        try:
            action_list = [AuditAction(a) for a in request.actions]
        except ValueError:
            pass

    # Parse UUIDs
    user_ids = [UUID(u) for u in request.user_ids] if request.user_ids else None
    document_ids = [UUID(d) for d in request.document_ids] if request.document_ids else None

    results = await service.search_audit_logs(
        tenant_id=UUID(tenant_id),
        search_term=request.search_term,
        actions=action_list,
        user_ids=user_ids,
        document_ids=document_ids,
        start_date=request.start_date,
        end_date=request.end_date,
        ip_address=request.ip_address,
        limit=limit,
        offset=offset
    )

    return results


@router.get("/audit/export")
async def export_audit_logs(
    start_date: datetime,
    end_date: datetime,
    format: str = Query("json", pattern="^(json|csv)$"),
    service: DocsAuditService = Depends(get_audit_service),
    current_user: dict = Depends(get_current_user)
):
    """
    Export audit logs for compliance reporting.

    Admin only. Supports JSON and CSV formats.
    """
    if current_user.get('role') not in ['ADMIN', 'SUPER_ADMIN']:
        raise HTTPException(status_code=403, detail="Admin access required")

    tenant_id = current_user.get('tenant_id')
    if not tenant_id:
        raise HTTPException(status_code=400, detail="Tenant ID not found")

    result = await service.export_audit_logs(
        tenant_id=UUID(tenant_id),
        start_date=start_date,
        end_date=end_date,
        format=format
    )

    if format == "csv":
        return Response(
            content=result['data'],
            media_type="text/csv",
            headers={
                "Content-Disposition": f"attachment; filename=audit_logs_{start_date.date()}_{end_date.date()}.csv"
            }
        )

    return result


# =============================================================================
# SIGNATURE ENDPOINTS
# =============================================================================

@router.post("/signatures/request")
async def create_signature_request(
    request: CreateSignatureRequest,
    service: DocsSignatureService = Depends(get_signature_service),
    current_user: dict = Depends(get_current_user)
):
    """
    Create a signature request for a document.

    Sends signature requests to all specified signers.
    """
    user_id = UUID(current_user['id'])
    tenant_id = current_user.get('tenant_id')

    signers = [
        {
            "email": s.email,
            "name": s.name or s.email,
            "role": s.role,
            "order": s.order
        }
        for s in request.signers
    ]

    try:
        result = await service.create_signature_request(
            document_id=UUID(request.document_id),
            document_hash=request.document_hash,
            requested_by=user_id,
            signers=signers,
            subject=request.subject,
            message=request.message,
            expires_in_days=request.expires_in_days,
            signature_type=SignatureType(request.signature_type),
            require_signing_order=request.require_signing_order,
            tenant_id=UUID(tenant_id) if tenant_id else None
        )

        return result

    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/signatures/requests/{request_id}")
async def get_signature_request(
    request_id: str,
    service: DocsSignatureService = Depends(get_signature_service),
    current_user: dict = Depends(get_current_user)
):
    """Get signature request details."""
    result = await service.get_signature_request(UUID(request_id))

    if not result:
        raise HTTPException(status_code=404, detail="Signature request not found")

    return result


@router.get("/signatures/documents/{document_id}")
async def get_document_signatures(
    document_id: str,
    include_completed: bool = Query(True),
    service: DocsSignatureService = Depends(get_signature_service),
    current_user: dict = Depends(get_current_user)
):
    """Get all signature requests for a document."""
    requests = await service.get_document_signature_requests(
        document_id=UUID(document_id),
        include_completed=include_completed
    )

    return {
        "document_id": document_id,
        "signature_requests": requests,
        "count": len(requests)
    }


@router.get("/signatures/pending")
async def get_pending_signatures(
    limit: int = Query(50, ge=1, le=200),
    service: DocsSignatureService = Depends(get_signature_service),
    current_user: dict = Depends(get_current_user)
):
    """Get documents pending current user's signature."""
    # Try email or username (username is typically email)
    user_email = current_user.get('email') or current_user.get('username')
    if not user_email:
        raise HTTPException(status_code=400, detail="User email not found")

    pending = await service.get_pending_signatures(
        user_email=user_email,
        limit=limit
    )

    return {
        "pending": pending,
        "count": len(pending)
    }


@router.post("/signatures/signers/{signer_id}/sign")
async def sign_document(
    signer_id: str,
    request: SignDocumentRequest,
    service: DocsSignatureService = Depends(get_signature_service)
):
    """
    Sign a document.

    Requires the signer's unique access token.
    No authentication required (token-based access).
    """
    from fastapi import Request as FastAPIRequest
    from starlette.requests import Request

    # Get IP from request context (if available)
    ip_address = None
    user_agent = None

    try:
        result = await service.sign_document(
            signer_id=UUID(signer_id),
            access_token=request.access_token,
            signature_data=request.signature_data,
            ip_address=ip_address,
            user_agent=user_agent
        )

        if "error" in result:
            raise HTTPException(status_code=400, detail=result["error"])

        return result

    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/signatures/signers/{signer_id}/decline")
async def decline_signature(
    signer_id: str,
    request: DeclineSignatureRequest,
    service: DocsSignatureService = Depends(get_signature_service)
):
    """
    Decline to sign a document.

    Requires the signer's unique access token.
    """
    try:
        result = await service.decline_signature(
            signer_id=UUID(signer_id),
            access_token=request.access_token,
            reason=request.reason
        )

        if "error" in result:
            raise HTTPException(status_code=400, detail=result["error"])

        return result

    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/signatures/requests/{request_id}/cancel")
async def cancel_signature_request(
    request_id: str,
    reason: Optional[str] = None,
    service: DocsSignatureService = Depends(get_signature_service),
    current_user: dict = Depends(get_current_user)
):
    """Cancel a signature request."""
    user_id = UUID(current_user['id'])

    try:
        result = await service.cancel_signature_request(
            request_id=UUID(request_id),
            cancelled_by=user_id,
            reason=reason
        )

        if "error" in result:
            raise HTTPException(status_code=400, detail=result["error"])

        return result

    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/signatures/verify/{document_id}")
async def verify_document_signatures(
    document_id: str,
    document_hash: str = Query(..., description="Current document hash"),
    service: DocsSignatureService = Depends(get_signature_service),
    current_user: dict = Depends(get_current_user)
):
    """
    Verify signatures on a document.

    Checks:
    - Signature certificates
    - Document integrity (not modified after signing)
    """
    result = await service.verify_signature(
        document_id=UUID(document_id),
        document_hash=document_hash
    )

    return result


@router.get("/signatures/requests/{request_id}/certificate")
async def get_signature_certificate(
    request_id: str,
    service: DocsSignatureService = Depends(get_signature_service),
    current_user: dict = Depends(get_current_user)
):
    """
    Get signature certificate for a completed request.

    Returns a legally-binding certificate documenting all signatures.
    """
    certificate = await service.get_signature_certificate(UUID(request_id))

    if not certificate:
        raise HTTPException(
            status_code=404,
            detail="Certificate not found (request may not be completed)"
        )

    return certificate


# =============================================================================
# ACTION TYPES REFERENCE
# =============================================================================

@router.get("/audit/actions")
async def list_audit_action_types():
    """List all available audit action types."""
    return {
        "actions": [
            {"value": a.value, "name": a.name}
            for a in AuditAction
        ]
    }
