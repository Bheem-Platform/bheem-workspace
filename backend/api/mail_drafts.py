"""
Bheem Workspace - Mail Drafts API
Server-side draft management for cross-device sync
"""
from fastapi import APIRouter, Depends, HTTPException, status, Query, Request
from pydantic import BaseModel
from typing import Optional, List, Dict, Any
from uuid import UUID
from core.security import get_current_user
from core.database import get_db
from sqlalchemy.ext.asyncio import AsyncSession
from services.mail_draft_service import mail_draft_service

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

router = APIRouter(prefix="/mail/drafts", tags=["Mail Drafts"])


# ===========================================
# Schemas
# ===========================================

class AddressSchema(BaseModel):
    name: Optional[str] = ""
    email: str


class CreateDraftRequest(BaseModel):
    subject: Optional[str] = ""
    body: Optional[str] = ""
    is_html: Optional[bool] = True
    to_addresses: Optional[List[AddressSchema]] = []
    cc_addresses: Optional[List[AddressSchema]] = []
    bcc_addresses: Optional[List[AddressSchema]] = []
    attachments: Optional[List[Dict[str, Any]]] = []
    reply_to_message_id: Optional[str] = None
    forward_message_id: Optional[str] = None
    reply_type: Optional[str] = None  # 'reply', 'reply_all', 'forward'


class UpdateDraftRequest(BaseModel):
    subject: Optional[str] = None
    body: Optional[str] = None
    is_html: Optional[bool] = None
    to_addresses: Optional[List[AddressSchema]] = None
    cc_addresses: Optional[List[AddressSchema]] = None
    bcc_addresses: Optional[List[AddressSchema]] = None
    attachments: Optional[List[Dict[str, Any]]] = None
    reply_to_message_id: Optional[str] = None
    forward_message_id: Optional[str] = None
    reply_type: Optional[str] = None


class DraftResponse(BaseModel):
    id: str
    subject: str
    body: str
    is_html: bool
    to_addresses: List[Dict[str, str]]
    cc_addresses: List[Dict[str, str]]
    bcc_addresses: List[Dict[str, str]]
    attachments: List[Dict[str, Any]]
    reply_to_message_id: Optional[str]
    forward_message_id: Optional[str]
    reply_type: Optional[str]
    created_at: Optional[str]
    updated_at: Optional[str]


class DraftListResponse(BaseModel):
    drafts: List[DraftResponse]
    total: int
    page: int
    limit: int


# ===========================================
# Draft Endpoints
# ===========================================

@router.post("", response_model=DraftResponse)
@limiter.limit(RateLimits.MAIL_READ)
async def create_draft(
    request_obj: Request,
    request: CreateDraftRequest,
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Create a new email draft.

    Drafts are saved server-side for cross-device sync.
    """
    user_id = current_user.get("id") or current_user.get("user_id")

    draft = await mail_draft_service.create_draft(
        db=db,
        user_id=UUID(user_id),
        subject=request.subject or "",
        body=request.body or "",
        is_html=request.is_html if request.is_html is not None else True,
        to_addresses=[addr.model_dump() for addr in request.to_addresses] if request.to_addresses else [],
        cc_addresses=[addr.model_dump() for addr in request.cc_addresses] if request.cc_addresses else [],
        bcc_addresses=[addr.model_dump() for addr in request.bcc_addresses] if request.bcc_addresses else [],
        attachments=request.attachments or [],
        reply_to_message_id=request.reply_to_message_id,
        forward_message_id=request.forward_message_id,
        reply_type=request.reply_type
    )

    return DraftResponse(**mail_draft_service.draft_to_dict(draft))


@router.get("", response_model=DraftListResponse)
@limiter.limit(RateLimits.MAIL_READ)
async def list_drafts(
    request: Request,
    page: int = Query(1, ge=1, description="Page number"),
    limit: int = Query(50, ge=1, le=100, description="Items per page"),
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    List all drafts for the current user.

    Returns drafts sorted by last updated time (newest first).
    """
    user_id = current_user.get("id") or current_user.get("user_id")
    offset = (page - 1) * limit

    drafts = await mail_draft_service.list_drafts(
        db=db,
        user_id=UUID(user_id),
        limit=limit,
        offset=offset
    )

    total = await mail_draft_service.count_drafts(db, UUID(user_id))

    return DraftListResponse(
        drafts=[DraftResponse(**mail_draft_service.draft_to_dict(d)) for d in drafts],
        total=total,
        page=page,
        limit=limit
    )


@router.get("/{draft_id}", response_model=DraftResponse)
@limiter.limit(RateLimits.MAIL_READ)
async def get_draft(
    request: Request,
    draft_id: UUID,
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Get a single draft by ID.
    """
    user_id = current_user.get("id") or current_user.get("user_id")

    draft = await mail_draft_service.get_draft(
        db=db,
        draft_id=draft_id,
        user_id=UUID(user_id)
    )

    if not draft:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Draft not found"
        )

    return DraftResponse(**mail_draft_service.draft_to_dict(draft))


@router.put("/{draft_id}", response_model=DraftResponse)
@limiter.limit(RateLimits.MAIL_READ)
async def update_draft(
    request_obj: Request,
    draft_id: UUID,
    request: UpdateDraftRequest,
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Update an existing draft.

    Only provided fields will be updated (partial update).
    This endpoint is used for auto-save functionality.
    """
    user_id = current_user.get("id") or current_user.get("user_id")

    # Build update data from non-None fields
    update_data = {}

    if request.subject is not None:
        update_data['subject'] = request.subject
    if request.body is not None:
        update_data['body'] = request.body
    if request.is_html is not None:
        update_data['is_html'] = request.is_html
    if request.to_addresses is not None:
        update_data['to_addresses'] = [addr.model_dump() for addr in request.to_addresses]
    if request.cc_addresses is not None:
        update_data['cc_addresses'] = [addr.model_dump() for addr in request.cc_addresses]
    if request.bcc_addresses is not None:
        update_data['bcc_addresses'] = [addr.model_dump() for addr in request.bcc_addresses]
    if request.attachments is not None:
        update_data['attachments'] = request.attachments
    if request.reply_to_message_id is not None:
        update_data['reply_to_message_id'] = request.reply_to_message_id
    if request.forward_message_id is not None:
        update_data['forward_message_id'] = request.forward_message_id
    if request.reply_type is not None:
        update_data['reply_type'] = request.reply_type

    draft = await mail_draft_service.update_draft(
        db=db,
        draft_id=draft_id,
        user_id=UUID(user_id),
        **update_data
    )

    if not draft:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Draft not found"
        )

    return DraftResponse(**mail_draft_service.draft_to_dict(draft))


@router.delete("/{draft_id}")
@limiter.limit(RateLimits.MAIL_READ)
async def delete_draft(
    request: Request,
    draft_id: UUID,
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Delete a draft.
    """
    user_id = current_user.get("id") or current_user.get("user_id")

    deleted = await mail_draft_service.delete_draft(
        db=db,
        draft_id=draft_id,
        user_id=UUID(user_id)
    )

    if not deleted:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Draft not found"
        )

    return {"success": True, "message": "Draft deleted"}


@router.post("/{draft_id}/send")
@limiter.limit("10/minute")
async def send_draft(
    request: Request,
    draft_id: UUID,
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Send a draft as an email.

    The draft will be deleted after successful sending.
    """
    user_id = current_user.get("id") or current_user.get("user_id")

    # Get the draft
    draft = await mail_draft_service.get_draft(
        db=db,
        draft_id=draft_id,
        user_id=UUID(user_id)
    )

    if not draft:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Draft not found"
        )

    # Validate recipients
    if not draft.to_addresses:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="At least one recipient is required"
        )

    # Import mail session service to get credentials
    from services.mail_session_service import mail_session_service
    from services.mailcow_service import mailcow_service

    credentials = mail_session_service.get_credentials(user_id)
    if not credentials:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Mail session expired. Please login again."
        )

    # Extract email addresses
    to_emails = [addr.get('email') for addr in draft.to_addresses if addr.get('email')]
    cc_emails = [addr.get('email') for addr in (draft.cc_addresses or []) if addr.get('email')]

    # Send the email
    try:
        success = mailcow_service.send_email(
            from_email=credentials['email'],
            password=credentials['password'],
            to=to_emails,
            subject=draft.subject or "(No Subject)",
            body=draft.body or "",
            cc=cc_emails if cc_emails else None,
            is_html=draft.is_html
        )

        if not success:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Failed to send email"
            )

        # Delete the draft after successful send
        await mail_draft_service.delete_draft(
            db=db,
            draft_id=draft_id,
            user_id=UUID(user_id)
        )

        return {
            "success": True,
            "message": "Email sent successfully",
            "to": to_emails
        }

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to send email: {str(e)}"
        )
