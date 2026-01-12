"""
Bheem Workspace - Calendar API (Nextcloud CalDAV Integration)
Calendar and event management with recurring events support
"""
from fastapi import APIRouter, Depends, HTTPException, status, Query
from pydantic import BaseModel, field_validator
from typing import Optional, List
from datetime import datetime, timedelta

from core.security import get_current_user
from services.caldav_service import (
    caldav_service,
    CalDAVRateLimitError,
    CalDAVAuthError,
    CalDAVNotFoundError
)
from services.mail_session_service import mail_session_service
from services.nextcloud_user_service import nextcloud_user_service
from integrations.notify import notify_client
import logging
import secrets
import string
import hashlib

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/calendar", tags=["Bheem Calendar"])

# Track users whose Nextcloud accounts are ready
_nextcloud_ready_users = {}  # username -> nextcloud_password


def generate_nextcloud_password(email: str, mail_password: str) -> str:
    """
    Generate a deterministic but strong password for Nextcloud.
    This ensures the same password is generated each time for the same user.
    """
    # Create a deterministic seed from email + mail password
    seed = hashlib.sha256(f"{email}:{mail_password}:nextcloud".encode()).hexdigest()[:16]
    return f"Nc!{seed}Px"


async def ensure_nextcloud_user(username: str, email: str, password: str) -> tuple:
    """
    Ensure Nextcloud user exists and return working credentials.
    Returns (success, nextcloud_password)
    """
    # Check if already processed
    if username in _nextcloud_ready_users:
        return (True, _nextcloud_ready_users[username])

    try:
        # Check if user exists
        user_check = await nextcloud_user_service.get_user(username)

        if user_check.get("status") == "found":
            # User exists - try to update password
            result = await nextcloud_user_service.update_user(username, "password", password)
            if result.get("status") == "updated" or not result.get("error"):
                _nextcloud_ready_users[username] = password
                logger.info(f"Synced Nextcloud password for existing user: {username}")
                return (True, password)
            else:
                # Password rejected (probably security policy) - use generated password
                nc_password = generate_nextcloud_password(email, password)
                result = await nextcloud_user_service.update_user(username, "password", nc_password)
                if result.get("status") == "updated" or not result.get("error"):
                    _nextcloud_ready_users[username] = nc_password
                    logger.info(f"Set generated Nextcloud password for user: {username}")
                    return (True, nc_password)
                else:
                    logger.warning(f"Failed to update Nextcloud password: {result}")
                    return (False, None)
        else:
            # User doesn't exist - create them
            nc_password = generate_nextcloud_password(email, password)

            create_result = await nextcloud_user_service.create_user(
                user_id=username,
                email=email,
                display_name=username,
                password=nc_password,
                quota="5 GB"
            )

            if create_result.get("status") in ["created", "exists"]:
                _nextcloud_ready_users[username] = nc_password
                logger.info(f"Created Nextcloud user: {username}")
                return (True, nc_password)
            else:
                logger.error(f"Failed to create Nextcloud user: {create_result}")
                return (False, None)

    except Exception as e:
        logger.error(f"Error ensuring Nextcloud user: {e}")
        return (False, None)


async def get_nextcloud_credentials(current_user: dict, nc_user: str = None, nc_pass: str = None) -> tuple:
    """
    Get Nextcloud credentials from mail session or explicit parameters.
    Returns (username, password) tuple.

    Priority:
    1. Explicit nc_user/nc_pass parameters (for backward compatibility)
    2. Mail session credentials (workspace email/password)

    Automatically creates Nextcloud user if needed and handles password policies.
    """
    # If explicit credentials provided, use them
    if nc_pass:
        username = nc_user or current_user.get("username", "")
        return (username, nc_pass)

    # Try to get credentials from mail session
    credentials = mail_session_service.get_credentials(current_user["id"])
    if credentials:
        # Extract username from email (local part before @)
        email = credentials["email"]
        username = email.split("@")[0] if "@" in email else email
        mail_password = credentials["password"]

        # Ensure Nextcloud user exists and get working password
        success, nc_password = await ensure_nextcloud_user(username, email, mail_password)

        if success and nc_password:
            return (username, nc_password)
        else:
            # Fallback to mail password (might work if user was manually created)
            return (username, mail_password)

    # No credentials available
    return (None, None)

# Schemas
class RecurrenceRule(BaseModel):
    """Recurrence rule for repeating events (RFC 5545 RRULE)"""
    freq: str  # DAILY, WEEKLY, MONTHLY, YEARLY
    interval: int = 1  # Every N days/weeks/months/years
    by_day: Optional[List[str]] = None  # MO, TU, WE, TH, FR, SA, SU
    by_month_day: Optional[List[int]] = None  # 1-31 for monthly
    by_month: Optional[List[int]] = None  # 1-12 for yearly
    by_set_pos: Optional[int] = None  # -1 for last, 1 for first, etc.
    count: Optional[int] = None  # End after N occurrences
    until: Optional[datetime] = None  # End by date

    @field_validator('freq')
    @classmethod
    def validate_freq(cls, v):
        valid_freqs = ['DAILY', 'WEEKLY', 'MONTHLY', 'YEARLY']
        if v.upper() not in valid_freqs:
            raise ValueError(f'freq must be one of: {valid_freqs}')
        return v.upper()

    @field_validator('by_day')
    @classmethod
    def validate_by_day(cls, v):
        if v is None:
            return v
        valid_days = ['MO', 'TU', 'WE', 'TH', 'FR', 'SA', 'SU']
        for day in v:
            # Allow prefixed days like "1MO" (first Monday) or "-1FR" (last Friday)
            day_part = ''.join(filter(str.isalpha, day)).upper()
            if day_part not in valid_days:
                raise ValueError(f'Invalid day: {day}. Must be one of: {valid_days}')
        return [d.upper() for d in v]


class EventCreate(BaseModel):
    calendar_id: str
    title: str
    start: datetime
    end: datetime
    location: Optional[str] = ""
    description: Optional[str] = ""
    all_day: bool = False  # Whether this is an all-day event
    attendees: Optional[List[str]] = None  # Email addresses to invite
    send_invites: bool = True  # Whether to send email invites
    recurrence: Optional[RecurrenceRule] = None  # Recurrence rule for repeating events


class EventUpdate(BaseModel):
    title: Optional[str] = None
    start: Optional[datetime] = None
    end: Optional[datetime] = None
    location: Optional[str] = None
    description: Optional[str] = None
    all_day: Optional[bool] = None
    recurrence: Optional[RecurrenceRule] = None  # Update recurrence rule

class CalendarInfo(BaseModel):
    id: str
    name: str
    href: str

class EventInfo(BaseModel):
    id: str
    title: str
    start: str
    end: Optional[str]
    location: Optional[str]
    description: Optional[str]

# Endpoints
@router.get("/calendars")
async def get_calendars(
    nc_user: str = None,
    nc_pass: str = None,
    current_user: dict = Depends(get_current_user)
):
    """Get list of user's calendars from Nextcloud.

    Credentials are automatically retrieved from your mail session.
    If you're logged into mail with your workspace credentials, calendar works automatically.
    """
    username, password = await get_nextcloud_credentials(current_user, nc_user, nc_pass)

    if not password:
        return {
            "message": "Calendar credentials required",
            "note": "Please login to Mail first, or provide nc_user and nc_pass query parameters"
        }

    try:
        calendars = await caldav_service.get_calendars(username, password)
        return {
            "count": len(calendars),
            "calendars": calendars
        }
    except CalDAVAuthError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid calendar credentials. Please check your password."
        )
    except CalDAVRateLimitError:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="Too many requests. Please wait a moment and try again."
        )

@router.get("/events")
async def get_events(
    calendar_id: str = "personal",
    start: datetime = None,
    end: datetime = None,
    nc_user: str = None,
    nc_pass: str = None,
    current_user: dict = Depends(get_current_user)
):
    """Get calendar events within a time range.

    Credentials are automatically retrieved from your mail session.
    """
    username, password = await get_nextcloud_credentials(current_user, nc_user, nc_pass)

    if not password:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Calendar credentials required. Please login to Mail first."
        )

    # Default to current month if not specified
    if not start:
        start = datetime.utcnow().replace(day=1, hour=0, minute=0, second=0, microsecond=0)
    if not end:
        end = start + timedelta(days=31)

    try:
        events = await caldav_service.get_events(username, password, calendar_id, start, end)

        # Expand recurring events into individual instances
        expanded_events = caldav_service.expand_recurring_events(events, start, end)

        return {
            "calendar_id": calendar_id,
            "start": start.isoformat(),
            "end": end.isoformat(),
            "count": len(expanded_events),
            "events": expanded_events
        }
    except CalDAVAuthError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid calendar credentials."
        )
    except CalDAVRateLimitError:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="Too many requests. Please wait and try again."
        )

@router.post("/events")
async def create_event(
    request: EventCreate,
    nc_user: str = None,
    nc_pass: str = None,
    current_user: dict = Depends(get_current_user)
):
    """Create a new calendar event.

    Credentials are automatically retrieved from your mail session.
    """
    username, password = await get_nextcloud_credentials(current_user, nc_user, nc_pass)

    if not password:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Calendar credentials required. Please login to Mail first."
        )

    # Convert recurrence rule to dict for service
    recurrence_dict = None
    if request.recurrence:
        recurrence_dict = {
            "freq": request.recurrence.freq,
            "interval": request.recurrence.interval,
            "by_day": request.recurrence.by_day,
            "by_month_day": request.recurrence.by_month_day,
            "by_month": request.recurrence.by_month,
            "by_set_pos": request.recurrence.by_set_pos,
            "count": request.recurrence.count,
            "until": request.recurrence.until
        }

    try:
        event_uid = await caldav_service.create_event(
            username=username,
            password=password,
            calendar_id=request.calendar_id,
            title=request.title,
            start=request.start,
            end=request.end,
            location=request.location or "",
            description=request.description or "",
            all_day=request.all_day,
            recurrence=recurrence_dict
        )
    except CalDAVRateLimitError:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="Too many requests to calendar server. Please wait a moment and try again."
        )
    except CalDAVAuthError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid Nextcloud credentials. Please check your password."
        )
    except CalDAVNotFoundError:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Calendar not found or user doesn't exist in Nextcloud."
        )

    if not event_uid:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to create event. Please try again later."
        )

    # Send calendar invites to attendees
    invites_sent = []
    if request.send_invites and request.attendees:
        organizer_name = current_user.get("username", "Organizer")
        event_time = request.start.strftime("%B %d, %Y at %I:%M %p")
        event_end_time = request.end.strftime("%I:%M %p")

        for attendee_email in request.attendees:
            try:
                result = await notify_client.send_calendar_invite(
                    to=attendee_email,
                    event_title=request.title,
                    event_time=f"{event_time} - {event_end_time}",
                    location=request.location or "Not specified",
                    organizer_name=organizer_name,
                    description=request.description or "",
                    attendees=request.attendees
                )
                if not result.get("error"):
                    invites_sent.append(attendee_email)
            except Exception as e:
                print(f"Failed to send calendar invite to {attendee_email}: {e}")

    return {
        "success": True,
        "event_uid": event_uid,
        "calendar_id": request.calendar_id,
        "invites_sent": invites_sent
    }

@router.delete("/events/{event_uid}")
async def delete_event(
    event_uid: str,
    calendar_id: str = "personal",
    nc_user: str = None,
    nc_pass: str = None,
    current_user: dict = Depends(get_current_user)
):
    """Delete a calendar event.

    Credentials are automatically retrieved from your mail session.
    """
    username, password = await get_nextcloud_credentials(current_user, nc_user, nc_pass)

    if not password:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Calendar credentials required. Please login to Mail first."
        )

    try:
        success = await caldav_service.delete_event(username, password, calendar_id, event_uid)

        if not success:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Failed to delete event"
            )

        return {"success": True, "deleted": event_uid}
    except CalDAVAuthError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid calendar credentials."
        )


@router.put("/events/{event_uid}")
async def update_event(
    event_uid: str,
    request: EventUpdate,
    calendar_id: str = "personal",
    nc_user: str = None,
    nc_pass: str = None,
    current_user: dict = Depends(get_current_user)
):
    """Update an existing calendar event.

    Credentials are automatically retrieved from your mail session.
    """
    username, password = await get_nextcloud_credentials(current_user, nc_user, nc_pass)

    if not password:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Calendar credentials required. Please login to Mail first."
        )

    # Convert recurrence rule to dict for service
    recurrence_dict = None
    if request.recurrence:
        recurrence_dict = {
            "freq": request.recurrence.freq,
            "interval": request.recurrence.interval,
            "by_day": request.recurrence.by_day,
            "by_month_day": request.recurrence.by_month_day,
            "by_month": request.recurrence.by_month,
            "by_set_pos": request.recurrence.by_set_pos,
            "count": request.recurrence.count,
            "until": request.recurrence.until
        }

    success = await caldav_service.update_event(
        username=username,
        password=password,
        calendar_id=calendar_id,
        event_uid=event_uid,
        title=request.title,
        start=request.start,
        end=request.end,
        location=request.location,
        description=request.description,
        all_day=request.all_day,
        recurrence=recurrence_dict
    )

    if not success:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to update event"
        )

    return {
        "success": True,
        "event_uid": event_uid,
        "calendar_id": calendar_id
    }


@router.get("/events/{event_uid}")
async def get_event(
    event_uid: str,
    calendar_id: str = "personal",
    nc_user: str = None,
    nc_pass: str = None,
    current_user: dict = Depends(get_current_user)
):
    """Get a single calendar event by UID.

    Credentials are automatically retrieved from your mail session.
    """
    username, password = await get_nextcloud_credentials(current_user, nc_user, nc_pass)

    if not password:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Calendar credentials required. Please login to Mail first."
        )

    try:
        event = await caldav_service.get_event(username, password, calendar_id, event_uid)

        if not event:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Event not found"
            )

        # Remove internal raw iCal from response
        if "_raw_ical" in event:
            del event["_raw_ical"]

        return event
    except CalDAVAuthError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid calendar credentials."
        )


@router.get("/today")
async def get_today_events(
    calendar_id: str = "personal",
    nc_user: str = None,
    nc_pass: str = None,
    current_user: dict = Depends(get_current_user)
):
    """Get today's events for quick view.

    Credentials are automatically retrieved from your mail session.
    """
    username, password = await get_nextcloud_credentials(current_user, nc_user, nc_pass)

    if not password:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Calendar credentials required. Please login to Mail first."
        )

    today = datetime.utcnow().replace(hour=0, minute=0, second=0, microsecond=0)
    tomorrow = today + timedelta(days=1)

    try:
        events = await caldav_service.get_events(username, password, calendar_id, today, tomorrow)
        expanded_events = caldav_service.expand_recurring_events(events, today, tomorrow)

        return {
            "date": today.date().isoformat(),
            "count": len(expanded_events),
            "events": expanded_events
        }
    except CalDAVAuthError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid calendar credentials."
        )

@router.get("/week")
async def get_week_events(
    calendar_id: str = "personal",
    nc_user: str = None,
    nc_pass: str = None,
    current_user: dict = Depends(get_current_user)
):
    """Get this week's events.

    Credentials are automatically retrieved from your mail session.
    """
    username, password = await get_nextcloud_credentials(current_user, nc_user, nc_pass)

    if not password:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Calendar credentials required. Please login to Mail first."
        )

    today = datetime.utcnow().replace(hour=0, minute=0, second=0, microsecond=0)
    # Start from Monday of current week
    start_of_week = today - timedelta(days=today.weekday())
    end_of_week = start_of_week + timedelta(days=7)

    try:
        events = await caldav_service.get_events(username, password, calendar_id, start_of_week, end_of_week)
        expanded_events = caldav_service.expand_recurring_events(events, start_of_week, end_of_week)

        return {
            "week_start": start_of_week.date().isoformat(),
            "week_end": end_of_week.date().isoformat(),
            "count": len(expanded_events),
            "events": expanded_events
        }
    except CalDAVAuthError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid calendar credentials."
        )


# Recurring event instance management
class InstanceUpdate(BaseModel):
    """Update a single instance of a recurring event"""
    title: Optional[str] = None
    start: Optional[datetime] = None
    end: Optional[datetime] = None
    location: Optional[str] = None
    description: Optional[str] = None


@router.put("/events/{event_uid}/instance/{instance_date}")
async def update_event_instance(
    event_uid: str,
    instance_date: str,
    request: InstanceUpdate,
    calendar_id: str = "personal",
    nc_user: str = None,
    nc_pass: str = None,
    current_user: dict = Depends(get_current_user)
):
    """
    Update a single instance of a recurring event.
    Creates an exception event with RECURRENCE-ID.
    instance_date should be in ISO format (YYYY-MM-DD or YYYY-MM-DDTHH:MM:SS).

    Credentials are automatically retrieved from your mail session.
    """
    username, password = await get_nextcloud_credentials(current_user, nc_user, nc_pass)

    if not password:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Calendar credentials required. Please login to Mail first."
        )

    # Parse instance date
    try:
        if "T" in instance_date:
            original_start = datetime.fromisoformat(instance_date.replace("Z", "+00:00"))
        else:
            original_start = datetime.strptime(instance_date, "%Y-%m-%d")
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid instance_date format. Use YYYY-MM-DD or ISO datetime."
        )

    result = await caldav_service.update_recurring_instance(
        username=username,
        password=password,
        calendar_id=calendar_id,
        master_event_uid=event_uid,
        original_start=original_start,
        title=request.title,
        start=request.start,
        end=request.end,
        location=request.location,
        description=request.description
    )

    if not result:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to update event instance"
        )

    return {
        "success": True,
        "master_event_uid": event_uid,
        "instance_date": instance_date,
        "exception_event_uid": result
    }


@router.delete("/events/{event_uid}/instance/{instance_date}")
async def delete_event_instance(
    event_uid: str,
    instance_date: str,
    calendar_id: str = "personal",
    nc_user: str = None,
    nc_pass: str = None,
    current_user: dict = Depends(get_current_user)
):
    """
    Delete a single instance of a recurring event.
    Adds EXDATE to the master event to exclude this occurrence.
    instance_date should be in ISO format (YYYY-MM-DD or YYYY-MM-DDTHH:MM:SS).

    Credentials are automatically retrieved from your mail session.
    """
    username, password = await get_nextcloud_credentials(current_user, nc_user, nc_pass)

    if not password:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Calendar credentials required. Please login to Mail first."
        )

    # Parse instance date
    try:
        if "T" in instance_date:
            exclude_date = datetime.fromisoformat(instance_date.replace("Z", "+00:00"))
        else:
            exclude_date = datetime.strptime(instance_date, "%Y-%m-%d")
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid instance_date format. Use YYYY-MM-DD or ISO datetime."
        )

    success = await caldav_service.delete_recurring_instance(
        username=username,
        password=password,
        calendar_id=calendar_id,
        event_uid=event_uid,
        exclude_date=exclude_date
    )

    if not success:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to delete event instance"
        )

    return {
        "success": True,
        "event_uid": event_uid,
        "excluded_date": instance_date
    }


# ============================================================================
# Reminder Management Endpoints
# ============================================================================

class ReminderCreate(BaseModel):
    """Create a reminder for an event"""
    reminder_type: str = "browser"  # browser, email, sms, whatsapp
    minutes_before: int = 10  # Minutes before event to send reminder


class ReminderResponse(BaseModel):
    """Reminder response"""
    id: str
    event_uid: str
    reminder_type: str
    minutes_before: int
    trigger_time: str
    status: str


@router.post("/events/{event_uid}/reminders")
async def add_event_reminder(
    event_uid: str,
    reminder: ReminderCreate,
    calendar_id: str = "personal",
    nc_user: str = None,
    nc_pass: str = None,
    current_user: dict = Depends(get_current_user)
):
    """
    Add a reminder to a calendar event.
    Supported types: browser, email, sms, whatsapp

    Credentials are automatically retrieved from your mail session.
    """
    from services.calendar_reminder_service import calendar_reminder_service
    from core.database import async_session_maker

    username, password = await get_nextcloud_credentials(current_user, nc_user, nc_pass)

    if not password:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Calendar credentials required. Please login to Mail first."
        )

    # Get event details
    event = await caldav_service.get_event(username, password, calendar_id, event_uid)
    if not event:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Event not found"
        )

    # Parse event start time
    try:
        event_start = datetime.fromisoformat(event["start"].replace("Z", "+00:00"))
    except:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid event start time"
        )

    # Schedule reminder
    async with async_session_maker() as db:
        reminder_id = await calendar_reminder_service.schedule_reminder(
            db=db,
            user_id=current_user["id"],
            event_uid=event_uid,
            calendar_id=calendar_id,
            event_title=event.get("title", "Untitled Event"),
            event_start=event_start,
            event_location=event.get("location"),
            reminder_type=reminder.reminder_type,
            minutes_before=reminder.minutes_before,
            user_email=current_user.get("email"),
            user_phone=current_user.get("phone")
        )

    if not reminder_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Could not schedule reminder (event may be in the past)"
        )

    return {
        "success": True,
        "reminder_id": reminder_id,
        "event_uid": event_uid,
        "reminder_type": reminder.reminder_type,
        "minutes_before": reminder.minutes_before
    }


@router.get("/events/{event_uid}/reminders")
async def get_event_reminders(
    event_uid: str,
    current_user: dict = Depends(get_current_user)
):
    """Get all reminders for an event"""
    from services.calendar_reminder_service import calendar_reminder_service
    from core.database import async_session_maker

    async with async_session_maker() as db:
        reminders = await calendar_reminder_service.get_event_reminders(
            db=db,
            event_uid=event_uid,
            user_id=current_user["id"]
        )

    return {
        "event_uid": event_uid,
        "count": len(reminders),
        "reminders": [
            {
                "id": str(r.id),
                "reminder_type": r.reminder_type,
                "minutes_before": r.minutes_before,
                "trigger_time": r.trigger_time.isoformat() if r.trigger_time else None,
                "status": r.status
            }
            for r in reminders
        ]
    }


@router.delete("/events/{event_uid}/reminders/{reminder_id}")
async def delete_event_reminder(
    event_uid: str,
    reminder_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Cancel a specific reminder"""
    from services.calendar_reminder_service import calendar_reminder_service
    from core.database import async_session_maker
    from uuid import UUID

    async with async_session_maker() as db:
        success = await calendar_reminder_service.cancel_reminder(
            db=db,
            reminder_id=UUID(reminder_id)
        )

    if not success:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Reminder not found"
        )

    return {"success": True, "cancelled": reminder_id}


@router.delete("/events/{event_uid}/reminders")
async def delete_all_event_reminders(
    event_uid: str,
    current_user: dict = Depends(get_current_user)
):
    """Cancel all reminders for an event"""
    from services.calendar_reminder_service import calendar_reminder_service
    from core.database import async_session_maker

    async with async_session_maker() as db:
        cancelled = await calendar_reminder_service.cancel_event_reminders(
            db=db,
            event_uid=event_uid,
            user_id=current_user["id"]
        )

    return {
        "success": True,
        "event_uid": event_uid,
        "cancelled_count": cancelled
    }


@router.get("/reminders")
async def get_user_reminders(
    status_filter: str = None,
    limit: int = 50,
    current_user: dict = Depends(get_current_user)
):
    """Get all reminders for the current user"""
    from services.calendar_reminder_service import calendar_reminder_service
    from core.database import async_session_maker

    async with async_session_maker() as db:
        reminders = await calendar_reminder_service.get_user_reminders(
            db=db,
            user_id=current_user["id"],
            status=status_filter,
            limit=limit
        )

    return {
        "count": len(reminders),
        "reminders": [
            {
                "id": str(r.id),
                "event_uid": r.event_uid,
                "event_title": r.event_title,
                "event_start": r.event_start.isoformat() if r.event_start else None,
                "event_location": r.event_location,
                "reminder_type": r.reminder_type,
                "minutes_before": r.minutes_before,
                "trigger_time": r.trigger_time.isoformat() if r.trigger_time else None,
                "status": r.status,
                "sent_at": r.sent_at.isoformat() if r.sent_at else None
            }
            for r in reminders
        ]
    }


# ============================================================================
# Search Endpoint
# ============================================================================

@router.get("/search")
async def search_events(
    query: str = Query(..., min_length=1, description="Search query"),
    start: datetime = None,
    end: datetime = None,
    calendar_ids: str = None,
    nc_user: str = None,
    nc_pass: str = None,
    current_user: dict = Depends(get_current_user)
):
    """
    Search for events by title, description, or location.

    Parameters:
    - query: Search term (required, min 1 character)
    - start: Start date for search range (optional, defaults to 3 months ago)
    - end: End date for search range (optional, defaults to 3 months ahead)
    - calendar_ids: Comma-separated list of calendar IDs to search (optional)

    Credentials are automatically retrieved from your mail session.
    """
    username, password = await get_nextcloud_credentials(current_user, nc_user, nc_pass)

    if not password:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Calendar credentials required. Please login to Mail first."
        )

    # Default search range: 3 months before to 3 months after today
    if not start:
        start = datetime.utcnow() - timedelta(days=90)
    if not end:
        end = datetime.utcnow() + timedelta(days=90)

    # Parse calendar IDs
    calendar_id_list = None
    if calendar_ids:
        calendar_id_list = [cid.strip() for cid in calendar_ids.split(",")]

    # Get all calendars if no specific ones requested
    if not calendar_id_list:
        calendars = await caldav_service.get_calendars(username, password)
        calendar_id_list = [c.get("id", "personal") for c in calendars]

    # Search across all specified calendars
    all_events = []
    query_lower = query.lower()

    for calendar_id in calendar_id_list:
        try:
            events = await caldav_service.get_events(username, password, calendar_id, start, end)
            # Expand recurring events
            expanded = caldav_service.expand_recurring_events(events, start, end)

            # Filter by search query
            for event in expanded:
                title = (event.get("title") or "").lower()
                description = (event.get("description") or "").lower()
                location = (event.get("location") or "").lower()

                if (query_lower in title or
                    query_lower in description or
                    query_lower in location):
                    event["calendar_id"] = calendar_id
                    all_events.append(event)
        except Exception as e:
            # Continue searching other calendars if one fails
            print(f"Error searching calendar {calendar_id}: {e}")
            continue

    # Sort by start date
    all_events.sort(key=lambda e: e.get("start", ""))

    return {
        "query": query,
        "start": start.isoformat(),
        "end": end.isoformat(),
        "count": len(all_events),
        "events": all_events
    }
