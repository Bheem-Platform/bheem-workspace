"""
Bheem Workspace - Scheduled Email API
Schedule emails for future delivery
"""
from fastapi import APIRouter, Depends, HTTPException, status, Query, Request
from pydantic import BaseModel, EmailStr
from typing import Optional, List, Dict, Any
from uuid import UUID
from datetime import datetime
from core.security import get_current_user
from core.database import get_db
from sqlalchemy.ext.asyncio import AsyncSession
from services.email_scheduler_service import email_scheduler_service

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

router = APIRouter(prefix="/mail/scheduled", tags=["Scheduled Emails"])


# ===========================================
# Schemas
# ===========================================

class ScheduleEmailRequest(BaseModel):
    scheduled_at: datetime
    to: List[EmailStr]
    cc: Optional[List[EmailStr]] = []
    bcc: Optional[List[EmailStr]] = []
    subject: str
    body: str
    is_html: Optional[bool] = True


class UpdateScheduledEmailRequest(BaseModel):
    scheduled_at: Optional[datetime] = None
    to: Optional[List[EmailStr]] = None
    cc: Optional[List[EmailStr]] = None
    bcc: Optional[List[EmailStr]] = None
    subject: Optional[str] = None
    body: Optional[str] = None
    is_html: Optional[bool] = None


class ScheduledEmailResponse(BaseModel):
    id: str
    scheduled_at: str
    status: str
    email_data: Dict[str, Any]
    sent_at: Optional[str]
    error_message: Optional[str]
    created_at: Optional[str]


class ScheduledEmailListResponse(BaseModel):
    scheduled_emails: List[ScheduledEmailResponse]
    count: int


# ===========================================
# Scheduled Email Endpoints
# ===========================================

@router.post("", response_model=ScheduledEmailResponse)
@limiter.limit(RateLimits.MAIL_SEND)
async def schedule_email(
    request_obj: Request,
    request: ScheduleEmailRequest,
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Schedule an email for future delivery.

    The email will be sent at the specified time using the user's
    mail session credentials (must be active at send time).
    """
    user_id = current_user.get("id") or current_user.get("user_id")

    # Validate scheduled time
    if request.scheduled_at <= datetime.utcnow():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Scheduled time must be in the future"
        )

    # Validate recipients
    if not request.to:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="At least one recipient is required"
        )

    # Build email data
    email_data = {
        "to": request.to,
        "cc": request.cc or [],
        "bcc": request.bcc or [],
        "subject": request.subject,
        "body": request.body,
        "is_html": request.is_html if request.is_html is not None else True
    }

    try:
        scheduled = await email_scheduler_service.schedule_email(
            db=db,
            user_id=UUID(user_id),
            scheduled_at=request.scheduled_at,
            email_data=email_data
        )

        return ScheduledEmailResponse(
            **email_scheduler_service.scheduled_to_dict(scheduled)
        )

    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )


@router.get("", response_model=ScheduledEmailListResponse)
@limiter.limit("30/minute")
async def list_scheduled_emails(
    request: Request,
    status_filter: Optional[str] = Query(
        None,
        alias="status",
        description="Filter by status: pending, sent, cancelled, failed"
    ),
    limit: int = Query(50, ge=1, le=100, description="Max results"),
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    List scheduled emails for the current user.

    Returns emails ordered by scheduled time.
    """
    user_id = current_user.get("id") or current_user.get("user_id")

    scheduled_list = await email_scheduler_service.list_scheduled_emails(
        db=db,
        user_id=UUID(user_id),
        status=status_filter,
        limit=limit
    )

    return ScheduledEmailListResponse(
        scheduled_emails=[
            ScheduledEmailResponse(**email_scheduler_service.scheduled_to_dict(s))
            for s in scheduled_list
        ],
        count=len(scheduled_list)
    )


@router.get("/{scheduled_id}", response_model=ScheduledEmailResponse)
@limiter.limit("30/minute")
async def get_scheduled_email(
    request: Request,
    scheduled_id: UUID,
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Get a single scheduled email by ID.
    """
    user_id = current_user.get("id") or current_user.get("user_id")

    scheduled = await email_scheduler_service.get_scheduled_email(
        db=db,
        scheduled_id=scheduled_id,
        user_id=UUID(user_id)
    )

    if not scheduled:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Scheduled email not found"
        )

    return ScheduledEmailResponse(
        **email_scheduler_service.scheduled_to_dict(scheduled)
    )


@router.put("/{scheduled_id}", response_model=ScheduledEmailResponse)
@limiter.limit(RateLimits.MAIL_SEND)
async def update_scheduled_email(
    request_obj: Request,
    scheduled_id: UUID,
    request: UpdateScheduledEmailRequest,
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Update a scheduled email.

    Only pending emails can be updated.
    """
    user_id = current_user.get("id") or current_user.get("user_id")

    # Build updated email data if any email fields provided
    email_data_updates = {}
    if request.to is not None:
        email_data_updates['to'] = request.to
    if request.cc is not None:
        email_data_updates['cc'] = request.cc
    if request.bcc is not None:
        email_data_updates['bcc'] = request.bcc
    if request.subject is not None:
        email_data_updates['subject'] = request.subject
    if request.body is not None:
        email_data_updates['body'] = request.body
    if request.is_html is not None:
        email_data_updates['is_html'] = request.is_html

    # Get current email_data and merge updates
    current = await email_scheduler_service.get_scheduled_email(
        db=db,
        scheduled_id=scheduled_id,
        user_id=UUID(user_id)
    )

    if not current:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Scheduled email not found"
        )

    if current.status != 'pending':
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Cannot update email with status '{current.status}'"
        )

    # Merge email_data
    new_email_data = None
    if email_data_updates:
        new_email_data = {**current.email_data, **email_data_updates}

    try:
        scheduled = await email_scheduler_service.update_scheduled_email(
            db=db,
            scheduled_id=scheduled_id,
            user_id=UUID(user_id),
            scheduled_at=request.scheduled_at,
            email_data=new_email_data
        )

        if not scheduled:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Scheduled email not found or already sent"
            )

        return ScheduledEmailResponse(
            **email_scheduler_service.scheduled_to_dict(scheduled)
        )

    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )


@router.delete("/{scheduled_id}")
@limiter.limit("30/minute")
async def cancel_scheduled_email(
    request: Request,
    scheduled_id: UUID,
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Cancel a scheduled email.

    Only pending emails can be cancelled.
    """
    user_id = current_user.get("id") or current_user.get("user_id")

    success = await email_scheduler_service.cancel_scheduled_email(
        db=db,
        scheduled_id=scheduled_id,
        user_id=UUID(user_id)
    )

    if not success:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Scheduled email not found or already sent"
        )

    return {"success": True, "message": "Scheduled email cancelled"}


@router.post("/{scheduled_id}/send-now")
@limiter.limit(RateLimits.MAIL_SEND)
async def send_scheduled_now(
    request: Request,
    scheduled_id: UUID,
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Send a scheduled email immediately.

    Cancels the scheduled time and sends right away.
    """
    user_id = current_user.get("id") or current_user.get("user_id")

    # Get the scheduled email
    scheduled = await email_scheduler_service.get_scheduled_email(
        db=db,
        scheduled_id=scheduled_id,
        user_id=UUID(user_id)
    )

    if not scheduled:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Scheduled email not found"
        )

    if scheduled.status != 'pending':
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Cannot send email with status '{scheduled.status}'"
        )

    # Get credentials
    from services.mail_session_service import mail_session_service
    from services.mailcow_service import mailcow_service

    credentials = mail_session_service.get_credentials(user_id)
    if not credentials:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Mail session expired. Please login again."
        )

    # Send immediately
    email_data = scheduled.email_data
    success = mailcow_service.send_email(
        from_email=credentials['email'],
        password=credentials['password'],
        to=email_data.get('to', []),
        subject=email_data.get('subject', ''),
        body=email_data.get('body', ''),
        cc=email_data.get('cc'),
        is_html=email_data.get('is_html', True)
    )

    if not success:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to send email"
        )

    # Update status
    from sqlalchemy import update as sql_update
    from models.mail_models import ScheduledEmail as ScheduledEmailModel
    from datetime import datetime

    await db.execute(
        sql_update(ScheduledEmailModel)
        .where(ScheduledEmailModel.id == scheduled_id)
        .values(status='sent', sent_at=datetime.utcnow())
    )
    await db.commit()

    # Remove from scheduler
    if email_scheduler_service.scheduler:
        try:
            email_scheduler_service.scheduler.remove_job(f"scheduled_email_{scheduled_id}")
        except:
            pass

    return {
        "success": True,
        "message": "Email sent successfully",
        "to": email_data.get('to', [])
    }
