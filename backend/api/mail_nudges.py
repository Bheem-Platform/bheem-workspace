"""
Bheem Workspace - Email Nudges API
API endpoints for managing follow-up reminders
Phase 9: Email Enhancements
"""
from typing import Optional, List
from uuid import UUID
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, status, Query
from pydantic import BaseModel, Field

from core.database import get_db
from core.security import get_current_user
from services.mail_nudge_service import EmailNudgeService

router = APIRouter(prefix="/mail/nudges", tags=["Mail - Nudges"])


# =============================================
# Pydantic Schemas
# =============================================

class NudgeSettingsUpdate(BaseModel):
    nudges_enabled: Optional[bool] = None
    sent_no_reply_days: Optional[int] = Field(None, ge=1, le=30)
    received_no_reply_days: Optional[int] = Field(None, ge=1, le=30)
    nudge_sent_emails: Optional[bool] = None
    nudge_received_emails: Optional[bool] = None
    nudge_important_only: Optional[bool] = None
    quiet_hours_start: Optional[str] = Field(None, pattern='^([01]?[0-9]|2[0-3]):[0-5][0-9]$')
    quiet_hours_end: Optional[str] = Field(None, pattern='^([01]?[0-9]|2[0-3]):[0-5][0-9]$')
    quiet_weekends: Optional[bool] = None
    excluded_senders: Optional[List[str]] = None
    excluded_domains: Optional[List[str]] = None


class NudgeSettingsResponse(BaseModel):
    nudges_enabled: bool
    sent_no_reply_days: int
    received_no_reply_days: int
    nudge_sent_emails: bool
    nudge_received_emails: bool
    nudge_important_only: bool
    quiet_hours_start: Optional[str]
    quiet_hours_end: Optional[str]
    quiet_weekends: bool
    excluded_senders: List[str]
    excluded_domains: List[str]


class NudgeCreate(BaseModel):
    message_id: str
    nudge_type: str = Field('custom', pattern='^(sent_no_reply|received_no_reply|custom)$')
    remind_at: datetime
    subject: Optional[str] = None
    recipient_email: Optional[str] = None
    note: Optional[str] = None


class NudgeResponse(BaseModel):
    id: str
    message_id: str
    nudge_type: str
    remind_at: str
    snooze_until: Optional[str]
    status: str
    subject: Optional[str]
    recipient_email: Optional[str]
    sent_at: Optional[str]
    note: Optional[str]
    created_at: str


class SnoozeRequest(BaseModel):
    hours: int = Field(24, ge=1, le=168)  # 1 hour to 1 week


# =============================================
# Settings Endpoints
# =============================================

@router.get("/settings", response_model=NudgeSettingsResponse)
async def get_nudge_settings(
    current_user: dict = Depends(get_current_user),
    db = Depends(get_db)
):
    """Get nudge settings for current user"""
    service = EmailNudgeService(db)
    settings = await service.get_settings(current_user["user_id"])

    return NudgeSettingsResponse(
        nudges_enabled=settings.nudges_enabled,
        sent_no_reply_days=settings.sent_no_reply_days,
        received_no_reply_days=settings.received_no_reply_days,
        nudge_sent_emails=settings.nudge_sent_emails,
        nudge_received_emails=settings.nudge_received_emails,
        nudge_important_only=settings.nudge_important_only,
        quiet_hours_start=settings.quiet_hours_start,
        quiet_hours_end=settings.quiet_hours_end,
        quiet_weekends=settings.quiet_weekends,
        excluded_senders=settings.excluded_senders or [],
        excluded_domains=settings.excluded_domains or []
    )


@router.patch("/settings", response_model=NudgeSettingsResponse)
async def update_nudge_settings(
    data: NudgeSettingsUpdate,
    current_user: dict = Depends(get_current_user),
    db = Depends(get_db)
):
    """Update nudge settings"""
    service = EmailNudgeService(db)

    update_data = data.dict(exclude_unset=True)
    settings = await service.update_settings(
        user_id=current_user["user_id"],
        **update_data
    )

    return NudgeSettingsResponse(
        nudges_enabled=settings.nudges_enabled,
        sent_no_reply_days=settings.sent_no_reply_days,
        received_no_reply_days=settings.received_no_reply_days,
        nudge_sent_emails=settings.nudge_sent_emails,
        nudge_received_emails=settings.nudge_received_emails,
        nudge_important_only=settings.nudge_important_only,
        quiet_hours_start=settings.quiet_hours_start,
        quiet_hours_end=settings.quiet_hours_end,
        quiet_weekends=settings.quiet_weekends,
        excluded_senders=settings.excluded_senders or [],
        excluded_domains=settings.excluded_domains or []
    )


# =============================================
# Nudge Endpoints
# =============================================

@router.post("", response_model=NudgeResponse, status_code=status.HTTP_201_CREATED)
async def create_nudge(
    data: NudgeCreate,
    current_user: dict = Depends(get_current_user),
    db = Depends(get_db)
):
    """Create a custom nudge"""
    service = EmailNudgeService(db)

    nudge = await service.create_nudge(
        user_id=current_user["user_id"],
        message_id=data.message_id,
        nudge_type=data.nudge_type,
        remind_at=data.remind_at,
        subject=data.subject,
        recipient_email=data.recipient_email,
        note=data.note
    )

    return _to_response(nudge)


@router.get("", response_model=List[NudgeResponse])
async def list_nudges(
    include_future: bool = Query(False),
    current_user: dict = Depends(get_current_user),
    db = Depends(get_db)
):
    """Get all pending nudges"""
    service = EmailNudgeService(db)

    nudges = await service.get_pending_nudges(
        user_id=current_user["user_id"],
        include_future=include_future
    )

    return [_to_response(n) for n in nudges]


@router.get("/due", response_model=List[NudgeResponse])
async def get_due_nudges(
    current_user: dict = Depends(get_current_user),
    db = Depends(get_db)
):
    """Get nudges that are due to be shown now"""
    service = EmailNudgeService(db)

    nudges = await service.get_due_nudges(current_user["user_id"])
    return [_to_response(n) for n in nudges]


@router.get("/count")
async def get_nudge_count(
    current_user: dict = Depends(get_current_user),
    db = Depends(get_db)
):
    """Get count of pending nudges"""
    service = EmailNudgeService(db)
    count = await service.get_nudge_count(current_user["user_id"])
    return {"count": count}


@router.get("/{nudge_id}", response_model=NudgeResponse)
async def get_nudge(
    nudge_id: UUID,
    current_user: dict = Depends(get_current_user),
    db = Depends(get_db)
):
    """Get a specific nudge"""
    service = EmailNudgeService(db)

    nudge = await service.get_nudge(nudge_id, current_user["user_id"])

    if not nudge:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Nudge not found"
        )

    return _to_response(nudge)


@router.post("/{nudge_id}/shown")
async def mark_nudge_shown(
    nudge_id: UUID,
    current_user: dict = Depends(get_current_user),
    db = Depends(get_db)
):
    """Mark a nudge as shown"""
    service = EmailNudgeService(db)

    success = await service.mark_shown(nudge_id, current_user["user_id"])

    if not success:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Nudge not found"
        )

    return {"message": "Nudge marked as shown"}


@router.post("/{nudge_id}/dismiss")
async def dismiss_nudge(
    nudge_id: UUID,
    current_user: dict = Depends(get_current_user),
    db = Depends(get_db)
):
    """Dismiss a nudge"""
    service = EmailNudgeService(db)

    success = await service.dismiss(nudge_id, current_user["user_id"])

    if not success:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Nudge not found"
        )

    return {"message": "Nudge dismissed"}


@router.post("/{nudge_id}/snooze")
async def snooze_nudge(
    nudge_id: UUID,
    data: SnoozeRequest,
    current_user: dict = Depends(get_current_user),
    db = Depends(get_db)
):
    """Snooze a nudge"""
    service = EmailNudgeService(db)

    success = await service.snooze(
        nudge_id=nudge_id,
        user_id=current_user["user_id"],
        snooze_hours=data.hours
    )

    if not success:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Nudge not found"
        )

    return {"message": f"Nudge snoozed for {data.hours} hours"}


@router.post("/message/{message_id}/replied")
async def mark_message_replied(
    message_id: str,
    current_user: dict = Depends(get_current_user),
    db = Depends(get_db)
):
    """Mark all nudges for a message as replied"""
    service = EmailNudgeService(db)

    count = await service.mark_replied(
        user_id=current_user["user_id"],
        message_id=message_id
    )

    return {"message": f"{count} nudge(s) marked as replied"}


@router.delete("/{nudge_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_nudge(
    nudge_id: UUID,
    current_user: dict = Depends(get_current_user),
    db = Depends(get_db)
):
    """Delete a nudge"""
    service = EmailNudgeService(db)

    success = await service.delete_nudge(nudge_id, current_user["user_id"])

    if not success:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Nudge not found"
        )


# =============================================
# Helper Functions
# =============================================

def _to_response(nudge) -> dict:
    """Convert model to response dict"""
    return {
        "id": str(nudge.id),
        "message_id": nudge.message_id,
        "nudge_type": nudge.nudge_type,
        "remind_at": nudge.remind_at.isoformat(),
        "snooze_until": nudge.snooze_until.isoformat() if nudge.snooze_until else None,
        "status": nudge.status,
        "subject": nudge.subject,
        "recipient_email": nudge.recipient_email,
        "sent_at": nudge.sent_at.isoformat() if nudge.sent_at else None,
        "note": nudge.note,
        "created_at": nudge.created_at.isoformat()
    }
