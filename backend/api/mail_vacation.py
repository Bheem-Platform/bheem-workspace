"""
Bheem Workspace - Mail Vacation Responder API
Manage out-of-office auto-reply settings
"""
from fastapi import APIRouter, Depends, HTTPException, status, Request
from pydantic import BaseModel
from typing import Optional
from datetime import datetime
from uuid import UUID
from core.security import get_current_user
from core.database import get_db
from sqlalchemy.ext.asyncio import AsyncSession
from services.mail_vacation_service import mail_vacation_service

# Rate limiting
try:
    from middleware.rate_limit import limiter
except ImportError:
    class DummyLimiter:
        def limit(self, limit_string):
            def decorator(func):
                return func
            return decorator
    limiter = DummyLimiter()

router = APIRouter(prefix="/mail/vacation", tags=["Mail Vacation Responder"])


# ===========================================
# Schemas
# ===========================================

class VacationSettingsRequest(BaseModel):
    is_enabled: Optional[bool] = False
    subject: Optional[str] = "Out of Office"
    message: str
    is_html: Optional[bool] = False
    start_date: Optional[datetime] = None
    end_date: Optional[datetime] = None
    only_contacts: Optional[bool] = False
    only_once: Optional[bool] = True


class VacationSettingsResponse(BaseModel):
    id: str
    is_enabled: bool
    is_active: bool  # Currently active (enabled + in date range)
    subject: str
    message: str
    is_html: bool
    start_date: Optional[str]
    end_date: Optional[str]
    only_contacts: bool
    only_once: bool
    replied_count: int
    created_at: Optional[str]
    updated_at: Optional[str]


# ===========================================
# Vacation Responder Endpoints
# ===========================================

@router.get("", response_model=VacationSettingsResponse)
@limiter.limit("30/minute")
async def get_vacation_settings(
    request: Request,
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Get current vacation responder settings."""
    user_id = current_user.get("id") or current_user.get("user_id")

    settings = await mail_vacation_service.get_settings(
        db=db,
        user_id=UUID(user_id)
    )

    if not settings:
        # Return default settings
        return VacationSettingsResponse(
            id="",
            is_enabled=False,
            is_active=False,
            subject="Out of Office",
            message="",
            is_html=False,
            start_date=None,
            end_date=None,
            only_contacts=False,
            only_once=True,
            replied_count=0,
            created_at=None,
            updated_at=None
        )

    return VacationSettingsResponse(**mail_vacation_service.settings_to_dict(settings))


@router.put("", response_model=VacationSettingsResponse)
@limiter.limit("10/minute")
async def update_vacation_settings(
    request_obj: Request,
    request: VacationSettingsRequest,
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Update vacation responder settings.

    Set is_enabled=true to activate auto-reply.
    Optionally set start_date and end_date for scheduled activation.
    """
    user_id = current_user.get("id") or current_user.get("user_id")

    # Validate date range
    if request.start_date and request.end_date:
        if request.end_date <= request.start_date:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="End date must be after start date"
            )

    # Validate message
    if not request.message or not request.message.strip():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Message is required"
        )

    settings = await mail_vacation_service.create_or_update_settings(
        db=db,
        user_id=UUID(user_id),
        is_enabled=request.is_enabled if request.is_enabled is not None else False,
        subject=request.subject or "Out of Office",
        message=request.message,
        is_html=request.is_html if request.is_html is not None else False,
        start_date=request.start_date,
        end_date=request.end_date,
        only_contacts=request.only_contacts if request.only_contacts is not None else False,
        only_once=request.only_once if request.only_once is not None else True
    )

    return VacationSettingsResponse(**mail_vacation_service.settings_to_dict(settings))


@router.post("/enable", response_model=VacationSettingsResponse)
@limiter.limit("10/minute")
async def enable_vacation(
    request: Request,
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Enable vacation responder.

    Must have saved settings first using PUT /mail/vacation.
    """
    user_id = current_user.get("id") or current_user.get("user_id")

    settings = await mail_vacation_service.enable(
        db=db,
        user_id=UUID(user_id)
    )

    if not settings:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Vacation settings not found. Create settings first."
        )

    return VacationSettingsResponse(**mail_vacation_service.settings_to_dict(settings))


@router.post("/disable", response_model=VacationSettingsResponse)
@limiter.limit("10/minute")
async def disable_vacation(
    request: Request,
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Disable vacation responder."""
    user_id = current_user.get("id") or current_user.get("user_id")

    settings = await mail_vacation_service.disable(
        db=db,
        user_id=UUID(user_id)
    )

    if not settings:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Vacation settings not found"
        )

    return VacationSettingsResponse(**mail_vacation_service.settings_to_dict(settings))


@router.post("/clear-replies")
@limiter.limit("10/minute")
async def clear_replied_list(
    request: Request,
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Clear the list of senders who have received auto-replies.

    Use this to reset "only_once" tracking and allow replies
    to be sent again to previously contacted senders.
    """
    user_id = current_user.get("id") or current_user.get("user_id")

    await mail_vacation_service.clear_replied_list(
        db=db,
        user_id=UUID(user_id)
    )

    return {"success": True, "message": "Replied list cleared"}


@router.delete("")
@limiter.limit("10/minute")
async def delete_vacation_settings(
    request: Request,
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Delete vacation responder settings entirely."""
    user_id = current_user.get("id") or current_user.get("user_id")

    success = await mail_vacation_service.delete_settings(
        db=db,
        user_id=UUID(user_id)
    )

    if not success:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Vacation settings not found"
        )

    return {"success": True, "message": "Vacation settings deleted"}
