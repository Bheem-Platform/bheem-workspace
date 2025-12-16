"""
Bheem Workspace - User Workspace API
Unified API for user's Email, Files, Meetings, Calendar
"""
from fastapi import APIRouter, Depends, HTTPException, status, Query
from pydantic import BaseModel, EmailStr
from typing import Optional, List
from datetime import datetime, timedelta
from sqlalchemy.ext.asyncio import AsyncSession

from core.database import get_db
from core.security import get_current_user
from services.user_workspace_service import user_workspace_service

router = APIRouter(prefix="/workspace", tags=["User Workspace"])


# ============== SCHEMAS ==============

class WorkspaceCredentials(BaseModel):
    """User's workspace credentials (same password for all services)"""
    password: str


class SendEmailRequest(BaseModel):
    to: List[EmailStr]
    subject: str
    body: str
    cc: Optional[List[EmailStr]] = []
    is_html: bool = True


class CreateMeetingRequest(BaseModel):
    room_name: str
    title: Optional[str] = None


# ============== MAIN WORKSPACE ==============

@router.get("/me")
async def get_my_workspace(
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Get current user's complete workspace configuration

    Returns:
    - User info (from ERP)
    - Email config (IMAP/SMTP settings)
    - Files config (WebDAV settings)
    - Calendar config (CalDAV settings)
    - Meeting config (LiveKit settings)
    """
    workspace = await user_workspace_service.get_user_workspace(db, current_user["id"])

    if not workspace:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User workspace not found"
        )

    return workspace


# ============== EMAIL ==============

@router.get("/email/inbox")
async def get_my_inbox(
    password: str,
    folder: str = "INBOX",
    limit: int = 50,
    current_user: dict = Depends(get_current_user)
):
    """
    Get user's email inbox

    Uses user's email from ERP profile to fetch emails from Mailcow
    """
    email = current_user.get("email") or current_user.get("username")

    if not email or '@' not in email:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="User has no email configured"
        )

    messages = await user_workspace_service.get_user_inbox(
        email=email,
        password=password,
        folder=folder,
        limit=limit
    )

    return {
        "email": email,
        "folder": folder,
        "count": len(messages),
        "messages": messages
    }


@router.get("/email/message/{message_id}")
async def get_email_message(
    message_id: str,
    password: str,
    folder: str = "INBOX",
    current_user: dict = Depends(get_current_user)
):
    """Get a specific email message"""
    email = current_user.get("email") or current_user.get("username")

    if not email or '@' not in email:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="User has no email configured"
        )

    message = await user_workspace_service.get_user_email(
        email=email,
        password=password,
        message_id=message_id,
        folder=folder
    )

    if not message:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Message not found"
        )

    return message


@router.post("/email/send")
async def send_email(
    request: SendEmailRequest,
    password: str,
    current_user: dict = Depends(get_current_user)
):
    """Send email from user's account"""
    email = current_user.get("email") or current_user.get("username")

    if not email or '@' not in email:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="User has no email configured"
        )

    success = await user_workspace_service.send_user_email(
        from_email=email,
        password=password,
        to=request.to,
        subject=request.subject,
        body=request.body,
        cc=request.cc,
        is_html=request.is_html
    )

    if not success:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to send email"
        )

    return {"success": True, "message": "Email sent"}


@router.get("/email/folders")
async def get_email_folders(
    password: str,
    current_user: dict = Depends(get_current_user)
):
    """Get user's email folders"""
    from services.mailcow_service import mailcow_service

    email = current_user.get("email") or current_user.get("username")

    if not email or '@' not in email:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="User has no email configured"
        )

    folders = mailcow_service.get_folders(email, password)
    return {"folders": folders}


# ============== FILES ==============

@router.get("/files")
async def get_my_files(
    password: str,
    path: str = "/",
    current_user: dict = Depends(get_current_user)
):
    """
    Get user's files from Nextcloud

    Uses user's email as Nextcloud username
    """
    email = current_user.get("email") or current_user.get("username")

    if not email or '@' not in email:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="User has no email configured"
        )

    files = await user_workspace_service.get_user_files(
        email=email,
        password=password,
        path=path
    )

    return {
        "path": path,
        "count": len(files),
        "files": files
    }


# ============== CALENDAR ==============

@router.get("/calendars")
async def get_my_calendars(
    password: str,
    current_user: dict = Depends(get_current_user)
):
    """Get user's calendars"""
    email = current_user.get("email") or current_user.get("username")

    if not email or '@' not in email:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="User has no email configured"
        )

    calendars = await user_workspace_service.get_user_calendars(
        email=email,
        password=password
    )

    return {"calendars": calendars}


@router.get("/calendar/events")
async def get_my_events(
    password: str,
    calendar_id: str = "personal",
    start: datetime = None,
    end: datetime = None,
    current_user: dict = Depends(get_current_user)
):
    """Get user's calendar events"""
    email = current_user.get("email") or current_user.get("username")

    if not email or '@' not in email:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="User has no email configured"
        )

    # Default to current week
    if not start:
        start = datetime.utcnow().replace(hour=0, minute=0, second=0, microsecond=0)
    if not end:
        end = start + timedelta(days=7)

    events = await user_workspace_service.get_user_events(
        email=email,
        password=password,
        calendar_id=calendar_id,
        start=start,
        end=end
    )

    return {
        "calendar_id": calendar_id,
        "start": start.isoformat(),
        "end": end.isoformat(),
        "count": len(events),
        "events": events
    }


# ============== MEETINGS ==============

@router.post("/meeting/token")
async def get_meeting_token(
    room_name: str,
    is_host: bool = False,
    current_user: dict = Depends(get_current_user)
):
    """
    Get a token to join a meeting

    User's identity is automatically set from their ERP profile
    """
    user_name = current_user.get("name") or current_user.get("username")

    token = await user_workspace_service.create_meeting_token(
        user_id=current_user["id"],
        user_name=user_name,
        room_name=room_name,
        is_host=is_host
    )

    return {
        "token": token,
        "room_name": room_name,
        "server_url": "wss://meet.bheem.cloud",
        "participant": {
            "id": current_user["id"],
            "name": user_name
        }
    }


# ============== UNIFIED DASHBOARD ==============

@router.get("/dashboard")
async def get_workspace_dashboard(
    password: str,
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Get unified workspace dashboard with:
    - User info
    - Recent emails (last 10)
    - Recent files
    - Today's calendar events
    - Active meetings
    """
    email = current_user.get("email") or current_user.get("username")

    if not email or '@' not in email:
        # Return basic info if no email configured
        return {
            "user": current_user,
            "email_configured": False,
            "message": "Email not configured for this user"
        }

    # Get workspace config
    workspace = await user_workspace_service.get_user_workspace(db, current_user["id"])

    # Get recent emails
    try:
        recent_emails = await user_workspace_service.get_user_inbox(
            email=email,
            password=password,
            folder="INBOX",
            limit=10
        )
    except:
        recent_emails = []

    # Get recent files
    try:
        recent_files = await user_workspace_service.get_user_files(
            email=email,
            password=password,
            path="/"
        )
    except:
        recent_files = []

    # Get today's events
    try:
        today = datetime.utcnow().replace(hour=0, minute=0, second=0, microsecond=0)
        tomorrow = today + timedelta(days=1)
        today_events = await user_workspace_service.get_user_events(
            email=email,
            password=password,
            calendar_id="personal",
            start=today,
            end=tomorrow
        )
    except:
        today_events = []

    return {
        "user": workspace["user"] if workspace else current_user,
        "email_configured": True,
        "summary": {
            "unread_emails": len([e for e in recent_emails if not e.get("read", True)]),
            "total_files": len(recent_files),
            "today_events": len(today_events)
        },
        "recent_emails": recent_emails[:5],
        "recent_files": recent_files[:10],
        "today_events": today_events,
        "quick_links": {
            "webmail": f"https://mail.bheem.cloud/SOGo",
            "files": f"https://docs.bheem.cloud",
            "calendar": f"https://docs.bheem.cloud/apps/calendar",
            "meet": f"https://workspace.bheem.cloud/meet"
        }
    }


# ============== PROVISIONING ==============

@router.post("/provision")
async def provision_my_workspace(
    credentials: WorkspaceCredentials,
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Provision workspace resources for current user

    Creates:
    - Mailbox (if domain is configured in Mailcow)
    - Nextcloud account
    - Default calendar

    Uses user's email from ERP as the identifier
    """
    result = await user_workspace_service.provision_user_workspace(
        db=db,
        user_id=current_user["id"],
        password=credentials.password
    )

    return {
        "success": all(result.values()),
        "provisioned": result
    }
