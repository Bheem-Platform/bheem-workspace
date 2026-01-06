"""
Bheem Workspace - Mail Calendar Integration API
Detect calendar events in emails and add them to calendar
"""
from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime, timedelta

from core.security import get_current_user
from services.calendar_detection_service import calendar_detection_service
from services.mail_session_service import mail_session_service
from services.mailcow_service import mailcow_service
from services.caldav_service import caldav_service
from core.logging import get_logger

logger = get_logger("bheem.mail.calendar")

router = APIRouter(prefix="/mail/calendar", tags=["Mail Calendar Integration"])


# Request/Response Models
class DetectedEvent(BaseModel):
    title: str
    start: str
    end: Optional[str] = None
    date_str: Optional[str] = None
    time_str: Optional[str] = None
    location: Optional[str] = None
    duration_minutes: Optional[int] = 60
    source: str
    confidence: float


class AddToCalendarRequest(BaseModel):
    title: str
    start: datetime
    end: Optional[datetime] = None
    location: Optional[str] = ""
    description: Optional[str] = ""
    calendar_id: str = "personal"
    source_message_id: Optional[str] = None


class AddToCalendarResponse(BaseModel):
    success: bool
    event_uid: Optional[str] = None
    calendar_id: str
    message: Optional[str] = None


# Endpoints

@router.get("/detect/{message_id}")
async def detect_calendar_events(
    message_id: str,
    folder: str = Query("INBOX", description="IMAP folder"),
    current_user: dict = Depends(get_current_user)
):
    """
    Detect potential calendar events in an email.

    Analyzes the email subject, body, and attachments (ICS files)
    to find potential calendar events.

    Returns a list of detected events with confidence scores.
    """
    # Get mail credentials
    credentials = mail_session_service.get_credentials(current_user["id"])
    if not credentials:
        raise HTTPException(
            status_code=401,
            detail="Mail session expired. Please re-authenticate."
        )

    try:
        # Fetch the email
        email = await mailcow_service.get_message(
            credentials["email"],
            credentials["password"],
            folder,
            message_id
        )

        if not email:
            raise HTTPException(
                status_code=404,
                detail="Email not found"
            )

        # Detect events
        events = calendar_detection_service.detect_events(
            email_body=email.get('body', '') or email.get('body_text', ''),
            email_subject=email.get('subject', ''),
            attachments=email.get('attachments', [])
        )

        return {
            "message_id": message_id,
            "subject": email.get('subject', ''),
            "events_detected": len(events),
            "events": events
        }

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to detect calendar events: {e}", action="detect_events_error")
        raise HTTPException(
            status_code=500,
            detail=f"Failed to detect calendar events: {str(e)}"
        )


@router.post("/detect/text")
async def detect_events_from_text(
    subject: str = "",
    body: str = "",
    current_user: dict = Depends(get_current_user)
):
    """
    Detect calendar events from provided text.

    Useful for compose preview or draft analysis.
    """
    events = calendar_detection_service.detect_events(
        email_body=body,
        email_subject=subject,
        attachments=None
    )

    return {
        "events_detected": len(events),
        "events": events
    }


@router.post("/add")
async def add_event_to_calendar(
    request: AddToCalendarRequest,
    nc_user: str = Query(None, description="Nextcloud username"),
    nc_pass: str = Query(None, description="Nextcloud password"),
    current_user: dict = Depends(get_current_user)
) -> AddToCalendarResponse:
    """
    Add a detected event to the user's calendar.

    Requires Nextcloud CalDAV credentials.
    """
    username = nc_user or current_user.get("username")
    password = nc_pass

    if not password:
        raise HTTPException(
            status_code=400,
            detail="Nextcloud credentials required. Provide nc_user and nc_pass query parameters."
        )

    try:
        # Calculate end time if not provided
        end_time = request.end
        if not end_time:
            from datetime import timedelta
            end_time = request.start + timedelta(hours=1)

        # Build description
        description = request.description or ""
        if request.source_message_id:
            description += f"\n\nCreated from email (Message-ID: {request.source_message_id})"

        # Create event in calendar
        event_uid = await caldav_service.create_event(
            username=username,
            password=password,
            calendar_id=request.calendar_id,
            title=request.title,
            start=request.start,
            end=end_time,
            location=request.location or "",
            description=description.strip()
        )

        if not event_uid:
            return AddToCalendarResponse(
                success=False,
                calendar_id=request.calendar_id,
                message="Failed to create calendar event"
            )

        logger.info(
            f"Created calendar event from email",
            action="calendar_event_created",
            event_uid=event_uid,
            source_message=request.source_message_id
        )

        return AddToCalendarResponse(
            success=True,
            event_uid=event_uid,
            calendar_id=request.calendar_id,
            message="Event added to calendar successfully"
        )

    except Exception as e:
        logger.error(f"Failed to add event to calendar: {e}", action="add_event_error")
        raise HTTPException(
            status_code=500,
            detail=f"Failed to add event to calendar: {str(e)}"
        )


@router.post("/add-from-email/{message_id}")
async def add_email_event_to_calendar(
    message_id: str,
    event_index: int = Query(0, description="Index of detected event to add"),
    calendar_id: str = Query("personal", description="Calendar to add event to"),
    folder: str = Query("INBOX", description="IMAP folder"),
    nc_user: str = Query(None, description="Nextcloud username"),
    nc_pass: str = Query(None, description="Nextcloud password"),
    current_user: dict = Depends(get_current_user)
) -> AddToCalendarResponse:
    """
    Detect events in an email and add a specific one to calendar.

    Combines detection and creation in one call for convenience.
    """
    # Get mail credentials
    credentials = mail_session_service.get_credentials(current_user["id"])
    if not credentials:
        raise HTTPException(
            status_code=401,
            detail="Mail session expired. Please re-authenticate."
        )

    nc_username = nc_user or current_user.get("username")
    nc_password = nc_pass

    if not nc_password:
        raise HTTPException(
            status_code=400,
            detail="Nextcloud credentials required"
        )

    try:
        # Fetch the email
        email = await mailcow_service.get_message(
            credentials["email"],
            credentials["password"],
            folder,
            message_id
        )

        if not email:
            raise HTTPException(
                status_code=404,
                detail="Email not found"
            )

        # Detect events
        events = calendar_detection_service.detect_events(
            email_body=email.get('body', '') or email.get('body_text', ''),
            email_subject=email.get('subject', ''),
            attachments=email.get('attachments', [])
        )

        if not events:
            return AddToCalendarResponse(
                success=False,
                calendar_id=calendar_id,
                message="No calendar events detected in this email"
            )

        if event_index >= len(events):
            raise HTTPException(
                status_code=400,
                detail=f"Invalid event index. Found {len(events)} events (0-{len(events)-1})"
            )

        event = events[event_index]

        # Parse dates
        start_time = datetime.fromisoformat(event['start'])
        end_time = datetime.fromisoformat(event['end']) if event.get('end') else start_time + timedelta(hours=1)

        # Build description
        description = f"Detected from email: {email.get('subject', 'No subject')}"
        if email.get('from'):
            from_addr = email['from']
            if isinstance(from_addr, dict):
                from_str = from_addr.get('email', '')
            else:
                from_str = str(from_addr)
            description += f"\nFrom: {from_str}"

        # Create event
        event_uid = await caldav_service.create_event(
            username=nc_username,
            password=nc_password,
            calendar_id=calendar_id,
            title=event['title'],
            start=start_time,
            end=end_time,
            location=event.get('location', '') or "",
            description=description
        )

        if not event_uid:
            return AddToCalendarResponse(
                success=False,
                calendar_id=calendar_id,
                message="Failed to create calendar event"
            )

        return AddToCalendarResponse(
            success=True,
            event_uid=event_uid,
            calendar_id=calendar_id,
            message=f"Event '{event['title']}' added to calendar"
        )

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to add email event to calendar: {e}")
        raise HTTPException(
            status_code=500,
            detail=f"Failed to add event: {str(e)}"
        )


@router.post("/parse-ics")
async def parse_ics_content(
    ics_content: str,
    current_user: dict = Depends(get_current_user)
):
    """
    Parse ICS (iCalendar) content and return extracted events.

    Useful for previewing calendar invites before adding.
    """
    events = calendar_detection_service.parse_ics_file(ics_content)

    return {
        "events_found": len(events),
        "events": events
    }
