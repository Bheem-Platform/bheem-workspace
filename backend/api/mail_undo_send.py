"""
Bheem Workspace - Undo Send API
Send emails with undo capability (delayed sending)
"""
from fastapi import APIRouter, Depends, HTTPException, status, Request, File, UploadFile, Form
from pydantic import BaseModel, EmailStr
from typing import Optional, List
import json
import base64
from core.security import get_current_user
from services.undo_send_service import undo_send_service, DEFAULT_UNDO_DELAY

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
        MAIL_SEND = "10/minute"

router = APIRouter(prefix="/mail/send-with-undo", tags=["Mail Undo Send"])


# ===========================================
# Schemas
# ===========================================

class SendWithUndoRequest(BaseModel):
    to: List[EmailStr]
    cc: Optional[List[EmailStr]] = []
    bcc: Optional[List[EmailStr]] = []
    subject: str
    body: str
    is_html: Optional[bool] = True
    delay_seconds: Optional[int] = DEFAULT_UNDO_DELAY  # Default 5 seconds


class SendWithUndoResponse(BaseModel):
    success: bool
    message: str
    queue_id: str
    send_at: str
    delay_seconds: int
    can_undo: bool


class QueuedEmailStatus(BaseModel):
    queue_id: str
    status: str
    send_at: str
    remaining_seconds: int
    can_undo: bool
    email_data: dict


class CancelResponse(BaseModel):
    success: bool
    message: str
    email_data: Optional[dict] = None


# ===========================================
# Undo Send Endpoints
# ===========================================

@router.post("", response_model=SendWithUndoResponse)
@limiter.limit(RateLimits.MAIL_SEND)
async def send_with_undo(
    request: Request,
    send_data: SendWithUndoRequest,
    current_user: dict = Depends(get_current_user)
):
    """
    Send an email with undo capability.

    The email is queued and will be sent after the delay period.
    During the delay, the user can cancel the send.

    Default delay is 5 seconds. Maximum allowed is 120 seconds.
    """
    user_id = current_user.get("id") or current_user.get("user_id")

    # Validate recipients
    if not send_data.to:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="At least one recipient is required"
        )

    # Validate delay
    delay = min(max(5, send_data.delay_seconds or DEFAULT_UNDO_DELAY), 120)  # 5-120 seconds

    # Build email data
    email_data = {
        "to": send_data.to,
        "cc": send_data.cc or [],
        "bcc": send_data.bcc or [],
        "subject": send_data.subject,
        "body": send_data.body,
        "is_html": send_data.is_html if send_data.is_html is not None else True
    }

    try:
        result = await undo_send_service.queue_email(
            user_id=user_id,
            email_data=email_data,
            delay_seconds=delay
        )

        return SendWithUndoResponse(
            success=True,
            message=f"Email queued. Will be sent in {delay} seconds unless cancelled.",
            queue_id=result["queue_id"],
            send_at=result["send_at"],
            delay_seconds=result["delay_seconds"],
            can_undo=result["can_undo"]
        )

    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e)
        )


@router.post("/attachments", response_model=SendWithUndoResponse)
@limiter.limit(RateLimits.MAIL_SEND)
async def send_with_undo_attachments(
    request: Request,
    to: str = Form(...),
    subject: str = Form(...),
    body: str = Form(...),
    cc: str = Form("[]"),
    bcc: str = Form("[]"),
    is_html: str = Form("true"),
    delay_seconds: str = Form("5"),
    attachments: List[UploadFile] = File(default=[]),
    current_user: dict = Depends(get_current_user)
):
    """
    Send an email with attachments and undo capability.

    Uses multipart form data to accept file attachments.
    Files are base64 encoded and included in the email.
    """
    user_id = current_user.get("id") or current_user.get("user_id")

    # Parse JSON arrays
    try:
        to_list = json.loads(to)
        cc_list = json.loads(cc) if cc else []
        bcc_list = json.loads(bcc) if bcc else []
    except json.JSONDecodeError:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid JSON format for recipients"
        )

    # Validate recipients
    if not to_list:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="At least one recipient is required"
        )

    # Parse other fields
    is_html_bool = is_html.lower() == "true"
    delay = min(max(5, int(delay_seconds)), 120)

    # Process attachments
    attachment_data = []
    for file in attachments:
        content = await file.read()
        attachment_data.append({
            "filename": file.filename,
            "content_type": file.content_type or "application/octet-stream",
            "content": base64.b64encode(content).decode("utf-8"),
            "size": len(content)
        })

    # Build email data
    email_data = {
        "to": to_list,
        "cc": cc_list,
        "bcc": bcc_list,
        "subject": subject,
        "body": body,
        "is_html": is_html_bool,
        "attachments": attachment_data
    }

    try:
        result = await undo_send_service.queue_email(
            user_id=user_id,
            email_data=email_data,
            delay_seconds=delay
        )

        return SendWithUndoResponse(
            success=True,
            message=f"Email with {len(attachment_data)} attachment(s) queued. Will be sent in {delay} seconds.",
            queue_id=result["queue_id"],
            send_at=result["send_at"],
            delay_seconds=result["delay_seconds"],
            can_undo=result["can_undo"]
        )

    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e)
        )


@router.get("/{queue_id}", response_model=QueuedEmailStatus)
@limiter.limit("30/minute")
async def get_queued_status(
    request: Request,
    queue_id: str,
    current_user: dict = Depends(get_current_user)
):
    """
    Get the status of a queued email.

    Returns remaining time and whether it can still be cancelled.
    """
    user_id = current_user.get("id") or current_user.get("user_id")

    result = await undo_send_service.get_queued_email(queue_id, user_id)

    if not result:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Queued email not found"
        )

    return QueuedEmailStatus(
        queue_id=result["queue_id"],
        status=result["status"],
        send_at=result["send_at"],
        remaining_seconds=result["remaining_seconds"],
        can_undo=result["can_undo"],
        email_data=result["email_data"]
    )


@router.delete("/{queue_id}", response_model=CancelResponse)
@limiter.limit(RateLimits.MAIL_SEND)
async def cancel_queued_send(
    request: Request,
    queue_id: str,
    current_user: dict = Depends(get_current_user)
):
    """
    Cancel a queued email before it's sent.

    This is the "Undo" action. Only works while the email is still pending
    and within the delay window.
    """
    user_id = current_user.get("id") or current_user.get("user_id")

    result = await undo_send_service.cancel_send(queue_id, user_id)

    if not result.get("success"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=result.get("error", "Failed to cancel email")
        )

    return CancelResponse(
        success=True,
        message="Email cancelled successfully. Your draft has been preserved.",
        email_data=result.get("email_data")
    )
