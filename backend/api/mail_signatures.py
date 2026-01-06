"""
Bheem Workspace - Mail Signatures API
Manage email signatures for users
"""
from fastapi import APIRouter, Depends, HTTPException, status, Request
from pydantic import BaseModel
from typing import Optional, List
from uuid import UUID
from core.security import get_current_user
from core.database import get_db
from sqlalchemy.ext.asyncio import AsyncSession
from services.mail_signature_service import mail_signature_service

# Rate limiting
try:
    from middleware.rate_limit import limiter, RateLimits
except ImportError:
    class DummyLimiter:
        def limit(self, limit_string):
            def decorator(func):
                return func
            return decorator
    limiter = DummyLimiter()

    class RateLimits:
        MAIL_READ = "100/minute"

router = APIRouter(prefix="/mail/signatures", tags=["Mail Signatures"])


# ===========================================
# Schemas
# ===========================================

class CreateSignatureRequest(BaseModel):
    name: str
    content: str
    is_html: Optional[bool] = True
    is_default: Optional[bool] = False


class UpdateSignatureRequest(BaseModel):
    name: Optional[str] = None
    content: Optional[str] = None
    is_html: Optional[bool] = None
    is_default: Optional[bool] = None


class SignatureResponse(BaseModel):
    id: str
    name: str
    content: str
    is_html: bool
    is_default: bool
    created_at: Optional[str]
    updated_at: Optional[str]


class SignatureListResponse(BaseModel):
    signatures: List[SignatureResponse]
    count: int


# ===========================================
# Signature Endpoints
# ===========================================

@router.post("", response_model=SignatureResponse)
@limiter.limit(RateLimits.MAIL_READ)
async def create_signature(
    request_obj: Request,
    request: CreateSignatureRequest,
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Create a new email signature.

    Users can have multiple signatures. The first signature
    is automatically set as default.
    """
    user_id = current_user.get("id") or current_user.get("user_id")

    # Validate
    if not request.name or not request.name.strip():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Signature name is required"
        )

    if not request.content:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Signature content is required"
        )

    signature = await mail_signature_service.create_signature(
        db=db,
        user_id=UUID(user_id),
        name=request.name.strip(),
        content=request.content,
        is_html=request.is_html if request.is_html is not None else True,
        is_default=request.is_default if request.is_default is not None else False
    )

    return SignatureResponse(**mail_signature_service.signature_to_dict(signature))


@router.get("", response_model=SignatureListResponse)
@limiter.limit(RateLimits.MAIL_READ)
async def list_signatures(
    request: Request,
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    List all signatures for the current user.

    Returns signatures with default signature first.
    """
    user_id = current_user.get("id") or current_user.get("user_id")

    signatures = await mail_signature_service.list_signatures(
        db=db,
        user_id=UUID(user_id)
    )

    return SignatureListResponse(
        signatures=[SignatureResponse(**mail_signature_service.signature_to_dict(s)) for s in signatures],
        count=len(signatures)
    )


@router.get("/default", response_model=Optional[SignatureResponse])
@limiter.limit(RateLimits.MAIL_READ)
async def get_default_signature(
    request: Request,
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Get the user's default signature.

    Returns null if no signatures exist.
    """
    user_id = current_user.get("id") or current_user.get("user_id")

    signature = await mail_signature_service.get_default_signature(
        db=db,
        user_id=UUID(user_id)
    )

    if not signature:
        return None

    return SignatureResponse(**mail_signature_service.signature_to_dict(signature))


@router.get("/{signature_id}", response_model=SignatureResponse)
@limiter.limit(RateLimits.MAIL_READ)
async def get_signature(
    request: Request,
    signature_id: UUID,
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Get a single signature by ID.
    """
    user_id = current_user.get("id") or current_user.get("user_id")

    signature = await mail_signature_service.get_signature(
        db=db,
        signature_id=signature_id,
        user_id=UUID(user_id)
    )

    if not signature:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Signature not found"
        )

    return SignatureResponse(**mail_signature_service.signature_to_dict(signature))


@router.put("/{signature_id}", response_model=SignatureResponse)
@limiter.limit(RateLimits.MAIL_READ)
async def update_signature(
    request_obj: Request,
    signature_id: UUID,
    request: UpdateSignatureRequest,
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Update an existing signature.

    Only provided fields will be updated (partial update).
    """
    user_id = current_user.get("id") or current_user.get("user_id")

    # Build update data from non-None fields
    update_data = {}

    if request.name is not None:
        if not request.name.strip():
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Signature name cannot be empty"
            )
        update_data['name'] = request.name.strip()
    if request.content is not None:
        update_data['content'] = request.content
    if request.is_html is not None:
        update_data['is_html'] = request.is_html
    if request.is_default is not None:
        update_data['is_default'] = request.is_default

    signature = await mail_signature_service.update_signature(
        db=db,
        signature_id=signature_id,
        user_id=UUID(user_id),
        **update_data
    )

    if not signature:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Signature not found"
        )

    return SignatureResponse(**mail_signature_service.signature_to_dict(signature))


@router.delete("/{signature_id}")
@limiter.limit(RateLimits.MAIL_READ)
async def delete_signature(
    request: Request,
    signature_id: UUID,
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Delete a signature.

    If deleting the default signature, another signature
    will be set as the new default.
    """
    user_id = current_user.get("id") or current_user.get("user_id")

    deleted = await mail_signature_service.delete_signature(
        db=db,
        signature_id=signature_id,
        user_id=UUID(user_id)
    )

    if not deleted:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Signature not found"
        )

    return {"success": True, "message": "Signature deleted"}


@router.post("/{signature_id}/set-default")
@limiter.limit(RateLimits.MAIL_READ)
async def set_default_signature(
    request: Request,
    signature_id: UUID,
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Set a signature as the default.

    Only one signature can be default at a time.
    """
    user_id = current_user.get("id") or current_user.get("user_id")

    success = await mail_signature_service.set_default(
        db=db,
        signature_id=signature_id,
        user_id=UUID(user_id)
    )

    if not success:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Signature not found"
        )

    return {"success": True, "message": "Default signature updated"}
