"""
Bheem Workspace - Confidential Email API
API endpoints for managing confidential/expiring emails
Phase 9: Email Enhancements
"""
from typing import Optional, List
from uuid import UUID
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, status, Query, Request
from pydantic import BaseModel, Field

from core.database import get_db
from core.security import get_current_user
from services.mail_confidential_service import ConfidentialEmailService

router = APIRouter(prefix="/mail/confidential", tags=["Mail - Confidential"])


# =============================================
# Pydantic Schemas
# =============================================

class ConfidentialEmailCreate(BaseModel):
    message_id: str = Field(..., description="Message-ID of the sent email")
    expires_in_hours: Optional[int] = Field(None, ge=1, le=8760, description="Hours until expiration (max 1 year)")
    passcode: Optional[str] = Field(None, max_length=100)
    passcode_type: str = Field('none', pattern='^(sms|email|none)$')
    no_forward: bool = True
    no_copy: bool = True
    no_print: bool = True
    no_download: bool = True


class ConfidentialEmailResponse(BaseModel):
    id: str
    message_id: str
    expires_at: Optional[str]
    passcode_type: str
    no_forward: bool
    no_copy: bool
    no_print: bool
    no_download: bool
    is_revoked: bool
    revoked_at: Optional[str]
    recipient_accesses: List[dict]
    created_at: str

    class Config:
        from_attributes = True


class AccessCheckRequest(BaseModel):
    passcode: Optional[str] = None


class AccessCheckResponse(BaseModel):
    allowed: bool
    reason: Optional[str] = None
    restrictions: Optional[dict] = None
    expires_at: Optional[str] = None


class UpdateExpirationRequest(BaseModel):
    expires_at: Optional[datetime] = None


# =============================================
# API Endpoints
# =============================================

@router.post("", response_model=ConfidentialEmailResponse, status_code=status.HTTP_201_CREATED)
async def create_confidential_email(
    data: ConfidentialEmailCreate,
    current_user: dict = Depends(get_current_user),
    db = Depends(get_db)
):
    """Create confidential email settings for a sent email"""
    service = ConfidentialEmailService(db)

    confidential = await service.create_confidential_email(
        user_id=current_user["user_id"],
        message_id=data.message_id,
        expires_in_hours=data.expires_in_hours,
        passcode=data.passcode,
        passcode_type=data.passcode_type,
        no_forward=data.no_forward,
        no_copy=data.no_copy,
        no_print=data.no_print,
        no_download=data.no_download
    )

    return _to_response(confidential)


@router.get("", response_model=List[ConfidentialEmailResponse])
async def list_confidential_emails(
    include_expired: bool = Query(False),
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=100),
    current_user: dict = Depends(get_current_user),
    db = Depends(get_db)
):
    """List all confidential emails for the current user"""
    service = ConfidentialEmailService(db)

    emails = await service.get_user_confidential_emails(
        user_id=current_user["user_id"],
        include_expired=include_expired,
        skip=skip,
        limit=limit
    )

    return [_to_response(e) for e in emails]


@router.get("/{message_id}", response_model=ConfidentialEmailResponse)
async def get_confidential_email(
    message_id: str,
    current_user: dict = Depends(get_current_user),
    db = Depends(get_db)
):
    """Get confidential settings for a specific message"""
    service = ConfidentialEmailService(db)

    confidential = await service.get_by_message_id(message_id)

    if not confidential:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Confidential email not found"
        )

    # Only owner can view details
    if str(confidential.user_id) != str(current_user["user_id"]):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not authorized to view this confidential email"
        )

    return _to_response(confidential)


@router.post("/{message_id}/check-access", response_model=AccessCheckResponse)
async def check_access(
    message_id: str,
    data: AccessCheckRequest,
    request: Request,
    db = Depends(get_db)
):
    """Check if recipient can access a confidential email (no auth required)"""
    service = ConfidentialEmailService(db)

    # Get recipient email from request headers or body
    recipient_email = request.headers.get("X-Recipient-Email", "unknown")

    result = await service.check_access(
        message_id=message_id,
        recipient_email=recipient_email,
        passcode=data.passcode
    )

    # Record access if allowed
    if result.get("allowed"):
        client_ip = request.client.host if request.client else None
        await service.record_access(message_id, recipient_email, client_ip)

    return AccessCheckResponse(**result)


@router.post("/{message_id}/revoke", status_code=status.HTTP_200_OK)
async def revoke_access(
    message_id: str,
    current_user: dict = Depends(get_current_user),
    db = Depends(get_db)
):
    """Revoke access to a confidential email"""
    service = ConfidentialEmailService(db)

    success = await service.revoke(
        user_id=current_user["user_id"],
        message_id=message_id
    )

    if not success:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Confidential email not found"
        )

    return {"message": "Access revoked"}


@router.patch("/{message_id}/expiration")
async def update_expiration(
    message_id: str,
    data: UpdateExpirationRequest,
    current_user: dict = Depends(get_current_user),
    db = Depends(get_db)
):
    """Update expiration time for a confidential email"""
    service = ConfidentialEmailService(db)

    success = await service.update_expiration(
        user_id=current_user["user_id"],
        message_id=message_id,
        new_expires_at=data.expires_at
    )

    if not success:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Confidential email not found"
        )

    return {"message": "Expiration updated"}


@router.delete("/{message_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_confidential_email(
    message_id: str,
    current_user: dict = Depends(get_current_user),
    db = Depends(get_db)
):
    """Delete confidential email settings"""
    service = ConfidentialEmailService(db)

    success = await service.delete(
        user_id=current_user["user_id"],
        message_id=message_id
    )

    if not success:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Confidential email not found"
        )


# =============================================
# Helper Functions
# =============================================

def _to_response(confidential) -> dict:
    """Convert model to response dict"""
    return {
        "id": str(confidential.id),
        "message_id": confidential.message_id,
        "expires_at": confidential.expires_at.isoformat() if confidential.expires_at else None,
        "passcode_type": confidential.passcode_type,
        "no_forward": confidential.no_forward,
        "no_copy": confidential.no_copy,
        "no_print": confidential.no_print,
        "no_download": confidential.no_download,
        "is_revoked": confidential.is_revoked,
        "revoked_at": confidential.revoked_at.isoformat() if confidential.revoked_at else None,
        "recipient_accesses": confidential.recipient_accesses or [],
        "created_at": confidential.created_at.isoformat()
    }
